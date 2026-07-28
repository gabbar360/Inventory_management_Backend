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

            await InventoryService.createStockBatch(createdSubItem, invoice, tx);
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
        items.map((item) => InventoryService.createStockBatch(item, invoice, tx))
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
      const invoiceId = parseInt(id);
      const invoice = await tx.inwardInvoice.findUnique({
        where: { id: invoiceId },
        include: { items: true },
      });

      if (!invoice) throw new Error('Invoice not found');

      // Fetch all existing InwardItems (only main parent items)
      const existingItems = await tx.inwardItem.findMany({
        where: { inwardInvoiceId: invoiceId, parentItemId: null },
      });

      // Fetch all existing StockBatches for this invoice
      const existingBatches = await tx.stockBatch.findMany({
        where: { inwardInvoiceId: invoiceId },
      });

      // 1. Identify deleted items by itemId (if provided) or productId fallback
      const newItemIds = new Set(
        data.items.filter(item => item.id).map(item => parseInt(item.id))
      );
      const newProductIds = new Set(data.items.map(item => parseInt(item.productId)));

      // If any item has id, use id-based matching; otherwise fall back to productId
      const useIdMatching = data.items.some(item => item.id);

      const deletedItems = useIdMatching
        ? existingItems.filter(item => !newItemIds.has(item.id))
        : existingItems.filter(item => !newProductIds.has(item.productId));

      for (const item of deletedItems) {
        const batch = existingBatches.find(eb => eb.productId === item.productId && eb.inwardInvoiceId === invoiceId);
        if (batch) {
          const soldQuantity = batch.totalPcs - batch.remainingPcs;
          if (soldQuantity > 0) {
            throw new Error(`Cannot delete product from invoice because some stock has been sold.`);
          }
          await tx.stockBatch.delete({ where: { id: batch.id } });
        }
        await tx.stockMovement.deleteMany({
          where: { referenceId: invoiceId, type: 'inward', productId: item.productId },
        });
        await tx.inwardItem.deleteMany({ where: { parentItemId: item.id } });
        await tx.inwardItem.delete({ where: { id: item.id } });
      }

      // Calculate totalInvoicePcs to distribute expense proportionally
      const totalInvoicePcs = data.items.reduce((sum, it) => {
        const mainPcs = (it.boxes || 0) * (it.packPerBox || 1) * (it.packPerPiece || 1);
        const subPcs = it.subItems?.reduce((subSum, sub) => subSum + ((sub.boxes || 0) * (sub.packPerBox || 1) * (sub.packPerPiece || 1)), 0) || 0;
        return sum + mainPcs + subPcs;
      }, 0);

      const expense = data.expense || 0;
      let totalInvoiceCost = 0;
      let subItemsTotalCost = 0;

      // 2. Loop through each item in data.items to update or create
      for (const item of data.items) {
        const productId = parseInt(item.productId);
        const existingItem = item.id
          ? existingItems.find(ei => ei.id === parseInt(item.id))
          : existingItems.find(ei => ei.productId === productId);
        const existingBatch = existingItem
          ? existingBatches.find(eb => eb.productId === existingItem.productId && eb.inwardInvoiceId === invoiceId)
          : null;

        const totalPacks = item.boxes * item.packPerBox;
        const totalPcs = totalPacks * item.packPerPiece;

        let ratePerBox, ratePerPack, ratePerPcs, baseAmount;
        const unit = item.unit || 'box';

        const product = await tx.product.findUnique({
          where: { id: productId },
          include: { category: true },
        });
        if (!product) throw new Error(`Product not found: ${item.productId}`);

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
        const expenseShare = totalInvoicePcs > 0 ? (totalPcs / totalInvoicePcs) * expense : 0;
        const totalCost = baseAmount + gstAmount + expenseShare;
        totalInvoiceCost += totalCost;

        let currentParentItemId;

        if (existingItem && existingBatch) {
          currentParentItemId = existingItem.id;

          // Calculate consumption details
          const soldBoxes = Math.max(0, existingBatch.boxes - existingBatch.remainingBoxes);
          const soldPacks = Math.max(0, existingBatch.totalPacks - existingBatch.remainingPacks);
          const soldPcs = Math.max(0, existingBatch.totalPcs - existingBatch.remainingPcs);

          const remainingBoxes = Math.max(0, item.boxes - soldBoxes);
          const remainingPacks = Math.max(0, totalPacks - soldPacks);
          const remainingPcs = Math.max(0, totalPcs - soldPcs);

          // Update main inwardItem
          await tx.inwardItem.update({
            where: { id: existingItem.id },
            data: {
              boxes: item.boxes,
              packPerBox: item.packPerBox,
              packPerPiece: item.packPerPiece,
              totalPacks,
              totalPcs,
              unit,
              ratePerBox,
              ratePerPack,
              ratePerPcs,
              gstAmount,
              totalCost,
              batchCode: item.batchCode || null,
              mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
              color: item.color || null,
              brand: item.brand || null,
            }
          });

          // Update main stockBatch
          await tx.stockBatch.update({
            where: { id: existingBatch.id },
            data: {
              boxes: item.boxes,
              packPerBox: item.packPerBox,
              packPerPiece: item.packPerPiece,
              totalPacks,
              totalPcs,
              remainingBoxes,
              remainingPacks,
              remainingPcs,
              costPerBox: totalCost / (item.boxes || 1),
              costPerPack: totalCost / (totalPacks || 1),
              costPerPcs: totalCost / (totalPcs || 1),
              batchCode: item.batchCode || null,
              mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
            }
          });

          // Re-create stock movement: delete and recreate main movement
          await tx.stockMovement.deleteMany({
            where: { referenceId: invoiceId, type: 'inward', productId }
          });

          await tx.stockMovement.create({
            data: {
              type: 'inward',
              referenceId: invoiceId,
              productId,
              locationId: parseInt(data.locationId),
              quantity: totalPcs,
              movementDate: new Date(data.date),
            }
          });

        } else {
          // Create new main inwardItem
          const newInwardItem = await tx.inwardItem.create({
            data: {
              inwardInvoiceId: invoiceId,
              productId,
              boxes: item.boxes,
              packPerBox: item.packPerBox,
              packPerPiece: item.packPerPiece,
              totalPacks,
              totalPcs,
              unit,
              ratePerBox,
              ratePerPack,
              ratePerPcs,
              gstAmount,
              totalCost,
              batchCode: item.batchCode || null,
              mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
              color: item.color || null,
              brand: item.brand || null,
            }
          });

          currentParentItemId = newInwardItem.id;

          // Create new main stockBatch
          const newBatch = await InventoryService.createStockBatch(newInwardItem, invoice, tx);

          // Create new main stockMovement
          await tx.stockMovement.create({
            data: {
              type: 'inward',
              referenceId: invoiceId,
              productId,
              locationId: parseInt(data.locationId),
              quantity: totalPcs,
              movementDate: new Date(data.date),
            }
          });
        }

        // Handle subItems (if any)
        if (item.subItems && item.subItems.length > 0) {
          // Delete old sub-items and their associated batches
          await tx.stockBatch.deleteMany({
            where: {
              inwardInvoiceId: invoiceId,
              productId,
              NOT: { id: existingBatch ? existingBatch.id : -1 }
            }
          });

          await tx.inwardItem.deleteMany({
            where: { parentItemId: currentParentItemId }
          });

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

            const subGstAmount = (subBaseAmount * product.category.gstRate) / 100;
            const subTotalCost = subBaseAmount + subGstAmount;
            subItemsTotalCost += subTotalCost;

            const createdSubItem = await tx.inwardItem.create({
              data: {
                inwardInvoiceId: invoiceId,
                productId,
                parentItemId: currentParentItemId,
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

            await InventoryService.createStockBatch(createdSubItem, invoice, tx);
            await tx.stockMovement.create({
              data: {
                type: 'inward',
                referenceId: invoiceId,
                productId,
                locationId: parseInt(data.locationId),
                quantity: subTotalPcs,
                movementDate: new Date(data.date),
              },
            });
          }
        }
      }

      // Update parent invoice header details
      await tx.inwardInvoice.update({
        where: { id: invoiceId },
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          vendorId: parseInt(data.vendorId),
          locationId: parseInt(data.locationId),
          expense,
          totalCost: totalInvoiceCost + subItemsTotalCost,
        },
      });

      // Update BoxDetail records with new metadata
      const { BarcodeService } = require('./barcodeService');
      await BarcodeService.updateBoxDetailsFromInwardItems(invoiceId, tx);

      return await tx.inwardInvoice.findUnique({
        where: { id: invoiceId },
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
    }, { timeout: 15000 });
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
