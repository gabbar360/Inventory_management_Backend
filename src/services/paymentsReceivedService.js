const { calculatePagination } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class PaymentsReceivedService {
  static async getAll(page, limit, search, sortBy, sortOrder, customerId, paymentMode, startDate, endDate, unusedCreditsOnly) {
    const where = {};

    if (search) {
      where.OR = [
        { paymentNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (customerId) {
      where.customerId = parseInt(customerId);
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

    const total = await prisma.paymentReceived.count({ where });
    const { offset } = calculatePagination(page, limit, total);
    let orderBy;
    if (sortBy === 'customer' || sortBy === 'customer.name') {
      orderBy = {
        customer: {
          name: sortOrder === 'desc' ? 'desc' : 'asc'
        }
      };
    } else if (sortBy && ['paymentNumber', 'date', 'amount', 'unusedAmount', 'createdAt'].includes(sortBy)) {
      orderBy = { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' };
    } else {
      orderBy = { date: 'desc' };
    }

    const payments = await prisma.paymentReceived.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        customer: {
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

    const aggregates = await prisma.paymentReceived.aggregate({
      where: { ...where, transactionType: { not: 'credit_application' } },
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
    const payment = await prisma.paymentReceived.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        invoices: {
          include: {
            invoice: {
              select: { id: true, invoiceNo: true, totalCost: true, amountReceived: true, date: true }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new Error('Payment received record not found');
    }

    return payment;
  }

  static async create(data) {
    return await prisma.$transaction(async (tx) => {
      // Check if payment number already exists
      const existing = await tx.paymentReceived.findFirst({
        where: { paymentNumber: data.paymentNumber }
      });
      if (existing) {
        throw new Error('Payment number already exists');
      }

      const amount = parseFloat(data.amount);
      const appliedInvoices = data.invoices || [];
      const totalApplied = appliedInvoices.reduce((sum, inv) => sum + parseFloat(inv.amountApplied), 0);
      const unusedAmount = Math.max(0, amount - totalApplied);

      const payment = await tx.paymentReceived.create({
        data: {
          paymentNumber: data.paymentNumber,
          customerId: parseInt(data.customerId),
          amount,
          date: new Date(data.date),
          paymentMode: data.paymentMode,
          referenceNumber: data.referenceNumber || null,
          depositTo: data.depositTo,
          bankCharges: parseFloat(data.bankCharges || 0),
          taxRate: parseFloat(data.taxRate || 0),
          notes: data.notes || null,
          transactionType: data.transactionType || 'invoice_payment',
          unusedAmount
        }
      });

      for (const inv of appliedInvoices) {
        const invoiceId = parseInt(inv.invoiceId);
        const amountApplied = parseFloat(inv.amountApplied);

        if (amountApplied > 0) {
          await tx.paymentReceivedInvoice.create({
            data: {
              paymentReceivedId: payment.id,
              invoiceId,
              amountApplied
            }
          });

          // Update OutwardInvoice amountReceived
          const invoice = await tx.outwardInvoice.findUnique({ where: { id: invoiceId } });
          if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);
          
          await tx.outwardInvoice.update({
            where: { id: invoiceId },
            data: {
              amountReceived: invoice.amountReceived + amountApplied
            }
          });
        }
      }

      return await tx.paymentReceived.findUnique({
        where: { id: payment.id },
        include: { customer: true, invoices: true }
      });
    }, { timeout: 15000 });
  }

  static async update(id, data) {
    return await prisma.$transaction(async (tx) => {
      const paymentId = parseInt(id);
      const existingPayment = await tx.paymentReceived.findUnique({
        where: { id: paymentId },
        include: { invoices: true }
      });

      if (!existingPayment) {
        throw new Error('Payment received record not found');
      }

      // Check if invoice number duplicate exists
      const duplicate = await tx.paymentReceived.findFirst({
        where: { paymentNumber: data.paymentNumber, id: { not: paymentId } }
      });
      if (duplicate) {
        throw new Error('Payment number already exists');
      }

      // Restore old applied invoices
      for (const oldInv of existingPayment.invoices) {
        const invoice = await tx.outwardInvoice.findUnique({ where: { id: oldInv.invoiceId } });
        if (invoice) {
          await tx.outwardInvoice.update({
            where: { id: oldInv.invoiceId },
            data: {
              amountReceived: Math.max(0, invoice.amountReceived - oldInv.amountApplied)
            }
          });
        }
      }

      // Delete old relations
      await tx.paymentReceivedInvoice.deleteMany({
        where: { paymentReceivedId: paymentId }
      });

      const amount = parseFloat(data.amount);
      const appliedInvoices = data.invoices || [];
      const totalApplied = appliedInvoices.reduce((sum, inv) => sum + parseFloat(inv.amountApplied), 0);
      const unusedAmount = Math.max(0, amount - totalApplied);

      const updatedPayment = await tx.paymentReceived.update({
        where: { id: paymentId },
        data: {
          paymentNumber: data.paymentNumber,
          customerId: parseInt(data.customerId),
          amount,
          date: new Date(data.date),
          paymentMode: data.paymentMode,
          referenceNumber: data.referenceNumber || null,
          depositTo: data.depositTo,
          bankCharges: parseFloat(data.bankCharges || 0),
          taxRate: parseFloat(data.taxRate || 0),
          notes: data.notes || null,
          transactionType: data.transactionType || 'invoice_payment',
          unusedAmount
        }
      });

      for (const inv of appliedInvoices) {
        const invoiceId = parseInt(inv.invoiceId);
        const amountApplied = parseFloat(inv.amountApplied);

        if (amountApplied > 0) {
          await tx.paymentReceivedInvoice.create({
            data: {
              paymentReceivedId: paymentId,
              invoiceId,
              amountApplied
            }
          });

          // Update OutwardInvoice amountReceived
          const invoice = await tx.outwardInvoice.findUnique({ where: { id: invoiceId } });
          if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);

          await tx.outwardInvoice.update({
            where: { id: invoiceId },
            data: {
              amountReceived: invoice.amountReceived + amountApplied
            }
          });
        }
      }

      return await tx.paymentReceived.findUnique({
        where: { id: paymentId },
        include: { customer: true, invoices: true }
      });
    }, { timeout: 15000 });
  }

  static async applyCredits(data) {
    return await prisma.$transaction(async (tx) => {
      const { customerId, allocations, date, notes } = data;

      const validAllocs = allocations.filter(a => parseFloat(a.amountToApply) > 0);
      if (validAllocs.length === 0) throw new Error('No valid allocations provided');

      const totalAmount = validAllocs.reduce((s, a) => s + parseFloat(a.amountToApply), 0);

      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const rand = Math.floor(1000 + Math.random() * 9000);
      const paymentNumber = `CA-${year}${month}-${rand}`;

      const existing = await tx.paymentReceived.findFirst({ where: { paymentNumber } });
      if (existing) throw new Error('Please retry — duplicate number generated, try again');

      const newPayment = await tx.paymentReceived.create({
        data: {
          paymentNumber,
          customerId: parseInt(customerId),
          amount: totalAmount,
          date: date ? new Date(date) : new Date(),
          paymentMode: 'Credit Adjustment',
          depositTo: 'Advance Credits',
          bankCharges: 0,
          notes: notes || null,
          transactionType: 'credit_application',
          unusedAmount: 0,
        }
      });

      for (const alloc of validAllocs) {
        const prId = parseInt(alloc.paymentReceivedId);
        const invoiceId = parseInt(alloc.invoiceId);
        const amountToApply = parseFloat(alloc.amountToApply);

        const sourcePayment = await tx.paymentReceived.findUnique({ where: { id: prId } });
        if (!sourcePayment) throw new Error(`Source payment ${prId} not found`);
        if (sourcePayment.unusedAmount < amountToApply - 0.001) {
          throw new Error(`Insufficient unused credits in payment ${sourcePayment.paymentNumber}`);
        }

        const invoice = await tx.outwardInvoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

        const balanceDue = invoice.totalCost - invoice.amountReceived;
        if (amountToApply > balanceDue + 0.001) {
          throw new Error(`Amount exceeds balance due for invoice ${invoice.invoiceNo}`);
        }

        await tx.paymentReceivedInvoice.create({
          data: { paymentReceivedId: newPayment.id, invoiceId, amountApplied: amountToApply }
        });

        await tx.paymentReceived.update({
          where: { id: prId },
          data: { unusedAmount: sourcePayment.unusedAmount - amountToApply }
        });

        await tx.outwardInvoice.update({
          where: { id: invoiceId },
          data: { amountReceived: invoice.amountReceived + amountToApply }
        });
      }

      return await tx.paymentReceived.findUnique({
        where: { id: newPayment.id },
        include: { customer: true, invoices: { include: { invoice: true } } }
      });
    }, { timeout: 15000 });
  }

  static async delete(id) {
    return await prisma.$transaction(async (tx) => {
      const paymentId = parseInt(id);
      const payment = await tx.paymentReceived.findUnique({
        where: { id: paymentId },
        include: { invoices: true }
      });

      if (!payment) {
        throw new Error('Payment received record not found');
      }

      // Restore old applied invoices
      for (const oldInv of payment.invoices) {
        const invoice = await tx.outwardInvoice.findUnique({ where: { id: oldInv.invoiceId } });
        if (invoice) {
          await tx.outwardInvoice.update({
            where: { id: oldInv.invoiceId },
            data: {
              amountReceived: Math.max(0, invoice.amountReceived - oldInv.amountApplied)
            }
          });
        }
      }

      // Delete the payment received (cascades paymentReceivedInvoice deletions due to schema)
      await tx.paymentReceived.delete({
        where: { id: paymentId }
      });

      return { message: 'Payment received deleted successfully' };
    }, { timeout: 15000 });
  }
}

module.exports = { PaymentsReceivedService };
