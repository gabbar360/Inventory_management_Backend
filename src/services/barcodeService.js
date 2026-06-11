const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ============ Helper Functions ============

function generateBarcodeFromId(id) {
  // EAN-13 Standard for internal inventory (Private Prefix 200 + 9-digit padded ID + 1-digit checksum)
  const code12 = `200${String(id).padStart(9, '0')}`;
  
  // Calculate EAN-13 checksum digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12[i], 10);
    if (i % 2 === 0) {
      sum += digit; // Odd positions (1st, 3rd, 5th...)
    } else {
      sum += digit * 3; // Even positions (2nd, 4th, 6th...)
    }
  }
  const mod = sum % 10;
  const checksum = mod === 0 ? 0 : 10 - mod;
  
  return `${code12}${checksum}`;
}

function validateBarcodeFormat(barcode) {
  if (!barcode || typeof barcode !== 'string') return false;
  if (barcode.length < 5 || barcode.length > 50) return false;
  return /^[A-Z0-9]+$/.test(barcode);
}

// ============ Cache Management ============

// In-memory cache for barcodes (30 minute TTL)
const barcodeCache = new Map();
const CACHE_TTL = 1800000;

function setCacheWithTTL(key, value) {
  barcodeCache.set(key, { value, timestamp: Date.now() });
  setTimeout(() => barcodeCache.delete(key), CACHE_TTL);
}

function getCache(key) {
  const cached = barcodeCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }
  barcodeCache.delete(key);
  return null;
}

function clearCache(key) {
  barcodeCache.delete(key);
}

// ============ Barcode Service Class ============

class BarcodeService {
  static async generateExpectedBoxesForPO(poId, tx = prisma) {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: parseInt(poId) },
      include: { items: { include: { product: true } } }
    });
    if (!po) throw new Error('Purchase Order not found');

    const existingBoxes = await tx.boxDetail.findMany({
      where: { purchaseOrderId: po.id, status: 'expected' },
      select: { productId: true }
    });
    const existingProductIds = new Set(existingBoxes.map(b => b.productId));

    let lastId = await tx.boxDetail.findFirst({
      select: { id: true },
      orderBy: { id: 'desc' }
    });
    let nextId = (lastId?.id || 0) + 1;

    const dataToCreate = [];
    for (const item of po.items) {
      if (existingProductIds.has(item.productId)) continue;
      const boxCount = item.boxes || 1;
      const packPerBox = item.packPerBox || 28;
      const packPerPiece = item.packPerPiece || 25;

      for (let i = 1; i <= boxCount; i++) {
        dataToCreate.push({
          barcode: generateBarcodeFromId(nextId++),
          productId: item.productId,
          purchaseOrderId: po.id,
          boxIndex: i,
          totalBoxes: boxCount,
          packPerBox,
          packPerPiece,
          totalPcs: packPerBox * packPerPiece,
          status: 'expected',
          batchCode: item.batchCode || null,
          mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
          color: item.color || null,
          brand: item.brand || null,
        });
      }
    }

    if (dataToCreate.length > 0) {
      await tx.boxDetail.createMany({
        data: dataToCreate
      });
    }

    const createdBoxes = await tx.boxDetail.findMany({
      where: {
        purchaseOrderId: po.id,
        barcode: {
          in: dataToCreate.map(d => d.barcode)
        }
      }
    });
    return createdBoxes;
  }

  static async generateInwardedBoxesForInvoice(inwardInvoiceId, tx = prisma) {
    const invoice = await tx.inwardInvoice.findUnique({
      where: { id: parseInt(inwardInvoiceId) },
      include: { items: { include: { product: true } } }
    });
    if (!invoice) throw new Error('Inward Invoice not found');

    const existingBoxes = await tx.boxDetail.findMany({
      where: { inwardInvoiceId: invoice.id },
      select: { productId: true }
    });
    const existingProductIds = new Set(existingBoxes.map(b => b.productId));

    let lastId = await tx.boxDetail.findFirst({
      select: { id: true },
      orderBy: { id: 'desc' }
    });
    let nextId = (lastId?.id || 0) + 1;

    const dataToCreate = [];
    for (const item of invoice.items) {
      if (existingProductIds.has(item.productId)) continue;
      const boxCount = item.boxes || 1;
      const packPerBox = item.packPerBox || 28;
      const packPerPiece = item.packPerPiece || 25;

      for (let i = 1; i <= boxCount; i++) {
        dataToCreate.push({
          barcode: generateBarcodeFromId(nextId++),
          productId: item.productId,
          inwardInvoiceId: invoice.id,
          boxIndex: i,
          totalBoxes: boxCount,
          packPerBox,
          packPerPiece,
          totalPcs: packPerBox * packPerPiece,
          status: 'inwarded',
          color: item.color || null,
          brand: item.brand || null,
        });
      }
    }

    if (dataToCreate.length > 0) {
      await tx.boxDetail.createMany({
        data: dataToCreate
      });
    }

    const createdBoxes = await tx.boxDetail.findMany({
      where: {
        inwardInvoiceId: invoice.id,
        barcode: {
          in: dataToCreate.map(d => d.barcode)
        }
      }
    });
    return createdBoxes;
  }

  static async lookupBarcode(barcode) {
    if (!validateBarcodeFormat(barcode)) {
      throw new Error('Invalid barcode format');
    }

    const box = await prisma.boxDetail.findUnique({
      where: { barcode },
      include: {
        product: { include: { category: true } },
        purchaseOrder: {
          include: {
            vendor: true,
            items: true
          }
        },
        inwardInvoice: { include: { vendor: true, location: true } },
        stockBatch: { include: { location: true, vendor: true } }
      }
    });
    
    return box;
  }

  static async scanBarcode(barcode, flow, locationId, customerId) {
    if (!validateBarcodeFormat(barcode)) {
      throw new Error('Invalid barcode format');
    }

    if (!['inward', 'outward'].includes(flow)) {
      throw new Error(`Invalid flow: ${flow}. Must be 'inward' or 'outward'`);
    }
    
    return await prisma.$transaction(async (tx) => {
      const box = await tx.boxDetail.findUnique({
        where: { barcode },
        include: {
          product: { include: { category: true } },
          purchaseOrder: {
            include: {
              vendor: true,
              items: true
            }
          },
          stockBatch: true
        }
      });
      if (!box) throw new Error(`Barcode ${barcode} not found in system`);

      if (flow === 'inward') {
        if (box.status === 'inwarded') {
          throw new Error('This box has already been inwarded');
        }
        if (box.status === 'outwarded') {
          throw new Error('This box is marked as outwarded');
        }

        const targetLocId = parseInt(locationId) || 1;
        const vendorId = box.purchaseOrder?.vendorId || 1;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        let invoice = await tx.inwardInvoice.findFirst({
          where: {
            vendorId,
            locationId: targetLocId,
            date: {
              gte: today,
              lt: tomorrow
            }
          }
        });

        if (!invoice) {
          const count = await tx.inwardInvoice.count();
          const invoiceNo = `INW-SCAN-${String(count + 1).padStart(5, '0')}`;
          invoice = await tx.inwardInvoice.create({
            data: {
              invoiceNo,
              date: new Date(),
              vendorId,
              locationId: targetLocId,
              totalCost: 0
            }
          });
        }

        const matchingPoItem = box.purchaseOrder?.items?.find(
          (item) => item.productId === box.productId
        );
        
        let rate = matchingPoItem?.ratePerBox || matchingPoItem?.rate || 0;
        if (rate < 0 || isNaN(rate)) {
          throw new Error('Invalid rate from Purchase Order');
        }
        
        const gstRate = box.product?.category?.gstRate || 0;
        const baseAmount = rate;
        const gstAmount = (baseAmount * gstRate) / 100;
        const totalCost = baseAmount + gstAmount;

        await tx.inwardItem.create({
          data: {
            inwardInvoiceId: invoice.id,
            productId: box.productId,
            boxes: 1,
            packPerBox: box.packPerBox,
            packPerPiece: box.packPerPiece,
            totalPacks: box.packPerBox,
            totalPcs: box.packPerBox * box.packPerPiece,
            unit: 'box',
            ratePerBox: rate,
            ratePerPack: box.packPerBox > 0 ? rate / box.packPerBox : 0,
            ratePerPcs: (box.packPerBox > 0 && box.packPerPiece > 0) ? rate / (box.packPerBox * box.packPerPiece) : 0,
            gstAmount,
            totalCost,
            color: box.color || null,
            brand: box.brand || null
          }
        });

        const stockBatch = await tx.stockBatch.create({
          data: {
            productId: box.productId,
            vendorId,
            locationId: targetLocId,
            inwardInvoiceId: invoice.id,
            inwardDate: new Date(),
            boxes: 1,
            packPerBox: box.packPerBox,
            packPerPiece: box.packPerPiece,
            totalPacks: box.packPerBox,
            totalPcs: box.packPerBox * box.packPerPiece,
            remainingBoxes: 1,
            remainingPacks: box.packPerBox,
            remainingPcs: box.packPerBox * box.packPerPiece,
            costPerBox: rate,
            costPerPack: box.packPerBox > 0 ? rate / box.packPerBox : 0,
            costPerPcs: (box.packPerBox > 0 && box.packPerPiece > 0) ? rate / (box.packPerBox * box.packPerPiece) : 0,
            batchCode: box.batchCode || null,
            mfgDate: box.mfgDate || null
          }
        });

        await tx.stockMovement.create({
          data: {
            type: 'inward',
            referenceId: invoice.id,
            productId: box.productId,
            locationId: targetLocId,
            quantity: box.packPerBox * box.packPerPiece,
            movementDate: new Date()
          }
        });

        const updatedBox = await tx.boxDetail.update({
          where: { id: box.id },
          data: {
            status: 'inwarded',
            inwardInvoiceId: invoice.id,
            stockBatchId: stockBatch.id
          },
          include: { product: true }
        });

        clearCache(`lookup-${barcode}`);

        return {
          message: `Box ${box.boxIndex} of ${box.totalBoxes} inwarded successfully`,
          box: updatedBox,
          inwardInvoice: invoice
        };

      } else if (flow === 'outward') {
        if (box.status === 'expected') {
          throw new Error('This box is not yet inwarded');
        }
        if (box.status === 'outwarded') {
          throw new Error('This box has already been outwarded');
        }

        const targetCustomerId = parseInt(customerId) || 1;
        const targetLocId = parseInt(locationId) || box.stockBatch?.locationId || 1;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let invoice = await tx.outwardInvoice.findFirst({
          where: {
            customerId: targetCustomerId,
            date: {
              gte: today,
              lt: tomorrow
            }
          }
        });

        if (!invoice) {
          const count = await tx.outwardInvoice.count();
          const invoiceNo = `OUT-SCAN-${String(count + 1).padStart(5, '0')}`;
          invoice = await tx.outwardInvoice.create({
            data: {
              invoiceNo,
              date: new Date(),
              customerId: targetCustomerId,
              saleType: 'domestic',
              totalCost: 0
            }
          });
        }

        const stockBatch = box.stockBatchId 
          ? await tx.stockBatch.findUnique({ where: { id: box.stockBatchId } })
          : await tx.stockBatch.findFirst({ where: { productId: box.productId, remainingBoxes: { gt: 0 } } });

        if (!stockBatch || stockBatch.remainingBoxes <= 0) {
          throw new Error('Associated stock batch is empty or not found');
        }

        await tx.outwardItem.create({
          data: {
            outwardInvoiceId: invoice.id,
            productId: box.productId,
            stockBatchId: stockBatch.id,
            locationId: targetLocId,
            saleUnit: 'box',
            quantity: 1,
            ratePerUnit: stockBatch.costPerBox || 0,
            totalCost: stockBatch.costPerBox || 0
          }
        });

        const updatedPcs = stockBatch.remainingPcs - (box.packPerBox * box.packPerPiece);
        if (updatedPcs < 0) throw new Error('Insufficient stock in batch');

        const updatedPacks = Math.floor(updatedPcs / box.packPerPiece);
        const updatedBoxes = Math.floor(updatedPacks / box.packPerBox);

        await tx.stockBatch.update({
          where: { id: stockBatch.id },
          data: {
            remainingBoxes: updatedBoxes,
            remainingPacks: updatedPacks,
            remainingPcs: updatedPcs
          }
        });

        await tx.stockMovement.create({
          data: {
            type: 'outward',
            referenceId: invoice.id,
            productId: box.productId,
            locationId: targetLocId,
            quantity: -(box.packPerBox * box.packPerPiece),
            movementDate: new Date()
          }
        });

        const updatedBox = await tx.boxDetail.update({
          where: { id: box.id },
          data: {
            status: 'outwarded',
            outwardInvoiceId: invoice.id
          },
          include: { product: true }
        });

        clearCache(`lookup-${barcode}`);

        return {
          message: `Box ${box.boxIndex} of ${box.totalBoxes} outwarded successfully`,
          box: updatedBox,
          outwardInvoice: invoice
        };
      }
    });
  }

  static async getBarcodesForPrint(source, id) {
    const numId = parseInt(id);
    let boxes = [];
    if (source === 'po') {
      boxes = await prisma.boxDetail.findMany({
        where: { purchaseOrderId: numId },
        include: {
          product: { include: { category: true } },
          purchaseOrder: { include: { vendor: true } }
        },
        orderBy: [{ productId: 'asc' }, { boxIndex: 'asc' }]
      });
      if (boxes.length === 0) {
        boxes = await this.generateExpectedBoxesForPO(numId);
        boxes = await prisma.boxDetail.findMany({
          where: { purchaseOrderId: numId },
          include: {
            product: { include: { category: true } },
            purchaseOrder: { include: { vendor: true } }
          },
          orderBy: [{ productId: 'asc' }, { boxIndex: 'asc' }]
        });
      }
    } else if (source === 'inward') {
      const stockBatches = await prisma.stockBatch.findMany({
        where: { inwardInvoiceId: numId }
      });
      
      if (stockBatches.length > 0) {
        for (const batch of stockBatches) {
          await prisma.boxDetail.updateMany({
            where: {
              inwardInvoiceId: numId,
              productId: batch.productId,
              stockBatchId: null
            },
            data: {
              stockBatchId: batch.id
            }
          });
        }
      }

      boxes = await prisma.boxDetail.findMany({
        where: { inwardInvoiceId: numId },
        include: {
          product: { include: { category: true } },
          inwardInvoice: { include: { vendor: true, location: true } },
          stockBatch: true
        },
        orderBy: [{ productId: 'asc' }, { boxIndex: 'asc' }]
      });
      if (boxes.length === 0) {
        boxes = await this.generateInwardedBoxesForInvoice(numId);
        const freshBatches = await prisma.stockBatch.findMany({
          where: { inwardInvoiceId: numId }
        });
        if (freshBatches.length > 0) {
          for (const batch of freshBatches) {
            await prisma.boxDetail.updateMany({
              where: {
                inwardInvoiceId: numId,
                productId: batch.productId,
                stockBatchId: null
              },
              data: {
                stockBatchId: batch.id
              }
            });
          }
        }
        boxes = await prisma.boxDetail.findMany({
          where: { inwardInvoiceId: numId },
          include: {
            product: { include: { category: true } },
            inwardInvoice: { include: { vendor: true, location: true } },
            stockBatch: true
          },
          orderBy: [{ productId: 'asc' }, { boxIndex: 'asc' }]
        });
      }
    } else {
      throw new Error(`Invalid source: ${source}`);
    }
    
    return boxes;
  }
}

module.exports = { BarcodeService, validateBarcodeFormat, barcodeCache, clearCache };
