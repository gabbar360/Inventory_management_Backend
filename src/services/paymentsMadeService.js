const { calculatePagination } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class PaymentsMadeService {
  static async getAll(page, limit, search, sortBy, sortOrder, vendorId, paymentMode, startDate, endDate) {
    const where = {};

    if (search) {
      where.OR = [
        { paymentNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { vendor: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (vendorId) {
      where.vendorId = parseInt(vendorId);
    }

    if (paymentMode && paymentMode !== 'All' && paymentMode !== 'PaymentMode.All') {
      where.paymentMode = { equals: paymentMode, mode: 'insensitive' };
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

    const total = await prisma.paymentMade.count({ where });
    const { offset } = calculatePagination(page, limit, total);
    const orderBy = sortBy && ['paymentNumber', 'date', 'amount', 'createdAt'].includes(sortBy)
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { date: 'desc' };

    const payments = await prisma.paymentMade.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        vendor: {
          select: { id: true, name: true, code: true }
        },
        invoices: {
          include: {
            invoice: {
              select: { invoiceNo: true, totalCost: true }
            }
          }
        }
      }
    });

    const aggregates = await prisma.paymentMade.aggregate({
      where,
      _sum: {
        amount: true,
        unusedAmount: true
      }
    });

    return {
      payments,
      pagination: calculatePagination(page, limit, total),
      summary: {
        totalAmount: aggregates._sum.amount || 0,
        totalUnusedAmount: aggregates._sum.unusedAmount || 0
      }
    };
  }

  static async getById(id) {
    const payment = await prisma.paymentMade.findUnique({
      where: { id: parseInt(id) },
      include: {
        vendor: true,
        invoices: {
          include: {
            invoice: {
              select: { id: true, invoiceNo: true, totalCost: true, amountPaid: true, date: true }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new Error('Payment made record not found');
    }

    return payment;
  }

  static async create(data) {
    return await prisma.$transaction(async (tx) => {
      // Check if payment number already exists
      const existing = await tx.paymentMade.findFirst({
        where: { paymentNumber: data.paymentNumber }
      });
      if (existing) {
        throw new Error('Payment number already exists');
      }

      const amount = parseFloat(data.amount);
      const appliedInvoices = data.invoices || [];
      const totalApplied = appliedInvoices.reduce((sum, inv) => sum + parseFloat(inv.amountApplied), 0);
      const unusedAmount = Math.max(0, amount - totalApplied);

      const payment = await tx.paymentMade.create({
        data: {
          paymentNumber: data.paymentNumber,
          vendorId: parseInt(data.vendorId),
          amount,
          date: new Date(data.date),
          paymentMode: data.paymentMode,
          referenceNumber: data.referenceNumber || null,
          paidThrough: data.paidThrough,
          bankCharges: parseFloat(data.bankCharges || 0),
          notes: data.notes || null,
          transactionType: data.transactionType || 'bill_payment',
          unusedAmount
        }
      });

      for (const inv of appliedInvoices) {
        const invoiceId = parseInt(inv.invoiceId);
        const amountApplied = parseFloat(inv.amountApplied);

        if (amountApplied > 0) {
          await tx.paymentMadeInvoice.create({
            data: {
              paymentMadeId: payment.id,
              invoiceId,
              amountApplied
            }
          });

          // Update InwardInvoice amountPaid
          const invoice = await tx.inwardInvoice.findUnique({ where: { id: invoiceId } });
          if (!invoice) throw new Error(`Inward invoice not found: ${invoiceId}`);
          
          await tx.inwardInvoice.update({
            where: { id: invoiceId },
            data: {
              amountPaid: invoice.amountPaid + amountApplied
            }
          });
        }
      }

      return await tx.paymentMade.findUnique({
        where: { id: payment.id },
        include: { vendor: true, invoices: true }
      });
    }, { timeout: 15000 });
  }

  static async update(id, data) {
    return await prisma.$transaction(async (tx) => {
      const paymentId = parseInt(id);
      const existingPayment = await tx.paymentMade.findUnique({
        where: { id: paymentId },
        include: { invoices: true }
      });

      if (!existingPayment) {
        throw new Error('Payment made record not found');
      }

      // Check if duplicate exists
      const duplicate = await tx.paymentMade.findFirst({
        where: { paymentNumber: data.paymentNumber, id: { not: paymentId } }
      });
      if (duplicate) {
        throw new Error('Payment number already exists');
      }

      // Restore old applied invoices
      for (const oldInv of existingPayment.invoices) {
        const invoice = await tx.inwardInvoice.findUnique({ where: { id: oldInv.invoiceId } });
        if (invoice) {
          await tx.inwardInvoice.update({
            where: { id: oldInv.invoiceId },
            data: {
              amountPaid: Math.max(0, invoice.amountPaid - oldInv.amountApplied)
            }
          });
        }
      }

      // Delete old relations
      await tx.paymentMadeInvoice.deleteMany({
        where: { paymentMadeId: paymentId }
      });

      const amount = parseFloat(data.amount);
      const appliedInvoices = data.invoices || [];
      const totalApplied = appliedInvoices.reduce((sum, inv) => sum + parseFloat(inv.amountApplied), 0);
      const unusedAmount = Math.max(0, amount - totalApplied);

      const updatedPayment = await tx.paymentMade.update({
        where: { id: paymentId },
        data: {
          paymentNumber: data.paymentNumber,
          vendorId: parseInt(data.vendorId),
          amount,
          date: new Date(data.date),
          paymentMode: data.paymentMode,
          referenceNumber: data.referenceNumber || null,
          paidThrough: data.paidThrough,
          bankCharges: parseFloat(data.bankCharges || 0),
          notes: data.notes || null,
          transactionType: data.transactionType || 'bill_payment',
          unusedAmount
        }
      });

      for (const inv of appliedInvoices) {
        const invoiceId = parseInt(inv.invoiceId);
        const amountApplied = parseFloat(inv.amountApplied);

        if (amountApplied > 0) {
          await tx.paymentMadeInvoice.create({
            data: {
              paymentMadeId: paymentId,
              invoiceId,
              amountApplied
            }
          });

          // Update InwardInvoice amountPaid
          const invoice = await tx.inwardInvoice.findUnique({ where: { id: invoiceId } });
          if (!invoice) throw new Error(`Inward invoice not found: ${invoiceId}`);

          await tx.inwardInvoice.update({
            where: { id: invoiceId },
            data: {
              amountPaid: invoice.amountPaid + amountApplied
            }
          });
        }
      }

      return await tx.paymentMade.findUnique({
        where: { id: paymentId },
        include: { vendor: true, invoices: true }
      });
    }, { timeout: 15000 });
  }

  static async delete(id) {
    return await prisma.$transaction(async (tx) => {
      const paymentId = parseInt(id);
      const payment = await tx.paymentMade.findUnique({
        where: { id: paymentId },
        include: { invoices: true }
      });

      if (!payment) {
        throw new Error('Payment made record not found');
      }

      // Restore old applied invoices
      for (const oldInv of payment.invoices) {
        const invoice = await tx.inwardInvoice.findUnique({ where: { id: oldInv.invoiceId } });
        if (invoice) {
          await tx.inwardInvoice.update({
            where: { id: oldInv.invoiceId },
            data: {
              amountPaid: Math.max(0, invoice.amountPaid - oldInv.amountApplied)
            }
          });
        }
      }

      // Delete the payment made
      await tx.paymentMade.delete({
        where: { id: paymentId }
      });

      return { message: 'Payment made deleted successfully' };
    }, { timeout: 15000 });
  }
}

module.exports = { PaymentsMadeService };
