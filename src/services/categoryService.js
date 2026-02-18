const { calculatePagination } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class CategoryService {
  static async getAll(page, limit, search, sortBy, sortOrder) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { hsnCode: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const total = await prisma.category.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const orderBy = sortBy
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const categories = await prisma.category.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return {
      categories,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id) {
    const category = await prisma.category.findUnique({
      where: { id: parseInt(id) },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return category;
  }

  static async create(data) {
    return await prisma.category.create({
      data,
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  static async update(id, data) {
    return await prisma.category.update({
      where: { id: parseInt(id) },
      data,
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  static async delete(id) {
    const category = await prisma.category.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            products: true,
          },
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
      where: { id: parseInt(id) },
    });

    return { message: 'Category deleted successfully' };
  }
}

module.exports = { CategoryService };
