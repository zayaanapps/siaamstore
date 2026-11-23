import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  PackagePlus,
  Truck,
  Receipt,
  Wallet,
  BarChart3,
  AlertTriangle,
  Cloud,
  Trash2,
  RotateCcw,
  Users,
  UserCheck,
  History,
  Globe,
  Moon,
  Sun,
  Store,
  Code2,
  BookOpen,
  Power,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AppLanguage,
  Product,
  Customer,
  StoreTransaction,
  Supplier,
  StaffMember,
  StoreSettings,
  AuditLog,
  RecycleBinItem,
  DailyStats,
  CartItem,
  VaultRole,
  MoreSubScreen,
  formatMoney,
  toBengaliDigits,
  formatTimestamp,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';
import { vaultAccessService } from '../services/vaultAccessService';
import { AdminAccessControlPanel } from './AdminAccessControlPanel';
import { PurchaseStockInView } from './PurchaseStockInView';
import { SupplierLedgerView } from './SupplierLedgerView';
import { ShopExpensesView } from './ShopExpensesView';
import { CashBookView } from './CashBookView';
import { BusinessReportsView } from './BusinessReportsView';
import { DueReportsView } from './DueReportsView';
import { StaffRolesView } from './StaffRolesView';
import { AuditLogView } from './AuditLogView';
import { RecycleBinView } from './RecycleBinView';
import { DataDeletionCenterView } from './DataDeletionCenterView';
import {
  StoreProfileModal,
  DeveloperProfileModal,
} from './ProfileAboutModals';

interface MoreManagementViewProps {
  stats: DailyStats;
  products: Product[];
  customers: Customer[];
  transactions: StoreTransaction[];
  suppliers: Supplier[];
  staffList: StaffMember[];
  auditLogs: AuditLog[];
  recycleBinItems: RecycleBinItem[];
  startingCashBalance: number;
  storeSettings?: StoreSettings | null;
  onUpdateStoreSettings?: (
    patch: Partial<Omit<StoreSettings, 'userId' | 'updatedAt'>>
  ) => Promise<void> | void;
  onUpdateStartingCash: (amount: number) => void;
  strings: DokanTranslations;
  language: AppLanguage;
  isDarkMode: boolean;
  onToggleLanguage: () => void;
  onToggleDarkMode: () => void;
  onRecordExpense: (
    title: string,
    category: string,
    amount: number,
    notes?: string
  ) => Promise<void>;
  onRecordMultiItemPurchase: (params: {
    cartItems: CartItem[];
    paidAmount: number;
    selectedSupplier: Supplier | null;
    newSupplierName: string;
    updateBuyingPrice: boolean;
    notes: string;
  }) => Promise<void>;
  onVoidPurchase: (purchaseTx: StoreTransaction) => Promise<void>;
  onDeleteTransaction: (tx: StoreTransaction) => Promise<void>;
  onDeleteProduct: (productId: string, productName: string) => Promise<void>;
  onDeleteCustomer: (customerId: string, customerName: string) => Promise<void>;
  onResetAllStoreData: () => Promise<void>;
  onRestoreFromRecycleBin: (item: RecycleBinItem) => Promise<void>;
  onPermanentlyDeleteRecycleBinItem: (itemId: string) => Promise<void>;
  onEmptyRecycleBin: () => Promise<void>;
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
  onAddStaff: (params: {
    name: string;
    phone: string;
    role: string;
    salary: number;
  }) => Promise<void>;
  onUpdateStaff: (
    staff: StaffMember,
    params: {
      name: string;
      role: string;
      phone: string;
      salary: number;
      active: boolean;
    }
  ) => Promise<void>;
  onToggleStaffActive: (staff: StaffMember) => Promise<void>;
  onDeleteStaff: (staff: StaffMember) => Promise<void>;
  onSignOut: () => void;
}

export const MoreManagementView: React.FC<MoreManagementViewProps> = ({
  stats,
  products,
  customers,
  transactions,
  suppliers,
  staffList,
  auditLogs,
  recycleBinItems,
  startingCashBalance,
  storeSettings,
  onUpdateStoreSettings,
  onUpdateStartingCash,
  strings,
  language,
  isDarkMode,
  onToggleLanguage,
  onToggleDarkMode,
  onRecordExpense,
  onRecordMultiItemPurchase,
  onVoidPurchase,
  onDeleteTransaction,
  onDeleteProduct,
  onDeleteCustomer,
  onResetAllStoreData,
  onRestoreFromRecycleBin,
  onPermanentlyDeleteRecycleBinItem,
  onEmptyRecycleBin,
  onAddSupplier,
  onUpdateSupplier,
  onRecordSupplierPayment,
  onAddSupplierCreditOwed,
  onDeleteSupplier,
  onAddStaff,
  onUpdateStaff,
  onToggleStaffActive,
  onDeleteStaff,
  onSignOut,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const [subScreen, setSubScreen] = useState<MoreSubScreen>(MoreSubScreen.MENU);
  const currentUser = vaultAccessService.getActiveSession();
  const isAdmin = currentUser?.role === VaultRole.ADMIN;

  // Modals on Main Menu
  const [showStoreProfileModal, setShowStoreProfileModal] = useState(false);
  const [showDeveloperModal, setShowDeveloperModal] = useState(false);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [adminRestrictedNotice, setAdminRestrictedNotice] = useState(false);

  // Supplier -> Purchase quick handoff
  const [preselectedPurchaseSupplierId, setPreselectedPurchaseSupplierId] =
    useState('');

  const totalSupplierPayables = suppliers.reduce(
    (acc, s) => acc + Math.max(0, s.payableBalance),
    0
  );
  const totalCustomerDues = customers.reduce(
    (acc, c) => acc + Math.max(0, c.totalDue),
    0
  );

  const changeSubScreen = (next: MoreSubScreen) => {
    setSubScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openSubScreen = (target: MoreSubScreen) => {
    if (!isAdmin) {
      setAdminRestrictedNotice(true);
      return;
    }
    if (target === MoreSubScreen.PURCHASE_TRACKER) {
      setPreselectedPurchaseSupplierId('');
    }
    changeSubScreen(target);
  };

  const renderBackHeader = (title: string, subtitle?: string) => (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs">
      <div>
        <button
          type="button"
          onClick={() => changeSubScreen(MoreSubScreen.MENU)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 text-xs font-bold text-[#00965E] hover:border-[#00965E] mb-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isBengali ? 'টুলস মেনুতে ফিরুন' : 'Back to Tools'}</span>
        </button>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  const renderActiveSubScreen = () => {
    // 1. PURCHASE TRACKER (STOCK IN)
    if (subScreen === MoreSubScreen.PURCHASE_TRACKER) {
      return (
        <PurchaseStockInView
          key={preselectedPurchaseSupplierId || 'default-purchase'}
          products={products}
          suppliers={suppliers}
          transactions={transactions}
          strings={strings}
          language={language}
          initialSupplierId={preselectedPurchaseSupplierId}
          onBack={() => {
            setPreselectedPurchaseSupplierId('');
            changeSubScreen(MoreSubScreen.MENU);
          }}
          onOpenSuppliers={() => {
            setPreselectedPurchaseSupplierId('');
            changeSubScreen(MoreSubScreen.SUPPLIER_LEDGER);
          }}
          onRecordMultiItemPurchase={onRecordMultiItemPurchase}
          onVoidPurchase={onVoidPurchase}
        />
      );
    }

    // 2. SUPPLIER LEDGER
    if (subScreen === MoreSubScreen.SUPPLIER_LEDGER) {
      return (
        <SupplierLedgerView
          suppliers={suppliers}
          transactions={transactions}
          strings={strings}
          language={language}
          onBack={() => changeSubScreen(MoreSubScreen.MENU)}
          onStartPurchaseForSupplier={(supplierId) => {
            setPreselectedPurchaseSupplierId(supplierId);
            changeSubScreen(MoreSubScreen.PURCHASE_TRACKER);
          }}
          onAddSupplier={onAddSupplier}
          onUpdateSupplier={onUpdateSupplier}
          onRecordSupplierPayment={onRecordSupplierPayment}
          onAddSupplierCreditOwed={onAddSupplierCreditOwed}
          onDeleteSupplier={onDeleteSupplier}
          onDeleteTransaction={onDeleteTransaction}
        />
      );
    }

    // 3. EXPENSE TRACKING (SHOP EXPENSES)
    if (subScreen === MoreSubScreen.EXPENSE_TRACKING) {
      return (
        <ShopExpensesView
          transactions={transactions}
          strings={strings}
          language={language}
          cloudCategories={storeSettings?.expenseCategories}
          cloudPresets={storeSettings?.expensePresets}
          onSyncExpenseSettings={
            onUpdateStoreSettings
              ? (data) => onUpdateStoreSettings(data)
              : undefined
          }
          onBack={() => changeSubScreen(MoreSubScreen.MENU)}
          onOpenCashBook={() => changeSubScreen(MoreSubScreen.CASH_BOOK)}
          onRecordExpense={onRecordExpense}
          onDeleteTransaction={onDeleteTransaction}
        />
      );
    }

    // 4. CASH BOOK
    if (subScreen === MoreSubScreen.CASH_BOOK) {
      return (
        <CashBookView
          stats={stats}
          transactions={transactions}
          startingCashBalance={startingCashBalance}
          onUpdateStartingCash={onUpdateStartingCash}
          onRecordExpense={onRecordExpense}
          onOpenExpenses={() => changeSubScreen(MoreSubScreen.EXPENSE_TRACKING)}
          strings={strings}
          language={language}
          onBack={() => changeSubScreen(MoreSubScreen.MENU)}
        />
      );
    }

    // 5. BUSINESS REPORTS
    if (subScreen === MoreSubScreen.BUSINESS_REPORTS) {
      return (
        <BusinessReportsView
          stats={stats}
          products={products}
          customers={customers}
          suppliers={suppliers}
          transactions={transactions}
          startingCashBalance={startingCashBalance}
          strings={strings}
          language={language}
          onBack={() => changeSubScreen(MoreSubScreen.MENU)}
          onOpenDueReports={() => changeSubScreen(MoreSubScreen.DUE_REPORTS)}
        />
      );
    }

    // 6. DUE REPORTS
    if (subScreen === MoreSubScreen.DUE_REPORTS) {
      return (
        <DueReportsView
          customers={customers}
          suppliers={suppliers}
          transactions={transactions}
          strings={strings}
          language={language}
          onBack={() => changeSubScreen(MoreSubScreen.MENU)}
          onOpenBusinessReports={() =>
            changeSubScreen(MoreSubScreen.BUSINESS_REPORTS)
          }
          onOpenSuppliers={() => changeSubScreen(MoreSubScreen.SUPPLIER_LEDGER)}
        />
      );
    }

    // 8. DATA & TRANSACTION DELETION
    if (subScreen === MoreSubScreen.TRANSACTION_DELETION) {
      return (
        <DataDeletionCenterView
          products={products}
          customers={customers}
          transactions={transactions}
          suppliers={suppliers}
          staffList={staffList}
          strings={strings}
          language={language}
          onBack={() => changeSubScreen(MoreSubScreen.MENU)}
          onOpenRecycleBin={() => changeSubScreen(MoreSubScreen.RECYCLE_BIN)}
          onDeleteTransaction={onDeleteTransaction}
          onDeleteProduct={onDeleteProduct}
          onDeleteCustomer={onDeleteCustomer}
          onDeleteSupplier={onDeleteSupplier}
          onDeleteStaff={onDeleteStaff}
          onResetAllStoreData={onResetAllStoreData}
        />
      );
    }

    // 9. RECYCLE BIN
    if (subScreen === MoreSubScreen.RECYCLE_BIN) {
      return (
        <RecycleBinView
          recycleBinItems={recycleBinItems}
          strings={strings}
          language={language}
          onBack={() => changeSubScreen(MoreSubScreen.MENU)}
          onRestoreFromRecycleBin={onRestoreFromRecycleBin}
          onPermanentlyDeleteRecycleBinItem={onPermanentlyDeleteRecycleBinItem}
          onEmptyRecycleBin={onEmptyRecycleBin}
        />
      );
    }

    // 10. USER MANAGEMENT
    if (subScreen === MoreSubScreen.USER_MANAGEMENT) {
      return (
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3">
          <AdminAccessControlPanel
            isBengali={isBengali}
            onBack={() => changeSubScreen(MoreSubScreen.MENU)}
            headerTitle={strings.menuUserMgmt}
          />
        </div>
      );
    }

    // 11. STAFF ROLES
    if (subScreen === MoreSubScreen.STAFF_ROLES) {
      return (
        <StaffRolesView
          staffList={staffList}
          transactions={transactions}
          strings={strings}
          language={language}
          onBack={() => changeSubScreen(MoreSubScreen.MENU)}
          onAddStaff={onAddStaff}
          onUpdateStaff={onUpdateStaff}
          onToggleStaffActive={onToggleStaffActive}
          onDeleteStaff={onDeleteStaff}
          onRecordExpense={onRecordExpense}
        />
      );
    }

    // 12. AUDIT LOG
    if (subScreen === MoreSubScreen.AUDIT_LOG) {
      return (
        <AuditLogView
          auditLogs={auditLogs}
          strings={strings}
          language={language}
          onBack={() => changeSubScreen(MoreSubScreen.MENU)}
        />
      );
    }

    return null;
  };

  if (subScreen !== MoreSubScreen.MENU) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={subScreen}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          transformTemplate={(_, generated) =>
            generated === 'none' || generated === 'translateX(0px)'
              ? 'none'
              : generated
          }
        >
          {renderActiveSubScreen()}
        </motion.div>
      </AnimatePresence>
    );
  }

  // MAIN MENU
  const MenuRow: React.FC<{
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    onClick: () => void;
    locked?: boolean;
    badge?: string;
  }> = ({ icon, title, subtitle, onClick, locked, badge }) => (
    <button
      type="button"
      onClick={onClick}
      className="group w-full p-3.5 rounded-2xl bg-white dark:bg-slate-800 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 hover:border-[#00965E] transition-all duration-200 active:scale-[0.985] flex items-center justify-between text-left shadow-2xs cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-slate-700 border border-emerald-200 dark:border-slate-600 text-[#00965E] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
              {title}
            </p>
            {badge && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-extrabold">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {subtitle}
          </p>
        </div>
      </div>
      {locked ? (
        <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
          <Lock className="w-3.5 h-3.5 text-amber-600" />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:translate-x-0.5">
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#00965E]" />
        </div>
      )}
    </button>
  );

  return (
    <motion.div
      key="more-main-menu"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      transformTemplate={(_, generated) =>
        generated === 'none' || generated === 'translateX(0px)'
          ? 'none'
          : generated
      }
      className="max-w-4xl lg:max-w-7xl mx-auto px-4 lg:px-6 pt-4 pb-10 space-y-6"
    >
      <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-2xs">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#00965E]">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {strings.toolsTitle}
          </h1>
          <p className="text-xs font-semibold text-slate-500">
            {strings.appName} • {strings.subtitle}
          </p>
        </div>
      </div>

      {adminRestrictedNotice && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between text-xs font-bold text-amber-900">
          <span>
            {isBengali
              ? 'এই ফিচারটি শুধুমাত্র অ্যাডমিনদের জন্য সংরক্ষিত।'
              : 'Restricted: Only Store Admins can access backend management tools.'}
          </span>
          <button
            type="button"
            onClick={() => setAdminRestrictedNotice(false)}
            className="underline ml-2"
          >
            Close
          </button>
        </div>
      )}

      {/* 1. Store Operations */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 inline-flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5 text-[#00965E]" />
          <span>{strings.secStoreOps}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <MenuRow
            icon={<PackagePlus className="w-5 h-5" />}
            title={strings.menuPurchases}
            subtitle={strings.menuPurchasesSub}
            locked={!isAdmin}
            onClick={() => openSubScreen(MoreSubScreen.PURCHASE_TRACKER)}
          />
          <MenuRow
            icon={<Truck className="w-5 h-5" />}
            title={strings.menuSuppliers}
            subtitle={`${strings.menuSuppliersSub} (৳${toBengaliDigits(
              formatMoney(totalSupplierPayables),
              language
            )})`}
            locked={!isAdmin}
            onClick={() => openSubScreen(MoreSubScreen.SUPPLIER_LEDGER)}
          />
          <MenuRow
            icon={<Receipt className="w-5 h-5" />}
            title={strings.menuExpenses}
            subtitle={strings.menuExpensesSub}
            locked={!isAdmin}
            onClick={() => openSubScreen(MoreSubScreen.EXPENSE_TRACKING)}
          />
          <MenuRow
            icon={<Wallet className="w-5 h-5" />}
            title={strings.menuCashBook}
            subtitle={strings.menuCashBookSub}
            locked={!isAdmin}
            onClick={() => openSubScreen(MoreSubScreen.CASH_BOOK)}
          />
          <MenuRow
            icon={<BarChart3 className="w-5 h-5" />}
            title={strings.menuBusinessReports}
            subtitle={strings.menuBusinessReportsSub}
            locked={!isAdmin}
            onClick={() => openSubScreen(MoreSubScreen.BUSINESS_REPORTS)}
          />
          <MenuRow
            icon={<AlertTriangle className="w-5 h-5" />}
            title={strings.menuDueReports}
            subtitle={strings.menuDueReportsSub}
            locked={!isAdmin}
            onClick={() => openSubScreen(MoreSubScreen.DUE_REPORTS)}
          />
          <MenuRow
            icon={<UserCheck className="w-5 h-5" />}
            title={strings.menuStaff}
            subtitle={`${staffList.length} staff members`}
            locked={!isAdmin}
            onClick={() => openSubScreen(MoreSubScreen.STAFF_ROLES)}
          />
        </div>
      </div>

      {/* 2. Firebase Manager */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 inline-flex items-center gap-1.5">
          <Cloud className="w-3.5 h-3.5 text-[#00965E]" />
          <span>{strings.secDataCloud}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <MenuRow
            icon={<History className="w-5 h-5" />}
            title={strings.menuAuditLog}
            subtitle={`${auditLogs.length} recorded activities`}
            locked={!isAdmin}
            onClick={() => openSubScreen(MoreSubScreen.AUDIT_LOG)}
          />
          <MenuRow
            icon={<Users className="w-5 h-5" />}
            title={strings.menuUserMgmt}
            subtitle={strings.menuUserMgmtSub}
            locked={!isAdmin}
            onClick={() => openSubScreen(MoreSubScreen.USER_MANAGEMENT)}
          />
          <MenuRow
            icon={<RotateCcw className="w-5 h-5" />}
            title={strings.menuRecycleBin}
            subtitle={`${recycleBinItems.length} items in Recycle Bin`}
            locked={!isAdmin}
            onClick={() => openSubScreen(MoreSubScreen.RECYCLE_BIN)}
          />
          <MenuRow
            icon={<Trash2 className="w-5 h-5" />}
            title={strings.menuDeleteTransactions}
            subtitle={strings.menuDeleteTransactionsSub}
            locked={!isAdmin}
            onClick={() => openSubScreen(MoreSubScreen.TRANSACTION_DELETION)}
          />
        </div>
      </div>

      {/* 3. Settings & Appearance */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 inline-flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5 text-[#00965E]" />
          <span>{strings.secAppSettings}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <MenuRow
            icon={<Globe className="w-5 h-5" />}
            title={strings.menuLanguage}
            subtitle={isBengali ? 'বর্তমান: বাংলা' : 'Current: English'}
            onClick={onToggleLanguage}
          />
          <MenuRow
            icon={
              isDarkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )
            }
            title={strings.menuTheme}
            subtitle={isDarkMode ? 'Dark Mode' : 'Light Mode'}
            onClick={onToggleDarkMode}
          />
        </div>
      </div>

      {/* 5. Profile & About App */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 inline-flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-[#00965E]" />
          <span>{strings.secProfileAbout}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <MenuRow
            icon={<Store className="w-5 h-5" />}
            title={strings.menuProfile}
            subtitle={strings.menuProfileSub}
            onClick={() => setShowStoreProfileModal(true)}
          />
          <MenuRow
            icon={<Code2 className="w-5 h-5" />}
            title={strings.menuAboutDev}
            subtitle={strings.menuAboutDevSub}
            onClick={() => setShowDeveloperModal(true)}
          />
        </div>
      </div>

      {/* Minimal Centered Terminate Session Card at Bottom of All Tools Menus */}
      <div className="pt-2">
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-[#CBEAD9] dark:border-slate-700 p-4 sm:p-5 shadow-xs text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-2xl bg-[#E8F8F0] dark:bg-emerald-950/60 border border-[#CBEAD9] dark:border-emerald-800/60 text-[#00965E] dark:text-emerald-400 flex items-center justify-center">
            <Power className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
              {isBengali ? 'সেশন বন্ধ করুন' : 'Terminate Session'}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-xs mx-auto">
              {currentUser?.email ||
                (isBengali ? 'বর্তমান সেশন লক করুন' : 'Lock active session')}
            </p>
          </div>
          <div className="pt-0.5 flex justify-center">
            <button
              type="button"
              onClick={() => setShowTerminateConfirm(true)}
              className="min-h-[42px] px-6 py-2 rounded-xl bg-[#00965E] hover:bg-[#007D4E] text-white text-xs font-extrabold tracking-wide shadow-xs inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
            >
              <Power className="w-4 h-4" />
              <span>{isBengali ? 'Terminate Session' : 'Terminate Session'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Store Profile Modal */}
      <StoreProfileModal
        isOpen={showStoreProfileModal}
        onClose={() => setShowStoreProfileModal(false)}
        language={language}
        strings={strings}
        productCount={products.length}
        customerCount={customers.length}
        supplierCount={suppliers.length}
        activeStaffCount={staffList.filter((s) => s.active).length}
      />

      {/* Developer Info Modal */}
      <DeveloperProfileModal
        isOpen={showDeveloperModal}
        onClose={() => setShowDeveloperModal(false)}
        language={language}
      />

      {/* Terminate Session Confirmation Modal */}
      {showTerminateConfirm &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden"
            onClick={() => setShowTerminateConfirm(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-sm max-h-[calc(100dvh-32px)] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-[#CBEAD9] dark:border-slate-700 p-6 shadow-2xl text-center space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[#E8F8F0] dark:bg-emerald-950/60 border border-[#CBEAD9] dark:border-emerald-800/60 text-[#00965E] dark:text-emerald-400 flex items-center justify-center">
                <Power className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isBengali ? 'সেশন বন্ধ করবেন?' : 'Terminate Session?'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isBengali
                    ? 'বর্তমান সেশন বন্ধ হয়ে যাবে এবং পুনরায় প্রবেশ করতে লগইন করতে হবে।'
                    : 'Your current session will end and you will need to log in again.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowTerminateConfirm(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTerminateConfirm(false);
                    onSignOut();
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#00965E] hover:bg-[#007D4E] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{isBengali ? 'নিশ্চিত করুন' : 'Terminate'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </motion.div>
  );
};
