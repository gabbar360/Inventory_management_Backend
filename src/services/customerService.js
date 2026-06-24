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

    const customerIds = customers.map(c => c.id);

    // Fetch aggregates for only the customerIds in the current page
    const receivablesAggregates = await prisma.outwardInvoice.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds } },
      _sum: {
        totalCost: true,
        amountReceived: true,
      }
    });

    const unusedCreditsAggregates = await prisma.paymentReceived.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds } },
      _sum: {
        unusedAmount: true,
      }
    });

    const receivablesMap = {};
    receivablesAggregates.forEach(agg => {
      receivablesMap[agg.customerId] = Math.max(0, (agg._sum.totalCost || 0) - (agg._sum.amountReceived || 0));
    });

    const unusedCreditsMap = {};
    unusedCreditsAggregates.forEach(agg => {
      unusedCreditsMap[agg.customerId] = agg._sum.unusedAmount || 0;
    });

    const customersWithBalances = customers.map(customer => {
      return {
        ...customer,
        receivables: receivablesMap[customer.id] || 0,
        unusedCredits: unusedCreditsMap[customer.id] || 0,
      };
    });

    return {
      customers: customersWithBalances,
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
            amountReceived: true,
            createdAt: true,
          },
          orderBy: { date: 'desc' },
          take: 20,
        },
        paymentsReceived: {
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
        quotes: {
          select: {
            id: true,
            quoteNo: true,
            quoteDate: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
          orderBy: { quoteDate: 'desc' },
          take: 20,
        },
        salesOrders: {
          select: {
            id: true,
            orderNo: true,
            orderDate: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
          orderBy: { orderDate: 'desc' },
          take: 20,
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

    const receivablesAggregate = await prisma.outwardInvoice.aggregate({
      where: { customerId: parseInt(id) },
      _sum: {
        totalCost: true,
        amountReceived: true,
      }
    });

    const unusedCreditsAggregate = await prisma.paymentReceived.aggregate({
      where: { customerId: parseInt(id) },
      _sum: {
        unusedAmount: true,
      }
    });

    const receivables = Math.max(0, (receivablesAggregate._sum.totalCost || 0) - (receivablesAggregate._sum.amountReceived || 0));
    const unusedCredits = unusedCreditsAggregate._sum.unusedAmount || 0;

    const timeline = [];

    customer.outwardInvoices.forEach(inv => {
      timeline.push({
        id: `invoice-${inv.id}`,
        type: 'invoice',
        title: 'Invoice created',
        description: `Invoice ${inv.invoiceNo} generated for ₹${inv.totalCost.toFixed(2)}`,
        date: inv.date,
        createdAt: inv.createdAt,
      });
    });

    customer.paymentsReceived.forEach(pay => {
      timeline.push({
        id: `payment-${pay.id}`,
        type: 'payment',
        title: 'Payment received',
        description: `Payment ${pay.paymentNumber} of ₹${pay.amount.toFixed(2)} received`,
        date: pay.date,
        createdAt: pay.createdAt,
      });
    });

    customer.quotes.forEach(q => {
      timeline.push({
        id: `quote-${q.id}`,
        type: 'quote',
        title: 'Quote created',
        description: `Quote ${q.quoteNo} generated for ₹${q.totalAmount.toFixed(2)} (${q.status})`,
        date: q.quoteDate,
        createdAt: q.createdAt,
      });
    });

    customer.salesOrders.forEach(so => {
      timeline.push({
        id: `order-${so.id}`,
        type: 'order',
        title: 'Sales Order added',
        description: `Sales Order ${so.orderNo} added for ₹${so.totalAmount.toFixed(2)} (${so.status})`,
        date: so.orderDate,
        createdAt: so.createdAt,
      });
    });

    timeline.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    const recentTimeline = timeline.slice(0, 30);

    return {
      ...customer,
      receivables,
      unusedCredits,
      timeline: recentTimeline,
    };
  }

  static async create(data) {
    let code = data.code;
    let customer;
    let attempts = 0;

    while (!code && attempts < 5) {
      try {
        const last = await prisma.customer.findFirst({ orderBy: { code: 'desc' } });
        let lastNum = 0;
        if (last && last.code && last.code.startsWith('CUST-')) {
          lastNum = parseInt(last.code.split('-')[1]) || 0;
        }
        const nextCode = `CUST-${String(lastNum + 1).padStart(4, '0')}`;
        
        customer = await prisma.customer.create({
          data: {
            ...data,
            code: nextCode,
          },
          include: {
            _count: {
              select: {
                outwardInvoices: true,
              },
            },
          },
        });
        return customer;
      } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('code')) {
          attempts++;
        } else {
          throw err;
        }
      }
    }

    return await prisma.customer.create({
      data: {
        ...data,
        code: code || `CUST-${String(Math.floor(Math.random() * 100000)).padStart(4, '0')}`,
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

    // Find matching vendor using priority logic
    let matchingVendor = null;
    if (customer.gstNumber && customer.gstNumber.trim()) {
      matchingVendor = await prisma.vendor.findFirst({
        where: { gstNumber: { equals: customer.gstNumber.trim(), mode: 'insensitive' } }
      });
    }
    if (!matchingVendor && customer.name && customer.name.trim()) {
      matchingVendor = await prisma.vendor.findFirst({
        where: { name: { equals: customer.name.trim(), mode: 'insensitive' } }
      });
    }
    if (!matchingVendor && customer.email && customer.email.trim()) {
      matchingVendor = await prisma.vendor.findFirst({
        where: { email: { equals: customer.email.trim(), mode: 'insensitive' } }
      });
    }
    if (!matchingVendor && customer.phone && customer.phone.trim()) {
      matchingVendor = await prisma.vendor.findFirst({
        where: { phone: { equals: customer.phone.trim(), mode: 'insensitive' } }
      });
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

      let vendorInwardBefore = 0;
      let vendorPaymentsBefore = 0;
      if (matchingVendor) {
        const inwardBefore = await prisma.inwardInvoice.aggregate({
          where: {
            vendorId: matchingVendor.id,
            date: { lt: startDateTime }
          },
          _sum: { totalCost: true }
        });
        const paymentsMadeBefore = await prisma.paymentMade.aggregate({
          where: {
            vendorId: matchingVendor.id,
            date: { lt: startDateTime },
            transactionType: { not: 'credit_application' }
          },
          _sum: { amount: true }
        });
        vendorInwardBefore = inwardBefore._sum.totalCost || 0;
        vendorPaymentsBefore = paymentsMadeBefore._sum.amount || 0;
      }

      openingBalance = (outwardBefore._sum.totalCost || 0) - (paymentsBefore._sum.amount || 0) - vendorInwardBefore + vendorPaymentsBefore;
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

    // Fetch matching vendor transactions in range
    let vendorInvoices = [];
    let vendorPayments = [];
    if (matchingVendor) {
      const vendorInvoicesWhere = {
        vendorId: matchingVendor.id,
      };
      if (startDate || endDate) {
        vendorInvoicesWhere.date = {};
        if (startDate) vendorInvoicesWhere.date.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          vendorInvoicesWhere.date.lte = end;
        }
      }
      vendorInvoices = await prisma.inwardInvoice.findMany({
        where: vendorInvoicesWhere,
        select: {
          id: true,
          invoiceNo: true,
          date: true,
          totalCost: true,
          amountPaid: true,
          createdAt: true
        }
      });

      const vendorPaymentsWhere = {
        vendorId: matchingVendor.id,
        transactionType: { not: 'credit_application' }
      };
      if (startDate || endDate) {
        vendorPaymentsWhere.date = {};
        if (startDate) vendorPaymentsWhere.date.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          vendorPaymentsWhere.date.lte = end;
        }
      }
      vendorPayments = await prisma.paymentMade.findMany({
        where: vendorPaymentsWhere,
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
        type: 'Sales',
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
      })),
      ...vendorInvoices.map(inv => ({
        id: `vend-invoice-${inv.id}`,
        date: inv.date,
        refNo: inv.invoiceNo,
        type: 'Purchase',
        details: 'Contra: Purchase Bill',
        debit: 0,
        credit: inv.totalCost,
        createdAt: inv.createdAt
      })),
      ...vendorPayments.map(p => ({
        id: `vend-payment-${p.id}`,
        date: p.date,
        refNo: p.paymentNumber,
        type: 'Payment Made',
        details: p.transactionType === 'vendor_advance' ? `Contra: Advance Paid (${p.paymentMode})` : `Contra: Bill Payment (${p.paymentMode})`,
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
      currentBalance = currentBalance + tx.debit - tx.credit;
      return {
        ...tx,
        balance: currentBalance
      };
    });

    const totalDebit = invoices.reduce((sum, inv) => sum + inv.totalCost, 0) + vendorPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalCredit = payments.reduce((sum, p) => sum + p.amount, 0) + vendorInvoices.reduce((sum, inv) => sum + inv.totalCost, 0);
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