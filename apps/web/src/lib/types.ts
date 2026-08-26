export interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priceKes: number;
  stockQty: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  visible?: boolean;
}

export interface PublicConfig {
  businessName: string;
  businessTagline: string;
  ussdServiceCode: string;
  ownerPhone: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  qty: number;
  unitPriceKes: number;
  product?: { id?: string; name: string };
}

export interface Order {
  id: string;
  reference: string;
  status: string;
  channel: "USSD" | "WEB";
  totalKes: number;
  depositPaidKes: number;
  note?: string | null;
  createdAt: string;
  customer?: { phone: string; name?: string | null };
  items: OrderItem[];
}

export interface DocumentRow {
  id: string;
  filename: string;
  status: "PENDING" | "PROCESSED" | "FAILED";
  extracted: InvoiceData | null;
  error?: string | null;
  createdAt: string;
  sizeBytes?: number;
}

export interface InvoiceData {
  supplier: string;
  documentDate: string;
  currency: string;
  category: string;
  lineItems: { description: string; quantity: number; unitAmount: number }[];
  totalAmount: number;
  notes?: string;
}

export interface ReportRow {
  id: string;
  periodLabel: string;
  narrative: string;
  metrics: ReportMetrics;
  createdAt: string;
}

export interface ReportMetrics {
  revenueBookedKes: number;
  cashCollectedKes: number;
  ordersTotal: number;
  expenses: { totalKes: number; byCategory: Record<string, number> };
  stock: { skusTracked: number; inventoryValueKes: number; lowStockItems: { name: string; qty: number }[] };
  topProducts: { name: string; qtySold: number; revenueKes: number }[];
}
