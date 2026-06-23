const { calculatePagination } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class PaymentsMadeService {
  static async getAll(page, limit, search, sortBy, sortOrder, vendorId, paymentMode, startDate, endDate, unusedCreditsOnly) {
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

    if (unusedCreditsOnly === 'true' || unusedCreditsOnly === true) {
      where.unusedAmount = { gt: 0 };
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
    let orderBy;
    if (sortBy === 'vendor' || sortBy === 'vendor.name') {
      orderBy = {
        vendor: {
          name: sortOrder === 'desc' ? 'desc' : 'asc'
        }
      };
    } else if (sortBy && ['paymentNumber', 'date', 'amount', 'unusedAmount', 'createdAt'].includes(sortBy)) {
      orderBy = { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' };
    } else {
      orderBy = { date: 'desc' };
    }

    const payments = await prisma.paymentMade.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        vendor: {
          select: { id: true, name: true, code: true, email: true }
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

    // Aggregate only real cash payments (exclude credit_application which is not actual cash outflow)
    const cashWhere = { ...where, transactionType: { not: 'credit_application' } };
    const aggregates = await prisma.paymentMade.aggregate({
      where: cashWhere,
      _sum: { amount: true, unusedAmount: true }
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

  static async applyCredits(data) {
    return await prisma.$transaction(async (tx) => {
      const { vendorId, allocations, date, notes } = data;
      // allocations: [{ paymentMadeId, invoiceId, amountToApply }]

      const validAllocs = allocations.filter(a => parseFloat(a.amountToApply) > 0);
      if (validAllocs.length === 0) throw new Error('No valid allocations provided');

      const totalAmount = validAllocs.reduce((s, a) => s + parseFloat(a.amountToApply), 0);

      // Generate unique credit application number
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const rand = Math.floor(1000 + Math.random() * 9000);
      const paymentNumber = `CA-${year}${month}-${rand}`;

      // Ensure unique
      const existing = await tx.paymentMade.findFirst({ where: { paymentNumber } });
      if (existing) throw new Error('Please retry — duplicate number generated, try again');

      // Create the new Credit Application PaymentMade record
      const newPayment = await tx.paymentMade.create({
        data: {
          paymentNumber,
          vendorId: parseInt(vendorId),
          amount: totalAmount,
          date: date ? new Date(date) : new Date(),
          paymentMode: 'Credit Adjustment',
          paidThrough: 'Advance Credits',
          bankCharges: 0,
          notes: notes || null,
          transactionType: 'credit_application',
          unusedAmount: 0,
        }
      });

      for (const alloc of validAllocs) {
        const pmId = parseInt(alloc.paymentMadeId);
        const invoiceId = parseInt(alloc.invoiceId);
        const amountToApply = parseFloat(alloc.amountToApply);

        const sourcePayment = await tx.paymentMade.findUnique({ where: { id: pmId } });
        if (!sourcePayment) throw new Error(`Source payment ${pmId} not found`);
        if (sourcePayment.unusedAmount < amountToApply - 0.001) {
          throw new Error(`Insufficient unused credits in payment ${sourcePayment.paymentNumber}`);
        }

        const invoice = await tx.inwardInvoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

        const balanceDue = invoice.totalCost - invoice.amountPaid;
        if (amountToApply > balanceDue + 0.001) {
          throw new Error(`Amount exceeds balance due for invoice ${invoice.invoiceNo}`);
        }

        // Link new payment record to invoice
        await tx.paymentMadeInvoice.create({
          data: { paymentMadeId: newPayment.id, invoiceId, amountApplied: amountToApply }
        });

        // Deduct from source advance payment unusedAmount
        await tx.paymentMade.update({
          where: { id: pmId },
          data: { unusedAmount: sourcePayment.unusedAmount - amountToApply }
        });

        // Update invoice amountPaid
        await tx.inwardInvoice.update({
          where: { id: invoiceId },
          data: { amountPaid: invoice.amountPaid + amountToApply }
        });
      }

      return await tx.paymentMade.findUnique({
        where: { id: newPayment.id },
        include: { vendor: true, invoices: { include: { invoice: true } } }
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
