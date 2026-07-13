const { PrismaClient } = require('@prisma/client');
const { sendResponse, sendError } = require('../utils/helpers');
const prisma = new PrismaClient();

const transferStock = async (req, res) => {
  try {
    const stockBatchId = parseInt(req.body.stockBatchId);
    const toLocationId = parseInt(req.body.toLocationId);
    const boxes = parseInt(req.body.boxes) || 0;
    const packs = parseInt(req.body.packs) || 0;
    const pieces = parseInt(req.body.pieces) || 0;
    const remarks = req.body.remarks;

    if (!stockBatchId || isNaN(stockBatchId)) {
      return sendError(res, 400, 'Valid stock batch ID is required');
    }

    if (!toLocationId || isNaN(toLocationId)) {
      return sendError(res, 400, 'Valid destination location is required');
    }

    const stockBatch = await prisma.stockBatch.findUnique({
      where: { id: stockBatchId },
      include: { product: true, location: true, vendor: true },
    });

    if (!stockBatch) {
      return sendError(res, 404, 'Stock batch not found');
    }

    if (stockBatch.locationId === toLocationId) {
      return sendError(res, 400, 'Cannot transfer to same location');
    }

    const totalPcsToTransfer =
      boxes * stockBatch.packPerBox * stockBatch.packPerPiece +
      packs * stockBatch.packPerPiece +
      pieces;

    // Bug 3 Fix: zero quantity check
    if (totalPcsToTransfer <= 0) {
      return sendError(res, 400, 'Transfer quantity must be greater than 0');
    }

    if (totalPcsToTransfer > stockBatch.remainingPcs) {
      return sendError(res, 400, 'Insufficient stock');
    }

    const transferNo = `TRF-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      const newSourcePcs = Math.max(0, stockBatch.remainingPcs - totalPcsToTransfer);
      const newSourcePacks = Math.floor(newSourcePcs / stockBatch.packPerPiece);
      const newSourceBoxes = Math.floor(newSourcePacks / stockBatch.packPerBox);

      // Deduct from source batch
      await tx.stockBatch.update({
        where: { id: stockBatch.id },
        data: {
          remainingBoxes: newSourceBoxes,
          remainingPacks: newSourcePacks,
          remainingPcs: newSourcePcs,
        },
      });

      // Calculate dest packs/boxes from totalPcsToTransfer
      const destPacks = Math.floor(totalPcsToTransfer / stockBatch.packPerPiece);
      const destBoxes = Math.floor(destPacks / stockBatch.packPerBox);

      // Create or update batch at destination (include invoice & batch tracking)
      const existingBatch = await tx.stockBatch.findFirst({
        where: {
          productId: stockBatch.productId,
          vendorId: stockBatch.vendorId,
          locationId: toLocationId,
          inwardDate: stockBatch.inwardDate,
          costPerBox: stockBatch.costPerBox,
          inwardInvoiceId: stockBatch.inwardInvoiceId,
          batchCode: stockBatch.batchCode,
        },
      });

      if (existingBatch) {
        const newDestPcs = existingBatch.remainingPcs + totalPcsToTransfer;
        const newDestPacks = Math.floor(newDestPcs / stockBatch.packPerPiece);
        const newDestBoxes = Math.floor(newDestPacks / stockBatch.packPerBox);

        await tx.stockBatch.update({
          where: { id: existingBatch.id },
          data: {
            remainingBoxes: newDestBoxes,
            remainingPacks: newDestPacks,
            remainingPcs: newDestPcs,
            boxes: existingBatch.boxes + destBoxes,
            totalPacks: existingBatch.totalPacks + destPacks,
            totalPcs: existingBatch.totalPcs + totalPcsToTransfer,
          },
        });
      } else {
        await tx.stockBatch.create({
          data: {
            productId: stockBatch.productId,
            vendorId: stockBatch.vendorId,
            locationId: toLocationId,
            inwardInvoiceId: stockBatch.inwardInvoiceId,
            batchCode: stockBatch.batchCode,
            mfgDate: stockBatch.mfgDate,
            inwardDate: stockBatch.inwardDate,
            boxes: destBoxes,
            packPerBox: stockBatch.packPerBox,
            packPerPiece: stockBatch.packPerPiece,
            totalPacks: destPacks,
            totalPcs: totalPcsToTransfer,
            remainingBoxes: destBoxes,
            remainingPacks: destPacks,
            remainingPcs: totalPcsToTransfer,
            costPerBox: stockBatch.costPerBox,
            costPerPack: stockBatch.costPerPack,
            costPerPcs: stockBatch.costPerPcs,
          },
        });
      }

      // Record transfer
      await tx.stockTransfer.create({
        data: {
          transferNo,
          stockBatchId: stockBatch.id,
          fromLocationId: stockBatch.locationId,
          toLocationId: toLocationId,
          boxes,
          packs,
          pieces,
          transferDate: new Date(),
          remarks,
        },
      });
    });

    return sendResponse(res, 200, true, { transferNo }, 'Stock transferred successfully');
  } catch (error) {
    console.error('Transfer stock error:', error);
    return sendError(res, 500, 'Failed to transfer stock');
  }
};

const getTransferHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockTransfer.count(),
    ]);

    // Fetch batch details manually
    const batchIds = [...new Set(transfers.map((t) => t.stockBatchId).filter(Boolean))];
    const batches = await prisma.stockBatch.findMany({
      where: { id: { in: batchIds } },
      include: { product: true, vendor: true },
    });

    // Fetch Inward Invoices for batches manually
    const inwardInvoiceIds = batches.map((b) => b.inwardInvoiceId).filter(Boolean);
    const invoices = await prisma.inwardInvoice.findMany({
      where: { id: { in: inwardInvoiceIds } },
      select: { id: true, invoiceNo: true },
    });
    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv.invoiceNo]));

    const populatedBatches = batches.map((b) => ({
      ...b,
      inwardInvoice: b.inwardInvoiceId ? { invoiceNo: invoiceMap.get(b.inwardInvoiceId) || 'N/A' } : null,
    }));
    const batchMap = new Map(populatedBatches.map((b) => [b.id, b]));

    // Fetch location details manually
    const locationIds = [
      ...new Set([
        ...transfers.map((t) => t.fromLocationId),
        ...transfers.map((t) => t.toLocationId),
      ].filter(Boolean)),
    ];
    const locations = await prisma.location.findMany({
      where: { id: { in: locationIds } },
    });
    const locationMap = new Map(locations.map((l) => [l.id, l]));

    // Merge manually
    const populatedTransfers = transfers.map((t) => ({
      ...t,
      stockBatch: batchMap.get(t.stockBatchId) || null,
      fromLocation: locationMap.get(t.fromLocationId) || null,
      toLocation: locationMap.get(t.toLocationId) || null,
    }));

    return sendResponse(
      res,
      200,
      true,
      { transfers: populatedTransfers, total },
      'Transfer history retrieved successfully',
      { page: parseInt(page), limit: parseInt(limit), total }
    );
  } catch (error) {
    console.error('Get transfer history error:', error);
    return sendError(res, 500, 'Failed to fetch transfer history');
  }
};

module.exports = { transferStock, getTransferHistory };
