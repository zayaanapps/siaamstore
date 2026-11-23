import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  ShoppingCart,
  Package,
  Users,
  Wrench,
  Globe,
  Moon,
  Sun,
  LogOut,
  CheckCircle2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthScreen } from './components/AuthScreen';
import { StoreLoadingScreen } from './components/StoreLoadingScreen';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { HomeDashboardView } from './components/HomeDashboardView';
import { SalesPosView } from './components/SalesPosView';
import { ProductsView } from './components/ProductsView';
import { CustomersView } from './components/CustomersView';
import { MoreManagementView } from './components/MoreManagementView';
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
  CartItem,
  MainNavTab,
  VaultUserAccount,
  calculateDailyStats,
  formatMoney,
} from './types/dokan';
import { stringsFor } from './i18n/strings';
import { vaultAccessService } from './services/vaultAccessService';
import { DokanRepository } from './services/dokanRepository';

export function DokanStoreMainApp() {
  const [currentAccount, setCurrentAccount] = useState<VaultUserAccount | null>(
    vaultAccessService.getActiveSession()
  );
  const [isAuthReady, setIsAuthReady] = useState<boolean>(
    vaultAccessService.getIsAuthReady()
  );
  const [isStoreDataReady, setIsStoreDataReady] = useState<boolean>(false);

  // Navigation & UI Preferences
  const [selectedTab, setSelectedTab] = useState<MainNavTab>(MainNavTab.HOME);
  const [tabResetKey, setTabResetKey] = useState<number>(0);

  const handleSelectMainTab = (nextTab: MainNavTab) => {
    if (nextTab === selectedTab) {
      setTabResetKey((k) => k + 1);
    } else {
      setSelectedTab(nextTab);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [language, setLanguage] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem('siaam_store_language');
    return saved === AppLanguage.ENGLISH ? AppLanguage.ENGLISH : AppLanguage.BENGALI;
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('siaam_store_dark_mode');
    return saved === 'true';
  });
  const [startingCashBalance, setStartingCashBalance] = useState<number>(() => {
    const saved = localStorage.getItem('siaam_store_starting_cash');
    return saved ? Number(saved) || 0 : 0;
  });

  // Sync dark mode class with document root and localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('siaam_store_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('siaam_store_language', language);
  }, [language]);

  // Firestore Collections State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<StoreTransaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [recycleBinItems, setRecycleBinItems] = useState<RecycleBinItem[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);

  // POS Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountInput, setDiscountInput] = useState<string>('');

  // Status Banner
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Home Quick Give Credit / Receive Payment Modal
  const [quickModalType, setQuickModalType] = useState<
    'CREDIT' | 'PAYMENT' | null
  >(null);
  const [quickCustId, setQuickCustId] = useState<string>('');
  const [quickNewCustName, setQuickNewCustName] = useState<string>('');
  const [quickNewCustPhone, setQuickNewCustPhone] = useState<string>('');
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [quickNotes, setQuickNotes] = useState<string>('');

  const repoRef = useRef<DokanRepository | null>(null);

  const isBengali = language === AppLanguage.BENGALI;
  const strings = stringsFor(language);

  // Subscribe to Vault Auth Changes
  useEffect(() => {
    return vaultAccessService.subscribe(() => {
      setCurrentAccount(vaultAccessService.getActiveSession());
      setIsAuthReady(vaultAccessService.getIsAuthReady());
    });
  }, []);

  // Start / Stop Firestore Real-Time Listeners when authenticated
  useEffect(() => {
    if (!currentAccount) {
      repoRef.current = null;
      setIsStoreDataReady(false);
      return;
    }

    let cancelled = false;
    let minDwellDone = false;
    let dataSynced = false;
    const loadedCore = new Set<string>();
    const CORE_KEYS = ['products', 'customers', 'transactions', 'settings'];

    setIsStoreDataReady(false);

    const tryFinishLoading = () => {
      if (!cancelled && minDwellDone && dataSynced) {
        setIsStoreDataReady(true);
      }
    };

    const markCoreLoaded = (key: string) => {
      loadedCore.add(key);
      if (CORE_KEYS.every((k) => loadedCore.has(k))) {
        dataSynced = true;
        tryFinishLoading();
      }
    };

    // Smooth minimum dwell (360ms) so the logo loader transitions gracefully
    const minDwellTimer = window.setTimeout(() => {
      minDwellDone = true;
      tryFinishLoading();
    }, 360);

    // Safety fallback (2200ms) so slow/offline connections never get stuck on loader
    const maxWaitTimer = window.setTimeout(() => {
      if (!cancelled) {
        setIsStoreDataReady(true);
      }
    }, 2200);

    const repo = new DokanRepository(currentAccount.email);
    repoRef.current = repo;
    void repo.ensureRiceCatalogProducts();

    const unsubProducts = repo.subscribeProducts((data) => {
      setProducts(data);
      markCoreLoaded('products');
    });
    const unsubCustomers = repo.subscribeCustomers((data) => {
      setCustomers(data);
      markCoreLoaded('customers');
    });
    const unsubTransactions = repo.subscribeTransactions((data) => {
      setTransactions(data);
      markCoreLoaded('transactions');
    });
    const unsubSuppliers = repo.subscribeSuppliers(setSuppliers);
    const unsubStaff = repo.subscribeStaff(setStaffList);
    const unsubAudit = repo.subscribeAuditLogs(setAuditLogs);
    const unsubBin = repo.subscribeRecycleBin(setRecycleBinItems);
    const unsubSettings = repo.subscribeStoreSettings((data) => {
      setStoreSettings(data);
      markCoreLoaded('settings');
    });

    return () => {
      cancelled = true;
      window.clearTimeout(minDwellTimer);
      window.clearTimeout(maxWaitTimer);
      unsubProducts();
      unsubCustomers();
      unsubTransactions();
      unsubSuppliers();
      unsubStaff();
      unsubAudit();
      unsubBin();
      unsubSettings();
    };
  }, [currentAccount?.email]);

  // Sync cloud store_settings (startingCashBalance, language, theme) across devices
  useEffect(() => {
    if (!currentAccount || !storeSettings) return;
    const syncedAmt = Math.max(0, Number(storeSettings.startingCashBalance) || 0);
    setStartingCashBalance((prev) => (prev === syncedAmt ? prev : syncedAmt));
    localStorage.setItem('siaam_store_starting_cash', String(syncedAmt));
    setLanguage((prev) => (prev === storeSettings.language ? prev : storeSettings.language));
    setIsDarkMode((prev) => (prev === storeSettings.isDarkMode ? prev : storeSettings.isDarkMode));
  }, [storeSettings, currentAccount]);

  // Fallback sync Starting Cash Balance from Firestore transactions if store_settings hasn't been created yet
  useEffect(() => {
    if (!currentAccount || storeSettings) return;
    const latestStartingCash = transactions.find(
      (tx) => tx.type === 'STOCK_ADJUST' && tx.category === 'STARTING_CASH'
    );
    if (latestStartingCash) {
      const syncedAmt = Math.max(0, Number(latestStartingCash.amount) || 0);
      setStartingCashBalance((prev) => (prev === syncedAmt ? prev : syncedAmt));
      localStorage.setItem('siaam_store_starting_cash', String(syncedAmt));
    }
  }, [transactions, currentAccount, storeSettings]);

  const handleUpdateStoreSettings = async (
    patch: Partial<Omit<StoreSettings, 'userId' | 'updatedAt'>>
  ) => {
    if (!repoRef.current) return;
    await repoRef.current.saveStoreSettings(
      {
        startingCashBalance,
        language,
        isDarkMode,
        ...patch,
      },
      storeSettings
    );
  };

  // Keep POS cart items synchronized with latest Firestore product stock and buyPrice
  useEffect(() => {
    if (products.length === 0) return;
    setCart((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((item) => {
        const live = products.find((p) => p.id === item.product.id);
        if (!live) return item;
        if (
          live.stock !== item.product.stock ||
          live.buyPrice !== item.product.buyPrice ||
          live.sellPrice !== item.product.sellPrice ||
          live.name !== item.product.name ||
          live.unit !== item.product.unit
        ) {
          changed = true;
          return {
            ...item,
            product: live,
            quantity: live.stock > 0 ? Math.min(live.stock, item.quantity) : item.quantity,
          };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [products]);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  };

  // Cart Handlers
  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        const nextQty = Math.min(product.stock, existing.quantity + 1);
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: nextQty } : i
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          customUnit: product.unit || 'pcs',
          customUnitPrice: product.sellPrice,
        },
      ];
    });
    showToast(
      isBengali
        ? `${product.name} কার্টে যোগ করা হয়েছে`
        : `${product.name} added to POS cart`
    );
  };

  const handleUpdateCartQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    const liveProduct = products.find((p) => p.id === productId);
    setCart((prev) =>
      prev.map((i) => {
        if (i.product.id !== productId) return i;
        const freshProd = liveProduct || i.product;
        return {
          ...i,
          product: freshProd,
          quantity: Math.min(freshProd.stock, quantity),
        };
      })
    );
  };

  const handleUpdateCartUnit = (productId: string, unit: string) => {
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId ? { ...i, customUnit: unit } : i
      )
    );
  };

  const handleUpdateCartUnitPrice = (
    productId: string,
    customPrice: number
  ) => {
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, customUnitPrice: customPrice }
          : i
      )
    );
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscountInput('');
    setSelectedCustomerId('');
  };

  const handleCompleteSale = async (
    cashPaid: number,
    newCustomerName: string,
    newCustomerPhone: string,
    newCustomerAddress: string,
    notes: string
  ) => {
    if (!repoRef.current || cart.length === 0) return;

    const isCreatingNewCustomer = newCustomerName.trim().length > 0;
    const selectedCustomer = isCreatingNewCustomer
      ? null
      : customers.find((c) => c.id === selectedCustomerId) || null;
    const discount = Math.max(0, Number(discountInput) || 0);
    const freshCartItems = cart.map((item) => {
      const liveProd = products.find((p) => p.id === item.product.id);
      return liveProd ? { ...item, product: liveProd } : item;
    });

    await repoRef.current.recordPosSale({
      cartItems: freshCartItems,
      paidAmount: cashPaid,
      selectedCustomer,
      notes,
      discountAmount: discount,
      newCustomerName,
      newCustomerPhone,
      newCustomerAddress,
    });
    handleClearCart();
    showToast(
      isBengali
        ? 'বিক্রি সফলভাবে সংরক্ষিত হয়েছে!'
        : 'Sale recorded & synced with Firebase!'
    );
  };

  if (!isAuthReady) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <StoreLoadingScreen isBengali={isBengali} mode="startup" />
      </div>
    );
  }

  if (!currentAccount) {
    return (
      <motion.div
        key="auth-screen-fade"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <AuthScreen
          onSuccess={() => {
            setIsStoreDataReady(false);
            setCurrentAccount(vaultAccessService.getActiveSession());
            setIsAuthReady(true);
          }}
        />
      </motion.div>
    );
  }

  const dailyStats = calculateDailyStats(transactions);

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <AnimatePresence>
        {!isStoreDataReady && (
          <StoreLoadingScreen isBengali={isBengali} mode="post-login" />
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isStoreDataReady ? 1 : 0 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-screen bg-[#F5F7F6] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200"
      >
        {/* Top Emerald Brand Header Bar (Persistent across all pages) */}
        <header className="sticky top-0 z-40 bg-gradient-to-r from-[#064E3B] via-[#047857] to-[#00965E] dark:from-[#042F24] dark:via-[#064E3B] dark:to-[#047857] text-white shadow-md border-b border-white/10">
          <div className="max-w-5xl lg:max-w-7xl mx-auto px-3.5 sm:px-4 lg:px-6 min-h-16 py-2 flex items-center justify-between gap-2.5 lg:gap-4">
            {/* Decorated Store Logo & Full Store Name + Full Address */}
            <div
              onClick={() => handleSelectMainTab(MainNavTab.HOME)}
              className="flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-pointer"
            >
              <div className="relative p-[2.5px] rounded-[14px] bg-gradient-to-br from-[#A7F3D0] via-white to-[#34D399] shadow-[0_4px_14px_rgba(0,0,0,0.24)] ring-2 ring-white/20 shrink-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[11.5px] overflow-hidden bg-[#1D3BB8] flex items-center justify-center shadow-inner">
                  <img
                    src="/assets/drawable/ic_siaam_store_logo.png"
                    alt="Siaam Store"
                    className="w-full h-full object-cover scale-[1.05]"
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[15px] sm:text-lg font-black tracking-tight leading-snug text-white">
                  {strings.appName}
                </h1>
                <p className="text-[10.5px] sm:text-xs text-emerald-50/95 font-medium leading-tight whitespace-normal break-words">
                  {strings.subtitle}
                </p>
              </div>
            </div>

            {/* Laptop / Desktop Inline Top Navigation Bar (Hidden on Smartphone / Mobile) */}
            <div className="hidden lg:flex items-center gap-1 bg-black/15 p-1 rounded-2xl border border-white/15 shrink-0">
              {(
                [
                  [MainNavTab.HOME, strings.navHome, Home],
                  [MainNavTab.SALES, strings.navSales, ShoppingCart],
                  [MainNavTab.PRODUCTS, strings.navProducts, Package],
                  [MainNavTab.CUSTOMERS, strings.navCustomers, Users],
                  [MainNavTab.MORE, strings.navMore, Wrench],
                ] as const
              ).map(([tab, label, Icon]) => {
                const active = selectedTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleSelectMainTab(tab)}
                    className={`relative px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white text-[#064E3B] font-black shadow-xs'
                        : 'text-emerald-50/90 hover:text-white hover:bg-white/10 font-bold'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                    {tab === MainNavTab.SALES && cart.length > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                          active
                            ? 'bg-[#00965E] text-white'
                            : 'bg-white text-[#064E3B]'
                        }`}
                      >
                        {cart.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Controls: Install PWA, Language, Theme, Logout */}
            <div className="flex items-center gap-1.5 shrink-0">
              <PWAInstallButton isBengali={isBengali} variant="header" />
              <button
                type="button"
                onClick={() => {
                  const nextLang = isBengali
                    ? AppLanguage.ENGLISH
                    : AppLanguage.BENGALI;
                  setLanguage(nextLang);
                  void handleUpdateStoreSettings({ language: nextLang });
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-extrabold flex items-center gap-1 transition cursor-pointer"
                title="Switch Language (বাংলা / English)"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{isBengali ? 'EN' : 'বাংলা'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !isDarkMode;
                  setIsDarkMode(next);
                  void handleUpdateStoreSettings({ isDarkMode: next });
                  showToast(
                    next
                      ? isBengali
                        ? 'ডার্ক থিম চালু করা হয়েছে'
                        : 'Dark theme enabled'
                      : isBengali
                      ? 'লাইট থিম চালু করা হয়েছে'
                      : 'Light theme enabled'
                  );
                }}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white transition cursor-pointer"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4 text-amber-300" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  void vaultAccessService.signOutVaultAndFirebase();
                  setCurrentAccount(null);
                }}
                className="p-2 rounded-xl bg-white/15 hover:bg-red-500/80 border border-white/25 text-white transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Status Toast Notification */}
        {statusMessage && (
          <div className="max-w-4xl lg:max-w-7xl mx-auto w-full px-4 lg:px-6 pt-2.5">
            <div className="px-4 py-2.5 rounded-xl bg-[#064E3B] text-white text-xs font-bold flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
                <span>{statusMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-white/75 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active Tab Body */}
        <main className="flex-1 pb-20 overflow-x-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${selectedTab}-${tabResetKey}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              transformTemplate={(_, generated) =>
                generated === 'none' || generated === 'translateY(0px)'
                  ? 'none'
                  : generated
              }
            >
              {selectedTab === MainNavTab.HOME && (
                <HomeDashboardView
                  stats={dailyStats}
                  products={products}
                  customers={customers}
                  strings={strings}
                  language={language}
                  onNavigateToSell={() => handleSelectMainTab(MainNavTab.SALES)}
              onQuickRestock={async (product) => {
                if (!repoRef.current) return;
                await repoRef.current.adjustProductStock(
                  product,
                  10,
                  'REASON:Added stock (Quick Restock +10)'
                );
                showToast(`${product.name} restocked (+10 ${product.unit})`);
              }}
              onGiveCredit={() => {
                setQuickModalType('CREDIT');
                setQuickCustId(customers[0]?.id || '');
                setQuickNewCustName('');
                setQuickNewCustPhone('');
                setQuickAmount('');
                setQuickNotes('');
              }}
              onGetPayment={() => {
                const owing = customers.find((c) => c.totalDue > 0);
                setQuickModalType('PAYMENT');
                setQuickCustId(owing?.id || customers[0]?.id || '');
                setQuickNewCustName('');
                setQuickNewCustPhone('');
                setQuickAmount(owing ? String(owing.totalDue) : '');
                setQuickNotes('');
              }}
            />
          )}

          {selectedTab === MainNavTab.SALES && (
            <SalesPosView
              key={`sales-${tabResetKey}`}
              products={products}
              customers={customers}
              transactions={transactions}
              cart={cart}
              selectedCustomerId={selectedCustomerId}
              discountInput={discountInput}
              strings={strings}
              language={language}
              onAddToCart={handleAddToCart}
              onUpdateQty={handleUpdateCartQty}
              onUpdateUnit={handleUpdateCartUnit}
              onUpdateUnitPrice={handleUpdateCartUnitPrice}
              onClearCart={handleClearCart}
              onSelectCustomer={setSelectedCustomerId}
              onDiscountChange={setDiscountInput}
              onCheckout={handleCompleteSale}
              onReturnOrVoidSale={async (tx) => {
                if (!repoRef.current) return;
                await repoRef.current.returnOrVoidSale({
                  transaction: tx,
                  currentProducts: products,
                  currentCustomers: customers,
                  isReturn: true,
                });
                showToast(
                  isBengali
                    ? 'বিক্রি বাতিল ও স্টক পুনরুদ্ধার করা হয়েছে!'
                    : 'Sale voided & stock restored!'
                );
              }}
            />
          )}

          {selectedTab === MainNavTab.PRODUCTS && (
            <ProductsView
              key={`products-${tabResetKey}`}
              products={products}
              transactions={transactions}
              strings={strings}
              language={language}
              isAdmin={currentAccount.role === 'ADMIN'}
              cloudCategories={storeSettings?.productCategories}
              cloudUnits={storeSettings?.productUnits}
              cloudQualities={storeSettings?.productQualities}
              onSyncProductLists={(lists) => handleUpdateStoreSettings(lists)}
              onAddProduct={async (params) => {
                if (!repoRef.current) return;
                await repoRef.current.addProduct(params);
                showToast(`${params.name} saved to inventory!`);
              }}
              onUpdateProduct={async (prod, params) => {
                if (!repoRef.current) return;
                await repoRef.current.updateProduct(prod, params);
                showToast(`${params.name} updated!`);
              }}
              onRecordStockAdjustment={async (prod, delta, reason) => {
                if (!repoRef.current) return;
                await repoRef.current.adjustProductStock(prod, delta, reason);
                showToast(`${prod.name} stock adjusted (${delta})`);
              }}
              onVoidStockAdjustment={async (prod, tx, signedDelta) => {
                if (!repoRef.current) return;
                await repoRef.current.voidStockAdjustment(
                  prod,
                  tx,
                  signedDelta
                );
                showToast('Stock adjustment reversed!');
              }}
              onDeleteProduct={async (productId, productName) => {
                if (!repoRef.current) return;
                await repoRef.current.deleteProduct(productId, productName);
                showToast('Product moved to Recycle Bin');
              }}
              onAddToCart={(product) => {
                handleAddToCart(product);
              }}
            />
          )}

          {selectedTab === MainNavTab.CUSTOMERS && (
            <CustomersView
              key={`customers-${tabResetKey}`}
              customers={customers}
              transactions={transactions}
              strings={strings}
              language={language}
              onAddCustomer={async (params) => {
                if (!repoRef.current) return;
                await repoRef.current.addCustomer(params);
                showToast(`${params.name} added to customer khata!`);
              }}
              onUpdateCustomer={async (cust, params) => {
                if (!repoRef.current) return;
                await repoRef.current.updateCustomer(cust, params);
                showToast(`${params.name} updated!`);
              }}
              onRecordPaymentOrCredit={async (params) => {
                if (!repoRef.current) return;
                await repoRef.current.recordCustomerDueOrPayment(params);
                showToast(
                  params.isGiveDue
                    ? `Credit ৳${formatMoney(params.amount)} added!`
                    : `Payment ৳${formatMoney(params.amount)} recorded!`
                );
              }}
              onDeleteCustomerTransaction={async (tx) => {
                if (!repoRef.current) return;
                await repoRef.current.deleteTransaction(
                  tx,
                  customers,
                  suppliers,
                  products
                );
                showToast('Transaction reversed & moved to Recycle Bin');
              }}
              onDeleteCustomer={async (custId, custName) => {
                if (!repoRef.current) return;
                await repoRef.current.deleteCustomer(custId, custName);
                showToast('Customer moved to Recycle Bin');
              }}
            />
          )}

          {selectedTab === MainNavTab.MORE && (
            <MoreManagementView
              key={`more-${tabResetKey}`}
              stats={dailyStats}
              products={products}
              customers={customers}
              transactions={transactions}
              suppliers={suppliers}
              staffList={staffList}
              auditLogs={auditLogs}
              recycleBinItems={recycleBinItems}
              startingCashBalance={startingCashBalance}
              storeSettings={storeSettings}
              onUpdateStoreSettings={handleUpdateStoreSettings}
              onUpdateStartingCash={(amt) => {
                setStartingCashBalance(amt);
                localStorage.setItem('siaam_store_starting_cash', String(amt));
                if (repoRef.current) {
                  void repoRef.current.setStartingCash(amt);
                  void handleUpdateStoreSettings({ startingCashBalance: amt });
                }
                showToast('Starting cash balance updated!');
              }}
              strings={strings}
              language={language}
              isDarkMode={isDarkMode}
              onToggleLanguage={() => {
                const nextLang = isBengali
                  ? AppLanguage.ENGLISH
                  : AppLanguage.BENGALI;
                setLanguage(nextLang);
                void handleUpdateStoreSettings({ language: nextLang });
              }}
              onToggleDarkMode={() => {
                const nextDark = !isDarkMode;
                setIsDarkMode(nextDark);
                void handleUpdateStoreSettings({ isDarkMode: nextDark });
              }}
              onRecordExpense={async (title, category, amount, notes) => {
                if (!repoRef.current) return;
                await repoRef.current.recordExpense({
                  title,
                  category,
                  amount,
                  notes: (notes && notes.trim()) || category,
                });
                showToast(`Expense ৳${formatMoney(amount)} recorded!`);
              }}
              onRecordMultiItemPurchase={async (params) => {
                if (!repoRef.current) return;
                await repoRef.current.recordMultiItemPurchase(params);
                showToast('Stock purchase recorded & inventory updated!');
              }}
              onVoidPurchase={async (tx) => {
                if (!repoRef.current) return;
                await repoRef.current.voidPurchase({
                  transaction: tx,
                  currentProducts: products,
                  currentSuppliers: suppliers,
                });
                showToast('Purchase voided & stock reverted!');
              }}
              onDeleteTransaction={async (tx) => {
                if (!repoRef.current) return;
                await repoRef.current.deleteTransaction(
                  tx,
                  customers,
                  suppliers,
                  products
                );
                showToast('Transaction deleted');
              }}
              onDeleteProduct={async (productId, productName) => {
                if (!repoRef.current) return;
                await repoRef.current.deleteProduct(productId, productName);
                showToast('Product moved to Recycle Bin');
              }}
              onDeleteCustomer={async (custId, custName) => {
                if (!repoRef.current) return;
                await repoRef.current.deleteCustomer(custId, custName);
                showToast('Customer moved to Recycle Bin');
              }}
              onResetAllStoreData={async () => {
                if (!repoRef.current) return;
                await repoRef.current.resetAllStoreData({
                  activeProducts: products,
                  activeCustomers: customers,
                  activeTransactions: transactions,
                  activeSuppliers: suppliers,
                  activeStaff: staffList,
                });
                setStartingCashBalance(0);
                localStorage.setItem('siaam_store_starting_cash', '0');
                void handleUpdateStoreSettings({ startingCashBalance: 0 });
                showToast('Store data reset!');
              }}
              onRestoreFromRecycleBin={async (item) => {
                if (!repoRef.current) return;
                await repoRef.current.restoreRecycleItem(
                  item,
                  customers,
                  suppliers,
                  products
                );
                showToast(`${item.name} restored!`);
              }}
              onPermanentlyDeleteRecycleBinItem={async (id) => {
                if (!repoRef.current) return;
                await repoRef.current.deletePermanentlyFromRecycleBin(id);
                showToast('Permanently deleted');
              }}
              onEmptyRecycleBin={async () => {
                if (!repoRef.current) return;
                await repoRef.current.emptyRecycleBin();
                showToast('Recycle Bin emptied');
              }}
              onAddSupplier={async (params) => {
                if (!repoRef.current) return;
                await repoRef.current.addSupplier(params);
                showToast(`Supplier ${params.name} added!`);
              }}
              onUpdateSupplier={async (sup, params) => {
                if (!repoRef.current) return;
                await repoRef.current.updateSupplier(sup, params);
                showToast(`Supplier ${params.name} updated!`);
              }}
              onRecordSupplierPayment={async (sup, amount, notes) => {
                if (!repoRef.current) return;
                await repoRef.current.paySupplier(sup, amount, notes);
                showToast('Supplier payment recorded!');
              }}
              onAddSupplierCreditOwed={async (sup, amount, notes) => {
                if (!repoRef.current) return;
                await repoRef.current.addSupplierOwed(sup, amount, notes);
                showToast('Supplier payable updated!');
              }}
              onDeleteSupplier={async (supId, supName) => {
                if (!repoRef.current) return;
                await repoRef.current.deleteSupplier(supId, supName);
                showToast('Supplier moved to Recycle Bin');
              }}
              onAddStaff={async (params) => {
                if (!repoRef.current) return;
                await repoRef.current.addStaffMember(params);
                showToast(`Staff ${params.name} added!`);
              }}
              onUpdateStaff={async (st, params) => {
                if (!repoRef.current) return;
                await repoRef.current.updateStaffMember(st, params);
                showToast(`Staff ${params.name} updated!`);
              }}
              onToggleStaffActive={async (st) => {
                if (!repoRef.current) return;
                await repoRef.current.toggleStaffActive(st);
              }}
              onDeleteStaff={async (st) => {
                if (!repoRef.current) return;
                await repoRef.current.deleteStaffMember(st);
                showToast('Staff moved to Recycle Bin');
              }}
              onSignOut={() => {
                void vaultAccessService.signOutVaultAndFirebase();
                setCurrentAccount(null);
              }}
            />
          )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom 5-Tab Navigation Footer Bar (Persistent across all pages) */}
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t-[1.5px] border-[#CBEAD9] dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="max-w-3xl lg:max-w-5xl mx-auto grid grid-cols-5 h-16 px-1.5 py-1.5 gap-1">
            {(
              [
                [MainNavTab.HOME, strings.navHome, Home],
                [MainNavTab.SALES, strings.navSales, ShoppingCart],
                [MainNavTab.PRODUCTS, strings.navProducts, Package],
                [MainNavTab.CUSTOMERS, strings.navCustomers, Users],
                [MainNavTab.MORE, strings.navMore, Wrench],
              ] as const
            ).map(([tab, label, Icon]) => {
              const active = selectedTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleSelectMainTab(tab)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors duration-200 active:scale-[0.96] cursor-pointer overflow-hidden ${
                    active
                      ? 'border-transparent text-[#00965E] dark:text-[#34D399] font-extrabold'
                      : 'border-transparent text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="siaam-bottom-nav-active-pill"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 32,
                      }}
                      className="absolute inset-0 rounded-xl bg-[#ECFDF5] dark:bg-emerald-950/60 border border-[#A7F3D0] dark:border-emerald-800/80 shadow-xs"
                    />
                  )}
                  <div className="relative z-10">
                    <Icon className="w-5 h-5" />
                    {tab === MainNavTab.SALES && cart.length > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 rounded-full bg-[#00965E] text-white text-[9px] font-black">
                        {cart.length}
                      </span>
                    )}
                  </div>
                  <span className="relative z-10 text-[11px]">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Quick Home Give Credit / Receive Payment Modal */}
        {quickModalType && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {quickModalType === 'CREDIT'
                  ? strings.quickGiveDue
                  : strings.quickReceiveMoney}
              </h3>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!repoRef.current) return;
                  const amt = Math.max(0, Number(quickAmount) || 0);
                  if (amt <= 0) return;

                  let targetCust =
                    customers.find((c) => c.id === quickCustId) || null;
                  if (!targetCust && quickNewCustName.trim()) {
                    const newId = await repoRef.current.addCustomer({
                      name: quickNewCustName.trim(),
                      phone: quickNewCustPhone.trim(),
                      address: '',
                      initialDue: 0,
                    });
                    targetCust = {
                      id: newId,
                      userId: 'siaam_store_shared',
                      name: quickNewCustName.trim(),
                      phone: quickNewCustPhone.trim(),
                      address: '',
                      totalDue: 0,
                      totalPurchased: 0,
                      totalPaid: 0,
                    };
                  }
                  if (!targetCust) return;

                  await repoRef.current.recordCustomerDueOrPayment({
                    customer: targetCust,
                    amount: amt,
                    isGiveDue: quickModalType === 'CREDIT',
                    notes: quickNotes,
                  });
                  showToast(
                    quickModalType === 'CREDIT'
                      ? `Credit ৳${formatMoney(amt)} recorded!`
                      : `Payment ৳${formatMoney(amt)} received!`
                  );
                  setQuickModalType(null);
                }}
                className="mt-4 space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'কাস্টমার' : 'Customer'}
                  </label>
                  <select
                    value={quickCustId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setQuickCustId(cid);
                      if (quickModalType === 'PAYMENT') {
                        const found = customers.find((c) => c.id === cid);
                        if (found && found.totalDue > 0) {
                          setQuickAmount(String(found.totalDue));
                        }
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">
                      {isBengali ? '+ নতুন কাস্টমার যোগ করুন' : '+ Add New Customer'}
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Due: ৳{formatMoney(c.totalDue)})
                      </option>
                    ))}
                  </select>
                </div>

                {!quickCustId && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={quickNewCustName}
                      onChange={(e) => setQuickNewCustName(e.target.value)}
                      placeholder={
                        isBengali ? 'কাস্টমারের নাম *' : 'Customer Name *'
                      }
                      className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs dark:bg-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={quickNewCustPhone}
                      onChange={(e) => setQuickNewCustPhone(e.target.value)}
                      placeholder={isBengali ? 'মোবাইল নম্বর' : 'Phone Number'}
                      className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'টাকার পরিমাণ (৳) *' : 'Amount (৳) *'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'নোট (ঐচ্ছিক)' : 'Note (optional)'}
                  </label>
                  <input
                    type="text"
                    value={quickNotes}
                    onChange={(e) => setQuickNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setQuickModalType(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600"
                  >
                    {isBengali ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00965E] text-white cursor-pointer"
                  >
                    {isBengali ? 'সংরক্ষণ করুন' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        <OfflineIndicator isBengali={isBengali} />
      </motion.div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DokanStoreMainApp />
    </ErrorBoundary>
  );
}
