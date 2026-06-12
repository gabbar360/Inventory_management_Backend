const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ============ Helper Functions ============

function generateFirst4RandomDigits() {
  // Generate 4 random digits
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return random;
}

function generateSecond2RandomDigits() {
  // Generate 2 random digits
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return random;
}

async function generateBarcodeFromProduct(product, tx = prisma, generatedBarcodes = new Set()) {
  // Format: SKU (3 digits) + UPC last 4 digits (4 digits) + 4 random digits + 2 random digits = 13 digits total
  
  if (!product.sku || !product.upc) {
    throw new Error('Product must have both SKU and UPC for barcode generation');
  }

  // Ensure SKU is string and exactly 3 digits
  let skuPart = String(product.sku).trim();
  if (skuPart.length < 3) {
    skuPart = skuPart.padStart(3, '0');
  } else if (skuPart.length > 3) {
    skuPart = skuPart.slice(-3); // Take last 3 if longer
  }
  
  // Ensure UPC is string and get last 4 digits
  let upcPart = String(product.upc).trim();
  const upcLast4 = upcPart.slice(-4); // Last 4 characters
  
  console.log(`[Barcode Generation] SKU: ${skuPart}, UPC: ${upcPart}, UPC Last 4: ${upcLast4}`);
  
  if (skuPart.length !== 3) {
    throw new Error(`SKU must be exactly 3 digits, got ${skuPart.length} (${skuPart})`);
  }
  if (upcLast4.length !== 4) {
    throw new Error(`UPC last 4 must be 4 digits, got ${upcLast4.length} (${upcLast4})`);
  }
  
  let barcode;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;
  
  // Keep generating until we get a unique barcode
  while (!isUnique && attempts < maxAttempts) {
    const first4Random = generateFirst4RandomDigits();
    const second2Random = generateSecond2RandomDigits();
    
    barcode = `${skuPart}${upcLast4}${first4Random}${second2Random}`;
    
    console.log(`[Barcode Generation] Attempt ${attempts + 1}: ${barcode} (length: ${barcode.length})`);
    
    // Verify final barcode is 13 digits
    if (barcode.length !== 13) {
      attempts++;
      continue;
    }
    
    // Check if barcode already exists in memory (current batch)
    if (generatedBarcodes.has(barcode)) {
      console.log(`[Barcode Generation] ⚠️ Duplicate in current batch: ${barcode}`);
      attempts++;
      continue;
    }
    
    // Check if barcode already exists in database
    const existing = await tx.boxDetail.findUnique({
      where: { barcode }
    });
    
    if (!existing) {
      isUnique = true;
      console.log(`[Barcode Generation] ✅ Unique barcode generated: ${barcode}`);
    } else {
      console.log(`[Barcode Generation] ⚠️ Barcode exists in DB: ${barcode}`);
    }
    
    attempts++;
  }
  
  if (!isUnique) {
    throw new Error('Failed to generate unique barcode after 100 attempts');
  }
  
  return barcode;
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

    const dataToCreate = [];
    const barcodes = [];
    const generatedBarcodes = new Set();

    for (const item of po.items) {
      if (existingProductIds.has(item.productId)) continue;
      const boxCount = item.boxes || 1;
      const packPerBox = item.packPerBox || 28;
      const packPerPiece = item.packPerPiece || 25;

      for (let i = 1; i <= boxCount; i++) {
        const barcode = await generateBarcodeFromProduct(item.product, tx, generatedBarcodes);
        barcodes.push(barcode);
        generatedBarcodes.add(barcode);
        
        dataToCreate.push({
          barcode,
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
          in: barcodes
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

    const dataToCreate = [];
    const barcodes = [];
    const generatedBarcodes = new Set();

    for (const item of invoice.items) {
      if (existingProductIds.has(item.productId)) continue;
      const boxCount = item.boxes || 1;
      const packPerBox = item.packPerBox || 28;
      const packPerPiece = item.packPerPiece || 25;

      for (let i = 1; i <= boxCount; i++) {
        const barcode = await generateBarcodeFromProduct(item.product, tx, generatedBarcodes);
        barcodes.push(barcode);
        generatedBarcodes.add(barcode);
        
        dataToCreate.push({
          barcode,
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
          in: barcodes
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
    
    // Clear any stale cache for this barcode
    clearCache(`lookup-${barcode}`);
    
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
