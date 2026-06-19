const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class MenuService {
  /**
   * Fetches active menu items and constructs a hierarchical sidebar tree
   * tailored to the permissions of the user's role.
   * 
   * @param {number} roleId 
   */
  static async getSidebarMenuForUser(roleId) {
    // 1. Fetch user's role and its permissions
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    if (!role || !role.isActive) {
      return [];
    }

    // 2. Fetch all active main menu items and sub menu items
    const mainMenus = await prisma.menuItem.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    });

    const subMenus = await prisma.subMenuItem.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    });

    // 3. Filter based on permissions
    let allowedMain;
    let allowedSub;

    if (role.isSuperAdmin) {
      allowedMain = mainMenus;
      allowedSub = subMenus;
    } else {
      const allowedPermissionIds = role.permissions.map(rp => rp.permissionId);
      
      allowedMain = mainMenus.filter(item => {
        if (!item.permissionId) return true;
        return allowedPermissionIds.includes(item.permissionId);
      });

      allowedSub = subMenus.filter(item => {
        if (!item.permissionId) return true;
        return allowedPermissionIds.includes(item.permissionId);
      });
    }

    // 4. Build hierarchical tree structure
    const tree = [];
    for (const menu of allowedMain) {
      const children = allowedSub.filter(sub => sub.menuItemId === menu.id);
      const menuItemNode = {
        id: menu.id,
        name: menu.name,
        path: menu.path,
        icon: menu.icon,
        order: menu.order
      };

      if (children.length > 0) {
        menuItemNode.children = children.map(c => ({
          id: c.id,
          name: c.name,
          path: c.path,
          icon: c.icon,
          order: c.order,
          menuItemId: c.menuItemId
        }));
      }

      // Only show if it has a route path OR it has children submenus
      if (menuItemNode.path || (children.length > 0)) {
        tree.push(menuItemNode);
      }
    }

    return tree;
  }

  /**
   * Fetch all menu items (flat list) for management UI
   */
  static async getAllMenuItems() {
    const mainMenus = await prisma.menuItem.findMany({
      orderBy: { order: 'asc' },
      include: {
        permission: true
      }
    });

    const subMenus = await prisma.subMenuItem.findMany({
      orderBy: { order: 'asc' },
      include: {
        permission: true,
        menuItem: true
      }
    });

    // Combine into a single unified format
    const unified = [
      ...mainMenus.map(m => ({
        id: m.id,
        name: m.name,
        path: m.path,
        icon: m.icon,
        order: m.order,
        permissionId: m.permissionId,
        isActive: m.isActive,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        type: 'main',
        parent: null
      })),
      ...subMenus.map(s => ({
        id: s.id,
        name: s.name,
        path: s.path,
        icon: s.icon,
        order: s.order,
        permissionId: s.permissionId,
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        type: 'sub',
        parentId: s.menuItemId, // maps to parentId for UI compatibility
        parent: s.menuItem
      }))
    ];

    return unified.sort((a, b) => a.order - b.order);
  }

  /**
   * Create a new menu item in the database
   */
  static async createMenuItem(data) {
    let permissionId = data.permissionId ? parseInt(data.permissionId) : null;

    // Auto-generate a corresponding permission if none is selected
    if (!permissionId) {
      let baseSlug = data.path
        ? data.path.replace(/^\//, '').replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()
        : data.name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();

      if (!baseSlug) {
        baseSlug = 'menu-' + Math.random().toString(36).substr(2, 5);
      }

      const slug = `${baseSlug}.read`;
      const permName = `View ${data.name}`;
      const moduleName = baseSlug;

      const permission = await prisma.permission.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          name: permName,
          module: moduleName,
          action: 'read'
        }
      });

      permissionId = permission.id;
    }

    const wantSubmenu = data.menuItemId && data.menuItemId !== '0' && data.menuItemId !== 0;

    if (wantSubmenu) {
      // Create record in sub_menu_items table
      return prisma.subMenuItem.create({
        data: {
          name: data.name,
          path: data.path || '', // path is mandatory for submenus
          icon: data.icon || null,
          order: data.order !== undefined ? parseInt(data.order) : 0,
          menuItemId: parseInt(data.menuItemId),
          permissionId: permissionId,
          isActive: data.isActive !== false
        },
        include: {
          permission: true,
          menuItem: true
        }
      });
    } else {
      // Create record in menu_items table
      return prisma.menuItem.create({
        data: {
          name: data.name,
          path: data.path || null,
          icon: data.icon || null,
          order: data.order !== undefined ? parseInt(data.order) : 0,
          permissionId: permissionId,
          isActive: data.isActive !== false
        },
        include: {
          permission: true
        }
      });
    }
  }

  /**
   * Update an existing menu item (supports structural conversions between types)
   */
  static async updateMenuItem(id, data) {
    const parsedId = parseInt(id);
    let permissionId = data.permissionId !== undefined ? (data.permissionId && data.permissionId !== '0' && data.permissionId !== 0 ? parseInt(data.permissionId) : null) : undefined;

    // Check if the record currently exists in sub_menu_items
    const currentSub = await prisma.subMenuItem.findUnique({
      where: { id: parsedId }
    });

    const wantSubmenu = data.menuItemId !== undefined && data.menuItemId !== null && data.menuItemId !== '0' && data.menuItemId !== 0;

    if (currentSub) {
      // Existing type is Submenu
      if (wantSubmenu) {
        // Keep as Submenu, update values
        return prisma.subMenuItem.update({
          where: { id: parsedId },
          data: {
            name: data.name,
            path: data.path !== undefined ? data.path : undefined,
            icon: data.icon !== undefined ? data.icon : undefined,
            order: data.order !== undefined ? parseInt(data.order) : undefined,
            menuItemId: data.menuItemId ? parseInt(data.menuItemId) : undefined,
            permissionId: permissionId,
            isActive: data.isActive !== undefined ? data.isActive : undefined
          },
          include: {
            permission: true,
            menuItem: true
          }
        });
      } else {
        // Structural conversion: Submenu -> Main Menu
        // Delete Submenu and create Main Menu
        const deleted = await prisma.subMenuItem.delete({
          where: { id: parsedId }
        });

        return prisma.menuItem.create({
          data: {
            id: parsedId,
            name: data.name !== undefined ? data.name : deleted.name,
            path: data.path !== undefined ? data.path : deleted.path,
            icon: data.icon !== undefined ? data.icon : deleted.icon,
            order: data.order !== undefined ? parseInt(data.order) : deleted.order,
            permissionId: permissionId !== undefined ? permissionId : deleted.permissionId,
            isActive: data.isActive !== undefined ? data.isActive : deleted.isActive
          },
          include: {
            permission: true
          }
        });
      }
    } else {
      // Existing type is Main Menu
      const currentMain = await prisma.menuItem.findUnique({
        where: { id: parsedId }
      });

      if (!currentMain) {
        throw new Error('Menu item not found in either MenuItem or SubMenuItem');
      }

      if (!wantSubmenu) {
        // Keep as Main Menu, update values
        return prisma.menuItem.update({
          where: { id: parsedId },
          data: {
            name: data.name,
            path: data.path !== undefined ? data.path : undefined,
            icon: data.icon !== undefined ? data.icon : undefined,
            order: data.order !== undefined ? parseInt(data.order) : undefined,
            permissionId: permissionId,
            isActive: data.isActive !== undefined ? data.isActive : undefined
          },
          include: {
            permission: true
          }
        });
      } else {
        // Structural conversion: Main Menu -> Submenu
        // Delete Main Menu and create Submenu
        const deleted = await prisma.menuItem.delete({
          where: { id: parsedId }
        });

        return prisma.subMenuItem.create({
          data: {
            id: parsedId,
            name: data.name !== undefined ? data.name : deleted.name,
            path: data.path || '', // path is mandatory for submenus
            icon: data.icon !== undefined ? data.icon : deleted.icon,
            order: data.order !== undefined ? parseInt(data.order) : deleted.order,
            menuItemId: parseInt(data.menuItemId),
            permissionId: permissionId !== undefined ? permissionId : deleted.permissionId,
            isActive: data.isActive !== undefined ? data.isActive : deleted.isActive
          },
          include: {
            permission: true,
            menuItem: true
          }
        });
      }
    }
  }

  /**
   * Delete a menu item
   */
  static async deleteMenuItem(id) {
    const parsedId = parseInt(id);

    const isSub = await prisma.subMenuItem.findUnique({
      where: { id: parsedId }
    });

    if (isSub) {
      return prisma.subMenuItem.delete({
        where: { id: parsedId }
      });
    } else {
      return prisma.menuItem.delete({
        where: { id: parsedId }
      });
    }
  }
}

module.exports = { MenuService };
