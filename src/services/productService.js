const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class ProductService {
  static async getAll(page, limit, search, sortBy, sortOrder) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { grade: { contains: search, mode: 'insensitive' } },
            { category: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const total = await prisma.product.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const orderBy = sortBy
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const products = await prisma.product.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        category: {
          select: {
            name: true,
            hsnCode: true,
            gstRate: true,
          },
        },
        _count: {
          select: {
            inwardItems: true,
            outwardItems: true,
            stockBatches: true,
          },
        },
      },
    });

    return {
      products,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        stockBatches: {
          where: {
            OR: [
              { remainingBoxes: { gt: 0 } },
              { remainingPcs: { gt: 0 } },
            ],
          },
          include: {
            vendor: {
              select: {
                name: true,
              },
            },
            location: {
              select: {
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            inwardItems: true,
            outwardItems: true,
            stockBatches: true,
          },
        },
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    return product;
  }

  static async create(data) {
    return await prisma.product.create({
      data,
      include: {
        category: {
          select: {
            name: true,
            hsnCode: true,
            gstRate: true,
          },
        },
        _count: {
          select: {
            inwardItems: true,
            outwardItems: true,
            stockBatches: true,
          },
        },
      },
    });
  }

  static async update(id, data) {
    return await prisma.product.update({
      where: { id },
      data,
      include: {
        category: {
          select: {
            name: true,
            hsnCode: true,
            gstRate: true,
          },
        },
        _count: {
          select: {
            inwardItems: true,
            outwardItems: true,
            stockBatches: true,
          },
        },
      },
    });
  }

  static async delete(id) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inwardItems: true,
            outwardItems: true,
            stockBatches: true,
          },
        },
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (product._count.inwardItems > 0 || product._count.outwardItems > 0 || product._count.stockBatches > 0) {
      throw new Error('Cannot delete product with associated transactions or stock');
    }

    await prisma.product.delete({
      where: { id },
    });

    return { message: 'Product deleted successfully' };
  }
}
module.exports = { ProductService };