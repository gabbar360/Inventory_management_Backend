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
      const processedItems = await Promise.all(
        data.items.map(async (item) => {
          const product = await tx.product.findUnique({
            where: { id: parseInt(item.productId) },
            include: { category: true },
          });

          if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
          }

          const totalPacks = item.boxes * item.packPerBox;
          const totalPcs = totalPacks * item.packPerPiece;
          
          let ratePerBox, ratePerPack, ratePerPcs, baseAmount;
          const unit = item.unit || 'box';
          
          if (unit === 'box') {
            ratePerBox = item.ratePerBox;
            ratePerPack = ratePerBox / item.packPerBox;
            ratePerPcs = ratePerPack / item.packPerPiece;
            baseAmount = item.boxes * ratePerBox;
          } else if (unit === 'pack') {
            ratePerPack = item.ratePerBox;
            ratePerBox = ratePerPack * item.packPerBox;
            ratePerPcs = ratePerPack / item.packPerPiece;
            baseAmount = totalPacks * ratePerPack;
          } else {
            ratePerPcs = item.ratePerBox;
            ratePerPack = ratePerPcs * item.packPerPiece;
            ratePerBox = ratePerPack * item.packPerBox;
            baseAmount = totalPcs * ratePerPcs;
          }
          
          const gstAmount = (baseAmount * product.category.gstRate) / 100;
          const totalCost = baseAmount + gstAmount;

          return {
            ...item,
            unit,
            totalPacks,
            totalPcs,
            ratePerBox,
            ratePerPack,
            ratePerPcs,
            gstAmount,
            totalCost,
          };
        })
      );

      const totalInvoiceCost = processedItems.reduce((sum, item) => sum + item.totalCost, 0);
      const expense = data.expense || 0;
      const totalInvoicePcs = processedItems.reduce((sum, item) => sum + item.totalPcs, 0);

      // Distribute expense proportionally by pcs across items
      const processedItemsWithExpense = processedItems.map((item) => {
        const expenseShare = totalInvoicePcs > 0 ? (item.totalPcs / totalInvoicePcs) * expense : 0;
        const totalCostWithExpense = item.totalCost + expenseShare;
        return { ...item, totalCost: totalCostWithExpense };
      });

      const invoice = await tx.inwardInvoice.create({
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          vendorId: parseInt(data.vendorId),
          locationId: parseInt(data.locationId),
          expense,
          totalCost: totalInvoiceCost + expense,
        },
      });

      const items = await Promise.all(
        processedItemsWithExpense.map((item) =>
          tx.inwardItem.create({
            data: {
              inwardInvoiceId: invoice.id,
              productId: parseInt(item.productId),
              boxes: item.boxes,
              packPerBox: item.packPerBox,
              packPerPiece: item.packPerPiece,
              totalPacks: item.totalPacks,
              totalPcs: item.totalPcs,
              unit: item.unit,
              ratePerBox: item.ratePerBox,
              ratePerPack: item.ratePerPack,
              ratePerPcs: item.ratePerPcs,
              gstAmount: item.gstAmount,
              totalCost: item.totalCost,
              batchCode: item.batchCode || null,
              mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
              color: item.color || null,
              brand: item.brand || null,
            },
          })
        )
      );

      // Create sub-items and calculate their total
      let subItemsTotalCost = 0;
      
      for (let i = 0; i < processedItems.length; i++) {
        const item = processedItems[i];
        const parentItem = items[i];
        
        if (item.subItems && item.subItems.length > 0) {
          for (const subItem of item.subItems) {
            const subTotalPacks = subItem.boxes * subItem.packPerBox;
            const subTotalPcs = subTotalPacks * subItem.packPerPiece;
            
            let subRatePerBox, subRatePerPack, subRatePerPcs, subBaseAmount;
            const subUnit = subItem.unit || 'box';
            
            if (subUnit === 'box') {
              subRatePerBox = subItem.ratePerBox;
              subRatePerPack = subRatePerBox / subItem.packPerBox;
              subRatePerPcs = subRatePerPack / subItem.packPerPiece;
              subBaseAmount = subItem.boxes * subRatePerBox;
            } else if (subUnit === 'pack') {
              subRatePerPack = subItem.ratePerBox;
              subRatePerBox = subRatePerPack * subItem.packPerBox;
              subRatePerPcs = subRatePerPack / subItem.packPerPiece;
              subBaseAmount = subTotalPacks * subRatePerPack;
            } else {
              subRatePerPcs = subItem.ratePerBox;
              subRatePerPack = subRatePerPcs * subItem.packPerPiece;
              subRatePerBox = subRatePerPack * subItem.packPerBox;
              subBaseAmount = subTotalPcs * subRatePerPcs;
            }
            
            const subProduct = await tx.product.findUnique({
              where: { id: parseInt(item.productId) },
              include: { category: true },
            });
            
            const subGstAmount = (subBaseAmount * subProduct.category.gstRate) / 100;
            const subTotalCost = subBaseAmount + subGstAmount;
            subItemsTotalCost += subTotalCost;

            const createdSubItem = await tx.inwardItem.create({
              data: {
                inwardInvoiceId: invoice.id,
                productId: parseInt(item.productId),
                parentItemId: parentItem.id,
                boxes: subItem.boxes,
                packPerBox: subItem.packPerBox,
                packPerPiece: subItem.packPerPiece,
                totalPacks: subTotalPacks,
                totalPcs: subTotalPcs,
                unit: subUnit,
                ratePerBox: subRatePerBox,
                ratePerPack: subRatePerPack,
                ratePerPcs: subRatePerPcs,
                gstAmount: subGstAmount,
                totalCost: subTotalCost,
                batchCode: subItem.batchCode || null,
                mfgDate: subItem.mfgDate ? new Date(subItem.mfgDate) : null,
                color: subItem.color || null,
                brand: subItem.brand || null,
              },
            });

            await InventoryService.createStockBatch(createdSubItem, invoice);
            await tx.stockMovement.create({
              data: {
                type: 'inward',
                referenceId: invoice.id,
                productId: parseInt(item.productId),
                locationId: parseInt(data.locationId),
                quantity: subTotalPcs,
                movementDate: new Date(data.date),
              },
            });
          }
        }
      }

      // Update invoice total cost with sub-items
      if (subItemsTotalCost > 0) {
        await tx.inwardInvoice.update({
          where: { id: invoice.id },
          data: { totalCost: totalInvoiceCost + expense + subItemsTotalCost },
        });
      }

      await Promise.all(
        items.map((item) => InventoryService.createStockBatch(item, invoice))
      );

      await Promise.all(
        items.map((item) =>
          tx.stockMovement.create({
            data: {
              type: 'inward',
              referenceId: invoice.id,
              productId: parseInt(item.productId),
              locationId: parseInt(data.locationId),
              quantity: item.totalPcs,
              movementDate: new Date(data.date),
            },
          })
        )
      );

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

      // Only process/recreate items for unsold products
      const itemsToProcess = data.items.filter(item => !soldProductIds.has(parseInt(item.productId)));

      const processedItems = await Promise.all(
        itemsToProcess.map(async (item) => {
          const product = await tx.product.findUnique({
            where: { id: parseInt(item.productId) },
            include: { category: true },
          });
          if (!product) throw new Error(`Product not found: ${item.productId}`);

          const totalPacks = item.boxes * item.packPerBox;
          const totalPcs = totalPacks * item.packPerPiece;

          let ratePerBox, ratePerPack, ratePerPcs, baseAmount;
          const unit = item.unit || 'box';

          if (unit === 'box') {
            ratePerBox = item.ratePerBox;
            ratePerPack = ratePerBox / item.packPerBox;
            ratePerPcs = ratePerPack / item.packPerPiece;
            baseAmount = item.boxes * ratePerBox;
          } else if (unit === 'pack') {
            ratePerPack = item.ratePerBox;
            ratePerBox = ratePerPack * item.packPerBox;
            ratePerPcs = ratePerPack / item.packPerPiece;
            baseAmount = totalPacks * ratePerPack;
          } else {
            ratePerPcs = item.ratePerBox;
            ratePerPack = ratePerPcs * item.packPerPiece;
            ratePerBox = ratePerPack * item.packPerBox;
            baseAmount = totalPcs * ratePerPcs;
          }

          const gstAmount = (baseAmount * product.category.gstRate) / 100;
          const totalCost = baseAmount + gstAmount;

          return { ...item, unit, totalPacks, totalPcs, ratePerBox, ratePerPack, ratePerPcs, gstAmount, totalCost };
        })
      );

      const totalInvoiceCost = processedItems.reduce((sum, item) => sum + item.totalCost, 0);
      const expense = data.expense || 0;
      const totalInvoicePcs = processedItems.reduce((sum, item) => sum + item.totalPcs, 0);

      // Distribute expense proportionally by pcs across items
      const processedItemsWithExpense = processedItems.map((item) => {
        const expenseShare = totalInvoicePcs > 0 ? (item.totalPcs / totalInvoicePcs) * expense : 0;
        const totalCostWithExpense = item.totalCost + expenseShare;
        return { ...item, totalCost: totalCostWithExpense };
      });

      const invoice = await tx.inwardInvoice.update({
        where: { id: parseInt(id) },
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          vendorId: parseInt(data.vendorId),
          locationId: parseInt(data.locationId),
          expense,
          totalCost: totalInvoiceCost + expense,
        },
      });

      const items = await Promise.all(
        processedItemsWithExpense.map((item) =>
          tx.inwardItem.create({
            data: {
              inwardInvoiceId: invoice.id,
              productId: parseInt(item.productId),
              boxes: item.boxes,
              packPerBox: item.packPerBox,
              packPerPiece: item.packPerPiece,
              totalPacks: item.totalPacks,
              totalPcs: item.totalPcs,
              unit: item.unit,
              ratePerBox: item.ratePerBox,
              ratePerPack: item.ratePerPack,
              ratePerPcs: item.ratePerPcs,
              gstAmount: item.gstAmount,
              totalCost: item.totalCost,
              batchCode: item.batchCode || null,
              mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
              color: item.color || null,
              brand: item.brand || null,
            },
          })
        )
      );

      let subItemsTotalCost = 0;

      for (let i = 0; i < processedItems.length; i++) {
        const item = processedItems[i];
        const parentItem = items[i];

        if (item.subItems && item.subItems.length > 0) {
          for (const subItem of item.subItems) {
            const subTotalPacks = subItem.boxes * subItem.packPerBox;
            const subTotalPcs = subTotalPacks * subItem.packPerPiece;

            let subRatePerBox, subRatePerPack, subRatePerPcs, subBaseAmount;
            const subUnit = subItem.unit || 'box';

            if (subUnit === 'box') {
              subRatePerBox = subItem.ratePerBox;
              subRatePerPack = subRatePerBox / subItem.packPerBox;
              subRatePerPcs = subRatePerPack / subItem.packPerPiece;
              subBaseAmount = subItem.boxes * subRatePerBox;
            } else if (subUnit === 'pack') {
              subRatePerPack = subItem.ratePerBox;
              subRatePerBox = subRatePerPack * subItem.packPerBox;
              subRatePerPcs = subRatePerPack / subItem.packPerPiece;
              subBaseAmount = subTotalPacks * subRatePerPack;
            } else {
              subRatePerPcs = subItem.ratePerBox;
              subRatePerPack = subRatePerPcs * subItem.packPerPiece;
              subRatePerBox = subRatePerPack * subItem.packPerBox;
              subBaseAmount = subTotalPcs * subRatePerPcs;
            }

            const subProduct = await tx.product.findUnique({
              where: { id: parseInt(item.productId) },
              include: { category: true },
            });

            const subGstAmount = (subBaseAmount * subProduct.category.gstRate) / 100;
            const subTotalCost = subBaseAmount + subGstAmount;
            subItemsTotalCost += subTotalCost;

            const createdSubItem = await tx.inwardItem.create({
              data: {
                inwardInvoiceId: invoice.id,
                productId: parseInt(item.productId),
                parentItemId: parentItem.id,
                boxes: subItem.boxes,
                packPerBox: subItem.packPerBox,
                packPerPiece: subItem.packPerPiece,
                totalPacks: subTotalPacks,
                totalPcs: subTotalPcs,
                unit: subUnit,
                ratePerBox: subRatePerBox,
                ratePerPack: subRatePerPack,
                ratePerPcs: subRatePerPcs,
                gstAmount: subGstAmount,
                totalCost: subTotalCost,
                batchCode: subItem.batchCode || null,
                mfgDate: subItem.mfgDate ? new Date(subItem.mfgDate) : null,
                color: subItem.color || null,
                brand: subItem.brand || null,
              },
            });

            await InventoryService.createStockBatch(createdSubItem, invoice);
            await tx.stockMovement.create({
              data: {
                type: 'inward',
                referenceId: invoice.id,
                productId: parseInt(item.productId),
                locationId: parseInt(data.locationId),
                quantity: subTotalPcs,
                movementDate: new Date(data.date),
              },
            });
          }
        }
      }

      if (subItemsTotalCost > 0) {
        await tx.inwardInvoice.update({
          where: { id: invoice.id },
          data: { totalCost: totalInvoiceCost + expense + subItemsTotalCost },
        });
      }

      for (const item of items) {
        await InventoryService.createStockBatch(item, invoice);
        await tx.stockMovement.create({
          data: {
            type: 'inward',
            referenceId: invoice.id,
            productId: parseInt(item.productId),
            locationId: parseInt(data.locationId),
            quantity: item.totalPcs,
            movementDate: new Date(data.date),
          },
        });
      }

      // Reset/delete old box details for this invoice that are not outwarded
      const existingInvoiceBoxes = await tx.boxDetail.findMany({
        where: { inwardInvoiceId: invoice.id, status: 'inwarded' }
      });
      for (const box of existingInvoiceBoxes) {
        if (box.purchaseOrderId) {
          await tx.boxDetail.update({
            where: { id: box.id },
            data: {
              status: 'expected',
              inwardInvoiceId: null,
              stockBatchId: null
            }
          });
        } else {
          await tx.boxDetail.delete({
            where: { id: box.id }
          });
        }
      }

      // Re-generate or re-link
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