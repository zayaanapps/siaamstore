import React from 'react';
import { motion } from 'motion/react';

interface StoreLoadingScreenProps {
  isBengali: boolean;
  mode: 'startup' | 'post-login';
  subtitle?: string;
}

export const StoreLoadingScreen: React.FC<StoreLoadingScreenProps> = ({
  isBengali,
  mode,
  subtitle,
}) => {
  const statusText =
    subtitle ||
    (mode === 'post-login'
      ? isBengali
        ? 'স্টোরের তথ্য লোড হচ্ছে...'
        : 'Loading your store...'
      : isBengali
      ? 'সিয়াম স্টোর চালু হচ্ছে...'
      : 'Starting Siaam Store...');

  return (
    <motion.div
      key={`store-loader-${mode}`}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-gradient-to-b from-[#E9F7F3] via-[#F4FAF8] to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 select-none"
    >
      {/* Subtle Ambient Glow Behind Logo */}
      <div className="relative flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.22, 0.42, 0.22] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute w-36 h-36 rounded-full bg-[#00965E]/25 dark:bg-emerald-500/20 blur-2xl pointer-events-none"
        />

        {/* Smooth Rotating Orbital Ring Around Logo */}
        <svg
          className="w-[126px] h-[126px] siaam-spin-smooth"
          viewBox="0 0 126 126"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="63"
            cy="63"
            r="57"
            stroke="currentColor"
            className="text-emerald-200/70 dark:text-emerald-950"
            strokeWidth="3.5"
          />
          <circle
            cx="63"
            cy="63"
            r="57"
            stroke="url(#siaamLoaderGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="118 240"
          />
          <defs>
            <linearGradient
              id="siaamLoaderGradient"
              x1="6"
              y1="6"
              x2="120"
              y2="120"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#064E3B" />
              <stop offset="50%" stopColor="#00965E" />
              <stop offset="100%" stopColor="#34D399" stopOpacity="0.15" />
            </linearGradient>
          </defs>
        </svg>

        {/* Centered Siaam Store Logo Badge */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute p-1.5 rounded-[24px] bg-gradient-to-br from-[#E6F8F0] via-white to-[#D1FAE5] dark:from-slate-800 dark:via-slate-900 dark:to-emerald-950 border border-[#A7F3D0] dark:border-emerald-700/60 shadow-[0_12px_28px_rgba(0,150,94,0.18)]"
        >
          <div className="w-[78px] h-[78px] rounded-[18px] overflow-hidden bg-[#1D3BB8] shadow-inner flex items-center justify-center">
            <img
              src="/assets/drawable/ic_siaam_store_logo.png"
              alt="Siaam Store"
              className="w-full h-full object-cover scale-[1.04]"
            />
          </div>
        </motion.div>
      </div>

      {/* Store Title */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 flex flex-col items-center text-center"
      >
        <h2 className="text-[20px] font-black tracking-tight text-[#064E3B] dark:text-emerald-200">
          সিয়াম স্টোর <span className="font-semibold text-[#00965E] dark:text-emerald-400">|</span> Siaam Store
        </h2>

        {/* Smooth Sliding Shimmer Progress Track */}
        <div className="mt-3.5 w-36 h-1 rounded-full bg-emerald-100 dark:bg-slate-800 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-[#00965E] to-transparent siaam-shimmer-bar" />
        </div>

        <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
          {statusText}
        </p>
      </motion.div>
    </motion.div>
  );
};
