const { calculatePagination } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class VendorService {
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

    const total = await prisma.vendor.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const orderBy = sortBy && ['name', 'code', 'email', 'phone', 'createdAt'].includes(sortBy)
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const vendors = await prisma.vendor.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        _count: {
          select: {
            inwardInvoices: true,
          },
        },
      },
    });

    return {
      vendors,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: parseInt(id) },
      include: {
        inwardInvoices: {
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
            inwardInvoices: true,
          },
        },
      },
    });

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    return vendor;
  }

  static async create(data) {
    const count = await prisma.vendor.count();
    const code = data.code || `VEND-${String(count + 1).padStart(4, '0')}`;

    return await prisma.vendor.create({
      data: {
        ...data,
        code,
      },
      include: {
        _count: {
          select: {
            inwardInvoices: true,
          },
        },
      },
    });
  }

  static async update(id, data) {
    return await prisma.vendor.update({
      where: { id: parseInt(id) },
      data,
      include: {
        _count: {
          select: {
            inwardInvoices: true,
          },
        },
      },
    });
  }

  static async delete(id) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            inwardInvoices: true,
          },
        },
      },
    });

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    if (vendor._count.inwardInvoices > 0) {
      throw new Error('Cannot delete vendor with associated invoices');
    }

    await prisma.vendor.delete({
      where: { id: parseInt(id) },
    });

    return { message: 'Vendor deleted successfully' };
  }

  static async getLedger(vendorId, startDate, endDate) {
    const parsedVendorId = parseInt(vendorId);
    if (isNaN(parsedVendorId)) {
      throw new Error('Invalid vendor ID');
    }
    const vendor = await prisma.vendor.findUnique({
      where: { id: parsedVendorId }
    });
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // 1. Calculate opening balance (all transactions before startDate)
    let openingBalance = 0;
    if (startDate) {
      const startDateTime = new Date(startDate);
      const inwardBefore = await prisma.inwardInvoice.aggregate({
        where: {
          vendorId: parsedVendorId,
          date: { lt: startDateTime }
        },
        _sum: { totalCost: true }
      });
      const paymentsBefore = await prisma.paymentMade.aggregate({
        where: {
          vendorId: parsedVendorId,
          date: { lt: startDateTime },
          transactionType: { not: 'credit_application' }
        },
        _sum: { amount: true }
      });
      openingBalance = (inwardBefore._sum.totalCost || 0) - (paymentsBefore._sum.amount || 0);
    }

    // 2. Fetch inward invoices in range
    const invoicesWhere = {
      vendorId: parsedVendorId,
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
    const invoices = await prisma.inwardInvoice.findMany({
      where: invoicesWhere,
      select: {
        id: true,
        invoiceNo: true,
        date: true,
        totalCost: true,
        amountPaid: true,
        createdAt: true
      }
    });

    // 3. Fetch payments made in range
    const paymentsWhere = {
      vendorId: parsedVendorId,
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
    const payments = await prisma.paymentMade.findMany({
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
        type: 'Bill',
        details: 'Purchase Bill',
        debit: 0,
        credit: inv.totalCost,
        createdAt: inv.createdAt
      })),
      ...payments.map(p => ({
        id: `payment-${p.id}`,
        date: p.date,
        refNo: p.paymentNumber,
        type: 'Payment',
        details: p.transactionType === 'vendor_advance' ? `Advance Payment (${p.paymentMode})` : `Bill Payment (${p.paymentMode})`,
        debit: p.amount,
        credit: 0,
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
      currentBalance = currentBalance + tx.credit - tx.debit;
      return {
        ...tx,
        balance: currentBalance
      };
    });

    const totalCredit = invoices.reduce((sum, inv) => sum + inv.totalCost, 0);
    const totalDebit = payments.reduce((sum, p) => sum + p.amount, 0);
    const closingBalance = currentBalance;

    return {
      vendor,
      openingBalance,
      transactions,
      totalCredit,
      totalDebit,
      closingBalance
    };
  }
}
module.exports = { VendorService };