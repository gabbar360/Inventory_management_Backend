const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class DashboardService {
  static async getKPIs(period = 'month', dateFrom = null, dateTo = null, location = null, category = null, vendor = null, customer = null) {
    const now = new Date();
    let startDate;
    let previousStartDate;

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom);
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      
      const timeDiff = endDate - startDate;
      previousStartDate = new Date(startDate.getTime() - timeDiff);
    } else {
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
          break;
      }
    }

    const previousEndDate = startDate;
    const endDate = dateTo ? new Date(dateTo) : now;
    endDate.setHours(23, 59, 59, 999);

    // Convert string IDs to integers
    const locationId = location ? parseInt(location) : null;
    const categoryId = category ? parseInt(category) : null;
    const vendorId = vendor ? parseInt(vendor) : null;
    const customerId = customer ? parseInt(customer) : null;

    // Calculate total stock value
    const stockBatches = await prisma.stockBatch.findMany({
      where: {
        AND: [
          {
            OR: [
              { remainingBoxes: { gt: 0 } },
              { remainingPcs: { gt: 0 } },
            ],
          },
          locationId ? { locationId: locationId } : {},
          categoryId ? { product: { categoryId: categoryId } } : {},
        ],
      },
      include: { product: true },
    });

    const totalStockValue = stockBatches.reduce((sum, batch) => {
      return sum + (batch.remainingPcs * batch.costPerPcs);
    }, 0);

    // Calculate total revenue
    const outwardInvoices = await prisma.outwardInvoice.findMany({
      where: {
        AND: [
          { date: { gte: startDate, lte: endDate } },
          customerId ? { customerId: customerId } : {},
          locationId ? { items: { some: { locationId: locationId } } } : {},
        ],
      },
      include: { items: { include: { stockBatch: { include: { product: true } } } } },
    });

    const previousOutwardInvoices = await prisma.outwardInvoice.findMany({
      where: {
        AND: [
          { date: { gte: previousStartDate, lt: previousEndDate } },
          customerId ? { customerId: customerId } : {},
          locationId ? { items: { some: { locationId: locationId } } } : {},
        ],
      },
      include: { items: { include: { stockBatch: { include: { product: true } } } } },
    });

    const totalRevenue = outwardInvoices.reduce((sum, invoice) => {
      const shippingVal = parseFloat(invoice.shippingCharge || 0);
      const itemGstRates = invoice.items?.map(it => it.stockBatch?.product?.category?.gstRate || 0) || [];
      const shippingGstRate = itemGstRates.includes(18) ? 18 : itemGstRates.includes(5) ? 5 : 0;
      const shippingGstAmt = shippingVal > 0 ? shippingVal * (shippingGstRate / 100) : 0;
      const shippingDeduction = shippingVal + shippingGstAmt;
      return sum + Math.max(0, invoice.totalCost - shippingDeduction);
    }, 0);

    const previousRevenue = previousOutwardInvoices.reduce((sum, invoice) => {
      const shippingVal = parseFloat(invoice.shippingCharge || 0);
      const itemGstRates = invoice.items?.map(it => it.stockBatch?.product?.category?.gstRate || 0) || [];
      const shippingGstRate = itemGstRates.includes(18) ? 18 : itemGstRates.includes(5) ? 5 : 0;
      const shippingGstAmt = shippingVal > 0 ? shippingVal * (shippingGstRate / 100) : 0;
      const shippingDeduction = shippingVal + shippingGstAmt;
      return sum + Math.max(0, invoice.totalCost - shippingDeduction);
    }, 0);

    // Calculate total purchase
    const inwardInvoices = await prisma.inwardInvoice.findMany({
      where: {
        AND: [
          { date: { gte: startDate, lte: endDate } },
          locationId ? { locationId: locationId } : {},
          vendorId ? { vendorId: vendorId } : {},
        ],
      },
    });

    const previousInwardInvoices = await prisma.inwardInvoice.findMany({
      where: {
        AND: [
          { date: { gte: previousStartDate, lt: previousEndDate } },
          locationId ? { locationId: locationId } : {},
          vendorId ? { vendorId: vendorId } : {},
        ],
      },
    });

    const totalPurchase = inwardInvoices.reduce((sum, invoice) => sum + invoice.totalCost + invoice.expense, 0);
    const previousPurchase = previousInwardInvoices.reduce((sum, invoice) => sum + invoice.totalCost + invoice.expense, 0);

    // Calculate total expenses from outward invoices and inward invoices
    const outwardExpenses = outwardInvoices.reduce((sum, invoice) => sum + invoice.expense, 0);
    const inwardExpenses = inwardInvoices.reduce((sum, invoice) => sum + invoice.expense, 0);
    const totalExpenses = outwardExpenses + inwardExpenses;
    
    const previousOutwardExpenses = previousOutwardInvoices.reduce((sum, invoice) => sum + invoice.expense, 0);
    const previousInwardExpenses = previousInwardInvoices.reduce((sum, invoice) => sum + invoice.expense, 0);
    const previousExpenses = previousOutwardExpenses + previousInwardExpenses;

    // Calculate gross profit (Revenue - Cost of Goods Sold)
    const outwardItems = await prisma.outwardItem.findMany({
      where: {
        AND: [
          {
            outwardInvoice: {
              date: { gte: startDate, lte: endDate },
              ...(customerId && { customerId: customerId }),
            },
          },
          locationId ? { locationId: locationId } : {},
          categoryId ? { stockBatch: { product: { categoryId: categoryId } } } : {},
        ],
      },
      include: {
        stockBatch: true,
      },
    });

    const previousOutwardItems = await prisma.outwardItem.findMany({
      where: {
        AND: [
          {
            outwardInvoice: {
              date: { gte: previousStartDate, lt: previousEndDate },
              ...(customerId && { customerId: customerId }),
            },
          },
          locationId ? { locationId: locationId } : {},
          categoryId ? { stockBatch: { product: { categoryId: categoryId } } } : {},
        ],
      },
      include: {
        stockBatch: true,
      },
    });

    // Calculate Cost of Goods Sold (COGS)
    const totalCOGS = outwardItems.reduce((sum, item) => {
      const costPerUnit = item.saleUnit === 'box' 
        ? item.stockBatch.costPerBox 
        : item.saleUnit === 'pack'
        ? (item.stockBatch.costPerPack || item.stockBatch.costPerBox / (item.stockBatch.packPerBox || 1))
        : item.stockBatch.costPerPcs;
      return sum + (item.quantity * costPerUnit);
    }, 0);

    const previousCOGS = previousOutwardItems.reduce((sum, item) => {
      const costPerUnit = item.saleUnit === 'box' 
        ? item.stockBatch.costPerBox 
        : item.saleUnit === 'pack'
        ? (item.stockBatch.costPerPack || item.stockBatch.costPerBox / (item.stockBatch.packPerBox || 1))
        : item.stockBatch.costPerPcs;
      return sum + (item.quantity * costPerUnit);
    }, 0);

    const grossProfit = totalRevenue - totalCOGS;
    const previousGrossProfit = previousRevenue - previousCOGS;
    const netProfit = grossProfit - totalExpenses;
    const previousNetProfit = previousGrossProfit - previousExpenses;

    return {
      totalStockValue,
      totalRevenue,
      totalPurchase,
      totalCOGS,
      totalExpenses,
      inwardExpenses,
      outwardExpenses,
      grossProfit,
      netProfit,
      previousRevenue,
      previousPurchase,
      previousCOGS,
      previousExpenses,
      previousInwardExpenses,
      previousOutwardExpenses,
      previousGrossProfit,
      previousNetProfit,
      previousStockValue: totalStockValue,
    };
  }

  static async getRevenueChart(period = 'month', dateFrom = null, dateTo = null, location = null, category = null, vendor = null, customer = null) {
    const now = new Date();
    let startDate;
    let endDate;
    let groupBy;

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom);
      endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      
      const timeDiff = endDate - startDate;
      groupBy = timeDiff > 365 * 24 * 60 * 60 * 1000 ? 'month' : 'day';
    } else {
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          endDate = now;
          groupBy = 'day';
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = now;
          groupBy = 'day';
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = now;
          groupBy = 'month';
          break;
      }
    }

    // Convert string IDs to integers
    const locationId = location ? parseInt(location) : null;
    const categoryId = category ? parseInt(category) : null;
    const customerId = customer ? parseInt(customer) : null;

    const invoices = await prisma.outwardInvoice.findMany({
      where: {
        AND: [
          { date: { gte: startDate, lte: endDate } },
          customerId ? { customerId: customerId } : {},
          locationId ? { items: { some: { locationId: locationId } } } : {},
          categoryId ? { items: { some: { stockBatch: { product: { categoryId: categoryId } } } } } : {},
        ],
      },
      orderBy: { date: 'asc' },
    });

    const chartData = new Map();

    invoices.forEach((invoice) => {
      const date = invoice.date;
      let key;

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      }

      if (chartData.has(key)) {
        chartData.set(key, chartData.get(key) + invoice.totalCost);
      } else {
        chartData.set(key, invoice.totalCost);
      }
    });

    const result = Array.from(chartData.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));
    return result;
  }

  static async getTopProducts(limit = 10, dateFrom = null, dateTo = null, location = null, category = null, vendor = null, customer = null) {
    
    // Convert string IDs to integers
    const locationId = location ? parseInt(location) : null;
    const categoryId = category ? parseInt(category) : null;
    const customerId = customer ? parseInt(customer) : null;
    
    const whereClause = {
      AND: [
        dateFrom && dateTo ? {
          outwardInvoice: {
            date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
          },
        } : {},
        locationId ? { locationId: locationId } : {},
        customerId ? { outwardInvoice: { customerId: customerId } } : {},
        categoryId ? { stockBatch: { product: { categoryId: categoryId } } } : {},
      ],
    };

    const result = await prisma.outwardItem.groupBy({
      by: ['productId'],
      where: whereClause,
      _sum: {
        quantity: true,
        totalCost: true,
      },
      orderBy: {
        _sum: {
          totalCost: 'desc',
        },
      },
      take: limit,
    });

    const topProducts = await Promise.all(
      result.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: {
            category: {
              select: {
                name: true,
              },
            },
          },
        });

        return {
          productId: item.productId,
          productName: product?.name || 'Unknown',
          categoryName: product?.category.name || 'Unknown',
          totalQuantity: item._sum.quantity || 0,
          totalRevenue: item._sum.totalCost || 0,
        };
      })
    );
    return topProducts;
  }

  static async getTopCustomers(limit = 10, dateFrom = null, dateTo = null, location = null, category = null, vendor = null, customer = null) {
    
    // Convert string IDs to integers
    const locationId = location ? parseInt(location) : null;
    const categoryId = category ? parseInt(category) : null;
    
    const whereClause = {
      AND: [
        dateFrom && dateTo ? {
          date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
        } : {},
        locationId ? { items: { some: { locationId: locationId } } } : {},
        categoryId ? { items: { some: { stockBatch: { product: { categoryId: categoryId } } } } } : {},
      ],
    };

    const result = await prisma.outwardInvoice.groupBy({
      by: ['customerId'],
      where: whereClause,
      _sum: {
        totalCost: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          totalCost: 'desc',
        },
      },
      take: limit,
    });

    const topCustomers = await Promise.all(
      result.map(async (item) => {
        const customer = await prisma.customer.findUnique({
          where: { id: item.customerId },
        });

        return {
          customerId: item.customerId,
          customerName: customer?.name || 'Unknown',
          customerCode: customer?.code || 'Unknown',
          totalOrders: item._count.id,
          totalRevenue: item._sum.totalCost || 0,
        };
      })
    );
    return topCustomers;
  }

  static async getInventoryAlerts() {
    const stockBatches = await prisma.stockBatch.findMany({
      where: {
        OR: [
          { remainingBoxes: { gt: 0 } },
          { remainingPcs: { gt: 0 } },
        ],
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        location: true,
      },
    });

    const lowStockAlerts = stockBatches
      .filter((batch) => {
        const stockPercentage = (batch.remainingPcs / batch.totalPcs) * 100;
        return stockPercentage < 10;
      })
      .map((batch) => ({
        productId: batch.productId,
        productName: batch.product.name,
        locationName: batch.location.name,
        remainingPcs: batch.remainingPcs,
        totalPcs: batch.totalPcs,
        stockPercentage: Math.round((batch.remainingPcs / batch.totalPcs) * 100),
      }));

    return {
      lowStockAlerts,
    };
  }

  static async getPerformanceMetrics(period = 'month', dateFrom = null, dateTo = null, location = null, category = null, vendor = null, customer = null) {
    const now = new Date();
    let startDate;

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom);
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }
    }

    // Convert string IDs to integers
    const locationId = location ? parseInt(location) : null;
    const categoryId = category ? parseInt(category) : null;
    const customerId = customer ? parseInt(customer) : null;

    // Calculate inventory turnover
    const avgInventoryValue = await prisma.stockBatch.aggregate({
      where: {
        AND: [
          { OR: [{ remainingBoxes: { gt: 0 } }, { remainingPcs: { gt: 0 } }] },
          locationId ? { locationId: locationId } : {},
          categoryId ? { product: { categoryId: categoryId } } : {},
        ],
      },
      _avg: {
        costPerBox: true,
      },
    });

    const totalSales = await prisma.outwardInvoice.aggregate({
      where: {
        AND: [
          { date: { gte: startDate } },
          locationId ? { locationId: locationId } : {},
          customerId ? { customerId: customerId } : {},
          categoryId ? { items: { some: { stockBatch: { product: { categoryId: categoryId } } } } } : {},
        ],
      },
      _sum: { totalCost: true },
    });

    const inventoryTurnover = (totalSales._sum.totalCost || 0) / (avgInventoryValue._avg.costPerBox || 1);

    // Calculate average order value
    const orderStats = await prisma.outwardInvoice.aggregate({
      where: {
        AND: [
          { date: { gte: startDate } },
          locationId ? { locationId: locationId } : {},
          customerId ? { customerId: customerId } : {},
          categoryId ? { items: { some: { stockBatch: { product: { categoryId: categoryId } } } } } : {},
        ],
      },
      _avg: { totalCost: true },
      _count: true,
    });

    const avgOrderValue = orderStats._avg.totalCost || 0;

    // Calculate customer retention
    const totalCustomers = await prisma.customer.count();
    const activeCustomers = await prisma.outwardInvoice.groupBy({
      by: ['customerId'],
      where: {
        AND: [
          { date: { gte: startDate } },
          locationId ? { locationId: locationId } : {},
          categoryId ? { items: { some: { stockBatch: { product: { categoryId: categoryId } } } } } : {},
        ],
      },
    });

    const customerRetention = (activeCustomers.length / totalCustomers) * 100;

    // Low stock count
    const lowStockCount = await prisma.stockBatch.count({
      where: {
        AND: [
          { remainingPcs: { lt: 10 } },
          locationId ? { locationId: locationId } : {},
          categoryId ? { product: { categoryId: categoryId } } : {},
        ],
      },
    });

    return {
      inventoryTurnover,
      inventoryTurnoverTrend: 5.2,
      avgOrderValue,
      avgOrderValueTrend: 3.1,
      customerRetention,
      customerRetentionTrend: 2.8,
      lowStockCount,
    };
  }
}
module.exports = { DashboardService };