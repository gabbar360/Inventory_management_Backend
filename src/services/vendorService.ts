import { PrismaClient } from '@prisma/client';
import { calculatePagination, generateCode } from '../utils/response';

const prisma = new PrismaClient();

export class VendorService {
  static async getAll(page: number, limit: number, search: string, sortBy: string, sortOrder: 'asc' | 'desc') {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { code: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const total = await prisma.vendor.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const vendors = await prisma.vendor.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: { inwardInvoices: true },
        },
      },
    });

    return {
      vendors,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        inwardInvoices: {
          select: {
            id: true,
            invoiceNo: true,
            date: true,
            totalCost: true,
          },
          orderBy: { date: 'desc' },
          take: 10,
        },
        _count: {
          select: { inwardInvoices: true },
        },
      },
    });

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    return vendor;
  }

  static async create(data: { name: string; email?: string; phone?: string; address?: string }) {
    const lastVendor = await prisma.vendor.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    const code = generateCode('VGR', lastVendor?.code);

    return await prisma.vendor.create({
      data: {
        ...data,
        code,
      },
      include: {
        _count: {
          select: { inwardInvoices: true },
        },
      },
    });
  }

  static async update(id: string, data: { name?: string; email?: string; phone?: string; address?: string }) {
    return await prisma.vendor.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { inwardInvoices: true },
        },
      },
    });
  }

  static async delete(id: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        _count: {
          select: { inwardInvoices: true },
        },
      },
    });

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    if (vendor._count.inwardInvoices > 0) {
      throw new Error('Cannot delete vendor with associated invoices');
    }

    await prisma.vendor.delete({
      where: { id },
    });

    return { message: 'Vendor deleted successfully' };
  }
}