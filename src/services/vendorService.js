const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class VendorService {
  static async getAll(page, limit, search, sortBy, sortOrder) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const total = await prisma.vendor.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const orderBy = sortBy
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const vendors = await prisma.vendor.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        _count: {
          select: {
            inwardInvoices: true,
          },
        },
      },
    });

    return {
      vendors,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: parseInt(id) },
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
          select: {
            inwardInvoices: true,
          },
        },
      },
    });

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    return vendor;
  }

  static async create(data) {
    const lastVendor = await prisma.vendor.findFirst({
      orderBy: { createdAt: 'desc' },
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
          select: {
            inwardInvoices: true,
          },
        },
      },
    });
  }

  static async update(id, data) {
    return await prisma.vendor.update({
      where: { id: parseInt(id) },
      data,
      include: {
        _count: {
          select: {
            inwardInvoices: true,
          },
        },
      },
    });
  }

  static async delete(id) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            inwardInvoices: true,
          },
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
      where: { id: parseInt(id) },
    });

    return { message: 'Vendor deleted successfully' };
  }
}
module.exports = { VendorService };