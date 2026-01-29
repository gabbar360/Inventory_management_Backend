import { PrismaClient } from '@prisma/client';
import { calculatePagination } from '../utils/response';

const prisma = new PrismaClient();

export class CategoryService {
  static async getAll(page: number, limit: number, search: string, sortBy: string, sortOrder: 'asc' | 'desc') {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { hsnCode: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const total = await prisma.category.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const categories = await prisma.category.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return {
      categories,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return category;
  }

  static async create(data: { name: string; hsnCode: string; gstRate: number }) {
    return await prisma.category.create({
      data,
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  static async update(id: string, data: { name?: string; hsnCode?: string; gstRate?: number }) {
    return await prisma.category.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  static async delete(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    if (category._count.products > 0) {
      throw new Error('Cannot delete category with associated products');
    }

    await prisma.category.delete({
      where: { id },
    });

    return { message: 'Category deleted successfully' };
  }
}