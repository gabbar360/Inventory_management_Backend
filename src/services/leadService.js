const { PrismaClient } = require('@prisma/client');
const { calculatePagination } = require('../utils/helpers');

const prisma = new PrismaClient();

class LeadService {
  static async getAll(page, limit, search, sortBy, sortOrder, source) {
    const where = {
      NOT: [
        { source: 'website', formType: 'QuoteCartForm' },
      ],
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { formType: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (source && source !== 'all') {
      where.source = source;
    }

    const [total, newCount, contactedCount, convertedCount, rejectedCount] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: 'new' } }),
      prisma.lead.count({ where: { ...where, status: 'contacted' } }),
      prisma.lead.count({ where: { ...where, status: 'converted' } }),
      prisma.lead.count({ where: { ...where, status: 'rejected' } }),
    ]);

    const { offset } = calculatePagination(page, limit, total);

    const orderBy = sortBy && ['name', 'email', 'company', 'status', 'createdAt'].includes(sortBy)
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const leads = await prisma.lead.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
    });

    const pagData = calculatePagination(page, limit, total);
    pagData.stats = {
      total,
      new: newCount,
      contacted: contactedCount,
      converted: convertedCount,
      rejected: rejectedCount
    };

    return { leads, pagination: pagData };
  }

  static async getById(id) {
    const lead = await prisma.lead.findUnique({ where: { id: parseInt(id) } });
    if (!lead) throw new Error('Lead not found');
    return lead;
  }

  static async create(data) {
    const lead = await prisma.lead.create({ data });
    return lead;
  }

  static async update(id, data) {
    return await prisma.lead.update({
      where: { id: parseInt(id) },
      data,
    });
  }

  static async delete(id) {
    const lead = await prisma.lead.findUnique({ where: { id: parseInt(id) } });
    if (!lead) throw new Error('Lead not found');
    await prisma.lead.delete({ where: { id: parseInt(id) } });
    return { message: 'Lead deleted successfully' };
  }
}

module.exports = { LeadService };
