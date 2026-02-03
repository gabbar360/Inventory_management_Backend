const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class CustomerService {
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

    const total = await prisma.customer.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const orderBy = sortBy
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const customers = await prisma.customer.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        _count: {
          select: {
            outwardInvoices: true,
          },
        },
      },
    });

    return {
      customers,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        outwardInvoices: {
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
            outwardInvoices: true,
          },
        },
      },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return customer;
  }

  static async create(data) {
    const lastCustomer = await prisma.customer.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    const code = generateCode('CUS', lastCustomer?.code);

    return await prisma.customer.create({
      data: {
        ...data,
        code,
      },
      include: {
        _count: {
          select: {
            outwardInvoices: true,
          },
        },
      },
    });
  }

  static async update(id, data) {
    return await prisma.customer.update({
      where: { id },
      data,
      include: {
        _count: {
          select: {
            outwardInvoices: true,
          },
        },
      },
    });
  }

  static async delete(id) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            outwardInvoices: true,
          },
        },
      },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    if (customer._count.outwardInvoices > 0) {
      throw new Error('Cannot delete customer with associated invoices');
    }

    await prisma.customer.delete({
      where: { id },
    });

    return { message: 'Customer deleted successfully' };
  }
}
module.exports = { CustomerService };