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
 * Dynamically resolves a required permission slug based on HTTP Method and URL Path.
 * Uses RESTful naming conventions without hardcoding.
 */
const getDynamicPermissionSlug = (method, originalUrl) => {
  // 1. Normalize path: remove query params and trailing slash
  let cleanPath = originalUrl.split('?')[0].replace(/\/$/, '');
  cleanPath = cleanPath.replace(/^\/api\/v1/, '');

  // 2. Bypass check if it's a public endpoint
  if (PUBLIC_ROUTE_PREFIXES.some(prefix => cleanPath.startsWith(prefix))) {
    return null;
  }

  // 3. Special cases (exact matches)
  if (cleanPath === '/menus/sidebar') {
    return null; // Public - no permission check
  }

  // 4. Remove IDs and sub-paths to get base module name
  // Examples:
  // /get-products/5 → /get-products
  // /get-customers/5/ledger → /get-customers
  // /add-samples → /add-samples
  const pathWithoutId = cleanPath.replace(/\/\d+(?:\/.*)?$/, '');

  // 5. Extract module name from path
  // Remove verb prefixes: get, getall, add, create, update, delete, print
  let moduleName = pathWithoutId
    .replace(/^\//, '') // Remove leading slash
    .replace(/^(getall|get|add|create|update|delete|print)-/, '') // Remove CRUD verbs
    .toLowerCase();

  // Handle special cases with hyphens
  if (moduleName.includes('-')) {
    // Keep the full name like 'purchase-orders', 'sales-orders'
    moduleName = moduleName;
  }

  // 6. Determine action based on HTTP method
  let action = 'read'; // Default

  if (method === 'POST') {
    action = 'create';
  } else if (method === 'PUT' || method === 'PATCH') {
    action = 'update';
  } else if (method === 'DELETE') {
    action = 'delete';
  } else if (method === 'GET') {
    action = 'read';
  }

  // 7. Override action based on URL patterns
  const urlLower = cleanPath.toLowerCase();
  if (urlLower.includes('/ledger')) {
    action = 'read'; // Ledger is read-only
    if (urlLower.includes('/vendors')) {
      moduleName = 'vendor-ledger';
    } else if (urlLower.includes('/customers')) {
      moduleName = 'customer-ledger';
    }
  } else if (urlLower.includes('/approve')) {
    action = 'approve';
  } else if (urlLower.includes('/export')) {
    action = 'export';
  } else if (urlLower.includes('/print') || urlLower.includes('/pdf')) {
    action = 'read';
  } else if (urlLower.includes('/sidebar')) {
    action = 'read';
  }

  // 8. Handle special routes
  if (cleanPath === '/permissions' || cleanPath === '/menus') {
    return method === 'GET' ? 'roles.read' : 'roles.update';
  }

  if (cleanPath.includes('/permissions') && cleanPath.includes('/roles')) {
    return method === 'POST' ? 'roles.update' : 'roles.read';
  }

  return moduleName ? `${moduleName}.${action}` : null;
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
      error: `You do not have permission to perform this action. Please contact your administrator.` 
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
