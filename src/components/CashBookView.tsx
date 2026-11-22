import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Wallet,
  Edit3,
  FileDown,
  Printer,
  X,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  Clock,
  Receipt,
  Plus,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  AppLanguage,
  DailyStats,
  StoreTransaction,
  formatMoney,
  formatTimestamp,
  parseUserNote,
  toBengaliDigits,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';

interface CashBookViewProps {
  stats: DailyStats;
  transactions: StoreTransaction[];
  startingCashBalance: number;
  onUpdateStartingCash: (amount: number) => void;
  onRecordExpense: (
    title: string,
    category: string,
    amount: number,
    notes?: string
  ) => Promise<void>;
  onOpenExpenses: () => void;
  strings: DokanTranslations;
  language: AppLanguage;
  onBack: () => void;
}

type CashTimeFilter = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_YEAR' | 'ALL';
type CashDirectionFilter = 'ALL' | 'IN' | 'OUT';
type CashSourceFilter =
  | 'ALL'
  | 'SALE'
  | 'RECEIVE_PAYMENT'
  | 'PURCHASE'
  | 'SUPPLIER_PAYMENT'
  | 'EXPENSE';

interface CashEntry {
  tx: StoreTransaction;
  direction: 'IN' | 'OUT';
  cashAmount: number;
  runningBalance: number;
}

const BDT_NOTES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

export const CashBookView: React.FC<CashBookViewProps> = ({
  stats,
  transactions,
  startingCashBalance,
  onUpdateStartingCash,
  onRecordExpense,
  onOpenExpenses,
  strings,
  language,
  onBack,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const fmtNum = (val: string | number) => toBengaliDigits(val, language);

  // Filters
  const [timeFilter, setTimeFilter] = useState<CashTimeFilter>('TODAY');
  const [directionFilter, setDirectionFilter] =
    useState<CashDirectionFilter>('ALL');
  const [sourceFilter, setSourceFilter] = useState<CashSourceFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Starting Cash Modal
  const [showStartingModal, setShowStartingModal] = useState(false);
  const [startingCashInput, setStartingCashInput] = useState(
    String(startingCashBalance)
  );

  // Quick Cash Expense Modal
  const [showQuickExpenseModal, setShowQuickExpenseModal] = useState(false);
  const [qExpTitle, setQExpTitle] = useState('');
  const [qExpCategory, setQExpCategory] = useState('Other');
  const [qExpAmount, setQExpAmount] = useState('');
  const [qExpNote, setQExpNote] = useState('');
  const [isSavingQuickExp, setIsSavingQuickExp] = useState(false);

  // BDT Physical Cash Drawer Counter
  const [showNoteCounter, setShowNoteCounter] = useState(false);
  const [noteCounts, setNoteCounts] = useState<Record<number, string>>({});

  // PDF Report Modal
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfSheetRef = useRef<HTMLDivElement | null>(null);

  const cashInHand =
    startingCashBalance + stats.totalCashIn - stats.totalCashOut;

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

  // Compute all cash-affecting entries chronologically with accurate running cash balance
  const allCashEntries = useMemo<CashEntry[]>(() => {
    const raw: Array<{
      tx: StoreTransaction;
      direction: 'IN' | 'OUT';
      cashAmount: number;
      ts: number;
    }> = [];

    for (const tx of transactions) {
      let direction: 'IN' | 'OUT' | null = null;
      let cashAmount = 0;

      if (tx.type === 'SALE' && tx.paidAmount > 0) {
        direction = 'IN';
        cashAmount = tx.paidAmount;
      } else if (tx.type === 'RECEIVE_PAYMENT') {
        const amt = Math.max(tx.paidAmount, tx.amount);
        if (amt > 0) {
          direction = 'IN';
          cashAmount = amt;
        }
      } else if (tx.type === 'PURCHASE' && tx.paidAmount > 0) {
        direction = 'OUT';
        cashAmount = tx.paidAmount;
      } else if (tx.type === 'SUPPLIER_PAYMENT') {
        const amt = Math.max(tx.paidAmount, tx.amount);
        if (amt > 0) {
          direction = 'OUT';
          cashAmount = amt;
        }
      } else if (tx.type === 'EXPENSE') {
        const amt = Math.max(tx.paidAmount, tx.amount);
        if (amt > 0) {
          direction = 'OUT';
          cashAmount = amt;
        }
      }

      if (direction && cashAmount > 0) {
        raw.push({
          tx,
          direction,
          cashAmount,
          ts: tx.createdAt?.toMillis?.() ?? Date.now(),
        });
      }
    }

    // Sort oldest -> newest to compute running balance
    raw.sort((a, b) => a.ts - b.ts);
    let running = startingCashBalance;
    const withBalance: CashEntry[] = raw.map((item) => {
      running += item.direction === 'IN' ? item.cashAmount : -item.cashAmount;
      return {
        tx: item.tx,
        direction: item.direction,
        cashAmount: item.cashAmount,
        runningBalance: running,
      };
    });

    // Return newest -> oldest for display
    return withBalance.reverse();
  }, [transactions, startingCashBalance]);

  // Period-filtered entries
  const timeFilteredEntries = useMemo(() => {
    return allCashEntries.filter((entry) => {
      if (timeFilter === 'ALL') return true;
      const ms = entry.tx.createdAt?.toMillis?.() ?? Date.now();
      if (timeFilter === 'TODAY') return ms >= startOfToday;
      if (timeFilter === 'THIS_WEEK') return ms >= startOfWeek;
      if (timeFilter === 'THIS_MONTH') return ms >= startOfMonth;
      if (timeFilter === 'THIS_YEAR') return ms >= startOfYear;
      return true;
    });
  }, [
    allCashEntries,
    timeFilter,
    startOfToday,
    startOfWeek,
    startOfMonth,
    startOfYear,
  ]);

  // Breakdown by cash source for selected period
  const periodBreakdown = useMemo(() => {
    let cashSales = 0;
    let dueReceived = 0;
    let cashPurchases = 0;
    let supplierPay = 0;
    let shopExpenses = 0;

    for (const e of timeFilteredEntries) {
      if (e.tx.type === 'SALE') cashSales += e.cashAmount;
      else if (e.tx.type === 'RECEIVE_PAYMENT') dueReceived += e.cashAmount;
      else if (e.tx.type === 'PURCHASE') cashPurchases += e.cashAmount;
      else if (e.tx.type === 'SUPPLIER_PAYMENT') supplierPay += e.cashAmount;
      else if (e.tx.type === 'EXPENSE') shopExpenses += e.cashAmount;
    }
    const totalIn = cashSales + dueReceived;
    const totalOut = cashPurchases + supplierPay + shopExpenses;
    return {
      cashSales,
      dueReceived,
      cashPurchases,
      supplierPay,
      shopExpenses,
      totalIn,
      totalOut,
      net: totalIn - totalOut,
    };
  }, [timeFilteredEntries]);

  // Fully filtered entries (time + direction + source + search)
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return timeFilteredEntries.filter((e) => {
      if (directionFilter !== 'ALL' && e.direction !== directionFilter) {
        return false;
      }
      if (sourceFilter !== 'ALL' && e.tx.type !== sourceFilter) {
        return false;
      }
      if (!q) return true;
      const note = parseUserNote(e.tx);
      return (
        e.tx.title.toLowerCase().includes(q) ||
        (e.tx.customerName || '').toLowerCase().includes(q) ||
        (e.tx.supplierName || '').toLowerCase().includes(q) ||
        (e.tx.category || '').toLowerCase().includes(q) ||
        note.toLowerCase().includes(q)
      );
    });
  }, [timeFilteredEntries, directionFilter, sourceFilter, searchQuery]);

  // Physical Drawer Note Counter total
  const countedCashTotal = useMemo(() => {
    return BDT_NOTES.reduce(
      (sum, denom) => sum + denom * Math.max(0, Number(noteCounts[denom]) || 0),
      0
    );
  }, [noteCounts]);

  const drawerDifference = countedCashTotal - cashInHand;

  const getTypeBadge = (type: StoreTransaction['type']) => {
    switch (type) {
      case 'SALE':
        return isBengali ? 'নগদ বিক্রি' : 'Cash Sale';
      case 'RECEIVE_PAYMENT':
        return isBengali ? 'বাকি আদায়' : 'Due Received';
      case 'PURCHASE':
        return isBengali ? 'মাল কেনা' : 'Stock Purchase';
      case 'SUPPLIER_PAYMENT':
        return isBengali ? 'সাপ্লায়ার পরিশোধ' : 'Supplier Pay';
      case 'EXPENSE':
        return isBengali ? 'দোকান খরচ' : 'Shop Expense';
      default:
        return type;
    }
  };

  const getTimeLabel = (tf: CashTimeFilter) => {
    const map: Record<CashTimeFilter, { bn: string; en: string }> = {
      TODAY: { bn: 'আজ', en: 'Today' },
      THIS_WEEK: { bn: 'সপ্তাহ', en: 'Week' },
      THIS_MONTH: { bn: 'মাস', en: 'Month' },
      THIS_YEAR: { bn: 'বছর', en: 'Year' },
      ALL: { bn: 'সব', en: 'All' },
    };
    return isBengali ? map[tf].bn : map[tf].en;
  };

  const handleSaveQuickExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qExpTitle.trim() || isSavingQuickExp) return;
    const amt = Math.max(0, Number(qExpAmount) || 0);
    if (amt <= 0) return;
    setIsSavingQuickExp(true);
    try {
      await onRecordExpense(
        qExpTitle.trim(),
        qExpCategory,
        amt,
        qExpNote.trim() || qExpCategory
      );
      setQExpTitle('');
      setQExpAmount('');
      setQExpNote('');
      setShowQuickExpenseModal(false);
    } finally {
      setIsSavingQuickExp(false);
    }
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
      pdf.save(`Siaam_Store_Cashbook_${stamp}.pdf`);
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
          <title>Siaam Store — Cashbook Statement</title>
          <style>
            * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            body { margin: 16px; color: #0f172a; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
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
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3 pb-24">
      {/* Compact Emerald Hero Cashbook Card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#00965E] to-[#007448] text-white p-3.5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isBengali ? 'টুলস' : 'Tools'}</span>
            </button>
            <div className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-100" />
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {strings.menuCashBook}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowQuickExpenseModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBengali ? 'দ্রুত খরচ' : 'Quick Exp'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPdfModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white text-[#007448] hover:bg-emerald-50 text-xs font-extrabold cursor-pointer shadow-2xs"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isBengali ? 'রিপোর্ট PDF' : 'Report PDF'}</span>
            </button>
          </div>
        </div>

        {/* Cash in Hand Highlight + 3 KPI Strip */}
        <div className="rounded-xl bg-white/15 border border-white/20 p-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
              {isBengali ? 'বর্তমান হাতে নগদ ক্যাশ' : 'Current Cash in Hand'}
            </p>
            <p className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
              ৳{fmtNum(formatMoney(cashInHand))}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowNoteCounter((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-colors ${
                showNoteCounter
                  ? 'bg-white text-[#007448]'
                  : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{isBengali ? 'ক্যাশ গণনা' : 'Cash Counter'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenExpenses}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-bold cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isBengali ? 'খরচ মেনু' : 'Expenses'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setStartingCashInput(String(startingCashBalance));
              setShowStartingModal(true);
            }}
            className="text-left rounded-xl bg-white/12 hover:bg-white/20 border border-white/15 px-2.5 py-2 cursor-pointer transition-colors"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 flex items-center justify-between">
              <span>{isBengali ? 'শুরুর ক্যাশ' : 'Starting Cash'}</span>
              <Edit3 className="w-3 h-3" />
            </p>
            <p className="text-sm sm:text-base font-black mt-0.5">
              ৳{fmtNum(formatMoney(startingCashBalance))}
            </p>
          </button>

          <div className="rounded-xl bg-white/12 border border-white/15 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
              {isBengali ? 'মোট ক্যাশ জমা' : 'Total Cash In'}
            </p>
            <p className="text-sm sm:text-base font-black mt-0.5">
              +৳{fmtNum(formatMoney(stats.totalCashIn))}
            </p>
          </div>

          <div className="rounded-xl bg-white/12 border border-white/15 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
              {isBengali ? 'মোট ক্যাশ খরচ' : 'Total Cash Out'}
            </p>
            <p className="text-sm sm:text-base font-black mt-0.5">
              -৳{fmtNum(formatMoney(stats.totalCashOut))}
            </p>
          </div>
        </div>
      </div>

      {/* Collapsible BDT Cash Drawer Note Counter (Cash Reconciliation Tool) */}
      {showNoteCounter && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border-[1.5px] border-[#00965E] space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-[#00965E]" />
              <h3 className="text-xs font-black text-slate-900 dark:text-white">
                {isBengali
                  ? 'নোট গণনা ও ক্যাশ বাক্স মিলান (৳)'
                  : 'BDT Cash Drawer Counter & Tally'}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setNoteCounts({})}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isBengali ? 'রিসেট' : 'Reset'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNoteCounter(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {BDT_NOTES.map((denom) => {
              const count = Math.max(0, Number(noteCounts[denom]) || 0);
              return (
                <div
                  key={denom}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1.5"
                >
                  <span className="text-xs font-black text-[#00965E] shrink-0">
                    ৳{fmtNum(denom)}
                  </span>
                  <span className="text-[10px] text-slate-400">×</span>
                  <input
                    type="number"
                    min={0}
                    value={noteCounts[denom] ?? ''}
                    onChange={(e) =>
                      setNoteCounts((prev) => ({
                        ...prev,
                        [denom]: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="w-14 px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-right dark:text-white"
                  />
                  {count > 0 && (
                    <span className="text-[9px] font-bold text-slate-400 hidden">
                      {denom * count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-500">
                {isBengali ? 'গণনাকৃত নগদ' : 'Counted Cash'}
              </p>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                ৳{fmtNum(formatMoney(countedCashTotal))}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-500">
                {isBengali ? 'হিসাবে ক্যাশ' : 'System Cash'}
              </p>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                ৳{fmtNum(formatMoney(cashInHand))}
              </p>
            </div>
            <div
              className={`p-2.5 rounded-xl border ${
                drawerDifference === 0
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800'
                  : drawerDifference > 0
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
              }`}
            >
              <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                {drawerDifference === 0 ? (
                  <CheckCircle2 className="w-3 h-3 text-[#00965E]" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-red-500" />
                )}
                <span>
                  {drawerDifference === 0
                    ? isBengali
                      ? 'মিলেছে ✓'
                      : 'Matched'
                    : drawerDifference > 0
                    ? isBengali
                      ? 'বেশি আছে'
                      : 'Excess'
                    : isBengali
                    ? 'কম আছে'
                    : 'Short'}
                </span>
              </p>
              <p
                className={`text-sm font-black ${
                  drawerDifference === 0
                    ? 'text-[#00965E]'
                    : drawerDifference > 0
                    ? 'text-blue-600'
                    : 'text-red-600'
                }`}
              >
                {drawerDifference > 0 ? '+' : drawerDifference < 0 ? '-' : ''}৳
                {fmtNum(formatMoney(Math.abs(drawerDifference)))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Period Filter + Cash Flow Source Breakdown */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border-[1.5px] border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(
              ['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'THIS_YEAR', 'ALL'] as const
            ).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeFilter(tf)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer border ${
                  timeFilter === tf
                    ? 'bg-[#00965E] text-white border-[#00965E]'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {getTimeLabel(tf)}
              </button>
            ))}
          </div>

          <span
            className={`px-2.5 py-1 rounded-xl text-xs font-black border ${
              periodBreakdown.net >= 0
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-[#00965E] border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 border-red-200 dark:border-red-800'
            }`}
          >
            {isBengali ? 'নিট প্রবাহ' : 'Net Flow'}:{' '}
            {periodBreakdown.net >= 0 ? '+' : '-'}৳
            {fmtNum(formatMoney(Math.abs(periodBreakdown.net)))}
          </span>
        </div>

        {/* 2-Column Inflow vs Outflow Source Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="rounded-xl p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-black text-[#007448] dark:text-emerald-300">
              <span className="inline-flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                {isBengali ? 'ক্যাশ জমা (ইন)' : 'Cash In'}
              </span>
              <span>+৳{fmtNum(formatMoney(periodBreakdown.totalIn))}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900/70 border border-emerald-100 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500">
                  {isBengali ? 'নগদ বিক্রি' : 'Sales'}
                </span>
                <span className="font-bold text-slate-800 dark:text-white">
                  ৳{fmtNum(formatMoney(periodBreakdown.cashSales))}
                </span>
              </div>
              <div className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900/70 border border-emerald-100 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500">
                  {isBengali ? 'বাকি আদায়' : 'Due Rec.'}
                </span>
                <span className="font-bold text-slate-800 dark:text-white">
                  ৳{fmtNum(formatMoney(periodBreakdown.dueReceived))}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-2.5 bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-black text-red-700 dark:text-red-300">
              <span className="inline-flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {isBengali ? 'ক্যাশ খরচ (আউট)' : 'Cash Out'}
              </span>
              <span>-৳{fmtNum(formatMoney(periodBreakdown.totalOut))}</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              <div className="px-1.5 py-1 rounded-lg bg-white dark:bg-slate-900/70 border border-red-100 dark:border-slate-700">
                <span className="block text-slate-400 truncate">
                  {isBengali ? 'মাল কেনা' : 'Purchase'}
                </span>
                <span className="font-bold text-slate-800 dark:text-white">
                  ৳{fmtNum(formatMoney(periodBreakdown.cashPurchases))}
                </span>
              </div>
              <div className="px-1.5 py-1 rounded-lg bg-white dark:bg-slate-900/70 border border-red-100 dark:border-slate-700">
                <span className="block text-slate-400 truncate">
                  {isBengali ? 'সাপ্লায়ার' : 'Supplier'}
                </span>
                <span className="font-bold text-slate-800 dark:text-white">
                  ৳{fmtNum(formatMoney(periodBreakdown.supplierPay))}
                </span>
              </div>
              <div className="px-1.5 py-1 rounded-lg bg-white dark:bg-slate-900/70 border border-red-100 dark:border-slate-700">
                <span className="block text-slate-400 truncate">
                  {isBengali ? 'দোকান খরচ' : 'Expenses'}
                </span>
                <span className="font-bold text-slate-800 dark:text-white">
                  ৳{fmtNum(formatMoney(periodBreakdown.shopExpenses))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Search + Direction + Source Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="relative sm:col-span-5">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isBengali
                  ? 'বিবরণ, কাস্টমার, সাপ্লায়ার খুঁজুন...'
                  : 'Search title, customer, supplier...'
              }
              className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
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

          <div className="sm:col-span-3 flex items-center gap-1">
            {(
              [
                { id: 'ALL', bn: 'সব', en: 'All' },
                { id: 'IN', bn: 'জমা (+)', en: 'In (+)' },
                { id: 'OUT', bn: 'খরচ (-)', en: 'Out (-)' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDirectionFilter(d.id)}
                className={`flex-1 py-2 rounded-xl text-[11px] font-bold border cursor-pointer ${
                  directionFilter === d.id
                    ? 'bg-[#00965E] text-white border-[#00965E]'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {isBengali ? d.bn : d.en}
              </button>
            ))}
          </div>

          <select
            value={sourceFilter}
            onChange={(e) =>
              setSourceFilter(e.target.value as CashSourceFilter)
            }
            className="sm:col-span-4 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">
              {isBengali ? 'সব ধরনের লেনদেন' : 'All Cash Sources'}
            </option>
            <option value="SALE">
              {isBengali ? 'নগদ বিক্রি' : 'Cash Sales'}
            </option>
            <option value="RECEIVE_PAYMENT">
              {isBengali ? 'বাকি আদায়' : 'Customer Payments'}
            </option>
            <option value="PURCHASE">
              {isBengali ? 'মাল কেনা (নগদ)' : 'Cash Purchases'}
            </option>
            <option value="SUPPLIER_PAYMENT">
              {isBengali ? 'সাপ্লায়ার পরিশোধ' : 'Supplier Payments'}
            </option>
            <option value="EXPENSE">
              {isBengali ? 'দোকান খরচ' : 'Shop Expenses'}
            </option>
          </select>
        </div>
      </div>

      {/* Itemized Cashbook Ledger */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-800 dark:text-white">
            {isBengali ? 'নগদ লেনদেন খাতা' : 'Cash Ledger Entries'} (
            {fmtNum(filteredEntries.length)})
          </h3>
          <span className="text-[11px] font-bold text-slate-500">
            {getTimeLabel(timeFilter)}
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            {isBengali
              ? 'এই সময়ে কোনো নগদ লেনদেন পাওয়া যায়নি।'
              : 'No cash transactions found in this period.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
            {filteredEntries.map((entry, idx) => {
              const isIn = entry.direction === 'IN';
              const party = entry.tx.customerName || entry.tx.supplierName;
              const note = parseUserNote(entry.tx);

              return (
                <div
                  key={entry.tx.id}
                  className="p-3 flex items-start justify-between gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isIn
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-[#00965E]'
                          : 'bg-red-50 dark:bg-red-900/30 text-red-600'
                      }`}
                    >
                      {isIn ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black text-slate-400">
                          #{fmtNum(filteredEntries.length - idx)}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                            isIn
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-[#00965E]'
                              : 'bg-red-100 dark:bg-red-900/40 text-red-600'
                          }`}
                        >
                          {getTypeBadge(entry.tx.type)}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {entry.tx.title}
                        </span>
                      </div>

                      {(party || note) && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {party ? `${party}` : ''}
                          {party && note ? ' · ' : ''}
                          {note}
                        </p>
                      )}

                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(entry.tx.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-black ${
                        isIn ? 'text-[#00965E]' : 'text-red-600'
                      }`}
                    >
                      {isIn ? '+' : '-'}৳{fmtNum(formatMoney(entry.cashAmount))}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                      {isBengali ? 'স্থিতি' : 'Bal'}: ৳
                      {fmtNum(formatMoney(entry.runningBalance))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Starting Cash Modal */}
      {showStartingModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-xl border-[1.5px] border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isBengali ? 'শুরুর ক্যাশ সেট করুন' : 'Set Starting Cash Balance'}
              </h3>
              <button
                type="button"
                onClick={() => setShowStartingModal(false)}
                className="p-1 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {isBengali
                ? 'দোকান শুরু বা হিসাব শুরুর সময় ক্যাশ বাক্সে যে নগদ টাকা ছিল তা লিখুন।'
                : 'Enter the opening cash available in your store cash drawer.'}
            </p>
            <input
              type="number"
              step="any"
              value={startingCashInput}
              onChange={(e) => setStartingCashInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-base font-black dark:bg-slate-900 dark:text-white"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowStartingModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 cursor-pointer"
              >
                {isBengali ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateStartingCash(Number(startingCashInput) || 0);
                  setShowStartingModal(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#00965E] text-white cursor-pointer"
              >
                {isBengali ? 'সংরক্ষণ করুন' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Cash-Out Expense Modal */}
      {showQuickExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-emerald-50 dark:bg-slate-900 border-b border-emerald-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isBengali
                  ? 'ক্যাশ থেকে দ্রুত খরচ'
                  : 'Quick Cash-Out Expense'}
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickExpenseModal(false)}
                className="p-1 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveQuickExpense} className="p-4 space-y-3">
              <input
                type="text"
                required
                value={qExpTitle}
                onChange={(e) => setQExpTitle(e.target.value)}
                placeholder={isBengali ? 'খরচের বিবরণ *' : 'Expense Title *'}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold dark:bg-slate-900 dark:text-white"
              />
              <select
                value={qExpCategory}
                onChange={(e) => setQExpCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white"
              >
                <option value="Rent & Bills">
                  {isBengali ? 'ভাড়া ও বিদ্যুৎ বিল' : 'Rent & Electricity'}
                </option>
                <option value="Transport & Labor">
                  {isBengali ? 'যাতায়াত ও কুলি' : 'Transport & Labor'}
                </option>
                <option value="Tea & Snacks">
                  {isBengali ? 'চা-নাস্তা' : 'Tea & Snacks'}
                </option>
                <option value="Staff Salary">
                  {isBengali ? 'স্টাফ বেতন' : 'Staff Salary'}
                </option>
                <option value="Other">
                  {isBengali ? 'অন্যান্য খরচ' : 'Other Expense'}
                </option>
              </select>
              <input
                type="number"
                required
                min={1}
                step="any"
                value={qExpAmount}
                onChange={(e) => setQExpAmount(e.target.value)}
                placeholder={isBengali ? 'পরিমাণ (৳) *' : 'Amount (৳) *'}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-black dark:bg-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={qExpNote}
                onChange={(e) => setQExpNote(e.target.value)}
                placeholder={isBengali ? 'নোট (ঐচ্ছিক)' : 'Note (Optional)'}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs dark:bg-slate-900 dark:text-white"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowQuickExpenseModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 cursor-pointer"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickExp}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#00965E] text-white cursor-pointer disabled:opacity-60"
                >
                  {isSavingQuickExp
                    ? '...'
                    : isBengali
                    ? 'খরচ যোগ করুন'
                    : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cashbook PDF Report Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileDown className="w-4 h-4 text-[#00965E]" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isBengali
                    ? 'ক্যাশবুক স্টেটমেন্ট (PDF)'
                    : 'Cashbook Statement (PDF)'}
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
                      {isBengali ? 'নগদ ক্যাশবুক রিপোর্ট' : 'Cashbook Statement'}{' '}
                      · {getTimeLabel(timeFilter)}
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
                      {isBengali ? 'শুরুর ক্যাশ' : 'Starting Cash'}
                    </p>
                    <p className="text-xs font-black mt-0.5">
                      ৳{fmtNum(formatMoney(startingCashBalance))}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-[9px] font-bold text-[#007448] uppercase">
                      {isBengali ? 'জমা' : 'Cash In'} ({getTimeLabel(timeFilter)})
                    </p>
                    <p className="text-xs font-black text-[#00965E] mt-0.5">
                      +৳{fmtNum(formatMoney(periodBreakdown.totalIn))}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-[9px] font-bold text-red-600 uppercase">
                      {isBengali ? 'খরচ' : 'Cash Out'} ({getTimeLabel(timeFilter)})
                    </p>
                    <p className="text-xs font-black text-red-600 mt-0.5">
                      -৳{fmtNum(formatMoney(periodBreakdown.totalOut))}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 text-white">
                    <p className="text-[9px] font-bold text-emerald-300 uppercase">
                      {isBengali ? 'হাতে নগদ' : 'Cash in Hand'}
                    </p>
                    <p className="text-xs font-black mt-0.5">
                      ৳{fmtNum(formatMoney(cashInHand))}
                    </p>
                  </div>
                </div>

                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        SL
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'তারিখ' : 'Date'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'ধরন' : 'Type'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'বিবরণ' : 'Details'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">
                        {isBengali ? 'জমা (+)' : 'In (+)'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">
                        {isBengali ? 'খরচ (-)' : 'Out (-)'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">
                        {isBengali ? 'স্থিতি' : 'Balance'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry, idx) => (
                      <tr key={entry.tx.id}>
                        <td className="border border-slate-300 px-2 py-1.5 font-bold">
                          {fmtNum(idx + 1)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 whitespace-nowrap">
                          {formatTimestamp(entry.tx.createdAt)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5">
                          {getTypeBadge(entry.tx.type)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5">
                          <span className="font-bold">{entry.tx.title}</span>
                          {(entry.tx.customerName || entry.tx.supplierName) && (
                            <span className="block text-[10px] text-slate-500">
                              {entry.tx.customerName || entry.tx.supplierName}
                            </span>
                          )}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-bold text-[#00965E]">
                          {entry.direction === 'IN'
                            ? `৳${fmtNum(formatMoney(entry.cashAmount))}`
                            : '—'}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-bold text-red-600">
                          {entry.direction === 'OUT'
                            ? `৳${fmtNum(formatMoney(entry.cashAmount))}`
                            : '—'}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-bold">
                          ৳{fmtNum(formatMoney(entry.runningBalance))}
                        </td>
                      </tr>
                    ))}
                    {filteredEntries.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="border border-slate-300 px-2 py-4 text-center text-slate-400"
                        >
                          {isBengali
                            ? 'কোনো নগদ লেনদেন নেই'
                            : 'No cash entries found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
