const { PrismaClient } = require('@prisma/client');
const { invalidateRoleCache } = require('../middleware/authorize');

const prisma = new PrismaClient();

class PermissionService {
  /**
   * Fetch all permissions grouped by module
   */
  static async getAllPermissions() {
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { module: 'asc' },
        { name: 'asc' }
      ]
    });
    return permissions;
  }

  /**
   * Fetch all permission slugs for a specific role
   * @param {number} roleId 
   */
  static async getPermissionsByRole(roleId) {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: true
      }
    });
    return rolePermissions.map(rp => rp.permission);
  }

  /**
   * Synchronize permissions for a role in a transaction
   * @param {number} roleId 
   * @param {Array<number>} permissionIds 
   */
  static async updateRolePermissions(roleId, permissionIds) {
    // Perform sync within a transaction
    await prisma.$transaction([
      // 1. Delete all existing permissions assigned to this role
      prisma.rolePermission.deleteMany({
        where: { roleId }
      }),
      // 2. Create new mapping records
      prisma.rolePermission.createMany({
        data: permissionIds.map(permId => ({
          roleId,
          permissionId: permId
        }))
      })
    ]);

    // 3. Clear authorization cache for this role
    invalidateRoleCache(roleId);

    // Retrieve and return updated permissions
    return this.getPermissionsByRole(roleId);
  }
}

module.exports = { PermissionService };
