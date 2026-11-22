import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  FileDown,
  Printer,
  X,
  Search,
  Phone,
  MessageSquare,
  Users,
  Truck,
  BarChart3,
  Clock,
  Building2,
  MapPin,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  AppLanguage,
  Customer,
  StoreTransaction,
  Supplier,
  formatMoney,
  formatTimestamp,
  toBengaliDigits,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';

interface DueReportsViewProps {
  customers: Customer[];
  suppliers: Supplier[];
  transactions: StoreTransaction[];
  strings: DokanTranslations;
  language: AppLanguage;
  onBack: () => void;
  onOpenBusinessReports: () => void;
  onOpenSuppliers: () => void;
}

type DueTab = 'CUSTOMERS' | 'SUPPLIERS' | 'ACTIVITY';
type DueSort = 'AMOUNT_DESC' | 'OLDEST_FIRST' | 'SL_ASC' | 'NAME_ASC';
type ActivityPeriod = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL';
type PdfScope = 'BOTH' | 'CUSTOMERS' | 'SUPPLIERS';

function normalizeDigits(text: string): string {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return text.replace(/[০-৯]/g, (d) => {
    const idx = bn.indexOf(d);
    return idx >= 0 ? String(idx) : d;
  });
}

export const DueReportsView: React.FC<DueReportsViewProps> = ({
  customers,
  suppliers,
  transactions,
  strings,
  language,
  onBack,
  onOpenBusinessReports,
  onOpenSuppliers,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const fmtNum = (val: string | number) => toBengaliDigits(val, language);

  const [activeTab, setActiveTab] = useState<DueTab>('CUSTOMERS');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<DueSort>('AMOUNT_DESC');
  const [minAmountFilter, setMinAmountFilter] = useState<number>(0);
  const [activityPeriod, setActivityPeriod] =
    useState<ActivityPeriod>('THIS_MONTH');

  // PDF Export modal
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfScope, setPdfScope] = useState<PdfScope>('BOTH');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfSheetRef = useRef<HTMLDivElement | null>(null);

  // Chronological SL maps
  const customerSlMap = useMemo(() => {
    const ordered = [...customers].sort((a, b) => {
      const aT = a.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      const bT = b.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      if (aT !== bT) return aT - bT;
      return a.name.localeCompare(b.name);
    });
    const map = new Map<string, number>();
    ordered.forEach((c, i) => map.set(c.id, i + 1));
    return map;
  }, [customers]);

  const supplierSlMap = useMemo(() => {
    const ordered = [...suppliers].sort((a, b) => {
      const aT = a.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      const bT = b.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      if (aT !== bT) return aT - bT;
      return a.name.localeCompare(b.name);
    });
    const map = new Map<string, number>();
    ordered.forEach((s, i) => map.set(s.id, i + 1));
    return map;
  }, [suppliers]);

  // Last activity millis per customer & supplier (for pending age badge)
  const lastActivityMap = useMemo(() => {
    const custLast = new Map<string, number>();
    const supLast = new Map<string, number>();

    for (const tx of transactions) {
      const ms = tx.createdAt?.toMillis?.() ?? 0;
      if (tx.customerId && ms > (custLast.get(tx.customerId) ?? 0)) {
        custLast.set(tx.customerId, ms);
      }
      if (tx.supplierId && ms > (supLast.get(tx.supplierId) ?? 0)) {
        supLast.set(tx.supplierId, ms);
      }
    }
    return { custLast, supLast };
  }, [transactions]);

  const getDaysPending = (lastMs: number | undefined) => {
    if (!lastMs) return null;
    const diff = Math.floor((Date.now() - lastMs) / (24 * 60 * 60 * 1000));
    return Math.max(0, diff);
  };

  // Base owing lists & totals
  const allOwingCustomers = useMemo(
    () => customers.filter((c) => c.totalDue > 0),
    [customers]
  );
  const allOwingSuppliers = useMemo(
    () => suppliers.filter((s) => s.payableBalance > 0),
    [suppliers]
  );

  const totalCustomerDues = useMemo(
    () => allOwingCustomers.reduce((acc, c) => acc + c.totalDue, 0),
    [allOwingCustomers]
  );
  const totalSupplierPayables = useMemo(
    () => allOwingSuppliers.reduce((acc, s) => acc + s.payableBalance, 0),
    [allOwingSuppliers]
  );
  const netPosition = totalCustomerDues - totalSupplierPayables;
  const combinedTotal = totalCustomerDues + totalSupplierPayables;
  const receivableRatio =
    combinedTotal > 0 ? Math.round((totalCustomerDues / combinedTotal) * 100) : 50;

  // Filtered & sorted Customers Owing
  const filteredCustomers = useMemo(() => {
    const rawQ = searchQuery.trim().toLowerCase();
    const normQ = normalizeDigits(rawQ);
    const strippedSl = normQ.replace(/^#/, '');

    const list = allOwingCustomers.filter((c) => {
      if (minAmountFilter > 0 && c.totalDue < minAmountFilter) return false;
      if (!rawQ) return true;
      const sl = String(customerSlMap.get(c.id) ?? '');
      return (
        c.name.toLowerCase().includes(rawQ) ||
        normalizeDigits(c.phone || '').toLowerCase().includes(normQ) ||
        (c.identityHint || '').toLowerCase().includes(rawQ) ||
        (c.address || '').toLowerCase().includes(rawQ) ||
        sl === strippedSl ||
        `#${sl}` === normQ
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'AMOUNT_DESC') return b.totalDue - a.totalDue;
      if (sortBy === 'OLDEST_FIRST') {
        const aT =
          lastActivityMap.custLast.get(a.id) ??
          a.updatedAt?.toMillis?.() ??
          a.createdAt?.toMillis?.() ??
          0;
        const bT =
          lastActivityMap.custLast.get(b.id) ??
          b.updatedAt?.toMillis?.() ??
          b.createdAt?.toMillis?.() ??
          0;
        return aT - bT;
      }
      if (sortBy === 'SL_ASC') {
        return (customerSlMap.get(a.id) ?? 0) - (customerSlMap.get(b.id) ?? 0);
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    allOwingCustomers,
    searchQuery,
    minAmountFilter,
    sortBy,
    customerSlMap,
    lastActivityMap,
  ]);

  // Filtered & sorted Suppliers Payable
  const filteredSuppliers = useMemo(() => {
    const rawQ = searchQuery.trim().toLowerCase();
    const normQ = normalizeDigits(rawQ);
    const strippedSl = normQ.replace(/^#/, '');

    const list = allOwingSuppliers.filter((s) => {
      if (minAmountFilter > 0 && s.payableBalance < minAmountFilter)
        return false;
      if (!rawQ) return true;
      const sl = String(supplierSlMap.get(s.id) ?? '');
      return (
        s.name.toLowerCase().includes(rawQ) ||
        (s.company || '').toLowerCase().includes(rawQ) ||
        normalizeDigits(s.phone || '').toLowerCase().includes(normQ) ||
        sl === strippedSl ||
        `#${sl}` === normQ
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'AMOUNT_DESC') return b.payableBalance - a.payableBalance;
      if (sortBy === 'OLDEST_FIRST') {
        const aT =
          lastActivityMap.supLast.get(a.id) ??
          a.updatedAt?.toMillis?.() ??
          a.createdAt?.toMillis?.() ??
          0;
        const bT =
          lastActivityMap.supLast.get(b.id) ??
          b.updatedAt?.toMillis?.() ??
          b.createdAt?.toMillis?.() ??
          0;
        return aT - bT;
      }
      if (sortBy === 'SL_ASC') {
        return (supplierSlMap.get(a.id) ?? 0) - (supplierSlMap.get(b.id) ?? 0);
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    allOwingSuppliers,
    searchQuery,
    minAmountFilter,
    sortBy,
    supplierSlMap,
    lastActivityMap,
  ]);

  // Due Activity Log (Given vs Collected)
  const activityData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let givenDue = 0;
    let collectedDue = 0;
    let supplierCredit = 0;
    let supplierPaid = 0;
    const items: StoreTransaction[] = [];

    for (const tx of transactions) {
      const ms = tx.createdAt?.toMillis?.() ?? Date.now();
      if (activityPeriod === 'TODAY' && ms < startOfToday) continue;
      if (activityPeriod === 'THIS_WEEK' && ms < startOfWeek) continue;
      if (activityPeriod === 'THIS_MONTH' && ms < startOfMonth) continue;

      if (tx.type === 'SALE' && tx.dueAmount > 0) {
        givenDue += tx.dueAmount;
        items.push(tx);
      } else if (tx.type === 'GIVE_DUE') {
        givenDue += Math.max(tx.dueAmount, tx.amount);
        items.push(tx);
      } else if (tx.type === 'RECEIVE_PAYMENT') {
        collectedDue += Math.max(tx.paidAmount, tx.amount);
        items.push(tx);
      } else if (tx.type === 'PURCHASE' && tx.dueAmount > 0) {
        supplierCredit += tx.dueAmount;
        items.push(tx);
      } else if (tx.type === 'SUPPLIER_PAYMENT') {
        supplierPaid += Math.max(tx.paidAmount, tx.amount);
        items.push(tx);
      }
    }

    return { givenDue, collectedDue, supplierCredit, supplierPaid, items };
  }, [transactions, activityPeriod]);

  // Exact Customer Bengali SMS template (No WhatsApp)
  const buildCustomerSmsHref = (customer: Customer) => {
    const cleanPhone = (customer.phone || '').replace(/[^0-9+]/g, '');
    const amtStr = toBengaliDigits(
      formatMoney(Math.max(0, customer.totalDue)),
      AppLanguage.BENGALI
    );
    const body = `আসসালামু আলাইকুম, ${customer.name}, সিয়াম স্টোরের পক্ষ থেকে শুভেচ্ছা। আপনার মোট দেনার পরিমাণ ${amtStr} টাকা। পরিশোধের জন্য অনুরোধ করা হলো।`;
    return `sms:${cleanPhone}?body=${encodeURIComponent(body)}`;
  };

  // Supplier SMS (No WhatsApp)
  const buildSupplierSmsHref = (supplier: Supplier) => {
    const cleanPhone = (supplier.phone || '').replace(/[^0-9+]/g, '');
    const amtStr = formatMoney(Math.max(0, supplier.payableBalance));
    const body = isBengali
      ? `আসসালামু আলাইকুম, ${supplier.name}, সিয়াম স্টোর থেকে বলছি। আপনার বর্তমান পাওনা ${toBengaliDigits(
          amtStr,
          AppLanguage.BENGALI
        )} টাকা। ধন্যবাদ।`
      : `Assalamu Alaikum, ${supplier.name}, from Siaam Store. Current payable balance is Tk ${amtStr}. Thank you.`;
    return `sms:${cleanPhone}?body=${encodeURIComponent(body)}`;
  };

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
      pdf.save(`Siaam_Store_Due_Report_${stamp}.pdf`);
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
          <title>Siaam Store — Due Report</title>
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
                  <AlertTriangle className="w-4 h-4 text-emerald-50" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black tracking-tight leading-none">
                    {strings.menuDueReports}
                  </h2>
                  <p className="text-[10px] text-emerald-100/90 font-medium mt-0.5">
                    {isBengali
                      ? 'কাস্টমার পাওনা, সাপ্লায়ার দেনা ও আদায় রিপোর্ট'
                      : 'Receivables, payables & collection tracker'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenBusinessReports}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/15 text-xs font-bold cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {isBengali ? 'ব্যবসা রিপোর্ট' : 'Reports'}
                </span>
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

          {/* 3-Column Financial Position Strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/12 border border-white/20 px-2.5 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 truncate">
                {isBengali ? 'কাস্টমার পাওনা' : 'Receivable'}
              </p>
              <p className="text-sm sm:text-base font-black mt-0.5">
                ৳{fmtNum(formatMoney(totalCustomerDues))}
              </p>
              <p className="text-[10px] text-emerald-100/80 font-semibold">
                {fmtNum(allOwingCustomers.length)} {isBengali ? 'জন' : 'cust'}
              </p>
            </div>

            <div className="rounded-xl bg-white/12 border border-white/20 px-2.5 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 truncate">
                {isBengali ? 'সাপ্লায়ার দেনা' : 'Payable'}
              </p>
              <p className="text-sm sm:text-base font-black mt-0.5">
                ৳{fmtNum(formatMoney(totalSupplierPayables))}
              </p>
              <p className="text-[10px] text-emerald-100/80 font-semibold">
                {fmtNum(allOwingSuppliers.length)} {isBengali ? 'জন' : 'sup'}
              </p>
            </div>

            <div className="rounded-xl bg-white text-slate-900 px-2.5 py-2.5 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                {isBengali ? 'নিট অবস্থান' : 'Net Position'}
              </p>
              <p
                className={`text-sm sm:text-base font-black mt-0.5 ${
                  netPosition >= 0 ? 'text-[#00965E]' : 'text-red-600'
                }`}
              >
                {netPosition >= 0 ? '+' : '-'}৳
                {fmtNum(formatMoney(Math.abs(netPosition)))}
              </p>
              <p className="text-[10px] text-slate-500 font-bold truncate">
                {netPosition >= 0
                  ? isBengali
                    ? 'পাওনা বেশি'
                    : 'Net Receivable'
                  : isBengali
                  ? 'দেনা বেশি'
                  : 'Net Payable'}
              </p>
            </div>
          </div>

          {/* Receivable vs Payable Visual Split Bar */}
          {combinedTotal > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-emerald-100">
                <span>
                  {isBengali ? 'পাওনা' : 'Receivable'} {fmtNum(receivableRatio)}%
                </span>
                <span>
                  {isBengali ? 'দেনা' : 'Payable'}{' '}
                  {fmtNum(100 - receivableRatio)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-amber-400/90 overflow-hidden flex">
                <div
                  className="h-full bg-white"
                  style={{ width: `${receivableRatio}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3-Tab Switcher */}
      <div className="grid grid-cols-3 gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('CUSTOMERS')}
          className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all ${
            activeTab === 'CUSTOMERS'
              ? 'bg-gradient-to-r from-[#00965E] to-[#007D4E] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-emerald-50/60 dark:hover:bg-slate-700/50'
          }`}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {isBengali ? 'কাস্টমার' : 'Customers'} (
            {fmtNum(allOwingCustomers.length)})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('SUPPLIERS')}
          className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all ${
            activeTab === 'SUPPLIERS'
              ? 'bg-gradient-to-r from-[#00965E] to-[#007D4E] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-emerald-50/60 dark:hover:bg-slate-700/50'
          }`}
        >
          <Truck className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {isBengali ? 'সাপ্লায়ার' : 'Suppliers'} (
            {fmtNum(allOwingSuppliers.length)})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ACTIVITY')}
          className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all ${
            activeTab === 'ACTIVITY'
              ? 'bg-gradient-to-r from-[#00965E] to-[#007D4E] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-emerald-50/60 dark:hover:bg-slate-700/50'
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {isBengali ? 'বাকি ও আদায়' : 'Activity'}
          </span>
        </button>
      </div>

      {/* Search + Sort + Min Amount Bar (for Customers & Suppliers tabs) */}
      {(activeTab === 'CUSTOMERS' || activeTab === 'SUPPLIERS') && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border-[1.5px] border-slate-200 dark:border-slate-700 space-y-2.5 shadow-2xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'CUSTOMERS'
                  ? isBengali
                    ? 'নাম, মোবাইল, চেনার উপায়, ঠিকানা বা #ক্রমিক খুঁজুন...'
                    : 'Search name, mobile, hint, address or #SL...'
                  : isBengali
                  ? 'সাপ্লায়ার নাম, কোম্পানি, মোবাইল বা #ক্রমিক খুঁজুন...'
                  : 'Search supplier name, company, mobile or #SL...'
              }
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1 shrink-0">
              {[
                { val: 0, bn: 'সব', en: 'All' },
                { val: 500, bn: '৳৫০০+', en: '৳500+' },
                { val: 1000, bn: '৳১০০০+', en: '৳1k+' },
                { val: 5000, bn: '৳৫০০০+', en: '৳5k+' },
              ].map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => setMinAmountFilter(chip.val)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border whitespace-nowrap cursor-pointer ${
                    minAmountFilter === chip.val
                      ? 'bg-[#00965E] text-white border-[#00965E]'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isBengali ? chip.bn : chip.en}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as DueSort)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-200 shrink-0"
            >
              <option value="AMOUNT_DESC">
                {isBengali ? 'সর্বোচ্চ বাকি' : 'Highest Amount'}
              </option>
              <option value="OLDEST_FIRST">
                {isBengali ? 'সবচেয়ে পুরাতন' : 'Oldest Pending'}
              </option>
              <option value="SL_ASC">
                {isBengali ? 'ক্রমিক #১ →' : 'SL #1 →'}
              </option>
              <option value="NAME_ASC">
                {isBengali ? 'নাম A-Z' : 'Name A-Z'}
              </option>
            </select>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 1: CUSTOMERS OWING LIST                                       */}
      {/* ================================================================= */}
      {activeTab === 'CUSTOMERS' && (
        <div className="space-y-2.5">
          {filteredCustomers.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border-[1.5px] border-dashed border-slate-300 dark:border-slate-700 space-y-1.5">
              <Users className="w-8 h-8 text-emerald-300 mx-auto" />
              <p className="text-xs font-bold text-slate-500">
                {searchQuery || minAmountFilter > 0
                  ? isBengali
                    ? 'এই ফিল্টারে কোনো বাকি কাস্টমার পাওয়া যায়নি।'
                    : 'No customers match this filter.'
                  : isBengali
                  ? 'কোনো কাস্টমারের কাছে বাকি নেই!'
                  : 'All customer accounts are settled!'}
              </p>
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const sl = customerSlMap.get(c.id) ?? 0;
              const lastMs =
                lastActivityMap.custLast.get(c.id) ??
                c.updatedAt?.toMillis?.() ??
                c.createdAt?.toMillis?.();
              const daysAgo = getDaysPending(lastMs);
              const hasPhone =
                c.phone && c.phone.trim() !== '' && c.phone.trim() !== '—';

              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 hover:border-[#00965E] transition-colors overflow-hidden shadow-2xs"
                >
                  <div className="p-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black text-[#00965E]">
                          #{fmtNum(sl)}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          {c.name}
                        </h3>
                        {daysAgo !== null && (
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                              daysAgo >= 30
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : daysAgo >= 7
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 dark:bg-slate-900 text-slate-500'
                            }`}
                          >
                            {daysAgo === 0
                              ? isBengali
                                ? 'আজ'
                                : 'Today'
                              : isBengali
                              ? `${fmtNum(daysAgo)} দিন আগে`
                              : `${daysAgo}d ago`}
                          </span>
                        )}
                      </div>

                      {c.identityHint && (
                        <p className="text-[11px] font-semibold text-[#00965E] mt-1 inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span>{c.identityHint}</span>
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {hasPhone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {c.phone}
                          </span>
                        )}
                        {c.address && c.address !== '—' && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {c.address}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                        <p className="text-[9px] font-bold uppercase text-red-500">
                          {isBengali ? 'মোট পাওনা' : 'Total Due'}
                        </p>
                        <p className="text-sm font-black text-red-600 dark:text-red-400">
                          ৳{fmtNum(formatMoney(c.totalDue))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Call & SMS Reminder Bar (No WhatsApp) */}
                  <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {lastMs
                        ? `${isBengali ? 'শেষ আপডেট' : 'Last'}: ${new Date(
                            lastMs
                          ).toLocaleDateString(isBengali ? 'bn-BD' : 'en-GB')}`
                        : ''}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {hasPhone ? (
                        <>
                          <a
                            href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#00965E] text-[11px] font-bold text-slate-700 dark:text-slate-200"
                          >
                            <Phone className="w-3 h-3 text-[#00965E]" />
                            <span>{isBengali ? 'কল' : 'Call'}</span>
                          </a>
                          <a
                            href={buildCustomerSmsHref(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00965E] hover:bg-[#007c4e] text-white text-[11px] font-extrabold"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>{isBengali ? 'তাগাদা SMS' : 'Remind SMS'}</span>
                          </a>
                        </>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {isBengali ? 'মোবাইল নম্বর নেই' : 'No mobile number'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: SUPPLIERS PAYABLE LIST                                     */}
      {/* ================================================================= */}
      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-2.5">
          {filteredSuppliers.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border-[1.5px] border-dashed border-slate-300 dark:border-slate-700 space-y-1.5">
              <Truck className="w-8 h-8 text-emerald-300 mx-auto" />
              <p className="text-xs font-bold text-slate-500">
                {searchQuery || minAmountFilter > 0
                  ? isBengali
                    ? 'এই ফিল্টারে কোনো সাপ্লায়ার দেনা নেই।'
                    : 'No suppliers match this filter.'
                  : isBengali
                  ? 'সাপ্লায়ারদের কোনো দেনা বাকি নেই!'
                  : 'All supplier payables are settled!'}
              </p>
            </div>
          ) : (
            filteredSuppliers.map((s) => {
              const sl = supplierSlMap.get(s.id) ?? 0;
              const lastMs =
                lastActivityMap.supLast.get(s.id) ??
                s.updatedAt?.toMillis?.() ??
                s.createdAt?.toMillis?.();
              const daysAgo = getDaysPending(lastMs);
              const hasPhone =
                s.phone && s.phone.trim() !== '' && s.phone.trim() !== '—';

              return (
                <div
                  key={s.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 hover:border-[#00965E] transition-colors overflow-hidden shadow-2xs"
                >
                  <div className="p-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black text-[#00965E]">
                          #{fmtNum(sl)}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          {s.name}
                        </h3>
                        {daysAgo !== null && (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-[10px] font-bold text-slate-500">
                            {daysAgo === 0
                              ? isBengali
                                ? 'আজ'
                                : 'Today'
                              : isBengali
                              ? `${fmtNum(daysAgo)} দিন আগে`
                              : `${daysAgo}d ago`}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {s.company && (
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {s.company}
                          </span>
                        )}
                        {hasPhone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {s.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                        <p className="text-[9px] font-bold uppercase text-amber-600">
                          {isBengali ? 'সাপ্লায়ার দেনা' : 'Payable'}
                        </p>
                        <p className="text-sm font-black text-amber-700 dark:text-amber-400">
                          ৳{fmtNum(formatMoney(s.payableBalance))}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {hasPhone && (
                        <>
                          <a
                            href={`tel:${s.phone.replace(/[^0-9+]/g, '')}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#00965E] text-[11px] font-bold text-slate-700 dark:text-slate-200"
                          >
                            <Phone className="w-3 h-3 text-[#00965E]" />
                            <span>{isBengali ? 'কল' : 'Call'}</span>
                          </a>
                          <a
                            href={buildSupplierSmsHref(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                          >
                            <MessageSquare className="w-3 h-3 text-blue-600" />
                            <span>SMS</span>
                          </a>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={onOpenSuppliers}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00965E] hover:bg-[#007c4e] text-white text-[11px] font-extrabold cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{isBengali ? 'খাতা ও পরিশোধ' : 'Ledger & Pay'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: DUE GIVEN & COLLECTION ACTIVITY LOG                        */}
      {/* ================================================================= */}
      {activeTab === 'ACTIVITY' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border-[1.5px] border-slate-200 dark:border-slate-700 space-y-2.5 shadow-2xs">
            <div className="flex items-center gap-1 overflow-x-auto">
              {(
                [
                  { id: 'TODAY', bn: 'আজ', en: 'Today' },
                  { id: 'THIS_WEEK', bn: 'সপ্তাহ', en: '7 Days' },
                  { id: 'THIS_MONTH', bn: 'এই মাস', en: 'Month' },
                  { id: 'ALL', bn: 'সব', en: 'All' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivityPeriod(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer border ${
                    activityPeriod === tab.id
                      ? 'bg-[#00965E] text-white border-[#00965E]'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isBengali ? tab.bn : tab.en}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
                <p className="text-[10px] font-bold text-slate-500">
                  {isBengali ? 'নতুন বাকি দেয়া' : 'Due Given'}
                </p>
                <p className="text-sm font-black text-red-600 mt-0.5">
                  ৳{fmtNum(formatMoney(activityData.givenDue))}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                <p className="text-[10px] font-bold text-slate-500">
                  {isBengali ? 'বাকি আদায়' : 'Due Collected'}
                </p>
                <p className="text-sm font-black text-[#00965E] mt-0.5">
                  ৳{fmtNum(formatMoney(activityData.collectedDue))}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                <p className="text-[10px] font-bold text-slate-500">
                  {isBengali ? 'সাপ্লায়ার বাকি' : 'Sup. Credit'}
                </p>
                <p className="text-sm font-black text-amber-700 dark:text-amber-400 mt-0.5">
                  ৳{fmtNum(formatMoney(activityData.supplierCredit))}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
                <p className="text-[10px] font-bold text-slate-500">
                  {isBengali ? 'সাপ্লায়ার পরিশোধ' : 'Sup. Paid'}
                </p>
                <p className="text-sm font-black text-blue-700 dark:text-blue-400 mt-0.5">
                  ৳{fmtNum(formatMoney(activityData.supplierPaid))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 dark:text-white">
                {isBengali ? 'বাকি ও পরিশোধ লেনদেন' : 'Due & Payment Activity'} (
                {fmtNum(activityData.items.length)})
              </h3>
            </div>

            {activityData.items.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">
                {isBengali
                  ? 'এই সময়ে কোনো বাকি বা আদায়ের লেনদেন নেই।'
                  : 'No due or collection activity in this period.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {activityData.items.slice(0, 50).map((tx) => {
                  const isCollection = tx.type === 'RECEIVE_PAYMENT';
                  const isSupPay = tx.type === 'SUPPLIER_PAYMENT';
                  const isSupCredit = tx.type === 'PURCHASE';
                  const amt =
                    tx.type === 'SALE' || tx.type === 'PURCHASE'
                      ? tx.dueAmount
                      : Math.max(tx.amount, tx.paidAmount, tx.dueAmount);

                  return (
                    <div
                      key={tx.id}
                      className="p-3 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isCollection
                              ? 'bg-emerald-50 text-[#00965E]'
                              : isSupPay
                              ? 'bg-blue-50 text-blue-600'
                              : isSupCredit
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {isCollection || isSupPay ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {tx.customerName || tx.supplierName || tx.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {tx.title}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatTimestamp(tx.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-black ${
                            isCollection
                              ? 'text-[#00965E]'
                              : isSupPay
                              ? 'text-blue-600'
                              : isSupCredit
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }`}
                        >
                          ৳{fmtNum(formatMoney(amt))}
                        </span>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">
                          {isCollection
                            ? isBengali
                              ? 'আদায়'
                              : 'Collected'
                            : isSupPay
                            ? isBengali
                              ? 'সাপ্লায়ার পে'
                              : 'Sup. Paid'
                            : isSupCredit
                            ? isBengali
                              ? 'সাপ্লায়ার বাকি'
                              : 'Sup. Due'
                            : isBengali
                            ? 'নতুন বাকি'
                            : 'Due Given'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Due Report PDF Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileDown className="w-4 h-4 text-[#00965E]" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isBengali ? 'বাকি ও দেনা রিপোর্ট (PDF)' : 'Due Report (PDF)'}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                  {(
                    [
                      { id: 'BOTH', bn: 'উভয়', en: 'Both' },
                      { id: 'CUSTOMERS', bn: 'কাস্টমার', en: 'Customers' },
                      { id: 'SUPPLIERS', bn: 'সাপ্লায়ার', en: 'Suppliers' },
                    ] as const
                  ).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setPdfScope(sc.id)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer ${
                        pdfScope === sc.id
                          ? 'bg-[#00965E] text-white'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {isBengali ? sc.bn : sc.en}
                    </button>
                  ))}
                </div>

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
                        ? 'কেন্দ্রীয় বাকি ও দেনা-পাওনা রিপোর্ট'
                        : 'Central Receivables & Payables Due Report'}
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

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-[10px] font-bold text-red-600 uppercase">
                      {isBengali ? 'মোট কাস্টমার পাওনা' : 'Customer Dues'}
                    </p>
                    <p className="text-sm font-black text-red-700 mt-0.5">
                      ৳{fmtNum(formatMoney(totalCustomerDues))} (
                      {fmtNum(allOwingCustomers.length)})
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-[10px] font-bold text-amber-700 uppercase">
                      {isBengali ? 'মোট সাপ্লায়ার দেনা' : 'Supplier Payables'}
                    </p>
                    <p className="text-sm font-black text-amber-800 mt-0.5">
                      ৳{fmtNum(formatMoney(totalSupplierPayables))} (
                      {fmtNum(allOwingSuppliers.length)})
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-[10px] font-bold text-[#007448] uppercase">
                      {isBengali ? 'নিট অবস্থান' : 'Net Position'}
                    </p>
                    <p className="text-sm font-black text-[#00965E] mt-0.5">
                      {netPosition >= 0 ? '+' : '-'}৳
                      {fmtNum(formatMoney(Math.abs(netPosition)))}
                    </p>
                  </div>
                </div>

                {(pdfScope === 'BOTH' || pdfScope === 'CUSTOMERS') && (
                  <div>
                    <h4 className="text-xs font-black text-slate-800 mb-1">
                      {isBengali
                        ? 'কাস্টমারদের কাছে পাওনা তালিকা'
                        : 'Customers Owing List'}
                    </h4>
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700">
                          <th className="border border-slate-300 px-2 py-1 text-left">
                            SL
                          </th>
                          <th className="border border-slate-300 px-2 py-1 text-left">
                            {isBengali ? 'নাম' : 'Name'}
                          </th>
                          <th className="border border-slate-300 px-2 py-1 text-left">
                            {isBengali ? 'চেনার উপায়' : 'Hint'}
                          </th>
                          <th className="border border-slate-300 px-2 py-1 text-left">
                            {isBengali ? 'মোবাইল' : 'Phone'}
                          </th>
                          <th className="border border-slate-300 px-2 py-1 text-right">
                            {isBengali ? 'মোট পাওনা' : 'Total Due'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.map((c) => (
                          <tr key={c.id}>
                            <td className="border border-slate-300 px-2 py-1 font-bold">
                              #{fmtNum(customerSlMap.get(c.id) ?? 0)}
                            </td>
                            <td className="border border-slate-300 px-2 py-1 font-bold">
                              {c.name}
                            </td>
                            <td className="border border-slate-300 px-2 py-1">
                              {c.identityHint || '—'}
                            </td>
                            <td className="border border-slate-300 px-2 py-1">
                              {c.phone || '—'}
                            </td>
                            <td className="border border-slate-300 px-2 py-1 text-right font-extrabold text-red-600">
                              ৳{fmtNum(formatMoney(c.totalDue))}
                            </td>
                          </tr>
                        ))}
                        {filteredCustomers.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="border border-slate-300 px-2 py-3 text-center text-slate-400"
                            >
                              {isBengali ? 'কোনো পাওনা নেই' : 'No dues found'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {(pdfScope === 'BOTH' || pdfScope === 'SUPPLIERS') && (
                  <div>
                    <h4 className="text-xs font-black text-slate-800 mb-1">
                      {isBengali
                        ? 'সাপ্লায়ার দেনা তালিকা'
                        : 'Suppliers Payable List'}
                    </h4>
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700">
                          <th className="border border-slate-300 px-2 py-1 text-left">
                            SL
                          </th>
                          <th className="border border-slate-300 px-2 py-1 text-left">
                            {isBengali ? 'সাপ্লায়ার' : 'Supplier'}
                          </th>
                          <th className="border border-slate-300 px-2 py-1 text-left">
                            {isBengali ? 'কোম্পানি' : 'Company'}
                          </th>
                          <th className="border border-slate-300 px-2 py-1 text-left">
                            {isBengali ? 'মোবাইল' : 'Phone'}
                          </th>
                          <th className="border border-slate-300 px-2 py-1 text-right">
                            {isBengali ? 'দেনা' : 'Payable'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSuppliers.map((s) => (
                          <tr key={s.id}>
                            <td className="border border-slate-300 px-2 py-1 font-bold">
                              #{fmtNum(supplierSlMap.get(s.id) ?? 0)}
                            </td>
                            <td className="border border-slate-300 px-2 py-1 font-bold">
                              {s.name}
                            </td>
                            <td className="border border-slate-300 px-2 py-1">
                              {s.company || '—'}
                            </td>
                            <td className="border border-slate-300 px-2 py-1">
                              {s.phone || '—'}
                            </td>
                            <td className="border border-slate-300 px-2 py-1 text-right font-extrabold text-amber-700">
                              ৳{fmtNum(formatMoney(s.payableBalance))}
                            </td>
                          </tr>
                        ))}
                        {filteredSuppliers.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="border border-slate-300 px-2 py-3 text-center text-slate-400"
                            >
                              {isBengali ? 'কোনো দেনা নেই' : 'No payables found'}
                            </td>
                          </tr>
                        )}
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
