import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  History,
  Search,
  FileDown,
  Printer,
  X,
  Clock,
  User,
  ShoppingBag,
  Package,
  Users,
  Truck,
  Wallet,
  Settings,
  Shield,
  Trash2,
  Calendar,
  Layers,
  Copy,
  Check,
  Activity,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  AppLanguage,
  AuditLog,
  formatTimestamp,
  toBengaliDigits,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';

interface AuditLogViewProps {
  auditLogs: AuditLog[];
  strings: DokanTranslations;
  language: AppLanguage;
  onBack: () => void;
}

type LogTimeFilter = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL';

function getModuleMeta(moduleName: string) {
  const m = (moduleName || '').toLowerCase();
  if (m.includes('sale') || m.includes('pos')) {
    return {
      icon: ShoppingBag,
      badge:
        'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-[#007a4d] dark:text-emerald-300',
      iconBg:
        'bg-emerald-50 dark:bg-emerald-900/30 text-[#00965E] border-emerald-200 dark:border-emerald-800',
    };
  }
  if (m.includes('inventory') || m.includes('product') || m.includes('stock')) {
    return {
      icon: Package,
      badge:
        'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
      iconBg:
        'bg-blue-50 dark:bg-blue-900/30 text-blue-600 border-blue-200 dark:border-blue-800',
    };
  }
  if (m.includes('customer') || m.includes('due')) {
    return {
      icon: Users,
      badge:
        'bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300',
      iconBg:
        'bg-violet-50 dark:bg-violet-900/30 text-violet-600 border-violet-200 dark:border-violet-800',
    };
  }
  if (m.includes('supplier') || m.includes('purchase')) {
    return {
      icon: Truck,
      badge:
        'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
      iconBg:
        'bg-amber-50 dark:bg-amber-900/30 text-amber-600 border-amber-200 dark:border-amber-800',
    };
  }
  if (m.includes('account') || m.includes('cash') || m.includes('expense')) {
    return {
      icon: Wallet,
      badge:
        'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300',
      iconBg:
        'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 border-cyan-200 dark:border-cyan-800',
    };
  }
  if (m.includes('delete') || m.includes('recycle') || m.includes('void')) {
    return {
      icon: Trash2,
      badge:
        'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
      iconBg:
        'bg-red-50 dark:bg-red-900/30 text-red-600 border-red-200 dark:border-red-800',
    };
  }
  if (m.includes('setting') || m.includes('staff')) {
    return {
      icon: Settings,
      badge:
        'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300',
      iconBg:
        'bg-orange-50 dark:bg-orange-900/30 text-orange-600 border-orange-200 dark:border-orange-800',
    };
  }
  return {
    icon: Shield,
    badge:
      'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
    iconBg:
      'bg-slate-100 dark:bg-slate-900 text-slate-600 border-slate-200 dark:border-slate-700',
  };
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  auditLogs,
  strings,
  language,
  onBack,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const fmtNum = (val: string | number) => toBengaliDigits(val, language);

  // Filters
  const [timeFilter, setTimeFilter] = useState<LogTimeFilter>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [actorFilter, setActorFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // PDF Report Modal
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfSheetRef = useRef<HTMLDivElement | null>(null);

  // Time boundaries
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Dynamic unique modules & actors
  const uniqueModules = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.module?.trim()) set.add(l.module.trim());
    });
    return Array.from(set).sort();
  }, [auditLogs]);

  const uniqueActors = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.actorName?.trim()) set.add(l.actorName.trim());
    });
    return Array.from(set).sort();
  }, [auditLogs]);

  const todayCount = useMemo(
    () =>
      auditLogs.filter(
        (l) => (l.createdAt?.toMillis?.() ?? 0) >= startOfToday
      ).length,
    [auditLogs, startOfToday]
  );

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const ms = log.createdAt?.toMillis?.() ?? 0;
      if (timeFilter === 'TODAY' && ms < startOfToday) return false;
      if (timeFilter === 'THIS_WEEK' && ms < startOfWeek) return false;
      if (timeFilter === 'THIS_MONTH' && ms < startOfMonth) return false;

      if (
        moduleFilter !== 'ALL' &&
        (log.module || '').trim() !== moduleFilter
      ) {
        return false;
      }
      if (
        actorFilter !== 'ALL' &&
        (log.actorName || '').trim() !== actorFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        (log.action || '').toLowerCase().includes(q) ||
        (log.module || '').toLowerCase().includes(q) ||
        (log.actorName || '').toLowerCase().includes(q)
      );
    });
  }, [
    auditLogs,
    timeFilter,
    moduleFilter,
    actorFilter,
    searchQuery,
    startOfToday,
    startOfWeek,
    startOfMonth,
  ]);

  // Group filtered logs by date
  const groupedLogs = useMemo(() => {
    const groups: Array<{ dateKey: string; label: string; logs: AuditLog[] }> =
      [];
    const map = new Map<string, AuditLog[]>();

    for (const log of filteredLogs) {
      const ms = log.createdAt?.toMillis?.() ?? Date.now();
      const d = new Date(ms);
      const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
        let label = d.toLocaleDateString(isBengali ? 'bn-BD' : 'en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        if (ms >= startOfToday) {
          label = isBengali ? 'আজ (Today)' : 'Today';
        } else if (ms >= startOfYesterday) {
          label = isBengali ? 'গতকাল (Yesterday)' : 'Yesterday';
        }
        groups.push({ dateKey, label, logs: map.get(dateKey)! });
      }
      map.get(dateKey)!.push(log);
    }
    return groups;
  }, [filteredLogs, isBengali, startOfToday, startOfYesterday]);

  const handleCopyLog = async (log: AuditLog) => {
    const text = `[${log.module}] ${log.action} — by ${log.actorName} (${formatTimestamp(
      log.createdAt
    )})`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(log.id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === log.id ? null : prev));
    }, 1500);
  };

  // PDF Export & Print
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
      pdf.save(`Siaam_Store_Audit_Log_${stamp}.pdf`);
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
          <title>Siaam Store — Audit Log</title>
          <style>
            * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            body { margin: 16px; color: #0f172a; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: 700; }
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

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3.5 pb-24">
      {/* Decorated Emerald Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#00965E] via-[#008452] to-[#006640] text-white p-4 shadow-md border border-emerald-400/20">
        <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-10 w-40 h-40 rounded-full bg-emerald-300/15 blur-2xl" />

        <div className="relative space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/15 text-xs font-bold cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isBengali ? 'টুলস' : 'Tools'}</span>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <History className="w-4 h-4 text-emerald-50" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-base sm:text-lg font-black tracking-tight leading-none">
                      {strings.menuAuditLog}
                    </h2>
                    <span className="px-2 py-0.5 rounded-lg bg-white/20 text-[10px] font-extrabold">
                      {fmtNum(auditLogs.length)}
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-100/90 font-medium mt-0.5">
                    {isBengali
                      ? 'দোকানের প্রতিটি কার্যক্রমের নিরাপদ ইতিহাস'
                      : 'Complete activity trail across all modules'}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPdfModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white text-[#007448] hover:bg-emerald-50 text-xs font-extrabold cursor-pointer shadow-xs"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isBengali ? 'রিপোর্ট PDF' : 'Report PDF'}</span>
            </button>
          </div>

          {/* 3-Column Icon-Badged Summary Strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/12 border border-white/20 px-2.5 py-2.5">
              <div className="flex items-center justify-between text-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                  {isBengali ? 'আজকের লগ' : 'Today'}
                </p>
                <Activity className="w-3 h-3 opacity-80 shrink-0" />
              </div>
              <p className="text-sm sm:text-base font-black mt-1">
                {fmtNum(todayCount)}
              </p>
            </div>

            <div className="rounded-xl bg-white/12 border border-white/20 px-2.5 py-2.5">
              <div className="flex items-center justify-between text-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                  {isBengali ? 'মডিউল' : 'Modules'}
                </p>
                <Layers className="w-3 h-3 opacity-80 shrink-0" />
              </div>
              <p className="text-sm sm:text-base font-black mt-1">
                {fmtNum(uniqueModules.length)}
              </p>
            </div>

            <div className="rounded-xl bg-white/18 border border-white/25 px-2.5 py-2.5">
              <div className="flex items-center justify-between text-emerald-50">
                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                  {isBengali ? 'সক্রিয় ইউজার' : 'Actors'}
                </p>
                <User className="w-3 h-3 opacity-85 shrink-0" />
              </div>
              <p className="text-sm sm:text-base font-black mt-1">
                {fmtNum(uniqueActors.length)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Time + Module & Actor Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 shrink-0">
            {(
              [
                { id: 'TODAY', bn: 'আজ', en: 'Today' },
                { id: 'THIS_WEEK', bn: 'সপ্তাহ', en: '7 Days' },
                { id: 'THIS_MONTH', bn: 'এই মাস', en: 'Month' },
                { id: 'ALL', bn: 'সব', en: 'All' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTimeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border whitespace-nowrap cursor-pointer ${
                  timeFilter === tab.id
                    ? 'bg-[#00965E] text-white border-[#00965E]'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {isBengali ? tab.bn : tab.en}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-extrabold text-slate-500 shrink-0">
            {fmtNum(filteredLogs.length)} {isBengali ? 'টি রেকর্ড' : 'logs'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="relative sm:col-span-6">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isBengali
                  ? 'কার্যক্রম, মডিউল বা ইউজার খুঁজুন...'
                  : 'Search action, module or actor...'
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
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="sm:col-span-3 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">
              {isBengali ? 'সব মডিউল' : 'All Modules'}
            </option>
            {uniqueModules.map((mod) => (
              <option key={mod} value={mod}>
                {mod}
              </option>
            ))}
          </select>

          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="sm:col-span-3 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">
              {isBengali ? 'সব ইউজার' : 'All Actors'}
            </option>
            {uniqueActors.map((actor) => (
              <option key={actor} value={actor}>
                {actor}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grouped Bordered Timeline Cards */}
      {groupedLogs.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border-[1.5px] border-dashed border-slate-300 dark:border-slate-700 space-y-1.5">
          <History className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-500">
            {isBengali
              ? 'এই ফিল্টারে কোনো অডিট লগ পাওয়া যায়নি।'
              : 'No audit activities match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedLogs.map((group) => (
            <div
              key={group.dateKey}
              className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs"
            >
              <div className="px-3.5 py-2 bg-gradient-to-r from-emerald-50/80 to-slate-50 dark:from-slate-900 dark:to-slate-900/70 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-slate-700 dark:text-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-[#00965E]" />
                  {group.label}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-extrabold text-slate-500">
                  {fmtNum(group.logs.length)}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {group.logs.map((log) => {
                  const meta = getModuleMeta(log.module);
                  const ModIcon = meta.icon;
                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="p-3 flex items-start justify-between gap-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${meta.iconBg}`}
                        >
                          <ModIcon className="w-3.5 h-3.5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded-md border text-[10px] font-extrabold ${meta.badge}`}
                            >
                              {log.module || 'System'}
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              <User className="w-2.5 h-2.5 text-slate-400" />
                              {log.actorName}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1 leading-snug">
                            {log.action}
                          </p>

                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(log.createdAt)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLog(log);
                        }}
                        title={isBengali ? 'লগ কপি করুন' : 'Copy Log'}
                        className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-[#00965E] shrink-0 cursor-pointer"
                      >
                        {copiedId === log.id ? (
                          <Check className="w-3.5 h-3.5 text-[#00965E]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm border-[1.5px] border-[#CBEAD9] dark:border-slate-700 overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-gradient-to-r from-[#00965E] to-[#007448] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" />
                <h3 className="text-sm font-black">
                  {isBengali ? 'অডিট লগ বিস্তারিত' : 'Audit Log Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">
                  {isBengali ? 'মডিউল' : 'Module'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-extrabold ${
                    getModuleMeta(selectedLog.module).badge
                  }`}
                >
                  {selectedLog.module}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">
                  {isBengali ? 'সম্পাদনাকারী' : 'Actor'}
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedLog.actorName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">
                  {isBengali ? 'তারিখ ও সময়' : 'Timestamp'}
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatTimestamp(selectedLog.createdAt)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isBengali ? 'কার্যক্রম বিবরণ' : 'Action Details'}
                </p>
                <p className="text-xs font-bold text-slate-800 dark:text-white leading-relaxed">
                  {selectedLog.action}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopyLog(selectedLog)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-xs font-extrabold text-[#00965E] cursor-pointer"
                >
                  {copiedId === selectedLog.id ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {copiedId === selectedLog.id
                      ? isBengali
                        ? 'কপি হয়েছে'
                        : 'Copied'
                      : isBengali
                      ? 'কপি'
                      : 'Copy'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                >
                  {isBengali ? 'বন্ধ' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log PDF Report Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileDown className="w-4 h-4 text-[#00965E]" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isBengali ? 'অডিট লগ রিপোর্ট (PDF)' : 'Audit Log Report (PDF)'}
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
                        ? 'সিস্টেম অডিট ও কার্যক্রম রিপোর্ট'
                        : 'System Audit & Activity Log Report'}{' '}
                      ({fmtNum(filteredLogs.length)})
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

                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        SL
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'তারিখ ও সময়' : 'Timestamp'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'মডিউল' : 'Module'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'ইউজার' : 'Actor'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'কার্যক্রম' : 'Action'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.slice(0, 120).map((log, idx) => (
                      <tr key={log.id}>
                        <td className="border border-slate-300 px-2 py-1.5 font-bold">
                          {fmtNum(idx + 1)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 whitespace-nowrap">
                          {formatTimestamp(log.createdAt)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 font-bold">
                          {log.module}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5">
                          {log.actorName}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5">
                          {log.action}
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="border border-slate-300 px-2 py-4 text-center text-slate-400"
                        >
                          {isBengali ? 'কোনো লগ নেই' : 'No audit logs'}
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
