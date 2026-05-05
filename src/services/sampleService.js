const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class SampleService {
  static async getAll(page, limit, search, sortBy, sortOrder, source) {
    const where = {};

    if (search) {
      where.OR = [
        { sampleNo: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { status: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (source) {
      where.source = source;
    }

    const total = await prisma.sample.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const orderBy = sortBy
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const samples = await prisma.sample.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                grade: true,
              },
            },
          },
        },
      },
    });

    return {
      samples,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id) {
    const sample = await prisma.sample.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!sample) {
      throw new Error('Sample not found');
    }

    return sample;
  }

  static async createFromWebsite(data) {
    const lastSample = await prisma.sample.findFirst({
      orderBy: { sampleNo: 'desc' },
    });

    const sampleNo = generateCode('SMP', lastSample?.sampleNo);

    return await prisma.sample.create({
      data: {
        sampleNo,
        source: 'website',
        userType: data.userType,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        state: data.state,
        gstNumber: data.gstNumber || null,
        panNumber: data.panNumber || null,
        products: data.products || null,
        paymentId: data.paymentId,
        orderId: data.orderId || null,
        invoiceNumber: data.invoiceNumber || null,
        kitPrice: parseFloat(data.kitPrice) || 0,
        subtotal: data.subtotal ? parseFloat(data.subtotal) : null,
        tax: data.tax ? parseFloat(data.tax) : null,
        sampleType: 'domestic',
        dispatchMethod: 'courier',
        sentDate: new Date(),
        status: 'pending',
      },
    });
  }

  static async create(data) {
    const lastSample = await prisma.sample.findFirst({
      orderBy: { sampleNo: 'desc' },
    });

    const sampleNo = generateCode('SMP', lastSample?.sampleNo);

    return await prisma.sample.create({
      data: {
        sampleNo,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        sentBy: data.sentBy,
        sampleType: data.sampleType,
        kitPrice: parseFloat(data.kitPrice) || 0,
        trackingNumber: data.trackingNumber,
        dispatchMethod: data.dispatchMethod,
        sentDate: new Date(data.sentDate),
        status: data.status || 'pending',
        remarks: data.remarks,
        ...(data.items && data.items.length > 0 && {
          items: {
            create: data.items.map(item => ({
              productId: parseInt(item.productId),
              quantity: parseInt(item.quantity),
              unit: item.unit,
            })),
          },
        }),
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                grade: true,
              },
            },
          },
        },
      },
    });
  }

  static async update(id, data) {
    const updateData = {
      ...(data.customerName && { customerName: data.customerName }),
      ...(data.customerEmail !== undefined && { customerEmail: data.customerEmail }),
      ...(data.customerPhone !== undefined && { customerPhone: data.customerPhone }),
      ...(data.customerAddress !== undefined && { customerAddress: data.customerAddress }),
      ...(data.sentBy && { sentBy: data.sentBy }),
      ...(data.sampleType && { sampleType: data.sampleType }),
      ...(data.kitPrice !== undefined && { kitPrice: parseFloat(data.kitPrice) || 0 }),
      ...(data.trackingNumber !== undefined && { trackingNumber: data.trackingNumber }),
      ...(data.dispatchMethod && { dispatchMethod: data.dispatchMethod }),
      ...(data.sentDate && { sentDate: new Date(data.sentDate) }),
      ...(data.status && { status: data.status }),
      ...(data.remarks !== undefined && { remarks: data.remarks }),
    };

    if (data.items) {
      await prisma.sampleItem.deleteMany({
        where: { sampleId: parseInt(id) },
      });

      updateData.items = {
        create: data.items.map(item => ({
          productId: parseInt(item.productId),
          quantity: parseInt(item.quantity),
          unit: item.unit,
        })),
      };
    }

    return await prisma.sample.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                grade: true,
              },
            },
          },
        },
      },
    });
  }

  static async delete(id) {
    const sample = await prisma.sample.findUnique({
      where: { id: parseInt(id) },
    });

    if (!sample) {
      throw new Error('Sample not found');
    }

    await prisma.sample.delete({
      where: { id: parseInt(id) },
    });

    return { message: 'Sample deleted successfully' };
  }
}

module.exports = { SampleService };
