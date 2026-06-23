const { PrismaClient } = require('@prisma/client');
const { sendError } = require('../utils/helpers');

const prisma = new PrismaClient();

// In-memory cache for role permissions
const roleCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const invalidateRoleCache = (roleId) => {
  roleCache.delete(parseInt(roleId));
};

const PUBLIC_ROUTE_PREFIXES = [
  '/auth',
  '/public',
  '/health'
];

/**
 * Route-specific permission overrides.
 * Maps exact clean paths and methods to custom slugs where automatic naming conventions do not apply.
 */
const ROUTE_PERMISSION_OVERRIDES = {
  'GET:/permissions': 'roles.read',
  'GET:/menus': 'roles.read',
  'POST:/menus': 'roles.update',
  'PUT:/menus': 'roles.update',
  'DELETE:/menus': 'roles.update',
  'GET:/menus/sidebar': null, // Handled inside MenuService dynamically
};

/**
 * Dynamically resolves a required permission slug based on HTTP Method and URL Path.
 */
const getDynamicPermissionSlug = (method, originalUrl) => {
  // 1. Normalize path: remove query params and trailing slash
  let cleanPath = originalUrl.split('?')[0].replace(/\/$/, '');
  cleanPath = cleanPath.replace(/^\/api\/v1/, '');

  // 2. Bypass check if it's a public endpoint
  if (PUBLIC_ROUTE_PREFIXES.some(prefix => cleanPath.startsWith(prefix))) {
    return null;
  }

  // 3. Check for specific overrides first
  // Check exact route override (e.g. GET:/permissions)
  const exactKey = `${method}:${cleanPath}`;
  if (ROUTE_PERMISSION_OVERRIDES[exactKey] !== undefined) {
    return ROUTE_PERMISSION_OVERRIDES[exactKey];
  }

  // Check base route override (e.g. PUT:/menus/5 matches PUT:/menus)
  const baseSegment = cleanPath.split('/')[1] || '';
  const baseKey = `${method}:/${baseSegment}`;
  if (ROUTE_PERMISSION_OVERRIDES[baseKey] !== undefined) {
    return ROUTE_PERMISSION_OVERRIDES[baseKey];
  }

  const segments = cleanPath.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  // Special handling for ledger endpoints
  if (cleanPath.includes('/ledger')) {
    if (cleanPath.includes('/get-vendors/') && cleanPath.includes('/ledger')) {
      return 'vendor-ledger.read';
    }
    if (cleanPath.includes('/get-customers/') && cleanPath.includes('/ledger')) {
      return 'customer-ledger.read';
    }
  }

  // Check permissions/role subroute paths (e.g. GET:/roles/1/permissions -> roles.read)
  if (segments[0] === 'roles' && segments[2] === 'permissions') {
    return method === 'POST' ? 'roles.update' : 'roles.read';
  }

  // 4. Determine Module Name from the first segment (e.g. "get-categories" -> "categories")
  let primarySegment = segments[0];
  let moduleName = primarySegment
    .replace(/^(get|create|update|delete|print)-/, '') // Strip standard CRUD prefixes
    .toLowerCase();

  // 5. Determine Action based on HTTP Method
  let action = 'read'; // Default standard action

  if (method === 'POST') action = 'create';
  else if (method === 'PUT' || method === 'PATCH') action = 'update';
  else if (method === 'DELETE') action = 'delete';

  // Override actions based on custom sub-paths/verbs in the URL
  const urlLower = cleanPath.toLowerCase();
  if (urlLower.includes('/approve')) {
    action = 'approve';
  } else if (urlLower.includes('/export')) {
    action = 'export';
  } else if (urlLower.includes('/print') || urlLower.includes('/pdf')) {
    action = 'read';
  }

  return `${moduleName}.${action}`;
};

/**
 * Global dynamic security interceptor middleware.
 */
const dynamicAuthorize = async (req, res, next) => {
  try {
    const method = req.method;
    const path = req.originalUrl;

    // 1. Resolve required permission slug dynamically
    const requiredPermissionSlug = getDynamicPermissionSlug(method, path);

    // Bypass check if it's public or can't be resolved to a slug
    if (!requiredPermissionSlug) {
      return next();
    }

    // 2. Verify token is authenticated
    const user = req.user;
    if (!user) {
      return sendError(res, 401, 'Please login to continue');
    }

    const roleId = user.roleId;
    if (!roleId) {
      return sendError(res, 403, 'Access denied: No role assigned to user');
    }

    const now = Date.now();
    let cachedRole = roleCache.get(roleId);

    // 3. Query role if not cached or expired
    if (!cachedRole || (now - cachedRole.cachedAt > CACHE_TTL_MS)) {
      const role = await prisma.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: {
            include: { permission: true }
          }
        }
      });

      if (!role) {
        return sendError(res, 403, 'Access denied: Assigned role does not exist');
      }

      if (!role.isActive) {
        return sendError(res, 403, 'Access denied: Assigned role is deactivated');
      }

      cachedRole = {
        isSuperAdmin: role.isSuperAdmin,
        permissions: new Set(role.permissions.map(rp => rp.permission.slug)),
        cachedAt: now
      };

      roleCache.set(roleId, cachedRole);
    }

    // 4. Super Admin Bypass: Grant dynamic full access
    if (cachedRole.isSuperAdmin) {
      return next();
    }

    // 5. Evaluate dynamic slug access
    if (cachedRole.permissions.has(requiredPermissionSlug)) {
      return next();
    }

    console.warn(`[Blocked Request] User: ${user.email} | Required Permission: "${requiredPermissionSlug}" | Route: ${method} ${path}`);
    return res.status(403).json({ 
      success: false, 
      error: `Access denied: Insufficient permissions (Requires ${requiredPermissionSlug})` 
    });
  } catch (error) {
    console.error('Dynamic Authorization middleware error:', error);
    return sendError(res, 500, 'Authorization verification failed');
  }
};

/**
 * Legacy/Custom wrapper for route-specific declarations.
 * Simply flags the custom permission required (resolved dynamically by global interceptor).
 */
const authorizePermission = (customSlug) => {
  return (req, res, next) => {
    // Simply let it pass since global middleware intercepts and handles it.
    // Kept for backward compatibility with route file imports.
    next();
  };
};

module.exports = {
  dynamicAuthorize,
  authorizePermission,
  invalidateRoleCache
};
