import React, { useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  isBengali?: boolean;
  variant?: 'header' | 'auth';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  isBengali = false,
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Already running as an installed Home Screen / standalone app
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop native install prompt
  if (isInstallable) {
    if (variant === 'auth') {
      return (
        <button
          type="button"
          onClick={() => void install()}
          className="w-full mt-2.5 h-[42px] rounded-[14px] bg-[#ECFDF5] hover:bg-[#D1FAE5] border border-[#A7F3D0] text-[#065F46] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#00965E]" />
          <span>{isBengali ? 'অ্যাপ ইনস্টল করুন' : 'Install Siaam Store App'}</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => void install()}
        className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
        title={isBengali ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">
          {isBengali ? 'ইনস্টল' : 'Install'}
        </span>
      </button>
    );
  }

  // iOS Safari / iPadOS flow (WebKit requires Add to Home Screen via Share menu)
  if (isIOS) {
    return (
      <>
        {variant === 'auth' ? (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="w-full mt-2.5 h-[42px] rounded-[14px] bg-[#ECFDF5] hover:bg-[#D1FAE5] border border-[#A7F3D0] text-[#065F46] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-[#00965E]" />
            <span>
              {isBengali
                ? 'iPhone / iPad-এ হোম স্ক্রিনে যোগ করুন'
                : 'Add App Icon on iPhone / iPad'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
            title={
              isBengali
                ? 'iPhone / iPad-এ ইনস্টল করুন'
                : 'Install on iPhone / iPad'
            }
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isBengali ? 'ইনস্টল' : 'Install'}
            </span>
          </button>
        )}

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl text-slate-900 dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-[12px] overflow-hidden bg-[#1D3BB8] border border-emerald-200 dark:border-emerald-800 shadow-sm shrink-0">
                    <img
                      src="/apple-touch-icon.png"
                      alt="Siaam Store Icon"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#064E3B] dark:text-emerald-200">
                      {isBengali
                        ? 'iPhone / iPad-এ অ্যাপ ইনস্টল'
                        : 'Install on iPhone / iPad'}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {isBengali
                        ? 'Safari থেকে হোম স্ক্রিনে আইকন যোগ করুন'
                        : 'Add Siaam Store icon to your Home Screen'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-[#E6F8F0] dark:bg-emerald-950 text-[#00965E] dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Share className="w-4 h-4" />
                  </div>
                  <p className="leading-relaxed">
                    {isBengali ? (
                      <>
                        ১. Safari ব্রাউজারের নিচে{' '}
                        <strong className="text-slate-900 dark:text-white">
                          Share (↑)
                        </strong>{' '}
                        বাটনে ট্যাপ করুন।
                      </>
                    ) : (
                      <>
                        1. Open in <strong>Safari</strong> and tap the{' '}
                        <strong className="text-slate-900 dark:text-white">
                          Share
                        </strong>{' '}
                        button at the bottom bar.
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-[#E6F8F0] dark:bg-emerald-950 text-[#00965E] dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <p className="leading-relaxed">
                    {isBengali ? (
                      <>
                        ২. নিচে স্ক্রল করে{' '}
                        <strong className="text-slate-900 dark:text-white">
                          Add to Home Screen
                        </strong>{' '}
                        সিলেক্ট করে{' '}
                        <strong className="text-slate-900 dark:text-white">
                          Add
                        </strong>{' '}
                        ট্যাপ করুন।
                      </>
                    ) : (
                      <>
                        2. Scroll down, tap{' '}
                        <strong className="text-slate-900 dark:text-white">
                          Add to Home Screen
                        </strong>
                        , then tap{' '}
                        <strong className="text-slate-900 dark:text-white">
                          Add
                        </strong>
                        .
                      </>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full py-2.5 rounded-xl bg-[#00965E] hover:bg-[#057A50] text-white text-xs font-bold transition cursor-pointer"
              >
                {isBengali ? 'বুঝেছি' : 'Got It'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
