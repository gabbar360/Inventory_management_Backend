import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardKPIs {
  totalStockValue: number;
  totalRevenue: number;
  totalPurchase: number;
  grossProfit: number;
}

export interface StockSummary {
  productId: string;
  productName: string;
  categoryName: string;
  totalBoxes: number;
  totalPcs: number;
  totalValue: number;
  locations: {
    locationId: string;
    locationName: string;
    boxes: number;
    pcs: number;
    value: number;
  }[];
}

export interface ProfitLossReport {
  invoiceId: string;
  invoiceNo: string;
  date: string;
  type: 'inward' | 'outward';
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number;
}

export interface VendorLedger {
  vendorId: string;
  vendorName: string;
  totalPurchase: number;
  totalPaid: number;
  outstanding: number;
  transactions: {
    date: string;
    invoiceNo: string;
    amount: number;
    type: 'purchase' | 'payment';
  }[];
}