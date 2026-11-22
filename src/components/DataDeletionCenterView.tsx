import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ShieldAlert,
  Trash2,
  Search,
  X,
  ShoppingBag,
  Package,
  Users,
  Truck,
  UserCheck,
  Download,
  CheckSquare,
  Square,
  Calendar,
  Filter,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  AppLanguage,
  Product,
  Customer,
  StoreTransaction,
  Supplier,
  StaffMember,
  formatMoney,
  formatTimestamp,
  toBengaliDigits,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';
import {
  DeletionProtectionModal,
  DeletionProtectionTarget,
} from './DeletionProtectionModal';

interface DataDeletionCenterViewProps {
  products: Product[];
  customers: Customer[];
  transactions: StoreTransaction[];
  suppliers: Supplier[];
  staffList: StaffMember[];
  strings: DokanTranslations;
  language: AppLanguage;
  onBack: () => void;
  onOpenRecycleBin: () => void;
  onDeleteTransaction: (tx: StoreTransaction) => Promise<void>;
  onDeleteProduct: (productId: string, productName: string) => Promise<void>;
  onDeleteCustomer: (customerId: string, customerName: string) => Promise<void>;
  onDeleteSupplier: (supplierId: string, supplierName: string) => Promise<void>;
  onDeleteStaff: (staff: StaffMember) => Promise<void>;
  onResetAllStoreData: () => Promise<void>;
}

type ModuleTab = 'TRANSACTIONS' | 'PRODUCTS' | 'CUSTOMERS' | 'SUPPLIERS' | 'STAFF';
type DateFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'OLDER_30';

function getTxMillis(tx: StoreTransaction): number {
  if (!tx.createdAt) return 0;
  try {
    return tx.createdAt.toDate().getTime();
  } catch {
    return 0;
  }
}

export const DataDeletionCenterView: React.FC<DataDeletionCenterViewProps> = ({
  products,
  customers,
  transactions,
  suppliers,
  staffList,
  strings,
  language,
  onBack,
  onOpenRecycleBin,
  onDeleteTransaction,
  onDeleteProduct,
  onDeleteCustomer,
  onDeleteSupplier,
  onDeleteStaff,
  onResetAllStoreData,
}) => {
  const isBn = language === AppLanguage.BENGALI;

  const [activeTab, setActiveTab] = useState<ModuleTab>('TRANSACTIONS');
  const [searchQuery, setSearchQuery] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [subFilter, setSubFilter] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [protectionTarget, setProtectionTarget] =
    useState<DeletionProtectionTarget | null>(null);

  const totalActiveRecords =
    transactions.length +
    products.length +
    customers.length +
    suppliers.length +
    staffList.length;

  const switchTab = (tab: ModuleTab) => {
    setActiveTab(tab);
    setSelectedIds(new Set());
    setSearchQuery('');
    setTxTypeFilter('ALL');
    setDateFilter('ALL');
    setSubFilter('ALL');
  };

  // Filtered datasets per active module tab
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const todayStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    ).getTime();

    return transactions.filter((tx) => {
      if (txTypeFilter !== 'ALL' && tx.type !== txTypeFilter) return false;

      if (dateFilter !== 'ALL') {
        const ms = getTxMillis(tx);
        if (dateFilter === 'TODAY' && ms < todayStart) return false;
        if (dateFilter === 'WEEK' && ms < now - 7 * 86400000) return false;
        if (dateFilter === 'MONTH' && ms < now - 30 * 86400000) return false;
        if (dateFilter === 'OLDER_30' && (ms === 0 || ms >= now - 30 * 86400000)) {
          return false;
        }
      }

      if (q) {
        const text = `${tx.title} ${tx.type} ${tx.customerName} ${tx.supplierName} ${tx.category} ${tx.notes}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, txTypeFilter, dateFilter, searchQuery]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (subFilter === 'ZERO_STOCK' && p.stock > 0) return false;
      if (subFilter === 'LOW_STOCK' && p.stock > p.lowStockThreshold) return false;
      if (q) {
        const text = `${p.name} ${p.category} ${p.barcode}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [products, subFilter, searchQuery]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (subFilter === 'ZERO_DUE' && c.totalDue > 0) return false;
      if (subFilter === 'HAS_DUE' && c.totalDue <= 0) return false;
      if (q) {
        const text = `${c.name} ${c.phone} ${c.address} ${c.identityHint || ''} ${c.note || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [customers, subFilter, searchQuery]);

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (subFilter === 'ZERO_PAYABLE' && s.payableBalance > 0) return false;
      if (subFilter === 'HAS_PAYABLE' && s.payableBalance <= 0) return false;
      if (q) {
        const text = `${s.name} ${s.company} ${s.phone}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [suppliers, subFilter, searchQuery]);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staffList.filter((st) => {
      if (subFilter === 'INACTIVE' && st.active) return false;
      if (subFilter === 'ACTIVE' && !st.active) return false;
      if (q) {
        const text = `${st.name} ${st.role} ${st.phone}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [staffList, subFilter, searchQuery]);

  const currentFilteredIds = useMemo(() => {
    if (activeTab === 'TRANSACTIONS') return filteredTransactions.map((t) => t.id);
    if (activeTab === 'PRODUCTS') return filteredProducts.map((p) => p.id);
    if (activeTab === 'CUSTOMERS') return filteredCustomers.map((c) => c.id);
    if (activeTab === 'SUPPLIERS') return filteredSuppliers.map((s) => s.id);
    return filteredStaff.map((st) => st.id);
  }, [
    activeTab,
    filteredTransactions,
    filteredProducts,
    filteredCustomers,
    filteredSuppliers,
    filteredStaff,
  ]);

  const allSelected =
    currentFilteredIds.length > 0 &&
    currentFilteredIds.every((id) => selectedIds.has(id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentFilteredIds));
    }
  };

  const downloadStoreSafetyBackup = () => {
    const payload = {
      store: 'Siaam Store (সিয়াম স্টোর)',
      exportedAt: new Date().toISOString(),
      counts: {
        products: products.length,
        customers: customers.length,
        transactions: transactions.length,
        suppliers: suppliers.length,
        staff: staffList.length,
      },
      data: {
        products,
        customers,
        transactions,
        suppliers,
        staff: staffList,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siaam-store-safety-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Protected single-item deletion triggers (all go through 5-layer protection)
  const requestDeleteSingleTransaction = (tx: StoreTransaction) => {
    setProtectionTarget({
      title: 'Delete Transaction Record',
      titleBn: 'লেনদেন রেকর্ড মুছে ফেলুন',
      description:
        'This transaction will be deleted and moved to the Recycle Bin. Related balances may adjust.',
      descriptionBn:
        'এই লেনদেনটি মুছে রিসাইকেল বিনে পাঠানো হবে এবং সংশ্লিষ্ট হিসাব পরিবর্তিত হতে পারে।',
      itemCount: 1,
      previewItems: [
        `${tx.title} (${tx.type}) — ৳${formatMoney(tx.amount)}`,
      ],
      confirmPhrase: 'DELETE',
      isPermanent: false,
      actionButtonLabel: 'Confirm Delete',
      actionButtonLabelBn: 'ডিলিট নিশ্চিত করুন',
      onExecute: async () => {
        await onDeleteTransaction(tx);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(tx.id);
          return next;
        });
      },
    });
  };

  const requestDeleteSingleProduct = (p: Product) => {
    setProtectionTarget({
      title: 'Delete Product from Inventory',
      titleBn: 'পণ্য তালিকা থেকে মুছুন',
      description:
        'This product will be removed from active inventory and moved to the Recycle Bin.',
      descriptionBn:
        'পণ্যটি সক্রিয় ইনভেন্টরি থেকে সরে রিসাইকেল বিনে চলে যাবে।',
      itemCount: 1,
      previewItems: [`${p.name} (Stock: ${p.stock} ${p.unit})`],
      confirmPhrase: 'DELETE',
      isPermanent: false,
      actionButtonLabel: 'Confirm Delete',
      actionButtonLabelBn: 'ডিলিট নিশ্চিত করুন',
      onExecute: async () => {
        await onDeleteProduct(p.id, p.name);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(p.id);
          return next;
        });
      },
    });
  };

  const requestDeleteSingleCustomer = (c: Customer) => {
    setProtectionTarget({
      title: 'Delete Customer Profile',
      titleBn: 'কাস্টমার প্রোফাইল মুছুন',
      description:
        'This customer profile will be removed from active accounts and moved to the Recycle Bin.',
      descriptionBn:
        'এই কাস্টমারের তথ্য সক্রিয় তালিকা থেকে সরে রিসাইকেল বিনে চলে যাবে।',
      itemCount: 1,
      previewItems: [`${c.name} (Due: ৳${formatMoney(c.totalDue)})`],
      confirmPhrase: 'DELETE',
      isPermanent: false,
      actionButtonLabel: 'Confirm Delete',
      actionButtonLabelBn: 'ডিলিট নিশ্চিত করুন',
      onExecute: async () => {
        await onDeleteCustomer(c.id, c.name);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(c.id);
          return next;
        });
      },
    });
  };

  const requestDeleteSingleSupplier = (s: Supplier) => {
    setProtectionTarget({
      title: 'Delete Supplier Account',
      titleBn: 'সাপ্লায়ার অ্যাকাউন্ট মুছুন',
      description:
        'This supplier will be removed from your active ledger and moved to the Recycle Bin.',
      descriptionBn:
        'এই সাপ্লায়ারটি সক্রিয় খাতা থেকে সরে রিসাইকেল বিনে চলে যাবে।',
      itemCount: 1,
      previewItems: [`${s.name} (Payable: ৳${formatMoney(s.payableBalance)})`],
      confirmPhrase: 'DELETE',
      isPermanent: false,
      actionButtonLabel: 'Confirm Delete',
      actionButtonLabelBn: 'ডিলিট নিশ্চিত করুন',
      onExecute: async () => {
        await onDeleteSupplier(s.id, s.name);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(s.id);
          return next;
        });
      },
    });
  };

  const requestDeleteSingleStaff = (st: StaffMember) => {
    setProtectionTarget({
      title: 'Delete Staff Member',
      titleBn: 'স্টাফ সদস্য মুছুন',
      description:
        'This staff record will be removed from active payroll and moved to the Recycle Bin.',
      descriptionBn:
        'এই স্টাফের তথ্য সক্রিয় তালিকা থেকে সরে রিসাইকেল বিনে চলে যাবে।',
      itemCount: 1,
      previewItems: [`${st.name} (${st.role})`],
      confirmPhrase: 'DELETE',
      isPermanent: false,
      actionButtonLabel: 'Confirm Delete',
      actionButtonLabelBn: 'ডিলিট নিশ্চিত করুন',
      onExecute: async () => {
        await onDeleteStaff(st);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(st.id);
          return next;
        });
      },
    });
  };

  // Protected Bulk Delete Trigger
  const requestBulkDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (activeTab === 'TRANSACTIONS') {
      const targets = transactions.filter((t) => selectedIds.has(t.id));
      if (targets.length === 0) return;
      setProtectionTarget({
        title: `Bulk Delete ${targets.length} Transactions`,
        titleBn: `${toBengaliDigits(targets.length, language)} টি লেনদেন একসাথে মুছুন`,
        description:
          'All selected transactions will be deleted and moved to the Recycle Bin.',
        descriptionBn:
          'নির্বাচিত সব লেনদেন মুছে রিসাইকেল বিনে পাঠানো হবে।',
        itemCount: targets.length,
        previewItems: targets.map((t) => `${t.title} — ৳${formatMoney(t.amount)}`),
        confirmPhrase: 'DELETE',
        isPermanent: false,
        actionButtonLabel: `Delete ${targets.length} Transactions`,
        actionButtonLabelBn: `${toBengaliDigits(targets.length, language)} টি লেনদেন মুছুন`,
        onExecute: async () => {
          for (const tx of targets) {
            await onDeleteTransaction(tx);
          }
          setSelectedIds(new Set());
        },
      });
      return;
    }

    if (activeTab === 'PRODUCTS') {
      const targets = products.filter((p) => selectedIds.has(p.id));
      if (targets.length === 0) return;
      setProtectionTarget({
        title: `Bulk Delete ${targets.length} Products`,
        titleBn: `${toBengaliDigits(targets.length, language)} টি পণ্য একসাথে মুছুন`,
        description:
          'All selected products will be removed from inventory and moved to the Recycle Bin.',
        descriptionBn:
          'নির্বাচিত সব পণ্য ইনভেন্টরি থেকে সরে রিসাইকেল বিনে চলে যাবে।',
        itemCount: targets.length,
        previewItems: targets.map((p) => `${p.name} (${p.stock} ${p.unit})`),
        confirmPhrase: 'DELETE',
        isPermanent: false,
        actionButtonLabel: `Delete ${targets.length} Products`,
        actionButtonLabelBn: `${toBengaliDigits(targets.length, language)} টি পণ্য মুছুন`,
        onExecute: async () => {
          for (const p of targets) {
            await onDeleteProduct(p.id, p.name);
          }
          setSelectedIds(new Set());
        },
      });
      return;
    }

    if (activeTab === 'CUSTOMERS') {
      const targets = customers.filter((c) => selectedIds.has(c.id));
      if (targets.length === 0) return;
      setProtectionTarget({
        title: `Bulk Delete ${targets.length} Customers`,
        titleBn: `${toBengaliDigits(targets.length, language)} জন কাস্টমার একসাথে মুছুন`,
        description:
          'All selected customers will be moved to the Recycle Bin.',
        descriptionBn:
          'নির্বাচিত সব কাস্টমার রিসাইকেল বিনে সরিয়ে নেওয়া হবে।',
        itemCount: targets.length,
        previewItems: targets.map((c) => `${c.name} (Due: ৳${formatMoney(c.totalDue)})`),
        confirmPhrase: 'DELETE',
        isPermanent: false,
        actionButtonLabel: `Delete ${targets.length} Customers`,
        actionButtonLabelBn: `${toBengaliDigits(targets.length, language)} জন কাস্টমার মুছুন`,
        onExecute: async () => {
          for (const c of targets) {
            await onDeleteCustomer(c.id, c.name);
          }
          setSelectedIds(new Set());
        },
      });
      return;
    }

    if (activeTab === 'SUPPLIERS') {
      const targets = suppliers.filter((s) => selectedIds.has(s.id));
      if (targets.length === 0) return;
      setProtectionTarget({
        title: `Bulk Delete ${targets.length} Suppliers`,
        titleBn: `${toBengaliDigits(targets.length, language)} জন সাপ্লায়ার মুছুন`,
        description:
          'All selected suppliers will be moved to the Recycle Bin.',
        descriptionBn:
          'নির্বাচিত সব সাপ্লায়ার রিসাইকেল বিনে সরিয়ে নেওয়া হবে।',
        itemCount: targets.length,
        previewItems: targets.map((s) => `${s.name} (৳${formatMoney(s.payableBalance)})`),
        confirmPhrase: 'DELETE',
        isPermanent: false,
        actionButtonLabel: `Delete ${targets.length} Suppliers`,
        actionButtonLabelBn: `${toBengaliDigits(targets.length, language)} জন সাপ্লায়ার মুছুন`,
        onExecute: async () => {
          for (const s of targets) {
            await onDeleteSupplier(s.id, s.name);
          }
          setSelectedIds(new Set());
        },
      });
      return;
    }

    const targets = staffList.filter((st) => selectedIds.has(st.id));
    if (targets.length === 0) return;
    setProtectionTarget({
      title: `Bulk Delete ${targets.length} Staff Members`,
      titleBn: `${toBengaliDigits(targets.length, language)} জন স্টাফ মুছুন`,
      description:
        'All selected staff profiles will be moved to the Recycle Bin.',
      descriptionBn:
        'নির্বাচিত সব স্টাফ রিসাইকেল বিনে সরিয়ে নেওয়া হবে।',
      itemCount: targets.length,
      previewItems: targets.map((st) => `${st.name} (${st.role})`),
      confirmPhrase: 'DELETE',
      isPermanent: false,
      actionButtonLabel: `Delete ${targets.length} Staff`,
      actionButtonLabelBn: `${toBengaliDigits(targets.length, language)} জন স্টাফ মুছুন`,
      onExecute: async () => {
        for (const st of targets) {
          await onDeleteStaff(st);
        }
        setSelectedIds(new Set());
      },
    });
  };

  // Protected Full Store Reset Trigger (5-Layer Protection with RESET STORE phrase)
  const requestResetAllStoreData = () => {
    setProtectionTarget({
      title: 'Reset All Active Store Data',
      titleBn: 'দোকানের সব সক্রিয় ডাটা রিসেট করুন',
      description:
        'Every active product, customer, supplier, staff member, and transaction will be wiped from active store ledgers and moved into the Recycle Bin.',
      descriptionBn:
        'দোকানের সব সক্রিয় পণ্য, কাস্টমার, সাপ্লায়ার, স্টাফ ও লেনদেন মুছে রিসাইকেল বিনে সরানো হবে।',
      itemCount: totalActiveRecords,
      previewItems: [
        `${isBn ? 'লেনদেন' : 'Transactions'}: ${transactions.length}`,
        `${isBn ? 'পণ্য' : 'Products'}: ${products.length}`,
        `${isBn ? 'কাস্টমার' : 'Customers'}: ${customers.length}`,
        `${isBn ? 'সাপ্লায়ার ও স্টাফ' : 'Suppliers & Staff'}: ${suppliers.length + staffList.length}`,
      ],
      confirmPhrase: 'RESET STORE',
      isPermanent: false,
      actionButtonLabel: 'Reset All Store Data',
      actionButtonLabelBn: 'সব ডাটা রিসেট করুন',
      onExecute: async () => {
        await onResetAllStoreData();
        setSelectedIds(new Set());
      },
    });
  };

  const tabs: Array<{
    key: ModuleTab;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      key: 'TRANSACTIONS',
      label: isBn ? 'লেনদেন' : 'Transactions',
      count: transactions.length,
      icon: ShoppingBag,
    },
    {
      key: 'PRODUCTS',
      label: isBn ? 'পণ্য' : 'Products',
      count: products.length,
      icon: Package,
    },
    {
      key: 'CUSTOMERS',
      label: isBn ? 'কাস্টমার' : 'Customers',
      count: customers.length,
      icon: Users,
    },
    {
      key: 'SUPPLIERS',
      label: isBn ? 'সাপ্লায়ার' : 'Suppliers',
      count: suppliers.length,
      icon: Truck,
    },
    {
      key: 'STAFF',
      label: isBn ? 'স্টাফ' : 'Staff',
      count: staffList.length,
      icon: UserCheck,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-24 space-y-3.5">
      {/* Compact Decorated Security Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-red-950 to-rose-900 px-3.5 py-3 text-white shadow-sm border border-red-400/20 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
                <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0" />
                <h1 className="text-sm sm:text-base font-black tracking-tight truncate">
                  {strings.menuDeleteTransactions}
                </h1>
              </div>
              <p className="text-[11px] text-rose-100/85 truncate">
                {isBn
                  ? '৭-স্তরের সুরক্ষাসহ ফিল্টার, বাল্ক ডিলিট ও স্টোর রিসেট'
                  : '7-layer protected filter, bulk deletion & store reset center'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={downloadStoreSafetyBackup}
              className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-emerald-500/90 hover:bg-emerald-600 border border-emerald-300/40 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isBn ? 'ব্যাকআপ' : 'Backup'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenRecycleBin}
              className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isBn ? 'রিসাইকেল বিন' : 'Recycle Bin'}</span>
            </button>
          </div>
        </div>

        {/* Compact Minimal Active Records Summary Strip */}
        <div className="grid grid-cols-5 divide-x divide-white/15 rounded-xl bg-white/10 border border-white/15 py-1.5 px-1 text-center text-[10px] sm:text-[11px]">
          <div className="px-1 truncate">
            <span className="text-rose-200">{isBn ? 'লেনদেন' : 'Tx'}</span>{' '}
            <strong className="font-black tabular-nums">
              {toBengaliDigits(transactions.length, language)}
            </strong>
          </div>
          <div className="px-1 truncate">
            <span className="text-rose-200">{isBn ? 'পণ্য' : 'Items'}</span>{' '}
            <strong className="font-black tabular-nums">
              {toBengaliDigits(products.length, language)}
            </strong>
          </div>
          <div className="px-1 truncate">
            <span className="text-rose-200">{isBn ? 'কাস্টমার' : 'Cust'}</span>{' '}
            <strong className="font-black tabular-nums">
              {toBengaliDigits(customers.length, language)}
            </strong>
          </div>
          <div className="px-1 truncate">
            <span className="text-rose-200">{isBn ? 'সাপ্লা.' : 'Supp'}</span>{' '}
            <strong className="font-black tabular-nums">
              {toBengaliDigits(suppliers.length, language)}
            </strong>
          </div>
          <div className="px-1 truncate">
            <span className="text-rose-200">{isBn ? 'স্টাফ' : 'Staff'}</span>{' '}
            <strong className="font-black tabular-nums">
              {toBengaliDigits(staffList.length, language)}
            </strong>
          </div>
        </div>
      </div>

      {/* Module Switcher & Smart Filters Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3.5 shadow-xs space-y-3">
        {/* Module Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchTab(tab.key)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-red-600 text-white border-red-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-black tabular-nums ${
                    active ? 'text-red-100' : 'text-slate-400'
                  }`}
                >
                  ({toBengaliDigits(tab.count, language)})
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Context Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div
            className={`relative ${
              activeTab === 'TRANSACTIONS' ? 'sm:col-span-6' : 'sm:col-span-8'
            }`}
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isBn
                  ? 'নাম, বিবরণ, মোবাইল বা ক্যাটাগরি দিয়ে খুঁজুন...'
                  : 'Search name, details, phone, or category...'
              }
              className="w-full min-h-[40px] pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {activeTab === 'TRANSACTIONS' ? (
            <>
              <div className="sm:col-span-3 relative">
                <Filter className="w-3.5 h-3.5 text-red-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                  className="w-full min-h-[40px] pl-8 pr-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="ALL">{isBn ? 'সব ধরন' : 'All Types'}</option>
                  <option value="SALE">{isBn ? 'বিক্রি (SALE)' : 'Sale'}</option>
                  <option value="PURCHASE">{isBn ? 'কেনা (PURCHASE)' : 'Purchase'}</option>
                  <option value="EXPENSE">{isBn ? 'খরচ (EXPENSE)' : 'Expense'}</option>
                  <option value="GIVE_DUE">{isBn ? 'বাকি (GIVE_DUE)' : 'Give Due'}</option>
                  <option value="RECEIVE_PAYMENT">{isBn ? 'জমা (RECEIVE)' : 'Payment In'}</option>
                  <option value="SUPPLIER_PAYMENT">{isBn ? 'মহাজন পরিশোধ' : 'Supplier Pay'}</option>
                </select>
              </div>
              <div className="sm:col-span-3 relative">
                <Calendar className="w-3.5 h-3.5 text-red-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                  className="w-full min-h-[40px] pl-8 pr-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="ALL">{isBn ? 'সব সময়' : 'All Time'}</option>
                  <option value="TODAY">{isBn ? 'আজ' : 'Today'}</option>
                  <option value="WEEK">{isBn ? 'গত ৭ দিন' : 'Last 7 Days'}</option>
                  <option value="MONTH">{isBn ? 'গত ৩০ দিন' : 'Last 30 Days'}</option>
                  <option value="OLDER_30">
                    {isBn ? '৩০ দিনের পুরানো' : 'Older than 30d'}
                  </option>
                </select>
              </div>
            </>
          ) : (
            <div className="sm:col-span-4 relative">
              <Filter className="w-3.5 h-3.5 text-red-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={subFilter}
                onChange={(e) => setSubFilter(e.target.value)}
                className="w-full min-h-[40px] pl-8 pr-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-red-500 cursor-pointer"
              >
                <option value="ALL">{isBn ? 'সব রেকর্ড' : 'All Records'}</option>
                {activeTab === 'PRODUCTS' && (
                  <>
                    <option value="ZERO_STOCK">
                      {isBn ? 'শূন্য স্টক (০)' : 'Zero Stock Only'}
                    </option>
                    <option value="LOW_STOCK">
                      {isBn ? 'কম স্টক' : 'Low Stock'}
                    </option>
                  </>
                )}
                {activeTab === 'CUSTOMERS' && (
                  <>
                    <option value="ZERO_DUE">
                      {isBn ? 'বাকি নেই (৳০)' : 'Zero Due Only'}
                    </option>
                    <option value="HAS_DUE">
                      {isBn ? 'বাকি আছে' : 'Has Due'}
                    </option>
                  </>
                )}
                {activeTab === 'SUPPLIERS' && (
                  <>
                    <option value="ZERO_PAYABLE">
                      {isBn ? 'পাওনা নেই (৳০)' : 'Zero Payable Only'}
                    </option>
                    <option value="HAS_PAYABLE">
                      {isBn ? 'পাওনা বাকি আছে' : 'Has Payable'}
                    </option>
                  </>
                )}
                {activeTab === 'STAFF' && (
                  <>
                    <option value="INACTIVE">
                      {isBn ? 'নিষ্ক্রিয় স্টাফ' : 'Inactive Staff'}
                    </option>
                    <option value="ACTIVE">
                      {isBn ? 'সক্রিয় স্টাফ' : 'Active Staff'}
                    </option>
                  </>
                )}
              </select>
            </div>
          )}
        </div>

        {/* Select All / Filtered Counter */}
        {currentFilteredIds.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="min-h-[34px] px-2.5 py-1 rounded-xl hover:bg-red-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-red-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {allSelected
                  ? isBn
                    ? 'সব নির্বাচন বাতিল করুন'
                    : 'Deselect All'
                  : isBn
                    ? `সব নির্বাচন করুন (${toBengaliDigits(currentFilteredIds.length, language)})`
                    : `Select All Filtered (${currentFilteredIds.length})`}
              </span>
            </button>

            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
              {isBn
                ? `ফিল্টার ফলাফল: ${toBengaliDigits(currentFilteredIds.length, language)} টি`
                : `${currentFilteredIds.length} record${currentFilteredIds.length > 1 ? 's' : ''} matched`}
            </span>
          </div>
        )}
      </div>

      {/* Multi-Select Protected Bulk Delete Bar */}
      {selectedIds.size > 0 && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/50 border-2 border-red-400/60 p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-black text-xs tabular-nums flex items-center justify-center">
              {toBengaliDigits(selectedIds.size, language)}
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                {isBn
                  ? `${toBengaliDigits(selectedIds.size, language)} টি রেকর্ড নির্বাচিত`
                  : `${selectedIds.size} record${selectedIds.size > 1 ? 's' : ''} selected`}
              </p>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
              >
                {isBn ? 'নির্বাচন মুছুন' : 'Clear selection'}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={requestBulkDeleteSelected}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>
              {isBn
                ? `নির্বাচিত মুছুন (${toBengaliDigits(selectedIds.size, language)})`
                : `Delete Selected (${selectedIds.size})`}
            </span>
          </button>
        </div>
      )}

      {/* Records List Container */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        {currentFilteredIds.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#00965E] mx-auto" />
            <p className="text-sm font-extrabold text-slate-800 dark:text-white">
              {isBn ? 'কোনো রেকর্ড পাওয়া যায়নি' : 'No Records Found'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isBn
                ? 'এই ক্যাটাগরিতে বা ফিল্টারে মুছে ফেলার মতো কোনো ডাটা নেই।'
                : 'There are no records matching your current filter in this category.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[480px] overflow-y-auto">
            {activeTab === 'TRANSACTIONS' &&
              filteredTransactions.map((tx) => {
                const isSelected = selectedIds.has(tx.id);
                return (
                  <div
                    key={tx.id}
                    className={`p-3 flex items-center justify-between gap-2.5 transition-colors ${
                      isSelected
                        ? 'bg-red-50/60 dark:bg-red-950/25'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelect(tx.id)}
                        className="mt-0.5 p-1 -ml-1 rounded-lg cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-red-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          <span className="text-red-600 dark:text-red-400">
                            {tx.type}
                          </span>
                          <span>·</span>
                          <span>{formatTimestamp(tx.createdAt)}</span>
                        </div>
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {tx.title}
                        </p>
                        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                          ৳{toBengaliDigits(formatMoney(tx.amount), language)}
                          {tx.customerName ? ` · ${tx.customerName}` : ''}
                          {tx.supplierName ? ` · ${tx.supplierName}` : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => requestDeleteSingleTransaction(tx)}
                      aria-label={isBn ? 'মুছে ফেলুন' : 'Delete transaction'}
                      className="min-w-[38px] min-h-[38px] rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

            {activeTab === 'PRODUCTS' &&
              filteredProducts.map((p) => {
                const isSelected = selectedIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={`p-3 flex items-center justify-between gap-2.5 transition-colors ${
                      isSelected
                        ? 'bg-red-50/60 dark:bg-red-950/25'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelect(p.id)}
                        className="mt-0.5 p-1 -ml-1 rounded-lg cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-red-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          {p.category || (isBn ? 'সাধারণ' : 'General')} ·{' '}
                          {isBn ? 'স্টক' : 'Stock'}:{' '}
                          {toBengaliDigits(p.stock, language)} {p.unit} · ৳
                          {toBengaliDigits(formatMoney(p.sellPrice), language)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => requestDeleteSingleProduct(p)}
                      aria-label={isBn ? 'পণ্য মুছুন' : 'Delete product'}
                      className="min-w-[38px] min-h-[38px] rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

            {activeTab === 'CUSTOMERS' &&
              filteredCustomers.map((c) => {
                const isSelected = selectedIds.has(c.id);
                return (
                  <div
                    key={c.id}
                    className={`p-3 flex items-center justify-between gap-2.5 transition-colors ${
                      isSelected
                        ? 'bg-red-50/60 dark:bg-red-950/25'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelect(c.id)}
                        className="mt-0.5 p-1 -ml-1 rounded-lg cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-red-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {c.name}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          {c.phone || (isBn ? 'ফোন নেই' : 'No phone')} ·{' '}
                          {isBn ? 'বাকি' : 'Due'}: ৳
                          {toBengaliDigits(formatMoney(c.totalDue), language)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => requestDeleteSingleCustomer(c)}
                      aria-label={isBn ? 'কাস্টমার মুছুন' : 'Delete customer'}
                      className="min-w-[38px] min-h-[38px] rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

            {activeTab === 'SUPPLIERS' &&
              filteredSuppliers.map((s) => {
                const isSelected = selectedIds.has(s.id);
                return (
                  <div
                    key={s.id}
                    className={`p-3 flex items-center justify-between gap-2.5 transition-colors ${
                      isSelected
                        ? 'bg-red-50/60 dark:bg-red-950/25'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelect(s.id)}
                        className="mt-0.5 p-1 -ml-1 rounded-lg cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-red-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {s.name}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          {s.company || s.phone || (isBn ? 'সাপ্লায়ার' : 'Supplier')} ·{' '}
                          {isBn ? 'পাওনা' : 'Payable'}: ৳
                          {toBengaliDigits(formatMoney(s.payableBalance), language)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => requestDeleteSingleSupplier(s)}
                      aria-label={isBn ? 'সাপ্লায়ার মুছুন' : 'Delete supplier'}
                      className="min-w-[38px] min-h-[38px] rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

            {activeTab === 'STAFF' &&
              filteredStaff.map((st) => {
                const isSelected = selectedIds.has(st.id);
                return (
                  <div
                    key={st.id}
                    className={`p-3 flex items-center justify-between gap-2.5 transition-colors ${
                      isSelected
                        ? 'bg-red-50/60 dark:bg-red-950/25'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelect(st.id)}
                        className="mt-0.5 p-1 -ml-1 rounded-lg cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-red-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {st.name}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          {st.role} · {st.active ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'নিষ্ক্রিয়' : 'Inactive')} · ৳
                          {toBengaliDigits(formatMoney(st.salary), language)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => requestDeleteSingleStaff(st)}
                      aria-label={isBn ? 'স্টাফ মুছুন' : 'Delete staff'}
                      className="min-w-[38px] min-h-[38px] rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Decorated Danger Zone Card: Full Store Reset */}
      <div className="rounded-2xl bg-red-50/80 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-900/70 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-red-700 dark:text-red-300">
              {strings.menuResetAll}
            </h3>
            <p className="text-xs text-red-700/85 dark:text-red-200/80 mt-0.5 leading-relaxed">
              {strings.menuResetAllSub} ({toBengaliDigits(totalActiveRecords, language)}{' '}
              {isBn ? 'টি সক্রিয় রেকর্ড' : 'active records'})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={downloadStoreSafetyBackup}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-[#008A54] dark:text-emerald-400 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isBn ? 'ব্যাকআপ ডাউনলোড' : 'Download Backup First'}</span>
          </button>
          <button
            type="button"
            disabled={totalActiveRecords === 0}
            onClick={requestResetAllStoreData}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>
              {isBn ? 'সব সক্রিয় ডাটা রিসেট করুন' : 'Reset All Active Store Data'}
            </span>
          </button>
        </div>
      </div>

      {/* 5-Layer Deletion Protection Modal */}
      <DeletionProtectionModal
        target={protectionTarget}
        onClose={() => setProtectionTarget(null)}
        language={language}
        onDownloadSafetyBackup={downloadStoreSafetyBackup}
      />
    </div>
  );
};
