const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class DashboardService {
  static async getKPIs(period = 'month') {
    const now = new Date();
    let startDate;
    let previousStartDate;

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

    const previousEndDate = startDate;

    // Calculate total stock value
    const stockBatches = await prisma.stockBatch.findMany({
      where: {
        OR: [
          { remainingBoxes: { gt: 0 } },
          { remainingPcs: { gt: 0 } },
        ],
      },
    });

    const totalStockValue = stockBatches.reduce((sum, batch) => {
      return sum + (batch.remainingPcs * batch.costPerPcs);
    }, 0);

    // Calculate total revenue
    const outwardInvoices = await prisma.outwardInvoice.findMany({
      where: {
        date: { gte: startDate },
      },
    });

    const previousOutwardInvoices = await prisma.outwardInvoice.findMany({
      where: {
        date: { gte: previousStartDate, lt: previousEndDate },
      },
    });

    const totalRevenue = outwardInvoices.reduce((sum, invoice) => sum + invoice.totalCost, 0);
    const previousRevenue = previousOutwardInvoices.reduce((sum, invoice) => sum + invoice.totalCost, 0);

    // Calculate total purchase
    const inwardInvoices = await prisma.inwardInvoice.findMany({
      where: {
        date: { gte: startDate },
      },
    });

    const previousInwardInvoices = await prisma.inwardInvoice.findMany({
      where: {
        date: { gte: previousStartDate, lt: previousEndDate },
      },
    });

    const totalPurchase = inwardInvoices.reduce((sum, invoice) => sum + invoice.totalCost, 0);
    const previousPurchase = previousInwardInvoices.reduce((sum, invoice) => sum + invoice.totalCost, 0);

    // Calculate total expenses from outward invoices
    const totalExpenses = outwardInvoices.reduce((sum, invoice) => sum + invoice.expense, 0);
    const previousExpenses = previousOutwardInvoices.reduce((sum, invoice) => sum + invoice.expense, 0);

    // Calculate gross profit (Revenue - Cost of Goods Sold)
    const outwardItems = await prisma.outwardItem.findMany({
      where: {
        outwardInvoice: {
          date: { gte: startDate },
        },
      },
      include: {
        stockBatch: true,
      },
    });

    const previousOutwardItems = await prisma.outwardItem.findMany({
      where: {
        outwardInvoice: {
          date: { gte: previousStartDate, lt: previousEndDate },
        },
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
      grossProfit,
      netProfit,
      previousRevenue,
      previousPurchase,
      previousCOGS,
      previousExpenses,
      previousGrossProfit,
      previousNetProfit,
      previousStockValue: totalStockValue,
    };
  }

  static async getRevenueChart(period = 'month') {
    const now = new Date();
    let startDate;
    let groupBy;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        groupBy = 'day';
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        groupBy = 'month';
        break;
    }

    const invoices = await prisma.outwardInvoice.findMany({
      where: {
        date: { gte: startDate },
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

    return Array.from(chartData.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));
  }

  static async getTopProducts(limit = 10) {
    const result = await prisma.outwardItem.groupBy({
      by: ['productId'],
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

  static async getTopCustomers(limit = 10) {
    const result = await prisma.outwardInvoice.groupBy({
      by: ['customerId'],
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

  static async getPerformanceMetrics(period = 'month') {
    const now = new Date();
    let startDate;

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

    // Calculate inventory turnover
    const avgInventoryValue = await prisma.stockBatch.aggregate({
      _avg: {
        costPerBox: true,
      },
    });

    const totalSales = await prisma.outwardInvoice.aggregate({
      where: { date: { gte: startDate } },
      _sum: { totalCost: true },
    });

    const inventoryTurnover = (totalSales._sum.totalCost || 0) / (avgInventoryValue._avg.costPerBox || 1);

    // Calculate average order value
    const orderStats = await prisma.outwardInvoice.aggregate({
      where: { date: { gte: startDate } },
      _avg: { totalCost: true },
      _count: true,
    });

    const avgOrderValue = orderStats._avg.totalCost || 0;

    // Calculate customer retention
    const totalCustomers = await prisma.customer.count();
    const activeCustomers = await prisma.outwardInvoice.groupBy({
      by: ['customerId'],
      where: { date: { gte: startDate } },
    });

    const customerRetention = (activeCustomers.length / totalCustomers) * 100;

    // Low stock count
    const lowStockCount = await prisma.stockBatch.count({
      where: {
        remainingPcs: { lt: 10 },
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