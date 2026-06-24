require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting DB Seeding...');

  // 1. Create or update Default Roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'Super Admin' },
    update: { isSuperAdmin: true, isActive: true },
    create: {
      name: 'Super Admin',
      description: 'System Administrator with full wildcard access bypass',
      isSuperAdmin: true,
      isActive: true
    }
  });

  const staffRole = await prisma.role.upsert({
    where: { name: 'Staff' },
    update: {},
    create: {
      name: 'Staff',
      description: 'Standard staff role with limited access permissions',
      isSuperAdmin: false,
      isActive: true
    }
  });

  console.log('Roles created/updated.');

  // 2. Create Default User and link to Super Admin
  const hashedPassword = await bcrypt.hash('Pass@1234', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'inventory@vegnar.com' },
    update: {
      roleId: superAdminRole.id
    },
    create: {
      email: 'inventory@vegnar.com',
      password: hashedPassword,
      name: 'System Administrator',
      roleId: superAdminRole.id
    }
  });

  console.log(`Default Super Admin user (inventory@vegnar.com) verified.`);

  // 3. Define and Insert all Permissions
  const permissionsList = [
    // Dashboard
    { slug: 'dashboard.read', name: 'View Dashboard', module: 'dashboard', action: 'read' },
    
    // Leads
    { slug: 'leads.create', name: 'Create Leads', module: 'leads', action: 'create' },
    { slug: 'leads.read', name: 'View Leads', module: 'leads', action: 'read' },
    { slug: 'leads.update', name: 'Update Leads', module: 'leads', action: 'update' },
    { slug: 'leads.delete', name: 'Delete Leads', module: 'leads', action: 'delete' },
    
    // Website Quotes
    { slug: 'website-quotes.read', name: 'View Website Quotes', module: 'website-quotes', action: 'read' },
    { slug: 'website-quotes.update', name: 'Update Website Quotes', module: 'website-quotes', action: 'update' },
    
    // Categories
    { slug: 'categories.create', name: 'Create Categories', module: 'categories', action: 'create' },
    { slug: 'categories.read', name: 'View Categories', module: 'categories', action: 'read' },
    { slug: 'categories.update', name: 'Update Categories', module: 'categories', action: 'update' },
    { slug: 'categories.delete', name: 'Delete Categories', module: 'categories', action: 'delete' },
    
    // Products
    { slug: 'products.create', name: 'Create Products', module: 'products', action: 'create' },
    { slug: 'products.read', name: 'View Products', module: 'products', action: 'read' },
    { slug: 'products.update', name: 'Update Products', module: 'products', action: 'update' },
    { slug: 'products.delete', name: 'Delete Products', module: 'products', action: 'delete' },
    
    // Vendors
    { slug: 'vendors.create', name: 'Create Vendors', module: 'vendors', action: 'create' },
    { slug: 'vendors.read', name: 'View Vendors', module: 'vendors', action: 'read' },
    { slug: 'vendors.update', name: 'Update Vendors', module: 'vendors', action: 'update' },
    { slug: 'vendors.delete', name: 'Delete Vendors', module: 'vendors', action: 'delete' },
    
    // Purchase Orders
    { slug: 'purchase-orders.create', name: 'Create Purchase Orders', module: 'purchase-orders', action: 'create' },
    { slug: 'purchase-orders.read', name: 'View Purchase Orders', module: 'purchase-orders', action: 'read' },
    { slug: 'purchase-orders.update', name: 'Update Purchase Orders', module: 'purchase-orders', action: 'update' },
    { slug: 'purchase-orders.delete', name: 'Delete Purchase Orders', module: 'purchase-orders', action: 'delete' },
    
    // Inward Invoices
    { slug: 'inward.create', name: 'Create Inwards', module: 'inward', action: 'create' },
    { slug: 'inward.read', name: 'View Inwards', module: 'inward', action: 'read' },
    { slug: 'inward.update', name: 'Update Inwards', module: 'inward', action: 'update' },
    { slug: 'inward.delete', name: 'Delete Inwards', module: 'inward', action: 'delete' },
    
    // Payments Made
    { slug: 'payments-made.create', name: 'Create Payments Made', module: 'payments-made', action: 'create' },
    { slug: 'payments-made.read', name: 'View Payments Made', module: 'payments-made', action: 'read' },
    { slug: 'payments-made.update', name: 'Edit Payments Made', module: 'payments-made', action: 'update' },
    { slug: 'payments-made.delete', name: 'Delete Payments Made', module: 'payments-made', action: 'delete' },
    
    // Customers
    { slug: 'customers.create', name: 'Create Customers', module: 'customers', action: 'create' },
    { slug: 'customers.read', name: 'View Customers', module: 'customers', action: 'read' },
    { slug: 'customers.update', name: 'Update Customers', module: 'customers', action: 'update' },
    { slug: 'customers.delete', name: 'Delete Customers', module: 'customers', action: 'delete' },
    
    // Quotes
    { slug: 'quotes.create', name: 'Create Quotes', module: 'quotes', action: 'create' },
    { slug: 'quotes.read', name: 'View Quotes', module: 'quotes', action: 'read' },
    { slug: 'quotes.update', name: 'Update Quotes', module: 'quotes', action: 'update' },
    { slug: 'quotes.delete', name: 'Delete Quotes', module: 'quotes', action: 'delete' },
    
    // Sales Orders
    { slug: 'sales-orders.create', name: 'Create Sales Orders', module: 'sales-orders', action: 'create' },
    { slug: 'sales-orders.read', name: 'View Sales Orders', module: 'sales-orders', action: 'read' },
    { slug: 'sales-orders.update', name: 'Update Sales Orders', module: 'sales-orders', action: 'update' },
    { slug: 'sales-orders.delete', name: 'Delete Sales Orders', module: 'sales-orders', action: 'delete' },
    
    // Order Dispatches
    { slug: 'order-dispatches.create', name: 'Create Dispatches', module: 'order-dispatches', action: 'create' },
    { slug: 'order-dispatches.read', name: 'View Dispatches', module: 'order-dispatches', action: 'read' },
    { slug: 'order-dispatches.update', name: 'Update Dispatches', module: 'order-dispatches', action: 'update' },
    { slug: 'order-dispatches.delete', name: 'Delete Dispatches', module: 'order-dispatches', action: 'delete' },
    
    // Outward
    { slug: 'outward.create', name: 'Create Outwards', module: 'outward', action: 'create' },
    { slug: 'outward.read', name: 'View Outwards', module: 'outward', action: 'read' },
    { slug: 'outward.update', name: 'Update Outwards', module: 'outward', action: 'update' },
    { slug: 'outward.delete', name: 'Delete Outwards', module: 'outward', action: 'delete' },
    
    // Payments Received
    { slug: 'payments-received.create', name: 'Create Payments Received', module: 'payments-received', action: 'create' },
    { slug: 'payments-received.read', name: 'View Payments Received', module: 'payments-received', action: 'read' },
    { slug: 'payments-received.update', name: 'Edit Payments Received', module: 'payments-received', action: 'update' },
    { slug: 'payments-received.delete', name: 'Delete Payments Received', module: 'payments-received', action: 'delete' },
    
    // Vendor Ledger
    { slug: 'vendor-ledger.read', name: 'View Vendor Ledger', module: 'vendor-ledger', action: 'read' },
    
    // Customer Ledger
    { slug: 'customer-ledger.read', name: 'View Customer Ledger', module: 'customer-ledger', action: 'read' },
    
    // Warehouse Locations
    { slug: 'locations.create', name: 'Create Locations', module: 'locations', action: 'create' },
    { slug: 'locations.read', name: 'View Locations', module: 'locations', action: 'read' },
    { slug: 'locations.update', name: 'Update Locations', module: 'locations', action: 'update' },
    { slug: 'locations.delete', name: 'Delete Locations', module: 'locations', action: 'delete' },
    
    // Inventory
    { slug: 'inventory.read', name: 'View Inventory', module: 'inventory', action: 'read' },
    
    // Samples
    { slug: 'samples.create', name: 'Create Samples', module: 'samples', action: 'create' },
    { slug: 'samples.read', name: 'View Samples', module: 'samples', action: 'read' },
    { slug: 'samples.update', name: 'Update Samples', module: 'samples', action: 'update' },
    { slug: 'samples.delete', name: 'Delete Samples', module: 'samples', action: 'delete' },
    
    // Profit & Loss
    { slug: 'profit-loss.read', name: 'View Profit & Loss Reports', module: 'profit-loss', action: 'read' },
    
    // Settings / Configuration
    { slug: 'settings.update', name: 'Manage Settings', module: 'settings', action: 'update' },
    
    // System Roles & Users management
    { slug: 'roles.create', name: 'Create Roles', module: 'roles', action: 'create' },
    { slug: 'roles.read', name: 'View Roles', module: 'roles', action: 'read' },
    { slug: 'roles.update', name: 'Update Roles', module: 'roles', action: 'update' },
    { slug: 'roles.delete', name: 'Delete Roles', module: 'roles', action: 'delete' },
    
    { slug: 'users.create', name: 'Create Users', module: 'users', action: 'create' },
    { slug: 'users.read', name: 'View Users', module: 'users', action: 'read' },
    { slug: 'users.update', name: 'Update Users', module: 'users', action: 'update' },
    { slug: 'users.delete', name: 'Delete Users', module: 'users', action: 'delete' },
  ];

  const dbPermissions = {};
  for (const perm of permissionsList) {
    const created = await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: { name: perm.name, module: perm.module, action: perm.action },
      create: perm
    });
    dbPermissions[perm.slug] = created.id;
  }
  console.log(`${permissionsList.length} Permissions created/updated.`);

  // 4. Assign full permissions to Staff role (except roles and user management for safety)
  const staffPermissions = permissionsList.filter(p => !p.slug.startsWith('roles.') && !p.slug.startsWith('users.'));
  
  await prisma.rolePermission.deleteMany({ where: { roleId: staffRole.id } });
  await prisma.rolePermission.createMany({
    data: staffPermissions.map(p => ({
      roleId: staffRole.id,
      permissionId: dbPermissions[p.slug]
    }))
  });
  console.log('Staff permissions set.');

  // 5. Build Dynamic Menu Items
  // Clean existing menu items first to prevent duplicates during testing/seeding
  await prisma.subMenuItem.deleteMany();
  await prisma.menuItem.deleteMany();

  // Production-level menu ordering with section-based grouping
  // Sequential order: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 200
  // Format: Each section gets 10 unit gap, submenus are +1, +2, +3 from parent

  // Section 10: Dashboard
  await prisma.menuItem.create({
    data: { name: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', order: 10, permissionId: dbPermissions['dashboard.read'] }
  });

  // Section 20: Leads
  await prisma.menuItem.create({
    data: { name: 'Leads', path: '/leads', icon: 'Megaphone', order: 20, permissionId: dbPermissions['leads.read'] }
  });

  // Section 30: Website Quotes
  await prisma.menuItem.create({
    data: { name: 'Website Quotes', path: '/website-quotes', icon: 'Globe', order: 30, permissionId: dbPermissions['website-quotes.read'] }
  });

  // Section 40-50: Master Data (Categories, Products)
  await prisma.menuItem.create({
    data: { name: 'Categories', path: '/categories', icon: 'FolderTree', order: 40, permissionId: dbPermissions['categories.read'] }
  });

  await prisma.menuItem.create({
    data: { name: 'Products', path: '/products', icon: 'Box', order: 50, permissionId: dbPermissions['products.read'] }
  });

  // Section 60-65: Purchase Module (Group)
  const purchaseGroup = await prisma.menuItem.create({
    data: { name: 'Purchase', path: null, icon: 'ShoppingCart', order: 60 }
  });

  await prisma.subMenuItem.createMany({
    data: [
      { name: 'Vendors', path: '/vendors', icon: 'Users', order: 61, menuItemId: purchaseGroup.id, permissionId: dbPermissions['vendors.read'] },
      { name: 'Purchase Orders', path: '/purchase-orders', icon: 'ShoppingCart', order: 62, menuItemId: purchaseGroup.id, permissionId: dbPermissions['purchase-orders.read'] },
      { name: 'Inward', path: '/inward', icon: 'ArrowDownToLine', order: 63, menuItemId: purchaseGroup.id, permissionId: dbPermissions['inward.read'] },
      { name: 'Payments Made', path: '/paymentsmade', icon: 'CreditCard', order: 64, menuItemId: purchaseGroup.id, permissionId: dbPermissions['payments-made.read'] },
      { name: 'Vendor Ledger', path: '/vendor-ledger', icon: 'BarChart3', order: 65, menuItemId: purchaseGroup.id, permissionId: dbPermissions['vendor-ledger.read'] }
    ]
  });

  // Section 70-79: Available for future modules

  // Section 80-87: Sales Module (Group)
  const salesGroup = await prisma.menuItem.create({
    data: { name: 'Sales', path: null, icon: 'ShoppingBag', order: 80 }
  });

  await prisma.subMenuItem.createMany({
    data: [
      { name: 'Customers', path: '/customers', icon: 'Users', order: 81, menuItemId: salesGroup.id, permissionId: dbPermissions['customers.read'] },
      { name: 'Quotes', path: '/quotes', icon: 'FileText', order: 82, menuItemId: salesGroup.id, permissionId: dbPermissions['quotes.read'] },
      { name: 'Sales Orders', path: '/sales-orders', icon: 'ClipboardList', order: 83, menuItemId: salesGroup.id, permissionId: dbPermissions['sales-orders.read'] },
      { name: 'Order Dispatch', path: '/order-dispatch', icon: 'Truck', order: 84, menuItemId: salesGroup.id, permissionId: dbPermissions['order-dispatches.read'] },
      { name: 'Outward', path: '/outward', icon: 'ArrowUpFromLine', order: 85, menuItemId: salesGroup.id, permissionId: dbPermissions['outward.read'] },
      { name: 'Payments Received', path: '/paymentsreceived', icon: 'CreditCard', order: 86, menuItemId: salesGroup.id, permissionId: dbPermissions['payments-received.read'] },
      { name: 'Customer Ledger', path: '/customer-ledger', icon: 'BarChart3', order: 87, menuItemId: salesGroup.id, permissionId: dbPermissions['customer-ledger.read'] }
    ]
  });

  // Section 100-130: Operations & Inventory & Reports
  await prisma.menuItem.createMany({
    data: [
      { name: 'Warehouse', path: '/locations', icon: 'MapPin', order: 100, permissionId: dbPermissions['locations.read'] },
      { name: 'Inventory', path: '/inventory', icon: 'Warehouse', order: 110, permissionId: dbPermissions['inventory.read'] },
      { name: 'Samples', path: '/samples', icon: 'FlaskConical', order: 120, permissionId: dbPermissions['samples.read'] },
      { name: 'Profit & Loss', path: '/profit-loss', icon: 'TrendingUp', order: 130, permissionId: dbPermissions['profit-loss.read'] }
    ]
  });

  // Section 200: System Settings & Configuration (Group)
  const settingsGroup = await prisma.menuItem.create({
    data: { name: 'System Settings', path: null, icon: 'Settings', order: 200 }
  });

  await prisma.subMenuItem.createMany({
    data: [
      { name: 'Roles', path: '/roles', icon: 'Shield', order: 201, menuItemId: settingsGroup.id, permissionId: dbPermissions['roles.read'] },
      { name: 'Users', path: '/users', icon: 'Users', order: 202, menuItemId: settingsGroup.id, permissionId: dbPermissions['users.read'] },
      { name: 'Menus', path: '/menus', icon: 'List', order: 203, menuItemId: settingsGroup.id, permissionId: dbPermissions['roles.update'] }
    ]
  });

  console.log('Dynamic Menu Items seeded successfully with production-level ordering.');
  console.log('Menu Order Sequence: 10, 20, 30, 40, 50, 60-65(Purchase), 70-79(Reserved), 80-87(Sales), 100, 110, 120, 130, 200-203(Settings)');
  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
