import { PrismaClient } from '@prisma/client';
import { calculatePagination } from '../utils/response';

const prisma = new PrismaClient();

export class LocationService {
  static async getAll(page: number, limit: number, search: string, sortBy: string, sortOrder: 'asc' | 'desc') {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { address: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const total = await prisma.location.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const locations = await prisma.location.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
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

  static async getById(id: string) {
    const location = await prisma.location.findUnique({
      where: { id },
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
              select: { name: true, grade: true },
            },
            vendor: {
              select: { name: true, code: true },
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

  static async create(data: { name: string; address?: string }) {
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

  static async update(id: string, data: { name?: string; address?: string }) {
    return await prisma.location.update({
      where: { id },
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

  static async delete(id: string) {
    const location = await prisma.location.findUnique({
      where: { id },
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
      where: { id },
    });

    return { message: 'Location deleted successfully' };
  }
}