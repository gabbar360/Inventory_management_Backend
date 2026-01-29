import { PrismaClient } from '@prisma/client';
import { calculatePagination } from '../utils/response';

const prisma = new PrismaClient();

export class ProductService {
  static async getAll(page: number, limit: number, search: string, sortBy: string, sortOrder: 'asc' | 'desc') {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { grade: { contains: search, mode: 'insensitive' as const } },
            { category: { name: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {};

    const total = await prisma.product.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const products = await prisma.product.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        category: {
          select: { name: true, hsnCode: true, gstRate: true },
        },
        _count: {
          select: { inwardItems: true, outwardItems: true },
        },
      },
    });

    return {
      products,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id: string) {
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
            vendor: { select: { name: true, code: true } },
            location: { select: { name: true } },
          },
        },
        _count: {
          select: { inwardItems: true, outwardItems: true },
        },
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    return product;
  }

  static async create(data: { name: string; grade?: string; categoryId: string }) {
    return await prisma.product.create({
      data,
      include: {
        category: {
          select: { name: true, hsnCode: true, gstRate: true },
        },
        _count: {
          select: { inwardItems: true, outwardItems: true },
        },
      },
    });
  }

  static async update(id: string, data: { name?: string; grade?: string; categoryId?: string }) {
    return await prisma.product.update({
      where: { id },
      data,
      include: {
        category: {
          select: { name: true, hsnCode: true, gstRate: true },
        },
        _count: {
          select: { inwardItems: true, outwardItems: true },
        },
      },
    });
  }

  static async delete(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: { inwardItems: true, outwardItems: true, stockBatches: true },
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