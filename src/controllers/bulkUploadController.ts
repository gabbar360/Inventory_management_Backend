import { Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { sendResponse, sendError } from '../utils/response';
import { categorySchema, productSchema, vendorSchema, customerSchema, locationSchema } from '../utils/validation';

const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
    }
  },
});

export const uploadMiddleware = upload.single('file');

export class BulkUploadController {
  static async uploadCategories(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const results = {
        success: 0,
        failed: 0,
        errors: [] as any[],
      };

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i] as any;
          const categoryData = {
            name: row.name || row.Name || row.NAME,
            hsnCode: row.hsnCode || row.HSNCode || row.hsn_code,
            gstRate: parseFloat(row.gstRate || row.GSTRate || row.gst_rate),
          };

          categorySchema.parse(categoryData);

          // Check for duplicates
          const existing = await prisma.category.findFirst({
            where: {
              OR: [
                { name: categoryData.name },
                { hsnCode: categoryData.hsnCode },
              ],
            },
          });

          if (existing) {
            throw new Error(`Category with name '${categoryData.name}' or HSN code '${categoryData.hsnCode}' already exists`);
          }

          await prisma.category.create({
            data: categoryData,
          });

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: error.message,
            data: data[i],
          });
        }
      }

      return sendResponse(res, 200, true, results, 'Bulk upload completed');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async uploadProducts(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const results = {
        success: 0,
        failed: 0,
        errors: [] as any[],
      };

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i] as any;
          
          // Find category by name
          const categoryName = row.categoryName || row.CategoryName || row.category_name;
          const category = await prisma.category.findFirst({
            where: { name: { contains: categoryName, mode: 'insensitive' } },
          });

          if (!category) {
            throw new Error(`Category '${categoryName}' not found`);
          }

          const productData = {
            name: row.name || row.Name || row.NAME,
            grade: row.grade || row.Grade || row.GRADE || '',
            categoryId: category.id,
          };

          productSchema.parse(productData);

          // Check for duplicates
          const existing = await prisma.product.findFirst({
            where: {
              name: productData.name,
              grade: productData.grade,
            },
          });

          if (existing) {
            throw new Error(`Product '${productData.name}' with grade '${productData.grade}' already exists`);
          }

          await prisma.product.create({
            data: productData,
          });

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: error.message,
            data: data[i],
          });
        }
      }

      return sendResponse(res, 200, true, results, 'Bulk upload completed');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async uploadVendors(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const results = {
        success: 0,
        failed: 0,
        errors: [] as any[],
      };

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i] as any;
          
          // Generate vendor code
          const lastVendor = await prisma.vendor.findFirst({
            orderBy: { code: 'desc' },
            select: { code: true },
          });

          const generateCode = (prefix: string, lastCode?: string): string => {
            if (!lastCode) return `${prefix}001`;
            const number = parseInt(lastCode.replace(prefix, ''));
            return `${prefix}${(number + 1).toString().padStart(3, '0')}`;
          };

          const vendorData = {
            name: row.name || row.Name || row.NAME,
            code: generateCode('VGR', lastVendor?.code),
            email: row.email || row.Email || row.EMAIL || '',
            phone: String(row.phone || row.Phone || row.PHONE || ''),
            address: row.address || row.Address || row.ADDRESS || '',
          };

          vendorSchema.parse(vendorData);

          // Check for duplicates
          const existing = await prisma.vendor.findFirst({
            where: {
              OR: [
                { name: vendorData.name },
                { email: vendorData.email && vendorData.email !== '' ? vendorData.email : undefined },
              ].filter(Boolean),
            },
          });

          if (existing) {
            throw new Error(`Vendor with name '${vendorData.name}' or email '${vendorData.email}' already exists`);
          }

          await prisma.vendor.create({
            data: vendorData,
          });

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: error.message,
            data: data[i],
          });
        }
      }

      return sendResponse(res, 200, true, results, 'Bulk upload completed');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async uploadCustomers(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const results = {
        success: 0,
        failed: 0,
        errors: [] as any[],
      };

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i] as any;
          
          // Generate customer code
          const lastCustomer = await prisma.customer.findFirst({
            orderBy: { code: 'desc' },
            select: { code: true },
          });

          const generateCode = (prefix: string, lastCode?: string): string => {
            if (!lastCode) return `${prefix}001`;
            const number = parseInt(lastCode.replace(prefix, ''));
            return `${prefix}${(number + 1).toString().padStart(3, '0')}`;
          };

          const customerData = {
            name: row.name || row.Name || row.NAME,
            code: generateCode('CUS', lastCustomer?.code),
            email: row.email || row.Email || row.EMAIL || '',
            phone: String(row.phone || row.Phone || row.PHONE || ''),
            address: row.address || row.Address || row.ADDRESS || '',
          };

          // Check for duplicates
          const existing = await prisma.customer.findFirst({
            where: {
              OR: [
                { name: customerData.name },
                { email: customerData.email && customerData.email !== '' ? customerData.email : undefined },
              ].filter(Boolean),
            },
          });

          if (existing) {
            throw new Error(`Customer with name '${customerData.name}' or email '${customerData.email}' already exists`);
          }

          await prisma.customer.create({
            data: customerData,
          });

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: error.message,
            data: data[i],
          });
        }
      }

      return sendResponse(res, 200, true, results, 'Bulk upload completed');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async uploadLocations(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const results = {
        success: 0,
        failed: 0,
        errors: [] as any[],
      };

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i] as any;
          
          const locationData = {
            name: row.name || row.Name || row.NAME,
            address: row.address || row.Address || row.ADDRESS || '',
          };

          locationSchema.parse(locationData);

          // Check for duplicates
          const existing = await prisma.location.findFirst({
            where: { name: locationData.name },
          });

          if (existing) {
            throw new Error(`Location with name '${locationData.name}' already exists`);
          }

          await prisma.location.create({
            data: locationData,
          });

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: error.message,
            data: data[i],
          });
        }
      }

      return sendResponse(res, 200, true, results, 'Bulk upload completed');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async uploadInward(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const results = {
        success: 0,
        failed: 0,
        errors: [] as any[],
      };

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i] as any;
          
          // Find vendor by name
          const vendorName = row.vendorName || row.VendorName || row.vendor_name;
          const vendor = await prisma.vendor.findFirst({
            where: { name: { contains: vendorName, mode: 'insensitive' } },
          });
          if (!vendor) throw new Error(`Vendor '${vendorName}' not found`);

          // Find location by name
          const locationName = row.locationName || row.LocationName || row.location_name;
          const location = await prisma.location.findFirst({
            where: { name: { contains: locationName, mode: 'insensitive' } },
          });
          if (!location) throw new Error(`Location '${locationName}' not found`);

          // Find product by name
          const productName = row.productName || row.ProductName || row.product_name;
          const product = await prisma.product.findFirst({
            where: { name: { contains: productName, mode: 'insensitive' } },
            include: { category: true },
          });
          if (!product) throw new Error(`Product '${productName}' not found`);

          const invoiceNo = row.invoiceNo || row.InvoiceNo || row.invoice_no;
          const date = new Date(row.date || row.Date || row.DATE);
          const boxes = parseInt(row.boxes || row.Boxes || row.BOXES);
          const pcsPerBox = parseInt(row.pcsPerBox || row.PcsPerBox || row.pcs_per_box);
          const ratePerBox = parseFloat(row.ratePerBox || row.RatePerBox || row.rate_per_box);

          if (!invoiceNo || !boxes || !pcsPerBox || !ratePerBox) {
            throw new Error('Missing required fields: invoiceNo, boxes, pcsPerBox, ratePerBox');
          }

          const totalPcs = boxes * pcsPerBox;
          const ratePerPcs = ratePerBox / pcsPerBox;
          const baseAmount = boxes * ratePerBox;
          const gstAmount = (baseAmount * (product.category?.gstRate || 0)) / 100;
          const totalCost = baseAmount + gstAmount;

          // Create or find invoice
          let invoice = await prisma.inwardInvoice.findFirst({
            where: { invoiceNo },
          });

          if (!invoice) {
            invoice = await prisma.inwardInvoice.create({
              data: {
                invoiceNo,
                date,
                vendorId: vendor.id,
                locationId: location.id,
                totalCost: 0, // Will be updated after adding items
              },
            });
          }

          // Create inward item
          await prisma.inwardItem.create({
            data: {
              inwardInvoiceId: invoice.id,
              productId: product.id,
              boxes,
              pcsPerBox,
              totalPcs,
              ratePerBox,
              ratePerPcs,
              gstAmount,
              totalCost,
            },
          });

          // Create stock batch
          await prisma.stockBatch.create({
            data: {
              productId: product.id,
              vendorId: vendor.id,
              locationId: location.id,
              inwardDate: date,
              boxes,
              pcsPerBox,
              totalPcs,
              remainingBoxes: boxes,
              remainingPcs: totalPcs,
              costPerBox: ratePerBox,
              costPerPcs: ratePerPcs,
            },
          });

          // Update invoice total
          const invoiceTotal = await prisma.inwardItem.aggregate({
            where: { inwardInvoiceId: invoice.id },
            _sum: { totalCost: true },
          });

          await prisma.inwardInvoice.update({
            where: { id: invoice.id },
            data: { totalCost: invoiceTotal._sum.totalCost || 0 },
          });

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: error.message,
            data: data[i],
          });
        }
      }

      return sendResponse(res, 200, true, results, 'Bulk upload completed');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async uploadOutward(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const results = {
        success: 0,
        failed: 0,
        errors: [] as any[],
      };

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i] as any;
          
          // Find customer by name
          const customerName = row.customerName || row.CustomerName || row.customer_name;
          const customer = await prisma.customer.findFirst({
            where: { name: { contains: customerName, mode: 'insensitive' } },
          });
          if (!customer) throw new Error(`Customer '${customerName}' not found`);

          // Find location by name
          const locationName = row.locationName || row.LocationName || row.location_name;
          const location = await prisma.location.findFirst({
            where: { name: { contains: locationName, mode: 'insensitive' } },
          });
          if (!location) throw new Error(`Location '${locationName}' not found`);

          // Find product by name
          const productName = row.productName || row.ProductName || row.product_name;
          const product = await prisma.product.findFirst({
            where: { name: { contains: productName, mode: 'insensitive' } },
          });
          if (!product) throw new Error(`Product '${productName}' not found`);

          // Find available stock batch (FIFO)
          const stockBatch = await prisma.stockBatch.findFirst({
            where: {
              productId: product.id,
              locationId: location.id,
              OR: [
                { remainingBoxes: { gt: 0 } },
                { remainingPcs: { gt: 0 } },
              ],
            },
            orderBy: { inwardDate: 'asc' },
          });
          if (!stockBatch) throw new Error(`No stock available for product '${productName}' at location '${locationName}'`);

          const invoiceNo = row.invoiceNo || row.InvoiceNo || row.invoice_no;
          const date = new Date(row.date || row.Date || row.DATE);
          const saleUnit = (row.saleUnit || row.SaleUnit || row.sale_unit || 'box').toLowerCase();
          const quantity = parseInt(row.quantity || row.Quantity || row.QUANTITY);
          const ratePerUnit = parseFloat(row.ratePerUnit || row.RatePerUnit || row.rate_per_unit);
          const saleType = (row.saleType || row.SaleType || row.sale_type || 'domestic').toLowerCase();

          if (!invoiceNo || !quantity || !ratePerUnit) {
            throw new Error('Missing required fields: invoiceNo, quantity, ratePerUnit');
          }

          // Validate stock availability
          const availableQuantity = saleUnit === 'box' ? stockBatch.remainingBoxes : stockBatch.remainingPcs;
          if (quantity > availableQuantity) {
            throw new Error(`Insufficient stock. Available: ${availableQuantity}, Required: ${quantity}`);
          }

          const totalCost = quantity * ratePerUnit;

          // Create or find invoice
          let invoice = await prisma.outwardInvoice.findFirst({
            where: { invoiceNo },
          });

          if (!invoice) {
            invoice = await prisma.outwardInvoice.create({
              data: {
                invoiceNo,
                date,
                customerId: customer.id,
                locationId: location.id,
                saleType: saleType as 'export' | 'domestic',
                expense: 0,
                totalCost: 0, // Will be updated after adding items
              },
            });
          }

          // Create outward item
          await prisma.outwardItem.create({
            data: {
              outwardInvoiceId: invoice.id,
              productId: product.id,
              stockBatchId: stockBatch.id,
              saleUnit: saleUnit as 'box' | 'piece',
              quantity,
              ratePerUnit,
              totalCost,
            },
          });

          // Update stock batch
          let updatedRemainingBoxes = stockBatch.remainingBoxes;
          let updatedRemainingPcs = stockBatch.remainingPcs;

          if (saleUnit === 'box') {
            updatedRemainingBoxes -= quantity;
            updatedRemainingPcs -= quantity * stockBatch.pcsPerBox;
          } else {
            updatedRemainingPcs -= quantity;
            const boxesToDeduct = Math.floor(quantity / stockBatch.pcsPerBox);
            updatedRemainingBoxes -= boxesToDeduct;
          }

          await prisma.stockBatch.update({
            where: { id: stockBatch.id },
            data: {
              remainingBoxes: Math.max(0, updatedRemainingBoxes),
              remainingPcs: Math.max(0, updatedRemainingPcs),
            },
          });

          // Update invoice total
          const invoiceTotal = await prisma.outwardItem.aggregate({
            where: { outwardInvoiceId: invoice.id },
            _sum: { totalCost: true },
          });

          await prisma.outwardInvoice.update({
            where: { id: invoice.id },
            data: { totalCost: invoiceTotal._sum.totalCost || 0 },
          });

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: error.message,
            data: data[i],
          });
        }
      }

      return sendResponse(res, 200, true, results, 'Bulk upload completed');
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async downloadTemplate(req: Request, res: Response) {
    try {
      const { type } = req.params;
      
      let templateData: any[] = [];
      let filename = '';

      switch (type) {
        case 'categories':
          templateData = [
            { name: 'Electronics', hsnCode: '85171200', gstRate: 18 },
            { name: 'Textiles', hsnCode: '52081200', gstRate: 12 },
          ];
          filename = 'categories_template.xlsx';
          break;
        
        case 'products':
          templateData = [
            { name: 'Product 1', grade: 'A', categoryName: 'Electronics' },
            { name: 'Product 2', grade: 'B', categoryName: 'Textiles' },
          ];
          filename = 'products_template.xlsx';
          break;
        
        case 'vendors':
          templateData = [
            { name: 'Vendor 1', email: 'vendor1@example.com', phone: '1234567890', address: 'Address 1' },
            { name: 'Vendor 2', email: 'vendor2@example.com', phone: '1234567891', address: 'Address 2' },
          ];
          filename = 'vendors_template.xlsx';
          break;
        
        case 'customers':
          templateData = [
            { name: 'Customer 1', email: 'customer1@example.com', phone: '1234567890', address: 'Address 1' },
            { name: 'Customer 2', email: 'customer2@example.com', phone: '1234567891', address: 'Address 2' },
          ];
          filename = 'customers_template.xlsx';
          break;
        
        case 'locations':
          templateData = [
            { name: 'Main Warehouse', address: 'Industrial Area, City' },
            { name: 'Secondary Warehouse', address: 'Commercial Zone, City' },
          ];
          filename = 'locations_template.xlsx';
          break;
        
        case 'inward':
          templateData = [
            { invoiceNo: 'INW001', date: '2024-01-15', vendorName: 'Vendor 1', locationName: 'Main Warehouse', productName: 'Product 1', boxes: 10, pcsPerBox: 5, ratePerBox: 1000 },
          ];
          filename = 'inward_template.xlsx';
          break;
        
        case 'outward':
          templateData = [
            { invoiceNo: 'OUT001', date: '2024-01-15', customerName: 'Customer 1', locationName: 'Main Warehouse', productName: 'Product 1', saleUnit: 'box', quantity: 2, ratePerUnit: 1200 },
          ];
          filename = 'outward_template.xlsx';
          break;
        
        default:
          return sendError(res, 400, 'Invalid template type');
      }

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      return res.send(buffer);
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }

  static async exportData(req: Request, res: Response) {
    try {
      const { type } = req.params;
      
      let data: any[] = [];
      let filename = '';

      switch (type) {
        case 'categories':
          data = await prisma.category.findMany({
            select: { name: true, hsnCode: true, gstRate: true, createdAt: true },
          });
          filename = `categories_export_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        
        case 'products':
          data = await prisma.product.findMany({
            include: { category: { select: { name: true } } },
          });
          data = data.map(p => ({
            name: p.name,
            grade: p.grade,
            categoryName: p.category?.name,
            createdAt: p.createdAt,
          }));
          filename = `products_export_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        
        case 'vendors':
          data = await prisma.vendor.findMany({
            select: { code: true, name: true, email: true, phone: true, address: true, createdAt: true },
          });
          filename = `vendors_export_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        
        case 'customers':
          data = await prisma.customer.findMany({
            select: { code: true, name: true, email: true, phone: true, address: true, createdAt: true },
          });
          filename = `customers_export_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        
        case 'locations':
          data = await prisma.location.findMany({
            select: { name: true, address: true, createdAt: true },
          });
          filename = `locations_export_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        
        case 'inward':
          data = await prisma.inwardInvoice.findMany({
            include: {
              vendor: { select: { name: true, code: true } },
              location: { select: { name: true } },
              items: {
                include: {
                  product: { select: { name: true, grade: true } },
                },
              },
            },
          });
          const inwardFlat = data.flatMap(invoice => 
            invoice.items.map(item => ({
              invoiceNo: invoice.invoiceNo,
              date: invoice.date,
              vendorCode: invoice.vendor?.code,
              vendorName: invoice.vendor?.name,
              locationName: invoice.location?.name,
              productName: item.product?.name,
              productGrade: item.product?.grade,
              boxes: item.boxes,
              pcsPerBox: item.pcsPerBox,
              totalPcs: item.totalPcs,
              ratePerBox: item.ratePerBox,
              ratePerPcs: item.ratePerPcs,
              gstAmount: item.gstAmount,
              totalCost: item.totalCost,
            }))
          );
          data = inwardFlat;
          filename = `inward_export_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        
        case 'outward':
          data = await prisma.outwardInvoice.findMany({
            include: {
              customer: { select: { name: true, code: true } },
              location: { select: { name: true } },
              items: {
                include: {
                  product: { select: { name: true, grade: true } },
                },
              },
            },
          });
          const outwardFlat = data.flatMap(invoice => 
            invoice.items.map(item => ({
              invoiceNo: invoice.invoiceNo,
              date: invoice.date,
              customerCode: invoice.customer?.code,
              customerName: invoice.customer?.name,
              locationName: invoice.location?.name,
              saleType: invoice.saleType,
              productName: item.product?.name,
              productGrade: item.product?.grade,
              saleUnit: item.saleUnit,
              quantity: item.quantity,
              ratePerUnit: item.ratePerUnit,
              totalCost: item.totalCost,
            }))
          );
          data = outwardFlat;
          filename = `outward_export_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        
        default:
          return sendError(res, 400, 'Invalid export type');
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      return res.send(buffer);
    } catch (error: any) {
      return sendError(res, 500, error.message);
    }
  }
}