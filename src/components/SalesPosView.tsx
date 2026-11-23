import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Printer,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  UserPlus,
  User,
  Clock,
  CreditCard,
  Banknote,
  Package,
  FileText,
  X,
  Tag,
  Sparkles,
  Flame,
  LayoutGrid,
  List,
  ArrowRight,
  Check,
  ScanBarcode,
  Filter,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import {
  AppLanguage,
  Product,
  Customer,
  StoreTransaction,
  CartItem,
  SaleLineItem,
  parseLineItems,
  parseUserNote,
  resolveCustomerDetails,
  formatMoney,
  toBengaliDigits,
  formatTimestamp,
  getCartLineTotal,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';

type SalesSubScreen =
  | 'OVERVIEW'
  | 'NEW_SALE'
  | 'SALE_COMPLETE'
  | 'SALE_DETAIL'
  | 'RECEIPT';

type PaymentMode = 'FULL_CASH' | 'FULL_CREDIT' | 'PART_CREDIT';
type PosWorkspaceView = 'PRODUCTS' | 'CART' | 'SPLIT';
type QuickProductFilter = 'ALL' | 'IN_CART' | 'TOP_SOLD' | 'IN_STOCK';
type OverviewTimeFilter =
  | 'TODAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'THIS_YEAR'
  | 'ALL';

interface CompletedSaleSummary {
  transactionId: string;
  totalAmount: number;
  discountAmount: number;
  cashPaid: number;
  creditDue: number;
  paymentMode: PaymentMode;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
  lineItems: SaleLineItem[];
  timestampStr: string;
}

interface SalesPosViewProps {
  products: Product[];
  customers: Customer[];
  transactions: StoreTransaction[];
  cart: CartItem[];
  selectedCustomerId: string;
  discountInput: string;
  strings: DokanTranslations;
  language: AppLanguage;
  onAddToCart: (product: Product) => void;
  onUpdateQty: (productId: string, quantity: number) => void;
  onUpdateUnit: (productId: string, unit: string) => void;
  onUpdateUnitPrice: (productId: string, customPrice: number) => void;
  onClearCart: () => void;
  onSelectCustomer: (customerId: string) => void;
  onDiscountChange: (discount: string) => void;
  onCheckout: (
    cashPaid: number,
    newCustomerName: string,
    newCustomerPhone: string,
    newCustomerAddress: string,
    notes: string
  ) => Promise<void>;
  onReturnOrVoidSale: (saleTx: StoreTransaction) => Promise<void>;
}

const AVAILABLE_UNITS = ['pcs', 'kg', 'gm', 'ltr', 'box'];

export const SalesPosView: React.FC<SalesPosViewProps> = ({
  products,
  customers,
  transactions,
  cart,
  selectedCustomerId,
  discountInput,
  strings,
  language,
  onAddToCart,
  onUpdateQty,
  onUpdateUnit,
  onUpdateUnitPrice,
  onClearCart,
  onSelectCustomer,
  onDiscountChange,
  onCheckout,
  onReturnOrVoidSale,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const [subScreen, setSubScreen] = useState<SalesSubScreen>(
    cart.length > 0 ? 'NEW_SALE' : 'OVERVIEW'
  );

  // POS Workspace state (automatically side-by-side SPLIT on laptop/desktop >= 1024px, unchanged PRODUCTS view on smartphone/mobile)
  const [workspaceView, setWorkspaceView] = useState<PosWorkspaceView>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024
      ? 'SPLIT'
      : 'PRODUCTS'
  );
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [quickFilter, setQuickFilter] = useState<QuickProductFilter>('ALL');
  const [isCompactList, setIsCompactList] = useState<boolean>(false);
  const [cartQuickSearch, setCartQuickSearch] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isPercentDiscount, setIsPercentDiscount] = useState(false);
  const [percentDiscountInput, setPercentDiscountInput] = useState('');

  // Overview filter state (defaulting to TODAY first)
  const [overviewTimeFilter, setOverviewTimeFilter] =
    useState<OverviewTimeFilter>('TODAY');
  const [overviewSearch, setOverviewSearch] = useState<string>('');

  // Checkout state
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('FULL_CASH');
  const [partCashPaidInput, setPartCashPaidInput] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [lastCompletedSale, setLastCompletedSale] =
    useState<CompletedSaleSummary | null>(null);
  const [selectedSaleTx, setSelectedSaleTx] = useState<StoreTransaction | null>(
    null
  );
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const cartSectionRef = useRef<HTMLDivElement | null>(null);

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
  const startOfThisWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const startOfThisMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
    0
  ).getTime();
  const startOfThisYear = new Date(
    now.getFullYear(),
    0,
    1,
    0,
    0,
    0,
    0
  ).getTime();

  const allSales = useMemo(
    () => transactions.filter((t) => t.type === 'SALE'),
    [transactions]
  );
  const todaySales = useMemo(
    () =>
      allSales.filter(
        (t) =>
          (t.createdAt ? t.createdAt.toMillis() : Date.now()) >= startOfToday
      ),
    [allSales, startOfToday]
  );
  const weekSales = useMemo(
    () =>
      allSales.filter(
        (t) =>
          (t.createdAt ? t.createdAt.toMillis() : Date.now()) >= startOfThisWeek
      ),
    [allSales, startOfThisWeek]
  );
  const monthSales = useMemo(
    () =>
      allSales.filter(
        (t) =>
          (t.createdAt ? t.createdAt.toMillis() : Date.now()) >=
          startOfThisMonth
      ),
    [allSales, startOfThisMonth]
  );
  const yearSales = useMemo(
    () =>
      allSales.filter(
        (t) =>
          (t.createdAt ? t.createdAt.toMillis() : Date.now()) >= startOfThisYear
      ),
    [allSales, startOfThisYear]
  );
  const todayTotalAmount = useMemo(
    () => todaySales.reduce((acc, t) => acc + t.amount, 0),
    [todaySales]
  );
  const { todayCreditGiven, todayCreditCustomerCount } = useMemo(() => {
    let totalDue = 0;
    const custSet = new Set<string>();
    for (const tx of transactions) {
      const txMillis = tx.createdAt ? tx.createdAt.toMillis() : Date.now();
      if (txMillis < startOfToday) continue;
      if (tx.type === 'SALE' && tx.dueAmount > 0) {
        totalDue += tx.dueAmount;
        const key = (tx.customerId || tx.customerName || tx.id)
          .trim()
          .toLowerCase();
        if (key) custSet.add(key);
      } else if (tx.type === 'GIVE_DUE') {
        const dueAmt = Math.max(tx.dueAmount, tx.amount);
        if (dueAmt > 0) {
          totalDue += dueAmt;
          const key = (tx.customerId || tx.customerName || tx.id)
            .trim()
            .toLowerCase();
          if (key) custSet.add(key);
        }
      }
    }
    return {
      todayCreditGiven: totalDue,
      todayCreditCustomerCount: custSet.size,
    };
  }, [transactions, startOfToday]);

  // Compute product sales frequency for "Top Sold" filter
  const productSaleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tx of allSales) {
      const items = parseLineItems(tx);
      for (const item of items) {
        if (item.productId) {
          counts[item.productId] =
            (counts[item.productId] || 0) + (Number(item.quantity) || 1);
        }
      }
    }
    return counts;
  }, [allSales]);

  // Unique categories with counts
  const categoriesWithCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const cat = (p.category || '').trim();
      if (cat) {
        map.set(cat, (map.get(cat) || 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [products]);

  // Cart lookup map for O(1) checks
  const cartByProductId = useMemo(() => {
    const map = new Map<string, CartItem>();
    for (const item of cart) {
      map.set(item.product.id, item);
    }
    return map;
  }, [cart]);

  const totalCartUnits = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + (Number(item.quantity.toFixed(2)) || 0),
        0
      ),
    [cart]
  );

  // Cart totals
  const subtotal = cart.reduce((acc, item) => acc + getCartLineTotal(item), 0);
  const discount = Math.max(0, Number(discountInput) || 0);
  const netPayable = Math.max(0, subtotal - discount);

  const partCashPaid = Math.min(
    netPayable,
    Math.max(0, Number(partCashPaidInput) || 0)
  );
  const computedCashPaid =
    paymentMode === 'FULL_CASH'
      ? netPayable
      : paymentMode === 'FULL_CREDIT'
      ? 0
      : partCashPaid;
  const computedCreditDue = Math.max(0, netPayable - computedCashPaid);

  // Filtered and sorted products for the Product Picker
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const list = products.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) {
        return false;
      }
      if (quickFilter === 'IN_CART' && !cartByProductId.has(p.id)) {
        return false;
      }
      if (quickFilter === 'IN_STOCK' && p.stock <= 0) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        String(p.sellPrice).includes(q)
      );
    });

    if (quickFilter === 'TOP_SOLD') {
      return [...list].sort(
        (a, b) =>
          (productSaleCounts[b.id] || 0) - (productSaleCounts[a.id] || 0)
      );
    }

    // Put in-stock items before out-of-stock when not searching
    return [...list].sort((a, b) => {
      const aOut = a.stock <= 0 ? 1 : 0;
      const bOut = b.stock <= 0 ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;
      return 0;
    });
  }, [
    products,
    productSearch,
    selectedCategory,
    quickFilter,
    cartByProductId,
    productSaleCounts,
  ]);

  // Quick-add dropdown matches inside Cart panel
  const cartQuickMatches = useMemo(() => {
    const q = cartQuickSearch.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.stock > 0 &&
          (p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.barcode.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [products, cartQuickSearch]);

  // Chronological SL Number map for customers (matches Customer Menu: 1st added = #1, 2nd = #2...)
  const customerSlMap = useMemo(() => {
    const sortedByCreation = [...customers].sort((a, b) => {
      const aTime = a.createdAt ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt ? b.createdAt.toMillis() : 0;
      if (aTime !== bTime) {
        if (aTime === 0) return 1;
        if (bTime === 0) return -1;
        return aTime - bTime;
      }
      return a.id.localeCompare(b.id);
    });
    const map = new Map<string, number>();
    sortedByCreation.forEach((c, idx) => {
      map.set(c.id, idx + 1);
    });
    return map;
  }, [customers]);

  // Filtered customers for POS customer selector (by name, mobile, identityHint, address, note, SL #)
  const filteredCustomers = useMemo(() => {
    const rawQ = customerSearchQuery.trim().toLowerCase();
    if (!rawQ) return customers;
    // Normalize Bengali digits in query to English digits so searching #১ or ১ also matches SL 1
    const bnMap: Record<string, string> = {
      '০': '0',
      '১': '1',
      '২': '2',
      '৩': '3',
      '৪': '4',
      '৫': '5',
      '৬': '6',
      '৭': '7',
      '৮': '8',
      '৯': '9',
    };
    const normalizedQ = rawQ.replace(/[০-৯]/g, (d) => bnMap[d] || d);

    return customers.filter((c) => {
      const sl = customerSlMap.get(c.id) || 0;
      return (
        c.name.toLowerCase().includes(rawQ) ||
        (c.phone || '').toLowerCase().includes(rawQ) ||
        (c.phone || '').toLowerCase().includes(normalizedQ) ||
        (c.identityHint || '').toLowerCase().includes(rawQ) ||
        (c.address || '').toLowerCase().includes(rawQ) ||
        (c.note || '').toLowerCase().includes(rawQ) ||
        `#${sl}` === normalizedQ ||
        String(sl) === normalizedQ
      );
    });
  }, [customers, customerSearchQuery, customerSlMap]);

  const walkInLabel = isBengali ? 'সাধারণ ক্রেতা (Walk-in)' : 'Walk-in customer';

  const jumpToCart = () => {
    setWorkspaceView('CART');
    setTimeout(() => {
      cartSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 40);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && productSearch.trim()) {
      e.preventDefault();
      const q = productSearch.trim().toLowerCase();
      // Check exact barcode match first, or single matching in-stock product
      const exactBarcode = products.find(
        (p) => p.barcode && p.barcode.toLowerCase() === q && p.stock > 0
      );
      if (exactBarcode) {
        onAddToCart(exactBarcode);
        setProductSearch('');
        return;
      }
      const inStockMatches = filteredProducts.filter((p) => p.stock > 0);
      if (inStockMatches.length === 1) {
        onAddToCart(inStockMatches[0]);
        setProductSearch('');
      }
    }
  };

  const handlePercentDiscountChange = (val: string) => {
    setPercentDiscountInput(val);
    const pct = Math.min(100, Math.max(0, Number(val) || 0));
    const computed = Math.round((subtotal * pct) / 100);
    onDiscountChange(computed > 0 ? String(computed) : '');
  };

  const handleCompleteSale = async () => {
    setValidationError(null);
    if (cart.length === 0) {
      setValidationError(
        isBengali
          ? 'কার্টে অন্তত একটি পণ্য যোগ করুন।'
          : 'Please add at least one item to the cart.'
      );
      return;
    }

    if (computedCreditDue > 0) {
      if (!isNewCustomer && !selectedCustomerId) {
        setValidationError(
          isBengali
            ? 'বাকি বিক্রির জন্য একজন কাস্টমার নির্বাচন করুন অথবা নতুন কাস্টমার যোগ করুন।'
            : 'Please select a customer or add a new customer for credit sales.'
        );
        return;
      }
      if (isNewCustomer && !newCustomerName.trim()) {
        setValidationError(
          isBengali
            ? 'নতুন কাস্টমারের নাম লিখুন।'
            : 'Please enter the new customer name.'
        );
        return;
      }
    }

    const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
    const resolvedCustomerName = isNewCustomer
      ? newCustomerName.trim() || walkInLabel
      : selectedCustomer?.name || walkInLabel;
    const resolvedCustomerPhone = isNewCustomer
      ? newCustomerPhone.trim()
      : selectedCustomer?.phone || '';
    const resolvedCustomerAddress = isNewCustomer
      ? newCustomerAddress.trim()
      : selectedCustomer?.address || '';

    const summaryItems: SaleLineItem[] = cart.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unit: item.customUnit,
      unitPrice: item.customUnitPrice,
      lineTotal: getCartLineTotal(item),
    }));

    setIsSubmitting(true);
    try {
      await onCheckout(
        computedCashPaid,
        isNewCustomer ? newCustomerName : '',
        isNewCustomer ? newCustomerPhone : '',
        isNewCustomer ? newCustomerAddress : '',
        saleNotes
      );

      setLastCompletedSale({
        transactionId: `INV-${Date.now().toString().slice(-6)}`,
        totalAmount: netPayable,
        discountAmount: discount,
        cashPaid: computedCashPaid,
        creditDue: computedCreditDue,
        paymentMode,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        customerAddress: resolvedCustomerAddress,
        notes: saleNotes,
        lineItems: summaryItems,
        timestampStr: new Date().toLocaleString(),
      });

      setSaleNotes('');
      setPartCashPaidInput('');
      setPercentDiscountInput('');
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerAddress('');
      setIsNewCustomer(false);
      setWorkspaceView('PRODUCTS');
      setSubScreen('SALE_COMPLETE');
    } finally {
      setIsSubmitting(false);
    }
  };

  const transactionToSummary = (
    tx: StoreTransaction
  ): CompletedSaleSummary => {
    const items = parseLineItems(tx);
    const itemsSubtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
    const inferredDiscount =
      items.length > 0 && itemsSubtotal > tx.amount
        ? Number((itemsSubtotal - tx.amount).toFixed(2))
        : 0;
    const custDetails = resolveCustomerDetails(tx, customers);
    return {
      transactionId: `INV-${tx.id.slice(-6).toUpperCase()}`,
      totalAmount: tx.amount,
      discountAmount: inferredDiscount,
      cashPaid: tx.paidAmount,
      creditDue: tx.dueAmount,
      paymentMode:
        tx.dueAmount > 0 && tx.paidAmount > 0
          ? 'PART_CREDIT'
          : tx.dueAmount > 0
          ? 'FULL_CREDIT'
          : 'FULL_CASH',
      customerName: custDetails.name,
      customerPhone: custDetails.phone,
      customerAddress: custDetails.address,
      notes: parseUserNote(tx),
      lineItems: items,
      timestampStr: formatTimestamp(tx.createdAt),
    };
  };

  // 1. RECEIPT SUB-SCREEN
  if (subScreen === 'RECEIPT' && lastCompletedSale) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSubScreen('OVERVIEW')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#CBEAD9] dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#00965E] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isBengali ? 'বিক্রয় তালিকায় ফিরুন' : 'Back to Sales'}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00965E] hover:bg-[#057A50] text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isBengali ? 'ক্যাশ মেমো প্রিন্ট করুন' : 'Print Cash Memo'}</span>
          </button>
        </div>

        {/* Printable Cash Memo Card */}
        <div className="bg-white text-slate-900 rounded-2xl p-6 border-2 border-slate-200 shadow-md">
          <div className="text-center border-b-2 border-dashed border-slate-300 pb-4">
            <div className="flex items-center justify-center gap-2">
              <img
                src="/assets/drawable/ic_siaam_store_logo.png"
                alt="Siaam Store"
                className="w-10 h-10 object-contain"
              />
              <div>
                <h2 className="text-xl font-black text-[#064E3B]">
                  সিয়াম স্টোর • SIAAM STORE
                </h2>
                <p className="text-xs font-semibold text-slate-600">
                  রামচন্দ্রপুর হাট, চাঁপাইনবাবগঞ্জ | Ramchandrapur Haat, Chapainawabganj
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  মোবাইল / Phone: 01740999627, 01303033353
                </p>
              </div>
            </div>
            <div className="mt-2 inline-block px-3 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-[11px] font-extrabold text-emerald-800">
              ক্যাশ মেমো / CASH MEMO
            </div>
          </div>

          {/* Invoice Meta */}
          <div className="grid grid-cols-2 gap-2 py-3 text-xs border-b border-slate-200">
            <div>
              <p className="text-slate-500">
                {isBengali ? 'মেমো নং:' : 'Invoice No:'}{' '}
                <span className="font-bold text-slate-900">
                  {lastCompletedSale.transactionId}
                </span>
              </p>
              <p className="text-slate-500 mt-0.5">
                {isBengali ? 'গ্রাহক:' : 'Customer:'}{' '}
                <span className="font-bold text-slate-900">
                  {lastCompletedSale.customerName}
                </span>
              </p>
              {lastCompletedSale.customerPhone && (
                <p className="text-slate-500 mt-0.5">
                  {isBengali ? 'ফোন:' : 'Phone:'}{' '}
                  <span className="font-semibold text-slate-800">
                    {lastCompletedSale.customerPhone}
                  </span>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-slate-500">
                {isBengali ? 'তারিখ:' : 'Date:'}{' '}
                <span className="font-bold text-slate-900">
                  {lastCompletedSale.timestampStr}
                </span>
              </p>
              <p className="text-slate-500 mt-0.5">
                {isBengali ? 'পেমেন্ট:' : 'Status:'}{' '}
                <span
                  className={`font-extrabold ${
                    lastCompletedSale.creditDue > 0
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {lastCompletedSale.creditDue > 0
                    ? lastCompletedSale.cashPaid > 0
                      ? isBengali
                        ? 'আংশিক বাকি'
                        : 'Part Credit'
                      : isBengali
                      ? 'বাকি'
                      : 'Credit'
                    : isBengali
                    ? 'নগদ'
                    : 'Cash'}
                </span>
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <table className="w-full text-xs my-3">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600 font-bold">
                <th className="py-1.5 text-left">{isBengali ? 'পণ্য' : 'Item'}</th>
                <th className="py-1.5 text-center">{isBengali ? 'পরিমাণ' : 'Qty'}</th>
                <th className="py-1.5 text-right">{isBengali ? 'দর' : 'Rate'}</th>
                <th className="py-1.5 text-right">{isBengali ? 'মোট' : 'Total'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lastCompletedSale.lineItems.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2 font-semibold text-slate-900">
                    {item.productName}
                  </td>
                  <td className="py-2 text-center text-slate-700">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-2 text-right text-slate-700">
                    ৳{formatMoney(item.unitPrice)}
                  </td>
                  <td className="py-2 text-right font-bold text-slate-900">
                    ৳{formatMoney(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Breakdown */}
          <div className="border-t-2 border-dashed border-slate-300 pt-3 space-y-1.5 text-xs">
            {lastCompletedSale.discountAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>{isBengali ? 'ছাড় (Discount)' : 'Discount'}</span>
                <span>- ৳{formatMoney(lastCompletedSale.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900">
              <span>{isBengali ? 'মোট বিল' : 'Total'}</span>
              <span>৳{formatMoney(lastCompletedSale.totalAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-700">
              <span>{isBengali ? 'নগদ জমা' : 'Cash Paid'}</span>
              <span>৳{formatMoney(lastCompletedSale.cashPaid)}</span>
            </div>
            {lastCompletedSale.creditDue > 0 && (
              <div className="flex justify-between font-bold text-red-600">
                <span>{isBengali ? 'বাকি' : 'Credit Due'}</span>
                <span>৳{formatMoney(lastCompletedSale.creditDue)}</span>
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-200 text-center text-[11px] text-slate-500">
            ধন্যবাদ, আবার আসবেন! • Thank you for shopping at Siaam Store!
          </div>
        </div>
      </div>
    );
  }

  // 2. SALE_COMPLETE SUB-SCREEN
  if (subScreen === 'SALE_COMPLETE' && lastCompletedSale) {
    return (
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-lg text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[#00965E] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            {isBengali ? 'বিক্রি সম্পন্ন হয়েছে!' : 'Sale Recorded!'}
          </h2>
          <div className="text-3xl font-black text-[#00965E]">
            ৳{toBengaliDigits(formatMoney(lastCompletedSale.totalAmount), language)}
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {lastCompletedSale.customerName} •{' '}
            {lastCompletedSale.creditDue > 0
              ? `${isBengali ? 'বাকি' : 'Credit Due'}: ৳${formatMoney(
                  lastCompletedSale.creditDue
                )}`
              : isBengali
              ? 'সম্পূর্ণ নগদ'
              : 'Full Cash'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
            <button
              type="button"
              onClick={() => setSubScreen('RECEIPT')}
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>{isBengali ? 'ক্যাশ মেমো দেখুন' : 'View Cash Memo'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setWorkspaceView(
                  typeof window !== 'undefined' && window.innerWidth >= 1024
                    ? 'SPLIT'
                    : 'PRODUCTS'
                );
                setSubScreen('NEW_SALE');
              }}
              className="py-3 px-4 rounded-xl bg-[#00B368] hover:bg-[#059658] border border-emerald-400/50 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isBengali ? 'আরেকটি বিক্রি' : 'Another Sale'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSubScreen('OVERVIEW')}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
          >
            {isBengali ? 'বিক্রয় তালিকায় ফিরুন' : 'Back to Sales'}
          </button>
        </div>
      </div>
    );
  }

  // 3. SALE_DETAIL SUB-SCREEN
  if (subScreen === 'SALE_DETAIL' && selectedSaleTx) {
    const summary = transactionToSummary(selectedSaleTx);
    return (
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setSelectedSaleTx(null);
              setSubScreen('OVERVIEW');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#CBEAD9] dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#00965E] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isBengali ? 'বিক্রয় তালিকায় ফিরুন' : 'Back to Sales'}</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLastCompletedSale(summary);
                setSubScreen('RECEIPT');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00965E] hover:bg-[#057A50] text-white text-xs font-bold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isBengali ? 'ক্যাশ মেমো' : 'Cash Memo'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowVoidConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isBengali ? 'বিক্রি বাতিল / ফেরত' : 'Return / Void Sale'}</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-xs space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <span className="text-xs font-bold text-slate-400">
                {summary.transactionId}
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {summary.customerName}
              </h3>
              <p className="text-xs text-slate-500">{summary.timestampStr}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-[#00965E]">
                ৳{toBengaliDigits(formatMoney(summary.totalAmount), language)}
              </div>
              <span
                className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  summary.creditDue > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                }`}
              >
                {summary.creditDue > 0
                  ? summary.cashPaid > 0
                    ? isBengali
                      ? 'আংশিক বাকি'
                      : 'Part Credit'
                    : isBengali
                    ? 'বাকি'
                    : 'Credit'
                  : isBengali
                  ? 'নগদ'
                  : 'Cash'}
              </span>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {isBengali ? 'বিক্রীত পণ্যসমূহ' : 'Items'}
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {summary.lineItems.map((item, idx) => (
                <div
                  key={idx}
                  className="py-2 flex items-center justify-between text-sm"
                >
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {item.productName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.quantity} {item.unit} × ৳{formatMoney(item.unitPrice)}
                    </p>
                  </div>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    ৳{formatMoney(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-1 text-xs">
            <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-400">
              <span>{isBengali ? 'নগদ জমা' : 'Cash Paid'}</span>
              <span>৳{formatMoney(summary.cashPaid)}</span>
            </div>
            {summary.creditDue > 0 && (
              <div className="flex justify-between font-semibold text-red-600 dark:text-red-400">
                <span>{isBengali ? 'বাকি' : 'Credit Due'}</span>
                <span>৳{formatMoney(summary.creditDue)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Void Confirm Dialog */}
        {showVoidConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {isBengali
                  ? 'বিক্রি বাতিল ও স্টক ফেরত নিশ্চিত করুন'
                  : 'Return / Void This Sale?'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {isBengali
                  ? 'এই বিক্রিটি বাতিল করলে পণ্যের স্টক পুনরায় যোগ হবে এবং গ্রাহকের বাকি হিসাব সমন্বয় করা হবে।'
                  : 'Voiding this sale will restore product stock quantities and reverse any customer credit due.'}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowVoidConfirm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onReturnOrVoidSale(selectedSaleTx);
                    setShowVoidConfirm(false);
                    setSelectedSaleTx(null);
                    setSubScreen('OVERVIEW');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                >
                  {isBengali ? 'হ্যাঁ, বিক্রি বাতিল করুন' : 'Confirm Void & Restore Stock'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. NEW_SALE (MODERN POS SELL MODE) SUB-SCREEN — COMPACT & MINIMAL FOR PHONE SCREENS
  if (subScreen === 'NEW_SALE') {
    const showProductsPanel =
      workspaceView === 'PRODUCTS' || workspaceView === 'SPLIT';
    const showCartPanel = workspaceView === 'CART' || workspaceView === 'SPLIT';

    return (
      <div className="max-w-6xl lg:max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-6 pt-2 pb-24 space-y-2">
        {/* Compact Sticky Top POS Control Bar + Instant Mode Switcher */}
        <div className="sticky top-[58px] z-30 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md px-2.5 py-2 rounded-xl border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => setSubScreen('OVERVIEW')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-[#00965E] hover:text-[#00965E] cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>{isBengali ? 'পিছনে' : 'Back'}</span>
              </button>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#00965E] shrink-0">
                  <ShoppingCart className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {strings.posCartTitle}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Desktop Split View Toggle */}
              <button
                type="button"
                onClick={() =>
                  setWorkspaceView(
                    workspaceView === 'SPLIT' ? 'PRODUCTS' : 'SPLIT'
                  )
                }
                className={`hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                  workspaceView === 'SPLIT'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-[#00965E] text-[#00965E] dark:text-[#34D399]'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
                title="Toggle Side-by-Side Split View"
              >
                <Layers className="w-3 h-3" />
                <span>{isBengali ? 'পাশাপাশি ভিউ' : 'Split View'}</span>
              </button>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClearCart();
                    setPercentDiscountInput('');
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[11px] font-bold text-red-600 hover:bg-red-100 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{isBengali ? 'কার্ট মুছুন' : 'Clear Cart'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Compact 2-Tab Instant Switcher: Select Products vs Cart & Checkout */}
          <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded-lg bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setWorkspaceView('PRODUCTS')}
              className={`py-1.5 px-2 rounded-md text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1 transition cursor-pointer ${
                workspaceView === 'PRODUCTS' || workspaceView === 'SPLIT'
                  ? 'bg-white dark:bg-slate-800 text-[#00965E] dark:text-[#34D399] border border-[#CBEAD9] dark:border-emerald-800 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {isBengali ? '১. পণ্য খুঁজুন ও যোগ করুন' : '1. Find & Add Products'}
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-[9.5px] font-black text-[#00965E] shrink-0">
                {toBengaliDigits(products.length, language)}
              </span>
            </button>

            <button
              type="button"
              onClick={jumpToCart}
              className={`py-1.5 px-2 rounded-md text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1 transition cursor-pointer ${
                workspaceView === 'CART'
                  ? 'bg-[#00965E] text-white border border-[#007A4D] shadow-2xs'
                  : cart.length > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-[#00965E] dark:text-[#34D399] border border-[#00965E]/40 hover:bg-emerald-100/80'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {isBengali ? '২. কার্ট ও বিল' : '2. Cart & Checkout'}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-black shrink-0 ${
                  workspaceView === 'CART'
                    ? 'bg-white text-[#00965E]'
                    : cart.length > 0
                    ? 'bg-[#00965E] text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {toBengaliDigits(cart.length, language)}
                {cart.length > 0
                  ? ` • ৳${toBengaliDigits(formatMoney(netPayable), language)}`
                  : ''}
              </span>
            </button>
          </div>
        </div>

        {/* Workspace Content */}
        <div
          className={`grid grid-cols-1 ${
            workspaceView === 'SPLIT' ? 'lg:grid-cols-12' : ''
          } gap-2.5 items-start`}
        >
          {/* PANEL 1: COMPACT PRODUCT SEARCH, CATEGORY CHIPS & INLINE STEPPER CARDS */}
          {showProductsPanel && (
            <div
              className={`${
                workspaceView === 'SPLIT' ? 'lg:col-span-7' : ''
              } bg-white dark:bg-slate-800 rounded-xl p-2.5 sm:p-3.5 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs space-y-2`}
            >
              {/* Compact Search Bar + View Toggle */}
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#00965E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={
                      isBengali
                        ? 'পণ্যের নাম, ক্যাটাগরি, দাম বা বারকোড লিখে খুঁজুন...'
                        : 'Search product name, category, price or barcode...'
                    }
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-[#CBEAD9] dark:border-slate-700 text-xs font-medium focus:border-[#00965E] focus:bg-white dark:focus:bg-slate-900 focus:outline-none dark:text-white"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearch('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 flex items-center justify-center cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Grid vs Compact List Toggle */}
                <button
                  type="button"
                  onClick={() => setIsCompactList(!isCompactList)}
                  className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-[#CBEAD9] dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00965E] hover:text-[#00965E] transition cursor-pointer shrink-0"
                  title={
                    isCompactList
                      ? isBengali
                        ? 'কার্ড গ্রিড ভিউ'
                        : 'Card Grid View'
                      : isBengali
                      ? 'দ্রুত তালিকা ভিউ'
                      : 'Fast Compact List View'
                  }
                >
                  {isCompactList ? (
                    <LayoutGrid className="w-3.5 h-3.5" />
                  ) : (
                    <List className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Compact Smart Quick Filters: All | In Cart | Top Sold | In Stock */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {(
                  [
                    [
                      'ALL',
                      isBengali ? 'সব পণ্য' : 'All',
                      products.length,
                      Package,
                    ],
                    [
                      'IN_CART',
                      isBengali ? 'কার্টে আছে' : 'In Cart',
                      cart.length,
                      ShoppingCart,
                    ],
                    [
                      'TOP_SOLD',
                      isBengali ? 'জনপ্রিয়' : 'Top Sold',
                      null,
                      Flame,
                    ],
                    [
                      'IN_STOCK',
                      isBengali ? 'স্টকে আছে' : 'In Stock',
                      products.filter((p) => p.stock > 0).length,
                      CheckCircle2,
                    ],
                  ] as const
                ).map(([fKey, fLabel, count, Icon]) => {
                  const active = quickFilter === fKey;
                  return (
                    <button
                      key={fKey}
                      type="button"
                      onClick={() => setQuickFilter(fKey)}
                      className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold border inline-flex items-center gap-1 shrink-0 transition cursor-pointer ${
                        active
                          ? 'bg-[#00965E] text-white border-[#00965E] shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#00965E]'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{fLabel}</span>
                      {count !== null && (
                        <span
                          className={`px-1 py-0.1 rounded-full text-[9.5px] font-black ${
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {toBengaliDigits(count, language)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Compact Category Filter Chips (when categories exist) */}
              {categoriesWithCount.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400 pr-0.5 shrink-0">
                    <Filter className="w-2.5 h-2.5" />
                    <span>{isBengali ? 'ক্যাটাগরি:' : 'Category:'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 transition cursor-pointer ${
                      selectedCategory === 'ALL'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-[#00965E] text-[#00965E] dark:text-[#34D399]'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-[#00965E]'
                    }`}
                  >
                    {isBengali ? 'সব ক্যাটাগরি' : 'All Categories'}
                  </button>
                  {categoriesWithCount.map(([cat, count]) => {
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setSelectedCategory(active ? 'ALL' : cat)
                        }
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-flex items-center gap-1 shrink-0 transition cursor-pointer ${
                          active
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-[#00965E] text-[#00965E] dark:text-[#34D399]'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-[#00965E]'
                        }`}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        <span>{cat}</span>
                        <span className="text-[9.5px] opacity-75">
                          ({toBengaliDigits(count, language)})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Compact Active Cart Mini Strip inside Product Picker */}
              {cart.length > 0 && (
                <div className="px-2.5 py-1.5 rounded-lg bg-[#ECFDF5] dark:bg-emerald-950/40 border border-[#A7F3D0] dark:border-emerald-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded-md bg-[#00965E] text-white flex items-center justify-center shrink-0 text-[10px] font-black">
                      {toBengaliDigits(cart.length, language)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-extrabold text-[#064E3B] dark:text-emerald-200 truncate">
                        {cart.map((c) => `${c.product.name} (×${c.quantity})`).join(', ')}
                      </p>
                      <p className="text-[10px] font-bold text-[#00965E] dark:text-emerald-400">
                        {isBengali ? 'মোট বিল:' : 'Subtotal:'} ৳
                        {toBengaliDigits(formatMoney(netPayable), language)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={jumpToCart}
                    className="px-2.5 py-1 rounded-lg bg-[#00965E] hover:bg-[#057A50] text-white text-[10.5px] font-extrabold inline-flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                  >
                    <span>{isBengali ? 'কার্টে যান ও বিল করুন' : 'Go to Cart & Bill'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Compact Product Cards Grid / Compact List */}
              {filteredProducts.length === 0 ? (
                <div className="py-6 text-center space-y-1.5 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                  <Package className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {isBengali
                      ? 'কোনো পণ্য পাওয়া যায়নি'
                      : 'No matching products found'}
                  </p>
                  {(productSearch ||
                    selectedCategory !== 'ALL' ||
                    quickFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearch('');
                        setSelectedCategory('ALL');
                        setQuickFilter('ALL');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-[#00965E] cursor-pointer"
                    >
                      {isBengali ? 'সব ফিল্টার মুছুন' : 'Reset Filters'}
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={
                    isCompactList
                      ? 'space-y-1.5 max-h-[620px] overflow-y-auto pr-0.5'
                      : 'grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[620px] overflow-y-auto pr-0.5'
                  }
                >
                  {filteredProducts.map((product) => {
                    const inCart = cartByProductId.get(product.id);
                    const isOut = product.stock <= 0;
                    const isLow =
                      !isOut && product.stock <= product.lowStockThreshold;
                    const soldCount = productSaleCounts[product.id] || 0;

                    return (
                      <div
                        key={product.id}
                        onClick={() => {
                          if (!isOut && !inCart) {
                            onAddToCart(product);
                          }
                        }}
                        className={`p-2 sm:p-2.5 rounded-xl border transition flex flex-col justify-between gap-1.5 ${
                          isOut
                            ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                            : inCart
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/35 border-[#00965E] shadow-2xs'
                            : 'bg-white dark:bg-slate-800/90 border-[#CBEAD9] dark:border-slate-700 hover:border-[#00965E] cursor-pointer'
                        }`}
                      >
                        {/* Top Section: Name, Category, Price & Stock Badge */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <p className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                                {product.name}
                              </p>
                              {product.category && (
                                <span className="px-1 py-0.1 rounded bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[9.5px] font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-0.5">
                                  <Tag className="w-2 h-2 text-[#00965E]" />
                                  <span>{product.category}</span>
                                </span>
                              )}
                              {soldCount > 0 && (
                                <span className="px-1 py-0.1 rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[9.5px] font-bold text-amber-700 dark:text-amber-300 inline-flex items-center gap-0.5">
                                  <Flame className="w-2 h-2" />
                                  <span>
                                    {toBengaliDigits(soldCount, language)}
                                  </span>
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-black text-[#00965E] dark:text-[#34D399]">
                                ৳
                                {toBengaliDigits(
                                  formatMoney(product.sellPrice),
                                  language
                                )}
                                <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                                  /{product.unit}
                                </span>
                              </span>

                              <span
                                className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-extrabold border inline-flex items-center gap-0.5 ${
                                  isOut
                                    ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
                                    : isLow
                                    ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                                    : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {isLow && <AlertTriangle className="w-2 h-2" />}
                                <span>
                                  {isOut
                                    ? isBengali
                                      ? 'স্টক শেষ'
                                      : 'Out of Stock'
                                    : `${isBengali ? 'স্টক' : 'Stock'}: ${toBengaliDigits(
                                        product.stock,
                                        language
                                      )} ${product.unit}`}
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* Top-Right Status or Quick Add Button */}
                          {!inCart ? (
                            <button
                              type="button"
                              disabled={isOut}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isOut) onAddToCart(product);
                              }}
                              className={`px-2 py-1 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-0.5 border transition shrink-0 ${
                                isOut
                                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                  : 'bg-[#ECFDF5] hover:bg-[#00965E] text-[#00965E] hover:text-white border-[#A7F3D0] dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-[#00965E] dark:hover:text-white cursor-pointer'
                              }`}
                            >
                              <Plus className="w-3 h-3" />
                              <span>{isBengali ? 'যোগ' : 'Add'}</span>
                            </button>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md bg-[#00965E] text-white text-[10.5px] font-black shrink-0">
                              ৳
                              {toBengaliDigits(
                                formatMoney(getCartLineTotal(inCart)),
                                language
                              )}
                            </span>
                          )}
                        </div>

                        {/* Compact Inline Quantity Stepper when item is already in Cart */}
                        {inCart && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="pt-1.5 border-t border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between gap-1.5"
                          >
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateQty(
                                    product.id,
                                    Math.max(0, inCart.quantity - 1)
                                  )
                                }
                                className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-slate-800 dark:text-white hover:bg-red-50 hover:border-red-300 cursor-pointer"
                                title="Decrease quantity"
                              >
                                <Minus className="w-3 h-3" />
                              </button>

                              <input
                                type="number"
                                min={0.1}
                                step="any"
                                max={product.stock}
                                value={inCart.quantity}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (!Number.isNaN(val) && val >= 0) {
                                    onUpdateQty(product.id, val);
                                  }
                                }}
                                className="w-11 text-center py-0.5 rounded-md bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-[11px] font-black text-slate-900 dark:text-white"
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateQty(product.id, inCart.quantity + 1)
                                }
                                className="w-6 h-6 rounded-md bg-[#00965E] text-white flex items-center justify-center hover:bg-[#057A50] cursor-pointer"
                                title="Increase quantity"
                              >
                                <Plus className="w-3 h-3" />
                              </button>

                              {product.stock >= inCart.quantity + 5 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateQty(product.id, inCart.quantity + 5)
                                  }
                                  className="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-[9.5px] font-extrabold text-[#00965E] hover:bg-emerald-50 cursor-pointer"
                                >
                                  +5
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-[10.5px] font-bold text-[#00965E] dark:text-emerald-300">
                                {inCart.customUnit}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQty(product.id, 0)}
                                className="p-1 rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-100 cursor-pointer"
                                title="Remove from cart"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PANEL 2: COMPACT CART ITEMS & PAYMENT CHECKOUT */}
          {showCartPanel && (
            <div
              ref={cartSectionRef}
              id="pos-cart-section"
              className={`${
                workspaceView === 'SPLIT' ? 'lg:col-span-5' : 'max-w-3xl mx-auto w-full'
              } bg-white dark:bg-slate-800 rounded-xl p-3 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs space-y-2.5`}
            >
              {/* Compact Cart Header + Add More Products Button */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#00965E]">
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                      {isBengali ? 'কার্টের পণ্য ও বিল' : 'Cart Items & Bill'}
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500">
                      {toBengaliDigits(cart.length, language)}{' '}
                      {isBengali ? 'টি আইটেম' : 'items'} •{' '}
                      {toBengaliDigits(totalCartUnits, language)}{' '}
                      {isBengali ? 'ইউনিট' : 'units'}
                    </p>
                  </div>
                </div>

                {workspaceView === 'CART' && (
                  <button
                    type="button"
                    onClick={() => setWorkspaceView('PRODUCTS')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-[#00965E]/40 text-[11px] font-extrabold text-[#00965E] dark:text-[#34D399] inline-flex items-center gap-1 hover:bg-emerald-100 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isBengali ? 'আরও পণ্য যোগ' : 'Add Products'}</span>
                  </button>
                )}
              </div>

              {/* Quick-Add Product Search Bar directly inside Cart View */}
              <div className="relative">
                <Search className="w-3 h-3 text-[#00965E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={cartQuickSearch}
                  onChange={(e) => setCartQuickSearch(e.target.value)}
                  placeholder={
                    isBengali
                      ? 'কার্ট থেকেই দ্রুত অন্য পণ্য খুঁজে যোগ করুন...'
                      : 'Quick search & add product right from cart...'
                  }
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-[#CBEAD9] dark:border-slate-700 text-xs font-semibold focus:border-[#00965E] focus:outline-none dark:text-white"
                />
                {cartQuickSearch && (
                  <button
                    type="button"
                    onClick={() => setCartQuickSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {cartQuickMatches.length > 0 && (
                  <div className="mt-1 rounded-lg bg-white dark:bg-slate-900 border border-[#00965E] shadow-md divide-y divide-slate-100 dark:divide-slate-800 max-h-44 overflow-y-auto">
                    {cartQuickMatches.map((prod) => {
                      const existing = cartByProductId.get(prod.id);
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => {
                            onAddToCart(prod);
                            setCartQuickSearch('');
                          }}
                          className="w-full px-2.5 py-1.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between text-[11px] cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {prod.name}
                            </span>
                            <span className="text-slate-400 ml-1">
                              ({prod.stock} {prod.unit})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-[#00965E]">
                              ৳{formatMoney(prod.sellPrice)}/{prod.unit}
                            </span>
                            {existing ? (
                              <span className="px-1 py-0.2 rounded bg-[#00965E] text-white text-[9.5px] font-black">
                                ×{existing.quantity}
                              </span>
                            ) : (
                              <Plus className="w-3 h-3 text-[#00965E]" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Compact Cart Items List */}
              {cart.length === 0 ? (
                <div className="py-6 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                  <ShoppingBag className="w-6 h-6 mx-auto opacity-50" />
                  <p className="text-[11px] font-semibold px-2">
                    {isBengali
                      ? 'কার্ট খালি আছে। পণ্য নির্বাচন ট্যাব বা উপরের সার্চ বক্স থেকে পণ্য যোগ করুন।'
                      : 'Your cart is empty. Tap products or search above to add items.'}
                  </p>
                  {workspaceView === 'CART' && (
                    <button
                      type="button"
                      onClick={() => setWorkspaceView('PRODUCTS')}
                      className="px-3 py-1.5 rounded-lg bg-[#00965E] text-white text-[11px] font-bold cursor-pointer"
                    >
                      {isBengali ? 'পণ্য তালিকা দেখুন' : 'Browse Products'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-0.5">
                  {cart.map((item, idx) => {
                    const lineTotal = getCartLineTotal(item);
                    return (
                      <div
                        key={item.product.id}
                        className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-[#CBEAD9] dark:border-slate-700 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="px-1 py-0.1 rounded bg-emerald-100 dark:bg-emerald-950 text-[#00965E] text-[9.5px] font-black">
                                #{toBengaliDigits(idx + 1, language)}
                              </span>
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                {item.product.name}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500">
                              {isBengali ? 'স্টক:' : 'Available:'}{' '}
                              {item.product.stock} {item.product.unit} •{' '}
                              {item.quantity} {item.customUnit} × ৳
                              {formatMoney(item.customUnitPrice)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-black text-[#00965E] dark:text-[#34D399]">
                              ৳{toBengaliDigits(formatMoney(lineTotal), language)}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.product.id, 0)}
                              className="p-1 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-500 hover:text-red-700 cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-12 gap-1.5 items-center">
                          {/* Quantity Controls */}
                          <div className="col-span-5 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateQty(item.product.id, item.quantity - 1)
                              }
                              className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-white hover:border-[#00965E] cursor-pointer shrink-0"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={0.1}
                              step="any"
                              max={item.product.stock}
                              value={item.quantity}
                              onChange={(e) =>
                                onUpdateQty(
                                  item.product.id,
                                  Math.max(0.1, Number(e.target.value) || 1)
                                )
                              }
                              className="w-full text-center py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-extrabold dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateQty(item.product.id, item.quantity + 1)
                              }
                              className="w-6 h-6 rounded-md bg-[#00965E] text-white flex items-center justify-center hover:bg-[#057A50] cursor-pointer shrink-0"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Unit Selector */}
                          <div className="col-span-3">
                            <select
                              value={item.customUnit}
                              onChange={(e) =>
                                onUpdateUnit(item.product.id, e.target.value)
                              }
                              className="w-full py-1 px-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold dark:text-white"
                            >
                              {AVAILABLE_UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Custom Unit Price */}
                          <div className="col-span-4 relative">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                              ৳
                            </span>
                            <input
                              type="number"
                              value={item.customUnitPrice}
                              onChange={(e) =>
                                onUpdateUnitPrice(
                                  item.product.id,
                                  Math.max(0, Number(e.target.value) || 0)
                                )
                              }
                              className="w-full pl-4 pr-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-extrabold text-right dark:text-white"
                              title="Unit Price (৳)"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Compact Subtotal, Discount (৳ / % toggle) & Total Box */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-500">
                    {isBengali ? 'উপমোট (Subtotal)' : 'Subtotal'}
                  </span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">
                    ৳{toBengaliDigits(formatMoney(subtotal), language)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-slate-500">
                    {isBengali ? 'ছাড় (Discount)' : 'Discount'}
                  </span>
                  <div className="flex items-center gap-1">
                    {isPercentDiscount ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={percentDiscountInput}
                        onChange={(e) =>
                          handlePercentDiscountChange(e.target.value)
                        }
                        placeholder="0%"
                        className="w-20 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-right font-bold dark:bg-slate-900 dark:text-white"
                      />
                    ) : (
                      <input
                        type="number"
                        min={0}
                        value={discountInput}
                        onChange={(e) => onDiscountChange(e.target.value)}
                        placeholder="0"
                        className="w-20 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-right font-bold dark:bg-slate-900 dark:text-white"
                      />
                    )}
                    <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setIsPercentDiscount(false)}
                        className={`px-1.5 py-0.5 text-[10.5px] font-extrabold cursor-pointer ${
                          !isPercentDiscount
                            ? 'bg-[#00965E] text-white'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        ৳
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPercentDiscount(true)}
                        className={`px-1.5 py-0.5 text-[10.5px] font-extrabold cursor-pointer ${
                          isPercentDiscount
                            ? 'bg-[#00965E] text-white'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        %
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-base font-black text-slate-900 dark:text-white pt-0.5">
                  <span>{isBengali ? 'মোট প্রদেয় বিল' : 'Total Payable'}</span>
                  <span className="text-[#00965E] dark:text-[#34D399] text-lg">
                    ৳{toBengaliDigits(formatMoney(netPayable), language)}
                  </span>
                </div>
              </div>

              {/* Compact Payment Mode Selector */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {isBengali ? 'পেমেন্ট ধরন' : 'Payment Mode'}
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      ['FULL_CASH', isBengali ? 'সম্পূর্ণ নগদ' : 'Full Cash'],
                      ['FULL_CREDIT', isBengali ? 'সম্পূর্ণ বাকি' : 'Full Credit'],
                      ['PART_CREDIT', isBengali ? 'আংশিক বাকি' : 'Part Credit'],
                    ] as [PaymentMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`py-1.5 px-1.5 rounded-lg text-[11px] font-extrabold border transition cursor-pointer ${
                        paymentMode === mode
                          ? 'bg-[#00965E] text-white border-[#00965E] shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {paymentMode === 'PART_CREDIT' && (
                  <div className="pt-0.5">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-0.5">
                      {isBengali ? 'এখন নগদ জমা (৳)' : 'Cash Paid Now (৳)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={netPayable}
                      value={partCashPaidInput}
                      onChange={(e) => setPartCashPaidInput(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white"
                    />
                    <p className="mt-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      {isBengali
                        ? `বাকি থাকবে: ৳${formatMoney(computedCreditDue)}`
                        : `Remaining ৳${formatMoney(computedCreditDue)} goes to credit`}
                    </p>
                  </div>
                )}
              </div>

              {/* Compact Customer Selection with Quick Filter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {isBengali ? 'কাস্টমার' : 'Customer'}{' '}
                    {computedCreditDue > 0 && (
                      <span className="text-red-600">*</span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomer(!isNewCustomer)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00965E] hover:underline cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>
                      {isNewCustomer
                        ? isBengali
                          ? 'তালিকা থেকে'
                          : 'Select Existing'
                        : isBengali
                        ? '+ নতুন কাস্টমার'
                        : '+ New Customer'}
                    </span>
                  </button>
                </div>

                {isNewCustomer ? (
                  <div className="space-y-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder={
                        isBengali ? 'কাস্টমারের নাম *' : 'Customer Name *'
                      }
                      className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder={isBengali ? 'মোবাইল নম্বর' : 'Phone Number'}
                      className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={newCustomerAddress}
                      onChange={(e) => setNewCustomerAddress(e.target.value)}
                      placeholder={isBengali ? 'ঠিকানা' : 'Address'}
                      className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Always-visible Customer Search Box (Name, Mobile, Identity Hint / চেনার উপায়, Address, SL #) */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#00965E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        placeholder={
                          isBengali
                            ? 'নাম, চেনার উপায়, মোবাইল, ঠিকানা বা #ক্রমিক দিয়ে খুঁজুন...'
                            : 'Search customer by name, mobile, hint, address or #SL...'
                        }
                        className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-[#CBEAD9] dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium focus:border-[#00965E] focus:outline-none dark:text-white"
                      />
                      {customerSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCustomerSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          title="Clear customer search"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Quick Matching Customer Results when searching */}
                    {customerSearchQuery.trim().length > 0 && (
                      <div className="rounded-lg border border-[#00965E]/50 bg-white dark:bg-slate-900 shadow-xs max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredCustomers.length === 0 ? (
                          <div className="px-2.5 py-2 text-[11px] text-slate-400 text-center">
                            {isBengali
                              ? 'কোনো কাস্টমার পাওয়া যায়নি'
                              : 'No matching customer found'}
                          </div>
                        ) : (
                          filteredCustomers.slice(0, 8).map((c) => {
                            const sl = customerSlMap.get(c.id) || 1;
                            const isSelected = selectedCustomerId === c.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  onSelectCustomer(c.id);
                                  setCustomerSearchQuery('');
                                }}
                                className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between gap-2 text-[11px] transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-[9.5px] font-black text-[#00965E]">
                                      #{toBengaliDigits(sl, language)}
                                    </span>
                                    <span className="font-extrabold text-slate-900 dark:text-white truncate">
                                      {c.name}
                                    </span>
                                    {c.identityHint && (
                                      <span className="px-1.5 py-0.2 rounded bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-[9.5px] font-bold text-teal-800 dark:text-teal-300 truncate">
                                        {c.identityHint}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                    {c.phone && c.phone !== '—' ? c.phone : ''}
                                    {c.address ? ` • ${c.address}` : ''}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span
                                    className={`text-[10.5px] font-black ${
                                      c.totalDue > 0
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-[#00965E]'
                                    }`}
                                  >
                                    {isBengali ? 'বাকি:' : 'Due:'} ৳
                                    {toBengaliDigits(
                                      formatMoney(c.totalDue),
                                      language
                                    )}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* Customer Dropdown Selector */}
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => onSelectCustomer(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold dark:text-white"
                    >
                      <option value="">{walkInLabel}</option>
                      {filteredCustomers.map((c) => {
                        const sl = customerSlMap.get(c.id) || 1;
                        return (
                          <option key={c.id} value={c.id}>
                            #{toBengaliDigits(sl, language)} {c.name}
                            {c.identityHint ? ` [${c.identityHint}]` : ''}
                            {c.phone && c.phone !== '—' ? ` (${c.phone})` : ''}
                            {c.totalDue > 0
                              ? ` - ${isBengali ? 'বাকি' : 'Due'}: ৳${formatMoney(
                                  c.totalDue
                                )}`
                              : ''}
                          </option>
                        );
                      })}
                    </select>

                    {/* Selected Customer Summary Badge */}
                    {selectedCustomerId &&
                      (() => {
                        const sel = customers.find(
                          (c) => c.id === selectedCustomerId
                        );
                        if (!sel) return null;
                        const sl = customerSlMap.get(sel.id) || 1;
                        return (
                          <div className="px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-between gap-2 text-[10.5px]">
                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.2 rounded bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 font-black text-[#00965E]">
                                #{toBengaliDigits(sl, language)}
                              </span>
                              <span className="font-extrabold text-slate-900 dark:text-white truncate">
                                {sel.name}
                              </span>
                              {sel.identityHint && (
                                <span className="px-1.5 py-0.2 rounded bg-teal-100/70 dark:bg-teal-900/50 border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 font-bold truncate">
                                  {sel.identityHint}
                                </span>
                              )}
                              {sel.phone && sel.phone !== '—' && (
                                <span className="text-slate-500 font-semibold">
                                  • {sel.phone}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => onSelectCustomer('')}
                              className="text-slate-400 hover:text-red-600 shrink-0 cursor-pointer"
                              title={
                                isBengali
                                  ? 'সাধারণ ক্রেতা করুন'
                                  : 'Reset to Walk-in'
                              }
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })()}
                  </div>
                )}
              </div>

              {/* Optional Note */}
              <input
                type="text"
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                placeholder={isBengali ? 'নোট (ঐচ্ছিক)' : 'Note (optional)'}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs dark:bg-slate-900 dark:text-white"
              />

              {validationError && (
                <p className="text-[11px] font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                  {validationError}
                </p>
              )}

              <button
                type="button"
                disabled={isSubmitting || cart.length === 0}
                onClick={handleCompleteSale}
                className="w-full h-[44px] rounded-xl bg-[#00B368] hover:bg-[#059658] disabled:bg-slate-300 text-white font-extrabold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? isBengali
                      ? 'সংরক্ষণ হচ্ছে...'
                      : 'Recording Sale...'
                    : `${strings.checkoutSaleBtn} • ৳${toBengaliDigits(
                        formatMoney(netPayable),
                        language
                      )}`}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* COMPACT FLOATING BOTTOM STICKY BAR WHEN BROWSING PRODUCTS & CART HAS ITEMS */}
        {cart.length > 0 && workspaceView !== 'CART' && (
          <div className="fixed bottom-[66px] inset-x-0 z-30 px-2.5 sm:px-4 pointer-events-none">
            <div className="max-w-2xl mx-auto px-3 py-2 rounded-xl bg-[#064E3B] text-white border-[1.5px] border-[#34D399] shadow-lg flex items-center justify-between gap-2 pointer-events-auto">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#00B368] border border-white/25 flex items-center justify-center shrink-0 font-black text-xs">
                  {toBengaliDigits(cart.length, language)}
                </div>
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold text-emerald-200 truncate">
                    {isBengali
                      ? `${toBengaliDigits(cart.length, language)} টি পণ্য কার্টে যোগ করা হয়েছে`
                      : `${cart.length} items in cart`}
                  </p>
                  <p className="text-sm font-black text-white leading-tight">
                    ৳{toBengaliDigits(formatMoney(netPayable), language)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={jumpToCart}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-[#064E3B] font-black text-[11px] sm:text-xs inline-flex items-center gap-1 shadow-2xs transition cursor-pointer shrink-0"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-[#00965E]" />
                <span>
                  {isBengali ? 'কার্ট ও বিল দেখুন' : 'Go to Cart & Checkout'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#00965E]" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 5. DEFAULT OVERVIEW SUB-SCREEN
  const periodSales =
    overviewTimeFilter === 'TODAY'
      ? todaySales
      : overviewTimeFilter === 'THIS_WEEK'
      ? weekSales
      : overviewTimeFilter === 'THIS_MONTH'
      ? monthSales
      : overviewTimeFilter === 'THIS_YEAR'
      ? yearSales
      : allSales;

  const displayedSales = periodSales.filter((tx) => {
    if (!overviewSearch.trim()) return true;
    const q = overviewSearch.toLowerCase();
    return (
      (tx.customerName || '').toLowerCase().includes(q) ||
      (tx.title || '').toLowerCase().includes(q) ||
      String(tx.amount).includes(q)
    );
  });

  return (
    <div className="max-w-4xl lg:max-w-7xl mx-auto px-4 lg:px-6 pt-4 pb-8 space-y-4">
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#00965E] shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {strings.navSales}
            </h1>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-snug">
              {isBengali ? (
                <>
                  <span>
                    আজকের বিক্রি ({toBengaliDigits(todaySales.length, language)}):{' '}
                    <strong className="text-[#00965E] dark:text-[#34D399]">
                      ৳{toBengaliDigits(formatMoney(todayTotalAmount), language)}
                    </strong>
                  </span>
                  <span className="mx-1.5">•</span>
                  <span>
                    আজকের বাকি (
                    {toBengaliDigits(todayCreditCustomerCount, language)}):{' '}
                    <strong className="text-red-600 dark:text-red-400">
                      ৳{toBengaliDigits(formatMoney(todayCreditGiven), language)}
                    </strong>
                  </span>
                </>
              ) : (
                <>
                  <span>
                    Today&apos;s Sales ({todaySales.length}):{' '}
                    <strong className="text-[#00965E] dark:text-[#34D399]">
                      ৳{formatMoney(todayTotalAmount)}
                    </strong>
                  </span>
                  <span className="mx-1.5">•</span>
                  <span>
                    Credit Today ({todayCreditCustomerCount}):{' '}
                    <strong className="text-red-600 dark:text-red-400">
                      ৳{formatMoney(todayCreditGiven)}
                    </strong>
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Active Cart Resume Banner (if cart has items while on Overview) */}
      {cart.length > 0 && (
        <div
          onClick={() => {
            setWorkspaceView('CART');
            setSubScreen('NEW_SALE');
          }}
          className="p-3.5 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-950/60 border-2 border-[#00965E] flex items-center justify-between gap-3 cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00965E] text-white flex items-center justify-center font-black text-xs">
              {toBengaliDigits(cart.length, language)}
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#064E3B] dark:text-emerald-200">
                {isBengali
                  ? 'চলমান বিক্রির কার্ট প্রস্তুত আছে'
                  : 'Active Cart in Progress'}
              </p>
              <p className="text-sm font-black text-[#00965E] dark:text-emerald-400">
                {toBengaliDigits(cart.length, language)}{' '}
                {isBengali ? 'টি পণ্য' : 'items'} • ৳
                {toBengaliDigits(formatMoney(netPayable), language)}
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-[#00965E] text-white text-xs font-extrabold inline-flex items-center gap-1">
            <span>{isBengali ? 'কার্টে যান' : 'Open Cart'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      )}

      {/* Primary New Sale Button */}
      <button
        type="button"
        onClick={() => {
          setWorkspaceView(
            typeof window !== 'undefined' && window.innerWidth >= 1024
              ? 'SPLIT'
              : 'PRODUCTS'
          );
          setSubScreen('NEW_SALE');
        }}
        className="w-full h-[54px] rounded-[16px] bg-[#00B368] hover:bg-[#059658] border-[1.5px] border-[#34D399]/60 text-white font-bold text-[17px] shadow-md flex items-center justify-center gap-2.5 transition cursor-pointer"
      >
        <ShoppingCart className="w-5 h-5" />
        <span>{strings.quickNewSale}</span>
      </button>

      {/* Filter & Search Past Sales: Today | This Week | This Month | This Year | All */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-5 gap-1 rounded-xl bg-white dark:bg-slate-800 p-1 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs">
          {(
            [
              ['TODAY', isBengali ? 'আজ' : 'Today', todaySales.length],
              [
                'THIS_WEEK',
                isBengali ? 'এই সপ্তাহ' : 'This Week',
                weekSales.length,
              ],
              [
                'THIS_MONTH',
                isBengali ? 'এই মাস' : 'This Month',
                monthSales.length,
              ],
              [
                'THIS_YEAR',
                isBengali ? 'এই বছর' : 'This Year',
                yearSales.length,
              ],
              ['ALL', isBengali ? 'সব' : 'All', allSales.length],
            ] as [OverviewTimeFilter, string, number][]
          ).map(([fKey, fLabel, count]) => {
            const active = overviewTimeFilter === fKey;
            return (
              <button
                key={fKey}
                type="button"
                onClick={() => setOverviewTimeFilter(fKey)}
                className={`py-1.5 px-0.5 sm:px-1 rounded-lg text-[8.5px] min-[375px]:text-[9.5px] sm:text-xs font-extrabold tracking-tight leading-none whitespace-nowrap overflow-hidden transition cursor-pointer text-center flex items-center justify-center border ${
                  active
                    ? 'bg-[#00965E] text-white border-[#007A4C] shadow-2xs'
                    : 'bg-slate-50/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-[#DCEEE4] dark:border-slate-700 hover:border-[#00965E]/50 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                <span className="whitespace-nowrap">
                  {fLabel}({toBengaliDigits(count, language)})
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-[#00965E] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={overviewSearch}
            onChange={(e) => setOverviewSearch(e.target.value)}
            placeholder={
              isBengali
                ? 'কাস্টমার বা বিক্রিত পণ্য খুঁজুন...'
                : 'Search sales by customer or item...'
            }
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-800 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 text-xs font-semibold focus:border-[#00965E] focus:outline-none dark:text-white"
          />
          {overviewSearch && (
            <button
              type="button"
              onClick={() => setOverviewSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Sales List */}
      {displayedSales.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border-[1.5px] border-[#CBEAD9] dark:border-slate-700 space-y-2">
          <ShoppingBag className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-500">{strings.noSalesYet}</p>
        </div>
      ) : (
        <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
          {displayedSales.map((tx, index) => {
            const serialNum = displayedSales.length - index;
            const isCredit = tx.dueAmount > 0;
            const isPart = tx.dueAmount > 0 && tx.paidAmount > 0;
            return (
              <div
                key={tx.id}
                onClick={() => {
                  setSelectedSaleTx(tx);
                  setSubScreen('SALE_DETAIL');
                }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 hover:border-[#00965E] transition cursor-pointer flex items-center justify-between shadow-2xs gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-slate-700 border border-emerald-200 dark:border-slate-600 flex items-center justify-center text-[#00965E] shrink-0 mt-0.5">
                    {isCredit ? (
                      <CreditCard className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Banknote className="w-4 h-4 text-[#00965E]" />
                    )}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-extrabold text-[#00965E]">
                        #{toBengaliDigits(serialNum, language)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{tx.customerName || walkInLabel}</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isPart
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : isCredit
                            ? 'bg-red-50 border-red-300 text-red-700'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        }`}
                      >
                        {isPart
                          ? isBengali
                            ? 'আংশিক বাকি'
                            : 'Part Credit'
                          : isCredit
                          ? isBengali
                            ? 'বাকি'
                            : 'Credit'
                          : isBengali
                          ? 'নগদ'
                          : 'Cash'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {tx.title}
                    </p>
                    <p className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(tx.createdAt)}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-2 border-l border-slate-100 dark:border-slate-700">
                  <p className="text-base font-black text-slate-900 dark:text-white">
                    ৳{toBengaliDigits(formatMoney(tx.amount), language)}
                  </p>
                  {tx.dueAmount > 0 && (
                    <p className="text-[11px] font-bold text-red-600">
                      {isBengali ? 'বাকি' : 'Due'}: ৳
                      {toBengaliDigits(formatMoney(tx.dueAmount), language)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
