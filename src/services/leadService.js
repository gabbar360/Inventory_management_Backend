const { PrismaClient } = require('@prisma/client');
const { calculatePagination } = require('../utils/helpers');
const { NotificationService } = require('./notificationService');

const prisma = new PrismaClient();

class LeadService {
  static async getAll(page, limit, search, sortBy, sortOrder) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
            { formType: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const total = await prisma.lead.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const orderBy = sortBy
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const leads = await prisma.lead.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
    });

    return { leads, pagination: calculatePagination(page, limit, total) };
  }

  static async getById(id) {
    const lead = await prisma.lead.findUnique({ where: { id: parseInt(id) } });
    if (!lead) throw new Error('Lead not found');
    return lead;
  }

  static async create(data) {
    const lead = await prisma.lead.create({ data });
    
    // Send notifications to all users
    try {
      const { sendNotificationToUser } = require('../socket/socket');
      const users = await prisma.user.findMany({
        select: { id: true },
      });

      for (const user of users) {
        const notification = await NotificationService.create({
          type: 'NEW_LEAD',
          title: 'New Lead Created',
          message: `New lead: ${lead.name} from ${lead.company || 'Unknown'}`,
          receiverId: user.id,
          relatedId: lead.id,
          relatedType: 'LEAD',
        });

        // Send via socket
        await sendNotificationToUser(user.id, notification);
      }
    } catch (error) {
      console.error('[LEAD] Error creating notifications:', error.message);
    }
    
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
