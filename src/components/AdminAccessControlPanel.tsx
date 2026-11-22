import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Shield,
  Lock,
  Plus,
  Edit3,
  Trash2,
  KeyRound,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  Search,
  X,
  UserCheck,
  RefreshCw,
  Users,
  AlertTriangle,
  Share2,
} from 'lucide-react';
import { VaultRole, VaultUserAccount } from '../types/dokan';
import {
  vaultAccessService,
  isLockedEmergencyAdmin,
  EMERGENCY_ADMIN_PASSWORDS,
} from '../services/vaultAccessService';

interface AdminAccessControlPanelProps {
  isBengali: boolean;
  onBack?: () => void;
  headerTitle?: string;
}

type RoleFilter = 'ALL' | 'MANAGER' | 'ADMIN' | 'LOCKED';

function generateRandomPassword(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getInitials(name: string, email: string): string {
  const src = (name || email || 'U').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

export const AdminAccessControlPanel: React.FC<
  AdminAccessControlPanelProps
> = ({ isBengali, onBack, headerTitle }) => {
  const [accounts, setAccounts] = useState<VaultUserAccount[]>(
    vaultAccessService.getAccounts()
  );
  const [currentUser, setCurrentUser] = useState<VaultUserAccount | null>(
    vaultAccessService.getActiveSession()
  );

  // Filters & UI state
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedEmails, setRevealedEmails] = useState<Record<string, boolean>>(
    {}
  );
  const [revealAllPasswords, setRevealAllPasswords] = useState(false);
  const [showEmergencyPasswords, setShowEmergencyPasswords] = useState(false);
  const [showPolicyDetails, setShowPolicyDetails] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Add Account Modal
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addRole, setAddRole] = useState<VaultRole>(VaultRole.ACCOUNT_MANAGER);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState(() => generateRandomPassword(10));

  // Edit Account Modal
  const [editingAccount, setEditingAccount] = useState<VaultUserAccount | null>(
    null
  );
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<VaultRole>(
    VaultRole.ACCOUNT_MANAGER
  );

  // Change My Password Modal
  const [showMyPasswordModal, setShowMyPasswordModal] = useState(false);
  const [myCurrentPwd, setMyCurrentPwd] = useState('');
  const [myNewPwd, setMyNewPwd] = useState('');
  const [myConfirmPwd, setMyConfirmPwd] = useState('');
  const [isUpdatingMyPwd, setIsUpdatingMyPwd] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<VaultUserAccount | null>(
    null
  );

  useEffect(() => {
    return vaultAccessService.subscribe(() => {
      setAccounts([...vaultAccessService.getAccounts()]);
      setCurrentUser(vaultAccessService.getActiveSession());
    });
  }, []);

  const isAdmin = currentUser?.role === VaultRole.ADMIN;
  const isCurrentUserLocked = currentUser
    ? isLockedEmergencyAdmin(currentUser.email)
    : false;

  const lockedAdmins = useMemo(
    () =>
      accounts.filter(
        (a) => a.role === VaultRole.ADMIN && isLockedEmergencyAdmin(a.email)
      ),
    [accounts]
  );
  const editableAdmins = useMemo(
    () =>
      accounts.filter(
        (a) => a.role === VaultRole.ADMIN && !isLockedEmergencyAdmin(a.email)
      ),
    [accounts]
  );
  const managerAccounts = useMemo(
    () => accounts.filter((a) => a.role === VaultRole.ACCOUNT_MANAGER),
    [accounts]
  );

  // Filtered editable accounts (managers + editable admins)
  const visibleEditableAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list: VaultUserAccount[] = [];
    if (roleFilter === 'ALL') {
      list = [...managerAccounts, ...editableAdmins];
    } else if (roleFilter === 'MANAGER') {
      list = managerAccounts;
    } else if (roleFilter === 'ADMIN') {
      list = editableAdmins;
    } else {
      list = [];
    }

    if (!q) return list;
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    );
  }, [managerAccounts, editableAdmins, roleFilter, searchQuery]);

  const visibleLockedAdmins = useMemo(() => {
    if (roleFilter !== 'ALL' && roleFilter !== 'LOCKED') return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return lockedAdmins;
    return lockedAdmins.filter(
      (a) =>
        a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    );
  }, [lockedAdmins, roleFilter, searchQuery]);

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1600);
    } catch {
      // Fallback for restricted clipboard environments
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1600);
    }
  };

  const toggleRevealFor = (email: string) => {
    setRevealedEmails((prev) => ({
      ...prev,
      [email]: !(prev[email] ?? revealAllPasswords),
    }));
  };

  const isPasswordVisible = (email: string) =>
    revealedEmails[email] ?? revealAllPasswords;

  const handleToggleRevealAll = () => {
    const next = !revealAllPasswords;
    setRevealAllPasswords(next);
    setRevealedEmails({});
  };

  const openAddModal = (defaultRole: VaultRole) => {
    setErrorBanner(null);
    setAddRole(defaultRole);
    setAddName('');
    setAddEmail('');
    setAddPassword(generateRandomPassword(10));
    setShowAddDialog(true);
  };

  const openEditModal = (account: VaultUserAccount) => {
    setErrorBanner(null);
    setEditingAccount(account);
    setEditName(account.name);
    setEditEmail(account.email);
    setEditPassword(account.password);
    setEditRole(account.role);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setStatusBanner(null);
    try {
      vaultAccessService.addAccountByAdmin(
        addName,
        addEmail,
        addPassword,
        addRole
      );
      setShowAddDialog(false);
      setStatusBanner(
        isBengali
          ? 'নতুন ইউজার যোগ করা হয়েছে এবং ক্লাউডে সিঙ্ক হয়েছে!'
          : 'New account added and synced to Firebase Cloud!'
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Failed to add account.'
      );
    }
  };

  const handleUpdateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setErrorBanner(null);
    setStatusBanner(null);
    try {
      vaultAccessService.editAccountByAdmin(
        editingAccount.email,
        editName,
        editEmail,
        editPassword,
        editRole
      );
      setEditingAccount(null);
      setStatusBanner(
        isBengali
          ? 'অ্যাকাউন্টের তথ্য ও পাসওয়ার্ড আপডেট হয়ে সিঙ্ক হয়েছে!'
          : 'Account details & password updated and synced!'
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Failed to update account.'
      );
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setErrorBanner(null);
    setStatusBanner(null);
    try {
      vaultAccessService.removeAccountByAdmin(deleteTarget.email);
      setStatusBanner(
        isBengali
          ? `"${deleteTarget.name}" মুছে ফেলা হয়েছে এবং সিঙ্ক হয়েছে।`
          : `"${deleteTarget.name}" removed and synced.`
      );
      setDeleteTarget(null);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Cannot remove account.'
      );
      setDeleteTarget(null);
    }
  };

  const handleChangeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || isUpdatingMyPwd) return;
    setErrorBanner(null);
    setStatusBanner(null);
    if (myNewPwd.trim().length < 6) {
      setErrorBanner(
        isBengali
          ? 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
          : 'New password must be at least 6 characters.'
      );
      return;
    }
    if (myNewPwd.trim() !== myConfirmPwd.trim()) {
      setErrorBanner(
        isBengali
          ? 'নতুন পাসওয়ার্ড দুটি মেলেনি।'
          : 'New passwords do not match.'
      );
      return;
    }
    setIsUpdatingMyPwd(true);
    try {
      await vaultAccessService.changePasswordAndSyncToFirebase(
        currentUser.email,
        myCurrentPwd,
        myNewPwd
      );
      setShowMyPasswordModal(false);
      setMyCurrentPwd('');
      setMyNewPwd('');
      setMyConfirmPwd('');
      setStatusBanner(
        isBengali
          ? 'আপনার পাসওয়ার্ড সফলভাবে পরিবর্তন ও সিঙ্ক হয়েছে!'
          : 'Your password was updated and synced!'
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Failed to change password.'
      );
    } finally {
      setIsUpdatingMyPwd(false);
    }
  };

  const getPasswordStrength = (pwd: string) => {
    const len = pwd.trim().length;
    if (len < 6) {
      return {
        label: isBengali ? 'খুব ছোট (কমপক্ষে ৬ অক্ষর)' : 'Too short (min 6)',
        color: 'text-red-500',
        bar: 'bg-red-500 w-1/4',
      };
    }
    if (len < 8) {
      return {
        label: isBengali ? 'মাঝারি' : 'Fair',
        color: 'text-amber-600',
        bar: 'bg-amber-500 w-2/4',
      };
    }
    const hasMix = /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd);
    if (hasMix) {
      return {
        label: isBengali ? 'শক্তিশালী' : 'Strong',
        color: 'text-[#00965E]',
        bar: 'bg-[#00965E] w-full',
      };
    }
    return {
      label: isBengali ? 'ভালো' : 'Good',
      color: 'text-emerald-600',
      bar: 'bg-emerald-500 w-3/4',
    };
  };

  return (
    <div className="space-y-3 pb-24">
      {/* Decorated Compact Emerald Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#00965E] via-[#008251] to-[#005F3C] text-white p-4 shadow-md border border-emerald-400/20">
        <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-10 w-36 h-36 rounded-full bg-emerald-300/15 blur-2xl" />

        <div className="relative space-y-3">
          {/* Top Navigation & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/15 text-xs font-bold cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{isBengali ? 'টুলস' : 'Tools'}</span>
                </button>
              )}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-emerald-50" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black tracking-tight leading-none truncate">
                    {headerTitle ||
                      (isBengali
                        ? 'ইউজার ও পাসওয়ার্ড'
                        : 'User Management & Passwords')}
                  </h2>
                  <p className="text-[10px] text-emerald-100/90 font-medium mt-0.5 truncate">
                    {isBengali
                      ? 'অ্যাডমিন, ম্যানেজার ও লগইন পাসওয়ার্ড নিয়ন্ত্রণ'
                      : 'Roles, credentials & live cloud password control'}
                  </p>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-1.5">
                {!isCurrentUserLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorBanner(null);
                      setMyCurrentPwd('');
                      setMyNewPwd('');
                      setMyConfirmPwd('');
                      setShowMyPasswordModal(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/15 text-xs font-bold cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {isBengali ? 'আমার পাসওয়ার্ড' : 'My Password'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openAddModal(VaultRole.ACCOUNT_MANAGER)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white text-[#007448] hover:bg-emerald-50 text-xs font-extrabold cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isBengali ? 'নতুন ইউজার' : 'Add User'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Active Logged-In User Compact Strip */}
          <div className="rounded-xl bg-white/12 border border-white/20 px-3 py-2 flex items-center justify-between gap-2 backdrop-blur-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white text-[#007448] font-black text-xs flex items-center justify-center shrink-0">
                {getInitials(
                  currentUser?.name || '',
                  currentUser?.email || ''
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold truncate">
                  {currentUser?.name || 'Store User'}
                </p>
                <p className="text-[11px] text-emerald-100/85 truncate">
                  {currentUser?.email || ''}
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide shrink-0 ${
                isAdmin
                  ? 'bg-emerald-200 text-[#064E3B]'
                  : 'bg-amber-200 text-amber-900'
              }`}
            >
              {isAdmin
                ? isBengali
                  ? 'অ্যাডমিন'
                  : 'ADMIN'
                : isBengali
                ? 'ম্যানেজার'
                : 'MANAGER'}
            </span>
          </div>

          {/* 3-Box Compact Account Stats */}
          {isAdmin && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/12 border border-white/15 px-2.5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  {isBengali ? 'মোট ইউজার' : 'Total Users'}
                </p>
                <p className="text-sm sm:text-base font-black mt-0.5">
                  {accounts.length}
                </p>
              </div>
              <div className="rounded-xl bg-white/12 border border-white/15 px-2.5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  {isBengali ? 'ম্যানেজার' : 'Managers'}
                </p>
                <p className="text-sm sm:text-base font-black mt-0.5">
                  {managerAccounts.length}
                </p>
              </div>
              <div className="rounded-xl bg-white/12 border border-white/15 px-2.5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  {isBengali ? 'অ্যাডমিন' : 'Admins'}
                </p>
                <p className="text-sm sm:text-base font-black mt-0.5">
                  {editableAdmins.length + lockedAdmins.length}{' '}
                  <span className="text-[10px] font-semibold text-emerald-100/80">
                    ({lockedAdmins.length} {isBengali ? 'লকড' : 'locked'})
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status & Error Banners */}
      {statusBanner && (
        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00965E]" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="p-0.5 text-emerald-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {errorBanner && (
        <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-between gap-2 text-xs font-bold text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="p-0.5 text-red-500 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isAdmin && (
        <>
          {/* Compact Search + Single-Line Role Filter + Global Password Visibility Toggle */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border-[1.5px] border-[#CBEAD9] dark:border-slate-700 space-y-2.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isBengali
                      ? 'নাম বা ইমেইল দিয়ে খুঁজুন...'
                      : 'Search by name or email...'
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

              <button
                type="button"
                onClick={handleToggleRevealAll}
                className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border text-[11px] font-extrabold shrink-0 cursor-pointer transition-colors ${
                  revealAllPasswords
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-[#00965E] text-[#00965E]'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
                title={
                  revealAllPasswords
                    ? isBengali
                      ? 'সব পাসওয়ার্ড লুকান'
                      : 'Hide All Passwords'
                    : isBengali
                    ? 'সব পাসওয়ার্ড দেখুন'
                    : 'Reveal All Passwords'
                }
              >
                {revealAllPasswords ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {revealAllPasswords
                    ? isBengali
                      ? 'লুকান'
                      : 'Hide All'
                    : isBengali
                    ? 'পাসওয়ার্ড দেখুন'
                    : 'Show All'}
                </span>
              </button>
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {(
                [
                  {
                    id: 'ALL',
                    bn: `সব (${accounts.length})`,
                    en: `All (${accounts.length})`,
                  },
                  {
                    id: 'MANAGER',
                    bn: `ম্যানেজার (${managerAccounts.length})`,
                    en: `Managers (${managerAccounts.length})`,
                  },
                  {
                    id: 'ADMIN',
                    bn: `অ্যাডমিন (${editableAdmins.length})`,
                    en: `Admins (${editableAdmins.length})`,
                  },
                  {
                    id: 'LOCKED',
                    bn: `ইমার্জেন্সি (${lockedAdmins.length})`,
                    en: `Locked (${lockedAdmins.length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap border cursor-pointer transition-colors ${
                    roleFilter === tab.id
                      ? 'bg-[#00965E] text-white border-[#00965E]'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isBengali ? tab.bn : tab.en}
                </button>
              ))}
            </div>
          </div>

          {/* EDITABLE ACCOUNTS LIST (MANAGERS + ADMINS) */}
          {roleFilter !== 'LOCKED' && (
            <div className="space-y-2">
              {visibleEditableAccounts.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400">
                  {isBengali
                    ? 'কোনো ইউজার অ্যাকাউন্ট পাওয়া যায়নি।'
                    : 'No matching accounts found.'}
                </div>
              ) : (
                visibleEditableAccounts.map((account, idx) => {
                  const isAccAdmin = account.role === VaultRole.ADMIN;
                  const isSelf =
                    currentUser?.email.toLowerCase() ===
                    account.email.toLowerCase();
                  const canDelete = isAccAdmin
                    ? !isSelf
                    : managerAccounts.length > 1;
                  const pwdShown = isPasswordVisible(account.email);

                  return (
                    <div
                      key={account.email}
                      className="bg-white dark:bg-slate-800 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 hover:border-[#00965E] transition-colors overflow-hidden shadow-2xs"
                    >
                      <div className="p-3 flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border ${
                              isAccAdmin
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                : 'bg-emerald-50 dark:bg-emerald-900/30 text-[#00965E] border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            {getInitials(account.name, account.email)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black text-slate-400">
                                #{idx + 1}
                              </span>
                              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                {account.name}
                              </h4>
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-wide ${
                                  isAccAdmin
                                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                                    : 'bg-emerald-100 dark:bg-emerald-900/40 text-[#007a4d] dark:text-emerald-300'
                                }`}
                              >
                                {isAccAdmin
                                  ? isBengali
                                    ? 'অ্যাডমিন'
                                    : 'ADMIN'
                                  : isBengali
                                  ? 'ম্যানেজার'
                                  : 'MANAGER'}
                              </span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[9px] font-black">
                                  {isBengali ? 'আপনি' : 'YOU'}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {account.email}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  copyText(account.email, `email-${account.email}`)
                                }
                                className="text-slate-400 hover:text-[#00965E] cursor-pointer shrink-0"
                                title={isBengali ? 'ইমেইল কপি' : 'Copy Email'}
                              >
                                {copiedKey === `email-${account.email}` ? (
                                  <Check className="w-3 h-3 text-[#00965E]" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Edit & Delete Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditModal(account)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-[#00965E] hover:bg-emerald-100 text-[11px] font-extrabold cursor-pointer"
                            title={
                              isBengali
                                ? 'এডিট ও পাসওয়ার্ড রিসেট'
                                : 'Edit & Reset Password'
                            }
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{isBengali ? 'এডিট' : 'Edit'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={!canDelete}
                            onClick={() => setDeleteTarget(account)}
                            className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-red-500 hover:bg-red-50 disabled:opacity-30 cursor-pointer"
                            title={
                              !canDelete
                                ? isSelf
                                  ? isBengali
                                    ? 'নিজের অ্যাকাউন্ট মুছা যাবে না'
                                    : 'Cannot delete your own account'
                                  : isBengali
                                  ? 'কমপক্ষে ১ জন ম্যানেজার আবশ্যক'
                                  : 'At least 1 Account Manager required'
                                : isBengali
                                ? 'ইউজার মুছুন'
                                : 'Delete Account'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Compact Password & Quick Copy Footer Strip */}
                      <div className="px-3 py-2 bg-slate-50/90 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs min-w-0">
                          <KeyRound className="w-3.5 h-3.5 text-[#00965E] shrink-0" />
                          <span className="text-[11px] font-bold text-slate-500">
                            {isBengali ? 'পাসওয়ার্ড:' : 'Password:'}
                          </span>
                          <span className="font-mono text-xs font-extrabold text-slate-800 dark:text-emerald-300 tracking-wide">
                            {pwdShown ? account.password : '••••••••'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleRevealFor(account.email)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-[#00965E] cursor-pointer"
                          >
                            {pwdShown ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                            <span>
                              {pwdShown
                                ? isBengali
                                  ? 'লুকান'
                                  : 'Hide'
                                : isBengali
                                ? 'দেখুন'
                                : 'Show'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              copyText(account.password, `pwd-${account.email}`)
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-[#00965E] cursor-pointer"
                          >
                            {copiedKey === `pwd-${account.email}` ? (
                              <Check className="w-3 h-3 text-[#00965E]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>
                              {copiedKey === `pwd-${account.email}`
                                ? isBengali
                                  ? 'কপি হয়েছে'
                                  : 'Copied'
                                : isBengali
                                ? 'পাসওয়ার্ড কপি'
                                : 'Copy Pwd'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const shareText = `Siaam Store Login\nName: ${account.name}\nEmail: ${account.email}\nPassword: ${account.password}`;
                              copyText(shareText, `cred-${account.email}`);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-[10px] font-extrabold text-[#00965E] cursor-pointer"
                            title={
                              isBengali
                                ? 'ইমেইল ও পাসওয়ার্ড একসাথে কপি'
                                : 'Copy Email + Password'
                            }
                          >
                            {copiedKey === `cred-${account.email}` ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Share2 className="w-3 h-3" />
                            )}
                            <span className="hidden sm:inline">
                              {copiedKey === `cred-${account.email}`
                                ? isBengali
                                  ? 'কপি হয়েছে'
                                  : 'Copied'
                                : isBengali
                                ? 'লগইন কপি'
                                : 'Copy Login'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* LOCKED EMERGENCY ADMINS SECTION */}
          {visibleLockedAdmins.length > 0 && (
            <div className="bg-rose-50/70 dark:bg-rose-950/20 rounded-2xl border-[1.5px] border-rose-200 dark:border-rose-900/50 overflow-hidden shadow-2xs">
              <div className="px-3.5 py-2.5 bg-rose-100/60 dark:bg-rose-950/40 border-b border-rose-200/80 dark:border-rose-900/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Lock className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 shrink-0" />
                  <h4 className="text-xs font-black text-rose-900 dark:text-rose-300 truncate">
                    {isBengali
                      ? 'লকড ইমার্জেন্সি অ্যাডমিন (অপরিবর্তনীয়)'
                      : 'Locked Emergency Admins (Protected)'}
                  </h4>
                </div>
                {EMERGENCY_ADMIN_PASSWORDS.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowEmergencyPasswords((v) => !v)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 text-[10px] font-extrabold text-rose-700 dark:text-rose-300 cursor-pointer shrink-0"
                  >
                    {showEmergencyPasswords ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                    <span>
                      {showEmergencyPasswords
                        ? isBengali
                          ? 'পাসওয়ার্ড লুকান'
                          : 'Hide Keys'
                        : isBengali
                        ? 'পাসওয়ার্ড দেখুন'
                        : 'Show Keys'}
                    </span>
                  </button>
                )}
              </div>

              <div className="p-3 space-y-2">
                {visibleLockedAdmins.map((admin) => (
                  <div
                    key={admin.email}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900/80 border border-rose-200/80 dark:border-rose-900/50 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-800 dark:text-white truncate">
                          {admin.name}
                        </p>
                        <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 truncate">
                          {admin.email}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 text-[9px] font-black shrink-0">
                      LOCKED
                    </span>
                  </div>
                ))}

                {showEmergencyPasswords && EMERGENCY_ADMIN_PASSWORDS.length > 0 && (
                  <div className="pt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-extrabold text-rose-800 dark:text-rose-300">
                      {isBengali ? 'বৈধ পাসওয়ার্ড:' : 'Valid Keys:'}
                    </span>
                    {EMERGENCY_ADMIN_PASSWORDS.map((pwd) => (
                      <button
                        key={pwd}
                        type="button"
                        onClick={() => copyText(pwd, `emg-${pwd}`)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 font-mono text-[10px] font-bold text-rose-800 dark:text-rose-200 hover:border-rose-500 cursor-pointer"
                      >
                        <span>{pwd}</span>
                        {copiedKey === `emg-${pwd}` ? (
                          <Check className="w-2.5 h-2.5 text-[#00965E]" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 opacity-60" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compact Collapsible Policy Info */}
          <div
            onClick={() => setShowPolicyDetails(!showPolicyDetails)}
            className="rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors hover:border-[#00965E]/60"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-[#00965E]" />
                <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                  {isBengali
                    ? 'লগইন, রোল এবং ক্লাউড সিঙ্ক নীতিমালা'
                    : 'Login, Role & Cloud Sync Policy'}
                </span>
              </div>
              {showPolicyDetails ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </div>
            {showPolicyDetails && (
              <ul className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed list-disc pl-4">
                <li>
                  {isBengali
                    ? 'ইমেইল ও পাসওয়ার্ড সব ডিভাইসে ফায়ারবেস ক্লাউডের সাথে সাথে সাথে সিঙ্ক হয়।'
                    : 'Emails & passwords sync in real time across all devices via Firebase Cloud.'}
                </li>
                <li>
                  {isBengali
                    ? 'দোকান পরিচালনার জন্য কমপক্ষে ১টি অ্যাকাউন্ট ম্যানেজার অ্যাকাউন্ট থাকা বাধ্যতামূলক।'
                    : 'At least 1 Account Manager account is mandatory for POS sales operations.'}
                </li>
                <li>
                  {isBengali
                    ? '২টি ইমার্জেন্সি অ্যাডমিন অ্যাকাউন্ট স্থায়ীভাবে সুরক্ষিত ও লক করা।'
                    : '2 Emergency Admin accounts are permanently locked for store recovery.'}
                </li>
              </ul>
            )}
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* MODAL: ADD NEW USER                                               */}
      {/* ================================================================= */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border-[1.5px] border-[#CBEAD9] dark:border-slate-700 overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-gradient-to-r from-[#00965E] to-[#007448] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <h3 className="text-sm font-black">
                  {isBengali ? 'নতুন ইউজার যোগ করুন' : 'Add New User Account'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDialog(false)}
                className="p-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="p-4 space-y-3">
              {/* Role Selector */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'অ্যাকাউন্ট রোল নির্বাচন করুন' : 'Select Role'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddRole(VaultRole.ACCOUNT_MANAGER)}
                    className={`p-2.5 rounded-xl border-[1.5px] text-left cursor-pointer transition-all ${
                      addRole === VaultRole.ACCOUNT_MANAGER
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-[#00965E]'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#00965E]" />
                      {isBengali ? 'ম্যানেজার' : 'Manager'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {isBengali ? 'বিক্রয়, পণ্য ও কাস্টমার' : 'POS, Stock & Dues'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddRole(VaultRole.ADMIN)}
                    className={`p-2.5 rounded-xl border-[1.5px] text-left cursor-pointer transition-all ${
                      addRole === VaultRole.ADMIN
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-600'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-indigo-600" />
                      {isBengali ? 'অ্যাডমিন' : 'Admin'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {isBengali ? 'সম্পূর্ণ দোকান নিয়ন্ত্রণ' : 'Full Store Access'}
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'ইউজারের নাম *' : 'Display Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder={isBengali ? 'যেমন: রাকিব (সেলস)' : 'e.g. Rakib (Sales)'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'ইমেইল ঠিকানা *' : 'Email Address *'}
                </label>
                <input
                  type="email"
                  required
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="user@siaamstore.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                    {isBengali
                      ? 'লগইন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *'
                      : 'Vault Password (min 6 chars) *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setAddPassword(generateRandomPassword(8))}
                    className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#00965E] hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{isBengali ? 'অটো তৈরি' : 'Generate'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs font-extrabold dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
                />
                {(() => {
                  const st = getPasswordStrength(addPassword);
                  return (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full ${st.bar}`} />
                      </div>
                      <span className={`text-[10px] font-bold ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDialog(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 cursor-pointer"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#00965E] hover:bg-[#007c4e] text-white cursor-pointer"
                >
                  {isBengali ? 'সংরক্ষণ ও সিঙ্ক' : 'Save & Sync'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: EDIT ACCOUNT & RESET PASSWORD                              */}
      {/* ================================================================= */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border-[1.5px] border-[#CBEAD9] dark:border-slate-700 overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-gradient-to-r from-[#00965E] to-[#007448] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                <h3 className="text-sm font-black">
                  {isBengali
                    ? 'ইউজার এডিট ও পাসওয়ার্ড রিসেট'
                    : 'Edit User & Reset Password'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="p-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateAccount} className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'ইউজারের নাম *' : 'Display Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'ইমেইল ঠিকানা *' : 'Email Address *'}
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                  {isBengali ? 'অ্যাকাউন্ট রোল' : 'Account Role'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditRole(VaultRole.ACCOUNT_MANAGER)}
                    className={`py-2 px-3 rounded-xl border text-xs font-extrabold cursor-pointer ${
                      editRole === VaultRole.ACCOUNT_MANAGER
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-[#00965E] text-[#007a4d] dark:text-emerald-300'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isBengali ? 'ম্যানেজার' : 'Account Manager'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditRole(VaultRole.ADMIN)}
                    className={`py-2 px-3 rounded-xl border text-xs font-extrabold cursor-pointer ${
                      editRole === VaultRole.ADMIN
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-600 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isBengali ? 'অ্যাডমিন' : 'Store Admin'}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                    {isBengali ? 'নতুন পাসওয়ার্ড *' : 'New Password *'}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditPassword(generateRandomPassword(10))
                      }
                      className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#00965E] hover:underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{isBengali ? 'অটো' : 'Generate'}</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs font-extrabold dark:bg-slate-900 dark:text-white focus:outline-none focus:border-[#00965E]"
                />
                {(() => {
                  const st = getPasswordStrength(editPassword);
                  return (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full ${st.bar}`} />
                      </div>
                      <span className={`text-[10px] font-bold ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 cursor-pointer"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#00965E] hover:bg-[#007c4e] text-white cursor-pointer"
                >
                  {isBengali ? 'আপডেট ও সিঙ্ক' : 'Update & Sync'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: CHANGE MY PASSWORD (SELF-SERVICE)                          */}
      {/* ================================================================= */}
      {showMyPasswordModal && currentUser && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full border-[1.5px] border-[#CBEAD9] dark:border-slate-700 overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-gradient-to-r from-[#00965E] to-[#007448] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                <h3 className="text-sm font-black">
                  {isBengali ? 'আমার পাসওয়ার্ড পরিবর্তন' : 'Change My Password'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMyPasswordModal(false)}
                className="p-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangeMyPassword} className="p-4 space-y-3">
              <p className="text-[11px] font-bold text-slate-500 truncate">
                {currentUser.email}
              </p>
              <input
                type="password"
                required
                value={myCurrentPwd}
                onChange={(e) => setMyCurrentPwd(e.target.value)}
                placeholder={
                  isBengali ? 'বর্তমান পাসওয়ার্ড *' : 'Current Password *'
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white"
              />
              <input
                type="password"
                required
                value={myNewPwd}
                onChange={(e) => setMyNewPwd(e.target.value)}
                placeholder={
                  isBengali
                    ? 'নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *'
                    : 'New Password (min 6 chars) *'
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white"
              />
              <input
                type="password"
                required
                value={myConfirmPwd}
                onChange={(e) => setMyConfirmPwd(e.target.value)}
                placeholder={
                  isBengali
                    ? 'নতুন পাসওয়ার্ড পুনরায় লিখুন *'
                    : 'Confirm New Password *'
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:bg-slate-900 dark:text-white"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowMyPasswordModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 cursor-pointer"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingMyPwd}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#00965E] text-white cursor-pointer disabled:opacity-60"
                >
                  {isUpdatingMyPwd
                    ? '...'
                    : isBengali
                    ? 'পাসওয়ার্ড আপডেট'
                    : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: CONFIRM DELETE ACCOUNT                                     */}
      {/* ================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-5 border border-red-200 dark:border-red-900/50 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-black">
                {isBengali ? 'ইউজার মুছে ফেলবেন?' : 'Remove User Account?'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <strong>{deleteTarget.name}</strong> ({deleteTarget.email})
            </p>
            <p className="text-[11px] text-slate-500">
              {isBengali
                ? 'এই ইউজারটি আর লগইন করতে পারবে না এবং পরিবর্তনটি ফায়ারবেসে সিঙ্ক হবে।'
                : 'This user will immediately lose login access across all devices.'}
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
                onClick={handleConfirmDelete}
                className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                {isBengali ? 'হ্যাঁ, মুছুন' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
