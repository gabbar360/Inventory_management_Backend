const { calculatePagination } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class CustomerService {
  static async getAll(page, limit, search, sortBy, sortOrder) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const total = await prisma.customer.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const orderBy = sortBy && ['name', 'code', 'email', 'phone', 'createdAt'].includes(sortBy)
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const customers = await prisma.customer.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        _count: {
          select: {
            outwardInvoices: true,
          },
        },
      },
    });

    return {
      customers,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id) {
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: {
        outwardInvoices: {
          select: {
            id: true,
            invoiceNo: true,
            date: true,
            totalCost: true,
          },
          orderBy: { date: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            outwardInvoices: true,
          },
        },
      },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return customer;
  }

  static async create(data) {
    let code = data.code;
    if (!code) {
      const last = await prisma.customer.findFirst({ orderBy: { id: 'desc' } });
      const lastNum = last ? parseInt(last.code.split('-')[1] || 0) : 0;
      code = `CUST-${String(lastNum + 1).padStart(4, '0')}`;
    }

    return await prisma.customer.create({
      data: {
        ...data,
        code,
      },
      include: {
        _count: {
          select: {
            outwardInvoices: true,
          },
        },
      },
    });
  }

  static async update(id, data) {
    return await prisma.customer.update({
      where: { id: parseInt(id) },
      data,
      include: {
        _count: {
          select: {
            outwardInvoices: true,
          },
        },
      },
    });
  }

  static async delete(id) {
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            outwardInvoices: true,
          },
        },
      },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    if (customer._count.outwardInvoices > 0) {
      throw new Error('Cannot delete customer with associated invoices');
    }

    await prisma.customer.delete({
      where: { id: parseInt(id) },
    });

    return { message: 'Customer deleted successfully' };
  }

  static async getLedger(customerId, startDate, endDate) {
    const parsedCustomerId = parseInt(customerId);
    if (isNaN(parsedCustomerId)) {
      throw new Error('Invalid customer ID');
    }
    const customer = await prisma.customer.findUnique({
      where: { id: parsedCustomerId }
    });
    if (!customer) {
      throw new Error('Customer not found');
    }

    // 1. Calculate opening balance (all transactions before startDate)
    let openingBalance = 0;
    if (startDate) {
      const startDateTime = new Date(startDate);
      const outwardBefore = await prisma.outwardInvoice.aggregate({
        where: {
          customerId: parsedCustomerId,
          date: { lt: startDateTime }
        },
        _sum: { totalCost: true }
      });
      const paymentsBefore = await prisma.paymentReceived.aggregate({
        where: {
          customerId: parsedCustomerId,
          date: { lt: startDateTime },
          transactionType: { not: 'credit_application' }
        },
        _sum: { amount: true }
      });
      openingBalance = (outwardBefore._sum.totalCost || 0) - (paymentsBefore._sum.amount || 0);
    }

    // 2. Fetch outward invoices in range
    const invoicesWhere = {
      customerId: parsedCustomerId,
    };
    if (startDate || endDate) {
      invoicesWhere.date = {};
      if (startDate) invoicesWhere.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        invoicesWhere.date.lte = end;
      }
    }
    const invoices = await prisma.outwardInvoice.findMany({
      where: invoicesWhere,
      select: {
        id: true,
        invoiceNo: true,
        date: true,
        totalCost: true,
        amountReceived: true,
        createdAt: true
      }
    });

    // 3. Fetch payments received in range
    const paymentsWhere = {
      customerId: parsedCustomerId,
      transactionType: { not: 'credit_application' }
    };
    if (startDate || endDate) {
      paymentsWhere.date = {};
      if (startDate) paymentsWhere.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        paymentsWhere.date.lte = end;
      }
    }
    const payments = await prisma.paymentReceived.findMany({
      where: paymentsWhere,
      select: {
        id: true,
        paymentNumber: true,
        date: true,
        amount: true,
        paymentMode: true,
        referenceNumber: true,
        transactionType: true,
        createdAt: true
      }
    });

    // 4. Merge & format
    let transactions = [
      ...invoices.map(inv => ({
        id: `invoice-${inv.id}`,
        date: inv.date,
        refNo: inv.invoiceNo,
        type: 'Invoice',
        details: 'Sales Invoice',
        debit: inv.totalCost,
        credit: 0,
        createdAt: inv.createdAt
      })),
      ...payments.map(p => ({
        id: `payment-${p.id}`,
        date: p.date,
        refNo: p.paymentNumber,
        type: 'Payment',
        details: p.transactionType === 'customer_advance' ? `Advance Payment (${p.paymentMode})` : `Invoice Payment (${p.paymentMode})`,
        debit: 0,
        credit: p.amount,
        createdAt: p.createdAt
      }))
    ];

    // Sort by date (asc) and createdAt (asc)
    transactions.sort((a, b) => {
      const dateDiff = new Date(a.date) - new Date(b.date);
      if (dateDiff !== 0) return dateDiff;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    // 5. Compute running balance
    let currentBalance = openingBalance;
    transactions = transactions.map(tx => {
      currentBalance = currentBalance + tx.debit - tx.credit;
      return {
        ...tx,
        balance: currentBalance
      };
    });

    const totalDebit = invoices.reduce((sum, inv) => sum + inv.totalCost, 0);
    const totalCredit = payments.reduce((sum, p) => sum + p.amount, 0);
    const closingBalance = currentBalance;

    return {
      customer,
      openingBalance,
      transactions,
      totalDebit,
      totalCredit,
      closingBalance
    };
  }
}
module.exports = { CustomerService };