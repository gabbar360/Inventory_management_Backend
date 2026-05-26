const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class RoleService {
  static async getAllRoles(page = 1, limit = 10, search = '') {
    const skip = (page - 1) * limit;
    
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.role.count({ where })
    ]);

    return {
      roles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  static async getRoleById(roleId) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!role) throw new Error('Role not found');
    return role;
  }

  static async createRole({ name, description, isActive = true }) {
    const existingRole = await prisma.role.findUnique({ where: { name } });
    if (existingRole) throw new Error('Role with this name already exists');

    const role = await prisma.role.create({
      data: {
        name,
        description,
        isActive
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true
      }
    });

    return role;
  }

  static async updateRole(roleId, { name, description, isActive }) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new Error('Role not found');

    if (name && name !== role.name) {
      const existingRole = await prisma.role.findUnique({ where: { name } });
      if (existingRole) throw new Error('Role name already in use');
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return updatedRole;
  }

  static async deleteRole(roleId) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new Error('Role not found');

    // Check if role is being used by users
    const usersWithRole = await prisma.user.count({
      where: { role: role.name }
    });

    if (usersWithRole > 0) {
      throw new Error(`Cannot delete role. ${usersWithRole} user(s) are using this role`);
    }

    await prisma.role.delete({ where: { id: roleId } });
  }
}

module.exports = { RoleService };
