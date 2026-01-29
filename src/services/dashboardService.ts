import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DashboardService {
  static async getKPIs(period: 'week' | 'month' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;

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
      return sum + (batch.remainingBoxes * batch.costPerBox) + 
             ((batch.remainingPcs % batch.pcsPerBox) * batch.costPerPcs);
    }, 0);

    // Calculate total revenue
    const outwardInvoices = await prisma.outwardInvoice.findMany({
      where: {
        date: { gte: startDate },
      },
    });

    const totalRevenue = outwardInvoices.reduce((sum, invoice) => sum + invoice.totalCost, 0);

    // Calculate total purchase
    const inwardInvoices = await prisma.inwardInvoice.findMany({
      where: {
        date: { gte: startDate },
      },
    });

    const totalPurchase = inwardInvoices.reduce((sum, invoice) => sum + invoice.totalCost, 0);

    // Calculate gross profit (simplified)
    const totalExpenses = outwardInvoices.reduce((sum, invoice) => sum + invoice.expense, 0);
    const grossProfit = totalRevenue - totalExpenses;

    return {
      totalStockValue,
      totalRevenue,
      totalPurchase,
      grossProfit,
    };
  }

  static async getRevenueChart(period: 'week' | 'month' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;
    let groupBy: string;

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
      let key: string;

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

  static async getTopProducts(limit: number = 10) {
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
              select: { name: true },
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

  static async getTopCustomers(limit: number = 10) {
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
    // Low stock alerts (less than 10% of average stock)
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
}