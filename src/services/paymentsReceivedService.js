const { calculatePagination } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const calculateInvoiceGrandTotal = (invoice) => {
  if (!invoice) return 0;
  let baseCost = 0;
  let gstCost = 0;
  const allGstRates = [];
  invoice.items?.forEach((item) => {
    const gstRate = item.product?.category?.gstRate || 0;
    const itemBase = item.quantity * item.ratePerUnit;
    baseCost += itemBase;
    gstCost += (itemBase * gstRate) / 100;
    allGstRates.push(gstRate);
  });
  const expense = invoice.expense || 0;
  const adjustment = invoice.adjustment || 0;
  const shippingCharge = invoice.shippingCharge || 0;
  const discount = invoice.discount || 0;
  const shippingGstRate = allGstRates.includes(18) ? 18 : allGstRates.includes(5) ? 5 : 0;
  const shippingGstAmt = shippingCharge > 0 ? shippingCharge * (shippingGstRate / 100) : 0;
  const grandTotal = baseCost + gstCost + shippingGstAmt + expense + shippingCharge - adjustment - discount;
  return Math.round(grandTotal * 100) / 100;
};

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
              include: {
                items: {
                  include: {
                    product: {
                      select: { category: { select: { gstRate: true } } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    payments.forEach((payment) => {
      if (payment.invoices) {
        payment.invoices.forEach((inv) => {
          if (inv.invoice) {
            inv.invoice.totalCost = calculateInvoiceGrandTotal(inv.invoice);
          }
        });
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
              include: {
                items: {
                  include: {
                    product: {
                      select: {
                        name: true,
                        grade: true,
                        sku: true,
                        category: { select: { name: true, gstRate: true, hsnCode: true } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new Error('Payment received record not found');
    }

    if (payment.invoices) {
      payment.invoices = payment.invoices.map((inv) => {
        if (inv.invoice) {
          inv.invoice.totalCost = calculateInvoiceGrandTotal(inv.invoice);
        }
        return inv;
      });
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

      return await PaymentsReceivedService.getById(payment.id);
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

      return await PaymentsReceivedService.getById(paymentId);
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

        const invoice = await tx.outwardInvoice.findUnique({
          where: { id: invoiceId },
          include: {
            items: {
              include: {
                product: { select: { category: { select: { gstRate: true } } } }
              }
            }
          }
        });
        if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

        const grandTotal = calculateInvoiceGrandTotal(invoice);
        const balanceDue = grandTotal - invoice.amountReceived;
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

      return await PaymentsReceivedService.getById(newPayment.id);
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
