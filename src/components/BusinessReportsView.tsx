import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BarChart3,
  FileDown,
  Printer,
  X,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Users,
  Wallet,
  Receipt,
  ShoppingBag,
  Award,
  Layers,
  Calendar,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  AppLanguage,
  Customer,
  DailyStats,
  Product,
  StoreTransaction,
  Supplier,
  formatMoney,
  isProductLowStock,
  parseLineItems,
  toBengaliDigits,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';

interface BusinessReportsViewProps {
  stats: DailyStats;
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  transactions: StoreTransaction[];
  startingCashBalance: number;
  strings: DokanTranslations;
  language: AppLanguage;
  onBack: () => void;
  onOpenDueReports: () => void;
}

type ReportPeriod = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_YEAR' | 'ALL';
type AnalyticsTab = 'OVERVIEW' | 'PRODUCTS' | 'CUSTOMERS';

export const BusinessReportsView: React.FC<BusinessReportsViewProps> = ({
  stats,
  products,
  customers,
  suppliers,
  transactions,
  startingCashBalance,
  strings,
  language,
  onBack,
  onOpenDueReports,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const fmtNum = (val: string | number) => toBengaliDigits(val, language);

  const [period, setPeriod] = useState<ReportPeriod>('THIS_MONTH');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('OVERVIEW');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfSheetRef = useRef<HTMLDivElement | null>(null);

  // Time boundaries
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  const getPeriodLabel = (p: ReportPeriod) => {
    const map: Record<ReportPeriod, { bn: string; en: string }> = {
      TODAY: { bn: 'আজ', en: 'Today' },
      THIS_WEEK: { bn: 'সপ্তাহ', en: '7 Days' },
      THIS_MONTH: { bn: 'এই মাস', en: 'Month' },
      THIS_YEAR: { bn: 'এই বছর', en: 'Year' },
      ALL: { bn: 'সব সময়', en: 'All Time' },
    };
    return isBengali ? map[p].bn : map[p].en;
  };

  // Transactions in selected period
  const periodTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (period === 'ALL') return true;
      const ms = tx.createdAt?.toMillis?.() ?? Date.now();
      if (period === 'TODAY') return ms >= startOfToday;
      if (period === 'THIS_WEEK') return ms >= startOfWeek;
      if (period === 'THIS_MONTH') return ms >= startOfMonth;
      if (period === 'THIS_YEAR') return ms >= startOfYear;
      return true;
    });
  }, [
    transactions,
    period,
    startOfToday,
    startOfWeek,
    startOfMonth,
    startOfYear,
  ]);

  // Core Profit & Loss and Cash Flow metrics for period
  const financials = useMemo(() => {
    let salesRevenue = 0;
    let salesCount = 0;
    let salesCash = 0;
    let salesDue = 0;
    let grossProfit = 0;
    let dueCollected = 0;
    let purchasesTotal = 0;
    let purchasesCount = 0;
    let purchasesCash = 0;
    let supplierPaid = 0;
    let expensesTotal = 0;
    let expensesCount = 0;

    for (const tx of periodTransactions) {
      switch (tx.type) {
        case 'SALE':
          salesRevenue += tx.amount;
          salesCount += 1;
          salesCash += tx.paidAmount;
          salesDue += tx.dueAmount;
          grossProfit += tx.profitAmount;
          break;
        case 'RECEIVE_PAYMENT':
          dueCollected += Math.max(tx.paidAmount, tx.amount);
          break;
        case 'PURCHASE':
          purchasesTotal += tx.amount;
          purchasesCount += 1;
          purchasesCash += tx.paidAmount;
          break;
        case 'SUPPLIER_PAYMENT':
          supplierPaid += Math.max(tx.paidAmount, tx.amount);
          break;
        case 'EXPENSE':
          expensesTotal += Math.max(tx.paidAmount, tx.amount);
          expensesCount += 1;
          break;
      }
    }

    const netProfit = grossProfit - expensesTotal;
    const grossMarginPct =
      salesRevenue > 0 ? Math.round((grossProfit / salesRevenue) * 100) : 0;
    const netMarginPct =
      salesRevenue > 0 ? Math.round((netProfit / salesRevenue) * 100) : 0;
    const periodCashIn = salesCash + dueCollected;
    const periodCashOut = purchasesCash + supplierPaid + expensesTotal;

    return {
      salesRevenue,
      salesCount,
      salesCash,
      salesDue,
      grossProfit,
      dueCollected,
      purchasesTotal,
      purchasesCount,
      purchasesCash,
      supplierPaid,
      expensesTotal,
      expensesCount,
      netProfit,
      grossMarginPct,
      netMarginPct,
      periodCashIn,
      periodCashOut,
      periodNetCash: periodCashIn - periodCashOut,
    };
  }, [periodTransactions]);

  // Inventory & Balance Sheet metrics
  const storeValuation = useMemo(() => {
    const costValue = products.reduce(
      (acc, p) => acc + p.buyPrice * Math.max(0, p.stock),
      0
    );
    const retailValue = products.reduce(
      (acc, p) => acc + p.sellPrice * Math.max(0, p.stock),
      0
    );
    const totalUnits = products.reduce((acc, p) => acc + Math.max(0, p.stock), 0);
    const lowStockItems = products.filter((p) => isProductLowStock(p));
    const outOfStockCount = products.filter((p) => p.stock <= 0).length;
    const totalCustomerDues = customers.reduce(
      (acc, c) => acc + Math.max(0, c.totalDue),
      0
    );
    const totalSupplierPayables = suppliers.reduce(
      (acc, s) => acc + Math.max(0, s.payableBalance),
      0
    );
    const cashInHand =
      startingCashBalance + stats.totalCashIn - stats.totalCashOut;

    return {
      costValue,
      retailValue,
      expectedProfit: Math.max(0, retailValue - costValue),
      totalUnits,
      lowStockItems,
      outOfStockCount,
      totalCustomerDues,
      totalSupplierPayables,
      cashInHand,
    };
  }, [products, customers, suppliers, startingCashBalance, stats]);

  // 7-Day Daily Sales & Profit Mini Chart
  const last7DaysTrend = useMemo(() => {
    const days: Array<{
      label: string;
      start: number;
      end: number;
      sales: number;
      profit: number;
    }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = d.getTime();
      const end = start + 24 * 60 * 60 * 1000;
      const label = d.toLocaleDateString(isBengali ? 'bn-BD' : 'en-US', {
        weekday: 'short',
      });
      days.push({ label, start, end, sales: 0, profit: 0 });
    }

    for (const tx of transactions) {
      if (tx.type !== 'SALE') continue;
      const ms = tx.createdAt?.toMillis?.() ?? Date.now();
      const bucket = days.find((b) => ms >= b.start && ms < b.end);
      if (bucket) {
        bucket.sales += tx.amount;
        bucket.profit += tx.profitAmount;
      }
    }

    const maxSale = Math.max(...days.map((d) => d.sales), 1);
    return { days, maxSale };
  }, [transactions, isBengali]);

  // Expense Category Breakdown for Period
  const expenseCategories = useMemo(() => {
    const map = new Map<string, { category: string; total: number; count: number }>();
    let grand = 0;
    for (const tx of periodTransactions) {
      if (tx.type !== 'EXPENSE') continue;
      const cat = tx.category || 'Other';
      const amt = Math.max(tx.paidAmount, tx.amount);
      const curr = map.get(cat) || { category: cat, total: 0, count: 0 };
      curr.total += amt;
      curr.count += 1;
      map.set(cat, curr);
      grand += amt;
    }
    return {
      grand,
      items: Array.from(map.values()).sort((a, b) => b.total - a.total),
    };
  }, [periodTransactions]);

  // Top Selling Products in Period
  const topProducts = useMemo(() => {
    const map = new Map<
      string,
      { name: string; unit: string; qty: number; revenue: number; orders: number }
    >();
    for (const tx of periodTransactions) {
      if (tx.type !== 'SALE') continue;
      const items = parseLineItems(tx);
      for (const item of items) {
        const key = (item.productId || item.productName).toLowerCase();
        const curr = map.get(key) || {
          name: item.productName,
          unit: item.unit,
          qty: 0,
          revenue: 0,
          orders: 0,
        };
        curr.qty += item.quantity;
        curr.revenue += item.lineTotal;
        curr.orders += 1;
        map.set(key, curr);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 12);
  }, [periodTransactions]);

  // Top Customers in Period
  const topCustomers = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        customerId: string;
        totalBought: number;
        totalPaid: number;
        invoices: number;
        currentDue: number;
      }
    >();
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    for (const tx of periodTransactions) {
      if (tx.type !== 'SALE') continue;
      const name = tx.customerName?.trim() || (isBengali ? 'নগদ কাস্টমার' : 'Walk-in');
      const key = tx.customerId || `walkin-${name.toLowerCase()}`;
      const matched = tx.customerId ? customerMap.get(tx.customerId) : undefined;
      const curr = map.get(key) || {
        name: matched?.name || name,
        customerId: tx.customerId || '',
        totalBought: 0,
        totalPaid: 0,
        invoices: 0,
        currentDue: matched ? Math.max(0, matched.totalDue) : 0,
      };
      curr.totalBought += tx.amount;
      curr.totalPaid += tx.paidAmount;
      curr.invoices += 1;
      map.set(key, curr);
    }

    return Array.from(map.values())
      .sort((a, b) => b.totalBought - a.totalBought)
      .slice(0, 12);
  }, [periodTransactions, customers, isBengali]);

  // PDF generation & print
  const handleDownloadPdf = async () => {
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
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const printableW = pageW - margin * 2;
      const printableH = pageH - margin * 2;
      const imgH = (canvas.height * printableW) / canvas.width;

      let heightLeft = imgH;
      let position = margin;
      pdf.addImage(imgData, 'PNG', margin, position, printableW, imgH);
      heightLeft -= printableH;

      while (heightLeft > 0) {
        position = margin - (imgH - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, printableW, imgH);
        heightLeft -= printableH;
      }

      const stamp = new Date().toISOString().slice(0, 10);
      pdf.save(`Siaam_Store_Business_Report_${stamp}.pdf`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintSheet = () => {
    if (!pdfSheetRef.current) return;
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
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Siaam Store — Business Report</title>
          <style>
            * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            body { margin: 16px; color: #0f172a; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: 700; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>${pdfSheetRef.current.innerHTML}</body>
      </html>
    `);
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3.5 pb-24">
      {/* Decorated Emerald Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#00965E] via-[#008452] to-[#006640] text-white p-4 shadow-md border border-emerald-400/20">
        <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-10 w-40 h-40 rounded-full bg-emerald-300/15 blur-2xl" />

        <div className="relative space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/15 text-xs font-bold cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isBengali ? 'টুলস' : 'Tools'}</span>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-emerald-50" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black tracking-tight leading-none">
                    {strings.menuBusinessReports}
                  </h2>
                  <p className="text-[10px] text-emerald-100/90 font-medium mt-0.5">
                    {isBengali
                      ? 'লাভ-ক্ষতি, স্টক মূল্য ও বিক্রি বিশ্লেষণ'
                      : 'Profit & Loss, valuation & sales insights'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenDueReports}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/15 text-xs font-bold cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isBengali ? 'বাকি রিপোর্ট' : 'Due Reports'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPdfModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white text-[#007448] hover:bg-emerald-50 text-xs font-extrabold cursor-pointer shadow-xs"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>{isBengali ? 'রিপোর্ট PDF' : 'Report PDF'}</span>
              </button>
            </div>
          </div>

          {/* Single-Line Period Selector inside Hero */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {(
              ['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'THIS_YEAR', 'ALL'] as const
            ).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-xl text-[11px] font-extrabold whitespace-nowrap cursor-pointer border transition-colors ${
                  period === p
                    ? 'bg-white text-[#007448] border-white shadow-2xs'
                    : 'bg-white/12 text-emerald-50 border-white/15 hover:bg-white/20'
                }`}
              >
                {getPeriodLabel(p)}
              </button>
            ))}
          </div>

          {/* 3-Column Hero Financial Strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/12 border border-white/20 px-2.5 py-2.5">
              <div className="flex items-center justify-between text-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                  {isBengali ? 'মোট বিক্রি' : 'Sales'}
                </p>
                <ShoppingBag className="w-3 h-3 opacity-80 shrink-0" />
              </div>
              <p className="text-sm sm:text-base font-black mt-1">
                ৳{fmtNum(formatMoney(financials.salesRevenue))}
              </p>
              <p className="text-[10px] text-emerald-100/80 font-semibold">
                {fmtNum(financials.salesCount)}{' '}
                {isBengali ? 'টি বিল' : 'invoices'}
              </p>
            </div>

            <div className="rounded-xl bg-white/12 border border-white/20 px-2.5 py-2.5">
              <div className="flex items-center justify-between text-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                  {isBengali ? 'মোট লাভ' : 'Gross Profit'}
                </p>
                <TrendingUp className="w-3 h-3 opacity-80 shrink-0" />
              </div>
              <p className="text-sm sm:text-base font-black mt-1">
                ৳{fmtNum(formatMoney(financials.grossProfit))}
              </p>
              <p className="text-[10px] text-emerald-100/80 font-semibold">
                {fmtNum(financials.grossMarginPct)}%{' '}
                {isBengali ? 'মার্জিন' : 'margin'}
              </p>
            </div>

            <div className="rounded-xl bg-white text-slate-900 px-2.5 py-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                  {isBengali ? 'নিট লাভ' : 'Net Profit'}
                </p>
                {financials.netProfit >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-[#00965E] shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-600 shrink-0" />
                )}
              </div>
              <p
                className={`text-sm sm:text-base font-black mt-1 ${
                  financials.netProfit >= 0 ? 'text-[#00965E]' : 'text-red-600'
                }`}
              >
                {financials.netProfit < 0 ? '-' : ''}৳
                {fmtNum(formatMoney(Math.abs(financials.netProfit)))}
              </p>
              <p className="text-[10px] text-slate-500 font-bold">
                {isBengali ? 'খরচ বাদে' : 'After expenses'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Tab Switcher */}
      <div className="grid grid-cols-3 gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs">
        {(
          [
            { id: 'OVERVIEW', bn: 'লাভ-ক্ষতি ও স্টক', en: 'P&L & Stock' },
            { id: 'PRODUCTS', bn: 'শীর্ষ পণ্য', en: 'Top Products' },
            { id: 'CUSTOMERS', bn: 'শীর্ষ কাস্টমার', en: 'Top Customers' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-extrabold cursor-pointer transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-[#00965E] to-[#007D4E] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-emerald-50/60 dark:hover:bg-slate-700/50'
            }`}
          >
            {isBengali ? tab.bn : tab.en}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0.01, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
        transformTemplate={(_, generated) =>
          generated === 'none' || generated === 'translateY(0px)'
            ? 'none'
            : generated
        }
      >
      {/* ================================================================= */}
      {/* TAB 1: OVERVIEW — P&L, VALUATION, 7-DAY CHART & EXPENSE BREAKDOWN */}
      {/* ================================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-3.5">
          {/* Profit & Loss Statement Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-50/90 to-teal-50/40 dark:from-slate-900 dark:to-slate-900/70 border-b border-emerald-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#00965E]" />
                <h3 className="text-xs font-black text-slate-800 dark:text-white">
                  {isBengali
                    ? `লাভ-ক্ষতি ও লেনদেন সারসংক্ষেপ (${getPeriodLabel(period)})`
                    : `Profit & Loss Summary (${getPeriodLabel(period)})`}
                </h3>
              </div>
              <span className="text-[11px] font-extrabold text-[#00965E]">
                {fmtNum(financials.netMarginPct)}%{' '}
                {isBengali ? 'নিট মার্জিন' : 'Net Margin'}
              </span>
            </div>

            <div className="p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-900/50">
                <p className="text-[10px] font-bold text-slate-500">
                  {isBengali ? 'নগদ বিক্রি' : 'Cash Sales'}
                </p>
                <p className="text-sm font-black text-[#00965E] mt-0.5">
                  ৳{fmtNum(formatMoney(financials.salesCash))}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-900/50">
                <p className="text-[10px] font-bold text-slate-500">
                  {isBengali ? 'বাকি বিক্রি' : 'Credit Sales'}
                </p>
                <p className="text-sm font-black text-amber-700 dark:text-amber-400 mt-0.5">
                  ৳{fmtNum(formatMoney(financials.salesDue))}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/25 border border-blue-200/80 dark:border-blue-900/50">
                <p className="text-[10px] font-bold text-slate-500">
                  {isBengali ? 'বাকি আদায়' : 'Due Collected'}
                </p>
                <p className="text-sm font-black text-blue-700 dark:text-blue-400 mt-0.5">
                  ৳{fmtNum(formatMoney(financials.dueCollected))}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-bold text-slate-500">
                  {isBengali ? 'মাল ক্রয় (স্টক ইন)' : 'Stock Purchases'} (
                  {fmtNum(financials.purchasesCount)})
                </p>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                  ৳{fmtNum(formatMoney(financials.purchasesTotal))}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-red-50/60 dark:bg-red-950/25 border border-red-200/80 dark:border-red-900/50">
                <p className="text-[10px] font-bold text-slate-500">
                  {isBengali ? 'দোকান খরচ' : 'Shop Expenses'} (
                  {fmtNum(financials.expensesCount)})
                </p>
                <p className="text-sm font-black text-red-600 mt-0.5">
                  -৳{fmtNum(formatMoney(financials.expensesTotal))}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-bold text-slate-500">
                  {isBengali ? 'সাপ্লায়ার পরিশোধ' : 'Supplier Paid'}
                </p>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                  ৳{fmtNum(formatMoney(financials.supplierPaid))}
                </p>
              </div>
            </div>
          </div>

          {/* 7-Day Sales Visual Bar Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border-[1.5px] border-slate-200 dark:border-slate-700 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#00965E]" />
                <h3 className="text-xs font-black text-slate-800 dark:text-white">
                  {isBengali
                    ? 'গত ৭ দিনের বিক্রির গ্রাফ'
                    : 'Last 7 Days Sales Trend'}
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                {isBengali ? 'দৈনিক বিক্রি (৳)' : 'Daily Sales (৳)'}
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 items-end h-36 pt-4">
              {last7DaysTrend.days.map((d, idx) => {
                const heightPct =
                  d.sales > 0
                    ? Math.max(10, Math.round((d.sales / last7DaysTrend.maxSale) * 100))
                    : 4;
                const isToday = idx === 6;
                return (
                  <div
                    key={d.start}
                    className="flex flex-col items-center justify-end h-full gap-1"
                  >
                    <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 truncate max-w-full">
                      {d.sales > 0 ? `৳${fmtNum(formatMoney(d.sales))}` : '—'}
                    </span>
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        className={`w-full max-w-[34px] rounded-t-lg transition-all ${
                          isToday
                            ? 'bg-gradient-to-t from-[#007448] to-[#00B368]'
                            : d.sales > 0
                            ? 'bg-emerald-300 dark:bg-emerald-700'
                            : 'bg-slate-100 dark:bg-slate-700/60'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-bold ${
                        isToday
                          ? 'text-[#00965E] font-black'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inventory Valuation & Store Assets Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-[#CBEAD9] dark:border-slate-700 overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#00965E]" />
                <h3 className="text-xs font-black text-slate-800 dark:text-white">
                  {isBengali
                    ? 'গুদাম স্টক ও ব্যবসার সম্পদ'
                    : 'Inventory Valuation & Store Position'}
                </h3>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                {fmtNum(products.length)} {isBengali ? 'টি পণ্য' : 'items'}
              </span>
            </div>

            <div className="p-3.5 space-y-2.5">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-500">
                    {isBengali ? 'স্টক কেনা মূল্য' : 'Stock Cost'}
                  </p>
                  <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                    ৳{fmtNum(formatMoney(storeValuation.costValue))}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                  <p className="text-[10px] font-bold text-slate-500">
                    {isBengali ? 'স্টক বিক্রয় মূল্য' : 'Retail Value'}
                  </p>
                  <p className="text-sm font-black text-[#00965E] mt-0.5">
                    ৳{fmtNum(formatMoney(storeValuation.retailValue))}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60">
                  <p className="text-[10px] font-bold text-slate-500">
                    {isBengali ? 'সম্ভাব্য লাভ' : 'Est. Profit'}
                  </p>
                  <p className="text-sm font-black text-teal-700 dark:text-teal-300 mt-0.5">
                    ৳{fmtNum(formatMoney(storeValuation.expectedProfit))}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                    <Wallet className="w-3 h-3 text-[#00965E]" />
                    {isBengali ? 'হাতে নগদ' : 'Cash in Hand'}
                  </p>
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
                    ৳{fmtNum(formatMoney(storeValuation.cashInHand))}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-500">
                    {isBengali ? 'কাস্টমার পাওনা' : 'Receivables'}
                  </p>
                  <p className="text-xs sm:text-sm font-black text-red-600 mt-0.5">
                    ৳{fmtNum(formatMoney(storeValuation.totalCustomerDues))}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-500">
                    {isBengali ? 'সাপ্লায়ার দেনা' : 'Payables'}
                  </p>
                  <p className="text-xs sm:text-sm font-black text-amber-600 mt-0.5">
                    ৳{fmtNum(formatMoney(storeValuation.totalSupplierPayables))}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Expense Breakdown for Period */}
          {expenseCategories.items.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border-[1.5px] border-slate-200 dark:border-slate-700 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                  <Receipt className="w-3.5 h-3.5 text-red-500" />
                  <span>
                    {isBengali
                      ? `খরচের বিবরণ (${getPeriodLabel(period)})`
                      : `Expense Breakdown (${getPeriodLabel(period)})`}
                  </span>
                </div>
                <span className="text-xs font-black text-red-600">
                  ৳{fmtNum(formatMoney(expenseCategories.grand))}
                </span>
              </div>

              <div className="space-y-2">
                {expenseCategories.items.map((item) => {
                  const pct =
                    expenseCategories.grand > 0
                      ? Math.round((item.total / expenseCategories.grand) * 100)
                      : 0;
                  return (
                    <div key={item.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {item.category}{' '}
                          <span className="text-[10px] text-slate-400">
                            ({fmtNum(item.count)})
                          </span>
                        </span>
                        <span className="font-black text-red-600">
                          ৳{fmtNum(formatMoney(item.total))} ({fmtNum(pct)}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: TOP SELLING PRODUCTS & LOW STOCK PRIORITY LIST             */}
      {/* ================================================================= */}
      {activeTab === 'PRODUCTS' && (
        <div className="space-y-3.5">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-50/90 to-teal-50/40 dark:from-slate-900 dark:to-slate-900/70 border-b border-emerald-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#00965E]" />
                <h3 className="text-xs font-black text-slate-800 dark:text-white">
                  {isBengali
                    ? `সবচেয়ে বেশি বিক্রিত পণ্য (${getPeriodLabel(period)})`
                    : `Top Selling Products (${getPeriodLabel(period)})`}
                </h3>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                {fmtNum(topProducts.length)} {isBengali ? 'টি' : 'items'}
              </span>
            </div>

            {topProducts.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">
                {isBengali
                  ? 'এই সময়ে কোনো পণ্য বিক্রির রেকর্ড নেই।'
                  : 'No product sales recorded in this period.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {topProducts.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-700 border border-amber-300'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-700'
                            : idx === 2
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-emerald-50 dark:bg-slate-900 text-[#00965E]'
                        }`}
                      >
                        #{fmtNum(idx + 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {isBengali ? 'বিক্রি হয়েছে' : 'Sold'}:{' '}
                          <strong>
                            {fmtNum(item.qty)} {item.unit}
                          </strong>{' '}
                          · {fmtNum(item.orders)}{' '}
                          {isBengali ? 'বার' : 'orders'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-[#00965E] shrink-0">
                      ৳{fmtNum(formatMoney(item.revenue))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock Priority Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-amber-200 dark:border-amber-900/50 overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200/80 dark:border-amber-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-black text-amber-900 dark:text-amber-300">
                  {isBengali ? 'কম স্টক / স্টক শেষ তালিকা' : 'Low & Out of Stock Alert'} (
                  {fmtNum(storeValuation.lowStockItems.length)})
                </h3>
              </div>
              {storeValuation.outOfStockCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-extrabold">
                  {fmtNum(storeValuation.outOfStockCount)}{' '}
                  {isBengali ? 'টি শেষ' : 'Out'}
                </span>
              )}
            </div>

            {storeValuation.lowStockItems.length === 0 ? (
              <p className="p-6 text-center text-xs text-emerald-600 font-bold">
                {isBengali
                  ? 'সব পণ্যের স্টক পর্যাপ্ত আছে।'
                  : 'All products are well-stocked!'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {storeValuation.lowStockItems.slice(0, 12).map((p) => (
                  <div
                    key={p.id}
                    className="p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-900 dark:text-white truncate">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {p.category} · {isBengali ? 'কেনা দর' : 'Buy'}: ৳
                        {fmtNum(formatMoney(p.buyPrice))}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-lg text-[11px] font-black shrink-0 ${
                        p.stock <= 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {fmtNum(p.stock)} {p.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: TOP CUSTOMERS                                              */}
      {/* ================================================================= */}
      {activeTab === 'CUSTOMERS' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
          <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-50/90 to-teal-50/40 dark:from-slate-900 dark:to-slate-900/70 border-b border-emerald-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#00965E]" />
              <h3 className="text-xs font-black text-slate-800 dark:text-white">
                {isBengali
                  ? `শীর্ষ কাস্টমার (${getPeriodLabel(period)})`
                  : `Top Customers (${getPeriodLabel(period)})`}
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              {fmtNum(topCustomers.length)} {isBengali ? 'জন' : 'buyers'}
            </span>
          </div>

          {topCustomers.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">
              {isBengali
                ? 'এই সময়ে কোনো বিক্রির তথ্য নেই।'
                : 'No customer sales recorded in this period.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
              {topCustomers.map((c, idx) => (
                <div
                  key={`${c.name}-${idx}`}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 text-[#00965E] flex items-center justify-center text-xs font-black shrink-0">
                      #{fmtNum(idx + 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        {c.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {fmtNum(c.invoices)}{' '}
                        {isBengali ? 'টি বিল' : 'invoices'} ·{' '}
                        {isBengali ? 'নগদ' : 'Paid'}: ৳
                        {fmtNum(formatMoney(c.totalPaid))}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-[#00965E]">
                      ৳{fmtNum(formatMoney(c.totalBought))}
                    </p>
                    {c.currentDue > 0 && (
                      <p className="text-[10px] font-bold text-red-600">
                        {isBengali ? 'বাকি' : 'Due'}: ৳
                        {fmtNum(formatMoney(c.currentDue))}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </motion.div>

      {/* Business Report PDF Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileDown className="w-4 h-4 text-[#00965E]" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isBengali
                    ? 'ব্যবসা রিপোর্ট (PDF)'
                    : 'Business Report (PDF)'}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrintSheet}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-white cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {isBengali ? 'প্রিন্ট' : 'Print'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#00965E] hover:bg-[#007c4e] text-white text-xs font-extrabold cursor-pointer disabled:opacity-60"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>
                    {isGeneratingPdf
                      ? '...'
                      : isBengali
                      ? 'PDF ডাউনলোড'
                      : 'Download PDF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 bg-slate-100 dark:bg-slate-950 flex-1">
              <div
                ref={pdfSheetRef}
                className="bg-white text-slate-900 p-5 sm:p-6 rounded-xl border border-slate-200 space-y-4"
              >
                <div className="flex items-start justify-between border-b-2 border-[#00965E] pb-3">
                  <div>
                    <h1 className="text-lg font-black text-[#007448]">
                      {isBengali ? 'সিয়াম স্টোর' : 'Siaam Store'}
                    </h1>
                    <p className="text-[11px] font-bold text-slate-500">
                      {isBengali
                        ? 'ব্যবসা লাভ-ক্ষতি ও স্টক রিপোর্ট'
                        : 'Business Profit & Loss & Valuation Report'}{' '}
                      · {getPeriodLabel(period)}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <p className="font-bold text-slate-700">
                      {isBengali ? 'তারিখ' : 'Date'}:{' '}
                      {new Date().toLocaleDateString(
                        isBengali ? 'bn-BD' : 'en-GB'
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">
                      {isBengali ? 'মোট বিক্রি' : 'Total Sales'}
                    </p>
                    <p className="text-xs font-black mt-0.5">
                      ৳{fmtNum(formatMoney(financials.salesRevenue))}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-[9px] font-bold text-[#007448] uppercase">
                      {isBengali ? 'মোট লাভ' : 'Gross Profit'}
                    </p>
                    <p className="text-xs font-black text-[#00965E] mt-0.5">
                      ৳{fmtNum(formatMoney(financials.grossProfit))}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-[9px] font-bold text-red-600 uppercase">
                      {isBengali ? 'মোট খরচ' : 'Expenses'}
                    </p>
                    <p className="text-xs font-black text-red-600 mt-0.5">
                      ৳{fmtNum(formatMoney(financials.expensesTotal))}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 text-white">
                    <p className="text-[9px] font-bold text-emerald-300 uppercase">
                      {isBengali ? 'নিট লাভ' : 'Net Profit'}
                    </p>
                    <p className="text-xs font-black mt-0.5">
                      {financials.netProfit < 0 ? '-' : ''}৳
                      {fmtNum(formatMoney(Math.abs(financials.netProfit)))}
                    </p>
                  </div>
                </div>

                {/* Financial Table */}
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'খাত' : 'Metric'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">
                        {isBengali ? 'পরিমাণ (৳)' : 'Amount (৳)'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 px-2 py-1.5">
                        {isBengali ? 'নগদ বিক্রি' : 'Cash Sales'}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-bold">
                        ৳{fmtNum(formatMoney(financials.salesCash))}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-2 py-1.5">
                        {isBengali ? 'বাকি বিক্রি' : 'Credit Sales'}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-bold">
                        ৳{fmtNum(formatMoney(financials.salesDue))}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-2 py-1.5">
                        {isBengali ? 'বাকি আদায়' : 'Customer Due Collected'}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-bold">
                        ৳{fmtNum(formatMoney(financials.dueCollected))}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-2 py-1.5">
                        {isBengali ? 'মাল ক্রয় (স্টক ইন)' : 'Stock Purchases'}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-bold">
                        ৳{fmtNum(formatMoney(financials.purchasesTotal))}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-2 py-1.5">
                        {isBengali
                          ? 'গুদাম স্টক (কেনা / বিক্রয় মূল্য)'
                          : 'Inventory Valuation (Cost / Retail)'}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-bold">
                        ৳{fmtNum(formatMoney(storeValuation.costValue))} / ৳
                        {fmtNum(formatMoney(storeValuation.retailValue))}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-2 py-1.5">
                        {isBengali ? 'বর্তমান হাতে নগদ ক্যাশ' : 'Current Cash in Hand'}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-bold">
                        ৳{fmtNum(formatMoney(storeValuation.cashInHand))}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-2 py-1.5">
                        {isBengali
                          ? 'মোট কাস্টমার পাওনা / সাপ্লায়ার দেনা'
                          : 'Total Customer Dues / Supplier Payables'}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-bold">
                        ৳{fmtNum(formatMoney(storeValuation.totalCustomerDues))} / ৳
                        {fmtNum(formatMoney(storeValuation.totalSupplierPayables))}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {topProducts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-black text-slate-800 mb-1">
                      {isBengali ? 'শীর্ষ বিক্রিত পণ্য' : 'Top Selling Products'}
                    </h4>
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700">
                          <th className="border border-slate-300 px-2 py-1 text-left">
                            SL
                          </th>
                          <th className="border border-slate-300 px-2 py-1 text-left">
                            {isBengali ? 'পণ্য' : 'Product'}
                          </th>
                          <th className="border border-slate-300 px-2 py-1 text-right">
                            {isBengali ? 'পরিমাণ' : 'Qty'}
                          </th>
                          <th className="border border-slate-300 px-2 py-1 text-right">
                            {isBengali ? 'মোট বিক্রি' : 'Revenue'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.slice(0, 8).map((p, i) => (
                          <tr key={`${p.name}-${i}`}>
                            <td className="border border-slate-300 px-2 py-1 font-bold">
                              {fmtNum(i + 1)}
                            </td>
                            <td className="border border-slate-300 px-2 py-1 font-bold">
                              {p.name}
                            </td>
                            <td className="border border-slate-300 px-2 py-1 text-right">
                              {fmtNum(p.qty)} {p.unit}
                            </td>
                            <td className="border border-slate-300 px-2 py-1 text-right font-bold text-[#00965E]">
                              ৳{fmtNum(formatMoney(p.revenue))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
