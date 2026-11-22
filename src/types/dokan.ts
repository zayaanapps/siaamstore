import { Timestamp } from 'firebase/firestore';

export enum AppLanguage {
  BENGALI = 'BENGALI',
  ENGLISH = 'ENGLISH',
}

export enum AppThemeMode {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  SYSTEM = 'SYSTEM',
}

export enum VaultRole {
  ADMIN = 'ADMIN',
  ACCOUNT_MANAGER = 'ACCOUNT_MANAGER',
}

export function getVaultRoleLabel(role: VaultRole, isBn: boolean): string {
  if (role === VaultRole.ADMIN) {
    return isBn ? 'অ্যাডমিন' : 'Admin';
  }
  return isBn ? 'অ্যাকাউন্ট ম্যানেজার (বিক্রয়)' : 'Account Manager (Sales)';
}

export interface VaultUserAccount {
  name: string;
  email: string;
  password: string;
  role: VaultRole;
  addedBy: string;
  createdAtMillis: number;
  updatedAtMillis: number;
  pendingCloudSync: boolean;
  isLockedEmergencyAdmin: boolean;
}

export interface Product {
  id: string;
  userId: string;
  name: string;
  category: string;
  unit: 'kg' | 'gm' | 'pcs' | 'ltr' | 'box' | string;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  lowStockThreshold: number;
  barcode: string;
  quality?: string;
  note?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export function getProfitMarginPerUnit(product: Product): number {
  return Math.max(0, product.sellPrice - product.buyPrice);
}

export function getProfitMarginPercent(product: Product): number {
  return product.buyPrice > 0
    ? ((product.sellPrice - product.buyPrice) / product.buyPrice) * 100
    : 0;
}

export function isProductLowStock(product: Product): boolean {
  return product.stock <= product.lowStockThreshold;
}

export interface Customer {
  id: string;
  userId: string;
  name: string;
  phone: string;
  address: string;
  identityHint?: string;
  note?: string;
  totalDue: number;
  totalPurchased: number;
  totalPaid: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type TransactionType =
  | 'SALE'
  | 'GIVE_DUE'
  | 'RECEIVE_PAYMENT'
  | 'PURCHASE'
  | 'SUPPLIER_PAYMENT'
  | 'EXPENSE'
  | 'STOCK_ADJUST';

export interface StoreTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  title: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  profitAmount: number;
  customerId: string;
  customerName: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  category: string;
  notes: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Supplier {
  id: string;
  userId: string;
  name: string;
  phone: string;
  company: string;
  payableBalance: number;
  totalPurchased: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface StaffMember {
  id: string;
  userId: string;
  name: string;
  role: 'Owner' | 'Manager' | 'Cashier' | 'Salesman' | 'Inventory Clerk' | 'Helper / Delivery' | string;
  phone: string;
  salary: number;
  active: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ExpenseCategorySetting {
  id: string;
  labelEn: string;
  labelBn: string;
  colorKey: string;
}

export interface ExpensePresetSetting {
  id: string;
  titleEn: string;
  titleBn: string;
  category: string;
  defaultAmount?: number;
}

export interface StoreSettings {
  userId: string;
  productCategories: string[];
  productUnits: string[];
  productQualities: string[];
  expenseCategories: ExpenseCategorySetting[];
  expensePresets: ExpensePresetSetting[];
  startingCashBalance: number;
  language: AppLanguage;
  isDarkMode: boolean;
  updatedAt?: Timestamp | null;
}

export interface AuditLog {
  id: string;
  userId: string;
  actorName: string;
  action: string;
  module: string;
  createdAt?: Timestamp | null;
}

export interface RecycleBinItem {
  id: string;
  userId: string;
  itemType: 'PRODUCT' | 'CUSTOMER' | 'SUPPLIER' | 'EXPENSE' | 'TRANSACTION' | 'STAFF' | string;
  itemId: string;
  name: string;
  details: string;
  payloadJson: string;
  deletedBy: string;
  deletedAt?: Timestamp | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  customUnit: string;
  customUnitPrice: number;
}

export function getCartLineTotal(item: CartItem): number {
  return item.customUnitPrice * item.quantity;
}

export function getCartLineProfit(item: CartItem): number {
  return (item.customUnitPrice - item.product.buyPrice) * item.quantity;
}

export interface CustomerReceiptDetails {
  isWalkIn: boolean;
  name: string;
  address: string;
  phone: string;
}

export interface SaleLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export function formatQty(val: number): string {
  return val % 1 === 0 ? val.toFixed(0) : val.toFixed(2);
}

export function encodeItemsAndNote(
  cartItems: CartItem[],
  userNote: string,
  customerPhone: string = '',
  customerAddress: string = ''
): string {
  const encodedItems = cartItems
    .map((item) => {
      const cleanName = item.product.name.replace(/[|;]/g, ' ').slice(0, 36);
      const qtyStr = formatQty(item.quantity);
      const priceStr = formatQty(item.customUnitPrice);
      const totalStr = formatQty(getCartLineTotal(item));
      return `${item.product.id}|${cleanName}|${qtyStr}|${item.customUnit}|${priceStr}|${totalStr}`;
    })
    .join(';');

  const cleanNote = userNote.trim().replace(/\|\|/g, ' ');
  const cleanPhone = customerPhone.trim().replace(/[|;]/g, ' ').slice(0, 24);
  const cleanAddress = customerAddress.trim().replace(/[|;]/g, ' ').slice(0, 60);

  const custSuffix =
    cleanPhone.length > 0 || cleanAddress.length > 0
      ? `||CUST:${cleanPhone}|${cleanAddress}`
      : '';
  const noteSuffix = cleanNote.length > 0 ? `||NOTE:${cleanNote}` : '';
  return `ITEMS:${encodedItems}${custSuffix}${noteSuffix}`.slice(0, 300);
}

export function parseLineItems(tx: StoreTransaction): SaleLineItem[] {
  const raw = tx.notes || '';
  if (raw.startsWith('ITEMS:')) {
    const itemsPart = raw
      .slice('ITEMS:'.length)
      .split('||CUST:')[0]
      .split('||NOTE:')[0];
    const parsed: SaleLineItem[] = [];
    for (const entry of itemsPart.split(';')) {
      const parts = entry.split('|');
      if (parts.length >= 6) {
        parsed.push({
          productId: parts[0],
          productName: parts[1],
          quantity: parseFloat(parts[2]) || 1,
          unit: parts[3] || 'kg',
          unitPrice: parseFloat(parts[4]) || tx.amount,
          lineTotal: parseFloat(parts[5]) || tx.amount,
        });
      }
    }
    if (parsed.length > 0) return parsed;
  }
  const fallbackName = (tx.title.split(' x')[0] || '').trim() || 'Item';
  return [
    {
      productId: tx.productId,
      productName: fallbackName,
      quantity: 1,
      unit: 'kg',
      unitPrice: tx.amount,
      lineTotal: tx.amount,
    },
  ];
}

export function parseUserNote(tx: StoreTransaction): string {
  const raw = tx.notes || '';
  if (raw.includes('||NOTE:')) {
    return raw.split('||NOTE:')[1]?.trim() || '';
  }
  if (raw.startsWith('ITEMS:')) {
    return '';
  }
  return raw;
}

export function resolveCustomerDetails(
  tx: StoreTransaction,
  customers: Customer[]
): CustomerReceiptDetails {
  const rawName = (tx.customerName || '').trim();
  const lower = rawName.toLowerCase();
  const isWalkInName =
    !rawName ||
    lower === 'walk-in (no name)' ||
    lower === 'walk-in customer' ||
    rawName === 'সাধারণ ক্রেতা';

  if (isWalkInName && !tx.customerId) {
    return {
      isWalkIn: true,
      name: 'Walk-in customer',
      address: '',
      phone: '',
    };
  }

  const matchedCustomer = customers.find(
    (cust) =>
      (tx.customerId && cust.id === tx.customerId) ||
      (!isWalkInName && cust.name.toLowerCase() === lower)
  );

  let encodedPhone = '';
  let encodedAddress = '';
  if ((tx.notes || '').includes('||CUST:')) {
    const custSegment = tx.notes.split('||CUST:')[1]?.split('||NOTE:')[0] || '';
    const parts = custSegment.split('|');
    encodedPhone = (parts[0] || '').trim();
    encodedAddress = (parts[1] || '').trim();
  }

  return {
    isWalkIn: false,
    name: matchedCustomer?.name || (!isWalkInName ? rawName : '') || 'Walk-in customer',
    address: matchedCustomer?.address || encodedAddress,
    phone: matchedCustomer?.phone || encodedPhone,
  };
}

export enum CustomerDueFilter {
  ALL = 'ALL',
  HAS_DUES = 'HAS_DUES',
  NO_DUES = 'NO_DUES',
}

export interface DailyStats {
  todaysSale: number;
  todaysSaleCount: number;
  todaysProfit: number;
  todaysGivenDue: number;
  todaysGivenDueCustomerCount: number;
  todaysReceivedMoney: number;
  totalCashIn: number;
  totalCashOut: number;
}

export function calculateDailyStats(transactions: StoreTransaction[]): DailyStats {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  ).getTime();

  let todaysSale = 0;
  let todaysSaleCount = 0;
  let todaysProfit = 0;
  let todaysGivenDue = 0;
  let todaysReceivedMoney = 0;
  let totalCashIn = 0;
  let totalCashOut = 0;
  const todaysGivenDueCustomers = new Set<string>();

  for (const tx of transactions) {
    const txMillis = tx.createdAt ? tx.createdAt.toMillis() : Date.now();
    const isToday = txMillis >= startOfToday;

    switch (tx.type) {
      case 'SALE':
        totalCashIn += tx.paidAmount;
        if (isToday) {
          todaysSale += tx.amount;
          todaysSaleCount += 1;
          todaysProfit += tx.profitAmount;
          todaysGivenDue += tx.dueAmount;
          todaysReceivedMoney += tx.paidAmount;
          if (tx.dueAmount > 0) {
            const custKey = (tx.customerId || tx.customerName || tx.id)
              .trim()
              .toLowerCase();
            if (custKey) todaysGivenDueCustomers.add(custKey);
          }
        }
        break;
      case 'GIVE_DUE':
        if (isToday) {
          const dueAmt = Math.max(tx.dueAmount, tx.amount);
          todaysGivenDue += dueAmt;
          if (dueAmt > 0) {
            const custKey = (tx.customerId || tx.customerName || tx.id)
              .trim()
              .toLowerCase();
            if (custKey) todaysGivenDueCustomers.add(custKey);
          }
        }
        break;
      case 'RECEIVE_PAYMENT':
        totalCashIn += Math.max(tx.paidAmount, tx.amount);
        if (isToday) {
          todaysReceivedMoney += Math.max(tx.paidAmount, tx.amount);
        }
        break;
      case 'PURCHASE':
        totalCashOut += tx.paidAmount;
        break;
      case 'SUPPLIER_PAYMENT':
        totalCashOut += Math.max(tx.paidAmount, tx.amount);
        break;
      case 'EXPENSE':
        totalCashOut += Math.max(tx.paidAmount, tx.amount);
        break;
    }
  }

  return {
    todaysSale,
    todaysSaleCount,
    todaysProfit,
    todaysGivenDue,
    todaysGivenDueCustomerCount: todaysGivenDueCustomers.size,
    todaysReceivedMoney,
    totalCashIn,
    totalCashOut,
  };
}

export function formatMoney(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (safe % 1 === 0) {
    return safe.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function toBengaliDigits(input: string | number, language: AppLanguage): string {
  const str = String(input);
  if (language !== AppLanguage.BENGALI) return str;
  const map = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.replace(/[0-9]/g, (d) => map[parseInt(d, 10)] || d);
}

export function formatTimestamp(ts?: Timestamp | null, includeTime = true): string {
  if (!ts) return 'Just now';
  const date = ts.toDate();
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

export enum MainNavTab {
  HOME = 'home',
  SALES = 'sales',
  PRODUCTS = 'products',
  CUSTOMERS = 'customers',
  MORE = 'more',
}

export enum MoreSubScreen {
  MENU = 'MENU',
  PURCHASE_TRACKER = 'PURCHASE_TRACKER',
  SUPPLIER_LEDGER = 'SUPPLIER_LEDGER',
  EXPENSE_TRACKING = 'EXPENSE_TRACKING',
  CASH_BOOK = 'CASH_BOOK',
  BUSINESS_REPORTS = 'BUSINESS_REPORTS',
  DUE_REPORTS = 'DUE_REPORTS',
  BACKUP_RESTORE = 'BACKUP_RESTORE',
  TRANSACTION_DELETION = 'TRANSACTION_DELETION',
  RECYCLE_BIN = 'RECYCLE_BIN',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  STAFF_ROLES = 'STAFF_ROLES',
  AUDIT_LOG = 'AUDIT_LOG',
}
