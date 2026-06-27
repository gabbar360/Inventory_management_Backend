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
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const total = await prisma.vendor.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const orderBy = sortBy && ['name', 'companyName', 'code', 'email', 'phone', 'state', 'createdAt'].includes(sortBy)
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

    const vendorIds = vendors.map(v => v.id);

    // Fetch aggregates for only the vendorIds in the current page
    const payablesAggregates = await prisma.inwardInvoice.groupBy({
      by: ['vendorId'],
      where: { vendorId: { in: vendorIds } },
      _sum: {
        totalCost: true,
        amountPaid: true,
      }
    });

    const unusedCreditsAggregates = await prisma.paymentMade.groupBy({
      by: ['vendorId'],
      where: { vendorId: { in: vendorIds } },
      _sum: {
        unusedAmount: true,
      }
    });

    const payablesMap = {};
    payablesAggregates.forEach(agg => {
      payablesMap[agg.vendorId] = Math.max(0, (agg._sum.totalCost || 0) - (agg._sum.amountPaid || 0));
    });

    const unusedCreditsMap = {};
    unusedCreditsAggregates.forEach(agg => {
      unusedCreditsMap[agg.vendorId] = agg._sum.unusedAmount || 0;
    });

    const vendorsWithBalances = vendors.map(vendor => {
      return {
        ...vendor,
        payables: payablesMap[vendor.id] || 0,
        unusedCredits: unusedCreditsMap[vendor.id] || 0,
      };
    });

    return {
      vendors: vendorsWithBalances,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id) {
    const parsedId = parseInt(id);
    const vendor = await prisma.vendor.findUnique({
      where: { id: parsedId },
      include: {
        inwardInvoices: {
          select: {
            id: true,
            invoiceNo: true,
            date: true,
            totalCost: true,
            amountPaid: true,
            createdAt: true,
          },
          orderBy: { date: 'desc' },
          take: 20,
        },
        paymentsMade: {
          select: {
            id: true,
            paymentNumber: true,
            date: true,
            amount: true,
            unusedAmount: true,
            createdAt: true,
          },
          orderBy: { date: 'desc' },
          take: 20,
        },
        purchaseOrders: {
          select: {
            id: true,
            poNo: true,
            poDate: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
          orderBy: { poDate: 'desc' },
          take: 20,
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

    const payablesAggregate = await prisma.inwardInvoice.aggregate({
      where: { vendorId: parsedId },
      _sum: {
        totalCost: true,
        amountPaid: true,
      }
    });

    const unusedCreditsAggregate = await prisma.paymentMade.aggregate({
      where: { vendorId: parsedId },
      _sum: {
        unusedAmount: true,
      }
    });

    const payables = Math.max(0, (payablesAggregate._sum.totalCost || 0) - (payablesAggregate._sum.amountPaid || 0));
    const unusedCredits = unusedCreditsAggregate._sum.unusedAmount || 0;

    const timeline = [];

    vendor.inwardInvoices.forEach(inv => {
      timeline.push({
        id: `bill-${inv.id}`,
        type: 'bill',
        title: 'Bill created',
        description: `Bill ${inv.invoiceNo} generated for ₹${inv.totalCost.toFixed(2)}`,
        date: inv.date,
        createdAt: inv.createdAt,
      });
    });

    vendor.paymentsMade.forEach(pay => {
      timeline.push({
        id: `payment-${pay.id}`,
        type: 'payment',
        title: 'Payment made',
        description: `Payment ${pay.paymentNumber} of ₹${pay.amount.toFixed(2)} paid to supplier`,
        date: pay.date,
        createdAt: pay.createdAt,
      });
    });

    vendor.purchaseOrders.forEach(po => {
      timeline.push({
        id: `po-${po.id}`,
        type: 'purchase_order',
        title: 'Purchase Order added',
        description: `Purchase Order ${po.poNo} added for ₹${po.totalAmount.toFixed(2)} (${po.status})`,
        date: po.poDate,
        createdAt: po.createdAt,
      });
    });

    timeline.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    const recentTimeline = timeline.slice(0, 30);

    return {
      ...vendor,
      payables,
      unusedCredits,
      timeline: recentTimeline,
    };
  }

  static async create(data) {
    let code = data.code;
    let vendor;
    let attempts = 0;

    while (!code && attempts < 5) {
      try {
        const last = await prisma.vendor.findFirst({ orderBy: { code: 'desc' } });
        let lastNum = 0;
        if (last && last.code && last.code.startsWith('VEND-')) {
          lastNum = parseInt(last.code.split('-')[1]) || 0;
        }
        const nextCode = `VEND-${String(lastNum + 1).padStart(4, '0')}`;

        vendor = await prisma.vendor.create({
          data: {
            ...data,
            code: nextCode,
          },
          include: {
            _count: {
              select: {
                inwardInvoices: true,
              },
            },
          },
        });
        return vendor;
      } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('code')) {
          attempts++;
        } else {
          throw err;
        }
      }
    }

    return await prisma.vendor.create({
      data: {
        ...data,
        code: code || `VEND-${String(Math.floor(Math.random() * 100000)).padStart(4, '0')}`,
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

    // Find matching customer using priority logic
    let matchingCustomer = null;
    if (vendor.gstNumber && vendor.gstNumber.trim()) {
      matchingCustomer = await prisma.customer.findFirst({
        where: { gstNumber: { equals: vendor.gstNumber.trim(), mode: 'insensitive' } }
      });
    }
    if (!matchingCustomer && vendor.name && vendor.name.trim()) {
      matchingCustomer = await prisma.customer.findFirst({
        where: { name: { equals: vendor.name.trim(), mode: 'insensitive' } }
      });
    }
    if (!matchingCustomer && vendor.email && vendor.email.trim()) {
      matchingCustomer = await prisma.customer.findFirst({
        where: { email: { equals: vendor.email.trim(), mode: 'insensitive' } }
      });
    }
    if (!matchingCustomer && vendor.phone && vendor.phone.trim()) {
      matchingCustomer = await prisma.customer.findFirst({
        where: { phone: { equals: vendor.phone.trim(), mode: 'insensitive' } }
      });
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

      let customerInwardBefore = 0;
      let customerPaymentsBefore = 0;
      if (matchingCustomer) {
        const outwardBefore = await prisma.outwardInvoice.aggregate({
          where: {
            customerId: matchingCustomer.id,
            date: { lt: startDateTime }
          },
          _sum: { totalCost: true }
        });
        const paymentsReceivedBefore = await prisma.paymentReceived.aggregate({
          where: {
            customerId: matchingCustomer.id,
            date: { lt: startDateTime },
            transactionType: { not: 'credit_application' }
          },
          _sum: { amount: true }
        });
        customerInwardBefore = outwardBefore._sum.totalCost || 0;
        customerPaymentsBefore = paymentsReceivedBefore._sum.amount || 0;
      }

      openingBalance = (inwardBefore._sum.totalCost || 0) - (paymentsBefore._sum.amount || 0) - customerInwardBefore + customerPaymentsBefore;
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

    // Fetch matching customer transactions in range
    let customerInvoices = [];
    let customerPayments = [];
    if (matchingCustomer) {
      const customerInvoicesWhere = {
        customerId: matchingCustomer.id,
      };
      if (startDate || endDate) {
        customerInvoicesWhere.date = {};
        if (startDate) customerInvoicesWhere.date.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          customerInvoicesWhere.date.lte = end;
        }
      }
      customerInvoices = await prisma.outwardInvoice.findMany({
        where: customerInvoicesWhere,
        select: {
          id: true,
          invoiceNo: true,
          date: true,
          totalCost: true,
          amountReceived: true,
          createdAt: true
        }
      });

      const customerPaymentsWhere = {
        customerId: matchingCustomer.id,
        transactionType: { not: 'credit_application' }
      };
      if (startDate || endDate) {
        customerPaymentsWhere.date = {};
        if (startDate) customerPaymentsWhere.date.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          customerPaymentsWhere.date.lte = end;
        }
      }
      customerPayments = await prisma.paymentReceived.findMany({
        where: customerPaymentsWhere,
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
    }

    // 4. Merge & format
    let transactions = [
      ...invoices.map(inv => ({
        id: `invoice-${inv.id}`,
        date: inv.date,
        refNo: inv.invoiceNo,
        type: 'Purchase',
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
      })),
      ...customerInvoices.map(inv => ({
        id: `cust-invoice-${inv.id}`,
        date: inv.date,
        refNo: inv.invoiceNo,
        type: 'Sales',
        details: 'Contra: Sales Invoice',
        debit: inv.totalCost,
        credit: 0,
        createdAt: inv.createdAt
      })),
      ...customerPayments.map(p => ({
        id: `cust-payment-${p.id}`,
        date: p.date,
        refNo: p.paymentNumber,
        type: 'Payment Received',
        details: p.transactionType === 'customer_advance' ? `Contra: Advance Received (${p.paymentMode})` : `Contra: Payment Received (${p.paymentMode})`,
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
      currentBalance = currentBalance + tx.credit - tx.debit;
      return {
        ...tx,
        balance: currentBalance
      };
    });

    const totalCredit = invoices.reduce((sum, inv) => sum + inv.totalCost, 0) + customerPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalDebit = payments.reduce((sum, p) => sum + p.amount, 0) + customerInvoices.reduce((sum, inv) => sum + inv.totalCost, 0);
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