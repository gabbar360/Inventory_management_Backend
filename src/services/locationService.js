const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class LocationService {
  static async getAll(page, limit, search, sortBy, sortOrder) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const total = await prisma.location.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const orderBy = sortBy
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const locations = await prisma.location.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        _count: {
          select: { 
            inwardInvoices: true, 
            outwardInvoices: true,
            stockBatches: true,
          },
        },
      },
    });

    return {
      locations,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id) {
    const location = await prisma.location.findUnique({
      where: { id: parseInt(id) },
      include: {
        stockBatches: {
          where: {
            OR: [
              { remainingBoxes: { gt: 0 } },
              { remainingPcs: { gt: 0 } },
            ],
          },
          include: {
            product: {
              select: {
                name: true,
                grade: true,
              },
            },
            vendor: {
              select: {
                name: true,
              },
            },
          },
        },
        _count: {
          select: { 
            inwardInvoices: true, 
            outwardInvoices: true,
            stockBatches: true,
          },
        },
      },
    });

    if (!location) {
      throw new Error('Location not found');
    }

    return location;
  }

  static async create(data) {
    return await prisma.location.create({
      data,
      include: {
        _count: {
          select: { 
            inwardInvoices: true, 
            outwardInvoices: true,
            stockBatches: true,
          },
        },
      },
    });
  }

  static async update(id, data) {
    return await prisma.location.update({
      where: { id: parseInt(id) },
      data,
      include: {
        _count: {
          select: { 
            inwardInvoices: true, 
            outwardInvoices: true,
            stockBatches: true,
          },
        },
      },
    });
  }

  static async delete(id) {
    const location = await prisma.location.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { 
            inwardInvoices: true, 
            outwardInvoices: true,
            stockBatches: true,
          },
        },
      },
    });

    if (!location) {
      throw new Error('Location not found');
    }

    if (location._count.inwardInvoices > 0 || location._count.outwardInvoices > 0 || location._count.stockBatches > 0) {
      throw new Error('Cannot delete location with associated transactions or stock');
    }

    await prisma.location.delete({
      where: { id: parseInt(id) },
    });

    return { message: 'Location deleted successfully' };
  }
}
module.exports = { LocationService };