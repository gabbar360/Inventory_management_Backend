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
            { sku: { contains: search, mode: 'insensitive' } },
            { upc: { contains: search, mode: 'insensitive' } },
            { category: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const total = await prisma.product.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    let orderBy = {};
    if (sortBy === 'sku') {
      orderBy = { sku: sortOrder === 'desc' ? 'desc' : 'asc' };
    } else if (sortBy === 'name') {
      orderBy = { name: sortOrder === 'desc' ? 'desc' : 'asc' };
    } else if (sortBy) {
      orderBy = { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' };
    } else {
      orderBy = { sku: 'asc' };
    }

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
      where: { id: parseInt(id) },
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
    if (!data.upc || data.upc.trim() === '') {
      throw new Error('UPC number is required');
    }
    try {
      return await prisma.product.create({
        data: {
          ...data,
          sku: data.sku || null,
          upc: data.upc,
          categoryId: parseInt(data.categoryId)
        },
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
    } catch (error) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0];
        if (field === 'sku') {
          throw new Error('This SKU number is already in use');
        } else if (field === 'upc') {
          throw new Error('This UPC number is already in use');
        }
      }
      throw error;
    }
  }

  static async update(id, data) {
    if (!data.upc || data.upc.trim() === '') {
      throw new Error('UPC number is required');
    }
    try {
      // Check if UPC is being changed and if it already exists on another product
      if (data.upc) {
        const existingProduct = await prisma.product.findUnique({
          where: { upc: data.upc }
        });
        
        if (existingProduct && existingProduct.id !== parseInt(id)) {
          throw new Error('This UPC number is already in use');
        }
      }

      // Check if SKU is being changed and if it already exists on another product
      if (data.sku) {
        const existingProduct = await prisma.product.findUnique({
          where: { sku: data.sku }
        });
        
        if (existingProduct && existingProduct.id !== parseInt(id)) {
          throw new Error('This SKU number is already in use');
        }
      }

      return await prisma.product.update({
        where: { id: parseInt(id) },
        data: {
          ...data,
          sku: data.sku || null,
          upc: data.upc || null,
          categoryId: parseInt(data.categoryId)
        },
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
    } catch (error) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0];
        if (field === 'sku') {
          throw new Error('This SKU number is already in use');
        } else if (field === 'upc') {
          throw new Error('This UPC number is already in use');
        }
      }
      throw error;
    }
  }

  static async delete(id) {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
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
      where: { id: parseInt(id) },
    });

    return { message: 'Product deleted successfully' };
  }
}
module.exports = { ProductService };
