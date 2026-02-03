const { z } = require('zod');

// Auth schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// Category schemas
const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  hsnCode: z.string().min(1, 'HSN code is required'),
  gstRate: z.number().min(0).max(100, 'GST rate must be between 0 and 100'),
});

// Product schemas
const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  grade: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
});

// Vendor schemas
const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// Customer schemas
const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// Location schemas
const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  address: z.string().optional(),
});

// Inward schemas
const inwardItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  boxes: z.number().min(1, 'Boxes must be at least 1'),
  packPerBox: z.number().min(1, 'Pack per box must be at least 1'),
  packPerPiece: z.number().min(1, 'Pack per piece must be at least 1'),
  ratePerBox: z.number().min(0, 'Rate per box must be positive'),
});

const inwardInvoiceSchema = z.object({
  invoiceNo: z.string().min(1, 'Invoice number is required'),
  date: z.string().min(1, 'Date is required'),
  vendorId: z.string().min(1, 'Vendor is required'),
  locationId: z.string().min(1, 'Location is required'),
  items: z.array(inwardItemSchema).min(1, 'At least one item is required'),
});

// Outward schemas
const outwardItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  stockBatchId: z.string().min(1, 'Stock batch is required'),
  saleUnit: z.enum(['box', 'pack', 'piece'], { required_error: 'Sale unit is required' }),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  ratePerUnit: z.number().min(0, 'Rate per unit must be positive'),
});

const outwardInvoiceSchema = z.object({
  invoiceNo: z.string().min(1, 'Invoice number is required'),
  date: z.string().min(1, 'Date is required'),
  customerId: z.string().min(1, 'Customer is required'),
  locationId: z.string().min(1, 'Location is required'),
  saleType: z.enum(['export', 'domestic'], { required_error: 'Sale type is required' }),
  expense: z.number().min(0, 'Expense must be positive').default(0),
  items: z.array(outwardItemSchema).min(1, 'At least one item is required'),
});

module.exports = {
  registerSchema,
  loginSchema,
  categorySchema,
  productSchema,
  vendorSchema,
  customerSchema,
  locationSchema,
  inwardItemSchema,
  inwardInvoiceSchema,
  outwardItemSchema,
  outwardInvoiceSchema
};