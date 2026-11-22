import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Truck,
  Search,
  Plus,
  Phone,
  MessageSquare,
  FileDown,
  Printer,
  Edit3,
  Trash2,
  PackagePlus,
  X,
  Check,
  Building2,
  AlertTriangle,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Receipt,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  AppLanguage,
  StoreTransaction,
  Supplier,
  formatMoney,
  formatTimestamp,
  parseLineItems,
  parseUserNote,
  toBengaliDigits,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';

interface SupplierLedgerViewProps {
  suppliers: Supplier[];
  transactions: StoreTransaction[];
  strings: DokanTranslations;
  language: AppLanguage;
  onBack: () => void;
  onStartPurchaseForSupplier: (supplierId: string) => void;
  onAddSupplier: (params: {
    name: string;
    phone: string;
    company: string;
    initialPayable: number;
  }) => Promise<void>;
  onUpdateSupplier: (
    supplier: Supplier,
    params: { name: string; phone: string; company: string }
  ) => Promise<void>;
  onRecordSupplierPayment: (
    supplier: Supplier,
    amount: number,
    notes: string
  ) => Promise<void>;
  onAddSupplierCreditOwed: (
    supplier: Supplier,
    amount: number,
    notes: string
  ) => Promise<void>;
  onDeleteSupplier: (supplierId: string, supplierName: string) => Promise<void>;
  onDeleteTransaction: (tx: StoreTransaction) => Promise<void>;
}

type SupplierFilter = 'ALL' | 'PAYABLE' | 'SETTLED';
type SupplierSort = 'PAYABLE_DESC' | 'SL_ASC' | 'NAME_ASC';
type LedgerTimeFilter = 'ALL' | 'THIS_MONTH' | 'THIS_YEAR';

function normalizeDigits(text: string): string {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return text.replace(/[০-৯]/g, (d) => {
    const idx = bn.indexOf(d);
    return idx >= 0 ? String(idx) : d;
  });
}

export const SupplierLedgerView: React.FC<SupplierLedgerViewProps> = ({
  suppliers,
  transactions,
  strings,
  language,
  onBack,
  onStartPurchaseForSupplier,
  onAddSupplier,
  onUpdateSupplier,
  onRecordSupplierPayment,
  onAddSupplierCreditOwed,
  onDeleteSupplier,
  onDeleteTransaction,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const fmtNum = (val: string | number) => toBengaliDigits(val, language);

  // List filter & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<SupplierFilter>('ALL');
  const [sortBy, setSortBy] = useState<SupplierSort>('PAYABLE_DESC');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null
  );
  const [ledgerTimeFilter, setLedgerTimeFilter] =
    useState<LedgerTimeFilter>('ALL');

  // Add / Edit Supplier modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCompany, setSupCompany] = useState('');
  const [supPayable, setSupPayable] = useState('');
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // Pay / Add Owed modal
  const [actionTarget, setActionTarget] = useState<{
    supplier: Supplier;
    mode: 'PAY' | 'OWE';
  } | null>(null);
  const [actionAmount, setActionAmount] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [isSavingAction, setIsSavingAction] = useState(false);

  // Confirm Delete Supplier / Transaction
  const [deleteSupplierTarget, setDeleteSupplierTarget] =
    useState<Supplier | null>(null);
  const [deleteTxTarget, setDeleteTxTarget] =
    useState<StoreTransaction | null>(null);

  // PDF Export modals
  const [pdfModalMode, setPdfModalMode] = useState<
    null | { type: 'CENTRAL' } | { type: 'INDIVIDUAL'; supplier: Supplier }
  >(null);
  const [centralPdfScope, setCentralPdfScope] = useState<'ALL' | 'PAYABLE'>(
    'ALL'
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfSheetRef = useRef<HTMLDivElement | null>(null);

  // Chronological SL map (#1, #2, ...)
  const supplierSlMap = useMemo(() => {
    const ordered = [...suppliers].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return a.name.localeCompare(b.name);
    });
    const map = new Map<string, number>();
    ordered.forEach((s, idx) => map.set(s.id, idx + 1));
    return map;
  }, [suppliers]);

  // Supplier-related transactions index
  const supplierTransactionsMap = useMemo(() => {
    const map = new Map<string, StoreTransaction[]>();
    const relevantTxs = transactions.filter(
      (t) => t.type === 'PURCHASE' || t.type === 'SUPPLIER_PAYMENT'
    );
    suppliers.forEach((s) => {
      const nameLower = s.name.trim().toLowerCase();
      const matched = relevantTxs.filter(
        (t) =>
          (t.supplierId && t.supplierId === s.id) ||
          (!t.supplierId &&
            t.supplierName &&
            t.supplierName.trim().toLowerCase() === nameLower)
      );
      map.set(s.id, matched);
    });
    return map;
  }, [suppliers, transactions]);

  // Summary metrics
  const summaryStats = useMemo(() => {
    const totalPayable = suppliers.reduce(
      (acc, s) => acc + Math.max(0, s.payableBalance),
      0
    );
    const owedCount = suppliers.filter((s) => s.payableBalance > 0).length;
    const settledCount = suppliers.filter((s) => s.payableBalance <= 0).length;
    const totalPurchased = suppliers.reduce(
      (acc, s) => acc + Math.max(0, s.totalPurchased),
      0
    );
    return { totalPayable, owedCount, settledCount, totalPurchased };
  }, [suppliers]);

  // Filtered & sorted supplier list
  const filteredSuppliers = useMemo(() => {
    const rawQ = searchQuery.trim().toLowerCase();
    const normQ = normalizeDigits(rawQ);
    const strippedSlQ = normQ.replace(/^#/, '');

    let list = suppliers.filter((s) => {
      if (filterMode === 'PAYABLE' && s.payableBalance <= 0) return false;
      if (filterMode === 'SETTLED' && s.payableBalance > 0) return false;
      if (!rawQ) return true;

      const sl = String(supplierSlMap.get(s.id) ?? '');
      const nameMatch = s.name.toLowerCase().includes(rawQ);
      const companyMatch = (s.company || '').toLowerCase().includes(rawQ);
      const phoneMatch = normalizeDigits(s.phone || '')
        .toLowerCase()
        .includes(normQ);
      const slMatch = sl === strippedSlQ || `#${sl}` === normQ;
      return nameMatch || companyMatch || phoneMatch || slMatch;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'PAYABLE_DESC') {
        if (b.payableBalance !== a.payableBalance) {
          return b.payableBalance - a.payableBalance;
        }
        return (supplierSlMap.get(a.id) ?? 0) - (supplierSlMap.get(b.id) ?? 0);
      }
      if (sortBy === 'SL_ASC') {
        return (supplierSlMap.get(a.id) ?? 0) - (supplierSlMap.get(b.id) ?? 0);
      }
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [suppliers, searchQuery, filterMode, sortBy, supplierSlMap]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) || null,
    [suppliers, selectedSupplierId]
  );

  // Helper: SMS URL (No WhatsApp)
  const buildSmsHref = (supplier: Supplier) => {
    const cleanPhone = (supplier.phone || '').replace(/[^0-9+]/g, '');
    const payable = Math.max(0, supplier.payableBalance);
    const body = isBengali
      ? `আসসালামু আলাইকুম, ${supplier.name}, সিয়াম স্টোর থেকে বলছি। আপনার বর্তমান পাওনা ${formatMoney(
          payable
        )} টাকা। ধন্যবাদ।`
      : `Assalamu Alaikum, ${supplier.name}, from Siaam Store. Current payable balance is Tk ${formatMoney(
          payable
        )}. Thank you.`;
    return `sms:${cleanPhone}?body=${encodeURIComponent(body)}`;
  };

  // Modal helpers
  const openAddModal = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupPhone('');
    setSupCompany('');
    setSupPayable('');
    setShowSupplierModal(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupName(supplier.name);
    setSupPhone(supplier.phone || '');
    setSupCompany(supplier.company || '');
    setSupPayable(String(supplier.payableBalance || 0));
    setShowSupplierModal(true);
  };

  const openActionModal = (supplier: Supplier, mode: 'PAY' | 'OWE') => {
    setActionTarget({ supplier, mode });
    setActionAmount('');
    setActionNote('');
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim() || isSavingSupplier) return;
    setIsSavingSupplier(true);
    try {
      if (editingSupplier) {
        await onUpdateSupplier(editingSupplier, {
          name: supName.trim(),
          phone: supPhone.trim(),
          company: supCompany.trim(),
        });
      } else {
        await onAddSupplier({
          name: supName.trim(),
          phone: supPhone.trim(),
          company: supCompany.trim(),
          initialPayable: Math.max(0, Number(supPayable) || 0),
        });
      }
      setShowSupplierModal(false);
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget || isSavingAction) return;
    const amt = Math.max(0, Number(actionAmount) || 0);
    if (amt <= 0) return;
    setIsSavingAction(true);
    try {
      if (actionTarget.mode === 'PAY') {
        await onRecordSupplierPayment(
          actionTarget.supplier,
          amt,
          actionNote.trim()
        );
      } else {
        await onAddSupplierCreditOwed(
          actionTarget.supplier,
          amt,
          actionNote.trim()
        );
      }
      setActionTarget(null);
      setActionAmount('');
      setActionNote('');
    } finally {
      setIsSavingAction(false);
    }
  };

  // PDF generation & print
  const handleDownloadPdf = async (fileName: string) => {
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
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const printableW = pageWidth - margin * 2;
      const printableH = pageHeight - margin * 2;
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

      pdf.save(fileName);
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
          <title>Siaam Store — Supplier Ledger</title>
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

  // =========================================================================
  // SUB-VIEW: INDIVIDUAL SUPPLIER DETAIL LEDGER
  // =========================================================================
  if (selectedSupplier) {
    const sl = supplierSlMap.get(selectedSupplier.id) ?? 0;
    const allSupplierTxs =
      supplierTransactionsMap.get(selectedSupplier.id) || [];

    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    const filteredLedgerTxs = allSupplierTxs.filter((tx) => {
      if (ledgerTimeFilter === 'ALL') return true;
      const ms = tx.createdAt?.toMillis?.() ?? 0;
      if (ledgerTimeFilter === 'THIS_MONTH') return ms >= startOfMonth;
      if (ledgerTimeFilter === 'THIS_YEAR') return ms >= startOfYear;
      return true;
    });

    const totalPaidComputed = allSupplierTxs.reduce((acc, tx) => {
      if (tx.type === 'SUPPLIER_PAYMENT') return acc + tx.amount;
      if (tx.type === 'PURCHASE') return acc + tx.paidAmount;
      return acc;
    }, 0);

    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3 pb-24">
        {/* Compact Top Bar */}
        <div className="rounded-2xl bg-gradient-to-br from-[#00965E] to-[#007448] text-white p-3.5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSelectedSupplierId(null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isBengali ? 'সাপ্লায়ার তালিকা' : 'All Suppliers'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setPdfModalMode({
                    type: 'INDIVIDUAL',
                    supplier: selectedSupplier,
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>{isBengali ? 'রিপোর্ট PDF' : 'Report PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => onStartPurchaseForSupplier(selectedSupplier.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white text-[#007448] hover:bg-emerald-50 text-xs font-extrabold cursor-pointer"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>{isBengali ? '+ মাল কিনুন' : '+ Stock In'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-lg bg-white/20 text-[11px] font-black">
                  #{fmtNum(sl)}
                </span>
                <h2 className="text-lg font-black truncate">
                  {selectedSupplier.name}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-emerald-100">
                {selectedSupplier.company && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {selectedSupplier.company}
                  </span>
                )}
                {selectedSupplier.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {selectedSupplier.phone}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => openEditModal(selectedSupplier)}
                title={isBengali ? 'এডিট' : 'Edit'}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteSupplierTarget(selectedSupplier)}
                title={isBengali ? 'মুছুন' : 'Delete'}
                className="p-2 rounded-xl bg-red-500/30 hover:bg-red-500/50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3-box Balance Strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/12 border border-white/15 px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                {isBengali ? 'মোট ক্রয়' : 'Purchased'}
              </p>
              <p className="text-sm font-black mt-0.5">
                ৳{fmtNum(formatMoney(selectedSupplier.totalPurchased))}
              </p>
            </div>
            <div className="rounded-xl bg-white/12 border border-white/15 px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                {isBengali ? 'মোট পরিশোধ' : 'Total Paid'}
              </p>
              <p className="text-sm font-black mt-0.5">
                ৳{fmtNum(formatMoney(totalPaidComputed))}
              </p>
            </div>
            <div className="rounded-xl bg-white text-slate-900 px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {isBengali ? 'বর্তমান দেনা' : 'Payable Due'}
              </p>
              <p
                className={`text-sm font-black mt-0.5 ${
                  selectedSupplier.payableBalance > 0
                    ? 'text-red-600'
                    : 'text-[#00965E]'
                }`}
              >
                ৳{fmtNum(formatMoney(Math.max(0, selectedSupplier.payableBalance)))}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => openActionModal(selectedSupplier, 'PAY')}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#00965E] hover:bg-[#007c4e] text-white text-xs font-extrabold cursor-pointer shadow-2xs"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>{isBengali ? 'টাকা পরিশোধ' : 'Pay Supplier'}</span>
          </button>
          <button
            type="button"
            onClick={() => openActionModal(selectedSupplier, 'OWE')}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border-[1.5px] border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs font-extrabold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isBengali ? '+ বাকি যোগ' : '+ Add Owed'}</span>
          </button>
          {selectedSupplier.phone ? (
            <a
              href={`tel:${selectedSupplier.phone.replace(/[^0-9+]/g, '')}`}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 border-[1.5px] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00965E] text-xs font-bold"
            >
              <Phone className="w-3.5 h-3.5 text-[#00965E]" />
              <span>{isBengali ? 'কল করুন' : 'Call'}</span>
            </a>
          ) : (
            <div className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-400 text-xs font-bold">
              <Phone className="w-3.5 h-3.5" />
              <span>{isBengali ? 'নম্বর নেই' : 'No Phone'}</span>
            </div>
          )}
          {selectedSupplier.phone ? (
            <a
              href={buildSmsHref(selectedSupplier)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 border-[1.5px] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00965E] text-xs font-bold"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              <span>{isBengali ? 'এসএমএস' : 'SMS'}</span>
            </a>
          ) : (
            <div className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-400 text-xs font-bold">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>SMS</span>
            </div>
          )}
        </div>

        {/* Transaction Ledger */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#00965E]" />
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                {isBengali ? 'লেনদেন খাতা' : 'Transaction Ledger'} (
                {fmtNum(filteredLedgerTxs.length)})
              </h3>
            </div>
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'ALL', bn: 'সব', en: 'All' },
                  { id: 'THIS_MONTH', bn: 'এই মাস', en: 'Month' },
                  { id: 'THIS_YEAR', bn: 'এই বছর', en: 'Year' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLedgerTimeFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    ledgerTimeFilter === tab.id
                      ? 'bg-[#00965E] text-white'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isBengali ? tab.bn : tab.en}
                </button>
              ))}
            </div>
          </div>

          {filteredLedgerTxs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              {isBengali
                ? 'এই সময়ে কোনো লেনদেন পাওয়া যায়নি।'
                : 'No transactions recorded in this period.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
              {filteredLedgerTxs.map((tx, idx) => {
                const isPayment = tx.type === 'SUPPLIER_PAYMENT';
                const lineItems =
                  tx.type === 'PURCHASE' ? parseLineItems(tx) : [];
                const cleanNote = parseUserNote(tx);

                return (
                  <div
                    key={tx.id}
                    className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isPayment
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-[#00965E]'
                            : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'
                        }`}
                      >
                        {isPayment ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownLeft className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black text-slate-400">
                            #{fmtNum(filteredLedgerTxs.length - idx)}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                              isPayment
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-[#00965E]'
                                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {isPayment
                              ? isBengali
                                ? 'পরিশোধ'
                                : 'Payment'
                              : isBengali
                              ? 'ক্রয় / বাকি'
                              : 'Purchase / Owed'}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
                            {tx.title}
                          </span>
                        </div>

                        {lineItems.length > 0 && tx.notes.startsWith('ITEMS:') && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {lineItems
                              .map(
                                (li) =>
                                  `${li.productName} (${li.quantity} ${li.unit})`
                              )
                              .join(', ')}
                          </p>
                        )}
                        {cleanNote && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 italic">
                            {cleanNote}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(tx.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 shrink-0">
                      <div className="text-right">
                        <p
                          className={`text-sm font-black ${
                            isPayment
                              ? 'text-[#00965E]'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {isPayment ? '-' : ''}৳{fmtNum(formatMoney(tx.amount))}
                        </p>
                        {!isPayment && (
                          <p className="text-[10px] font-bold text-slate-500">
                            {isBengali ? 'নগদ' : 'Paid'}: ৳
                            {fmtNum(formatMoney(tx.paidAmount))}
                            {tx.dueAmount > 0 && (
                              <span className="text-red-600 ml-1">
                                ({isBengali ? 'বাকি' : 'Due'} ৳
                                {fmtNum(formatMoney(tx.dueAmount))})
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteTxTarget(tx)}
                        title={
                          isBengali ? 'লেনদেন মুছুন' : 'Delete Transaction'
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Shared Modals */}
        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // SHARED MODALS RENDERER
  // =========================================================================
  function renderModals() {
    return (
      <>
        {/* Add / Edit Supplier Modal */}
        {showSupplierModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl">
              <div className="px-4 py-3 bg-emerald-50 dark:bg-slate-900 border-b border-emerald-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {editingSupplier
                    ? isBengali
                      ? 'সাপ্লায়ার তথ্য এডিট'
                      : 'Edit Supplier'
                    : isBengali
                    ? 'নতুন সাপ্লায়ার যোগ করুন'
                    : 'Add New Supplier'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveSupplier} className="p-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'সাপ্লায়ারের নাম *' : 'Supplier Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    placeholder={
                      isBengali ? 'যেমন: করিম এন্টারপ্রাইজ' : 'e.g. Karim Traders'
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali
                      ? 'কোম্পানি / ব্র্যান্ড / মার্কেট'
                      : 'Company / Brand / Market'}
                  </label>
                  <input
                    type="text"
                    value={supCompany}
                    onChange={(e) => setSupCompany(e.target.value)}
                    placeholder={
                      isBengali
                        ? 'যেমন: প্রাণ ডিস্ট্রিবিউটর'
                        : 'e.g. Wholesale Distributor'
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'মোবাইল নম্বর' : 'Mobile Number'}
                  </label>
                  <input
                    type="tel"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                  />
                </div>
                {!editingSupplier && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isBengali
                        ? 'পূর্বের বাকি / দেনা (ঐচ্ছিক ৳)'
                        : 'Opening Payable Balance (Optional ৳)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={supPayable}
                      onChange={(e) => setSupPayable(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSupplierModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {isBengali ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSupplier}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#00965E] hover:bg-[#007c4e] text-white cursor-pointer disabled:opacity-60"
                  >
                    {isSavingSupplier
                      ? '...'
                      : isBengali
                      ? 'সংরক্ষণ করুন'
                      : 'Save Supplier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Pay Supplier / Add Owed Modal */}
        {actionTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl">
              <div
                className={`px-4 py-3 border-b flex items-center justify-between ${
                  actionTarget.mode === 'PAY'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-slate-700'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-slate-700'
                }`}
              >
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {actionTarget.mode === 'PAY'
                      ? isBengali
                        ? 'সাপ্লায়ারকে পরিশোধ'
                        : 'Pay Supplier'
                      : isBengali
                      ? 'সাপ্লায়ারের বাকি যোগ'
                      : 'Add Credit Owed'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500">
                    {actionTarget.supplier.name} ·{' '}
                    {isBengali ? 'বর্তমান দেনা' : 'Payable'}: ৳
                    {fmtNum(
                      formatMoney(Math.max(0, actionTarget.supplier.payableBalance))
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActionTarget(null)}
                  className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAction} className="p-4 space-y-3">
                {/* Quick amount presets */}
                <div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[500, 1000, 2000, 5000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setActionAmount(String(preset))}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-[#00965E] cursor-pointer"
                      >
                        ৳{fmtNum(preset)}
                      </button>
                    ))}
                    {actionTarget.mode === 'PAY' &&
                      actionTarget.supplier.payableBalance > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setActionAmount(
                              String(actionTarget.supplier.payableBalance)
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-[11px] font-extrabold text-[#00965E] cursor-pointer"
                        >
                          {isBengali ? 'সম্পূর্ণ দেনা' : 'Full Payable'}
                        </button>
                      )}
                  </div>

                  <input
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={actionAmount}
                    onChange={(e) => setActionAmount(e.target.value)}
                    placeholder={isBengali ? 'টাকার পরিমাণ (৳)' : 'Amount (৳)'}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-base font-black dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <input
                  type="text"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={
                    isBengali
                      ? 'নোট / বিকাশ / চেক / চালান নং (ঐচ্ছিক)'
                      : 'Note / Reference / Challan (Optional)'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs dark:bg-slate-900 dark:text-white"
                />

                {/* Resulting Balance Preview */}
                {Number(actionAmount) > 0 && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">
                      {isBengali ? 'নতুন দেনার পরিমাণ' : 'New Payable Balance'}
                    </span>
                    <span className="font-black text-slate-900 dark:text-white">
                      ৳
                      {fmtNum(
                        formatMoney(
                          actionTarget.mode === 'PAY'
                            ? Math.max(
                                0,
                                actionTarget.supplier.payableBalance -
                                  Number(actionAmount)
                              )
                            : actionTarget.supplier.payableBalance +
                                Number(actionAmount)
                        )
                      )}
                    </span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActionTarget(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {isBengali ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAction}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white cursor-pointer disabled:opacity-60 ${
                      actionTarget.mode === 'PAY'
                        ? 'bg-[#00965E] hover:bg-[#007c4e]'
                        : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    {isSavingAction
                      ? '...'
                      : actionTarget.mode === 'PAY'
                      ? isBengali
                        ? 'পরিশোধ নিশ্চিত করুন'
                        : 'Confirm Payment'
                      : isBengali
                      ? 'বাকি যোগ করুন'
                      : 'Add Owed'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirm Delete Supplier Modal */}
        {deleteSupplierTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-5 border border-red-200 dark:border-red-900/50 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-black">
                  {isBengali ? 'সাপ্লায়ার মুছে ফেলবেন?' : 'Delete Supplier?'}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {isBengali
                  ? `"${deleteSupplierTarget.name}" রিসাইকেল বিনে পাঠানো হবে।`
                  : `"${deleteSupplierTarget.name}" will be moved to the Recycle Bin.`}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteSupplierTarget(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const target = deleteSupplierTarget;
                    setDeleteSupplierTarget(null);
                    await onDeleteSupplier(target.id, target.name);
                    if (selectedSupplierId === target.id) {
                      setSelectedSupplierId(null);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                >
                  {isBengali ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Delete Transaction Modal */}
        {deleteTxTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-5 border border-red-200 dark:border-red-900/50 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-black">
                  {isBengali
                    ? 'লেনদেনটি মুছে ফেলবেন?'
                    : 'Delete Transaction?'}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {deleteTxTarget.title} — ৳
                {fmtNum(formatMoney(deleteTxTarget.amount))}
              </p>
              <p className="text-[11px] text-slate-500">
                {isBengali
                  ? 'মুছে ফেললে সংশ্লিষ্ট স্টক ও সাপ্লায়ার ব্যালেন্স স্বয়ংক্রিয়ভাবে সমন্বয় হবে।'
                  : 'Stock and supplier payable balance will be reversed automatically.'}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTxTarget(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const target = deleteTxTarget;
                    setDeleteTxTarget(null);
                    await onDeleteTransaction(target);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                >
                  {isBengali ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PDF Report Modal (Central or Individual) */}
        {pdfModalMode && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-[#00965E]" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {pdfModalMode.type === 'CENTRAL'
                      ? isBengali
                        ? 'সাপ্লায়ার ব্যালেন্স রিপোর্ট (PDF)'
                        : 'Central Suppliers Payable Report (PDF)'
                      : `${pdfModalMode.supplier.name} — ${
                          isBengali ? 'খাতা রিপোর্ট (PDF)' : 'Ledger Report (PDF)'
                        }`}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5">
                  {pdfModalMode.type === 'CENTRAL' && (
                    <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 mr-1">
                      <button
                        type="button"
                        onClick={() => setCentralPdfScope('ALL')}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                          centralPdfScope === 'ALL'
                            ? 'bg-[#00965E] text-white'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {isBengali ? 'সব সাপ্লায়ার' : 'All'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCentralPdfScope('PAYABLE')}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                          centralPdfScope === 'PAYABLE'
                            ? 'bg-[#00965E] text-white'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {isBengali ? 'শুধু দেনা আছে' : 'Payable Only'}
                      </button>
                    </div>
                  )}

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
                    onClick={() => {
                      const stamp = new Date().toISOString().slice(0, 10);
                      const fname =
                        pdfModalMode.type === 'CENTRAL'
                          ? `Siaam_Store_Suppliers_Balance_${stamp}.pdf`
                          : `Siaam_Store_Supplier_${pdfModalMode.supplier.name.replace(
                              /\s+/g,
                              '_'
                            )}_${stamp}.pdf`;
                      handleDownloadPdf(fname);
                    }}
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
                    onClick={() => setPdfModalMode(null)}
                    className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Sheet Body */}
              <div className="overflow-y-auto p-4 bg-slate-100 dark:bg-slate-950 flex-1">
                <div
                  ref={pdfSheetRef}
                  className="bg-white text-slate-900 p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4"
                >
                  {/* Store Letterhead */}
                  <div className="flex items-start justify-between border-b-2 border-[#00965E] pb-3">
                    <div>
                      <h1 className="text-lg font-black text-[#007448]">
                        {isBengali ? 'সিয়াম স্টোর' : 'Siaam Store'}
                      </h1>
                      <p className="text-[11px] font-bold text-slate-500">
                        {pdfModalMode.type === 'CENTRAL'
                          ? isBengali
                            ? 'কেন্দ্রীয় সাপ্লায়ার দেনা-পাওনা রিপোর্ট'
                            : 'Central Suppliers Payable Balance Report'
                          : isBengali
                          ? 'সাপ্লায়ার লেনদেন ও ব্যালেন্স স্টেটমেন্ট'
                          : 'Supplier Transaction & Balance Statement'}
                      </p>
                    </div>
                    <div className="text-right text-[11px] text-slate-500">
                      <p className="font-bold text-slate-700">
                        {isBengali ? 'তারিখ' : 'Date'}:{' '}
                        {new Date().toLocaleDateString(
                          isBengali ? 'bn-BD' : 'en-GB'
                        )}
                      </p>
                      <p>
                        {new Date().toLocaleTimeString(
                          isBengali ? 'bn-BD' : 'en-US',
                          { hour: '2-digit', minute: '2-digit' }
                        )}
                      </p>
                    </div>
                  </div>

                  {pdfModalMode.type === 'CENTRAL' ? (
                    (() => {
                      const rows = suppliers
                        .filter((s) =>
                          centralPdfScope === 'PAYABLE'
                            ? s.payableBalance > 0
                            : true
                        )
                        .sort(
                          (a, b) =>
                            (supplierSlMap.get(a.id) ?? 0) -
                            (supplierSlMap.get(b.id) ?? 0)
                        );
                      const sumPurchased = rows.reduce(
                        (a, s) => a + Math.max(0, s.totalPurchased),
                        0
                      );
                      const sumPayable = rows.reduce(
                        (a, s) => a + Math.max(0, s.payableBalance),
                        0
                      );

                      return (
                        <>
                          <div className="grid grid-cols-3 gap-2.5 text-xs">
                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                              <p className="text-[10px] font-bold text-slate-500 uppercase">
                                {isBengali ? 'সাপ্লায়ার সংখ্যা' : 'Suppliers'}
                              </p>
                              <p className="text-sm font-black mt-0.5">
                                {fmtNum(rows.length)}
                              </p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                              <p className="text-[10px] font-bold text-slate-500 uppercase">
                                {isBengali ? 'মোট ক্রয়' : 'Total Purchased'}
                              </p>
                              <p className="text-sm font-black mt-0.5">
                                ৳{fmtNum(formatMoney(sumPurchased))}
                              </p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                              <p className="text-[10px] font-bold text-red-600 uppercase">
                                {isBengali ? 'মোট দেনা' : 'Total Payable'}
                              </p>
                              <p className="text-sm font-black text-red-700 mt-0.5">
                                ৳{fmtNum(formatMoney(sumPayable))}
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
                                  {isBengali ? 'সাপ্লায়ার' : 'Supplier'}
                                </th>
                                <th className="border border-slate-300 px-2 py-1.5 text-left">
                                  {isBengali ? 'কোম্পানি' : 'Company'}
                                </th>
                                <th className="border border-slate-300 px-2 py-1.5 text-left">
                                  {isBengali ? 'ফোন' : 'Phone'}
                                </th>
                                <th className="border border-slate-300 px-2 py-1.5 text-right">
                                  {isBengali ? 'মোট ক্রয়' : 'Purchased'}
                                </th>
                                <th className="border border-slate-300 px-2 py-1.5 text-right">
                                  {isBengali ? 'বর্তমান দেনা' : 'Payable'}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((s) => (
                                <tr key={s.id}>
                                  <td className="border border-slate-300 px-2 py-1.5 font-bold">
                                    #{fmtNum(supplierSlMap.get(s.id) ?? 0)}
                                  </td>
                                  <td className="border border-slate-300 px-2 py-1.5 font-bold">
                                    {s.name}
                                  </td>
                                  <td className="border border-slate-300 px-2 py-1.5">
                                    {s.company || '—'}
                                  </td>
                                  <td className="border border-slate-300 px-2 py-1.5">
                                    {s.phone || '—'}
                                  </td>
                                  <td className="border border-slate-300 px-2 py-1.5 text-right">
                                    ৳{fmtNum(formatMoney(s.totalPurchased))}
                                  </td>
                                  <td
                                    className={`border border-slate-300 px-2 py-1.5 text-right font-extrabold ${
                                      s.payableBalance > 0
                                        ? 'text-red-600'
                                        : 'text-[#00965E]'
                                    }`}
                                  >
                                    ৳
                                    {fmtNum(
                                      formatMoney(Math.max(0, s.payableBalance))
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {rows.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="border border-slate-300 px-2 py-4 text-center text-slate-400"
                                  >
                                    {isBengali
                                      ? 'কোনো সাপ্লায়ার পাওয়া যায়নি'
                                      : 'No suppliers found'}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </>
                      );
                    })()
                  ) : (
                    (() => {
                      const sup = pdfModalMode.supplier;
                      const supSl = supplierSlMap.get(sup.id) ?? 0;
                      const supTxs = supplierTransactionsMap.get(sup.id) || [];
                      const paidSum = supTxs.reduce((acc, tx) => {
                        if (tx.type === 'SUPPLIER_PAYMENT')
                          return acc + tx.amount;
                        if (tx.type === 'PURCHASE') return acc + tx.paidAmount;
                        return acc;
                      }, 0);

                      return (
                        <>
                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap justify-between gap-2 text-xs">
                            <div>
                              <p className="font-black text-sm">
                                #{fmtNum(supSl)} · {sup.name}
                              </p>
                              <p className="text-slate-600">
                                {sup.company ? `${sup.company} · ` : ''}
                                {sup.phone || (isBengali ? 'ফোন নেই' : 'No phone')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-slate-500 uppercase">
                                {isBengali ? 'বর্তমান দেনা' : 'Current Payable'}
                              </p>
                              <p
                                className={`text-base font-black ${
                                  sup.payableBalance > 0
                                    ? 'text-red-600'
                                    : 'text-[#00965E]'
                                }`}
                              >
                                ৳
                                {fmtNum(
                                  formatMoney(Math.max(0, sup.payableBalance))
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="p-2 rounded-lg border border-slate-200">
                              <p className="text-[10px] text-slate-500 font-bold">
                                {isBengali ? 'মোট ক্রয়' : 'Total Purchased'}
                              </p>
                              <p className="font-black">
                                ৳{fmtNum(formatMoney(sup.totalPurchased))}
                              </p>
                            </div>
                            <div className="p-2 rounded-lg border border-slate-200">
                              <p className="text-[10px] text-slate-500 font-bold">
                                {isBengali ? 'মোট পরিশোধ' : 'Total Paid'}
                              </p>
                              <p className="font-black text-[#00965E]">
                                ৳{fmtNum(formatMoney(paidSum))}
                              </p>
                            </div>
                            <div className="p-2 rounded-lg border border-slate-200">
                              <p className="text-[10px] text-slate-500 font-bold">
                                {isBengali ? 'মোট লেনদেন' : 'Transactions'}
                              </p>
                              <p className="font-black">
                                {fmtNum(supTxs.length)}
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
                                  {isBengali ? 'বিবরণ' : 'Details'}
                                </th>
                                <th className="border border-slate-300 px-2 py-1.5 text-right">
                                  {isBengali ? 'বিল' : 'Bill'}
                                </th>
                                <th className="border border-slate-300 px-2 py-1.5 text-right">
                                  {isBengali ? 'পরিশোধ' : 'Paid'}
                                </th>
                                <th className="border border-slate-300 px-2 py-1.5 text-right">
                                  {isBengali ? 'বাকি' : 'Due'}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {supTxs.map((tx, i) => {
                                const isPay = tx.type === 'SUPPLIER_PAYMENT';
                                const note = parseUserNote(tx);
                                return (
                                  <tr key={tx.id}>
                                    <td className="border border-slate-300 px-2 py-1.5 font-bold">
                                      {fmtNum(i + 1)}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 whitespace-nowrap">
                                      {formatTimestamp(tx.createdAt)}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5">
                                      <span className="font-bold">
                                        {tx.title}
                                      </span>
                                      {note && (
                                        <span className="block text-[10px] text-slate-500">
                                          {note}
                                        </span>
                                      )}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-right">
                                      {isPay
                                        ? '—'
                                        : `৳${fmtNum(formatMoney(tx.amount))}`}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-right text-[#00965E] font-bold">
                                      ৳
                                      {fmtNum(
                                        formatMoney(
                                          isPay ? tx.amount : tx.paidAmount
                                        )
                                      )}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-right text-red-600 font-bold">
                                      {isPay
                                        ? '—'
                                        : `৳${fmtNum(formatMoney(tx.dueAmount))}`}
                                    </td>
                                  </tr>
                                );
                              })}
                              {supTxs.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="border border-slate-300 px-2 py-4 text-center text-slate-400"
                                  >
                                    {isBengali
                                      ? 'কোনো লেনদেন রেকর্ড নেই'
                                      : 'No transactions found'}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // =========================================================================
  // MAIN VIEW: SUPPLIERS LEDGER LIST
  // =========================================================================
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3 pb-24">
      {/* Compact Emerald Top Summary Card */}
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
              <Truck className="w-4 h-4 text-emerald-100" />
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {strings.menuSuppliers}
              </h2>
              <span className="px-2 py-0.5 rounded-lg bg-white/20 text-[11px] font-extrabold">
                {fmtNum(suppliers.length)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPdfModalMode({ type: 'CENTRAL' })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isBengali ? 'ব্যালেন্স PDF' : 'Balance PDF'}</span>
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white text-[#007448] hover:bg-emerald-50 text-xs font-extrabold cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBengali ? 'নতুন সাপ্লায়ার' : 'Add Supplier'}</span>
            </button>
          </div>
        </div>

        {/* Compact 3-column Summary Strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/12 border border-white/15 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
              {isBengali ? 'মোট দেনা' : 'Total Payable'}
            </p>
            <p className="text-sm sm:text-base font-black mt-0.5">
              ৳{fmtNum(formatMoney(summaryStats.totalPayable))}
            </p>
          </div>
          <div className="rounded-xl bg-white/12 border border-white/15 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
              {isBengali ? 'বাকি আছে' : 'Owed'}
            </p>
            <p className="text-sm sm:text-base font-black mt-0.5">
              {fmtNum(summaryStats.owedCount)}{' '}
              <span className="text-[10px] font-semibold text-emerald-100">
                {isBengali ? 'জন' : 'sup'}
              </span>
            </p>
          </div>
          <div className="rounded-xl bg-white/12 border border-white/15 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
              {isBengali ? 'পরিশোধিত' : 'Settled'}
            </p>
            <p className="text-sm sm:text-base font-black mt-0.5">
              {fmtNum(summaryStats.settledCount)}{' '}
              <span className="text-[10px] font-semibold text-emerald-100">
                {isBengali ? 'জন' : 'sup'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Search + Single-Line Filter & Sort Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border-[1.5px] border-slate-200 dark:border-slate-700 space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isBengali
                ? 'নাম, কোম্পানি, মোবাইল বা #ক্রমিক খুঁজুন...'
                : 'Search by name, company, mobile or #SL...'
            }
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium bg-slate-50 dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 shrink-0">
            {(
              [
                {
                  id: 'ALL',
                  bn: `সব (${fmtNum(suppliers.length)})`,
                  en: `All (${suppliers.length})`,
                },
                {
                  id: 'PAYABLE',
                  bn: `দেনা (${fmtNum(summaryStats.owedCount)})`,
                  en: `Payable (${summaryStats.owedCount})`,
                },
                {
                  id: 'SETTLED',
                  bn: `পরিশোধ (${fmtNum(summaryStats.settledCount)})`,
                  en: `Settled (${summaryStats.settledCount})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer border ${
                  filterMode === tab.id
                    ? 'bg-[#00965E] text-white border-[#00965E]'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {isBengali ? tab.bn : tab.en}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SupplierSort)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-200 shrink-0"
          >
            <option value="PAYABLE_DESC">
              {isBengali ? 'সর্বোচ্চ দেনা' : 'Highest Payable'}
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

      {/* Suppliers List */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border-[1.5px] border-dashed border-slate-300 dark:border-slate-700 space-y-2">
          <Truck className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            {searchQuery
              ? isBengali
                ? 'কোনো সাপ্লায়ার খুঁজে পাওয়া যায়নি'
                : 'No matching suppliers found'
              : isBengali
              ? 'এখনো কোনো সাপ্লায়ার যোগ করা হয়নি'
              : 'No suppliers added yet'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#00965E] text-white text-xs font-extrabold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBengali ? 'প্রথম সাপ্লায়ার যোগ করুন' : 'Add First Supplier'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredSuppliers.map((supplier) => {
            const sl = supplierSlMap.get(supplier.id) ?? 0;
            const supTxs = supplierTransactionsMap.get(supplier.id) || [];
            const lastTx = supTxs[0];
            const hasPayable = supplier.payableBalance > 0;

            return (
              <div
                key={supplier.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 hover:border-[#00965E] transition-colors overflow-hidden"
              >
                {/* Clickable Main Info Area -> Opens Ledger Detail */}
                <div
                  onClick={() => setSelectedSupplierId(supplier.id)}
                  className="p-3.5 cursor-pointer flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black text-[#00965E]">
                        #{fmtNum(sl)}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        {supplier.name}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {supplier.company && (
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {supplier.company}
                        </span>
                      )}
                      {supplier.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {supplier.phone}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-slate-400">
                      <span>
                        {isBengali ? 'মোট ক্রয়' : 'Purchased'}:{' '}
                        <strong className="text-slate-600 dark:text-slate-300">
                          ৳{fmtNum(formatMoney(supplier.totalPurchased))}
                        </strong>
                      </span>
                      {lastTx && (
                        <span>
                          · {isBengali ? 'শেষ লেনদেন' : 'Last'}:{' '}
                          {formatTimestamp(lastTx.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Payable Badge */}
                  <div className="text-right shrink-0">
                    {hasPayable ? (
                      <div className="px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                        <p className="text-[9px] font-bold uppercase text-red-500">
                          {isBengali ? 'দেনা আছে' : 'Payable'}
                        </p>
                        <p className="text-sm font-black text-red-600 dark:text-red-400">
                          ৳{fmtNum(formatMoney(supplier.payableBalance))}
                        </p>
                      </div>
                    ) : (
                      <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
                        <p className="text-[10px] font-extrabold text-[#00965E] inline-flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {isBengali ? 'পরিশোধিত' : 'Settled'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Compact Action Footer Bar */}
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    {supplier.phone && (
                      <>
                        <a
                          href={`tel:${supplier.phone.replace(/[^0-9+]/g, '')}`}
                          title={isBengali ? 'কল' : 'Call'}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-[#00965E]"
                        >
                          <Phone className="w-3 h-3 text-[#00965E]" />
                          <span className="hidden sm:inline">
                            {isBengali ? 'কল' : 'Call'}
                          </span>
                        </a>
                        <a
                          href={buildSmsHref(supplier)}
                          title="SMS"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-blue-500"
                        >
                          <MessageSquare className="w-3 h-3 text-blue-600" />
                          <span className="hidden sm:inline">SMS</span>
                        </a>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setPdfModalMode({ type: 'INDIVIDUAL', supplier })
                      }
                      title={isBengali ? 'PDF রিপোর্ট' : 'PDF Report'}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-[#00965E] cursor-pointer"
                    >
                      <FileDown className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(supplier)}
                      title={isBengali ? 'এডিট' : 'Edit'}
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#00965E] cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onStartPurchaseForSupplier(supplier.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-[11px] font-extrabold text-[#00965E] hover:bg-emerald-100 cursor-pointer"
                    >
                      <PackagePlus className="w-3 h-3" />
                      <span>{isBengali ? '+মাল কিনুন' : '+Stock In'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openActionModal(supplier, 'OWE')}
                      className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[11px] font-extrabold text-amber-700 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                    >
                      {isBengali ? '+দেনা' : '+Owed'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openActionModal(supplier, 'PAY')}
                      className="px-2.5 py-1 rounded-lg bg-[#00965E] hover:bg-[#007c4e] text-white text-[11px] font-extrabold cursor-pointer"
                    >
                      {isBengali ? 'পরিশোধ' : 'Pay'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Shared Modals */}
      {renderModals()}
    </div>
  );
};
