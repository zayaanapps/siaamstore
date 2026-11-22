import React from 'react';
import {
  ShoppingCart,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  Package,
  PlusCircle,
  Users,
  BarChart3,
  Wallet,
} from 'lucide-react';
import {
  AppLanguage,
  Product,
  Customer,
  DailyStats,
  formatMoney,
  toBengaliDigits,
  isProductLowStock,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';

interface HomeDashboardViewProps {
  stats: DailyStats;
  products: Product[];
  customers: Customer[];
  strings: DokanTranslations;
  language: AppLanguage;
  onNavigateToSell: () => void;
  onQuickRestock: (product: Product) => void;
  onGiveCredit: () => void;
  onGetPayment: () => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({
  stats,
  products,
  customers,
  strings,
  language,
  onNavigateToSell,
  onQuickRestock,
  onGiveCredit,
  onGetPayment,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const lowStockProducts = products.filter(isProductLowStock);
  const customersOwingCount = customers.filter((c) => c.totalDue > 0).length;
  const totalPendingDues = customers.reduce(
    (acc, c) => acc + Math.max(0, c.totalDue),
    0
  );

  return (
    <div className="max-w-4xl mx-auto px-4 pt-3.5 pb-8 space-y-4">
      {/* Total Outstanding Hero Card with Split Background Images & Crisp Border */}
      <div className="relative w-full h-[218px] rounded-[24px] overflow-hidden shadow-lg border-2 border-[#A7F3D0] dark:border-emerald-700/70">
        {/* Right-side Green Tree Image */}
        <img
          src="/assets/drawable/img_green_tree_card_1794331745073.jpg"
          alt=""
          className="absolute right-0 top-0 w-[62%] h-full object-cover"
        />
        {/* Left-side Outstanding Decorative Illustration */}
        <img
          src="/assets/drawable/img_outstanding_card_bg.png"
          alt=""
          className="absolute left-0 top-0 w-[75%] h-full object-cover"
        />
        {/* Warm Mauve-Brown Contrast Scrim Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(61,34,48,0.48) 0%, rgba(45,24,34,0.68) 70%, rgba(28,15,22,0.82) 100%)',
          }}
        />

        {/* Centered Metric Content */}
        <div className="relative z-10 h-full flex flex-col justify-between">
          <div className="flex-1 flex flex-col items-center justify-center px-6 pt-3 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 border border-white/25 backdrop-blur-xs">
              <Wallet className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-[11px] font-bold tracking-[0.14em] text-white/95 uppercase drop-shadow">
                {strings.totalDuesLabel}
              </span>
            </div>
            <div className="mt-2 text-[42px] sm:text-[46px] font-black text-white leading-none tracking-tight drop-shadow-md">
              ৳ {toBengaliDigits(formatMoney(totalPendingDues), language)}
            </div>
          </div>

          {/* Bottom Strip Footer */}
          <div className="w-full bg-[#1C0F16]/65 backdrop-blur-[2px] py-2.5 px-5 text-center border-t border-white/20 flex items-center justify-center gap-2">
            <Users className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="text-[14px] font-semibold text-white/95">
              {isBengali
                ? `${toBengaliDigits(customersOwingCount, language)} জন কাস্টমারের কাছে পাওনা`
                : `${customersOwingCount} customer${customersOwingCount === 1 ? '' : 's'} owe you`}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Action Button: New Sale */}
      <button
        type="button"
        onClick={onNavigateToSell}
        className="w-full h-[54px] rounded-[16px] bg-[#00B368] hover:bg-[#059658] active:scale-[0.99] text-white font-bold text-[17px] border-[1.5px] border-[#34D399]/60 shadow-md flex items-center justify-center gap-2.5 transition cursor-pointer"
      >
        <ShoppingCart className="w-5 h-5" />
        <span>{strings.quickNewSale}</span>
      </button>

      {/* Secondary Action Buttons Row: + Gave credit | + Got payment */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onGiveCredit}
          className="h-[48px] rounded-[14px] bg-[#0EA5E9] hover:bg-[#0284C7] active:scale-[0.99] text-white font-bold text-[15px] border-[1.5px] border-sky-300/60 shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>{strings.quickGiveDue}</span>
        </button>
        <button
          type="button"
          onClick={onGetPayment}
          className="h-[48px] rounded-[14px] bg-[#059669] hover:bg-[#047857] active:scale-[0.99] text-white font-bold text-[15px] border-[1.5px] border-emerald-300/60 shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>{strings.quickReceiveMoney}</span>
        </button>
      </div>

      {/* Today's Summary Section */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#E6F8F0] dark:bg-emerald-950/60 border border-[#A7F3D0] dark:border-emerald-800 flex items-center justify-center text-[#00965E]">
            <BarChart3 className="w-4 h-4" />
          </div>
          <h2 className="text-[18px] font-extrabold text-slate-900 dark:text-slate-100">
            {strings.dailyStatsTitle}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Today's Sales */}
          <div className="bg-white dark:bg-slate-800 rounded-[16px] p-3.5 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-xs flex items-start justify-between gap-2">
            <div>
              <p className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">
                {strings.todaysSale} ({toBengaliDigits(stats.todaysSaleCount, language)})
              </p>
              <p className="mt-1.5 text-[21px] font-extrabold text-slate-900 dark:text-white">
                ৳{toBengaliDigits(formatMoney(stats.todaysSale), language)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-center text-[#00965E] shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>

          {/* Today's Profit */}
          <div className="bg-white dark:bg-slate-800 rounded-[16px] p-3.5 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-xs flex items-start justify-between gap-2">
            <div>
              <p className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">
                {strings.todaysProfit}
              </p>
              <p className="mt-1.5 text-[21px] font-extrabold text-[#059669] dark:text-[#34D399]">
                ৳{toBengaliDigits(formatMoney(stats.todaysProfit), language)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-center text-[#059669] shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          {/* Credit Given Today */}
          <div className="bg-white dark:bg-slate-800 rounded-[16px] p-3.5 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-xs flex items-start justify-between gap-2">
            <div>
              <p className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">
                {strings.todaysGivenDue} ({toBengaliDigits(stats.todaysGivenDueCustomerCount, language)})
              </p>
              <p className="mt-1.5 text-[21px] font-extrabold text-[#D97706] dark:text-[#FBBF24]">
                ৳{toBengaliDigits(formatMoney(stats.todaysGivenDue), language)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 flex items-center justify-center text-[#D97706] shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          {/* Received Today */}
          <div className="bg-white dark:bg-slate-800 rounded-[16px] p-3.5 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 shadow-xs flex items-start justify-between gap-2">
            <div>
              <p className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">
                {strings.todaysReceived}
              </p>
              <p className="mt-1.5 text-[21px] font-extrabold text-[#059669] dark:text-[#34D399]">
                ৳{toBengaliDigits(formatMoney(stats.todaysReceivedMoney), language)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-center text-[#059669] shrink-0">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert Card */}
      {lowStockProducts.length > 0 && (
        <div className="bg-[#FFFBEB] dark:bg-amber-950/40 rounded-[16px] p-4 border-[1.5px] border-[#FCD34D] dark:border-amber-700/80 shadow-xs">
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-amber-200/80 dark:border-amber-800/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/70 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-[#B45309] dark:text-amber-300">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-[15px] font-extrabold text-[#B45309] dark:text-amber-300">
                {strings.lowStockAlerts}
              </h3>
            </div>
          </div>
          <div className="space-y-1.5">
            {lowStockProducts.slice(0, 6).map((product) => (
              <div
                key={product.id}
                className="py-2 px-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-amber-200/90 dark:border-amber-800/60 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-4 h-4 text-[#D97706] shrink-0" />
                  <span className="text-[14px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {product.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[13px] font-bold text-[#DC2626] dark:text-red-400">
                    {isBengali
                      ? `${toBengaliDigits(product.stock, language)} ${product.unit} বাকি`
                      : `${product.stock} ${product.unit} left`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
