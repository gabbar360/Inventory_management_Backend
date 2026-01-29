import { PrismaClient } from '@prisma/client';
import { calculatePagination, generateCode } from '../utils/response';

const prisma = new PrismaClient();

export class CustomerService {
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

    const total = await prisma.customer.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const customers = await prisma.customer.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: { outwardInvoices: true },
        },
      },
    });

    return {
      customers,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id: string) {
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
          select: { outwardInvoices: true },
        },
      },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return customer;
  }

  static async create(data: { name: string; email?: string; phone?: string; address?: string }) {
    const lastCustomer = await prisma.customer.findFirst({
      orderBy: { code: 'desc' },
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
          select: { outwardInvoices: true },
        },
      },
    });
  }

  static async update(id: string, data: { name?: string; email?: string; phone?: string; address?: string }) {
    return await prisma.customer.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { outwardInvoices: true },
        },
      },
    });
  }

  static async delete(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: { outwardInvoices: true },
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