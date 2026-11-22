import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  UserCheck,
  Plus,
  Search,
  Phone,
  MessageSquare,
  Edit3,
  Trash2,
  Wallet,
  FileDown,
  Printer,
  X,
  AlertTriangle,
  CheckCircle2,
  Users,
  Briefcase,
  ShieldCheck,
  Banknote,
  Power,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  AppLanguage,
  StaffMember,
  StoreTransaction,
  formatMoney,
  toBengaliDigits,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';

interface StaffRolesViewProps {
  staffList: StaffMember[];
  transactions: StoreTransaction[];
  strings: DokanTranslations;
  language: AppLanguage;
  onBack: () => void;
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
  onRecordExpense: (
    title: string,
    category: string,
    amount: number,
    notes?: string
  ) => Promise<void>;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const STAFF_ROLES: Array<{
  id: string;
  bn: string;
  en: string;
  badge: string;
  iconBg: string;
}> = [
  {
    id: 'Owner',
    bn: 'মালিক (Owner)',
    en: 'Owner',
    badge:
      'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300',
    iconBg:
      'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 border-indigo-200 dark:border-indigo-800',
  },
  {
    id: 'Manager',
    bn: 'ম্যানেজার (Manager)',
    en: 'Manager',
    badge:
      'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-[#007a4d] dark:text-emerald-300',
    iconBg:
      'bg-emerald-50 dark:bg-emerald-900/30 text-[#00965E] border-emerald-200 dark:border-emerald-800',
  },
  {
    id: 'Cashier',
    bn: 'ক্যাশিয়ার (Cashier)',
    en: 'Cashier',
    badge:
      'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    iconBg:
      'bg-blue-50 dark:bg-blue-900/30 text-blue-600 border-blue-200 dark:border-blue-800',
  },
  {
    id: 'Inventory Clerk',
    bn: 'স্টক ক্লার্ক (Inventory)',
    en: 'Inventory Clerk',
    badge:
      'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
    iconBg:
      'bg-amber-50 dark:bg-amber-900/30 text-amber-600 border-amber-200 dark:border-amber-800',
  },
  {
    id: 'Salesman',
    bn: 'সেলসম্যান (Salesman)',
    en: 'Salesman',
    badge:
      'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300',
    iconBg:
      'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 border-cyan-200 dark:border-cyan-800',
  },
  {
    id: 'Helper / Delivery',
    bn: 'সহকারী / ডেলিভারি',
    en: 'Helper / Delivery',
    badge:
      'bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300',
    iconBg:
      'bg-violet-50 dark:bg-violet-900/30 text-violet-600 border-violet-200 dark:border-violet-800',
  },
];

function getInitials(name: string): string {
  const parts = (name || 'S').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || 'S').slice(0, 2).toUpperCase();
}

export const StaffRolesView: React.FC<StaffRolesViewProps> = ({
  staffList,
  transactions,
  strings,
  language,
  onBack,
  onAddStaff,
  onUpdateStaff,
  onToggleStaffActive,
  onDeleteStaff,
  onRecordExpense,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const fmtNum = (val: string | number) => toBengaliDigits(val, language);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Add / Edit Staff Modal
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState('Cashier');
  const [staffSalary, setStaffSalary] = useState('');
  const [staffActive, setStaffActive] = useState(true);
  const [isSavingStaff, setIsSavingStaff] = useState(false);

  // Pay Salary Modal
  const [paySalaryTarget, setPaySalaryTarget] = useState<StaffMember | null>(
    null
  );
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryNote, setSalaryNote] = useState('');
  const [isPayingSalary, setIsPayingSalary] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);

  // Payroll PDF Modal
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfSheetRef = useRef<HTMLDivElement | null>(null);

  const getRoleStyle = (role: string) => {
    const found = STAFF_ROLES.find(
      (r) => r.id.toLowerCase() === (role || '').toLowerCase()
    );
    return (
      found || {
        id: role || 'Staff',
        bn: role || 'স্টাফ',
        en: role || 'Staff',
        badge:
          'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
        iconBg:
          'bg-slate-100 dark:bg-slate-900 text-slate-600 border-slate-200 dark:border-slate-700',
      }
    );
  };

  // This month's salary expenses
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const currentMonthLabel = now.toLocaleDateString(
    isBengali ? 'bn-BD' : 'en-US',
    { month: 'long', year: 'numeric' }
  );

  const monthSalaryTxs = useMemo(() => {
    return transactions.filter(
      (tx) =>
        tx.type === 'EXPENSE' &&
        (tx.category || '').toLowerCase().includes('salary') &&
        (tx.createdAt?.toMillis?.() ?? Date.now()) >= startOfMonth
    );
  }, [transactions, startOfMonth]);

  const monthSalaryPaidTotal = useMemo(
    () => monthSalaryTxs.reduce((acc, t) => acc + Math.max(t.paidAmount, t.amount), 0),
    [monthSalaryTxs]
  );

  const getStaffPaidThisMonth = (staff: StaffMember) => {
    const lowerName = staff.name.trim().toLowerCase();
    return monthSalaryTxs
      .filter(
        (tx) =>
          tx.title.toLowerCase().includes(lowerName) ||
          (tx.notes || '').toLowerCase().includes(lowerName)
      )
      .reduce((acc, t) => acc + Math.max(t.paidAmount, t.amount), 0);
  };

  // Summary metrics
  const summaryStats = useMemo(() => {
    const activeStaff = staffList.filter((s) => s.active);
    const inactiveStaff = staffList.filter((s) => !s.active);
    const activePayroll = activeStaff.reduce(
      (acc, s) => acc + Math.max(0, s.salary),
      0
    );
    return {
      activeCount: activeStaff.length,
      inactiveCount: inactiveStaff.length,
      activePayroll,
    };
  }, [staffList]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staffList.filter((s, idx) => {
      if (statusFilter === 'ACTIVE' && !s.active) return false;
      if (statusFilter === 'INACTIVE' && s.active) return false;
      if (
        roleFilter !== 'ALL' &&
        (s.role || '').toLowerCase() !== roleFilter.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      const sl = String(idx + 1);
      return (
        s.name.toLowerCase().includes(q) ||
        (s.role || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        sl === q.replace(/^#/, '')
      );
    });
  }, [staffList, searchQuery, statusFilter, roleFilter]);

  // Modal Openers
  const openAddModal = () => {
    setEditingStaff(null);
    setStaffName('');
    setStaffPhone('');
    setStaffRole('Cashier');
    setStaffSalary('');
    setStaffActive(true);
    setShowStaffModal(true);
  };

  const openEditModal = (st: StaffMember) => {
    setEditingStaff(st);
    setStaffName(st.name);
    setStaffPhone(st.phone === '—' ? '' : st.phone || '');
    setStaffRole(st.role || 'Cashier');
    setStaffSalary(String(st.salary || 0));
    setStaffActive(st.active);
    setShowStaffModal(true);
  };

  const openPaySalaryModal = (st: StaffMember) => {
    setPaySalaryTarget(st);
    setSalaryAmount(st.salary > 0 ? String(st.salary) : '');
    setSalaryNote(
      isBengali
        ? `${currentMonthLabel} - ${st.name} এর বেতন`
        : `${currentMonthLabel} salary for ${st.name}`
    );
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || isSavingStaff) return;
    setIsSavingStaff(true);
    try {
      const cleanSalary = Math.max(0, Number(staffSalary) || 0);
      if (editingStaff) {
        await onUpdateStaff(editingStaff, {
          name: staffName.trim(),
          role: staffRole,
          phone: staffPhone.trim(),
          salary: cleanSalary,
          active: staffActive,
        });
      } else {
        await onAddStaff({
          name: staffName.trim(),
          phone: staffPhone.trim(),
          role: staffRole,
          salary: cleanSalary,
        });
      }
      setShowStaffModal(false);
    } finally {
      setIsSavingStaff(false);
    }
  };

  const handleConfirmPaySalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySalaryTarget || isPayingSalary) return;
    const amt = Math.max(0, Number(salaryAmount) || 0);
    if (amt <= 0) return;
    setIsPayingSalary(true);
    try {
      await onRecordExpense(
        `Staff Salary: ${paySalaryTarget.name}`,
        'Staff Salary',
        amt,
        salaryNote.trim() || `${currentMonthLabel} — ${paySalaryTarget.name}`
      );
      setPaySalaryTarget(null);
    } finally {
      setIsPayingSalary(false);
    }
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
      pdf.save(`Siaam_Store_Staff_Payroll_${stamp}.pdf`);
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
          <title>Siaam Store — Staff Payroll</title>
          <style>
            * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            body { margin: 16px; color: #0f172a; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: 700; }
            .text-right { text-align: right; }
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
      {/* Decorated Emerald Hero Summary Card */}
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
                  <UserCheck className="w-4 h-4 text-emerald-50" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-base sm:text-lg font-black tracking-tight leading-none">
                      {strings.menuStaff}
                    </h2>
                    <span className="px-2 py-0.5 rounded-lg bg-white/20 text-[10px] font-extrabold">
                      {fmtNum(staffList.length)}
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-100/90 font-medium mt-0.5">
                    {isBengali
                      ? 'কর্মচারী তালিকা, রোল ও মাসিক বেতন হিসাব'
                      : 'Team roster, roles & monthly payroll tracker'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowPdfModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/15 text-xs font-bold cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {isBengali ? 'বেতন PDF' : 'Payroll PDF'}
                </span>
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white text-[#007448] hover:bg-emerald-50 text-xs font-extrabold cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isBengali ? 'নতুন স্টাফ' : 'Add Staff'}</span>
              </button>
            </div>
          </div>

          {/* 3-Column Icon-Badged Summary Strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/12 border border-white/20 px-2.5 py-2.5">
              <div className="flex items-center justify-between text-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                  {isBengali ? 'সক্রিয় স্টাফ' : 'Active Staff'}
                </p>
                <Users className="w-3 h-3 opacity-80 shrink-0" />
              </div>
              <p className="text-sm sm:text-base font-black mt-1">
                {fmtNum(summaryStats.activeCount)}{' '}
                <span className="text-[10px] font-semibold text-emerald-100/80">
                  / {fmtNum(staffList.length)}
                </span>
              </p>
            </div>

            <div className="rounded-xl bg-white/12 border border-white/20 px-2.5 py-2.5">
              <div className="flex items-center justify-between text-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                  {isBengali ? 'মাসিক বেতন' : 'Monthly Payroll'}
                </p>
                <Banknote className="w-3 h-3 opacity-80 shrink-0" />
              </div>
              <p className="text-sm sm:text-base font-black mt-1">
                ৳{fmtNum(formatMoney(summaryStats.activePayroll))}
              </p>
            </div>

            <div className="rounded-xl bg-white/18 border border-white/25 px-2.5 py-2.5">
              <div className="flex items-center justify-between text-emerald-50">
                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                  {isBengali ? 'এ মাসে পরিশোধ' : 'Paid This Mo'}
                </p>
                <Wallet className="w-3 h-3 opacity-85 shrink-0" />
              </div>
              <p className="text-sm sm:text-base font-black mt-1">
                ৳{fmtNum(formatMoney(monthSalaryPaidTotal))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Status & Role Filter Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 space-y-2.5 shadow-2xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isBengali
                ? 'নাম, পদবি, মোবাইল বা #ক্রমিক খুঁজুন...'
                : 'Search staff by name, role, phone or #SL...'
            }
            className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
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

        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 shrink-0">
            {(
              [
                {
                  id: 'ALL',
                  bn: `সব (${fmtNum(staffList.length)})`,
                  en: `All (${staffList.length})`,
                },
                {
                  id: 'ACTIVE',
                  bn: `সক্রিয় (${fmtNum(summaryStats.activeCount)})`,
                  en: `Active (${summaryStats.activeCount})`,
                },
                {
                  id: 'INACTIVE',
                  bn: `নিষ্ক্রিয় (${fmtNum(summaryStats.inactiveCount)})`,
                  en: `Inactive (${summaryStats.inactiveCount})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-[#00965E] text-white border-[#00965E]'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {isBengali ? tab.bn : tab.en}
              </button>
            ))}
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-200 shrink-0"
          >
            <option value="ALL">
              {isBengali ? 'সব পদবি / রোল' : 'All Roles'}
            </option>
            {STAFF_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {isBengali ? r.bn : r.en}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff Roster Cards */}
      {filteredStaff.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border-[1.5px] border-dashed border-slate-300 dark:border-slate-700 space-y-2">
          <UserCheck className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-500">
            {searchQuery || statusFilter !== 'ALL' || roleFilter !== 'ALL'
              ? isBengali
                ? 'এই ফিল্টারে কোনো স্টাফ পাওয়া যায়নি।'
                : 'No staff members match this filter.'
              : isBengali
              ? 'এখনো কোনো স্টাফ যোগ করা হয়নি।'
              : 'No staff members added yet.'}
          </p>
          {staffList.length === 0 && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#00965E] text-white text-xs font-extrabold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {isBengali ? 'প্রথম স্টাফ যোগ করুন' : 'Add First Staff'}
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredStaff.map((st, idx) => {
            const roleStyle = getRoleStyle(st.role);
            const hasPhone =
              st.phone && st.phone.trim() !== '' && st.phone.trim() !== '—';
            const paidThisMonth = getStaffPaidThisMonth(st);

            return (
              <div
                key={st.id}
                className={`bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] transition-colors overflow-hidden shadow-2xs ${
                  st.active
                    ? 'border-slate-200 dark:border-slate-700 hover:border-[#00965E]'
                    : 'border-slate-200/70 dark:border-slate-700/60 opacity-80'
                }`}
              >
                <div className="p-3.5 flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-xs shrink-0 ${roleStyle.iconBg}`}
                    >
                      {getInitials(st.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black text-slate-400">
                          #{fmtNum(idx + 1)}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          {st.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${roleStyle.badge}`}
                        >
                          <Briefcase className="w-2.5 h-2.5" />
                          {isBengali ? roleStyle.bn : roleStyle.en}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                            st.active
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-[#007a4d] dark:text-emerald-300'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {st.active
                            ? isBengali
                              ? 'সক্রিয়'
                              : 'Active'
                            : isBengali
                            ? 'নিষ্ক্রিয়'
                            : 'Inactive'}
                        </span>
                      </div>

                      {hasPhone && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{st.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Salary Box */}
                  <div className="text-right shrink-0">
                    <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50">
                      <p className="text-[9px] font-bold uppercase text-slate-500">
                        {isBengali ? 'মাসিক বেতন' : 'Salary/mo'}
                      </p>
                      <p className="text-sm font-black text-[#00965E]">
                        ৳{fmtNum(formatMoney(st.salary))}
                      </p>
                    </div>
                    {paidThisMonth > 0 && (
                      <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        {isBengali ? 'পরিশোধ' : 'Paid'}: ৳
                        {fmtNum(formatMoney(paidThisMonth))}
                      </span>
                    )}
                  </div>
                </div>

                {/* Decorated Action Footer Bar */}
                <div className="px-3 py-2 bg-slate-50/90 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    {hasPhone && (
                      <>
                        <a
                          href={`tel:${st.phone.replace(/[^0-9+]/g, '')}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-[#00965E]"
                          title={isBengali ? 'কল' : 'Call'}
                        >
                          <Phone className="w-3 h-3 text-[#00965E]" />
                          <span className="hidden sm:inline">
                            {isBengali ? 'কল' : 'Call'}
                          </span>
                        </a>
                        <a
                          href={`sms:${st.phone.replace(/[^0-9+]/g, '')}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-blue-500"
                          title="SMS"
                        >
                          <MessageSquare className="w-3 h-3 text-blue-600" />
                        </a>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(st)}
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#00965E] cursor-pointer"
                      title={isBengali ? 'এডিট' : 'Edit'}
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleStaffActive(st)}
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-600 cursor-pointer"
                      title={
                        st.active
                          ? isBengali
                            ? 'নিষ্ক্রিয় করুন'
                            : 'Mark Inactive'
                          : isBengali
                          ? 'সক্রিয় করুন'
                          : 'Mark Active'
                      }
                    >
                      <Power className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(st)}
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-500 hover:bg-red-50 cursor-pointer"
                      title={isBengali ? 'মুছুন' : 'Delete'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => openPaySalaryModal(st)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00965E] hover:bg-[#007c4e] text-white text-[11px] font-extrabold cursor-pointer"
                  >
                    <Wallet className="w-3 h-3" />
                    <span>{isBengali ? 'বেতন দিন' : 'Pay Salary'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: ADD / EDIT STAFF MEMBER                                    */}
      {/* ================================================================= */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border-[1.5px] border-[#CBEAD9] dark:border-slate-700 overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-gradient-to-r from-[#00965E] to-[#007448] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                <h3 className="text-sm font-black">
                  {editingStaff
                    ? isBengali
                      ? 'স্টাফ তথ্য এডিট'
                      : 'Edit Staff Member'
                    : isBengali
                    ? 'নতুন স্টাফ যোগ করুন'
                    : 'Add New Staff Member'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="p-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'স্টাফের নাম *' : 'Staff Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder={
                    isBengali ? 'যেমন: সাব্বির হোসেন' : 'e.g. Sabbir Hossain'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'পদবি / রোল *' : 'Role / Position *'}
                </label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {isBengali ? r.bn : r.en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'মোবাইল নম্বর' : 'Mobile Number'}
                </label>
                <input
                  type="tel"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                    {isBengali ? 'মাসিক বেতন (৳)' : 'Monthly Salary (৳)'}
                  </label>
                  <div className="flex gap-1">
                    {[6000, 10000, 12000, 15000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setStaffSalary(String(amt))}
                        className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-[#00965E] cursor-pointer"
                      >
                        {fmtNum(amt / 1000)}k
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={staffSalary}
                  onChange={(e) => setStaffSalary(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-black dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
                />
              </div>

              {editingStaff && (
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={staffActive}
                    onChange={(e) => setStaffActive(e.target.checked)}
                    className="rounded accent-[#00965E]"
                  />
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00965E]" />
                  <span>
                    {isBengali ? 'বর্তমানে সক্রিয় কর্মচারী' : 'Active Staff Member'}
                  </span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 cursor-pointer"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingStaff}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#00965E] hover:bg-[#007c4e] text-white cursor-pointer disabled:opacity-60"
                >
                  {isSavingStaff
                    ? '...'
                    : isBengali
                    ? 'সংরক্ষণ করুন'
                    : 'Save Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: PAY SALARY (AUTO-RECORDS TO SHOP EXPENSES & CASHBOOK)      */}
      {/* ================================================================= */}
      {paySalaryTarget && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full border-[1.5px] border-[#CBEAD9] dark:border-slate-700 overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-gradient-to-r from-[#00965E] to-[#007448] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                <h3 className="text-sm font-black">
                  {isBengali ? 'বেতন পরিশোধ' : 'Record Salary Payment'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPaySalaryTarget(null)}
                className="p-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPaySalary} className="p-4 space-y-3">
              <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs">
                <p className="font-black text-slate-900 dark:text-white">
                  {paySalaryTarget.name} ({paySalaryTarget.role})
                </p>
                <p className="text-[11px] text-slate-500">
                  {isBengali ? 'মাসিক বেতন' : 'Monthly Salary'}: ৳
                  {fmtNum(formatMoney(paySalaryTarget.salary))}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'পরিশোধের পরিমাণ (৳) *' : 'Payment Amount (৳) *'}
                </label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  required
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-base font-black dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
                />
              </div>

              <input
                type="text"
                value={salaryNote}
                onChange={(e) => setSalaryNote(e.target.value)}
                placeholder={isBengali ? 'মাস / নোট' : 'Month / Note'}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs dark:bg-slate-900 dark:text-white"
              />

              <p className="text-[10px] text-slate-400">
                {isBengali
                  ? 'এটি স্বয়ংক্রিয়ভাবে দোকান খরচ ও ক্যাশবুকে "Staff Salary" হিসেবে যুক্ত হবে।'
                  : 'Automatically recorded under Shop Expenses (Staff Salary) & Cashbook.'}
              </p>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPaySalaryTarget(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 cursor-pointer"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isPayingSalary}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#00965E] hover:bg-[#007c4e] text-white cursor-pointer disabled:opacity-60"
                >
                  {isPayingSalary
                    ? '...'
                    : isBengali
                    ? 'বেতন পরিশোধ করুন'
                    : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-5 border border-red-200 dark:border-red-900/50 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-black">
                {isBengali ? 'স্টাফ মুছে ফেলবেন?' : 'Delete Staff Member?'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <strong>{deleteTarget.name}</strong> ({deleteTarget.role})
            </p>
            <p className="text-[11px] text-slate-500">
              {isBengali
                ? 'এই স্টাফ তথ্যটি রিসাইকেল বিনে পাঠানো হবে।'
                : 'This staff member will be moved to the Recycle Bin.'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {isBengali ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteTarget;
                  setDeleteTarget(null);
                  await onDeleteStaff(target);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                {isBengali ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll PDF Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileDown className="w-4 h-4 text-[#00965E]" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isBengali
                    ? 'স্টাফ ও বেতন তালিকা (PDF)'
                    : 'Staff Roster & Payroll (PDF)'}
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
                        ? 'স্টাফ তালিকা ও মাসিক বেতন শীট'
                        : 'Staff Roster & Monthly Payroll Sheet'}
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

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      {isBengali ? 'সক্রিয় স্টাফ' : 'Active Staff'}
                    </p>
                    <p className="text-sm font-black mt-0.5">
                      {fmtNum(summaryStats.activeCount)} /{' '}
                      {fmtNum(staffList.length)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-[10px] font-bold text-[#007448] uppercase">
                      {isBengali ? 'মোট মাসিক বেতন' : 'Monthly Payroll'}
                    </p>
                    <p className="text-sm font-black text-[#00965E] mt-0.5">
                      ৳{fmtNum(formatMoney(summaryStats.activePayroll))}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      {isBengali ? 'চলতি মাসে পরিশোধ' : 'Paid This Month'}
                    </p>
                    <p className="text-sm font-black mt-0.5">
                      ৳{fmtNum(formatMoney(monthSalaryPaidTotal))}
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
                        {isBengali ? 'নাম' : 'Name'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'পদবি' : 'Role'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'মোবাইল' : 'Phone'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        {isBengali ? 'অবস্থা' : 'Status'}
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">
                        {isBengali ? 'মাসিক বেতন' : 'Salary'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((st, idx) => (
                      <tr key={st.id}>
                        <td className="border border-slate-300 px-2 py-1.5 font-bold">
                          {fmtNum(idx + 1)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 font-bold">
                          {st.name}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5">
                          {st.role}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5">
                          {st.phone || '—'}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 font-bold">
                          {st.active
                            ? isBengali
                              ? 'সক্রিয়'
                              : 'Active'
                            : isBengali
                            ? 'নিষ্ক্রিয়'
                            : 'Inactive'}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-extrabold text-[#00965E]">
                          ৳{fmtNum(formatMoney(st.salary))}
                        </td>
                      </tr>
                    ))}
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
