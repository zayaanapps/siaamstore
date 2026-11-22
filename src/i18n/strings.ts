import { AppLanguage } from '../types/dokan';

export interface DokanTranslations {
  appName: string;
  subtitle: string;
  navHome: string;
  navSales: string;
  navProducts: string;
  navCustomers: string;
  navMore: string;
  onboardingTitle: string;
  hideLabel: string;
  stepAddProduct: string;
  stepFirstSale: string;
  stepAddCustomer: string;
  totalDuesLabel: string;
  quickNewSale: string;
  quickGiveDue: string;
  quickReceiveMoney: string;
  dailyStatsTitle: string;
  todaysSale: string;
  todaysProfit: string;
  todaysGivenDue: string;
  todaysReceived: string;
  lowStockAlerts: string;
  allStockHealthy: string;
  searchProductsHint: string;
  addProductBtn: string;
  searchCustomersHint: string;
  addCustomerBtn: string;
  filterAll: string;
  filterHasDues: string;
  filterNoDues: string;
  noSalesYet: string;
  posCartTitle: string;
  checkoutSaleBtn: string;

  toolsTitle: string;
  secStoreOps: string;
  secDataCloud: string;
  secAccessStaff: string;
  secAppSettings: string;
  secProfileAbout: string;

  menuPurchases: string;
  menuPurchasesSub: string;
  menuSuppliers: string;
  menuSuppliersSub: string;
  menuExpenses: string;
  menuExpensesSub: string;
  menuCashBook: string;
  menuCashBookSub: string;
  menuBusinessReports: string;
  menuBusinessReportsSub: string;
  menuDueReports: string;
  menuDueReportsSub: string;

  menuBackup: string;
  menuBackupSub: string;
  menuRecycleBin: string;
  menuRecycleBinSub: string;
  menuResetAll: string;
  menuResetAllSub: string;
  menuAuditLog: string;
  menuAuditLogSub: string;

  menuUserMgmt: string;
  menuUserMgmtSub: string;
  menuStaff: string;
  menuStaffSub: string;

  menuLanguage: string;
  menuTheme: string;
  menuProfile: string;
  menuProfileSub: string;
  menuAboutDev: string;
  menuAboutDevSub: string;
  menuShareApp: string;
  menuShareAppSub: string;
  menuDeleteTransactions: string;
  menuDeleteTransactionsSub: string;
  menuBlueprint: string;
  menuBlueprintSub: string;
}

export const APP_VERSION_NAME = '6.0.0';

export function stringsFor(language: AppLanguage): DokanTranslations {
  if (language === AppLanguage.BENGALI) {
    return {
      appName: 'সিয়াম স্টোর',
      subtitle: 'রামচন্দ্রপুর হাট, চাঁপাইনবাবগঞ্জ',
      navHome: 'হোম',
      navSales: 'বিক্রি',
      navProducts: 'পণ্য',
      navCustomers: 'কাস্টমার',
      navMore: 'টুলস',
      onboardingTitle: 'শুরুর কাজ',
      hideLabel: 'লুকান',
      stepAddProduct: 'আপনার পণ্য যোগ করুন',
      stepFirstSale: 'আপনার প্রথম বিক্রি রেকর্ড করুন',
      stepAddCustomer: 'একজন কাস্টমার যোগ করুন',
      totalDuesLabel: 'মোট বাকি',
      quickNewSale: 'নতুন বিক্রি',
      quickGiveDue: '+ বাকি দিন',
      quickReceiveMoney: '+ জমা নিন',
      dailyStatsTitle: 'আজকের হিসাব',
      todaysSale: 'আজকের বিক্রি',
      todaysProfit: 'আজকের লাভ',
      todaysGivenDue: 'আজকের বাকি',
      todaysReceived: 'আজকের আদায়',
      lowStockAlerts: 'স্টক কম',
      allStockHealthy: 'সব পণ্যের পর্যাপ্ত স্টক রয়েছে।',
      searchProductsHint: 'পণ্যের নাম, ক্যাটাগরি বা বারকোড খুঁজুন...',
      addProductBtn: 'নতুন পণ্য যোগ',
      searchCustomersHint: 'নাম বা মোবাইল নম্বর দিয়ে খুঁজুন...',
      addCustomerBtn: 'নতুন কাস্টমার',
      filterAll: 'সবাই',
      filterHasDues: 'বাকি আছে',
      filterNoDues: 'বাকি নেই',
      noSalesYet: 'আজ এখনো কোনো বিক্রি লেখা হয়নি। প্রথম বিক্রিটা হয়ে যাক!',
      posCartTitle: 'নতুন বিক্রি ও কার্ট',
      checkoutSaleBtn: 'বিক্রি সম্পন্ন করুন',

      toolsTitle: 'টুলস ও সেটিংস',
      secStoreOps: 'দোকান ও ব্যবসা পরিচালনা',
      secDataCloud: 'ফায়ারবেস ম্যানেজার',
      secAccessStaff: 'অ্যাক্সেস ও সিকিউরিটি',
      secAppSettings: 'অ্যাপ সেটিংস ও রূপরেখা',
      secProfileAbout: 'প্রোফাইল ও অ্যাপ তথ্য',

      menuPurchases: 'মাল কেনা (স্টক ইন)',
      menuPurchasesSub: 'কেনা পণ্যের হিসাব ও গুদামে স্টক বৃদ্ধি',
      menuSuppliers: 'সাপ্লায়ার খাতা',
      menuSuppliersSub: 'মহাজন ও ডিলারদের পাওনা-দেনার হিসাব',
      menuExpenses: 'দোকানের খরচ',
      menuExpensesSub: 'দোকান ভাড়া, বিদ্যুৎ বিল, নাস্তা ও দৈনন্দিন খরচ',
      menuCashBook: 'ক্যাশ খাতা',
      menuCashBookSub: 'প্রতিদিনের মোট নগদ জমা ও নগদ খরচের খতিয়ান',
      menuBusinessReports: 'ব্যবসার রিপোর্ট',
      menuBusinessReportsSub: 'মোট বিক্রি, লাভ-ক্ষতি ও সেরা বিক্রীত পণ্যের বিবরণ',
      menuDueReports: 'বাকির রিপোর্ট',
      menuDueReportsSub: 'কাস্টমারদের বাকির খাতা ও কালেকশন রিপোর্ট',

      menuBackup: 'ফায়ারবেস সিঙ্ক ও ডাটা ব্যাকআপ',
      menuBackupSub: 'ক্লাউড ফায়ারস্টোর স্ট্যাটাস ও সম্পূর্ণ স্টোরের JSON ব্যাকআপ এক্সপোর্ট',
      menuRecycleBin: 'রিসাইকেল বিন (মুছে ফেলা ডাটা)',
      menuRecycleBinSub: 'ভুলবশত মুছে ফেলা পণ্য, কাস্টমার, লেনদেন বা খরচ পুনরুদ্ধার করুন',
      menuResetAll: 'সব ডাটা রিসেট ও ফ্রেশ শুরু',
      menuResetAllSub: 'সকল সক্রিয় ডাটা রিসাইকেল বিনে সরিয়ে দোকান নতুন করে শুরু করুন',
      menuAuditLog: 'অডিট লগ (কার্যকলাপের খতিয়ান)',
      menuAuditLogSub: 'দোকানের হিসেবে কে কখন কী পরিবর্তন করেছে তার রেকর্ড',

      menuUserMgmt: 'ইউজার ম্যানেজমেন্ট ও পাসওয়ার্ড',
      menuUserMgmtSub: 'অ্যাডমিন, অ্যাকাউন্ট ম্যানেজার রোল ও লগইন কন্ট্রোল',
      menuStaff: 'স্টাফ ও বেতন খাতা',
      menuStaffSub: 'দোকানের কর্মচারীদের তালিকা ও মাসিক বেতন ট্র্যাকার',

      menuLanguage: 'ভাষা নির্বাচন (বাংলা / English)',
      menuTheme: 'থিম মোড (লাইট / ডার্ক / ডিভাইস ডিফল্ট)',
      menuProfile: 'স্টোর প্রোফাইল',
      menuProfileSub: 'সিয়াম স্টোর, রামচন্দ্রপুর হাট, চাঁপাইনবাবগঞ্জ',
      menuAboutDev: 'অ্যাপ ডেভেলপার ও ভার্সন তথ্য',
      menuAboutDevSub: `সিয়াম স্টোর V${APP_VERSION_NAME} - আব্দুল্লাহিল কাফি`,
      menuShareApp: 'অ্যাপ শেয়ার করুন',
      menuShareAppSub: 'অন্যান্য ব্যবসায়ী বন্ধুদের সাথে অ্যাপটি শেয়ার করুন',
      menuDeleteTransactions: 'ডাটা মুছে ফেলা ও রিসেট (ফিল্টার ও বাল্ক ডিলিট)',
      menuDeleteTransactionsSub: 'নির্দিষ্ট ফিল্টার অনুযায়ী লেনদেন, পণ্য, কাস্টমার মুছুন অথবা সব ডাটা রিসেট করুন',
      menuBlueprint: 'সিস্টেম কোড ও ফায়ারস্টোর স্কিমা',
      menuBlueprintSub: 'সব মডিউলের আর্কিটেকচার ও ক্লাউড ডাটাবেজ স্ট্রাকচার',
    };
  }

  return {
    appName: 'Siaam Store',
    subtitle: 'Ramchandrapur Haat, Chapainawabganj',
    navHome: 'Home',
    navSales: 'Sell',
    navProducts: 'Products',
    navCustomers: 'Customers',
    navMore: 'Tools',
    onboardingTitle: 'Getting Started',
    hideLabel: 'Hide',
    stepAddProduct: 'Add your products',
    stepFirstSale: 'Record your first sale',
    stepAddCustomer: 'Add a customer',
    totalDuesLabel: 'Total outstanding',
    quickNewSale: 'New sale',
    quickGiveDue: '+ Gave credit',
    quickReceiveMoney: '+ Got payment',
    dailyStatsTitle: "Today's Summary",
    todaysSale: "Today's sales",
    todaysProfit: "Today's profit",
    todaysGivenDue: 'Credit given today',
    todaysReceived: 'Received today',
    lowStockAlerts: 'Low stock',
    allStockHealthy: 'All products are well-stocked above threshold.',
    searchProductsHint: 'Search by product name, category, or barcode...',
    addProductBtn: 'Add Product',
    searchCustomersHint: 'Search customer by name or phone...',
    addCustomerBtn: 'Add Customer',
    filterAll: 'All',
    filterHasDues: 'Has Dues',
    filterNoDues: 'No Dues',
    noSalesYet: 'No sales recorded today yet. Record your first sale!',
    posCartTitle: 'POS Cart & Checkout',
    checkoutSaleBtn: 'Complete Sale',

    toolsTitle: 'Tools & Settings',
    secStoreOps: 'Store Operations',
    secDataCloud: 'Firebase Manager',
    secAccessStaff: 'Access & Security',
    secAppSettings: 'Settings & Appearance',
    secProfileAbout: 'Profile & About App',

    menuPurchases: 'Purchases (Stock In)',
    menuPurchasesSub: 'Stock-in details, increases inventory',
    menuSuppliers: 'Suppliers Ledger',
    menuSuppliersSub: 'Accounts payable & supplier balances',
    menuExpenses: 'Shop Expenses',
    menuExpensesSub: 'Rent, electricity, tea, travel & daily costs',
    menuCashBook: 'Cash Book',
    menuCashBookSub: 'Daily cash inflow and outflow tracking',
    menuBusinessReports: 'Business Reports',
    menuBusinessReportsSub: 'Total sales, net profit & top-selling items',
    menuDueReports: 'Due Reports',
    menuDueReportsSub: 'Customer dues, collections & defaulters',

    menuBackup: 'Firebase Sync & Data Backup',
    menuBackupSub: 'Cloud Firestore status & full store JSON backup export',
    menuRecycleBin: 'Recycle Bin (Trash)',
    menuRecycleBinSub: 'Filter deleted items, restore or permanently delete',
    menuResetAll: 'Reset All Store Data',
    menuResetAllSub: 'Wipe all active data to Recycle Bin & restart fresh',
    menuAuditLog: 'Audit Log',
    menuAuditLogSub: 'Track who did what across the store',

    menuUserMgmt: 'User Management',
    menuUserMgmtSub: 'Admin, Account Manager & login passwords',
    menuStaff: 'Staff Management',
    menuStaffSub: 'Shop employees list & monthly salaries',

    menuLanguage: 'Language Selection',
    menuTheme: 'Theme Mode',
    menuProfile: 'Store Profile',
    menuProfileSub: 'Siaam Store, Ramchandrapur Haat, Chapainawabganj',
    menuAboutDev: 'About App Developer',
    menuAboutDevSub: `Siaam Store V${APP_VERSION_NAME} - Abdullahil Kuafi`,
    menuShareApp: 'Share App',
    menuShareAppSub: 'Share Siaam Store with other shop owners',
    menuDeleteTransactions: 'Data Removal & Deletion Center',
    menuDeleteTransactionsSub: 'Easily delete specific data by filter, bulk delete, or reset all data',
    menuBlueprint: 'System Architecture & Schema',
    menuBlueprintSub: 'View all modules code and Firestore schema',
  };
}
