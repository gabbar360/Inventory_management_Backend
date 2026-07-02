const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');
const { InventoryService } = require('./inventoryService');

const prisma = new PrismaClient();

class InwardService {
  static async getAll(page, limit, search, sortBy, sortOrder, startDate, endDate, vendorId) {
    const where = {};
    
    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { vendor: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (vendorId) {
      where.vendorId = parseInt(vendorId);
    }
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const total = await prisma.inwardInvoice.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const invoices = await prisma.inwardInvoice.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        vendor: {
          select: { name: true, code: true },
        },
        location: {
          select: { name: true },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                grade: true,
                category: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    return {
      invoices,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id) {
    const invoice = await prisma.inwardInvoice.findUnique({
      where: { id: parseInt(id) },
      include: {
        vendor: true,
        location: true,
        items: {
          where: { parentItemId: null },
          include: {
            product: {
              include: {
                category: true,
              },
            },
            subItems: {
              include: {
                product: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return invoice;
  }

  static async create(data) {
    return await prisma.$transaction(async (tx) => {
      // Helper function to round a number to 2 decimal places
      const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

      // 1. Calculate base quantities and costs (without expense) for all parent items and their sub-items
      const processedItems = await Promise.all(
        data.items.map(async (parentInput) => {
          const product = await tx.product.findUnique({
            where: { id: parseInt(parentInput.productId) },
            include: { category: true },
          });
          if (!product) throw new Error(`Product not found: ${parentInput.productId}`);
          const gstRate = product.category?.gstRate || 0;

          const calculateItemRatesAndCost = (qtyBoxes, packPerBox, packPerPiece, rateInput, unitInput) => {
            const totalPacks = qtyBoxes * packPerBox;
            const totalPcs = totalPacks * packPerPiece;
            const unit = unitInput || 'box';
            let ratePerBox, ratePerPack, ratePerPcs, baseAmount;

            if (unit === 'box') {
              ratePerBox = rateInput;
              ratePerPack = ratePerBox / packPerBox;
              ratePerPcs = ratePerPack / packPerPiece;
              baseAmount = qtyBoxes * ratePerBox;
            } else if (unit === 'pack') {
              ratePerPack = rateInput;
              ratePerBox = ratePerPack * packPerBox;
              ratePerPcs = ratePerPack / packPerPiece;
              baseAmount = totalPacks * ratePerPack;
            } else {
              ratePerPcs = rateInput;
              ratePerPack = ratePerPcs * packPerPiece;
              ratePerBox = ratePerPack * packPerBox;
              baseAmount = totalPcs * ratePerPcs;
            }
            const gstAmount = (baseAmount * gstRate) / 100;
            const totalCost = baseAmount + gstAmount;

            return {
              totalPacks,
              totalPcs,
              ratePerBox,
              ratePerPack,
              ratePerPcs,
              gstAmount,
              baseAmount,
              totalCost
            };
          };

          const parentOriginal = calculateItemRatesAndCost(
            parentInput.boxes,
            parentInput.packPerBox,
            parentInput.packPerPiece,
            parentInput.ratePerBox,
            parentInput.unit
          );

          const subItemsProcessed = [];
          let sumSubBoxes = 0;
          let sumSubPcs = 0;

          if (parentInput.subItems && parentInput.subItems.length > 0) {
            for (const subItem of parentInput.subItems) {
              const subProcessed = calculateItemRatesAndCost(
                subItem.boxes,
                subItem.packPerBox,
                subItem.packPerPiece,
                subItem.ratePerBox,
                subItem.unit
              );
              subItemsProcessed.push({
                ...subItem,
                ...subProcessed
              });
              sumSubBoxes += subItem.boxes;
              sumSubPcs += subProcessed.totalPcs;
            }
          }

          const remainderBoxes = parentInput.boxes;
          const remainderPcs = parentOriginal.totalPcs;

          const parentRemainder = calculateItemRatesAndCost(
            remainderBoxes,
            parentInput.packPerBox,
            parentInput.packPerPiece,
            parentInput.ratePerBox,
            parentInput.unit
          );

          return {
            parentInput,
            parentOriginal,
            parentRemainder,
            remainderBoxes,
            remainderPcs,
            subItemsProcessed
          };
        })
      );

      // 2. Calculate the total actual pcs to allocate expense proportionally
      let totalInvoiceActualPcs = 0;
      for (const p of processedItems) {
        if (p.parentRemainder) {
          totalInvoiceActualPcs += p.parentRemainder.totalPcs;
        }
        for (const sub of p.subItemsProcessed) {
          totalInvoiceActualPcs += sub.totalPcs;
        }
      }

      const expense = data.expense || 0;
      const expenseSharePerPc = totalInvoiceActualPcs > 0 ? expense / totalInvoiceActualPcs : 0;

      // 3. Create Inward Invoice
      const invoice = await tx.inwardInvoice.create({
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          vendorId: parseInt(data.vendorId),
          locationId: parseInt(data.locationId),
          expense,
          totalCost: 0, // Will update this after creating items with rounded totals
        },
      });

      // 4. Create inwardItems, stockBatches, and stockMovements
      let invoiceTotalCost = 0;

      for (const p of processedItems) {
        let parentItemTotalCost = 0;
        let parentRemainderPcs = 0;
        let parentRemainderBoxes = 0;
        let parentRemainderPacks = 0;
        let parentRemainderGst = 0;

        if (p.parentRemainder) {
          parentRemainderBoxes = p.remainderBoxes;
          parentRemainderPacks = p.parentRemainder.totalPacks;
          parentRemainderPcs = p.parentRemainder.totalPcs;
          parentRemainderGst = round2(p.parentRemainder.gstAmount);
          const share = parentRemainderPcs * expenseSharePerPc;
          parentItemTotalCost = round2(p.parentRemainder.totalCost + share);
        }

        const createdParentItem = await tx.inwardItem.create({
          data: {
            inwardInvoiceId: invoice.id,
            productId: parseInt(p.parentInput.productId),
            boxes: parentRemainderBoxes,
            packPerBox: p.parentInput.packPerBox,
            packPerPiece: p.parentInput.packPerPiece,
            totalPacks: parentRemainderPacks,
            totalPcs: parentRemainderPcs,
            unit: p.parentInput.unit || 'box',
            ratePerBox: round2(p.parentRemainder ? p.parentRemainder.ratePerBox : p.parentOriginal.ratePerBox),
            ratePerPack: round2(p.parentRemainder ? p.parentRemainder.ratePerPack : p.parentOriginal.ratePerPack),
            ratePerPcs: round2(p.parentRemainder ? p.parentRemainder.ratePerPcs : p.parentOriginal.ratePerPcs),
            gstAmount: parentRemainderGst,
            totalCost: parentItemTotalCost,
            batchCode: p.parentInput.batchCode || null,
            mfgDate: p.parentInput.mfgDate ? new Date(p.parentInput.mfgDate) : null,
            color: p.parentInput.color || null,
            brand: p.parentInput.brand || null,
          },
        });

        invoiceTotalCost += parentItemTotalCost;

        if (parentRemainderPcs > 0) {
          await InventoryService.createStockBatch(createdParentItem, invoice);
          await tx.stockMovement.create({
            data: {
              type: 'inward',
              referenceId: invoice.id,
              productId: parseInt(p.parentInput.productId),
              locationId: parseInt(data.locationId),
              quantity: parentRemainderPcs,
              movementDate: new Date(data.date),
            },
          });
        }

        for (const sub of p.subItemsProcessed) {
          const share = sub.totalPcs * expenseSharePerPc;
          const subTotalCostWithExpense = round2(sub.totalCost + share);

          const createdSubItem = await tx.inwardItem.create({
            data: {
              inwardInvoiceId: invoice.id,
              productId: parseInt(p.parentInput.productId),
              parentItemId: createdParentItem.id,
              boxes: sub.boxes,
              packPerBox: sub.packPerBox,
              packPerPiece: sub.packPerPiece,
              totalPacks: sub.totalPacks,
              totalPcs: sub.totalPcs,
              unit: sub.unit,
              ratePerBox: round2(sub.ratePerBox),
              ratePerPack: round2(sub.ratePerPack),
              ratePerPcs: round2(sub.ratePerPcs),
              gstAmount: round2(sub.gstAmount),
              totalCost: subTotalCostWithExpense,
              batchCode: sub.batchCode || null,
              mfgDate: sub.mfgDate ? new Date(sub.mfgDate) : null,
              color: sub.color || null,
              brand: sub.brand || null,
            },
          });

          invoiceTotalCost += subTotalCostWithExpense;

          await InventoryService.createStockBatch(createdSubItem, invoice);
          await tx.stockMovement.create({
            data: {
              type: 'inward',
              referenceId: invoice.id,
              productId: parseInt(p.parentInput.productId),
              locationId: parseInt(data.locationId),
              quantity: sub.totalPcs,
              movementDate: new Date(data.date),
            },
          });
        }
      }

      await tx.inwardInvoice.update({
        where: { id: invoice.id },
        data: { totalCost: round2(invoiceTotalCost) },
      });

      const { BarcodeService } = require('./barcodeService');
      const stockBatches = await tx.stockBatch.findMany({
        where: { inwardInvoiceId: invoice.id }
      });
      if (data.scannedBarcodes && data.scannedBarcodes.length > 0) {
        const boxes = await tx.boxDetail.findMany({
          where: { 
            barcode: { in: data.scannedBarcodes },
            status: 'expected'
          }
        });
        for (const box of boxes) {
          const matchingBatch = stockBatches.find(sb => sb.productId === box.productId);
          await tx.boxDetail.update({
            where: { id: box.id },
            data: {
              status: 'inwarded',
              inwardInvoiceId: invoice.id,
              stockBatchId: matchingBatch ? matchingBatch.id : null
            }
          });
        }
      } else if (data.purchaseOrderId) {
        const poId = parseInt(data.purchaseOrderId);
        const expectedBoxes = await tx.boxDetail.findMany({
          where: { purchaseOrderId: poId, status: 'expected' }
        });
        for (const box of expectedBoxes) {
          const matchingBatch = stockBatches.find(sb => sb.productId === box.productId);
          await tx.boxDetail.update({
            where: { id: box.id },
            data: {
              status: 'inwarded',
              inwardInvoiceId: invoice.id,
              stockBatchId: matchingBatch ? matchingBatch.id : null
            }
          });
        }
      } else {
        await BarcodeService.generateInwardedBoxesForInvoice(invoice.id, tx);
      }

      await BarcodeService.updateBoxDetailsFromInwardItems(invoice.id, tx);

      return await tx.inwardInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          vendor: true,
          location: true,
          items: {
            where: { parentItemId: null },
            include: {
              product: {
                include: {
                  category: true,
                },
              },
              subItems: {
                include: {
                  product: {
                    include: {
                      category: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    });
  }

  static async update(id, data) {
    return await prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.inwardInvoice.findUnique({
        where: { id: parseInt(id) },
        include: { items: true },
      });

      if (!existingInvoice) throw new Error('Invoice not found');

      // Identify which products have sold stock from this invoice's batches
      const existingBatches = await tx.stockBatch.findMany({
        where: { inwardInvoiceId: parseInt(id) },
      });

      const soldOutwardItems = await tx.outwardItem.findMany({
        where: { stockBatchId: { in: existingBatches.map(b => b.id) } },
        select: { stockBatchId: true },
      });

      const soldBatchIds = new Set(soldOutwardItems.map(i => i.stockBatchId));
      const soldProductIds = new Set(
        existingBatches.filter(b => soldBatchIds.has(b.id)).map(b => b.productId)
      );

      const soldItemsCost = existingInvoice.items
        .filter(item => soldProductIds.has(item.productId))
        .reduce((sum, item) => sum + item.totalCost, 0);

      // Delete only unsold batches
      const unsoldBatchIds = existingBatches.filter(b => !soldBatchIds.has(b.id)).map(b => b.id);
      if (unsoldBatchIds.length > 0) {
        await tx.stockBatch.deleteMany({ where: { id: { in: unsoldBatchIds } } });
      }

      // Delete inward items and stock movements for unsold products only
      const unsoldInwardItemIds = existingInvoice.items
        .filter(item => !soldProductIds.has(item.productId))
        .map(item => item.id);
      if (unsoldInwardItemIds.length > 0) {
        await tx.inwardItem.deleteMany({ where: { id: { in: unsoldInwardItemIds } } });
      }

      const unsoldProductIds = existingInvoice.items
        .filter(item => !soldProductIds.has(item.productId))
        .map(item => item.productId);
      if (unsoldProductIds.length > 0) {
        await tx.stockMovement.deleteMany({
          where: { referenceId: parseInt(id), type: 'inward', productId: { in: unsoldProductIds } },
        });
      }

      // Helper function to round a number to 2 decimal places
      const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

      // Only process/recreate items for unsold products
      const itemsToProcess = data.items.filter(item => !soldProductIds.has(parseInt(item.productId)));

      // 1. Calculate base quantities and costs (without expense) for all parent items and their sub-items
      const processedItems = await Promise.all(
        itemsToProcess.map(async (parentInput) => {
          const product = await tx.product.findUnique({
            where: { id: parseInt(parentInput.productId) },
            include: { category: true },
          });
          if (!product) throw new Error(`Product not found: ${parentInput.productId}`);
          const gstRate = product.category?.gstRate || 0;

          const calculateItemRatesAndCost = (qtyBoxes, packPerBox, packPerPiece, rateInput, unitInput) => {
            const totalPacks = qtyBoxes * packPerBox;
            const totalPcs = totalPacks * packPerPiece;
            const unit = unitInput || 'box';
            let ratePerBox, ratePerPack, ratePerPcs, baseAmount;

            if (unit === 'box') {
              ratePerBox = rateInput;
              ratePerPack = ratePerBox / packPerBox;
              ratePerPcs = ratePerPack / packPerPiece;
              baseAmount = qtyBoxes * ratePerBox;
            } else if (unit === 'pack') {
              ratePerPack = rateInput;
              ratePerBox = ratePerPack * packPerBox;
              ratePerPcs = ratePerPack / packPerPiece;
              baseAmount = totalPacks * ratePerPack;
            } else {
              ratePerPcs = rateInput;
              ratePerPack = ratePerPcs * packPerPiece;
              ratePerBox = ratePerPack * packPerBox;
              baseAmount = totalPcs * ratePerPcs;
            }
            const gstAmount = (baseAmount * gstRate) / 100;
            const totalCost = baseAmount + gstAmount;

            return {
              totalPacks,
              totalPcs,
              ratePerBox,
              ratePerPack,
              ratePerPcs,
              gstAmount,
              baseAmount,
              totalCost
            };
          };

          const parentOriginal = calculateItemRatesAndCost(
            parentInput.boxes,
            parentInput.packPerBox,
            parentInput.packPerPiece,
            parentInput.ratePerBox,
            parentInput.unit
          );

          const subItemsProcessed = [];
          let sumSubBoxes = 0;
          let sumSubPcs = 0;

          if (parentInput.subItems && parentInput.subItems.length > 0) {
            for (const subItem of parentInput.subItems) {
              const subProcessed = calculateItemRatesAndCost(
                subItem.boxes,
                subItem.packPerBox,
                subItem.packPerPiece,
                subItem.ratePerBox,
                subItem.unit
              );
              subItemsProcessed.push({
                ...subItem,
                ...subProcessed
              });
              sumSubBoxes += subItem.boxes;
              sumSubPcs += subProcessed.totalPcs;
            }
          }

          const remainderBoxes = parentInput.boxes;
          const remainderPcs = parentOriginal.totalPcs;

          const parentRemainder = calculateItemRatesAndCost(
            remainderBoxes,
            parentInput.packPerBox,
            parentInput.packPerPiece,
            parentInput.ratePerBox,
            parentInput.unit
          );

          return {
            parentInput,
            parentOriginal,
            parentRemainder,
            remainderBoxes,
            remainderPcs,
            subItemsProcessed
          };
        })
      );

      // 2. Calculate the total actual pcs of unsold items and sold items to allocate expense proportionally
      let unsoldActualPcs = 0;
      for (const p of processedItems) {
        if (p.parentRemainder) {
          unsoldActualPcs += p.parentRemainder.totalPcs;
        }
        for (const sub of p.subItemsProcessed) {
          unsoldActualPcs += sub.totalPcs;
        }
      }

      const soldItemsPcs = existingInvoice.items
        .filter(item => soldProductIds.has(item.productId))
        .reduce((sum, item) => sum + item.totalPcs, 0);

      const totalInvoiceActualPcs = unsoldActualPcs + soldItemsPcs;

      const expense = data.expense || 0;
      const expenseSharePerPc = totalInvoiceActualPcs > 0 ? expense / totalInvoiceActualPcs : 0;

      // 3. Update inwardInvoice base fields
      const invoice = await tx.inwardInvoice.update({
        where: { id: parseInt(id) },
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          vendorId: parseInt(data.vendorId),
          locationId: parseInt(data.locationId),
          expense,
          totalCost: 0, // Temporary totalCost
        },
      });

      // 4. Create new inwardItems, stockBatches, and stockMovements for unsold products
      let unsoldTotalCost = 0;

      for (const p of processedItems) {
        let parentItemTotalCost = 0;
        let parentRemainderPcs = 0;
        let parentRemainderBoxes = 0;
        let parentRemainderPacks = 0;
        let parentRemainderGst = 0;

        if (p.parentRemainder) {
          parentRemainderBoxes = p.remainderBoxes;
          parentRemainderPacks = p.parentRemainder.totalPacks;
          parentRemainderPcs = p.parentRemainder.totalPcs;
          parentRemainderGst = round2(p.parentRemainder.gstAmount);
          const share = parentRemainderPcs * expenseSharePerPc;
          parentItemTotalCost = round2(p.parentRemainder.totalCost + share);
        }

        const createdParentItem = await tx.inwardItem.create({
          data: {
            inwardInvoiceId: invoice.id,
            productId: parseInt(p.parentInput.productId),
            boxes: parentRemainderBoxes,
            packPerBox: p.parentInput.packPerBox,
            packPerPiece: p.parentInput.packPerPiece,
            totalPacks: parentRemainderPacks,
            totalPcs: parentRemainderPcs,
            unit: p.parentInput.unit || 'box',
            ratePerBox: round2(p.parentRemainder ? p.parentRemainder.ratePerBox : p.parentOriginal.ratePerBox),
            ratePerPack: round2(p.parentRemainder ? p.parentRemainder.ratePerPack : p.parentOriginal.ratePerPack),
            ratePerPcs: round2(p.parentRemainder ? p.parentRemainder.ratePerPcs : p.parentOriginal.ratePerPcs),
            gstAmount: parentRemainderGst,
            totalCost: parentItemTotalCost,
            batchCode: p.parentInput.batchCode || null,
            mfgDate: p.parentInput.mfgDate ? new Date(p.parentInput.mfgDate) : null,
            color: p.parentInput.color || null,
            brand: p.parentInput.brand || null,
          },
        });

        unsoldTotalCost += parentItemTotalCost;

        if (parentRemainderPcs > 0) {
          await InventoryService.createStockBatch(createdParentItem, invoice);
          await tx.stockMovement.create({
            data: {
              type: 'inward',
              referenceId: invoice.id,
              productId: parseInt(p.parentInput.productId),
              locationId: parseInt(data.locationId),
              quantity: parentRemainderPcs,
              movementDate: new Date(data.date),
            },
          });
        }

        for (const sub of p.subItemsProcessed) {
          const share = sub.totalPcs * expenseSharePerPc;
          const subTotalCostWithExpense = round2(sub.totalCost + share);

          const createdSubItem = await tx.inwardItem.create({
            data: {
              inwardInvoiceId: invoice.id,
              productId: parseInt(p.parentInput.productId),
              parentItemId: createdParentItem.id,
              boxes: sub.boxes,
              packPerBox: sub.packPerBox,
              packPerPiece: sub.packPerPiece,
              totalPacks: sub.totalPacks,
              totalPcs: sub.totalPcs,
              unit: sub.unit,
              ratePerBox: round2(sub.ratePerBox),
              ratePerPack: round2(sub.ratePerPack),
              ratePerPcs: round2(sub.ratePerPcs),
              gstAmount: round2(sub.gstAmount),
              totalCost: subTotalCostWithExpense,
              batchCode: sub.batchCode || null,
              mfgDate: sub.mfgDate ? new Date(sub.mfgDate) : null,
              color: sub.color || null,
              brand: sub.brand || null,
            },
          });

          unsoldTotalCost += subTotalCostWithExpense;

          await InventoryService.createStockBatch(createdSubItem, invoice);
          await tx.stockMovement.create({
            data: {
              type: 'inward',
              referenceId: invoice.id,
              productId: parseInt(p.parentInput.productId),
              locationId: parseInt(data.locationId),
              quantity: sub.totalPcs,
              movementDate: new Date(data.date),
            },
          });
        }
      }

      await tx.inwardInvoice.update({
        where: { id: invoice.id },
        data: { totalCost: round2(unsoldTotalCost + soldItemsCost) },
      });

      // Just update existing boxes with new fields - don't delete them!
      const { BarcodeService } = require('./barcodeService');
      await BarcodeService.updateBoxDetailsFromInwardItems(invoice.id, tx);

      return await tx.inwardInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          vendor: true,
          location: true,
          items: {
            where: { parentItemId: null },
            include: {
              product: { include: { category: true } },
              subItems: { include: { product: { include: { category: true } } } },
            },
          },
        },
      });
    }, { timeout: 10000 });
  }

  static async delete(id) {
    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.inwardInvoice.findUnique({
        where: { id: parseInt(id) },
        include: { items: true },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      for (const item of invoice.items) {
        const stockBatches = await tx.stockBatch.findMany({
          where: {
            productId: item.productId,
            vendorId: invoice.vendorId,
            locationId: invoice.locationId,
            inwardDate: invoice.date,
          },
        });

        for (const batch of stockBatches) {
          const soldQuantity = batch.totalPcs - batch.remainingPcs;
          
          if (soldQuantity > 0) {
            throw new Error(`Cannot delete invoice. Stock from this batch has been sold.`);
          }
        }
      }

      await tx.stockBatch.deleteMany({
        where: {
          productId: { in: invoice.items.map(item => item.productId) },
          vendorId: invoice.vendorId,
          locationId: invoice.locationId,
          inwardDate: invoice.date,
        },
      });

      await tx.stockMovement.deleteMany({
        where: {
          referenceId: parseInt(id),
          type: 'inward',
        },
      });

      await tx.inwardInvoice.delete({
        where: { id: parseInt(id) },
      });

      return { message: 'Invoice deleted successfully' };
    });
  }
}

module.exports = { InwardService };
