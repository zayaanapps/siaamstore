import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  MapPin,
  Phone,
  Store,
  Copy,
  Check,
  Globe,
  MessageCircle,
  Mail,
  Send,
  GraduationCap,
  Code2,
  Layers,
  Smartphone,
  Sparkles,
  Building2,
  Package,
  Users,
  Truck,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { AppLanguage, toBengaliDigits } from '../types/dokan';
import { APP_VERSION_NAME, DokanTranslations } from '../i18n/strings';

interface StoreProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: AppLanguage;
  strings: DokanTranslations;
  productCount: number;
  customerCount: number;
  supplierCount: number;
  activeStaffCount: number;
}

export const StoreProfileModal: React.FC<StoreProfileModalProps> = ({
  isOpen,
  onClose,
  language,
  productCount,
  customerCount,
  supplierCount,
  activeStaffCount,
}) => {
  const isBn = language === AppLanguage.BENGALI;
  const [copiedStore, setCopiedStore] = useState(false);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleCopyStoreInfo = async () => {
    const text = isBn
      ? `সিয়াম স্টোর (Siaam Store)\nঠিকানা: রামচন্দ্রপুর হাট, চাঁপাইনবাবগঞ্জ\nমোবাইল: ০১৭৪০৯৯৯৬২৭, ০১৩০৩০৩৩৩৫৩`
      : `Siaam Store (সিয়াম স্টোর)\nAddress: Ramchandrapur Haat, Chapainawabganj\nPhone: 01740999627, 01303033353`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStore(true);
      window.setTimeout(() => setCopiedStore(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const stats = [
    {
      label: isBn ? 'পণ্য' : 'Products',
      value: toBengaliDigits(productCount, language),
      icon: Package,
    },
    {
      label: isBn ? 'কাস্টমার' : 'Customers',
      value: toBengaliDigits(customerCount, language),
      icon: Users,
    },
    {
      label: isBn ? 'সাপ্লায়ার' : 'Suppliers',
      value: toBengaliDigits(supplierCount, language),
      icon: Truck,
    },
    {
      label: isBn ? 'স্টাফ' : 'Staff',
      value: toBengaliDigits(activeStaffCount, language),
      icon: UserCheck,
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isBn ? 'স্টোর প্রোফাইল' : 'Store Profile'}
    >
      <div
        className="w-full max-w-md md:max-w-2xl lg:max-w-3xl max-h-[calc(100dvh-20px)] sm:max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================
            SMARTPHONE / MOBILE LAYOUT (< md): Unchanged Vertical Card
           ============================================================ */}
        <div className="md:hidden">
          {/* Decorated Centered Emerald Header Banner */}
          <div className="relative bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#00A862] px-4 pt-3 pb-11 text-center overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 -left-12 w-32 h-32 rounded-full border border-white/15 bg-white/5"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-14 -right-10 w-40 h-40 rounded-full border border-white/15 bg-white/5"
            />

            <div className="relative flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-emerald-100">
                <Store className="w-3.5 h-3.5" />
                <span>{isBn ? 'স্টোর প্রোফাইল' : 'Store Profile'}</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
                className="absolute right-0 -top-1 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Centered Overlapping Store Logo */}
          <div className="px-4 pb-4 -mt-9 relative">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 p-1.5 shadow-lg ring-4 ring-white dark:ring-slate-900 border-2 border-[#00A862] flex items-center justify-center overflow-hidden">
              <img
                src="/assets/drawable/ic_siaam_store_logo.png"
                alt="Siaam Store Logo"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>

            {/* Centered Brand Name & Location */}
            <div className="mt-2 text-center space-y-0.5">
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                {isBn ? 'সিয়াম স্টোর' : 'Siaam Store'}
              </h3>
              <p className="text-[11px] font-bold text-[#008A54] dark:text-emerald-400">
                {isBn ? 'Siaam Store' : 'সিয়াম স্টোর'}
              </p>
              <div className="pt-0.5 flex items-center justify-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-[#00965E] shrink-0" />
                <span>
                  {isBn
                    ? 'রামচন্দ্রপুর হাট, চাঁপাইনবাবগঞ্জ'
                    : 'Ramchandrapur Haat, Chapainawabganj'}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isBn
                  ? `খুচরা ও পাইকারি · টাকা (৳) · ভার্সন ${toBengaliDigits(APP_VERSION_NAME, language)}`
                  : `Retail & Wholesale · Currency BDT (৳) · V${APP_VERSION_NAME}`}
              </p>
            </div>

            {/* Centered 4-Column Live Store Snapshot */}
            <div className="mt-2.5 grid grid-cols-4 gap-1.5">
              {stats.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl bg-emerald-50/70 dark:bg-slate-800/80 border border-emerald-100 dark:border-slate-700/80 py-2 px-1 text-center flex flex-col items-center justify-center"
                  >
                    <Icon className="w-3.5 h-3.5 text-[#00965E] dark:text-emerald-400 mb-0.5" />
                    <span className="text-xs font-black tabular-nums text-slate-900 dark:text-white leading-none">
                      {item.value}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-full">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Centered Store Details & Direct Call Numbers */}
            <div className="mt-2.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-200/70 dark:divide-slate-700/70">
              <div className="grid grid-cols-2 divide-x divide-slate-200/70 dark:divide-slate-700/70 text-center">
                <div className="p-2">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                    <Building2 className="w-3 h-3 text-[#00965E]" />
                    <span>{isBn ? 'ব্যবসার ধরন' : 'Store Type'}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-800 dark:text-slate-100">
                    {isBn ? 'মুদি ও ভ্যারাইটি স্টোর' : 'General & Retail'}
                  </p>
                </div>
                <div className="p-2">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                    <Smartphone className="w-3 h-3 text-[#00965E]" />
                    <span>{isBn ? 'সিস্টেম সিঙ্ক' : 'Cloud ERP'}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-800 dark:text-slate-100">
                    {isBn ? 'ওয়েব ও অ্যান্ড্রয়েড' : 'Web & Android'}
                  </p>
                </div>
              </div>

              <div className="p-2.5 text-center space-y-1.5">
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {isBn ? 'যোগাযোগ ও ভাউচার নম্বর' : 'Contact & Voucher Numbers'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="tel:01740999627"
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 hover:border-[#00965E] text-[#008A54] dark:text-emerald-400 font-bold text-xs tabular-nums flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{isBn ? '০১৭৪০৯৯৯৬২৭' : '01740999627'}</span>
                  </a>
                  <a
                    href="tel:01303033353"
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 hover:border-[#00965E] text-[#008A54] dark:text-emerald-400 font-bold text-xs tabular-nums flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{isBn ? '০১৩০৩০৩৩৩৫৩' : '01303033353'}</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyStoreInfo}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedStore ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00965E]" />
                    <span className="text-[#008A54] dark:text-emerald-400">
                      {isBn ? 'কপি হয়েছে' : 'Copied'}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isBn ? 'তথ্য কপি' : 'Copy Info'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[40px] py-2 rounded-xl bg-[#00965E] hover:bg-[#007D4E] text-white text-xs font-extrabold tracking-wide shadow-sm transition-colors cursor-pointer"
              >
                {isBn ? 'ঠিক আছে' : 'Close'}
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================
            LAPTOP / DESKTOP LAYOUT (md: and up): Widescreen 2-Column Card
           ============================================================ */}
        <div className="hidden md:grid md:grid-cols-12 md:items-stretch">
          {/* Left Column: Emerald Brand Identity Panel */}
          <div className="md:col-span-5 relative bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#00A862] p-6 text-center text-white flex flex-col items-center justify-center overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 -left-12 w-36 h-36 rounded-full border border-white/15 bg-white/5"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-14 -right-10 w-44 h-44 rounded-full border border-white/15 bg-white/5"
            />

            <span className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-bold tracking-wide text-emerald-50 mb-4">
              <Store className="w-3.5 h-3.5" />
              <span>{isBn ? 'স্টোর প্রোফাইল' : 'Store Profile'}</span>
            </span>

            <div className="relative w-24 h-24 rounded-3xl bg-white p-2 shadow-xl ring-4 ring-white/25 border-2 border-[#A7F3D0] flex items-center justify-center overflow-hidden">
              <img
                src="/assets/drawable/ic_siaam_store_logo.png"
                alt="Siaam Store Logo"
                className="w-full h-full object-contain rounded-2xl"
              />
            </div>

            <h3 className="relative mt-4 text-2xl font-black tracking-tight text-white">
              {isBn ? 'সিয়াম স্টোর' : 'Siaam Store'}
            </h3>
            <p className="relative text-xs font-bold text-emerald-200 mt-0.5">
              {isBn ? 'Siaam Store' : 'সিয়াম স্টোর'}
            </p>

            <div className="relative mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/20 border border-white/15 text-xs font-semibold text-emerald-50">
              <MapPin className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>
                {isBn
                  ? 'রামচন্দ্রপুর হাট, চাঁপাইনবাবগঞ্জ'
                  : 'Ramchandrapur Haat, Chapainawabganj'}
              </span>
            </div>

            <p className="relative mt-3 text-[11px] font-medium text-emerald-100/90">
              {isBn
                ? `খুচরা ও পাইকারি · টাকা (৳) · ভার্সন ${toBengaliDigits(APP_VERSION_NAME, language)}`
                : `Retail & Wholesale · Currency BDT (৳) · V${APP_VERSION_NAME}`}
            </p>
          </div>

          {/* Right Column: Live Snapshot, Business Details, Call Numbers & Actions */}
          <div className="md:col-span-7 p-6 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="text-left">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {isBn ? 'স্টোর সারসংক্ষেপ ও যোগাযোগ' : 'Store Snapshot & Contact'}
                </h4>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isBn
                    ? 'লাইভ ইনভেন্টরি, কাস্টমার ও ভাউচার তথ্য'
                    : 'Live inventory, customer & voucher details'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4-Column Live Store Snapshot */}
            <div className="grid grid-cols-4 gap-2.5">
              {stats.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl bg-emerald-50/70 dark:bg-slate-800/80 border border-emerald-100 dark:border-slate-700/80 py-3 px-2 text-center flex flex-col items-center justify-center"
                  >
                    <Icon className="w-4 h-4 text-[#00965E] dark:text-emerald-400 mb-1" />
                    <span className="text-base font-black tabular-nums text-slate-900 dark:text-white leading-none">
                      {item.value}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1 truncate max-w-full">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Store Details & Direct Call Numbers */}
            <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-200/70 dark:divide-slate-700/70">
              <div className="grid grid-cols-2 divide-x divide-slate-200/70 dark:divide-slate-700/70 text-center">
                <div className="p-3">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#00965E]" />
                    <span>{isBn ? 'ব্যবসার ধরন' : 'Store Type'}</span>
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                    {isBn ? 'মুদি ও ভ্যারাইটি স্টোর' : 'General & Retail'}
                  </p>
                </div>
                <div className="p-3">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-[#00965E]" />
                    <span>{isBn ? 'সিস্টেম সিঙ্ক' : 'Cloud ERP'}</span>
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                    {isBn ? 'ওয়েব ও অ্যান্ড্রয়েড' : 'Web & Android'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 text-center space-y-2">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {isBn ? 'যোগাযোগ ও ভাউচার নম্বর' : 'Contact & Voucher Numbers'}
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <a
                    href="tel:01740999627"
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 hover:border-[#00965E] text-[#008A54] dark:text-emerald-400 font-bold text-xs tabular-nums flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{isBn ? '০১৭৪০৯৯৯৬২৭' : '01740999627'}</span>
                  </a>
                  <a
                    href="tel:01303033353"
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 hover:border-[#00965E] text-[#008A54] dark:text-emerald-400 font-bold text-xs tabular-nums flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{isBn ? '০১৩০৩০৩৩৩৫৩' : '01303033353'}</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCopyStoreInfo}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedStore ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00965E]" />
                    <span className="text-[#008A54] dark:text-emerald-400">
                      {isBn ? 'কপি হয়েছে' : 'Copied'}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isBn ? 'তথ্য কপি' : 'Copy Info'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[42px] py-2 rounded-xl bg-[#00965E] hover:bg-[#007D4E] text-white text-xs font-extrabold tracking-wide shadow-sm transition-colors cursor-pointer"
              >
                {isBn ? 'ঠিক আছে' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

interface DeveloperProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: AppLanguage;
}

const DEV_PHOTOS = [
  {
    src: '/assets/drawable/img_developer_photo_1.png',
    labelEn: 'Portrait',
    labelBn: 'পোর্ট্রেট',
  },
  {
    src: '/assets/drawable/img_developer_photo_2.png',
    labelEn: 'Sketch',
    labelBn: 'স্কেচ',
  },
];

export const DeveloperProfileModal: React.FC<DeveloperProfileModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const isBn = language === AppLanguage.BENGALI;
  const [photoIdx, setPhotoIdx] = useState(0);
  const [copiedEmail, setCopiedEmail] = useState(false);

  if (!isOpen || typeof document === 'undefined') return null;

  const activePhoto = DEV_PHOTOS[photoIdx] || DEV_PHOTOS[0];

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText('themadkafi@gmail.com');
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const versionDisplay = isBn
    ? `সিয়াম স্টোর V${toBengaliDigits(APP_VERSION_NAME, language)}`
    : `Siaam Store V${APP_VERSION_NAME}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isBn ? 'অ্যাপ ডেভেলপার' : 'About App Developer'}
    >
      <div
        className="w-full max-w-md md:max-w-2xl lg:max-w-3xl max-h-[calc(100dvh-20px)] sm:max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================
            SMARTPHONE / MOBILE LAYOUT (< md): Unchanged Vertical Card
           ============================================================ */}
        <div className="md:hidden">
          {/* Decorated Centered Emerald & Teal Header Banner */}
          <div className="relative bg-gradient-to-br from-[#022C22] via-[#065F46] to-[#00A862] px-4 pt-3 pb-11 text-center overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full border border-white/15 bg-white/5"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-14 -left-12 w-36 h-36 rounded-full border border-white/15 bg-white/5"
            />

            <div className="relative flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-emerald-100">
                <Code2 className="w-3.5 h-3.5" />
                <span>{isBn ? 'অ্যাপ ডেভেলপার' : 'App Developer'}</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
                className="absolute right-0 -top-1 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Centered Overlapping Portrait with Interactive Toggle */}
          <div className="px-4 pb-3.5 -mt-10 relative text-center">
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setPhotoIdx((prev) => (prev + 1) % DEV_PHOTOS.length)}
                title={isBn ? 'ছবি পরিবর্তন করতে ট্যাপ করুন' : 'Tap to switch photo'}
                className="group relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-white dark:ring-slate-900 border-2 border-[#00A862] shadow-lg bg-slate-100 dark:bg-slate-800 cursor-pointer block mx-auto"
              >
                <img
                  src={activePhoto.src}
                  alt="Abdullahil Kuafi"
                  className="w-full h-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
                />
              </button>
              <button
                type="button"
                onClick={() => setPhotoIdx((prev) => (prev + 1) % DEV_PHOTOS.length)}
                aria-label={isBn ? 'ছবি বদলান' : 'Switch Portrait'}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#00965E] hover:bg-[#007D4E] text-white border-2 border-white dark:border-slate-900 shadow flex items-center justify-center transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Interactive Photo Mode Segmented Control */}
            <div className="mt-1.5 inline-flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800">
              {DEV_PHOTOS.map((photo, idx) => (
                <button
                  key={photo.src}
                  type="button"
                  onClick={() => setPhotoIdx(idx)}
                  className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    photoIdx === idx
                      ? 'bg-white dark:bg-slate-700 text-[#008A54] dark:text-emerald-300 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {isBn ? photo.labelBn : photo.labelEn}
                </button>
              ))}
            </div>

            {/* Centered Developer Name & Clean Metadata */}
            <div className="mt-1.5 space-y-0.5">
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                {isBn ? 'আব্দুল্লাহিল কাফি' : 'Abdullahil Kuafi'}
              </h3>
              <p className="text-[11px] font-bold text-[#008A54] dark:text-emerald-400">
                {versionDisplay} ·{' '}
                {isBn ? 'ফুল-স্ট্যাক ও অ্যান্ড্রয়েড ডেভেলপার' : 'Full-Stack & Android Developer'}
              </p>
              <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <GraduationCap className="w-3.5 h-3.5 text-[#00965E] shrink-0" />
                <span>
                  {isBn
                    ? 'সরকারি তিতুমীর কলেজ, ঢাকা'
                    : 'Government Titumir College, Dhaka'}
                </span>
              </div>
            </div>

            {/* Centered Bio Panel */}
            <div className="mt-2 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60 px-3 py-2 text-center">
              <p className="text-[11px] leading-snug font-medium text-slate-700 dark:text-slate-200">
                {isBn
                  ? 'সরকারি তিতুমীর কলেজ, ঢাকা-এর একজন প্রযুক্তি-প্রেমী এবং প্রোডাক্টিভিটি-কেন্দ্রিক অ্যাপ ডেভেলপার। ক্ষুদ্র ও মাঝারি ব্যবসার আধুনিক ডিজিটাল হিসাবরক্ষণের জন্য সিয়াম স্টোর তৈরি করা হয়েছে।'
                  : 'A tech enthusiast and productivity-focused app developer from Government Titumir College, Dhaka. Built Siaam Store to bring effortless cloud accounting & POS to modern retail businesses.'}
              </p>
            </div>

            {/* Centered 3-Column App Craft Highlights */}
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 py-1.5 px-1.5 text-center">
                <Sparkles className="w-3.5 h-3.5 text-[#00965E] dark:text-emerald-400 mx-auto mb-0.5" />
                <p className="text-[11px] font-black tabular-nums text-slate-900 dark:text-white leading-tight">
                  V{toBengaliDigits(APP_VERSION_NAME, language)}
                </p>
                <p className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400">
                  {isBn ? 'বর্তমান ভার্সন' : 'Release'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 py-1.5 px-1.5 text-center">
                <Smartphone className="w-3.5 h-3.5 text-[#00965E] dark:text-emerald-400 mx-auto mb-0.5" />
                <p className="text-[11px] font-black text-slate-900 dark:text-white leading-tight">
                  {isBn ? 'ওয়েব ও অ্যাপ' : 'Web & App'}
                </p>
                <p className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400">
                  {isBn ? 'প্ল্যাটফর্ম' : 'Platforms'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 py-1.5 px-1.5 text-center">
                <Layers className="w-3.5 h-3.5 text-[#00965E] dark:text-emerald-400 mx-auto mb-0.5" />
                <p className="text-[11px] font-black text-slate-900 dark:text-white leading-tight">
                  Firestore
                </p>
                <p className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400">
                  {isBn ? 'ক্লাউড সিঙ্ক' : 'Cloud Sync'}
                </p>
              </div>
            </div>

            {/* Unboxed Tech Stack Line */}
            <p className="mt-1.5 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
              React · TypeScript · Kotlin · Jetpack Compose · Firebase
            </p>

            {/* Divider */}
            <div className="my-2 border-t border-slate-200/80 dark:border-slate-800" />

            {/* Centered Contact the Developer Grid */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-extrabold text-[#065F46] dark:text-emerald-400">
                {isBn ? 'ডেভেলপারের সাথে যোগাযোগ' : 'Contact the Developer'}
              </p>

              <div className="grid grid-cols-2 gap-1.5">
                <a
                  href="https://fb.me/themadkafi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 dark:bg-slate-800 dark:hover:bg-slate-700 border border-emerald-200/90 dark:border-slate-700 text-[#065F46] dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>{isBn ? 'ফেসবুক' : 'Facebook'}</span>
                </a>

                <a
                  href="https://m.me/themadkafi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 dark:bg-slate-800 dark:hover:bg-slate-700 border border-emerald-200/90 dark:border-slate-700 text-[#065F46] dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span>{isBn ? 'মেসেঞ্জার' : 'Messenger'}</span>
                </a>

                <a
                  href="https://wa.me/8801313209156"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 dark:bg-slate-800 dark:hover:bg-slate-700 border border-emerald-200/90 dark:border-slate-700 text-[#065F46] dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{isBn ? 'হোয়াটসঅ্যাপ' : 'WhatsApp'}</span>
                </a>

                <a
                  href="mailto:themadkafi@gmail.com"
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 dark:bg-slate-800 dark:hover:bg-slate-700 border border-emerald-200/90 dark:border-slate-700 text-[#065F46] dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span>{isBn ? 'ইমেইল' : 'Email'}</span>
                </a>
              </div>

              {/* 1-Tap Copy Email Convenience Row */}
              <button
                type="button"
                onClick={handleCopyEmail}
                className="w-full min-h-[34px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00965E]" />
                    <span className="text-[#008A54] dark:text-emerald-400 font-bold">
                      {isBn
                        ? 'ইমেইল কপি হয়েছে (themadkafi@gmail.com)'
                        : 'Copied themadkafi@gmail.com'}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>themadkafi@gmail.com</span>
                  </>
                )}
              </button>
            </div>

            {/* Footer Close CTA */}
            <div className="mt-2.5 space-y-1.5">
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[38px] py-2 rounded-xl bg-[#00965E] hover:bg-[#007D4E] text-white text-xs font-extrabold tracking-wide shadow-sm transition-colors cursor-pointer"
              >
                {isBn ? 'ঠিক আছে' : 'Close'}
              </button>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                {isBn
                  ? '© সিয়াম স্টোর · যত্নে নির্মিত বাংলাদেশে'
                  : '© Siaam Store · Crafted with care in Bangladesh'}
              </p>
            </div>
          </div>
        </div>

        {/* ============================================================
            LAPTOP / DESKTOP LAYOUT (md: and up): Widescreen 2-Column Card
           ============================================================ */}
        <div className="hidden md:grid md:grid-cols-12 md:items-stretch">
          {/* Left Column: Developer Portrait, Mode Switcher & Identity */}
          <div className="md:col-span-5 relative bg-gradient-to-br from-[#022C22] via-[#065F46] to-[#00A862] p-6 text-center text-white flex flex-col items-center justify-center overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full border border-white/15 bg-white/5"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-14 -left-12 w-40 h-40 rounded-full border border-white/15 bg-white/5"
            />

            <span className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-bold tracking-wide text-emerald-50 mb-4">
              <Code2 className="w-3.5 h-3.5" />
              <span>{isBn ? 'অ্যাপ ডেভেলপার' : 'App Developer'}</span>
            </span>

            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setPhotoIdx((prev) => (prev + 1) % DEV_PHOTOS.length)}
                title={isBn ? 'ছবি পরিবর্তন করতে ট্যাপ করুন' : 'Tap to switch photo'}
                className="group relative w-28 h-28 rounded-full overflow-hidden ring-4 ring-white/25 border-2 border-[#A7F3D0] shadow-xl bg-slate-100 dark:bg-slate-800 cursor-pointer block mx-auto"
              >
                <img
                  src={activePhoto.src}
                  alt="Abdullahil Kuafi"
                  className="w-full h-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
                />
              </button>
              <button
                type="button"
                onClick={() => setPhotoIdx((prev) => (prev + 1) % DEV_PHOTOS.length)}
                aria-label={isBn ? 'ছবি বদলান' : 'Switch Portrait'}
                className="absolute bottom-0.5 right-0.5 w-8 h-8 rounded-full bg-[#00965E] hover:bg-[#007D4E] text-white border-2 border-white shadow flex items-center justify-center transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Interactive Photo Mode Segmented Control */}
            <div className="relative mt-3 inline-flex items-center gap-1 p-1 rounded-xl bg-black/25 border border-white/15">
              {DEV_PHOTOS.map((photo, idx) => (
                <button
                  key={photo.src}
                  type="button"
                  onClick={() => setPhotoIdx(idx)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    photoIdx === idx
                      ? 'bg-white text-[#064E3B] shadow-xs'
                      : 'text-emerald-100 hover:text-white'
                  }`}
                >
                  {isBn ? photo.labelBn : photo.labelEn}
                </button>
              ))}
            </div>

            <h3 className="relative mt-3.5 text-2xl font-black tracking-tight text-white">
              {isBn ? 'আব্দুল্লাহিল কাফি' : 'Abdullahil Kuafi'}
            </h3>
            <p className="relative mt-1 text-xs font-bold text-emerald-200">
              {isBn ? 'ফুল-স্ট্যাক ও অ্যান্ড্রয়েড ডেভেলপার' : 'Full-Stack & Android Developer'}
            </p>
            <p className="relative text-[11px] font-semibold text-emerald-100/90 mt-0.5">
              {versionDisplay}
            </p>

            <div className="relative mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/20 border border-white/15 text-xs font-semibold text-emerald-50">
              <GraduationCap className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>
                {isBn
                  ? 'সরকারি তিতুমীর কলেজ, ঢাকা'
                  : 'Government Titumir College, Dhaka'}
              </span>
            </div>
          </div>

          {/* Right Column: Bio, Craft Highlights, Tech Stack & Contact Actions */}
          <div className="md:col-span-7 p-6 flex flex-col justify-between space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="text-left">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {isBn ? 'ডেভেলপার পরিচিতি ও যোগাযোগ' : 'Developer Bio & Contact'}
                </h4>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  React · TypeScript · Kotlin · Jetpack Compose · Firebase
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bio Panel */}
            <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60 px-4 py-3 text-left">
              <p className="text-xs leading-relaxed font-medium text-slate-700 dark:text-slate-200">
                {isBn
                  ? 'সরকারি তিতুমীর কলেজ, ঢাকা-এর একজন প্রযুক্তি-প্রেমী এবং প্রোডাক্টিভিটি-কেন্দ্রিক অ্যাপ ডেভেলপার। ক্ষুদ্র ও মাঝারি ব্যবসার আধুনিক ডিজিটাল হিসাবরক্ষণের জন্য সিয়াম স্টোর তৈরি করা হয়েছে।'
                  : 'A tech enthusiast and productivity-focused app developer from Government Titumir College, Dhaka. Built Siaam Store to bring effortless cloud accounting & POS to modern retail businesses.'}
              </p>
            </div>

            {/* 3-Column App Craft Highlights */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 py-2.5 px-2 text-center">
                <Sparkles className="w-3.5 h-3.5 text-[#00965E] dark:text-emerald-400 mx-auto mb-1" />
                <p className="text-xs font-black tabular-nums text-slate-900 dark:text-white">
                  V{toBengaliDigits(APP_VERSION_NAME, language)}
                </p>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {isBn ? 'বর্তমান ভার্সন' : 'Release'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 py-2.5 px-2 text-center">
                <Smartphone className="w-3.5 h-3.5 text-[#00965E] dark:text-emerald-400 mx-auto mb-1" />
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  {isBn ? 'ওয়েব ও অ্যাপ' : 'Web & App'}
                </p>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {isBn ? 'প্ল্যাটফর্ম' : 'Platforms'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 py-2.5 px-2 text-center">
                <Layers className="w-3.5 h-3.5 text-[#00965E] dark:text-emerald-400 mx-auto mb-1" />
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  Firestore
                </p>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {isBn ? 'ক্লাউড সিঙ্ক' : 'Cloud Sync'}
                </p>
              </div>
            </div>

            {/* Contact the Developer Grid */}
            <div className="space-y-2">
              <p className="text-xs font-extrabold text-[#065F46] dark:text-emerald-400">
                {isBn ? 'ডেভেলপারের সাথে যোগাযোগ' : 'Contact the Developer'}
              </p>

              <div className="grid grid-cols-4 gap-2">
                <a
                  href="https://fb.me/themadkafi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 dark:bg-slate-800 dark:hover:bg-slate-700 border border-emerald-200/90 dark:border-slate-700 text-[#065F46] dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>{isBn ? 'ফেসবুক' : 'Facebook'}</span>
                </a>

                <a
                  href="https://m.me/themadkafi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 dark:bg-slate-800 dark:hover:bg-slate-700 border border-emerald-200/90 dark:border-slate-700 text-[#065F46] dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span>{isBn ? 'মেসেঞ্জার' : 'Messenger'}</span>
                </a>

                <a
                  href="https://wa.me/8801313209156"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 dark:bg-slate-800 dark:hover:bg-slate-700 border border-emerald-200/90 dark:border-slate-700 text-[#065F46] dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{isBn ? 'হোয়াটসঅ্যাপ' : 'WhatsApp'}</span>
                </a>

                <a
                  href="mailto:themadkafi@gmail.com"
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 dark:bg-slate-800 dark:hover:bg-slate-700 border border-emerald-200/90 dark:border-slate-700 text-[#065F46] dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span>{isBn ? 'ইমেইল' : 'Email'}</span>
                </a>
              </div>

              {/* 1-Tap Copy Email + Close Button Row */}
              <div className="grid grid-cols-12 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="col-span-7 min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedEmail ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#00965E]" />
                      <span className="text-[#008A54] dark:text-emerald-400 font-bold">
                        {isBn
                          ? 'ইমেইল কপি হয়েছে'
                          : 'Copied themadkafi@gmail.com'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>themadkafi@gmail.com</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="col-span-5 min-h-[40px] py-2 rounded-xl bg-[#00965E] hover:bg-[#007D4E] text-white text-xs font-extrabold tracking-wide shadow-sm transition-colors cursor-pointer"
                >
                  {isBn ? 'ঠিক আছে' : 'Close'}
                </button>
              </div>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 text-right">
                {isBn
                  ? '© সিয়াম স্টোর · যত্নে নির্মিত বাংলাদেশে'
                  : '© Siaam Store · Crafted with care in Bangladesh'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
