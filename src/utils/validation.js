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
  sku: z.string().min(1, 'SKU number is required'),
  grade: z.string().optional(),
  categoryId: z.union([z.string(), z.number()]).transform(val => String(val)),
});

// Vendor schemas
const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  companyName: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  companyName: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  gstNumber: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

// Location schemas
const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  address: z.string().optional(),
});

// Sample schemas
const sampleItemSchema = z.object({
  productId: z.union([z.string(), z.number()]).transform(val => String(val)),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit: z.enum(['box', 'pack', 'piece'], { required_error: 'Unit is required' }),
});

const sampleSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  sentBy: z.string().min(1, 'Employee name is required'),
  sampleType: z.enum(['domestic', 'export'], { required_error: 'Sample type is required' }),
  kitPrice: z.number().min(0, 'Kit price must be positive'),
  trackingNumber: z.string().optional(),
  dispatchMethod: z.string().min(1, 'Dispatch method is required'),
  sentDate: z.string().min(1, 'Sent date is required'),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  remarks: z.string().optional(),
  items: z.array(sampleItemSchema).optional(),
});

const websiteSampleSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email('Invalid email'),
  customerPhone: z.string().min(1, 'Phone is required'),
  customerAddress: z.string().min(1, 'Address is required'),
  state: z.string().min(1, 'State is required'),
  userType: z.enum(['company', 'customer']),
  gstNumber: z.string().optional().nullable(),
  panNumber: z.string().optional().nullable(),
  products: z.string().optional().nullable(),
  paymentId: z.string().min(1, 'Payment ID is required'),
  orderId: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  subtotal: z.number().optional(),
  tax: z.number().optional(),
  kitPrice: z.number().min(0),
});

// Inward schemas
const inwardItemSchema = z.object({
  productId: z.union([z.string(), z.number()]).transform(val => String(val)),
  boxes: z.number().min(1, 'Boxes must be at least 1'),
  packPerBox: z.number().min(1, 'Pack per box must be at least 1'),
  packPerPiece: z.number().min(1, 'Pack per piece must be at least 1'),
  ratePerBox: z.number().min(0, 'Rate per box must be positive'),
});

const inwardInvoiceSchema = z.object({
  invoiceNo: z.string().min(1, 'Invoice number is required'),
  date: z.string().min(1, 'Date is required'),
  vendorId: z.union([z.string(), z.number()]).transform(val => String(val)),
  locationId: z.union([z.string(), z.number()]).transform(val => String(val)),
  items: z.array(inwardItemSchema).min(1, 'At least one item is required'),
});

// Outward schemas
const outwardItemSchema = z.object({
  productId: z.union([z.string(), z.number()]).transform(val => String(val)),
  stockBatchId: z.union([z.string(), z.number()]).transform(val => String(val)),
  locationId: z.union([z.string(), z.number()]).transform(val => String(val)),
  saleUnit: z.enum(['box', 'pack', 'piece'], { required_error: 'Sale unit is required' }),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  ratePerUnit: z.number().min(0, 'Rate per unit must be positive'),
});

const outwardInvoiceSchema = z.object({
  invoiceNo: z.string().min(1, 'Invoice number is required'),
  date: z.string().min(1, 'Date is required'),
  customerId: z.union([z.string(), z.number()]).transform(val => String(val)),
  saleType: z.enum(['export', 'domestic'], { required_error: 'Sale type is required' }),
  expense: z.number().min(0, 'Expense must be positive').default(0),
  items: z.array(outwardItemSchema).min(1, 'At least one item is required'),
});

const paymentReceivedSchema = z.object({
  paymentNumber: z.string().min(1, 'Payment number is required'),
  customerId: z.union([z.string(), z.number()]).transform(val => String(val)),
  amount: z.number().min(0, 'Amount must be positive'),
  date: z.string().min(1, 'Date is required'),
  paymentMode: z.string().min(1, 'Payment mode is required'),
  referenceNumber: z.string().optional().nullable(),
  depositTo: z.string().min(1, 'Deposit to account is required'),
  bankCharges: z.number().min(0).optional().default(0),
  taxRate: z.number().min(0).optional().default(0),
  notes: z.string().optional().nullable(),
  transactionType: z.enum(['invoice_payment', 'customer_advance']).optional().default('invoice_payment'),
  invoices: z.array(z.object({
    invoiceId: z.union([z.string(), z.number()]).transform(val => Number(val)),
    amountApplied: z.number().min(0)
  })).optional().default([])
});

const paymentMadeSchema = z.object({
  paymentNumber: z.string().min(1, 'Payment number is required'),
  vendorId: z.union([z.string(), z.number()]).transform(val => String(val)),
  amount: z.number().min(0, 'Amount must be positive'),
  date: z.string().min(1, 'Date is required'),
  paymentMode: z.string().min(1, 'Payment mode is required'),
  referenceNumber: z.string().optional().nullable(),
  paidThrough: z.string().min(1, 'Paid through account is required'),
  bankCharges: z.number().min(0).optional().default(0),
  notes: z.string().optional().nullable(),
  transactionType: z.enum(['bill_payment', 'vendor_advance']).optional().default('bill_payment'),
  invoices: z.array(z.object({
    invoiceId: z.union([z.string(), z.number()]).transform(val => Number(val)),
    amountApplied: z.number().min(0)
  })).optional().default([])
});

module.exports = {
  registerSchema,
  loginSchema,
  categorySchema,
  productSchema,
  vendorSchema,
  customerSchema,
  locationSchema,
  sampleSchema,
  websiteSampleSchema,
  inwardItemSchema,
  inwardInvoiceSchema,
  outwardItemSchema,
  outwardInvoiceSchema,
  paymentReceivedSchema,
  paymentMadeSchema
};