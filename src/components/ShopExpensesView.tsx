import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Receipt,
  Plus,
  Search,
  Trash2,
  FileDown,
  Printer,
  X,
  Clock,
  Wallet,
  AlertTriangle,
  Tag,
  Sparkles,
  Check,
  PieChart,
  Edit3,
  Settings2,
  RotateCcw,
  Calendar,
  TrendingDown,
  Layers,
  FileText,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  AppLanguage,
  ExpenseCategorySetting,
  ExpensePresetSetting,
  StoreTransaction,
  formatMoney,
  formatTimestamp,
  toBengaliDigits,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';

interface ShopExpensesViewProps {
  transactions: StoreTransaction[];
  strings: DokanTranslations;
  language: AppLanguage;
  cloudCategories?: ExpenseCategorySetting[];
  cloudPresets?: ExpensePresetSetting[];
  onSyncExpenseSettings?: (data: {
    expenseCategories: ExpenseCategorySetting[];
    expensePresets: ExpensePresetSetting[];
  }) => Promise<void> | void;
  onBack: () => void;
  onOpenCashBook: () => void;
  onRecordExpense: (
    title: string,
    category: string,
    amount: number,
    notes?: string
  ) => Promise<void>;
  onDeleteTransaction: (tx: StoreTransaction) => Promise<void>;
}

type ExpenseTab = 'ADD' | 'HISTORY';
type ExpenseTimeFilter = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_YEAR' | 'ALL';

interface ExpenseCategoryItem {
  id: string;
  labelEn: string;
  labelBn: string;
  colorKey: string;
}

interface CommonExpensePreset {
  id: string;
  titleEn: string;
  titleBn: string;
  category: string;
  defaultAmount?: number;
}

const LEGACY_CUSTOM_CATS_KEY = 'siaam_custom_expense_categories_v1';
const CATEGORIES_STORAGE_KEY = 'siaam_expense_categories_v2';
const COMMON_PRESETS_STORAGE_KEY = 'siaam_common_expenses_v1';

const CATEGORY_COLOR_PALETTE: Record<
  string,
  {
    nameEn: string;
    nameBn: string;
    dot: string;
    badge: string;
    iconBg: string;
    bar: string;
  }
> = {
  emerald: {
    nameEn: 'Emerald',
    nameBn: 'সবুজ',
    dot: 'bg-[#00965E]',
    badge:
      'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-[#007a4d] dark:text-emerald-300',
    iconBg:
      'bg-emerald-50 dark:bg-emerald-900/30 text-[#00965E] border-emerald-200/80 dark:border-emerald-800',
    bar: 'bg-[#00965E]',
  },
  amber: {
    nameEn: 'Amber',
    nameBn: 'হলুদ',
    dot: 'bg-amber-500',
    badge:
      'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
    iconBg:
      'bg-amber-50 dark:bg-amber-900/30 text-amber-600 border-amber-200/80 dark:border-amber-800',
    bar: 'bg-amber-500',
  },
  blue: {
    nameEn: 'Blue',
    nameBn: 'নীল',
    dot: 'bg-blue-500',
    badge:
      'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    iconBg:
      'bg-blue-50 dark:bg-blue-900/30 text-blue-600 border-blue-200/80 dark:border-blue-800',
    bar: 'bg-blue-500',
  },
  rose: {
    nameEn: 'Rose',
    nameBn: 'গোলাপি',
    dot: 'bg-rose-500',
    badge:
      'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
    iconBg:
      'bg-rose-50 dark:bg-rose-900/30 text-rose-600 border-rose-200/80 dark:border-rose-800',
    bar: 'bg-rose-500',
  },
  violet: {
    nameEn: 'Violet',
    nameBn: 'বেগুনি',
    dot: 'bg-violet-500',
    badge:
      'bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300',
    iconBg:
      'bg-violet-50 dark:bg-violet-900/30 text-violet-600 border-violet-200/80 dark:border-violet-800',
    bar: 'bg-violet-500',
  },
  cyan: {
    nameEn: 'Teal',
    nameBn: 'টিল',
    dot: 'bg-cyan-600',
    badge:
      'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300',
    iconBg:
      'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 border-cyan-200/80 dark:border-cyan-800',
    bar: 'bg-cyan-600',
  },
  orange: {
    nameEn: 'Orange',
    nameBn: 'কমলা',
    dot: 'bg-orange-500',
    badge:
      'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300',
    iconBg:
      'bg-orange-50 dark:bg-orange-900/30 text-orange-600 border-orange-200/80 dark:border-orange-800',
    bar: 'bg-orange-500',
  },
  slate: {
    nameEn: 'Slate',
    nameBn: 'ধূসর',
    dot: 'bg-slate-500',
    badge:
      'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300',
    iconBg:
      'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    bar: 'bg-slate-500',
  },
};

const COLOR_KEYS = Object.keys(CATEGORY_COLOR_PALETTE);

const DEFAULT_CATEGORIES: ExpenseCategoryItem[] = [
  {
    id: 'Rent & Bills',
    labelBn: 'ভাড়া ও বিদ্যুৎ বিল',
    labelEn: 'Rent & Electricity',
    colorKey: 'rose',
  },
  {
    id: 'Transport & Labor',
    labelBn: 'যাতায়াত ও কুলি',
    labelEn: 'Transport & Labor',
    colorKey: 'blue',
  },
  {
    id: 'Staff Salary',
    labelBn: 'স্টাফ বেতন',
    labelEn: 'Staff Salary',
    colorKey: 'violet',
  },
  {
    id: 'Tea & Snacks',
    labelBn: 'চা-নাস্তা / আপ্যায়ন',
    labelEn: 'Tea & Snacks',
    colorKey: 'amber',
  },
  {
    id: 'Packaging & Bags',
    labelBn: 'পলিথিন ও প্যাকেজিং',
    labelEn: 'Packaging & Bags',
    colorKey: 'cyan',
  },
  {
    id: 'Maintenance',
    labelBn: 'দোকান মেরামত',
    labelEn: 'Store Maintenance',
    colorKey: 'orange',
  },
  {
    id: 'Mobile & Net',
    labelBn: 'মোবাইল ও ইন্টারনেট',
    labelEn: 'Mobile & Internet',
    colorKey: 'emerald',
  },
  {
    id: 'Other',
    labelBn: 'অন্যান্য খরচ',
    labelEn: 'Other Expense',
    colorKey: 'slate',
  },
];

const DEFAULT_COMMON_PRESETS: CommonExpensePreset[] = [
  {
    id: 'preset-elec',
    titleBn: 'বিদ্যুৎ বিল',
    titleEn: 'Electricity Bill',
    category: 'Rent & Bills',
  },
  {
    id: 'preset-rent',
    titleBn: 'দোকান ভাড়া',
    titleEn: 'Shop Rent',
    category: 'Rent & Bills',
  },
  {
    id: 'preset-tea',
    titleBn: 'চা-নাস্তা',
    titleEn: 'Tea & Snacks',
    category: 'Tea & Snacks',
    defaultAmount: 50,
  },
  {
    id: 'preset-fare',
    titleBn: 'রিকশা / ভ্যান ভাড়া',
    titleEn: 'Transport Fare',
    category: 'Transport & Labor',
    defaultAmount: 100,
  },
  {
    id: 'preset-labor',
    titleBn: 'কুলি / লেবার খরচ',
    titleEn: 'Loading Labor',
    category: 'Transport & Labor',
  },
  {
    id: 'preset-poly',
    titleBn: 'পলিথিন / ব্যাগ',
    titleEn: 'Poly Bags / Pack',
    category: 'Packaging & Bags',
  },
  {
    id: 'preset-salary',
    titleBn: 'স্টাফ বেতন',
    titleEn: 'Staff Salary',
    category: 'Staff Salary',
  },
  {
    id: 'preset-net',
    titleBn: 'মোবাইল / নেট বিল',
    titleEn: 'Internet / Phone',
    category: 'Mobile & Net',
  },
];

function loadCategories(): ExpenseCategoryItem[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(
          (x) => x && typeof x.id === 'string' && x.id.trim().length > 0
        );
      }
    }
    // Migrate legacy custom categories if any
    const legacyRaw = localStorage.getItem(LEGACY_CUSTOM_CATS_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (Array.isArray(legacy) && legacy.length > 0) {
        const merged = [...DEFAULT_CATEGORIES];
        legacy.forEach((name: unknown, idx: number) => {
          if (
            typeof name === 'string' &&
            name.trim() &&
            !merged.some((m) => m.id.toLowerCase() === name.trim().toLowerCase())
          ) {
            merged.push({
              id: name.trim(),
              labelEn: name.trim(),
              labelBn: name.trim(),
              colorKey: COLOR_KEYS[idx % COLOR_KEYS.length],
            });
          }
        });
        return merged;
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_CATEGORIES;
}

function saveCategories(list: ExpenseCategoryItem[]) {
  try {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

function loadCommonPresets(): CommonExpensePreset[] {
  try {
    const raw = localStorage.getItem(COMMON_PRESETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (x) =>
            x &&
            typeof x.id === 'string' &&
            (typeof x.titleEn === 'string' || typeof x.titleBn === 'string')
        );
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_COMMON_PRESETS;
}

function saveCommonPresets(list: CommonExpensePreset[]) {
  try {
    localStorage.setItem(COMMON_PRESETS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

export const ShopExpensesView: React.FC<ShopExpensesViewProps> = ({
  transactions,
  strings,
  language,
  cloudCategories,
  cloudPresets,
  onSyncExpenseSettings,
  onBack,
  onOpenCashBook,
  onRecordExpense,
  onDeleteTransaction,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const fmtNum = (val: string | number) => toBengaliDigits(val, language);

  const [activeTab, setActiveTab] = useState<ExpenseTab>('ADD');

  // Editable Categories & Common Expenses (synced with Firebase + local cache)
  const [categories, setCategories] = useState<ExpenseCategoryItem[]>(() =>
    cloudCategories && cloudCategories.length > 0
      ? cloudCategories
      : loadCategories()
  );
  const [commonPresets, setCommonPresets] = useState<CommonExpensePreset[]>(
    () =>
      cloudPresets && cloudPresets.length > 0
        ? cloudPresets
        : loadCommonPresets()
  );

  // Hydrate from Firestore real-time updates across devices
  useEffect(() => {
    if (cloudCategories && cloudCategories.length > 0) {
      setCategories(cloudCategories);
      saveCategories(cloudCategories);
    }
  }, [cloudCategories]);

  useEffect(() => {
    if (cloudPresets && cloudPresets.length > 0) {
      setCommonPresets(cloudPresets);
      saveCommonPresets(cloudPresets);
    }
  }, [cloudPresets]);

  const persistCategories = (next: ExpenseCategoryItem[]) => {
    setCategories(next);
    saveCategories(next);
    if (onSyncExpenseSettings) {
      void onSyncExpenseSettings({
        expenseCategories: next,
        expensePresets: commonPresets,
      });
    }
  };

  const persistPresets = (next: CommonExpensePreset[]) => {
    setCommonPresets(next);
    saveCommonPresets(next);
    if (onSyncExpenseSettings) {
      void onSyncExpenseSettings({
        expenseCategories: categories,
        expensePresets: next,
      });
    }
  };

  // Add Expense form state
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState(
    () => loadCategories()[0]?.id || 'Rent & Bills'
  );
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manage Categories Modal state
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [catColorInput, setCatColorInput] = useState('emerald');

  // Manage Common Expenses Modal state
  const [showManagePresets, setShowManagePresets] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetTitleInput, setPresetTitleInput] = useState('');
  const [presetCatInput, setPresetCatInput] = useState(
    () => loadCategories()[0]?.id || 'Rent & Bills'
  );
  const [presetAmtInput, setPresetAmtInput] = useState('');

  // History filters
  const [timeFilter, setTimeFilter] = useState<ExpenseTimeFilter>('THIS_MONTH');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<StoreTransaction | null>(null);
  const [voucherTx, setVoucherTx] = useState<StoreTransaction | null>(null);

  // PDF Report
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfSheetRef = useRef<HTMLDivElement | null>(null);

  const getCategoryObj = (catId: string): ExpenseCategoryItem | undefined =>
    categories.find((c) => c.id.toLowerCase() === (catId || '').toLowerCase());

  const getCategoryLabel = (catId: string) => {
    const found = getCategoryObj(catId);
    if (found) return isBengali ? found.labelBn : found.labelEn;
    return catId || (isBengali ? 'অন্যান্য' : 'Other');
  };

  const getCategoryStyle = (catId: string) => {
    const found = getCategoryObj(catId);
    const key = found?.colorKey || 'slate';
    return CATEGORY_COLOR_PALETTE[key] || CATEGORY_COLOR_PALETTE.slate;
  };

  const getPresetTitle = (preset: CommonExpensePreset) =>
    isBengali
      ? preset.titleBn || preset.titleEn
      : preset.titleEn || preset.titleBn;

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

  // All expense transactions
  const allExpenses = useMemo(
    () => transactions.filter((t) => t.type === 'EXPENSE'),
    [transactions]
  );

  // Top KPI summary
  const summaryStats = useMemo(() => {
    let todayTotal = 0;
    let todayCount = 0;
    let monthTotal = 0;
    let monthCount = 0;
    let allTotal = 0;

    for (const tx of allExpenses) {
      const ms = tx.createdAt?.toMillis?.() ?? Date.now();
      const amt = Math.max(tx.paidAmount, tx.amount);
      allTotal += amt;
      if (ms >= startOfToday) {
        todayTotal += amt;
        todayCount += 1;
      }
      if (ms >= startOfMonth) {
        monthTotal += amt;
        monthCount += 1;
      }
    }
    return { todayTotal, todayCount, monthTotal, monthCount, allTotal };
  }, [allExpenses, startOfToday, startOfMonth]);

  // Expenses filtered by time
  const timeFilteredExpenses = useMemo(() => {
    return allExpenses.filter((tx) => {
      if (timeFilter === 'ALL') return true;
      const ms = tx.createdAt?.toMillis?.() ?? Date.now();
      if (timeFilter === 'TODAY') return ms >= startOfToday;
      if (timeFilter === 'THIS_WEEK') return ms >= startOfWeek;
      if (timeFilter === 'THIS_MONTH') return ms >= startOfMonth;
      if (timeFilter === 'THIS_YEAR') return ms >= startOfYear;
      return true;
    });
  }, [
    allExpenses,
    timeFilter,
    startOfToday,
    startOfWeek,
    startOfMonth,
    startOfYear,
  ]);

  // Category breakdown for the selected time filter
  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { category: string; total: number; count: number }
    >();
    let grand = 0;
    for (const tx of timeFilteredExpenses) {
      const cat = tx.category || 'Other';
      const amt = Math.max(tx.paidAmount, tx.amount);
      const entry = map.get(cat) || { category: cat, total: 0, count: 0 };
      entry.total += amt;
      entry.count += 1;
      map.set(cat, entry);
      grand += amt;
    }
    return {
      grand,
      items: Array.from(map.values()).sort((a, b) => b.total - a.total),
    };
  }, [timeFilteredExpenses]);

  // Fully filtered history (time + category + search)
  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return timeFilteredExpenses.filter((tx) => {
      if (
        categoryFilter !== 'ALL' &&
        (tx.category || 'Other').toLowerCase() !== categoryFilter.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        tx.title.toLowerCase().includes(q) ||
        (tx.category || '').toLowerCase().includes(q) ||
        getCategoryLabel(tx.category).toLowerCase().includes(q) ||
        (tx.notes || '').toLowerCase().includes(q)
      );
    });
  }, [timeFilteredExpenses, categoryFilter, searchQuery, categories, isBengali]);

  const filteredTotal = useMemo(
    () => filteredExpenses.reduce((acc, t) => acc + Math.max(t.paidAmount, t.amount), 0),
    [filteredExpenses]
  );

  const todaysExpenses = useMemo(
    () =>
      allExpenses.filter(
        (tx) => (tx.createdAt?.toMillis?.() ?? Date.now()) >= startOfToday
      ),
    [allExpenses, startOfToday]
  );

  // Category CRUD Handlers
  const openManageCategories = () => {
    setEditingCatId(null);
    setCatNameInput('');
    setCatColorInput('emerald');
    setShowManageCategories(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = catNameInput.trim();
    if (!clean) return;

    if (editingCatId) {
      const next = categories.map((c) => {
        if (c.id !== editingCatId) return c;
        return {
          ...c,
          labelEn: isBengali ? c.labelEn : clean,
          labelBn: isBengali ? clean : c.labelBn,
          ...(c.labelEn === c.labelBn
            ? { labelEn: clean, labelBn: clean }
            : {}),
          colorKey: catColorInput,
        };
      });
      persistCategories(next);
      setEditingCatId(null);
      setCatNameInput('');
      setCatColorInput('emerald');
    } else {
      const exists = categories.some(
        (c) =>
          c.id.toLowerCase() === clean.toLowerCase() ||
          c.labelEn.toLowerCase() === clean.toLowerCase() ||
          c.labelBn.toLowerCase() === clean.toLowerCase()
      );
      if (exists) return;
      const newCat: ExpenseCategoryItem = {
        id: clean,
        labelEn: clean,
        labelBn: clean,
        colorKey: catColorInput,
      };
      const next = [...categories, newCat];
      persistCategories(next);
      setExpCategory(newCat.id);
      setCatNameInput('');
      setCatColorInput('emerald');
    }
  };

  const handleDeleteCategory = (catId: string) => {
    if (categories.length <= 1) return;
    const next = categories.filter((c) => c.id !== catId);
    persistCategories(next);
    if (expCategory === catId) {
      setExpCategory(next[0].id);
    }
    if (categoryFilter === catId) {
      setCategoryFilter('ALL');
    }
    if (editingCatId === catId) {
      setEditingCatId(null);
      setCatNameInput('');
    }
  };

  const handleResetCategories = () => {
    persistCategories(DEFAULT_CATEGORIES);
    setExpCategory(DEFAULT_CATEGORIES[0].id);
    setEditingCatId(null);
    setCatNameInput('');
  };

  // Common Expense Presets CRUD Handlers
  const openManagePresets = () => {
    setEditingPresetId(null);
    setPresetTitleInput('');
    setPresetCatInput(categories[0]?.id || 'Rent & Bills');
    setPresetAmtInput('');
    setShowManagePresets(true);
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = presetTitleInput.trim();
    if (!clean) return;
    const parsedAmt = Math.max(0, Number(presetAmtInput) || 0);

    if (editingPresetId) {
      const next = commonPresets.map((p) => {
        if (p.id !== editingPresetId) return p;
        return {
          ...p,
          titleEn: isBengali ? p.titleEn : clean,
          titleBn: isBengali ? clean : p.titleBn,
          ...(p.titleEn === p.titleBn
            ? { titleEn: clean, titleBn: clean }
            : {}),
          category: presetCatInput,
          defaultAmount: parsedAmt > 0 ? parsedAmt : undefined,
        };
      });
      persistPresets(next);
      setEditingPresetId(null);
      setPresetTitleInput('');
      setPresetAmtInput('');
    } else {
      const newPreset: CommonExpensePreset = {
        id: `preset-${Date.now()}`,
        titleEn: clean,
        titleBn: clean,
        category: presetCatInput,
        defaultAmount: parsedAmt > 0 ? parsedAmt : undefined,
      };
      const next = [...commonPresets, newPreset];
      persistPresets(next);
      setPresetTitleInput('');
      setPresetAmtInput('');
    }
  };

  const handleDeletePreset = (presetId: string) => {
    const next = commonPresets.filter((p) => p.id !== presetId);
    persistPresets(next);
    if (editingPresetId === presetId) {
      setEditingPresetId(null);
      setPresetTitleInput('');
      setPresetAmtInput('');
    }
  };

  const handleResetPresets = () => {
    persistPresets(DEFAULT_COMMON_PRESETS);
    setEditingPresetId(null);
    setPresetTitleInput('');
    setPresetAmtInput('');
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || isSubmitting) return;
    const amt = Math.max(0, Number(expAmount) || 0);
    if (amt <= 0) return;

    setIsSubmitting(true);
    try {
      await onRecordExpense(
        expTitle.trim(),
        expCategory,
        amt,
        expNote.trim() || expCategory
      );
      setExpTitle('');
      setExpAmount('');
      setExpNote('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTimeFilterLabel = (tf: ExpenseTimeFilter) => {
    const labels: Record<ExpenseTimeFilter, { bn: string; en: string }> = {
      TODAY: { bn: 'আজ', en: 'Today' },
      THIS_WEEK: { bn: 'সপ্তাহ', en: 'Week' },
      THIS_MONTH: { bn: 'মাস', en: 'Month' },
      THIS_YEAR: { bn: 'বছর', en: 'Year' },
      ALL: { bn: 'সব', en: 'All' },
    };
    return isBengali ? labels[tf].bn : labels[tf].en;
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
      pdf.save(`Siaam_Store_Expenses_${stamp}.pdf`);
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
          <title>Siaam Store — Shop Expenses</title>
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

  const activeCategoryStyle = getCategoryStyle(expCategory);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3.5 pb-24">
      {/* Decorated Emerald Hero Summary Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#00965E] via-[#008452] to-[#006640] text-white p-4 shadow-md border border-emerald-400/20">
        {/* Decorative background accents */}
        <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-10 w-40 h-40 rounded-full bg-emerald-300/15 blur-2xl" />

        <div className="relative space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/15 text-xs font-bold cursor-pointer backdrop-blur-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isBengali ? 'টুলস' : 'Tools'}</span>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-emerald-50" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-base sm:text-lg font-black tracking-tight leading-none">
                      {strings.menuExpenses}
                    </h2>
                    <span className="px-2 py-0.5 rounded-lg bg-white/20 text-[10px] font-extrabold">
                      {fmtNum(allExpenses.length)}
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-100/90 font-medium mt-0.5">
                    {isBengali
                      ? 'দৈনন্দিন দোকান খরচ ও ক্যাটাগরি হিসাব'
                      : 'Daily operating costs & category tracker'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenCashBook}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/15 text-xs font-bold cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{isBengali ? 'ক্যাশবুক' : 'Cashbook'}</span>
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

          {/* Decorated 3-Column KPI Strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/12 border border-white/20 px-3 py-2.5 backdrop-blur-xs">
              <div className="flex items-center justify-between text-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                  {isBengali ? 'আজকের খরচ' : 'Today'}
                </p>
                <Calendar className="w-3 h-3 opacity-80 shrink-0" />
              </div>
              <p className="text-sm sm:text-base font-black mt-1">
                ৳{fmtNum(formatMoney(summaryStats.todayTotal))}
              </p>
              <p className="text-[10px] text-emerald-100/80 font-semibold">
                {fmtNum(summaryStats.todayCount)}{' '}
                {isBengali ? 'টি এন্ট্রি' : 'entries'}
              </p>
            </div>

            <div className="rounded-xl bg-white/12 border border-white/20 px-3 py-2.5 backdrop-blur-xs">
              <div className="flex items-center justify-between text-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                  {isBengali ? 'এই মাস' : 'This Month'}
                </p>
                <TrendingDown className="w-3 h-3 opacity-80 shrink-0" />
              </div>
              <p className="text-sm sm:text-base font-black mt-1">
                ৳{fmtNum(formatMoney(summaryStats.monthTotal))}
              </p>
              <p className="text-[10px] text-emerald-100/80 font-semibold">
                {fmtNum(summaryStats.monthCount)}{' '}
                {isBengali ? 'টি এন্ট্রি' : 'entries'}
              </p>
            </div>

            <div className="rounded-xl bg-white/18 border border-white/25 px-3 py-2.5 backdrop-blur-xs">
              <div className="flex items-center justify-between text-emerald-50">
                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                  {isBengali ? 'সর্বমোট খরচ' : 'All-Time'}
                </p>
                <Layers className="w-3 h-3 opacity-85 shrink-0" />
              </div>
              <p className="text-sm sm:text-base font-black mt-1">
                ৳{fmtNum(formatMoney(summaryStats.allTotal))}
              </p>
              <p className="text-[10px] text-emerald-50/85 font-semibold">
                {fmtNum(categories.length)}{' '}
                {isBengali ? 'ক্যাটাগরি' : 'categories'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Decorated 2-Tab Switcher + Quick Manage Shortcuts */}
      <div className="grid grid-cols-2 gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('ADD')}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'ADD'
              ? 'bg-gradient-to-r from-[#00965E] to-[#007D4E] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-emerald-50/60 dark:hover:bg-slate-700/50'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isBengali ? 'নতুন খরচ যোগ' : 'Add Expense'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('HISTORY')}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'HISTORY'
              ? 'bg-gradient-to-r from-[#00965E] to-[#007D4E] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-emerald-50/60 dark:hover:bg-slate-700/50'
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>
            {isBengali ? 'খরচের খাতা ও হিসাব' : 'History & Breakdown'} (
            {fmtNum(allExpenses.length)})
          </span>
        </button>
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
      {/* TAB 1: ADD EXPENSE + EDITABLE COMMON PRESETS + TODAY'S LIST       */}
      {/* ================================================================= */}
      {activeTab === 'ADD' && (
        <div className="space-y-3.5">
          {/* Decorated 1-Tap Common Shop Expenses Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-[#CBEAD9] dark:border-slate-700 overflow-hidden shadow-2xs">
            <div className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-50/90 to-teal-50/50 dark:from-slate-900 dark:to-slate-900/70 border-b border-emerald-100 dark:border-slate-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-[#00965E]/10 text-[#00965E] flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-slate-800 dark:text-white truncate">
                    {isBengali
                      ? 'নিয়মিত দোকান খরচ (১-ট্যাপ)'
                      : 'Common Shop Expenses (1-Tap)'}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={openManagePresets}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-emerald-200 dark:border-slate-600 hover:border-[#00965E] text-[11px] font-extrabold text-[#00965E] cursor-pointer shrink-0 shadow-2xs"
              >
                <Settings2 className="w-3 h-3" />
                <span>{isBengali ? 'যোগ / এডিট' : 'Add / Edit'}</span>
              </button>
            </div>

            <div className="p-3">
              {commonPresets.length === 0 ? (
                <div className="text-center py-3 space-y-1.5">
                  <p className="text-xs text-slate-400">
                    {isBengali
                      ? 'কোনো নিয়মিত খরচ যোগ করা নেই'
                      : 'No common expenses configured yet'}
                  </p>
                  <button
                    type="button"
                    onClick={openManagePresets}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#00965E] text-white text-[11px] font-bold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isBengali ? 'নতুন যোগ করুন' : 'Add Common Expense'}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {commonPresets.map((preset) => {
                    const label = getPresetTitle(preset);
                    const style = getCategoryStyle(preset.category);
                    const active = expTitle === label;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setExpTitle(label);
                          setExpCategory(preset.category);
                          if (preset.defaultAmount && preset.defaultAmount > 0) {
                            setExpAmount(String(preset.defaultAmount));
                          }
                        }}
                        className={`text-left p-2.5 rounded-xl border-[1.5px] cursor-pointer transition-all ${
                          active
                            ? 'bg-gradient-to-br from-[#00965E] to-[#007a4d] text-white border-[#007a4d] shadow-xs'
                            : 'bg-slate-50/70 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100 border-slate-200/90 dark:border-slate-700 hover:border-[#00965E] hover:bg-emerald-50/40 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              active ? 'bg-white' : style.dot
                            }`}
                          />
                          {preset.defaultAmount && preset.defaultAmount > 0 ? (
                            <span
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                active
                                  ? 'bg-white/20 text-white'
                                  : 'bg-white dark:bg-slate-800 text-[#00965E] border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              ৳{fmtNum(formatMoney(preset.defaultAmount))}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs font-extrabold truncate mt-1.5">
                          {label}
                        </p>
                        <p
                          className={`text-[10px] font-semibold truncate mt-0.5 ${
                            active ? 'text-emerald-100' : 'text-slate-400'
                          }`}
                        >
                          {getCategoryLabel(preset.category)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Decorated Main Expense Entry Form */}
          <form
            onSubmit={handleSubmitExpense}
            className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs"
          >
            <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-slate-900/70 border-b border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#00965E] text-white flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-black text-slate-800 dark:text-white">
                  {isBengali ? 'খরচের বিবরণ লিখুন' : 'Expense Entry Details'}
                </h3>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-extrabold ${activeCategoryStyle.badge}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${activeCategoryStyle.dot}`}
                />
                {getCategoryLabel(expCategory)}
              </span>
            </div>

            <div className="p-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'খরচের বিবরণ *' : 'Expense Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    placeholder={
                      isBengali
                        ? 'যেমন: বিদ্যুৎ বিল, চা-নাস্তা...'
                        : 'e.g. Electricity bill, Tea...'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900 text-xs font-bold dark:text-white focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#00965E]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                      {isBengali ? 'খরচের ক্যাটাগরি' : 'Expense Category'}
                    </label>
                    <button
                      type="button"
                      onClick={openManageCategories}
                      className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#00965E] hover:underline cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isBengali ? 'যোগ / এডিট' : 'Add / Edit'}</span>
                    </button>
                  </div>

                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900 text-xs font-bold dark:text-white focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#00965E]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {isBengali ? c.labelBn : c.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount + Quick Amount Chips */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                    {isBengali ? 'টাকার পরিমাণ (৳) *' : 'Amount (৳) *'}
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {[50, 100, 200, 500, 1000, 2000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setExpAmount(String(amt))}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-extrabold cursor-pointer transition-colors ${
                          Number(expAmount) === amt
                            ? 'bg-[#00965E] text-white border-[#00965E]'
                            : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#00965E]'
                        }`}
                      >
                        ৳{fmtNum(amt)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-[#00965E]">
                      ৳
                    </span>
                    <input
                      type="number"
                      min={1}
                      step="any"
                      required
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      placeholder={isBengali ? 'পরিমাণ লিখুন' : 'Enter amount'}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900 text-sm font-black dark:text-white focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#00965E]"
                    />
                  </div>
                  <input
                    type="text"
                    value={expNote}
                    onChange={(e) => setExpNote(e.target.value)}
                    placeholder={
                      isBengali
                        ? 'নোট / ভাউচার নং / কাকে দেয়া হলো (ঐচ্ছিক)'
                        : 'Note / Voucher / Paid to (Optional)'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900 text-xs font-medium dark:text-white focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#00965E]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#00965E] to-[#007A4D] hover:from-[#008251] hover:to-[#006941] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? '...'
                    : isBengali
                    ? 'খরচ সংরক্ষণ করুন'
                    : 'Save Shop Expense'}
                  {Number(expAmount) > 0
                    ? ` (৳${fmtNum(formatMoney(Number(expAmount)))})`
                    : ''}
                </span>
              </button>
            </div>
          </form>

          {/* Decorated Today's Quick Expense List */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-emerald-50/40 dark:from-slate-900 dark:to-slate-900/70 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-[#00965E]" />
                <h3 className="text-xs font-black text-slate-800 dark:text-white">
                  {isBengali ? 'আজকের খরচসমূহ' : "Today's Expenses"} (
                  {fmtNum(todaysExpenses.length)})
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs font-black text-red-600 dark:text-red-400">
                -৳{fmtNum(formatMoney(summaryStats.todayTotal))}
              </span>
            </div>

            {todaysExpenses.length === 0 ? (
              <div className="p-7 text-center space-y-1">
                <Receipt className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-400">
                  {isBengali
                    ? 'আজ এখনো কোনো খরচ রেকর্ড করা হয়নি।'
                    : 'No expenses recorded today yet.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {todaysExpenses.map((tx, idx) => {
                  const style = getCategoryStyle(tx.category);
                  return (
                    <div
                      key={tx.id}
                      className="p-3 flex items-center justify-between gap-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <div
                        onClick={() => setVoucherTx(tx)}
                        className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer"
                      >
                        <div
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${style.iconBg}`}
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black text-slate-400">
                              #{fmtNum(todaysExpenses.length - idx)}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                              {tx.title}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${style.badge}`}
                            >
                              {getCategoryLabel(tx.category)}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{formatTimestamp(tx.createdAt)}</span>
                            {tx.notes && tx.notes !== tx.category && (
                              <span className="text-slate-500 ml-1 truncate">
                                · {tx.notes}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black text-red-600">
                          -৳{fmtNum(formatMoney(tx.amount))}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(tx)}
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
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: HISTORY, SEARCH, FILTERS & CATEGORY BREAKDOWN              */}
      {/* ================================================================= */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-3.5">
          {/* Time Filter + Search + Category Filter */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border-[1.5px] border-slate-200 dark:border-slate-700 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {(
                  [
                    'TODAY',
                    'THIS_WEEK',
                    'THIS_MONTH',
                    'THIS_YEAR',
                    'ALL',
                  ] as const
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
                    {getTimeFilterLabel(tf)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={openManageCategories}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-[11px] font-extrabold text-[#00965E] shrink-0 cursor-pointer"
              >
                <Settings2 className="w-3 h-3" />
                <span className="hidden sm:inline">
                  {isBengali ? 'ক্যাটাগরি এডিট' : 'Categories'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative sm:col-span-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isBengali
                      ? 'খরচের নাম, ক্যাটাগরি বা নোট খুঁজুন...'
                      : 'Search expense title, category or note...'
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

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">
                  {isBengali ? 'সব ক্যাটাগরি' : 'All Categories'}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isBengali ? c.labelBn : c.labelEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Decorated Color-Coded Category Breakdown Card */}
          {categoryBreakdown.items.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                  <Tag className="w-3.5 h-3.5 text-[#00965E]" />
                  <span>
                    {isBengali
                      ? `ক্যাটাগরি অনুযায়ী খরচ (${getTimeFilterLabel(timeFilter)})`
                      : `Category Breakdown (${getTimeFilterLabel(timeFilter)})`}
                  </span>
                </div>
                {categoryFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('ALL')}
                    className="text-[11px] font-extrabold text-[#00965E] hover:underline cursor-pointer"
                  >
                    {isBengali ? 'ফিল্টার সরান' : 'Clear Filter'}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {categoryBreakdown.items.map((item) => {
                  const pct =
                    categoryBreakdown.grand > 0
                      ? Math.round((item.total / categoryBreakdown.grand) * 100)
                      : 0;
                  const style = getCategoryStyle(item.category);
                  const isSelected =
                    categoryFilter.toLowerCase() === item.category.toLowerCase();
                  return (
                    <button
                      key={item.category}
                      type="button"
                      onClick={() =>
                        setCategoryFilter(isSelected ? 'ALL' : item.category)
                      }
                      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-[#00965E] shadow-2xs'
                          : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700 hover:border-[#00965E]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${style.dot}`}
                          />
                          {getCategoryLabel(item.category)}
                          <span className="text-[10px] text-slate-400 font-semibold">
                            ({fmtNum(item.count)})
                          </span>
                        </span>
                        <span className="font-black text-red-600">
                          ৳{fmtNum(formatMoney(item.total))}{' '}
                          <span className="text-[10px] text-slate-400 font-bold">
                            ({fmtNum(pct)}%)
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${style.bar}`}
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filtered Expense List */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                {isBengali ? 'খরচের তালিকা' : 'Expense Records'} (
                {fmtNum(filteredExpenses.length)})
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs font-black text-red-600 dark:text-red-400">
                {isBengali ? 'মোট' : 'Total'}: -৳
                {fmtNum(formatMoney(filteredTotal))}
              </span>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {isBengali
                  ? 'এই ফিল্টারে কোনো খরচ পাওয়া যায়নি।'
                  : 'No expenses match this filter.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {filteredExpenses.map((tx, idx) => {
                  const style = getCategoryStyle(tx.category);
                  return (
                    <div
                      key={tx.id}
                      className="p-3 flex items-start justify-between gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <div
                        onClick={() => setVoucherTx(tx)}
                        className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer"
                      >
                        <div
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${style.iconBg}`}
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-[10px] font-black text-slate-500">
                              #{fmtNum(filteredExpenses.length - idx)}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                              {tx.title}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${style.badge}`}
                            >
                              {getCategoryLabel(tx.category)}
                            </span>
                          </div>
                          {tx.notes && tx.notes !== tx.category && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {tx.notes}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(tx.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black text-red-600">
                          -৳{fmtNum(formatMoney(tx.amount))}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(tx)}
                          title={isBengali ? 'খরচ মুছুন' : 'Delete Expense'}
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
        </div>
      )}
      </motion.div>

      {/* ================================================================= */}
      {/* MODAL: MANAGE COMMON SHOP EXPENSES (ADD / EDIT / DELETE)          */}
      {/* ================================================================= */}
      {showManagePresets && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md max-h-[88vh] flex flex-col border-[1.5px] border-[#CBEAD9] dark:border-slate-700 overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-gradient-to-r from-[#00965E] to-[#007448] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <h3 className="text-sm font-black">
                  {isBengali
                    ? 'নিয়মিত খরচ যোগ ও এডিট'
                    : 'Manage Common Expenses'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManagePresets(false)}
                className="p-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Add / Edit Preset Form */}
            <form
              onSubmit={handleSavePreset}
              className="p-3.5 bg-emerald-50/60 dark:bg-slate-900/70 border-b border-emerald-100 dark:border-slate-700 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-[#007448] dark:text-emerald-400">
                  {editingPresetId
                    ? isBengali
                      ? 'নিয়মিত খরচ এডিট করুন'
                      : 'Edit Common Expense'
                    : isBengali
                    ? '+ নতুন নিয়মিত খরচ যোগ করুন'
                    : '+ Add New Common Expense'}
                </span>
                {editingPresetId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPresetId(null);
                      setPresetTitleInput('');
                      setPresetAmtInput('');
                    }}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {isBengali ? 'বাতিল' : 'Cancel Edit'}
                  </button>
                )}
              </div>

              <input
                type="text"
                required
                value={presetTitleInput}
                onChange={(e) => setPresetTitleInput(e.target.value)}
                placeholder={
                  isBengali
                    ? 'খরচের নাম (যেমন: জেনারেটর তেল) *'
                    : 'Expense title (e.g. Generator Fuel) *'
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold dark:text-white focus:outline-none focus:border-[#00965E]"
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={presetCatInput}
                  onChange={(e) => setPresetCatInput(e.target.value)}
                  className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold dark:text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {isBengali ? c.labelBn : c.labelEn}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={0}
                  step="any"
                  value={presetAmtInput}
                  onChange={(e) => setPresetAmtInput(e.target.value)}
                  placeholder={
                    isBengali ? 'ডিফল্ট টাকা (ঐচ্ছিক)' : 'Default ৳ (Optional)'
                  }
                  className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-[#00965E] hover:bg-[#007c4e] text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
              >
                {editingPresetId ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isBengali ? 'আপডেট করুন' : 'Update Preset'}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isBengali ? 'তালিকায় যোগ করুন' : 'Add to List'}</span>
                  </>
                )}
              </button>
            </form>

            {/* Existing Presets List */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-700/70">
              {commonPresets.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  {isBengali ? 'তালিকা খালি' : 'List is empty'}
                </p>
              ) : (
                commonPresets.map((p) => {
                  const style = getCategoryStyle(p.category);
                  const isEditing = editingPresetId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                        isEditing ? 'bg-emerald-50/70 dark:bg-emerald-900/20' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`}
                          />
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {getPresetTitle(p)}
                          </span>
                          {p.defaultAmount && p.defaultAmount > 0 ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-[10px] font-black text-[#00965E]">
                              ৳{fmtNum(formatMoney(p.defaultAmount))}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[10px] text-slate-400 ml-3.5">
                          {getCategoryLabel(p.category)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPresetId(p.id);
                            setPresetTitleInput(getPresetTitle(p));
                            setPresetCatInput(p.category);
                            setPresetAmtInput(
                              p.defaultAmount ? String(p.defaultAmount) : ''
                            );
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:text-[#00965E] cursor-pointer"
                          title={isBengali ? 'এডিট' : 'Edit'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePreset(p.id)}
                          className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 cursor-pointer"
                          title={isBengali ? 'মুছুন' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetPresets}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-[#00965E] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isBengali ? 'ডিফল্ট রিসেট' : 'Reset Defaults'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowManagePresets(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs font-extrabold cursor-pointer"
              >
                {isBengali ? 'সম্পন্ন' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: MANAGE EXPENSE CATEGORIES (ADD / EDIT / COLOR / DELETE)    */}
      {/* ================================================================= */}
      {showManageCategories && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md max-h-[88vh] flex flex-col border-[1.5px] border-[#CBEAD9] dark:border-slate-700 overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-gradient-to-r from-[#00965E] to-[#007448] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                <h3 className="text-sm font-black">
                  {isBengali
                    ? 'খরচের ক্যাটাগরি যোগ ও এডিট'
                    : 'Manage Expense Categories'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManageCategories(false)}
                className="p-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Add / Edit Category Form */}
            <form
              onSubmit={handleSaveCategory}
              className="p-3.5 bg-emerald-50/60 dark:bg-slate-900/70 border-b border-emerald-100 dark:border-slate-700 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-[#007448] dark:text-emerald-400">
                  {editingCatId
                    ? isBengali
                      ? 'ক্যাটাগরি এডিট করুন'
                      : 'Edit Category'
                    : isBengali
                    ? '+ নতুন ক্যাটাগরি যোগ করুন'
                    : '+ Add New Category'}
                </span>
                {editingCatId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(null);
                      setCatNameInput('');
                      setCatColorInput('emerald');
                    }}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {isBengali ? 'বাতিল' : 'Cancel Edit'}
                  </button>
                )}
              </div>

              <input
                type="text"
                required
                value={catNameInput}
                onChange={(e) => setCatNameInput(e.target.value)}
                placeholder={
                  isBengali
                    ? 'ক্যাটাগরির নাম (যেমন: নিরাপত্তা / গার্ড) *'
                    : 'Category name (e.g. Security / Guard) *'
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold dark:text-white focus:outline-none focus:border-[#00965E]"
              />

              {/* Color Swatch Picker */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-500">
                  {isBengali ? 'ট্যাগ রঙ:' : 'Badge Color:'}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_KEYS.map((key) => {
                    const pal = CATEGORY_COLOR_PALETTE[key];
                    const selected = catColorInput === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCatColorInput(key)}
                        title={isBengali ? pal.nameBn : pal.nameEn}
                        className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-transform ${
                          pal.dot
                        } ${
                          selected
                            ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-white scale-110'
                            : 'opacity-75 hover:opacity-100'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-[#00965E] hover:bg-[#007c4e] text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
              >
                {editingCatId ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isBengali ? 'আপডেট করুন' : 'Update Category'}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isBengali ? 'ক্যাটাগরি যোগ করুন' : 'Add Category'}</span>
                  </>
                )}
              </button>
            </form>

            {/* Existing Categories List */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-700/70">
              {categories.map((cat) => {
                const pal =
                  CATEGORY_COLOR_PALETTE[cat.colorKey] ||
                  CATEGORY_COLOR_PALETTE.slate;
                const isEditing = editingCatId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                      isEditing ? 'bg-emerald-50/70 dark:bg-emerald-900/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-3 h-3 rounded-full shrink-0 ${pal.dot}`}
                      />
                      <span
                        className={`px-2 py-0.5 rounded-lg border text-xs font-extrabold truncate ${pal.badge}`}
                      >
                        {isBengali ? cat.labelBn : cat.labelEn}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setCatNameInput(isBengali ? cat.labelBn : cat.labelEn);
                          setCatColorInput(cat.colorKey || 'emerald');
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:text-[#00965E] cursor-pointer"
                        title={isBengali ? 'এডিট' : 'Edit'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={categories.length <= 1}
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 cursor-pointer disabled:opacity-30"
                        title={isBengali ? 'মুছুন' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetCategories}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-[#00965E] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isBengali ? 'ডিফল্ট রিসেট' : 'Reset Defaults'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowManageCategories(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs font-extrabold cursor-pointer"
              >
                {isBengali ? 'সম্পন্ন' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Voucher Detail Modal */}
      {voucherTx && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm border-[1.5px] border-[#CBEAD9] dark:border-slate-700 overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-gradient-to-r from-[#00965E] to-[#007448] text-white flex items-center justify-between">
              <h3 className="text-sm font-black">
                {isBengali ? 'খরচ ভাউচার' : 'Expense Voucher'}
              </h3>
              <button
                type="button"
                onClick={() => setVoucherTx(null)}
                className="p-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              <div className="text-center pb-3 border-b border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-[11px] font-bold text-slate-400">
                  {isBengali ? 'সিয়াম স্টোর' : 'Siaam Store'}
                </p>
                <p className="text-2xl font-black text-red-600 mt-1">
                  -৳{fmtNum(formatMoney(voucherTx.amount))}
                </p>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  {isBengali ? 'বিবরণ' : 'Title'}
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-right">
                  {voucherTx.title}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">
                  {isBengali ? 'ক্যাটাগরি' : 'Category'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold ${
                    getCategoryStyle(voucherTx.category).badge
                  }`}
                >
                  {getCategoryLabel(voucherTx.category)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  {isBengali ? 'তারিখ ও সময়' : 'Date & Time'}
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatTimestamp(voucherTx.createdAt)}
                </span>
              </div>
              {voucherTx.notes && voucherTx.notes !== voucherTx.category && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                    {isBengali ? 'নোট' : 'Note'}
                  </p>
                  <p className="text-slate-700 dark:text-slate-200">
                    {voucherTx.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-5 border border-red-200 dark:border-red-900/50 space-y-3 shadow-xl">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-black">
                {isBengali ? 'খরচটি মুছে ফেলবেন?' : 'Delete Expense?'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {deleteTarget.title} — ৳{fmtNum(formatMoney(deleteTarget.amount))}
            </p>
            <p className="text-[11px] text-slate-500">
              {isBengali
                ? 'খরচটি রিসাইকেল বিনে যাবে এবং ক্যাশবুক ব্যালেন্স সমন্বয় হবে।'
                : 'This expense will move to Recycle Bin and Cashbook balance will update.'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {isBengali ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const tx = deleteTarget;
                  setDeleteTarget(null);
                  await onDeleteTransaction(tx);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                {isBengali ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Report PDF Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileDown className="w-4 h-4 text-[#00965E]" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isBengali
                    ? 'দোকান খরচ রিপোর্ট (PDF)'
                    : 'Shop Expenses Report (PDF)'}
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
                        ? 'দোকান খরচ রিপোর্ট'
                        : 'Shop Operating Expenses Report'}{' '}
                      · {getTimeFilterLabel(timeFilter)}
                      {categoryFilter !== 'ALL'
                        ? ` (${getCategoryLabel(categoryFilter)})`
                        : ''}
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

                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      {isBengali ? 'খরচ সংখ্যা' : 'Entries'}
                    </p>
                    <p className="text-sm font-black mt-0.5">
                      {fmtNum(filteredExpenses.length)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      {isBengali ? 'সময়কাল' : 'Period'}
                    </p>
                    <p className="text-sm font-black mt-0.5">
                      {getTimeFilterLabel(timeFilter)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-[10px] font-bold text-red-600 uppercase">
                      {isBengali ? 'মোট খরচ' : 'Total Expense'}
                    </p>
                    <p className="text-sm font-black text-red-700 mt-0.5">
                      ৳{fmtNum(formatMoney(filteredTotal))}
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
                        {isBengali ? 'বিবরণ' : 'Title'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'ক্যাটাগরি' : 'Category'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">
                        {isBengali ? 'পরিমাণ' : 'Amount'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((tx, idx) => (
                      <tr key={tx.id}>
                        <td className="border border-slate-300 px-2 py-1.5 font-bold">
                          {fmtNum(idx + 1)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 whitespace-nowrap">
                          {formatTimestamp(tx.createdAt)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5">
                          <span className="font-bold">{tx.title}</span>
                          {tx.notes && tx.notes !== tx.category && (
                            <span className="block text-[10px] text-slate-500">
                              {tx.notes}
                            </span>
                          )}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5">
                          {getCategoryLabel(tx.category)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-extrabold text-red-600">
                          ৳{fmtNum(formatMoney(tx.amount))}
                        </td>
                      </tr>
                    ))}
                    {filteredExpenses.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="border border-slate-300 px-2 py-4 text-center text-slate-400"
                        >
                          {isBengali ? 'কোনো খরচ নেই' : 'No expenses recorded'}
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
