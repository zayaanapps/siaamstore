import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  ArrowLeft,
  Package,
  ShoppingCart,
  Barcode,
  RotateCcw,
  Tag,
  Layers,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Banknote,
  ArrowUpDown,
  X,
  Check,
  ShieldCheck,
  Coins,
  Award,
  FileText,
} from 'lucide-react';
import {
  AppLanguage,
  Product,
  StoreTransaction,
  formatMoney,
  toBengaliDigits,
  formatTimestamp,
  getProfitMarginPerUnit,
  getProfitMarginPercent,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';

interface ProductsViewProps {
  products: Product[];
  transactions: StoreTransaction[];
  strings: DokanTranslations;
  language: AppLanguage;
  isAdmin?: boolean;
  onAddProduct: (params: {
    name: string;
    category: string;
    unit: string;
    buyPrice: number;
    sellPrice: number;
    initialStock: number;
    lowStockThreshold: number;
    barcode: string;
    quality?: string;
    note?: string;
  }) => Promise<void>;
  onUpdateProduct: (
    product: Product,
    params: {
      name: string;
      category: string;
      unit: string;
      buyPrice: number;
      sellPrice: number;
      stock: number;
      lowStockThreshold: number;
      barcode: string;
      quality?: string;
      note?: string;
    }
  ) => Promise<void>;
  onRecordStockAdjustment: (
    product: Product,
    deltaQty: number,
    reason: string
  ) => Promise<void>;
  onVoidStockAdjustment: (
    product: Product,
    tx: StoreTransaction,
    signedDeltaToReverse: number
  ) => Promise<void>;
  onDeleteProduct: (productId: string, productName: string) => Promise<void>;
  onAddToCart: (product: Product) => void;
  cloudCategories?: string[];
  cloudUnits?: string[];
  cloudQualities?: string[];
  onSyncProductLists?: (lists: {
    productCategories: string[];
    productUnits: string[];
    productQualities: string[];
  }) => Promise<void> | void;
}

const DEFAULT_CATEGORIES = [
  'Grocery',
  'Grains & Rice',
  'Cooking Oil',
  'Beverages',
  'Snacks',
  'Dairy',
  'Personal Care',
  'Household',
];

const DEFAULT_UNITS = ['pcs', 'kg', 'gm', 'ltr', 'box', 'pkt', 'dzn'];

const DEFAULT_QUALITIES = [
  'Premium',
  'Standard',
  'Grade A',
  'Regular',
  'Local',
  'Imported',
];

type ProductSortOption =
  | 'SL_ASC'
  | 'NAME_ASC'
  | 'STOCK_LOW_HIGH'
  | 'STOCK_HIGH_LOW'
  | 'VALUE_HIGH_LOW'
  | 'PRICE_HIGH_LOW';

const STORAGE_CATEGORIES_KEY = 'siaam_store_custom_categories_v1';
const STORAGE_UNITS_KEY = 'siaam_store_custom_units_v1';
const STORAGE_QUALITIES_KEY = 'siaam_store_custom_qualities_v1';

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  transactions,
  strings,
  language,
  isAdmin = false,
  onAddProduct,
  onUpdateProduct,
  onRecordStockAdjustment,
  onVoidStockAdjustment,
  onDeleteProduct,
  onAddToCart,
  cloudCategories,
  cloudUnits,
  cloudQualities,
  onSyncProductLists,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<ProductSortOption>('SL_ASC');

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Dynamic Categories, Units & Qualities (synced with Firebase + local cache)
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    if (cloudCategories && cloudCategories.length > 0) return cloudCategories;
    try {
      const saved = localStorage.getItem(STORAGE_CATEGORIES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_CATEGORIES;
  });

  const [customUnits, setCustomUnits] = useState<string[]>(() => {
    if (cloudUnits && cloudUnits.length > 0) return cloudUnits;
    try {
      const saved = localStorage.getItem(STORAGE_UNITS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_UNITS;
  });

  const [customQualities, setCustomQualities] = useState<string[]>(() => {
    if (cloudQualities && cloudQualities.length > 0) return cloudQualities;
    try {
      const saved = localStorage.getItem(STORAGE_QUALITIES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_QUALITIES;
  });

  // Hydrate from Firestore real-time updates across devices
  useEffect(() => {
    if (cloudCategories && cloudCategories.length > 0) {
      setCustomCategories(cloudCategories);
    }
  }, [cloudCategories]);

  useEffect(() => {
    if (cloudUnits && cloudUnits.length > 0) {
      setCustomUnits(cloudUnits);
    }
  }, [cloudUnits]);

  useEffect(() => {
    if (cloudQualities && cloudQualities.length > 0) {
      setCustomQualities(cloudQualities);
    }
  }, [cloudQualities]);

  const syncListsToCloud = (
    nextCategories: string[],
    nextUnits: string[],
    nextQualities: string[]
  ) => {
    if (onSyncProductLists) {
      void onSyncProductLists({
        productCategories: nextCategories,
        productUnits: nextUnits,
        productQualities: nextQualities,
      });
    }
  };

  useEffect(() => {
    localStorage.setItem(
      STORAGE_CATEGORIES_KEY,
      JSON.stringify(customCategories)
    );
  }, [customCategories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_UNITS_KEY, JSON.stringify(customUnits));
  }, [customUnits]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_QUALITIES_KEY,
      JSON.stringify(customQualities)
    );
  }, [customQualities]);

  // Merge any category/unit/quality present in products with saved list
  const allCategories = useMemo(() => {
    const set = new Set<string>(customCategories);
    products.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [customCategories, products]);

  const allUnits = useMemo(() => {
    const set = new Set<string>(customUnits);
    products.forEach((p) => {
      if (p.unit && p.unit.trim()) set.add(p.unit.trim());
    });
    return Array.from(set);
  }, [customUnits, products]);

  const allQualities = useMemo(() => {
    const set = new Set<string>(customQualities);
    products.forEach((p) => {
      if (p.quality && p.quality.trim()) set.add(p.quality.trim());
    });
    return Array.from(set);
  }, [customQualities, products]);

  // Category, Unit & Quality Manager Modal State
  const [showCatUnitModal, setShowCatUnitModal] = useState(false);
  const [catUnitTab, setCatUnitTab] = useState<'CATEGORY' | 'UNIT' | 'QUALITY'>(
    'CATEGORY'
  );
  const [newItemInput, setNewItemInput] = useState('');
  const [editingItemOld, setEditingItemOld] = useState<string | null>(null);
  const [editingItemNew, setEditingItemNew] = useState('');
  const [isUpdatingCatUnit, setIsUpdatingCatUnit] = useState(false);

  // Add/Edit Product Modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('Grocery');
  const [buyPriceInput, setBuyPriceInput] = useState('');
  const [sellPriceInput, setSellPriceInput] = useState('');
  const [stockQtyInput, setStockQtyInput] = useState('');
  const [unitInput, setUnitInput] = useState('pcs');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [thresholdInput, setThresholdInput] = useState('5');
  const [qualityInput, setQualityInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

  // Stock Adjustment Modal (Works both from detail & quick card button)
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustTargetProduct, setAdjustTargetProduct] =
    useState<Product | null>(null);
  const [adjType, setAdjType] = useState<'STOCK_IN' | 'STOCK_OUT' | 'DAMAGED'>(
    'STOCK_IN'
  );
  const [adjQtyInput, setAdjQtyInput] = useState('');
  const [adjReasonInput, setAdjReasonInput] = useState('');

  const [confirmDeleteProduct, setConfirmDeleteProduct] =
    useState<Product | null>(null);

  const openAddModal = () => {
    setEditingProduct(null);
    setNameInput('');
    setCategoryInput(allCategories[0] || 'Grocery');
    setBuyPriceInput('');
    setSellPriceInput('');
    setStockQtyInput('');
    setUnitInput(allUnits[0] || 'pcs');
    setBarcodeInput(`890${Date.now().toString().slice(-5)}`);
    setThresholdInput('5');
    setQualityInput('');
    setNoteInput('');
    setShowProductModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setNameInput(product.name);
    setCategoryInput(product.category || allCategories[0] || 'Grocery');
    setBuyPriceInput(String(product.buyPrice));
    setSellPriceInput(String(product.sellPrice));
    setStockQtyInput(String(product.stock));
    setUnitInput(product.unit || allUnits[0] || 'pcs');
    setBarcodeInput(product.barcode || '');
    setThresholdInput(String(product.lowStockThreshold ?? 5));
    setQualityInput(product.quality || '');
    setNoteInput(product.note || '');
    setShowProductModal(true);
  };

  const openQuickAdjustModal = (product: Product) => {
    setAdjustTargetProduct(product);
    setAdjType('STOCK_IN');
    setAdjQtyInput('');
    setAdjReasonInput('');
    setShowAdjustModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const buyPrice = Math.max(0, Number(buyPriceInput) || 0);
    const sellPrice = Math.max(0, Number(sellPriceInput) || 0);
    const stock = Math.max(0, Number(stockQtyInput) || 0);
    const lowStockThreshold = Math.max(0, Number(thresholdInput) || 5);

    let nextCats = customCategories;
    let nextUnits = customUnits;
    let nextQuals = customQualities;
    let listsChanged = false;

    if (categoryInput.trim() && !customCategories.includes(categoryInput.trim())) {
      nextCats = [...customCategories, categoryInput.trim()];
      setCustomCategories(nextCats);
      listsChanged = true;
    }
    if (unitInput.trim() && !customUnits.includes(unitInput.trim())) {
      nextUnits = [...customUnits, unitInput.trim()];
      setCustomUnits(nextUnits);
      listsChanged = true;
    }
    if (qualityInput.trim() && !customQualities.includes(qualityInput.trim())) {
      nextQuals = [...customQualities, qualityInput.trim()];
      setCustomQualities(nextQuals);
      listsChanged = true;
    }
    if (listsChanged) {
      syncListsToCloud(nextCats, nextUnits, nextQuals);
    }

    if (editingProduct) {
      await onUpdateProduct(editingProduct, {
        name: nameInput.trim(),
        category: categoryInput.trim() || 'Grocery',
        unit: unitInput.trim() || 'pcs',
        buyPrice,
        sellPrice,
        stock,
        lowStockThreshold,
        barcode: barcodeInput.trim(),
        quality: qualityInput.trim(),
        note: noteInput.trim(),
      });
    } else {
      await onAddProduct({
        name: nameInput.trim(),
        category: categoryInput.trim() || 'Grocery',
        unit: unitInput.trim() || 'pcs',
        buyPrice,
        sellPrice,
        initialStock: stock,
        lowStockThreshold,
        barcode: barcodeInput.trim(),
        quality: qualityInput.trim(),
        note: noteInput.trim(),
      });
    }
    setShowProductModal(false);
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = adjustTargetProduct || activeDetailProduct;
    if (!target) return;
    const rawQty = Math.max(1, Number(adjQtyInput) || 0);
    const delta = adjType === 'STOCK_IN' ? rawQty : -rawQty;
    const prefix =
      adjType === 'DAMAGED'
        ? 'REASON:Damaged / lost'
        : adjType === 'STOCK_OUT'
        ? 'REASON:Removed stock'
        : 'REASON:Added stock';
    const fullReason = adjReasonInput.trim()
      ? `${prefix} - ${adjReasonInput.trim()}`
      : prefix;

    await onRecordStockAdjustment(target, delta, fullReason);
    setShowAdjustModal(false);
    setAdjustTargetProduct(null);
    setAdjQtyInput('');
    setAdjReasonInput('');
  };

  // Add new category, unit, or quality
  const handleAddCatOrUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (catUnitTab !== 'QUALITY' && !isAdmin) return;
    const trimmed = newItemInput.trim();
    if (!trimmed) return;
    if (catUnitTab === 'CATEGORY') {
      if (!allCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
        const nextCats = [...customCategories, trimmed];
        setCustomCategories(nextCats);
        syncListsToCloud(nextCats, customUnits, customQualities);
      }
      setCategoryInput(trimmed);
    } else if (catUnitTab === 'UNIT') {
      if (!allUnits.some((u) => u.toLowerCase() === trimmed.toLowerCase())) {
        const nextUnits = [...customUnits, trimmed];
        setCustomUnits(nextUnits);
        syncListsToCloud(customCategories, nextUnits, customQualities);
      }
      setUnitInput(trimmed);
    } else {
      if (!allQualities.some((q) => q.toLowerCase() === trimmed.toLowerCase())) {
        const nextQuals = [...customQualities, trimmed];
        setCustomQualities(nextQuals);
        syncListsToCloud(customCategories, customUnits, nextQuals);
      }
      setQualityInput(trimmed);
    }
    setNewItemInput('');
  };

  // Rename existing category, unit, or quality across list & existing products
  const handleSaveRenameCatOrUnit = async (oldVal: string) => {
    if (catUnitTab !== 'QUALITY' && !isAdmin) return;
    const newVal = editingItemNew.trim();
    if (!newVal || newVal === oldVal) {
      setEditingItemOld(null);
      return;
    }
    setIsUpdatingCatUnit(true);
    try {
      if (catUnitTab === 'CATEGORY') {
        const base = customCategories.includes(oldVal)
          ? customCategories
          : [...customCategories, oldVal];
        const nextCats = Array.from(
          new Set(base.map((c) => (c === oldVal ? newVal : c)))
        );
        setCustomCategories(nextCats);
        syncListsToCloud(nextCats, customUnits, customQualities);
        if (selectedCategory === oldVal) setSelectedCategory(newVal);
        if (categoryInput === oldVal) setCategoryInput(newVal);
        const affected = products.filter((p) => p.category === oldVal);
        for (const prod of affected) {
          await onUpdateProduct(prod, {
            name: prod.name,
            category: newVal,
            unit: prod.unit,
            buyPrice: prod.buyPrice,
            sellPrice: prod.sellPrice,
            stock: prod.stock,
            lowStockThreshold: prod.lowStockThreshold,
            barcode: prod.barcode,
            quality: prod.quality,
            note: prod.note,
          });
        }
      } else if (catUnitTab === 'UNIT') {
        const base = customUnits.includes(oldVal)
          ? customUnits
          : [...customUnits, oldVal];
        const nextUnits = Array.from(
          new Set(base.map((u) => (u === oldVal ? newVal : u)))
        );
        setCustomUnits(nextUnits);
        syncListsToCloud(customCategories, nextUnits, customQualities);
        if (unitInput === oldVal) setUnitInput(newVal);
        const affected = products.filter((p) => p.unit === oldVal);
        for (const prod of affected) {
          await onUpdateProduct(prod, {
            name: prod.name,
            category: prod.category,
            unit: newVal,
            buyPrice: prod.buyPrice,
            sellPrice: prod.sellPrice,
            stock: prod.stock,
            lowStockThreshold: prod.lowStockThreshold,
            barcode: prod.barcode,
            quality: prod.quality,
            note: prod.note,
          });
        }
      } else {
        const base = customQualities.includes(oldVal)
          ? customQualities
          : [...customQualities, oldVal];
        const nextQuals = Array.from(
          new Set(base.map((q) => (q === oldVal ? newVal : q)))
        );
        setCustomQualities(nextQuals);
        syncListsToCloud(customCategories, customUnits, nextQuals);
        if (qualityInput === oldVal) setQualityInput(newVal);
        const affected = products.filter((p) => (p.quality || '') === oldVal);
        for (const prod of affected) {
          await onUpdateProduct(prod, {
            name: prod.name,
            category: prod.category,
            unit: prod.unit,
            buyPrice: prod.buyPrice,
            sellPrice: prod.sellPrice,
            stock: prod.stock,
            lowStockThreshold: prod.lowStockThreshold,
            barcode: prod.barcode,
            quality: newVal,
            note: prod.note,
          });
        }
      }
    } finally {
      setIsUpdatingCatUnit(false);
      setEditingItemOld(null);
      setEditingItemNew('');
    }
  };

  const handleDeleteCatOrUnit = (val: string) => {
    if (catUnitTab !== 'QUALITY' && !isAdmin) return;
    if (catUnitTab === 'CATEGORY') {
      if (allCategories.length <= 1) return;
      const nextCats = customCategories.filter((c) => c !== val);
      setCustomCategories(nextCats);
      syncListsToCloud(nextCats, customUnits, customQualities);
      if (selectedCategory === val) setSelectedCategory('All');
    } else if (catUnitTab === 'UNIT') {
      if (allUnits.length <= 1) return;
      const nextUnits = customUnits.filter((u) => u !== val);
      setCustomUnits(nextUnits);
      syncListsToCloud(customCategories, nextUnits, customQualities);
    } else {
      if (allQualities.length <= 1) return;
      const nextQuals = customQualities.filter((q) => q !== val);
      setCustomQualities(nextQuals);
      syncListsToCloud(customCategories, customUnits, nextQuals);
      if (qualityInput === val) setQualityInput('');
    }
  };

  // Overall Inventory Totals
  const totalInventoryCostValue = useMemo(
    () =>
      products.reduce(
        (sum, p) => sum + Math.max(0, p.stock) * Math.max(0, p.buyPrice),
        0
      ),
    [products]
  );

  const totalInventorySellValue = useMemo(
    () =>
      products.reduce(
        (sum, p) => sum + Math.max(0, p.stock) * Math.max(0, p.sellPrice),
        0
      ),
    [products]
  );

  // Chronological Serial Number Map: first added product = 1, second = 2, and so on
  const productSerialNumberMap = useMemo(() => {
    const map: Record<string, number> = {};
    const chronological = [...products].sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.name.localeCompare(b.name);
    });
    chronological.forEach((p, idx) => {
      map[p.id] = idx + 1;
    });
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      const sl = productSerialNumberMap[p.id] || 0;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        (p.quality || '').toLowerCase().includes(q) ||
        (p.note || '').toLowerCase().includes(q) ||
        String(sl) === q.replace('#', '');
      const matchesCat =
        selectedCategory === 'All' || p.category === selectedCategory;
      const matchesStock =
        stockFilter === 'ALL'
          ? true
          : stockFilter === 'OUT'
          ? p.stock <= 0
          : p.stock > 0 && p.stock <= p.lowStockThreshold;
      return matchesSearch && matchesCat && matchesStock;
    });

    return [...list].sort((a, b) => {
      const slA = productSerialNumberMap[a.id] || 0;
      const slB = productSerialNumberMap[b.id] || 0;
      if (sortBy === 'SL_ASC') return slA - slB;
      if (sortBy === 'STOCK_LOW_HIGH') return a.stock - b.stock;
      if (sortBy === 'STOCK_HIGH_LOW') return b.stock - a.stock;
      if (sortBy === 'VALUE_HIGH_LOW')
        return (
          Math.max(0, b.stock) * b.sellPrice -
          Math.max(0, a.stock) * a.sellPrice
        );
      if (sortBy === 'PRICE_HIGH_LOW') return b.sellPrice - a.sellPrice;
      return a.name.localeCompare(b.name);
    });
  }, [
    products,
    productSerialNumberMap,
    searchQuery,
    selectedCategory,
    stockFilter,
    sortBy,
  ]);

  const activeDetailProduct = selectedProduct
    ? products.find((p) => p.id === selectedProduct.id) || selectedProduct
    : null;

  if (activeDetailProduct) {
    const activeSlNumber = productSerialNumberMap[activeDetailProduct.id] || 1;
    const profitPerUnit = getProfitMarginPerUnit(activeDetailProduct);
    const marginPercent = Math.round(
      getProfitMarginPercent(activeDetailProduct)
    );
    const productStockCostVal =
      Math.max(0, activeDetailProduct.stock) *
      Math.max(0, activeDetailProduct.buyPrice);
    const productStockSellVal =
      Math.max(0, activeDetailProduct.stock) *
      Math.max(0, activeDetailProduct.sellPrice);
    const productMovements = transactions.filter(
      (t) =>
        t.type === 'STOCK_ADJUST' && t.productId === activeDetailProduct.id
    );

    return (
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 space-y-3">
        <div className="flex items-center justify-between bg-white dark:bg-slate-800 px-3 py-2.5 rounded-xl border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs">
          <button
            type="button"
            onClick={() => setSelectedProduct(null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#00965E] hover:text-[#00965E] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isBengali ? 'পণ্যের তালিকায় ফিরুন' : 'Back to Products'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => openEditModal(activeDetailProduct)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white text-xs font-bold cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isBengali ? 'এডিট' : 'Edit'}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteProduct(activeDetailProduct)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-bold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isBengali ? 'ডিলিট' : 'Delete'}</span>
            </button>
          </div>
        </div>

        {/* Product Overview Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-700">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-[#00965E]/40 text-[#00965E] dark:text-[#34D399] text-xs font-black">
                  #{toBengaliDigits(activeSlNumber, language)}
                </span>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {activeDetailProduct.name}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#00965E] text-[11px] font-bold">
                  <Tag className="w-3 h-3" />
                  <span>{activeDetailProduct.category}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold">
                  <span>
                    {isBengali ? 'একক' : 'Unit'}: {activeDetailProduct.unit}
                  </span>
                </span>
                {activeDetailProduct.quality && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                    <Award className="w-3 h-3" />
                    <span>
                      {isBengali ? 'মান' : 'Quality'}: {activeDetailProduct.quality}
                    </span>
                  </span>
                )}
                {activeDetailProduct.barcode && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                    <Barcode className="w-3 h-3" />
                    <span>{activeDetailProduct.barcode}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-emerald-50/50 dark:bg-slate-900 border border-[#CBEAD9] dark:border-slate-700 text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                {isBengali ? 'বর্তমান স্টক' : 'Current Stock'}
              </span>
              <p
                className={`text-lg font-black ${
                  activeDetailProduct.stock <=
                  activeDetailProduct.lowStockThreshold
                    ? 'text-red-600'
                    : 'text-[#00965E]'
                }`}
              >
                {toBengaliDigits(activeDetailProduct.stock, language)}{' '}
                {activeDetailProduct.unit}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-[10.5px] font-semibold text-slate-400 inline-flex items-center gap-1">
                <Banknote className="w-3 h-3 text-slate-400" />
                <span>{isBengali ? 'কেনা দাম' : 'Buy Price'}</span>
              </span>
              <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-0.5">
                ৳{toBengaliDigits(formatMoney(activeDetailProduct.buyPrice), language)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-[10.5px] font-semibold text-slate-400 inline-flex items-center gap-1">
                <Tag className="w-3 h-3 text-[#00965E]" />
                <span>{isBengali ? 'বিক্রয় মূল্য' : 'Sell Price'}</span>
              </span>
              <p className="text-sm font-extrabold text-[#00965E] mt-0.5">
                ৳{toBengaliDigits(formatMoney(activeDetailProduct.sellPrice), language)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-[10.5px] font-semibold text-slate-400 inline-flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
                <span>{isBengali ? 'একক লাভ' : 'Profit / Unit'}</span>
              </span>
              <p className="text-sm font-extrabold text-emerald-600 mt-0.5">
                ৳{toBengaliDigits(formatMoney(profitPerUnit), language)} ({marginPercent}%)
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10.5px] font-semibold text-[#00965E] inline-flex items-center gap-1">
                <Coins className="w-3 h-3 text-[#00965E]" />
                <span>{isBengali ? 'মোট স্টক মূল্য (বিক্রয়)' : 'Stock Value (Sell)'}</span>
              </span>
              <p className="text-sm font-extrabold text-[#00965E] mt-0.5">
                ৳{toBengaliDigits(formatMoney(productStockSellVal), language)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-[10.5px] font-semibold text-slate-400 inline-flex items-center gap-1">
                <Coins className="w-3 h-3 text-slate-400" />
                <span>{isBengali ? 'মোট কেনা মূল্যমান' : 'Stock Cost Value'}</span>
              </span>
              <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-0.5">
                ৳{toBengaliDigits(formatMoney(productStockCostVal), language)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-[10.5px] font-semibold text-slate-400 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span>{isBengali ? 'কম স্টক সতর্কতা' : 'Low Stock Alert'}</span>
              </span>
              <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-0.5">
                {toBengaliDigits(activeDetailProduct.lowStockThreshold, language)}{' '}
                {activeDetailProduct.unit}
              </p>
            </div>
          </div>

          {activeDetailProduct.note && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-start gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5 text-[#00965E] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-500 dark:text-slate-400">
                  {isBengali ? 'নোট:' : 'Note:'}{' '}
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {activeDetailProduct.note}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => openQuickAdjustModal(activeDetailProduct)}
              className="flex-1 py-2 px-3 rounded-xl bg-[#00965E] hover:bg-[#057A50] border border-emerald-400/50 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBengali ? 'স্টক ইন / সমন্বয় করুন' : 'Adjust Stock (In / Out)'}</span>
            </button>
            <button
              type="button"
              onClick={() => onAddToCart(activeDetailProduct)}
              className="py-2 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{isBengali ? 'কার্টে যোগ' : 'Add to Cart'}</span>
            </button>
          </div>
        </div>

        {/* Stock Movement History */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs space-y-2.5">
          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
            {isBengali ? 'স্টক পরিবর্তনের ইতিহাস' : 'Stock Movements History'}
          </h3>
          {productMovements.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              {isBengali ? 'কোনো স্টক পরিবর্তন রেকর্ড নেই' : 'No stock movements recorded yet'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {productMovements.map((tx) => {
                const isAdd = tx.category !== 'Stock Out';
                const signedDelta = isAdd ? tx.amount : -tx.amount;
                return (
                  <div
                    key={tx.id}
                    className="py-2 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-100">
                        {tx.title} ({isAdd ? '+' : '-'}
                        {tx.amount} {activeDetailProduct.unit})
                      </p>
                      <p className="text-slate-500 text-[11px]">{tx.notes}</p>
                      <p className="text-[10.5px] text-slate-400">
                        {formatTimestamp(tx.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onVoidStockAdjustment(
                          activeDetailProduct,
                          tx,
                          signedDelta
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{isBengali ? 'বাতিল' : 'Undo'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const lowCount = products.filter(
    (p) => p.stock > 0 && p.stock <= p.lowStockThreshold
  ).length;
  const outCount = products.filter((p) => p.stock <= 0).length;

  return (
    <div className="max-w-4xl lg:max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 pb-8 space-y-2">
      {/* Decorated Products Menu Top Summary Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-[#A7F3D0] dark:border-slate-700 shadow-xs overflow-hidden">
        {/* Top Title Banner with Emerald Accent Gradient */}
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-gradient-to-r from-[#ECFDF5] via-[#F0FDF4] to-white dark:from-emerald-950/60 dark:via-slate-800 dark:to-slate-800 border-b border-[#CBEAD9] dark:border-slate-700">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#00965E] text-white border border-emerald-300/60 shadow-2xs flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-[#064E3B] dark:text-white leading-tight">
                  {strings.navProducts}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-[#00965E]/40 text-[10px] font-extrabold text-[#00965E] dark:text-[#34D399] leading-none shadow-2xs">
                  {toBengaliDigits(products.length, language)}{' '}
                  {isBengali ? 'টি পণ্য' : 'Products'}
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {isBengali
                  ? 'ইনভেন্টরি ও স্টক মূল্যমান সারসংক্ষেপ'
                  : 'Inventory & Stock Valuation Summary'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00B368] hover:bg-[#059658] border border-emerald-300/70 text-white font-extrabold text-xs shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{strings.addProductBtn}</span>
          </button>
        </div>

        {/* 3 Decorated Bordered Inventory Summary Tiles */}
        <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-white dark:bg-slate-800">
          {/* 1. Total Stock Value (Sell) */}
          <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-[#A7F3D0] dark:border-emerald-800/80 flex flex-col justify-between">
            <span className="text-[9.5px] font-bold text-[#047857] dark:text-emerald-300 inline-flex items-center gap-1 truncate">
              <Tag className="w-2.5 h-2.5 text-[#00965E] shrink-0" />
              <span className="truncate">
                {isBengali ? 'মোট স্টক মূল্য (বিক্রয়)' : 'Stock Value (Sell)'}
              </span>
            </span>
            <span className="text-xs sm:text-sm font-black text-[#00965E] dark:text-[#34D399] mt-0.5 truncate">
              ৳{toBengaliDigits(formatMoney(totalInventorySellValue), language)}
            </span>
          </div>

          {/* 2. Total Stock Cost Value */}
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
            <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 truncate">
              <Coins className="w-2.5 h-2.5 text-slate-500 shrink-0" />
              <span className="truncate">
                {isBengali ? 'মোট কেনা মূল্য' : 'Total Cost Value'}
              </span>
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 mt-0.5 truncate">
              ৳{toBengaliDigits(formatMoney(totalInventoryCostValue), language)}
            </span>
          </div>

          {/* 3. Expected Stock Profit */}
          <div className="px-2.5 py-1.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 flex flex-col justify-between">
            <span className="text-[9.5px] font-bold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1 truncate">
              <TrendingUp className="w-2.5 h-2.5 text-amber-600 shrink-0" />
              <span className="truncate">
                {isBengali ? 'সম্ভাব্য মোট লাভ' : 'Est. Stock Profit'}
              </span>
            </span>
            <span className="text-xs sm:text-sm font-black text-amber-700 dark:text-amber-400 mt-0.5 truncate">
              ৳
              {toBengaliDigits(
                formatMoney(
                  Math.max(0, totalInventorySellValue - totalInventoryCostValue)
                ),
                language
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Compact Search + Sort Row */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-[#00965E] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={strings.searchProductsHint}
            className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white dark:bg-slate-800 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 text-xs font-semibold focus:border-[#00965E] focus:outline-none dark:text-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative shrink-0">
          <ArrowUpDown className="w-3 h-3 text-[#00965E] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as ProductSortOption)}
            className="pl-6 pr-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 text-[10.5px] font-bold text-slate-700 dark:text-slate-200 focus:border-[#00965E] focus:outline-none cursor-pointer"
            title={isBengali ? 'সাজান' : 'Sort Products'}
          >
            <option value="SL_ASC">
              {isBengali ? 'ক্রমিক নং (১, ২...)' : 'SL No. (1, 2...)'}
            </option>
            <option value="NAME_ASC">
              {isBengali ? 'নাম (A-Z)' : 'Name (A-Z)'}
            </option>
            <option value="VALUE_HIGH_LOW">
              {isBengali ? 'স্টক মূল্য (বেশি)' : 'Stock Value (High)'}
            </option>
            <option value="STOCK_LOW_HIGH">
              {isBengali ? 'স্টক (কম-বেশি)' : 'Stock (Low-High)'}
            </option>
            <option value="STOCK_HIGH_LOW">
              {isBengali ? 'স্টক (বেশি-কম)' : 'Stock (High-Low)'}
            </option>
            <option value="PRICE_HIGH_LOW">
              {isBengali ? 'দাম (বেশি-কম)' : 'Price (High-Low)'}
            </option>
          </select>
        </div>
      </div>

      {/* SINGLE-LINE FILTER BAR: All | Low Stock | Out of Stock | Category Filter */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-white dark:bg-slate-800 p-1 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs items-center">
        {(
          [
            [
              'ALL',
              `${strings.filterAll}(${toBengaliDigits(products.length, language)})`,
              Layers,
            ],
            [
              'LOW',
              `${isBengali ? 'স্টক কম' : 'Low Stock'}(${toBengaliDigits(
                lowCount,
                language
              )})`,
              AlertTriangle,
            ],
            [
              'OUT',
              `${isBengali ? 'স্টক শেষ' : 'Out of Stock'}(${toBengaliDigits(
                outCount,
                language
              )})`,
              XCircle,
            ],
          ] as const
        ).map(([key, label, FilterIcon]) => {
          const active = stockFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStockFilter(key)}
              className={`py-1.5 px-1 rounded-lg text-[9px] min-[375px]:text-[10px] sm:text-xs font-extrabold tracking-tight leading-none whitespace-nowrap overflow-hidden transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1 border ${
                active
                  ? 'bg-[#00965E] text-white border-[#007A4C] shadow-2xs'
                  : 'bg-slate-50/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-[#DCEEE4] dark:border-slate-700 hover:border-[#00965E]/50'
              }`}
            >
              <FilterIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
              <span className="whitespace-nowrap truncate">{label}</span>
            </button>
          );
        })}

        {/* Category Filter Dropdown in the same single line */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className={`w-full py-1.5 px-1 rounded-lg text-[9px] min-[375px]:text-[10px] sm:text-xs font-extrabold tracking-tight leading-none whitespace-nowrap truncate border cursor-pointer focus:outline-none ${
            selectedCategory !== 'All'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-[#00965E] border-[#00965E]'
              : 'bg-slate-50/70 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 border-[#DCEEE4] dark:border-slate-700'
          }`}
          title={isBengali ? 'ক্যাটাগরি ফিল্টার' : 'Filter by Category'}
        >
          <option value="All">
            {isBengali ? 'সব ক্যাটাগরি' : 'All Categories'}
          </option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Minimal & Compact Product List with SL Number + Separate Borders for Each Info Item */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 text-center border-[1.5px] border-[#CBEAD9] dark:border-slate-700 space-y-1.5">
          <Package className="w-7 h-7 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-500">
            {isBengali ? 'কোনো পণ্য পাওয়া যায়নি' : 'No products found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 lg:gap-2.5">
          {filteredProducts.map((product) => {
            const slNumber = productSerialNumberMap[product.id] || 1;
            const isOut = product.stock <= 0;
            const isLow =
              !isOut && product.stock <= product.lowStockThreshold;
            const stockQty = Math.max(0, product.stock);
            const totalStockSellVal = stockQty * Math.max(0, product.sellPrice);
            const totalStockCostVal = stockQty * Math.max(0, product.buyPrice);
            const unitProfit = Math.max(0, product.sellPrice - product.buyPrice);

            return (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="bg-white dark:bg-slate-800 rounded-xl p-2 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 hover:border-[#00965E] transition cursor-pointer shadow-2xs space-y-1.5"
              >
                {/* Minimal Row 1: SL Number + Product Name + Bordered Category, Unit & Optional Quality + Compact Action Buttons */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1 min-w-0 flex-1 flex-wrap">
                    {/* Bordered SL Number (1, 2, 3...) */}
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/70 border border-[#00965E]/50 text-[10px] font-black text-[#00965E] dark:text-[#34D399] leading-none shrink-0">
                      #{toBengaliDigits(slNumber, language)}
                    </span>

                    <span className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-white truncate leading-tight">
                      {product.name}
                    </span>

                    <span className="px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[9px] font-bold text-slate-600 dark:text-slate-300 leading-none shrink-0">
                      {product.category}
                    </span>

                    <span className="px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[9px] font-bold text-slate-500 dark:text-slate-400 leading-none shrink-0">
                      {product.unit}
                    </span>

                    {product.quality && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[9px] font-bold text-amber-800 dark:text-amber-300 leading-none shrink-0">
                        <Award className="w-2.5 h-2.5" />
                        <span>{product.quality}</span>
                      </span>
                    )}
                  </div>

                  {/* Minimal Quick Action Buttons */}
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={isOut}
                      onClick={() => onAddToCart(product)}
                      className="p-1 rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[#00965E] disabled:opacity-40 cursor-pointer"
                      title={isBengali ? 'কার্টে যোগ করুন' : 'Add to POS Cart'}
                    >
                      <ShoppingCart className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openQuickAdjustModal(product)}
                      className="p-1 rounded-md bg-slate-50 hover:bg-emerald-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-[#00965E] cursor-pointer"
                      title={isBengali ? 'দ্রুত স্টক ইন/আউট' : 'Quick Stock In/Out'}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(product)}
                      className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer"
                      title={isBengali ? 'পণ্য এডিট করুন' : 'Edit Product'}
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Minimal Row 2: Separate Bordered Information Pill Grid */}
                <div className="grid grid-cols-3 gap-1">
                  {/* 1. Buy Price */}
                  <div className="px-1.5 py-0.5 rounded bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1">
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
                      {isBengali ? 'কেনা' : 'Buy'}
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100">
                      ৳{toBengaliDigits(formatMoney(product.buyPrice), language)}
                    </span>
                  </div>

                  {/* 2. Sell Price */}
                  <div className="px-1.5 py-0.5 rounded bg-emerald-50/50 dark:bg-emerald-950/30 border border-[#CBEAD9] dark:border-emerald-800/80 flex items-center justify-between gap-1">
                    <span className="text-[9px] font-bold text-[#00965E] dark:text-emerald-300">
                      {isBengali ? 'বিক্রি' : 'Sell'}
                    </span>
                    <span className="text-[10px] font-extrabold text-[#00965E] dark:text-[#34D399]">
                      ৳{toBengaliDigits(formatMoney(product.sellPrice), language)}
                    </span>
                  </div>

                  {/* 3. Profit Per Unit */}
                  <div className="px-1.5 py-0.5 rounded bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1">
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
                      {isBengali ? 'লাভ' : 'Profit'}
                    </span>
                    <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                      ৳{toBengaliDigits(formatMoney(unitProfit), language)}
                    </span>
                  </div>

                  {/* 4. Stock Quantity */}
                  <div
                    className={`px-1.5 py-0.5 rounded border flex items-center justify-between gap-1 ${
                      isOut
                        ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                        : isLow
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                        : 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    }`}
                  >
                    <span className="text-[9px] font-bold">
                      {isBengali ? 'স্টক' : 'Stock'}
                    </span>
                    <span className="text-[10px] font-extrabold whitespace-nowrap">
                      {isOut
                        ? isBengali
                          ? 'শেষ (০)'
                          : 'Out (0)'
                        : `${toBengaliDigits(product.stock, language)} ${
                            product.unit
                          }`}
                    </span>
                  </div>

                  {/* 5. Total Stock Value (Sell) */}
                  <div className="px-1.5 py-0.5 rounded bg-emerald-50/40 dark:bg-slate-900/70 border border-[#CBEAD9] dark:border-slate-700 flex items-center justify-between gap-1">
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {isBengali ? 'স্টক মূল্য' : 'Stock Val'}
                    </span>
                    <span className="text-[10px] font-extrabold text-[#00965E] dark:text-[#34D399] whitespace-nowrap">
                      ৳{toBengaliDigits(formatMoney(totalStockSellVal), language)}
                    </span>
                  </div>

                  {/* 6. Total Stock Cost Value */}
                  <div className="px-1.5 py-0.5 rounded bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1">
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {isBengali ? 'মোট কেনা' : 'Cost Val'}
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      ৳{toBengaliDigits(formatMoney(totalStockCostVal), language)}
                    </span>
                  </div>
                </div>

                {/* Optional Row 3: Separate Bordered Note Box */}
                {product.note && (
                  <div className="px-1.5 py-0.5 rounded bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 flex items-center gap-1 text-[9.5px] text-slate-600 dark:text-slate-300">
                    <FileText className="w-2.5 h-2.5 text-[#00965E] shrink-0" />
                    <span className="font-bold shrink-0">
                      {isBengali ? 'নোট:' : 'Note:'}
                    </span>
                    <span className="font-semibold truncate">{product.note}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Stock Adjust Modal (accessible from product list or product detail) */}
      {showAdjustModal && (adjustTargetProduct || activeDetailProduct) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {isBengali ? 'স্টক সমন্বয়' : 'Adjust Stock'} —{' '}
                {(adjustTargetProduct || activeDetailProduct)?.name}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAdjustModal(false);
                  setAdjustTargetProduct(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdjustStock} className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['STOCK_IN', isBengali ? 'স্টক ইন (+)' : 'Stock In (+)'],
                    ['STOCK_OUT', isBengali ? 'স্টক আউট (-)' : 'Stock Out (-)'],
                    ['DAMAGED', isBengali ? 'নষ্ট / ক্ষতি (-)' : 'Damaged (-)'],
                  ] as const
                ).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAdjType(type)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border cursor-pointer ${
                      adjType === type
                        ? 'bg-[#00965E] text-white border-[#00965E]'
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'পরিমাণ' : 'Quantity'} (
                  {(adjustTargetProduct || activeDetailProduct)?.unit})
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={adjQtyInput}
                  onChange={(e) => setAdjQtyInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'কারণ (ঐচ্ছিক)' : 'Reason (optional)'}
                </label>
                <input
                  type="text"
                  value={adjReasonInput}
                  onChange={(e) => setAdjReasonInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdjustModal(false);
                    setAdjustTargetProduct(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#00965E] text-white cursor-pointer"
                >
                  {isBengali ? 'সংরক্ষণ করুন' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {editingProduct
                  ? isBengali
                    ? 'পণ্য সম্পাদনা করুন'
                    : 'Edit Product'
                  : strings.addProductBtn}
              </h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-3 space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'পণ্যের নাম *' : 'Product Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {isBengali ? 'ক্যাটাগরি' : 'Category'}
                    </label>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setCatUnitTab('CATEGORY');
                          setEditingItemOld(null);
                          setNewItemInput('');
                          setShowCatUnitModal(true);
                        }}
                        className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-[#00965E] hover:underline cursor-pointer"
                        title={
                          isBengali
                            ? 'ক্যাটাগরি যোগ বা এডিট করুন (অ্যাডমিন)'
                            : 'Add or Edit Category (Admin)'
                        }
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>{isBengali ? '+যোগ/এডিট' : '+Add/Edit'}</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm dark:bg-slate-900 dark:text-white"
                  >
                    {allCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {isBengali ? 'একক (Unit)' : 'Unit'}
                    </label>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setCatUnitTab('UNIT');
                          setEditingItemOld(null);
                          setNewItemInput('');
                          setShowCatUnitModal(true);
                        }}
                        className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-[#00965E] hover:underline cursor-pointer"
                        title={
                          isBengali
                            ? 'একক যোগ বা এডিট করুন (অ্যাডমিন)'
                            : 'Add or Edit Unit (Admin)'
                        }
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>{isBengali ? '+যোগ/এডিট' : '+Add/Edit'}</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={unitInput}
                    onChange={(e) => setUnitInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm dark:bg-slate-900 dark:text-white"
                  >
                    {allUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'কেনা দাম (৳) *' : 'Buy Price (৳) *'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={buyPriceInput}
                    onChange={(e) => setBuyPriceInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'বিক্রয় মূল্য (৳) *' : 'Sell Price (৳) *'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={sellPriceInput}
                    onChange={(e) => setSellPriceInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'বর্তমান স্টক *' : 'Stock Quantity *'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={stockQtyInput}
                    onChange={(e) => setStockQtyInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'কম স্টক সতর্কতা' : 'Low Stock Alert At'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Live Calculated Total Stock Value Preview inside Modal */}
              {(Number(stockQtyInput) > 0 || Number(sellPriceInput) > 0) && (
                <div className="px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {isBengali ? 'মোট স্টক মূল্য:' : 'Total Stock Value:'}
                  </span>
                  <span className="font-black text-[#00965E] dark:text-[#34D399]">
                    ৳
                    {toBengaliDigits(
                      formatMoney(
                        Math.max(0, Number(stockQtyInput) || 0) *
                          Math.max(0, Number(sellPriceInput) || 0)
                      ),
                      language
                    )}{' '}
                    <span className="text-slate-400 font-semibold">
                      ({isBengali ? 'কেনা' : 'Cost'}: ৳
                      {toBengaliDigits(
                        formatMoney(
                          Math.max(0, Number(stockQtyInput) || 0) *
                            Math.max(0, Number(buyPriceInput) || 0)
                        ),
                        language
                      )}
                      )
                    </span>
                  </span>
                </div>
              )}

              {/* Selective Quality (Optional) + Barcode / SKU */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {isBengali ? 'মান / Quality (ঐচ্ছিক)' : 'Quality (Optional)'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCatUnitTab('QUALITY');
                        setEditingItemOld(null);
                        setNewItemInput('');
                        setShowCatUnitModal(true);
                      }}
                      className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-[#00965E] hover:underline cursor-pointer"
                      title={
                        isBengali
                          ? 'মান (Quality) যোগ বা এডিট করুন'
                          : 'Add or Edit Quality Options'
                      }
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>{isBengali ? '+যোগ/এডিট' : '+Add/Edit'}</span>
                    </button>
                  </div>
                  <select
                    value={qualityInput}
                    onChange={(e) => setQualityInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">
                      {isBengali ? 'নির্বাচন করুন (ঐচ্ছিক)' : 'None (Optional)'}
                    </option>
                    {allQualities.map((qVal) => (
                      <option key={qVal} value={qVal}>
                        {qVal}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Barcode / SKU
                  </label>
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Free Text Note Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'নোট / Note (ঐচ্ছিক)' : 'Note (Optional)'}
                </label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder={
                    isBengali
                      ? 'পণ্য সম্পর্কে কোনো নোট থাকলে লিখুন...'
                      : 'Write any note about this product...'
                  }
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#00965E] hover:bg-[#057A50] text-white cursor-pointer"
                >
                  {isBengali ? 'সংরক্ষণ করুন' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY, UNIT & QUALITY EDIT + ADD MODAL */}
      {showCatUnitModal && (isAdmin || catUnitTab === 'QUALITY') && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl border-[1.5px] border-[#CBEAD9] dark:border-slate-700 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#00965E]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    {isBengali
                      ? 'ক্যাটাগরি, একক ও মান পরিচালনা'
                      : 'Manage Categories, Units & Quality'}
                  </h3>
                  <p className="text-[10.5px] font-bold text-[#00965E]">
                    {isBengali
                      ? 'নতুন অপশন যোগ বা বর্তমান অপশন এডিট করুন'
                      : 'Add new options or edit existing options'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCatUnitModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Switcher: Category | Unit | Quality */}
            <div
              className={`grid ${
                isAdmin ? 'grid-cols-3' : 'grid-cols-1'
              } gap-1 p-1 mt-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700`}
            >
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setCatUnitTab('CATEGORY');
                    setEditingItemOld(null);
                    setNewItemInput('');
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                    catUnitTab === 'CATEGORY'
                      ? 'bg-[#00965E] text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isBengali
                    ? `ক্যাটাগরি (${toBengaliDigits(allCategories.length, language)})`
                    : `Category (${allCategories.length})`}
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setCatUnitTab('UNIT');
                    setEditingItemOld(null);
                    setNewItemInput('');
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                    catUnitTab === 'UNIT'
                      ? 'bg-[#00965E] text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isBengali
                    ? `একক (${toBengaliDigits(allUnits.length, language)})`
                    : `Unit (${allUnits.length})`}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCatUnitTab('QUALITY');
                  setEditingItemOld(null);
                  setNewItemInput('');
                }}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                  catUnitTab === 'QUALITY'
                    ? 'bg-[#00965E] text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isBengali
                  ? `মান / Quality (${toBengaliDigits(allQualities.length, language)})`
                  : `Quality (${allQualities.length})`}
              </button>
            </div>

            {/* Add New Category / Unit / Quality Form */}
            <form onSubmit={handleAddCatOrUnit} className="mt-3 flex gap-1.5">
              <input
                type="text"
                value={newItemInput}
                onChange={(e) => setNewItemInput(e.target.value)}
                placeholder={
                  catUnitTab === 'CATEGORY'
                    ? isBengali
                      ? 'নতুন ক্যাটাগরির নাম লিখুন...'
                      : 'Enter new category name...'
                    : catUnitTab === 'UNIT'
                    ? isBengali
                      ? 'নতুন একক লিখুন (যেমন: বস্তা, কেস)...'
                      : 'Enter new unit (e.g. sack, case)...'
                    : isBengali
                    ? 'নতুন মান লিখুন (যেমন: প্রিমিয়াম, গ্রেড এ)...'
                    : 'Enter new quality (e.g. Premium, Grade A)...'
                }
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold dark:bg-slate-900 dark:text-white focus:border-[#00965E] focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-[#00B368] hover:bg-[#059658] text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isBengali ? 'যোগ করুন' : 'Add'}</span>
              </button>
            </form>

            {/* Existing List with Edit + Delete */}
            <div className="mt-3 flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5">
              {(catUnitTab === 'CATEGORY'
                ? allCategories
                : catUnitTab === 'UNIT'
                ? allUnits
                : allQualities
              ).map((itemVal) => {
                const isEditingThis = editingItemOld === itemVal;
                const usedCount = products.filter((p) =>
                  catUnitTab === 'CATEGORY'
                    ? p.category === itemVal
                    : catUnitTab === 'UNIT'
                    ? p.unit === itemVal
                    : (p.quality || '') === itemVal
                ).length;

                return (
                  <div
                    key={itemVal}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    {isEditingThis ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={editingItemNew}
                          onChange={(e) => setEditingItemNew(e.target.value)}
                          className="flex-1 px-2.5 py-1 rounded-lg border border-[#00965E] text-xs font-bold dark:bg-slate-900 dark:text-white"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={isUpdatingCatUnit}
                          onClick={() => handleSaveRenameCatOrUnit(itemVal)}
                          className="p-1.5 rounded-lg bg-[#00965E] text-white cursor-pointer"
                          title={isBengali ? 'সংরক্ষণ' : 'Save'}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingItemOld(null)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-extrabold text-slate-800 dark:text-slate-100 truncate">
                            {itemVal}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-300">
                            {toBengaliDigits(usedCount, language)}{' '}
                            {isBengali ? 'পণ্য' : 'items'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItemOld(itemVal);
                              setEditingItemNew(itemVal);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-[#00965E] font-bold text-[11px] cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{isBengali ? 'এডিট' : 'Edit'}</span>
                          </button>
                          {usedCount === 0 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCatOrUnit(itemVal)}
                              className="p-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
                              title={isBengali ? 'মুছে ফেলুন' : 'Remove'}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCatUnitModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold cursor-pointer"
              >
                {isBengali ? 'সম্পন্ন' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {isBengali ? 'পণ্য মুছবেন?' : 'Delete Product?'} —{' '}
              {confirmDeleteProduct.name}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {isBengali
                ? 'এই পণ্যটি রিসাইকেল বিনে স্থানান্তরিত হবে এবং পরবর্তীতে পুনরুদ্ধার করা যাবে।'
                : 'This product will be moved to the Recycle Bin and can be restored later.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteProduct(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {isBengali ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteProduct(
                    confirmDeleteProduct.id,
                    confirmDeleteProduct.name
                  );
                  setConfirmDeleteProduct(null);
                  setSelectedProduct(null);
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-red-600 text-white cursor-pointer"
              >
                {isBengali ? 'ডিলিট' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
