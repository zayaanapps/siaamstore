import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Trash2,
  Search,
  X,
  Package,
  Users,
  Truck,
  Receipt,
  ShoppingBag,
  UserCheck,
  Layers,
  Clock,
  Eye,
  CheckSquare,
  Square,
  CheckCircle2,
  User,
  Calendar,
  ArrowUpDown,
  FileText,
  Sparkles,
} from 'lucide-react';
import {
  AppLanguage,
  RecycleBinItem,
  formatMoney,
  formatTimestamp,
  toBengaliDigits,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';
import {
  DeletionProtectionModal,
  DeletionProtectionTarget,
} from './DeletionProtectionModal';

interface RecycleBinViewProps {
  recycleBinItems: RecycleBinItem[];
  strings: DokanTranslations;
  language: AppLanguage;
  onBack: () => void;
  onRestoreFromRecycleBin: (item: RecycleBinItem) => Promise<void>;
  onPermanentlyDeleteRecycleBinItem: (itemId: string) => Promise<void>;
  onEmptyRecycleBin: () => Promise<void>;
}

type TypeFilter =
  | 'ALL'
  | 'PRODUCT'
  | 'CUSTOMER'
  | 'TRANSACTION'
  | 'EXPENSE'
  | 'SUPPLIER'
  | 'STAFF';

type TimeFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH';
type SortMode = 'NEWEST' | 'OLDEST' | 'NAME';

function getItemMillis(item: RecycleBinItem): number {
  if (!item.deletedAt) return 0;
  try {
    return item.deletedAt.toDate().getTime();
  } catch {
    return 0;
  }
}

function normalizeType(rawType: string): string {
  const upper = (rawType || '').toUpperCase().trim();
  if (upper.includes('PRODUCT')) return 'PRODUCT';
  if (upper.includes('CUSTOMER')) return 'CUSTOMER';
  if (upper.includes('SUPPLIER')) return 'SUPPLIER';
  if (upper.includes('EXPENSE')) return 'EXPENSE';
  if (upper.includes('STAFF')) return 'STAFF';
  if (upper.includes('TX') || upper.includes('TRANSACTION') || upper.includes('SALE') || upper.includes('PURCHASE')) {
    return 'TRANSACTION';
  }
  return upper || 'OTHER';
}

function getCategoryMeta(rawType: string, isBn: boolean) {
  const norm = normalizeType(rawType);
  switch (norm) {
    case 'PRODUCT':
      return {
        label: isBn ? 'পণ্য' : 'Product',
        icon: Package,
        iconBox:
          'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-[#008A54] dark:text-emerald-300',
        borderTint: 'border-emerald-200/80 dark:border-slate-700',
        textTint: 'text-[#008A54] dark:text-emerald-400',
      };
    case 'CUSTOMER':
      return {
        label: isBn ? 'কাস্টমার' : 'Customer',
        icon: Users,
        iconBox:
          'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300',
        borderTint: 'border-sky-200/80 dark:border-slate-700',
        textTint: 'text-sky-700 dark:text-sky-400',
      };
    case 'SUPPLIER':
      return {
        label: isBn ? 'সাপ্লায়ার' : 'Supplier',
        icon: Truck,
        iconBox:
          'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300',
        borderTint: 'border-indigo-200/80 dark:border-slate-700',
        textTint: 'text-indigo-700 dark:text-indigo-400',
      };
    case 'EXPENSE':
      return {
        label: isBn ? 'খরচ' : 'Expense',
        icon: Receipt,
        iconBox:
          'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
        borderTint: 'border-amber-200/80 dark:border-slate-700',
        textTint: 'text-amber-700 dark:text-amber-400',
      };
    case 'STAFF':
      return {
        label: isBn ? 'স্টাফ' : 'Staff',
        icon: UserCheck,
        iconBox:
          'bg-violet-50 dark:bg-violet-950/60 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300',
        borderTint: 'border-violet-200/80 dark:border-slate-700',
        textTint: 'text-violet-700 dark:text-violet-400',
      };
    case 'TRANSACTION':
      return {
        label: isBn ? 'লেনদেন' : 'Transaction',
        icon: ShoppingBag,
        iconBox:
          'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300',
        borderTint: 'border-teal-200/80 dark:border-slate-700',
        textTint: 'text-teal-700 dark:text-teal-400',
      };
    default:
      return {
        label: rawType || (isBn ? 'অন্যান্য' : 'Record'),
        icon: FileText,
        iconBox:
          'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
        borderTint: 'border-slate-200 dark:border-slate-700',
        textTint: 'text-slate-600 dark:text-slate-400',
      };
  }
}

function parsePayloadSafely(payloadJson: string): Record<string, unknown> | null {
  if (!payloadJson) return null;
  try {
    const parsed = JSON.parse(payloadJson);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function formatPayloadHighlights(
  payload: Record<string, unknown> | null,
  language: AppLanguage
): Array<{ label: string; value: string }> {
  if (!payload) return [];
  const isBn = language === AppLanguage.BENGALI;
  const rows: Array<{ label: string; value: string }> = [];

  const moneyKeys: Array<[string, string, string]> = [
    ['sellPrice', 'বিক্রয় মূল্য', 'Sell Price'],
    ['buyPrice', 'ক্রয় মূল্য', 'Buy Price'],
    ['amount', 'পরিমাণ (টাকা)', 'Amount'],
    ['paidAmount', 'পরিশোধ', 'Paid Amount'],
    ['dueAmount', 'বাকি', 'Due Amount'],
    ['totalDue', 'মোট বাকি', 'Total Due'],
    ['payableBalance', 'পাওনা ব্যালেন্স', 'Payable Balance'],
    ['salary', 'মাসিক বেতন', 'Monthly Salary'],
  ];

  for (const [key, bnLabel, enLabel] of moneyKeys) {
    const val = payload[key];
    if (typeof val === 'number' && !Number.isNaN(val) && val > 0) {
      rows.push({
        label: isBn ? bnLabel : enLabel,
        value: `৳${toBengaliDigits(formatMoney(val), language)}`,
      });
    }
  }

  const textKeys: Array<[string, string, string]> = [
    ['category', 'ক্যাটাগরি', 'Category'],
    ['phone', 'মোবাইল', 'Phone'],
    ['address', 'ঠিকানা', 'Address'],
    ['company', 'কোম্পানি', 'Company'],
    ['role', 'পদবি', 'Role'],
    ['customerName', 'কাস্টমার', 'Customer'],
    ['supplierName', 'সাপ্লায়ার', 'Supplier'],
    ['type', 'ধরন', 'Type'],
    ['barcode', 'বারকোড', 'Barcode'],
    ['notes', 'নোট', 'Notes'],
  ];

  for (const [key, bnLabel, enLabel] of textKeys) {
    const val = payload[key];
    if (typeof val === 'string' && val.trim()) {
      rows.push({
        label: isBn ? bnLabel : enLabel,
        value: val.trim(),
      });
    }
  }

  const stockVal =
    typeof payload.stock === 'number'
      ? payload.stock
      : typeof payload.stockQty === 'number'
        ? payload.stockQty
        : null;
  if (stockVal !== null) {
    const unit = typeof payload.unit === 'string' && payload.unit ? payload.unit : 'pcs';
    rows.push({
      label: isBn ? 'স্টক পরিমাণ' : 'Stock Qty',
      value: `${toBengaliDigits(stockVal, language)} ${unit}`,
    });
  }

  return rows;
}

function getDateGroupLabel(millis: number, isBn: boolean): string {
  if (!millis) return isBn ? 'তারিখ অজানা' : 'Earlier';
  const d = new Date(millis);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;

  if (millis >= todayStart) return isBn ? 'আজ' : 'Today';
  if (millis >= yesterdayStart) return isBn ? 'গতকাল' : 'Yesterday';

  return d.toLocaleDateString(isBn ? 'bn-BD' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const RecycleBinView: React.FC<RecycleBinViewProps> = ({
  recycleBinItems,
  strings,
  language,
  onBack,
  onRestoreFromRecycleBin,
  onPermanentlyDeleteRecycleBinItem,
  onEmptyRecycleBin,
}) => {
  const isBn = language === AppLanguage.BENGALI;

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('NEWEST');

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Busy states
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Modals
  const [inspectItem, setInspectItem] = useState<RecycleBinItem | null>(null);
  const [protectionTarget, setProtectionTarget] =
    useState<DeletionProtectionTarget | null>(null);

  // Compute summary stats & category counts
  const { todayCount, categoryCounts, distinctCategories } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let today = 0;
    const counts: Record<string, number> = {
      ALL: recycleBinItems.length,
      PRODUCT: 0,
      CUSTOMER: 0,
      TRANSACTION: 0,
      EXPENSE: 0,
      SUPPLIER: 0,
      STAFF: 0,
    };
    const distinct = new Set<string>();

    for (const item of recycleBinItems) {
      const ms = getItemMillis(item);
      if (ms >= todayStart) today += 1;
      const norm = normalizeType(item.itemType);
      distinct.add(norm);
      if (counts[norm] !== undefined) {
        counts[norm] += 1;
      }
    }

    return {
      todayCount: today,
      categoryCounts: counts,
      distinctCategories: distinct.size,
    };
  }, [recycleBinItems]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const todayStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    ).getTime();

    const list = recycleBinItems.filter((item) => {
      if (typeFilter !== 'ALL' && normalizeType(item.itemType) !== typeFilter) {
        return false;
      }

      if (timeFilter !== 'ALL') {
        const ms = getItemMillis(item);
        if (timeFilter === 'TODAY' && ms < todayStart) return false;
        if (timeFilter === 'WEEK' && ms < now - 7 * 86400000) return false;
        if (timeFilter === 'MONTH' && ms < now - 30 * 86400000) return false;
      }

      if (q) {
        const haystack = `${item.name} ${item.details} ${item.itemType} ${item.deletedBy}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    const sorted = [...list];
    if (sortMode === 'NEWEST') {
      sorted.sort((a, b) => getItemMillis(b) - getItemMillis(a));
    } else if (sortMode === 'OLDEST') {
      sorted.sort((a, b) => getItemMillis(a) - getItemMillis(b));
    } else {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return sorted;
  }, [recycleBinItems, typeFilter, timeFilter, searchQuery, sortMode]);

  // Date groups for visual organization (when sorted by date)
  const groupedItems = useMemo(() => {
    if (sortMode === 'NAME') {
      return [
        {
          label: isBn ? 'নাম অনুযায়ী (A–Z)' : 'Sorted A–Z',
          items: filteredItems,
        },
      ];
    }

    const groups: Array<{ label: string; items: RecycleBinItem[] }> = [];
    const map = new Map<string, RecycleBinItem[]>();

    for (const item of filteredItems) {
      const key = getDateGroupLabel(getItemMillis(item), isBn);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        const next = [item];
        map.set(key, next);
        groups.push({ label: key, items: next });
      }
    }

    return groups;
  }, [filteredItems, sortMode, isBn]);

  const allFilteredSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.has(item.id));

  const selectedVisibleItems = useMemo(
    () => recycleBinItems.filter((item) => selectedIds.has(item.id)),
    [recycleBinItems, selectedIds]
  );

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const item of filteredItems) next.delete(item.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const item of filteredItems) next.add(item.id);
        return next;
      });
    }
  };

  const handleRestoreOne = async (item: RecycleBinItem) => {
    setBusyItemId(item.id);
    try {
      await onRestoreFromRecycleBin(item);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      if (inspectItem?.id === item.id) setInspectItem(null);
    } finally {
      setBusyItemId(null);
    }
  };

  const handlePermanentDeleteOne = async (item: RecycleBinItem) => {
    setBusyItemId(item.id);
    try {
      await onPermanentlyDeleteRecycleBinItem(item.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      if (inspectItem?.id === item.id) setInspectItem(null);
    } finally {
      setBusyItemId(null);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedVisibleItems.length === 0) return;
    setBulkBusy(true);
    try {
      const priority = (rawType: string): number => {
        const norm = normalizeType(rawType);
        if (norm === 'PRODUCT' || norm === 'CUSTOMER' || norm === 'SUPPLIER' || norm === 'STAFF') {
          return 0;
        }
        return 1;
      };
      const ordered = [...selectedVisibleItems].sort(
        (a, b) => priority(a.itemType) - priority(b.itemType) || getItemMillis(a) - getItemMillis(b)
      );
      for (const item of ordered) {
        await onRestoreFromRecycleBin(item);
      }
      setSelectedIds(new Set());
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedVisibleItems.length === 0) return;
    setBulkBusy(true);
    try {
      for (const item of selectedVisibleItems) {
        await onPermanentlyDeleteRecycleBinItem(item.id);
      }
      setSelectedIds(new Set());
    } finally {
      setBulkBusy(false);
    }
  };

  const handleConfirmEmptyBin = async () => {
    setBulkBusy(true);
    try {
      await onEmptyRecycleBin();
      setSelectedIds(new Set());
    } finally {
      setBulkBusy(false);
    }
  };

  const downloadRecycleBinBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: 'Siaam Store Recycle Bin',
      count: recycleBinItems.length,
      items: recycleBinItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siaam-recycle-bin-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const requestPermanentDeleteOne = (item: RecycleBinItem) => {
    setProtectionTarget({
      title: 'Permanent Erase — Single Record',
      titleBn: 'স্থায়ীভাবে মুছে ফেলা (১ টি আইটেম)',
      description:
        'This record will be permanently wiped from the Recycle Bin and can never be restored again.',
      descriptionBn:
        'এই রেকর্ডটি রিসাইকেল বিন থেকে চিরতরে মুছে যাবে এবং পরে আর কখনোই পুনরুদ্ধার করা যাবে না।',
      itemCount: 1,
      previewItems: [`${item.name} (${item.itemType})`],
      confirmPhrase: 'DELETE',
      isPermanent: true,
      actionButtonLabel: 'Erase Forever',
      actionButtonLabelBn: 'চিরতরে মুছে ফেলুন',
      onExecute: () => handlePermanentDeleteOne(item),
    });
  };

  const requestBulkPermanentDelete = () => {
    if (selectedVisibleItems.length === 0) return;
    setProtectionTarget({
      title: `Permanent Erase — ${selectedVisibleItems.length} Items`,
      titleBn: `স্থায়ীভাবে মুছে ফেলা (${toBengaliDigits(selectedVisibleItems.length, language)} টি আইটেম)`,
      description:
        'All selected records will be permanently erased from the Recycle Bin with no possibility of recovery.',
      descriptionBn:
        'নির্বাচিত সব রেকর্ড চিরতরে মুছে যাবে এবং আর কখনোই ফিরিয়ে আনা যাবে না।',
      itemCount: selectedVisibleItems.length,
      previewItems: selectedVisibleItems.map((i) => `${i.name} (${i.itemType})`),
      confirmPhrase: 'DELETE',
      isPermanent: true,
      actionButtonLabel: `Erase ${selectedVisibleItems.length} Forever`,
      actionButtonLabelBn: `${toBengaliDigits(selectedVisibleItems.length, language)} টি চিরতরে মুছুন`,
      onExecute: handleBulkPermanentDelete,
    });
  };

  const requestEmptyRecycleBin = () => {
    if (recycleBinItems.length === 0) return;
    setProtectionTarget({
      title: 'Empty Entire Recycle Bin',
      titleBn: 'পুরো রিসাইকেল বিন খালি করুন',
      description:
        'Every single record currently inside the Recycle Bin will be permanently wiped forever.',
      descriptionBn:
        'রিসাইকেল বিনে থাকা প্রতিটি রেকর্ড চিরতরে মুছে ফেলা হবে।',
      itemCount: recycleBinItems.length,
      previewItems: recycleBinItems.map((i) => `${i.name} (${i.itemType})`),
      confirmPhrase: 'EMPTY BIN',
      isPermanent: true,
      actionButtonLabel: 'Empty Bin Forever',
      actionButtonLabelBn: 'সব চিরতরে খালি করুন',
      onExecute: handleConfirmEmptyBin,
    });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setTimeFilter('ALL');
    setSortMode('NEWEST');
  };

  const categoryTabs: Array<{ key: TypeFilter; label: string; count: number }> = [
    { key: 'ALL', label: isBn ? 'সব' : 'All', count: categoryCounts.ALL || 0 },
    { key: 'PRODUCT', label: isBn ? 'পণ্য' : 'Products', count: categoryCounts.PRODUCT || 0 },
    { key: 'CUSTOMER', label: isBn ? 'কাস্টমার' : 'Customers', count: categoryCounts.CUSTOMER || 0 },
    { key: 'TRANSACTION', label: isBn ? 'লেনদেন' : 'Transactions', count: categoryCounts.TRANSACTION || 0 },
    { key: 'EXPENSE', label: isBn ? 'খরচ' : 'Expenses', count: categoryCounts.EXPENSE || 0 },
    { key: 'SUPPLIER', label: isBn ? 'সাপ্লায়ার' : 'Suppliers', count: categoryCounts.SUPPLIER || 0 },
    { key: 'STAFF', label: isBn ? 'স্টাফ' : 'Staff', count: categoryCounts.STAFF || 0 },
  ];

  const hasActiveFilter =
    searchQuery.trim() !== '' || typeFilter !== 'ALL' || timeFilter !== 'ALL';

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-24 space-y-4">
      {/* Compact & Minimal Emerald Header + Summary */}
      <div className="rounded-2xl bg-gradient-to-r from-[#064E3B] via-[#047857] to-[#00A862] px-3.5 py-3 text-white shadow-sm border border-emerald-400/20 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label={isBn ? 'পিছনে যান' : 'Back to Tools'}
              className="min-w-[38px] min-h-[38px] rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                <h1 className="text-sm sm:text-base font-black tracking-tight truncate">
                  {strings.menuRecycleBin}
                </h1>
              </div>
            </div>
          </div>

          {recycleBinItems.length > 0 && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={requestEmptyRecycleBin}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-red-500/90 hover:bg-red-600 border border-red-300/40 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isBn ? 'খালি করুন' : 'Empty Bin'}</span>
            </button>
          )}
        </div>

        {/* Compact Minimal Inline Summary Bar */}
        <div className="grid grid-cols-3 divide-x divide-white/20 rounded-xl bg-white/10 border border-white/15 py-1.5 px-1 text-center">
          <div className="px-1.5 flex items-center justify-center gap-1.5 min-w-0">
            <Trash2 className="w-3 h-3 text-emerald-200 shrink-0" />
            <span className="text-[11px] font-medium text-emerald-100 truncate">
              {isBn ? 'মোট' : 'Total'}
            </span>
            <span className="text-xs font-black tabular-nums">
              {toBengaliDigits(recycleBinItems.length, language)}
            </span>
          </div>
          <div className="px-1.5 flex items-center justify-center gap-1.5 min-w-0">
            <Layers className="w-3 h-3 text-emerald-200 shrink-0" />
            <span className="text-[11px] font-medium text-emerald-100 truncate">
              {isBn ? 'ধরন' : 'Types'}
            </span>
            <span className="text-xs font-black tabular-nums">
              {toBengaliDigits(distinctCategories, language)}
            </span>
          </div>
          <div className="px-1.5 flex items-center justify-center gap-1.5 min-w-0">
            <Clock className="w-3 h-3 text-emerald-200 shrink-0" />
            <span className="text-[11px] font-medium text-emerald-100 truncate">
              {isBn ? 'আজ' : 'Today'}
            </span>
            <span className="text-xs font-black tabular-nums">
              {toBengaliDigits(todayCount, language)}
            </span>
          </div>
        </div>
      </div>

      {/* Search, Category Filter & Sort Panel */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-slate-700 p-3.5 shadow-xs space-y-3">
        {/* Search Input + Sort + Time Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="relative sm:col-span-6">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isBn
                  ? 'নাম, বিবরণ, ক্যাটাগরি বা ইউজার দিয়ে খুঁজুন...'
                  : 'Search name, details, category, or user...'
              }
              className="w-full min-h-[42px] pl-9 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#00965E]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="sm:col-span-3 relative">
            <Calendar className="w-3.5 h-3.5 text-[#00965E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              aria-label={isBn ? 'সময় ফিল্টার' : 'Time range'}
              className="w-full min-h-[42px] pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#00965E] cursor-pointer"
            >
              <option value="ALL">{isBn ? 'সব সময়' : 'All Time'}</option>
              <option value="TODAY">{isBn ? 'আজ' : 'Today'}</option>
              <option value="WEEK">{isBn ? 'গত ৭ দিন' : 'Last 7 Days'}</option>
              <option value="MONTH">{isBn ? 'গত ৩০ দিন' : 'Last 30 Days'}</option>
            </select>
          </div>

          <div className="sm:col-span-3 relative">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#00965E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label={isBn ? 'সাজানোর ধরন' : 'Sort order'}
              className="w-full min-h-[42px] pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#00965E] cursor-pointer"
            >
              <option value="NEWEST">{isBn ? 'নতুন আগে' : 'Newest First'}</option>
              <option value="OLDEST">{isBn ? 'পুরানো আগে' : 'Oldest First'}</option>
              <option value="NAME">{isBn ? 'নাম (A–Z)' : 'Name (A–Z)'}</option>
            </select>
          </div>
        </div>

        {/* Category Filter Segmented Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {categoryTabs.map((tab) => {
            const active = typeFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTypeFilter(tab.key)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#00965E] text-white border-[#00965E] shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-black tabular-nums ${
                    active ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  ({toBengaliDigits(tab.count, language)})
                </span>
              </button>
            );
          })}
        </div>

        {/* Select All / Result Counter Bar */}
        {filteredItems.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              className="min-h-[36px] px-2.5 py-1 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-[#00965E]" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {allFilteredSelected
                  ? isBn
                    ? 'সব নির্বাচন বাতিল করুন'
                    : 'Deselect All'
                  : isBn
                    ? `সব নির্বাচন করুন (${toBengaliDigits(filteredItems.length, language)})`
                    : `Select All (${filteredItems.length})`}
              </span>
            </button>

            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
              {isBn
                ? `দেখানো হচ্ছে ${toBengaliDigits(filteredItems.length, language)} / ${toBengaliDigits(recycleBinItems.length, language)} টি`
                : `Showing ${filteredItems.length} of ${recycleBinItems.length} items`}
            </span>
          </div>
        )}
      </div>

      {/* Multi-Select Bulk Action Bar */}
      {selectedVisibleItems.length > 0 && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-[#00965E]/50 p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00965E] text-white font-black text-xs tabular-nums flex items-center justify-center">
              {toBengaliDigits(selectedVisibleItems.length, language)}
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                {isBn
                  ? `${toBengaliDigits(selectedVisibleItems.length, language)} টি আইটেম নির্বাচিত`
                  : `${selectedVisibleItems.length} item${selectedVisibleItems.length > 1 ? 's' : ''} selected`}
              </p>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] font-bold text-[#008A54] dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {isBn ? 'নির্বাচন মুছুন' : 'Clear selection'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={bulkBusy}
              onClick={handleBulkRestore}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#00965E] hover:bg-[#007D4E] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>
                {bulkBusy
                  ? isBn
                    ? 'প্রসেস হচ্ছে...'
                    : 'Working...'
                  : isBn
                    ? 'সব পুনরুদ্ধার'
                    : 'Restore Selected'}
              </span>
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={requestBulkPermanentDelete}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isBn ? 'স্থায়ীভাবে মুছুন' : 'Delete Selected'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Items List (Date-Grouped Decorated Cards) */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-slate-700 p-8 sm:p-10 text-center space-y-3 shadow-xs">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#00965E] dark:text-emerald-400">
            {recycleBinItems.length === 0 ? (
              <CheckCircle2 className="w-7 h-7" />
            ) : (
              <Search className="w-7 h-7" />
            )}
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {recycleBinItems.length === 0
                ? isBn
                  ? 'রিসাইকেল বিন সম্পূর্ণ খালি'
                  : 'Recycle Bin is Empty'
                : isBn
                  ? 'কোনো আইটেম পাওয়া যায়নি'
                  : 'No Matching Items Found'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {recycleBinItems.length === 0
                ? isBn
                  ? 'ভুলবশত মুছে ফেলা পণ্য, কাস্টমার, সাপ্লায়ার, লেনদেন বা স্টাফ এখানে সংরক্ষিত থাকে যাতে সহজেই পুনরুদ্ধার করা যায়।'
                  : 'Deleted products, customers, suppliers, transactions, expenses, and staff appear here for safe one-tap recovery.'
                : isBn
                  ? 'আপনার সার্চ বা ফিল্টারের সাথে মিল পাওয়া যায়নি।'
                  : 'Try adjusting your search keywords, category, or time range.'}
            </p>
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#008A54] dark:text-emerald-300 text-xs font-bold cursor-pointer"
            >
              {isBn ? 'ফিল্টার রিসেট করুন' : 'Reset Filters'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedItems.map((group) => (
            <div key={group.label} className="space-y-2.5">
              {/* Group Date Header */}
              <div className="flex items-center gap-2 px-1">
                <Calendar className="w-3.5 h-3.5 text-[#00965E]" />
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                  {group.label}
                </span>
                <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                  · {toBengaliDigits(group.items.length, language)}
                </span>
                <div className="flex-1 border-t border-slate-200/80 dark:border-slate-800" />
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map((item) => {
                  const meta = getCategoryMeta(item.itemType, isBn);
                  const CatIcon = meta.icon;
                  const isSelected = selectedIds.has(item.id);
                  const isBusy = busyItemId === item.id;
                  const parsed = parsePayloadSafely(item.payloadJson);
                  const highlights = formatPayloadHighlights(parsed, language).slice(0, 2);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl bg-white dark:bg-slate-900 border-2 transition-colors shadow-xs flex flex-col justify-between overflow-hidden ${
                        isSelected
                          ? 'border-[#00965E] bg-emerald-50/30 dark:bg-emerald-950/20'
                          : `${meta.borderTint} hover:border-emerald-300 dark:hover:border-emerald-700`
                      }`}
                    >
                      {/* Top Content Area */}
                      <div className="p-3.5 space-y-2.5">
                        <div className="flex items-start gap-2.5">
                          {/* Select Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleSelectItem(item.id)}
                            aria-label={isBn ? 'নির্বাচন করুন' : 'Select item'}
                            className="mt-0.5 p-1 -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#00965E]" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                            )}
                          </button>

                          {/* Colored Category Icon Box */}
                          <div
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${meta.iconBox}`}
                          >
                            <CatIcon className="w-5 h-5" />
                          </div>

                          {/* Title & Clean Metadata */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold">
                              <span className={meta.textTint}>{meta.label}</span>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span className="text-slate-500 dark:text-slate-400 truncate">
                                {formatTimestamp(item.deletedAt)}
                              </span>
                            </div>
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                              {item.name || (isBn ? 'নামহীন রেকর্ড' : 'Untitled Record')}
                            </h3>
                            {item.details && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                                {item.details}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Quick Parsed Data Preview Strip */}
                        {highlights.length > 0 && (
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 px-3 py-2 grid grid-cols-2 gap-2">
                            {highlights.map((h) => (
                              <div key={h.label} className="min-w-0">
                                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate">
                                  {h.label}
                                </p>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate tabular-nums">
                                  {h.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Deleted By Line */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                          <span className="inline-flex items-center gap-1 truncate">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {isBn ? 'মুছেছেন: ' : 'Deleted by '}
                              <strong className="font-bold text-slate-700 dark:text-slate-300">
                                {item.deletedBy || 'Admin'}
                              </strong>
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Decorated Footer Action Bar */}
                      <div className="px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setInspectItem(item)}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-slate-700 dark:text-slate-200 text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#00965E]" />
                          <span>{isBn ? 'বিস্তারিত' : 'Details'}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy || bulkBusy}
                            onClick={() => handleRestoreOne(item)}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#00965E] hover:bg-[#007D4E] text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>
                              {isBusy
                                ? isBn
                                  ? 'হচ্ছে...'
                                  : 'Restoring...'
                                : isBn
                                  ? 'পুনরুদ্ধার'
                                  : 'Restore'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy || bulkBusy}
                            onClick={() => requestPermanentDeleteOne(item)}
                            aria-label={isBn ? 'স্থায়ীভাবে মুছুন' : 'Delete Permanently'}
                            className="min-h-[36px] min-w-[36px] px-2 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decorated Item Inspector Modal */}
      {inspectItem && (() => {
        const meta = getCategoryMeta(inspectItem.itemType, isBn);
        const CatIcon = meta.icon;
        const parsed = parsePayloadSafely(inspectItem.payloadJson);
        const highlights = formatPayloadHighlights(parsed, language);

        return (
          <div
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setInspectItem(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#064E3B] to-[#00965E] px-5 py-4 text-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                    <CatIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-emerald-100">
                      {meta.label} · {isBn ? 'বিস্তারিত তথ্য' : 'Deleted Record Details'}
                    </p>
                    <h3 className="text-sm font-black truncate">
                      {inspectItem.name}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectItem(null)}
                  className="min-w-[38px] min-h-[38px] rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {inspectItem.details && (
                  <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60 p-3.5">
                    <p className="text-[10px] font-bold text-[#008A54] dark:text-emerald-400 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>{isBn ? 'সংক্ষিপ্ত বিবরণ' : 'Summary'}</span>
                    </p>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                      {inspectItem.details}
                    </p>
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-200/70 dark:divide-slate-700/70 text-xs">
                  <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                      {isBn ? 'ক্যাটাগরি' : 'Category'}
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {meta.label} ({inspectItem.itemType})
                    </span>
                  </div>
                  <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                      {isBn ? 'মুছেছেন' : 'Deleted By'}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {inspectItem.deletedBy || 'Admin'}
                    </span>
                  </div>
                  <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                      {isBn ? 'মুছে ফেলার সময়' : 'Deleted At'}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatTimestamp(inspectItem.deletedAt)}
                    </span>
                  </div>
                </div>

                {/* Parsed Record Fields */}
                {highlights.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                      {isBn ? 'সংরক্ষিত তথ্যের বিবরণ' : 'Saved Record Fields'}
                    </p>
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-200/70 dark:divide-slate-700/70 text-xs">
                      {highlights.map((row) => (
                        <div
                          key={row.label}
                          className="px-3.5 py-2 flex items-center justify-between gap-3"
                        >
                          <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">
                            {row.label}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white text-right break-words tabular-nums">
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modal Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busyItemId === inspectItem.id}
                    onClick={() => handleRestoreOne(inspectItem)}
                    className="min-h-[44px] px-3 py-2.5 rounded-xl bg-[#00965E] hover:bg-[#007D4E] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{isBn ? 'পুনরুদ্ধার করুন' : 'Restore Now'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyItemId === inspectItem.id}
                    onClick={() => requestPermanentDeleteOne(inspectItem)}
                    className="min-h-[44px] px-3 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isBn ? 'স্থায়ীভাবে মুছুন' : 'Delete Forever'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5-Layer Deletion Protection Modal */}
      <DeletionProtectionModal
        target={protectionTarget}
        onClose={() => setProtectionTarget(null)}
        language={language}
        onDownloadSafetyBackup={downloadRecycleBinBackup}
      />
    </div>
  );
};
