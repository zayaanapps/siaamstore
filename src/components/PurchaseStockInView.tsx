import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  PackagePlus,
  Search,
  Plus,
  Minus,
  Trash2,
  RotateCcw,
  Truck,
  Check,
  AlertTriangle,
  FileDown,
  Printer,
  X,
  Clock,
  ShoppingBag,
  UserPlus,
  Sparkles,
  Receipt,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  AppLanguage,
  CartItem,
  Product,
  StoreTransaction,
  Supplier,
  formatMoney,
  formatTimestamp,
  isProductLowStock,
  parseLineItems,
  parseUserNote,
  toBengaliDigits,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';

interface PurchaseStockInViewProps {
  products: Product[];
  suppliers: Supplier[];
  transactions: StoreTransaction[];
  strings: DokanTranslations;
  language: AppLanguage;
  initialSupplierId?: string;
  onBack: () => void;
  onOpenSuppliers: () => void;
  onRecordMultiItemPurchase: (params: {
    cartItems: CartItem[];
    paidAmount: number;
    selectedSupplier: Supplier | null;
    newSupplierName: string;
    updateBuyingPrice: boolean;
    notes: string;
  }) => Promise<void>;
  onVoidPurchase: (purchaseTx: StoreTransaction) => Promise<void>;
}

type PurchaseTab = 'NEW_PURCHASE' | 'HISTORY';
type PurchaseTimeFilter = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_YEAR' | 'ALL';
type PurchasePaymentMode = 'FULL_CASH' | 'FULL_DUE' | 'PART_DUE';
type HistoryPayFilter = 'ALL' | 'PAID' | 'DUE';

const AVAILABLE_UNITS = ['pcs', 'kg', 'gm', 'ltr', 'box'];

export const PurchaseStockInView: React.FC<PurchaseStockInViewProps> = ({
  products,
  suppliers,
  transactions,
  strings,
  language,
  initialSupplierId = '',
  onBack,
  onOpenSuppliers,
  onRecordMultiItemPurchase,
  onVoidPurchase,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const [activeTab, setActiveTab] = useState<PurchaseTab>('NEW_PURCHASE');

  // Product entry state
  const [productSearch, setProductSearch] = useState('');
  const [selProdId, setSelProdId] = useState('');
  const [selQty, setSelQty] = useState('10');
  const [selUnit, setSelUnit] = useState('pcs');
  const [selUnitCost, setSelUnitCost] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<CartItem[]>([]);

  // Supplier & Payment state
  const [supplierSearch, setSupplierSearch] = useState('');
  const [purchaseSupplierId, setPurchaseSupplierId] = useState(initialSupplierId);
  const [isNewSupplier, setIsNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [paymentMode, setPaymentMode] = useState<PurchasePaymentMode>('FULL_CASH');
  const [partCashPaid, setPartCashPaid] = useState('');
  const [updateBuyingPrice, setUpdateBuyingPrice] = useState(true);
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // History filter state
  const [timeFilter, setTimeFilter] = useState<PurchaseTimeFilter>('THIS_MONTH');
  const [payFilter, setPayFilter] = useState<HistoryPayFilter>('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [voidTargetTx, setVoidTargetTx] = useState<StoreTransaction | null>(null);
  const [receiptTx, setReceiptTx] = useState<StoreTransaction | null>(null);

  // PDF Export state
  const [showPdfReport, setShowPdfReport] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfSheetRef = useRef<HTMLDivElement | null>(null);

  // Time boundaries
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
  const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
    0
  ).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();

  const allPurchases = useMemo(
    () => transactions.filter((t) => t.type === 'PURCHASE'),
    [transactions]
  );

  const todayPurchases = useMemo(
    () =>
      allPurchases.filter(
        (t) => (t.createdAt ? t.createdAt.toMillis() : Date.now()) >= startOfToday
      ),
    [allPurchases, startOfToday]
  );
  const weekPurchases = useMemo(
    () =>
      allPurchases.filter(
        (t) => (t.createdAt ? t.createdAt.toMillis() : Date.now()) >= startOfWeek
      ),
    [allPurchases, startOfWeek]
  );
  const monthPurchases = useMemo(
    () =>
      allPurchases.filter(
        (t) => (t.createdAt ? t.createdAt.toMillis() : Date.now()) >= startOfMonth
      ),
    [allPurchases, startOfMonth]
  );
  const yearPurchases = useMemo(
    () =>
      allPurchases.filter(
        (t) => (t.createdAt ? t.createdAt.toMillis() : Date.now()) >= startOfYear
      ),
    [allPurchases, startOfYear]
  );

  const todayTotal = useMemo(
    () => todayPurchases.reduce((s, t) => s + t.amount, 0),
    [todayPurchases]
  );
  const monthTotal = useMemo(
    () => monthPurchases.reduce((s, t) => s + t.amount, 0),
    [monthPurchases]
  );
  const totalUnpaidPurchase = useMemo(
    () => suppliers.reduce((s, sup) => s + Math.max(0, sup.payableBalance), 0),
    [suppliers]
  );

  // Low stock / out of stock quick suggestions
  const lowStockProducts = useMemo(
    () =>
      [...products]
        .filter(isProductLowStock)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 10),
    [products]
  );

  // Chronological Supplier SL Map
  const supplierSlMap = useMemo(() => {
    const sorted = [...suppliers].sort((a, b) => {
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
    sorted.forEach((s, i) => map.set(s.id, i + 1));
    return map;
  }, [suppliers]);

  // Filtered products for picker search
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.quality || '').toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  // Filtered suppliers for supplier search
  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => {
      const sl = supplierSlMap.get(s.id) || 0;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.company || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        `#${sl}` === q ||
        String(sl) === q
      );
    });
  }, [suppliers, supplierSearch, supplierSlMap]);

  // Cart totals
  const purchaseTotal = useMemo(
    () =>
      purchaseItems.reduce(
        (acc, item) => acc + item.quantity * item.customUnitPrice,
        0
      ),
    [purchaseItems]
  );

  const computedCashPaid =
    paymentMode === 'FULL_CASH'
      ? purchaseTotal
      : paymentMode === 'FULL_DUE'
      ? 0
      : Math.min(purchaseTotal, Math.max(0, Number(partCashPaid) || 0));

  const computedPayableDue = Math.max(0, purchaseTotal - computedCashPaid);

  const selectedProductObj = products.find((p) => p.id === selProdId) || null;

  const addProductToPurchaseCart = (
    prod: Product,
    qtyVal?: number,
    costVal?: number,
    unitVal?: string
  ) => {
    const q = Math.max(0.1, qtyVal ?? (Number(selQty) || 1));
    const c = Math.max(0, costVal ?? (selUnitCost !== '' ? Number(selUnitCost) : prod.buyPrice));
    const u = unitVal || prod.unit || 'pcs';

    setPurchaseItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === prod.id);
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx
            ? {
                ...item,
                quantity: Number((item.quantity + q).toFixed(2)),
                customUnitPrice: c,
                customUnit: u,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product: prod,
          quantity: q,
          customUnit: u,
          customUnitPrice: c,
        },
      ];
    });
    setFormError(null);
  };

  const handleRecordPurchase = async () => {
    setFormError(null);
    if (purchaseItems.length === 0) {
      setFormError(
        isBengali
          ? 'স্টক ইন করতে অন্তত একটি পণ্য যোগ করুন।'
          : 'Please add at least one product to stock in.'
      );
      return;
    }

    if (
      computedPayableDue > 0 &&
      (isNewSupplier ? !newSupplierName.trim() : !purchaseSupplierId)
    ) {
      setFormError(
        isBengali
          ? 'বাকি মাল কেনার জন্য একজন সাপ্লায়ার নির্বাচন করুন অথবা নতুন সাপ্লায়ারের নাম লিখুন।'
          : 'Please select a supplier or enter a new supplier name for credit purchase.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const sup =
        !isNewSupplier && purchaseSupplierId
          ? suppliers.find((s) => s.id === purchaseSupplierId) || null
          : null;
      const freshPurchaseItems = purchaseItems.map((item) => {
        const liveProd = products.find((p) => p.id === item.product.id);
        return liveProd ? { ...item, product: liveProd } : item;
      });
      await onRecordMultiItemPurchase({
        cartItems: freshPurchaseItems,
        paidAmount: computedCashPaid,
        selectedSupplier: sup,
        newSupplierName: isNewSupplier ? newSupplierName.trim() : '',
        updateBuyingPrice,
        notes: purchaseNotes.trim(),
      });
      setPurchaseItems([]);
      setPartCashPaid('');
      setPurchaseNotes('');
      setNewSupplierName('');
      setIsNewSupplier(false);
      setPaymentMode('FULL_CASH');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered history list
  const periodPurchases =
    timeFilter === 'TODAY'
      ? todayPurchases
      : timeFilter === 'THIS_WEEK'
      ? weekPurchases
      : timeFilter === 'THIS_MONTH'
      ? monthPurchases
      : timeFilter === 'THIS_YEAR'
      ? yearPurchases
      : allPurchases;

  const displayedPurchases = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return periodPurchases.filter((tx) => {
      if (payFilter === 'PAID' && tx.dueAmount > 0) return false;
      if (payFilter === 'DUE' && tx.dueAmount <= 0) return false;
      if (!q) return true;
      return (
        (tx.supplierName || '').toLowerCase().includes(q) ||
        (tx.title || '').toLowerCase().includes(q) ||
        parseUserNote(tx).toLowerCase().includes(q) ||
        String(tx.amount).includes(q)
      );
    });
  }, [periodPurchases, payFilter, historySearch]);

  const handleDownloadPdf = async (filename: string) => {
    if (!pdfSheetRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(pdfSheetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableWidth = pdfWidth - margin * 2;
      const imgHeight = (canvas.height * usableWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
      heightLeft -= pdfPageHeight - margin * 2;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
        heightLeft -= pdfPageHeight - margin * 2;
      }
      pdf.save(filename);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintSheet = () => {
    if (!pdfSheetRef.current) return;
    const htmlContent = pdfSheetRef.current.innerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${strings.appName} - Purchase Report</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Bengali", sans-serif; }
    body { margin: 0; padding: 16px; color: #0f172a; background: #ffffff; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-size: 11px; }
    th { background: #f1f5f9; font-weight: 800; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>${htmlContent}</body>
</html>`);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 1500);
    }, 250);
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-2.5 pb-8 space-y-2.5">
      {/* Compact & Beautiful Top Purchase Summary Card */}
      <div className="relative overflow-hidden rounded-xl border border-[#A7F3D0] dark:border-emerald-800/80 bg-gradient-to-r from-[#064E3B] via-[#047857] to-[#00965E] text-white shadow-sm px-3 py-2.5">
        <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10 blur-xl" />

        {/* Header Row */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-white/15">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-white cursor-pointer shrink-0"
              title={isBengali ? 'টুলস মেনুতে ফিরুন' : 'Back to Tools'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                  {strings.menuPurchases}
                </h1>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-white/15 border border-white/20 text-[9.5px] font-extrabold text-emerald-100 shrink-0">
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                  {toBengaliDigits(allPurchases.length, language)}
                </span>
              </div>
              <p className="text-[10px] text-emerald-100/90 truncate">
                {strings.menuPurchasesSub}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenSuppliers}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-extrabold text-[10.5px] border border-white/25 cursor-pointer whitespace-nowrap"
            >
              <Truck className="w-3.5 h-3.5 text-emerald-200" />
              <span>{isBengali ? 'সাপ্লায়ার খাতা' : 'Suppliers'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPdfReport(true)}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white text-[#064E3B] hover:bg-emerald-50 font-extrabold text-[10.5px] border border-emerald-200 cursor-pointer whitespace-nowrap"
            >
              <FileDown className="w-3.5 h-3.5 text-[#00965E]" />
              <span>{isBengali ? 'রিপোর্ট PDF' : 'Report PDF'}</span>
            </button>
          </div>
        </div>

        {/* Compact 3-Metric Summary Strip */}
        <div className="relative z-10 grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-black/20 border border-white/20 px-2 py-1.5">
            <span className="text-[9.5px] font-bold text-emerald-100 uppercase block truncate">
              {isBengali ? 'আজকের কেনা' : "Today's Stock In"} (
              {toBengaliDigits(todayPurchases.length, language)})
            </span>
            <p className="text-xs sm:text-sm font-black text-white mt-0.5 truncate">
              ৳{toBengaliDigits(formatMoney(todayTotal), language)}
            </p>
          </div>

          <div className="rounded-lg bg-white/12 border border-white/20 px-2 py-1.5">
            <span className="text-[9.5px] font-bold text-emerald-100 uppercase block truncate">
              {isBengali ? 'এই মাসের কেনা' : 'This Month'} (
              {toBengaliDigits(monthPurchases.length, language)})
            </span>
            <p className="text-xs sm:text-sm font-black text-emerald-200 mt-0.5 truncate">
              ৳{toBengaliDigits(formatMoney(monthTotal), language)}
            </p>
          </div>

          <div className="rounded-lg bg-white/12 border border-white/20 px-2 py-1.5">
            <span className="text-[9.5px] font-bold text-amber-200 uppercase block truncate">
              {isBengali ? 'মোট সাপ্লায়ার দেনা' : 'Supplier Payable'}
            </span>
            <p className="text-xs sm:text-sm font-black text-amber-200 mt-0.5 truncate">
              ৳{toBengaliDigits(formatMoney(totalUnpaidPurchase), language)}
            </p>
          </div>
        </div>
      </div>

      {/* 2-Tab Mode Switcher: New Purchase (Stock In) vs Purchase History */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white dark:bg-slate-800 border border-[#CBEAD9] dark:border-slate-700 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('NEW_PURCHASE')}
          className={`py-2 px-2 rounded-lg text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === 'NEW_PURCHASE'
              ? 'bg-[#00965E] text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
          }`}
        >
          <PackagePlus className="w-3.5 h-3.5" />
          <span>{isBengali ? '+ নতুন মাল কেনা (স্টক ইন)' : '+ New Stock In'}</span>
          {purchaseItems.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'NEW_PURCHASE'
                  ? 'bg-white text-[#00965E]'
                  : 'bg-[#00965E] text-white'
              }`}
            >
              {toBengaliDigits(purchaseItems.length, language)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('HISTORY')}
          className={`py-2 px-2 rounded-lg text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === 'HISTORY'
              ? 'bg-[#00965E] text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>{isBengali ? 'কেনার ইতিহাস' : 'Purchase History'}</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              activeTab === 'HISTORY'
                ? 'bg-white text-[#00965E]'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {toBengaliDigits(allPurchases.length, language)}
          </span>
        </button>
      </div>

      {/* TAB 1: NEW PURCHASE (STOCK IN) */}
      {activeTab === 'NEW_PURCHASE' && (
        <div className="space-y-2.5">
          {/* Quick Low-Stock Restock Strip */}
          {lowStockProducts.length > 0 && (
            <div className="bg-amber-50/80 dark:bg-amber-950/30 rounded-xl p-2.5 border border-amber-200 dark:border-amber-800/70 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>
                    {isBengali
                      ? `কম স্টক পণ্য — ১ ট্যাপে স্টক ইন লিস্টে যোগ করুন (${toBengaliDigits(
                          lowStockProducts.length,
                          language
                        )})`
                      : `Low Stock Items — Tap to Quick Add (${lowStockProducts.length})`}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lowStockProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelProdId(p.id);
                      setSelUnit(p.unit || 'pcs');
                      setSelUnitCost(String(p.buyPrice));
                      setSelQty('10');
                    }}
                    className={`px-2 py-1 rounded-lg border text-[10.5px] font-bold inline-flex items-center gap-1 transition cursor-pointer ${
                      selProdId === p.id
                        ? 'bg-[#00965E] text-white border-[#00965E]'
                        : 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800 text-slate-800 dark:text-slate-200 hover:border-[#00965E]'
                    }`}
                  >
                    <Plus className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[140px]">{p.name}</span>
                    <span
                      className={`text-[9.5px] font-black ${
                        selProdId === p.id ? 'text-amber-200' : 'text-red-600'
                      }`}
                    >
                      ({toBengaliDigits(p.stock, language)} {p.unit})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product Picker Box */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-[#CBEAD9] dark:border-slate-700 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-[#00965E]" />
                <span>
                  {isBengali ? '১. পণ্য ও কেনা দর নির্বাচন করুন' : '1. Select Product & Buying Cost'}
                </span>
              </h3>
              {selectedProductObj && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-[#00965E] dark:text-emerald-300">
                  {isBengali ? 'বর্তমান স্টক:' : 'Stock:'}{' '}
                  {toBengaliDigits(selectedProductObj.stock, language)}{' '}
                  {selectedProductObj.unit} •{' '}
                  {isBengali ? 'বিক্রয় দর:' : 'Sell:'} ৳
                  {toBengaliDigits(formatMoney(selectedProductObj.sellPrice), language)}
                </span>
              )}
            </div>

            {/* Product Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#00965E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={
                  isBengali
                    ? 'পণ্যের নাম, ক্যাটাগরি, কোয়ালিটি বা বারকোড খুঁজুন...'
                    : 'Search product by name, category, quality or barcode...'
                }
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-[#CBEAD9] dark:border-slate-700 text-xs font-medium focus:border-[#00965E] focus:outline-none dark:text-white"
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => setProductSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick matching dropdown when searching */}
            {productSearch.trim().length > 0 && (
              <div className="rounded-lg border border-[#00965E]/50 bg-white dark:bg-slate-900 max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-2">
                    {isBengali ? 'কোনো পণ্য পাওয়া যায়নি' : 'No matching product'}
                  </p>
                ) : (
                  filteredProducts.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelProdId(p.id);
                        setSelUnit(p.unit || 'pcs');
                        setSelUnitCost(String(p.buyPrice));
                        setProductSearch('');
                      }}
                      className="w-full px-2.5 py-1.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between text-[11px] cursor-pointer"
                    >
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {p.name}
                        {p.quality ? ` (${p.quality})` : ''}
                      </span>
                      <span className="text-slate-500 shrink-0 ml-2">
                        {isBengali ? 'স্টক:' : 'Stock:'} {p.stock} {p.unit} • ৳
                        {formatMoney(p.buyPrice)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Product Select + Qty + Unit + Unit Cost + Add Button */}
            <div className="grid grid-cols-12 gap-1.5">
              <div className="col-span-12 sm:col-span-5">
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  {isBengali ? 'পণ্য *' : 'Product *'}
                </label>
                <select
                  value={selProdId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelProdId(pid);
                    const found = products.find((p) => p.id === pid);
                    if (found) {
                      setSelUnit(found.unit || 'pcs');
                      setSelUnitCost(String(found.buyPrice));
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold dark:text-white"
                >
                  <option value="">
                    {isBengali ? 'পণ্য নির্বাচন করুন' : 'Select Product'}
                  </option>
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({isBengali ? 'স্টক:' : 'Stock:'} {p.stock} {p.unit} • ৳
                      {formatMoney(p.buyPrice)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-4 sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  {isBengali ? 'পরিমাণ *' : 'Qty *'}
                </label>
                <input
                  type="number"
                  min={0.1}
                  step="any"
                  value={selQty}
                  onChange={(e) => setSelQty(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="col-span-3 sm:col-span-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  {isBengali ? 'একক' : 'Unit'}
                </label>
                <select
                  value={selUnit}
                  onChange={(e) => setSelUnit(e.target.value)}
                  className="w-full px-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white"
                >
                  {AVAILABLE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-5 sm:col-span-4">
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  {isBengali ? 'কেনা দর (৳)' : 'Unit Cost (৳)'}
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={selUnitCost}
                    onChange={(e) => setSelUnitCost(e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={!selProdId}
                    onClick={() => {
                      const prod = products.find((p) => p.id === selProdId);
                      if (!prod) return;
                      addProductToPurchaseCart(
                        prod,
                        Math.max(0.1, Number(selQty) || 1),
                        Math.max(0, Number(selUnitCost) || prod.buyPrice),
                        selUnit
                      );
                      setSelProdId('');
                      setSelUnitCost('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#00965E] hover:bg-[#057A50] disabled:bg-slate-300 text-white font-extrabold text-xs shrink-0 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isBengali ? 'যোগ' : 'Add'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Qty Presets */}
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <span className="text-slate-400 font-semibold mr-1">
                {isBengali ? 'দ্রুত পরিমাণ:' : 'Quick Qty:'}
              </span>
              {[5, 10, 20, 25, 50, 100].map((qPreset) => (
                <button
                  key={qPreset}
                  type="button"
                  onClick={() => setSelQty(String(qPreset))}
                  className={`px-2 py-0.5 rounded-md border font-bold cursor-pointer ${
                    Number(selQty) === qPreset
                      ? 'bg-emerald-50 border-[#00965E] text-[#00965E]'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {toBengaliDigits(qPreset, language)}
                </button>
              ))}
            </div>
          </div>

          {/* Purchase Cart & Supplier Checkout Box */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-[#CBEAD9] dark:border-slate-700 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                <PackagePlus className="w-3.5 h-3.5 text-[#00965E]" />
                <span>
                  {isBengali ? '২. স্টক ইন তালিকা ও পেমেন্ট' : '2. Stock In Cart & Payment'} (
                  {toBengaliDigits(purchaseItems.length, language)})
                </span>
              </h3>
              {purchaseItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPurchaseItems([])}
                  className="text-[11px] font-bold text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{isBengali ? 'সব মুছুন' : 'Clear'}</span>
                </button>
              )}
            </div>

            {purchaseItems.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                {isBengali
                  ? 'উপরের তালিকা থেকে পণ্য যোগ করলে এখানে দেখাবে।'
                  : 'Add products above to build your stock-in list.'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {purchaseItems.map((item, idx) => (
                  <div
                    key={item.product.id}
                    className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-[#CBEAD9] dark:border-slate-700 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black text-[#00965E]">
                          #{toBengaliDigits(idx + 1, language)}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {item.product.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-black text-[#00965E]">
                          ৳
                          {toBengaliDigits(
                            formatMoney(item.quantity * item.customUnitPrice),
                            language
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPurchaseItems((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="p-1 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-1.5 items-center">
                      <div className="col-span-5 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPurchaseItems((prev) =>
                              prev
                                .map((it, i) =>
                                  i === idx
                                    ? { ...it, quantity: Math.max(0, it.quantity - 1) }
                                    : it
                                )
                                .filter((it) => it.quantity > 0)
                            )
                          }
                          className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min={0.1}
                          step="any"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = Math.max(0.1, Number(e.target.value) || 1);
                            setPurchaseItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, quantity: val } : it
                              )
                            );
                          }}
                          className="w-full text-center py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-extrabold dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPurchaseItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, quantity: it.quantity + 1 } : it
                              )
                            )
                          }
                          className="w-6 h-6 rounded-md bg-[#00965E] text-white flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="col-span-3">
                        <span className="block text-center py-0.5 px-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          {item.customUnit}
                        </span>
                      </div>

                      <div className="col-span-4 relative">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                          ৳
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={item.customUnitPrice}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setPurchaseItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, customUnitPrice: val } : it
                              )
                            );
                          }}
                          className="w-full pl-4 pr-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-extrabold text-right dark:text-white"
                          title={isBengali ? 'কেনা দর' : 'Unit Cost'}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total & Supplier Selection */}
            {purchaseItems.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between text-sm font-black">
                  <span className="text-slate-700 dark:text-slate-200">
                    {isBengali ? 'মোট কেনা বিল:' : 'Total Purchase Cost:'}
                  </span>
                  <span className="text-base text-[#00965E] dark:text-emerald-400">
                    ৳{toBengaliDigits(formatMoney(purchaseTotal), language)}
                  </span>
                </div>

                {/* Supplier Selector with Search + New Supplier Toggle */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {isBengali ? 'সাপ্লায়ার নির্বাচন' : 'Supplier'}{' '}
                      {computedPayableDue > 0 && (
                        <span className="text-red-600">*</span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsNewSupplier(!isNewSupplier)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00965E] hover:underline cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>
                        {isNewSupplier
                          ? isBengali
                            ? 'তালিকা থেকে নির্বাচন'
                            : 'Select Existing'
                          : isBengali
                          ? '+ নতুন সাপ্লায়ার'
                          : '+ New Supplier'}
                      </span>
                    </button>
                  </div>

                  {isNewSupplier ? (
                    <input
                      type="text"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      placeholder={
                        isBengali
                          ? 'নতুন সাপ্লায়ারের নাম লিখুন *'
                          : 'Enter new supplier name *'
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs dark:bg-slate-900 dark:text-white"
                    />
                  ) : (
                    <div className="space-y-1">
                      {suppliers.length > 0 && (
                        <div className="relative">
                          <Search className="w-3 h-3 text-[#00965E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={supplierSearch}
                            onChange={(e) => setSupplierSearch(e.target.value)}
                            placeholder={
                              isBengali
                                ? 'সাপ্লায়ারের নাম, কোম্পানি, মোবাইল বা #ক্রমিক খুঁজুন...'
                                : 'Search supplier by name, company, phone or #SL...'
                            }
                            className="w-full pl-7 pr-6 py-1 rounded-lg border border-[#CBEAD9] dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] dark:text-white"
                          />
                          {supplierSearch && (
                            <button
                              type="button"
                              onClick={() => setSupplierSearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      <select
                        value={purchaseSupplierId}
                        onChange={(e) => setPurchaseSupplierId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold dark:text-white"
                      >
                        <option value="">
                          {isBengali
                            ? 'সরাসরি বাজার থেকে কেনা (No Supplier)'
                            : 'Direct Market Purchase'}
                        </option>
                        {filteredSuppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            #{toBengaliDigits(supplierSlMap.get(s.id) || 1, language)}{' '}
                            {s.name}
                            {s.company ? ` (${s.company})` : ''}
                            {s.payableBalance > 0
                              ? ` - ${isBengali ? 'দেনা' : 'Owed'}: ৳${formatMoney(
                                  s.payableBalance
                                )}`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Payment Mode Selector */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {isBengali ? 'পরিশোধের ধরন' : 'Payment Mode'}
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        ['FULL_CASH', isBengali ? 'সম্পূর্ণ নগদ' : 'Full Cash'],
                        ['FULL_DUE', isBengali ? 'সম্পূর্ণ বাকি' : 'Full Due'],
                        ['PART_DUE', isBengali ? 'আংশিক বাকি' : 'Part Paid'],
                      ] as [PurchasePaymentMode, string][]
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={`py-1.5 px-1.5 rounded-lg text-[11px] font-extrabold border transition cursor-pointer ${
                          paymentMode === mode
                            ? 'bg-[#00965E] text-white border-[#00965E]'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {paymentMode === 'PART_DUE' && (
                    <div className="pt-0.5 space-y-1">
                      <input
                        type="number"
                        min={0}
                        max={purchaseTotal}
                        step="any"
                        value={partCashPaid}
                        onChange={(e) => setPartCashPaid(e.target.value)}
                        placeholder={
                          isBengali
                            ? 'এখন নগদ পরিশোধ (৳)'
                            : 'Cash Paid Now (৳)'
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white"
                      />
                      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                        {isBengali
                          ? `সাপ্লায়ার দেনা থাকবে: ৳${toBengaliDigits(
                              formatMoney(computedPayableDue),
                              language
                            )}`
                          : `Remaining Payable: ৳${formatMoney(computedPayableDue)}`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Update Buying Price Toggle & Challan Note */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateBuyingPrice}
                      onChange={(e) => setUpdateBuyingPrice(e.target.checked)}
                      className="rounded accent-[#00965E]"
                    />
                    <span>
                      {isBengali
                        ? 'পণ্যের নতুন কেনা দর অটো আপডেট করুন'
                        : 'Auto-update product buying prices'}
                    </span>
                  </label>
                </div>

                <input
                  type="text"
                  value={purchaseNotes}
                  onChange={(e) => setPurchaseNotes(e.target.value)}
                  placeholder={
                    isBengali
                      ? 'চালান নং / নোট (ঐচ্ছিক)'
                      : 'Invoice / Challan No. or Note (optional)'
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs dark:bg-slate-900 dark:text-white"
                />

                {formError && (
                  <p className="text-[11px] font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                    {formError}
                  </p>
                )}

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleRecordPurchase}
                  className="w-full py-2.5 rounded-xl bg-[#00B368] hover:bg-[#059658] disabled:bg-slate-300 text-white font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? isBengali
                        ? 'সংরক্ষণ হচ্ছে...'
                        : 'Saving Purchase...'
                      : `${
                          isBengali
                            ? 'মাল কেনা ও স্টক ইন সম্পন্ন করুন'
                            : 'Record Purchase & Stock In'
                        } • ৳${toBengaliDigits(
                          formatMoney(purchaseTotal),
                          language
                        )}`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PURCHASE HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-2">
          {/* Single-Line Time Filter Tabs */}
          <div className="grid grid-cols-5 gap-1 rounded-xl bg-white dark:bg-slate-800 p-1 border border-[#CBEAD9] dark:border-slate-700 shadow-2xs">
            {(
              [
                ['TODAY', isBengali ? 'আজ' : 'Today', todayPurchases.length],
                [
                  'THIS_WEEK',
                  isBengali ? 'সপ্তাহ' : 'Week',
                  weekPurchases.length,
                ],
                [
                  'THIS_MONTH',
                  isBengali ? 'এই মাস' : 'Month',
                  monthPurchases.length,
                ],
                [
                  'THIS_YEAR',
                  isBengali ? 'বছর' : 'Year',
                  yearPurchases.length,
                ],
                ['ALL', isBengali ? 'সব' : 'All', allPurchases.length],
              ] as [PurchaseTimeFilter, string, number][]
            ).map(([fKey, fLabel, count]) => (
              <button
                key={fKey}
                type="button"
                onClick={() => setTimeFilter(fKey)}
                className={`py-1.5 px-0.5 rounded-lg text-[9px] sm:text-xs font-extrabold whitespace-nowrap border transition cursor-pointer ${
                  timeFilter === fKey
                    ? 'bg-[#00965E] text-white border-[#007A4C]'
                    : 'bg-slate-50/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-[#DCEEE4] dark:border-slate-700'
                }`}
              >
                {fLabel}({toBengaliDigits(count, language)})
              </button>
            ))}
          </div>

          {/* Search & Paid/Due Filter */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#00965E] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder={
                  isBengali
                    ? 'সাপ্লায়ার, পণ্য বা চালান খুঁজুন...'
                    : 'Search supplier, product or note...'
                }
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#CBEAD9] dark:border-slate-700 text-xs dark:text-white"
              />
            </div>

            <div className="inline-flex rounded-xl border border-[#CBEAD9] dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 shrink-0 text-[10.5px] font-bold">
              {(
                [
                  ['ALL', isBengali ? 'সব' : 'All'],
                  ['PAID', isBengali ? 'নগদ' : 'Paid'],
                  ['DUE', isBengali ? 'বাকি' : 'Due'],
                ] as [HistoryPayFilter, string][]
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPayFilter(k)}
                  className={`px-2 py-1 rounded-lg cursor-pointer ${
                    payFilter === k
                      ? 'bg-[#00965E] text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Purchase History Cards */}
          {displayedPurchases.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 text-center border border-[#CBEAD9] dark:border-slate-700 space-y-1.5">
              <PackagePlus className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-500">
                {isBengali
                  ? 'এই সময়ে কোনো মাল কেনার রেকর্ড নেই'
                  : 'No purchases found for this filter'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedPurchases.map((tx, idx) => {
                const serial = displayedPurchases.length - idx;
                const isDue = tx.dueAmount > 0;
                const isPart = tx.dueAmount > 0 && tx.paidAmount > 0;
                const note = parseUserNote(tx);

                return (
                  <div
                    key={tx.id}
                    className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-[#CBEAD9] dark:border-slate-700 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 text-[10px] font-black text-[#00965E] shrink-0">
                          #{toBengaliDigits(serial, language)}
                        </span>
                        <span className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {tx.supplierName ||
                            (isBengali ? 'সরাসরি বাজার' : 'Direct Purchase')}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md border text-[9.5px] font-extrabold shrink-0 ${
                            isPart
                              ? 'bg-amber-50 border-amber-300 text-amber-800'
                              : isDue
                              ? 'bg-red-50 border-red-300 text-red-700'
                              : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          }`}
                        >
                          {isPart
                            ? isBengali
                              ? 'আংশিক বাকি'
                              : 'Part Due'
                            : isDue
                            ? isBengali
                              ? 'বাকি'
                              : 'Due'
                            : isBengali
                            ? 'নগদ'
                            : 'Cash'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setReceiptTx(tx)}
                          className="p-1 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-[#00965E] hover:bg-emerald-100 cursor-pointer"
                          title={isBengali ? 'চালান দেখুন' : 'View Challan'}
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setVoidTargetTx(tx)}
                          className="p-1 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                          title={
                            isBengali
                              ? 'ক্রয় বাতিল ও স্টক ফেরত'
                              : 'Void Purchase & Revert Stock'
                          }
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      {tx.title}
                      {note ? (
                        <span className="block text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                          {isBengali ? 'নোট:' : 'Note:'} {note}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10.5px]">
                      <span className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(tx.createdAt)}
                      </span>

                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-black text-slate-900 dark:text-white">
                          {isBengali ? 'মোট:' : 'Total:'} ৳
                          {toBengaliDigits(formatMoney(tx.amount), language)}
                        </span>
                        {tx.paidAmount > 0 && (
                          <span className="px-2 py-0.5 rounded-md border border-emerald-200 bg-emerald-50/70 font-bold text-[#00965E]">
                            {isBengali ? 'নগদ:' : 'Paid:'} ৳
                            {toBengaliDigits(formatMoney(tx.paidAmount), language)}
                          </span>
                        )}
                        {tx.dueAmount > 0 && (
                          <span className="px-2 py-0.5 rounded-md border border-red-200 bg-red-50 font-black text-red-600">
                            {isBengali ? 'বাকি:' : 'Due:'} ৳
                            {toBengaliDigits(formatMoney(tx.dueAmount), language)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Void Confirmation Modal */}
      {voidTargetTx && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {isBengali
                ? 'ক্রয় বাতিল ও স্টক সমন্বয় করবেন?'
                : 'Void Purchase & Revert Stock?'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isBengali
                ? `এই ক্রয়টি (${voidTargetTx.title} • ৳${formatMoney(
                    voidTargetTx.amount
                  )}) বাতিল করলে যোগ হওয়া স্টক এবং সাপ্লায়ার দেনা পূর্বাবস্থায় ফিরে যাবে।`
                : `Voiding "${voidTargetTx.title}" (৳${formatMoney(
                    voidTargetTx.amount
                  )}) will deduct the added stock and adjust supplier payable balance.`}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setVoidTargetTx(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {isBengali ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onVoidPurchase(voidTargetTx);
                  setVoidTargetTx(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                {isBengali ? 'হ্যাঁ, বাতিল করুন' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Challan / Voucher Detail Modal */}
      {receiptTx && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isBengali ? 'মাল কেনার চালান / ভাউচার' : 'Purchase Voucher / Challan'}
              </h3>
              <button
                type="button"
                onClick={() => setReceiptTx(null)}
                className="text-slate-400 hover:text-red-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs space-y-1">
              <p className="font-extrabold text-slate-900 dark:text-white">
                {isBengali ? 'সাপ্লায়ার:' : 'Supplier:'}{' '}
                {receiptTx.supplierName || (isBengali ? 'সরাসরি বাজার' : 'Direct')}
              </p>
              <p className="text-slate-500">
                {isBengali ? 'তারিখ:' : 'Date:'} {formatTimestamp(receiptTx.createdAt)}
              </p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700 border-y border-slate-200 dark:border-slate-700 text-xs">
              {parseLineItems(receiptTx).map((li, i) => (
                <div key={i} className="py-1.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {li.productName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {li.quantity} {li.unit} × ৳{formatMoney(li.unitPrice)}
                    </p>
                  </div>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    ৳{formatMoney(li.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between font-black text-slate-900 dark:text-white">
                <span>{isBengali ? 'মোট ক্রয় মূল্য' : 'Total Cost'}</span>
                <span>৳{formatMoney(receiptTx.amount)}</span>
              </div>
              <div className="flex justify-between font-bold text-[#00965E]">
                <span>{isBengali ? 'নগদ পরিশোধ' : 'Cash Paid'}</span>
                <span>৳{formatMoney(receiptTx.paidAmount)}</span>
              </div>
              {receiptTx.dueAmount > 0 && (
                <div className="flex justify-between font-bold text-red-600">
                  <span>{isBengali ? 'সাপ্লায়ার বাকি' : 'Payable Due'}</span>
                  <span>৳{formatMoney(receiptTx.dueAmount)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Purchase History PDF Report Modal */}
      {showPdfReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                {isBengali
                  ? 'মাল কেনা (স্টক ইন) রিপোর্ট (PDF)'
                  : 'Purchase (Stock In) Report (PDF)'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={() =>
                    handleDownloadPdf('Siaam_Store_Purchase_Report.pdf')
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#00965E] text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>
                    {isGeneratingPdf
                      ? isBengali
                        ? 'তৈরি হচ্ছে...'
                        : 'Generating...'
                      : isBengali
                      ? 'পিডিএফ ডাউনলোড'
                      : 'Download PDF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintSheet}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isBengali ? 'প্রিন্ট' : 'Print'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPdfReport(false)}
                  className="p-1.5 rounded-lg border border-slate-300 text-slate-500 hover:text-red-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50 dark:bg-slate-950">
              <div
                ref={pdfSheetRef}
                className="bg-white text-slate-900 rounded-xl p-5 border border-slate-200 space-y-4 max-w-[800px] mx-auto"
              >
                <div className="border-b-2 border-[#00965E] pb-3 flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-black text-[#064E3B]">
                      {strings.appName}
                    </h2>
                    <p className="text-[11px] text-slate-600">{strings.subtitle}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-300 text-[#064E3B] text-xs font-black">
                      {isBengali ? 'স্টক ইন / ক্রয় রিপোর্ট' : 'Purchase / Stock In Report'}
                    </span>
                    <p className="text-[10.5px] text-slate-500 mt-1">
                      {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-2 py-1.5 text-center">#</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'তারিখ' : 'Date'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'সাপ্লায়ার' : 'Supplier'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'পণ্যসমূহ' : 'Items'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">
                        {isBengali ? 'মোট' : 'Total'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">
                        {isBengali ? 'নগদ' : 'Paid'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">
                        {isBengali ? 'বাকি' : 'Due'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPurchases.map((tx, idx) => (
                      <tr key={tx.id}>
                        <td className="border border-slate-300 px-2 py-1 text-center font-bold">
                          {toBengaliDigits(idx + 1, language)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 whitespace-nowrap">
                          {formatTimestamp(tx.createdAt, false)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 font-bold">
                          {tx.supplierName || 'Direct'}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">{tx.title}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-bold">
                          ৳{toBengaliDigits(formatMoney(tx.amount), language)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right text-[#00965E] font-bold">
                          ৳{toBengaliDigits(formatMoney(tx.paidAmount), language)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right text-red-600 font-bold">
                          ৳{toBengaliDigits(formatMoney(tx.dueAmount), language)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black">
                      <td colSpan={4} className="border border-slate-300 px-2 py-1.5 text-right">
                        {isBengali ? 'সর্বমোট:' : 'Grand Total:'}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right">
                        ৳
                        {toBengaliDigits(
                          formatMoney(
                            displayedPurchases.reduce((s, t) => s + t.amount, 0)
                          ),
                          language
                        )}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right text-[#00965E]">
                        ৳
                        {toBengaliDigits(
                          formatMoney(
                            displayedPurchases.reduce((s, t) => s + t.paidAmount, 0)
                          ),
                          language
                        )}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right text-red-600">
                        ৳
                        {toBengaliDigits(
                          formatMoney(
                            displayedPurchases.reduce((s, t) => s + t.dueAmount, 0)
                          ),
                          language
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
