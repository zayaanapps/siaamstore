import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  X,
  Lock,
  KeyRound,
  AlertTriangle,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  Download,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Fingerprint,
  Mail,
  Send,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { AppLanguage, toBengaliDigits } from '../types/dokan';
import {
  vaultAccessService,
  isPasswordValidForAccount,
} from '../services/vaultAccessService';

export interface DeletionProtectionTarget {
  title: string;
  titleBn: string;
  description: string;
  descriptionBn: string;
  itemCount: number;
  previewItems: string[];
  confirmPhrase: string;
  isPermanent: boolean;
  actionButtonLabel: string;
  actionButtonLabelBn: string;
  onExecute: () => Promise<void>;
}

interface DeletionProtectionModalProps {
  target: DeletionProtectionTarget | null;
  onClose: () => void;
  language: AppLanguage;
  onDownloadSafetyBackup?: () => void;
}

type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type OtpRecipientOption = 'ALL' | string;

const FINAL_WAIT_SECONDS = 180; // 3 minutes mandatory wait at final stage
const OTP_EXPIRY_SECONDS = 600; // 10 minutes
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const MAX_OTP_ATTEMPTS = 5;

function generateFourDigitCode(): string {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return String(1000 + (arr[0] % 9000));
}

function generateSixDigitOtp(): string {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

function formatMmSs(totalSeconds: number, language: AppLanguage): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return toBengaliDigits(formatted, language);
}

interface OtpDeliveryResult {
  email: string;
  ok: boolean;
  needsActivation?: boolean;
  message?: string;
}

async function dispatchOtpEmail(
  recipientEmail: string,
  otpCode: string,
  target: DeletionProtectionTarget,
  actorSummary: string
): Promise<OtpDeliveryResult> {
  try {
    const response = await fetch(
      `https://formsubmit.co/ajax/${encodeURIComponent(recipientEmail)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          _subject: '[Siaam Store Security] Deletion Verification OTP',
          _template: 'table',
          _captcha: 'false',
          Verification_OTP: otpCode,
          Action: `${target.title} (${target.itemCount} item${target.itemCount > 1 ? 's' : ''})`,
          Permanent_Erase: target.isPermanent ? 'YES (Irreversible)' : 'No (Moves to Recycle Bin)',
          Requested_By: actorSummary,
          Valid_For: '10 minutes',
          Requested_At: new Date().toLocaleString(),
        }),
      }
    );

    const data = await response.json().catch(() => ({}));
    const rawMsg = typeof data?.message === 'string' ? data.message : '';
    const isSuccess =
      response.ok && (data?.success === true || data?.success === 'true');
    const needsActivation =
      rawMsg.toLowerCase().includes('activate') ||
      rawMsg.toLowerCase().includes('confirm');

    if (isSuccess) {
      return { email: recipientEmail, ok: true };
    }

    return {
      email: recipientEmail,
      ok: false,
      needsActivation,
      message: rawMsg || `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      email: recipientEmail,
      ok: false,
      message: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export const DeletionProtectionModal: React.FC<DeletionProtectionModalProps> = ({
  target,
  onClose,
  language,
  onDownloadSafetyBackup,
}) => {
  const isBn = language === AppLanguage.BENGALI;
  const activeUser = vaultAccessService.getActiveSession();

  const [step, setStep] = useState<StepNumber>(1);

  // Layer 1: Risk acknowledgement checkboxes
  const [ackVerified, setAckVerified] = useState(false);
  const [ackConsequence, setAckConsequence] = useState(false);

  // Layer 2: Admin password verification
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Layer 3: Random 4-digit security challenge
  const [securityCode, setSecurityCode] = useState(() => generateFourDigitCode());
  const [codeInput, setCodeInput] = useState('');

  // Layer 4: Explicit confirmation phrase
  const [phraseInput, setPhraseInput] = useState('');

  // Layer 5: Email OTP verification (loaded dynamically from env or Firestore admin accounts)
  const authorizedOtpEmails = useMemo(
    () => vaultAccessService.getAuthorizedOtpEmails(),
    [target, activeUser]
  );
  const [otpRecipient, setOtpRecipient] = useState<OtpRecipientOption>('ALL');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpResults, setOtpResults] = useState<OtpDeliveryResult[]>([]);
  const [otpError, setOtpError] = useState('');
  const [otpExpiryLeft, setOtpExpiryLeft] = useState(0);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpVerified, setOtpVerified] = useState(false);

  // Layer 6: Mandatory deletion reason / accountability note
  const [deletionReason, setDeletionReason] = useState('');

  // Layer 7: Mandatory 3-minute (180s) wait timer + final unlock switch
  const [waitRemaining, setWaitRemaining] = useState(FINAL_WAIT_SECONDS);
  const [finalUnlockSwitch, setFinalUnlockSwitch] = useState(false);

  // Execution state
  const [executing, setExecuting] = useState(false);
  const [execError, setExecError] = useState('');

  // Reset all 7 layers cleanly whenever target changes
  useEffect(() => {
    if (target) {
      setStep(1);
      setAckVerified(false);
      setAckConsequence(false);
      setPasswordInput('');
      setShowPassword(false);
      setPasswordError('');
      setSecurityCode(generateFourDigitCode());
      setCodeInput('');
      setPhraseInput('');
      setOtpRecipient('ALL');
      setGeneratedOtp(null);
      setOtpInput('');
      setOtpSending(false);
      setOtpResults([]);
      setOtpError('');
      setOtpExpiryLeft(0);
      setOtpResendCooldown(0);
      setOtpAttempts(0);
      setOtpVerified(false);
      setDeletionReason('');
      setWaitRemaining(FINAL_WAIT_SECONDS);
      setFinalUnlockSwitch(false);
      setExecuting(false);
      setExecError('');
    }
  }, [target]);

  // OTP expiry & resend cooldown ticker
  useEffect(() => {
    if (!target || (!otpExpiryLeft && !otpResendCooldown)) return;
    const timer = window.setInterval(() => {
      setOtpExpiryLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setOtpResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [target, otpExpiryLeft > 0, otpResendCooldown > 0]);

  // Layer 7: 3-minute (180s) mandatory wait countdown
  useEffect(() => {
    if (!target || step !== 7) return;
    setWaitRemaining(FINAL_WAIT_SECONDS);
    setFinalUnlockSwitch(false);

    const timer = window.setInterval(() => {
      setWaitRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [target, step]);

  const phraseMatches = useMemo(() => {
    if (!target) return false;
    return (
      phraseInput.trim().toUpperCase() ===
      target.confirmPhrase.trim().toUpperCase()
    );
  }, [phraseInput, target]);

  const codeMatches = codeInput.trim() === securityCode;
  const reasonValid = deletionReason.trim().length >= 8;

  if (!target) return null;

  const verifyAdminPassword = (): boolean => {
    const trimmed = passwordInput.trim();
    if (!trimmed) {
      setPasswordError(
        isBn ? 'আপনার অ্যাডমিন পাসওয়ার্ড লিখুন' : 'Please enter your admin password'
      );
      return false;
    }

    if (activeUser && !isPasswordValidForAccount(activeUser, trimmed)) {
      setPasswordError(
        isBn
          ? 'পাসওয়ার্ড সঠিক নয়। আবার চেষ্টা করুন।'
          : 'Incorrect admin password. Please try again.'
      );
      return false;
    }

    setPasswordError('');
    return true;
  };

  const handleSendOtp = async () => {
    if (otpSending || otpResendCooldown > 0) return;

    const recipients =
      otpRecipient === 'ALL'
        ? authorizedOtpEmails
        : authorizedOtpEmails.includes(otpRecipient)
          ? [otpRecipient]
          : authorizedOtpEmails.slice(0, 1);

    if (recipients.length === 0) {
      setOtpError(
        isBn
          ? 'কোনো অনুমোদিত অ্যাডমিন ইমেইল পাওয়া যায়নি।'
          : 'No authorized admin email found for OTP delivery.'
      );
      return;
    }

    const newOtp = generateSixDigitOtp();
    const actorSummary = `${activeUser?.name || 'Admin'} (${activeUser?.email || 'N/A'})`;

    setOtpSending(true);
    setOtpError('');
    setOtpResults([]);
    setOtpInput('');
    setOtpVerified(false);
    setOtpAttempts(0);

    try {
      const results = await Promise.all(
        recipients.map((email) =>
          dispatchOtpEmail(email, newOtp, target, actorSummary)
        )
      );
      setOtpResults(results);

      const anyDelivered = results.some((r) => r.ok);
      if (anyDelivered) {
        setGeneratedOtp(newOtp);
        setOtpExpiryLeft(OTP_EXPIRY_SECONDS);
        setOtpResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      } else {
        setGeneratedOtp(null);
        const anyNeedsActivation = results.some((r) => r.needsActivation);
        setOtpError(
          anyNeedsActivation
            ? isBn
              ? 'প্রথমবার ব্যবহারের জন্য ইমেইল ইনবক্সে যাওয়া অ্যাক্টিভেশন লিঙ্কে ক্লিক করে আবার OTP পাঠান।'
              : 'First-time setup: please open the activation email sent to your inbox, click Activate, then tap Resend OTP.'
            : isBn
              ? 'ইমেইলে OTP পাঠানো যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
              : 'Could not deliver OTP email. Please check network connectivity and retry.'
        );
      }
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtpAndAdvance = () => {
    if (!generatedOtp) {
      setOtpError(
        isBn ? 'প্রথমে ইমেইলে OTP পাঠান।' : 'Please send an OTP to your email first.'
      );
      return;
    }
    if (otpExpiryLeft <= 0) {
      setOtpError(
        isBn
          ? 'OTP এর মেয়াদ শেষ হয়ে গেছে। নতুন OTP পাঠান।'
          : 'This OTP has expired. Please request a new OTP.'
      );
      return;
    }
    if (otpAttempts >= MAX_OTP_ATTEMPTS) {
      setOtpError(
        isBn
          ? 'অনেকবার ভুল কোড দেওয়া হয়েছে। নতুন OTP পাঠান।'
          : 'Too many failed attempts. Please request a new OTP.'
      );
      return;
    }

    if (otpInput.trim() !== generatedOtp) {
      const nextAttempts = otpAttempts + 1;
      setOtpAttempts(nextAttempts);
      const remaining = Math.max(0, MAX_OTP_ATTEMPTS - nextAttempts);
      if (remaining === 0) {
        setGeneratedOtp(null);
        setOtpError(
          isBn
            ? '৫ বার ভুল হয়েছে — এই OTP বাতিল করা হলো। নতুন OTP পাঠান।'
            : '5 wrong attempts — OTP invalidated. Please request a fresh OTP.'
        );
      } else {
        setOtpError(
          isBn
            ? `OTP কোড সঠিক নয়। আর ${toBengaliDigits(remaining, language)} বার চেষ্টা বাকি আছে।`
            : `Incorrect OTP code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`
        );
      }
      return;
    }

    setOtpError('');
    setOtpVerified(true);
    setStep(6);
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!ackVerified || !ackConsequence) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!verifyAdminPassword()) return;
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!codeMatches) return;
      setStep(4);
      return;
    }
    if (step === 4) {
      if (!phraseMatches) return;
      setStep(5);
      return;
    }
    if (step === 5) {
      verifyOtpAndAdvance();
      return;
    }
    if (step === 6) {
      if (!reasonValid) return;
      setStep(7);
    }
  };

  const handleFinalExecute = async () => {
    if (waitRemaining > 0 || !finalUnlockSwitch || executing) return;
    setExecuting(true);
    setExecError('');
    try {
      await target.onExecute();
      onClose();
    } catch (err) {
      setExecError(
        err instanceof Error
          ? err.message
          : isBn
            ? 'ডিলিট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
            : 'Deletion failed. Please try again.'
      );
    } finally {
      setExecuting(false);
    }
  };

  const layerTitles = [
    isBn ? 'ধাপ ১: প্রভাব যাচাই ও ব্যাকআপ' : 'Layer 1: Impact Review & Backup',
    isBn ? 'ধাপ ২: অ্যাডমিন পাসওয়ার্ড যাচাই' : 'Layer 2: Admin Password Check',
    isBn ? 'ধাপ ৩: নিরাপত্তা কোড চ্যালেঞ্জ' : 'Layer 3: Security Code Challenge',
    isBn ? 'ধাপ ৪: নিশ্চিতকরণ শব্দ' : 'Layer 4: Confirmation Phrase',
    isBn ? 'ধাপ ৫: ইমেইল OTP ভেরিফিকেশন' : 'Layer 5: Email OTP Verification',
    isBn ? 'ধাপ ৬: ডিলিটের কারণ লিপিবদ্ধ' : 'Layer 6: Mandatory Deletion Reason',
    isBn
      ? 'ধাপ ৭: ৩ মিনিট অপেক্ষা ও চূড়ান্ত লক'
      : 'Layer 7: 3-Minute Wait & Final Lock',
  ];

  const waitProgressPercent = Math.min(
    100,
    Math.round(((FINAL_WAIT_SECONDS - waitRemaining) / FINAL_WAIT_SECONDS) * 100)
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={() => {
        if (!executing) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isBn ? '৭-স্তরের ডিলিট সুরক্ষা' : '7-Layer Deletion Protection'}
    >
      <div
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border-2 border-red-200 dark:border-red-900/70 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Danger Shield Header */}
        <div className="bg-gradient-to-r from-red-800 via-red-600 to-rose-600 px-4 py-3.5 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-red-100">
                  {isBn
                    ? `৭-স্তরের সুরক্ষা · ধাপ ${toBengaliDigits(step, language)}/৭`
                    : `7-Layer Protection · Step ${step}/7`}
                </p>
                <h3 className="text-sm font-black truncate">
                  {isBn ? target.titleBn : target.title}
                </h3>
              </div>
            </div>
            <button
              type="button"
              disabled={executing}
              onClick={onClose}
              aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
              className="min-w-[38px] min-h-[38px] rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer disabled:opacity-50 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 7-Layer Visual Progress Bar */}
          <div className="mt-3 grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx < step
                    ? 'bg-emerald-300'
                    : idx === step
                      ? 'bg-white'
                      : 'bg-white/25'
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] font-bold text-red-50">
            {layerTitles[step - 1]}
          </p>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* LAYER 1: Impact Review & Risk Acknowledgement */}
          {step === 1 && (
            <div className="space-y-3.5">
              <div className="rounded-2xl bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 p-3.5 space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-extrabold text-red-700 dark:text-red-300">
                      {target.isPermanent
                        ? isBn
                          ? `স্থায়ীভাবে মুছে ফেলা (${toBengaliDigits(target.itemCount, language)} টি আইটেম) — ফিরিয়ে আনা যাবে না`
                          : `Permanent Erase (${target.itemCount} item${target.itemCount > 1 ? 's' : ''}) — Irreversible`
                        : isBn
                          ? `সতর্কতা: ${toBengaliDigits(target.itemCount, language)} টি রেকর্ড মুছে ফেলা হবে`
                          : `Warning: ${target.itemCount} record${target.itemCount > 1 ? 's' : ''} will be deleted`}
                    </p>
                    <p className="text-[11px] text-red-700/90 dark:text-red-200/80 leading-relaxed">
                      {isBn ? target.descriptionBn : target.description}
                    </p>
                  </div>
                </div>

                {target.previewItems.length > 0 && (
                  <div className="pt-2 border-t border-red-200/70 dark:border-red-900/60 space-y-1">
                    {target.previewItems.slice(0, 4).map((name, i) => (
                      <p
                        key={`${name}-${i}`}
                        className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate"
                      >
                        • {name}
                      </p>
                    ))}
                    {target.itemCount > 4 && (
                      <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
                        {isBn
                          ? `+ আরও ${toBengaliDigits(target.itemCount - 4, language)} টি আইটেম`
                          : `+ ${target.itemCount - 4} more item${target.itemCount - 4 > 1 ? 's' : ''}`}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {onDownloadSafetyBackup && (
                <button
                  type="button"
                  onClick={onDownloadSafetyBackup}
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[#008A54] dark:text-emerald-300 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isBn
                      ? 'ডিলিটের আগে ব্যাকআপ (JSON) সংরক্ষণ করুন'
                      : 'Download Safety Backup (JSON) First'}
                  </span>
                </button>
              )}

              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ackVerified}
                    onChange={(e) => setAckVerified(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-red-600 rounded cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                    {isBn
                      ? 'আমি নির্বাচিত রেকর্ডগুলো ভালোভাবে যাচাই করেছি।'
                      : 'I have carefully reviewed the selected records to be deleted.'}
                  </span>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ackConsequence}
                    onChange={(e) => setAckConsequence(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-red-600 rounded cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                    {target.isPermanent
                      ? isBn
                        ? 'আমি বুঝেছি যে এই স্থায়ী ডিলিট আর কখনোই পুনরুদ্ধার করা যাবে না।'
                        : 'I understand permanent deletion is irreversible and cannot be undone.'
                      : isBn
                        ? 'আমি বুঝেছি যে এতে দোকানের হিসাব ও সক্রিয় ডাটা প্রভাবিত হবে।'
                        : 'I understand this removes active store records and updates balances.'}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* LAYER 2: Admin Password Verification */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                    {isBn ? 'অ্যাডমিন পরিচয় নিশ্চিত করুন' : 'Verify Admin Identity'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {activeUser?.email || 'Admin Account'}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                  {isBn
                    ? 'আপনার বর্তমান লগইন পাসওয়ার্ড দিন'
                    : 'Enter your current login password'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    autoFocus
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (passwordError) setPasswordError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNextStep();
                    }}
                    placeholder={
                      isBn ? 'পাসওয়ার্ড লিখুন...' : 'Enter admin password...'
                    }
                    className="w-full min-h-[44px] pl-3.5 pr-11 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs font-bold text-red-600 dark:text-red-400">
                    {passwordError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* LAYER 3: Dynamic 4-Digit Security Code Challenge */}
          {step === 3 && (
            <div className="space-y-3.5">
              <div className="rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-4 text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-800 dark:text-amber-300">
                  <KeyRound className="w-4 h-4" />
                  <span>
                    {isBn
                      ? 'নিচের ৪-সংখ্যার নিরাপত্তা কোডটি লিখুন'
                      : 'Enter the 4-Digit Security Code Below'}
                  </span>
                </div>
                <div className="text-3xl font-black tracking-[0.35em] tabular-nums text-slate-900 dark:text-white select-none py-1">
                  {securityCode}
                </div>
                <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80">
                  {isBn
                    ? 'ভুলবশত ক্লিক এড়াতে এই কোডটি যাচাই করা হচ্ছে।'
                    : 'Prevents accidental taps or automated clicks.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={codeInput}
                  onChange={(e) =>
                    setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && codeMatches) handleNextStep();
                  }}
                  placeholder={isBn ? '৪ সংখ্যার কোড লিখুন' : 'Type 4-digit code'}
                  className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl border-2 text-center text-lg font-black tracking-[0.3em] tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none ${
                    codeMatches
                      ? 'border-[#00965E]'
                      : 'border-slate-300 dark:border-slate-700 focus:border-red-500'
                  }`}
                />
                {codeMatches && (
                  <p className="text-xs font-bold text-[#008A54] dark:text-emerald-400 text-center inline-flex items-center justify-center gap-1 w-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isBn ? 'নিরাপত্তা কোড মিলেছে' : 'Security code verified'}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* LAYER 4: Explicit Confirmation Phrase */}
          {step === 4 && (
            <div className="space-y-3.5">
              <div className="rounded-2xl bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 p-4 text-center space-y-1.5">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isBn
                    ? 'নিশ্চিত করতে নিচের শব্দটি হুবহু লিখুন:'
                    : 'Type the exact phrase below to continue:'}
                </p>
                <p className="text-lg font-black tracking-widest text-red-700 dark:text-red-400 font-mono select-all">
                  {target.confirmPhrase}
                </p>
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  autoFocus
                  value={phraseInput}
                  onChange={(e) => setPhraseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && phraseMatches) handleNextStep();
                  }}
                  placeholder={target.confirmPhrase}
                  className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl border-2 text-center text-sm font-black tracking-wider uppercase bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none ${
                    phraseMatches
                      ? 'border-[#00965E]'
                      : 'border-slate-300 dark:border-slate-700 focus:border-red-500'
                  }`}
                />
                {phraseMatches && (
                  <p className="text-xs font-bold text-[#008A54] dark:text-emerald-400 text-center inline-flex items-center justify-center gap-1 w-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {isBn ? 'নিশ্চিতকরণ শব্দ সঠিক' : 'Confirmation phrase matched'}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* LAYER 5 (NEW): Email OTP Verification */}
          {step === 5 && (
            <div className="space-y-3.5">
              <div className="rounded-2xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 p-3.5 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {isBn
                        ? 'মালিকের ইমেইলে ৬-সংখ্যার OTP পাঠান'
                        : 'Send 6-Digit Owner Email OTP'}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug mt-0.5">
                      {isBn
                        ? 'অনুমোদিত ইমেইল নির্বাচন করুন এবং ইনবক্সে পাওয়া ৬-সংখ্যার কোডটি লিখুন।'
                        : 'Select authorized owner email(s) below and enter the 6-digit code sent to your inbox.'}
                    </p>
                  </div>
                </div>

                {/* Authorized Email Recipient Selector */}
                <div className="space-y-1.5">
                  {([
                    ...(authorizedOtpEmails.length > 1
                      ? [
                          {
                            key: 'ALL' as OtpRecipientOption,
                            label: isBn
                              ? 'সব অনুমোদিত ইমেইলে পাঠান (প্রস্তাবিত)'
                              : 'All Authorized Emails (Recommended)',
                            sub: authorizedOtpEmails.join(' & '),
                          },
                        ]
                      : []),
                    ...authorizedOtpEmails.map((email, idx) => ({
                      key: email as OtpRecipientOption,
                      label: email,
                      sub:
                        idx === 0
                          ? isBn
                            ? 'প্রাইমারি ওনার ইমেইল'
                            : 'Primary Owner Email'
                          : isBn
                            ? 'অ্যাডমিন ইমেইল'
                            : 'Authorized Admin Email',
                    })),
                  ]).map((opt) => {
                    const active =
                      otpRecipient === opt.key ||
                      (authorizedOtpEmails.length === 1 && otpRecipient === 'ALL');
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={otpSending}
                        onClick={() => setOtpRecipient(opt.key)}
                        className={`w-full text-left px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-slate-900 border-sky-500 ring-1 ring-sky-500/30'
                            : 'bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-sky-300'
                        }`}
                      >
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {opt.label}
                        </p>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                          {opt.sub}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={otpSending || otpResendCooldown > 0}
                  onClick={handleSendOtp}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 dark:disabled:bg-slate-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {otpSending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{isBn ? 'OTP পাঠানো হচ্ছে...' : 'Sending OTP...'}</span>
                    </>
                  ) : otpResendCooldown > 0 ? (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {isBn
                          ? `পুনরায় পাঠান (${toBengaliDigits(otpResendCooldown, language)} সে.)`
                          : `Resend OTP in ${otpResendCooldown}s`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {generatedOtp
                          ? isBn
                            ? 'নতুন ৬-সংখ্যার OTP পাঠান'
                            : 'Resend 6-Digit OTP'
                          : isBn
                            ? 'ইমেইলে ৬-সংখ্যার OTP পাঠান'
                            : 'Send 6-Digit OTP to Email'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Delivery Status Feedback */}
              {otpResults.length > 0 && (
                <div className="space-y-1">
                  {otpResults.map((res) => (
                    <div
                      key={res.email}
                      className={`px-3 py-2 rounded-xl border text-[11px] font-semibold flex items-center justify-between gap-2 ${
                        res.ok
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-[#007A4D] dark:text-emerald-300'
                          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      <span className="truncate">{res.email}</span>
                      <span className="font-extrabold shrink-0">
                        {res.ok
                          ? isBn
                            ? 'পাঠানো হয়েছে'
                            : 'OTP Sent'
                          : res.needsActivation
                            ? isBn
                              ? 'অ্যাক্টিভেশন প্রয়োজন'
                              : 'Activate Inbox Link'
                            : isBn
                              ? 'ব্যর্থ হয়েছে'
                              : 'Failed'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* OTP Input Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <label className="font-bold text-slate-700 dark:text-slate-200">
                    {isBn ? '৬-সংখ্যার OTP কোড লিখুন' : 'Enter 6-Digit OTP Code'}
                  </label>
                  {generatedOtp && otpExpiryLeft > 0 && (
                    <span className="font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                      {isBn ? 'মেয়াদ: ' : 'Expires: '}
                      {formatMmSs(otpExpiryLeft, language)}
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpInput}
                  disabled={!generatedOtp || otpExpiryLeft <= 0}
                  onChange={(e) => {
                    setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (otpError) setOtpError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && otpInput.length === 6) {
                      verifyOtpAndAdvance();
                    }
                  }}
                  placeholder={isBn ? '৬ সংখ্যার OTP' : '000000'}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 focus:border-sky-600 text-center text-lg font-black tracking-[0.35em] tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none"
                />

                {otpError && (
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 leading-snug">
                    {otpError}
                  </p>
                )}
                {otpVerified && (
                  <p className="text-xs font-bold text-[#008A54] dark:text-emerald-400 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isBn ? 'ইমেইল OTP যাচাই সফল' : 'Email OTP verified'}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* LAYER 6 (NEW): Mandatory Deletion Reason & Accountability Note */}
          {step === 6 && (
            <div className="space-y-3.5">
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                    {isBn
                      ? 'ডিলিটের সুস্পষ্ট কারণ উল্লেখ করুন'
                      : 'State Reason for Deletion'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                    {isBn
                      ? 'কমপক্ষে ৮ অক্ষরে লিখুন কেন এই ডাটা মুছে ফেলা হচ্ছে (যেমন: ভুল এন্ট্রি বা পুরানো হিসাব ক্লিনআপ)।'
                      : 'Write at least 8 characters explaining why these records are being deleted (e.g., duplicate entry or old cleanup).'}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <textarea
                  rows={3}
                  autoFocus
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  placeholder={
                    isBn
                      ? 'ডিলিটের কারণ এখানে লিখুন...'
                      : 'Enter clear reason for this deletion...'
                  }
                  className={`w-full px-3.5 py-2.5 rounded-xl border-2 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none resize-none ${
                    reasonValid
                      ? 'border-[#00965E]'
                      : 'border-slate-300 dark:border-slate-700 focus:border-red-500'
                  }`}
                />
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span
                    className={
                      reasonValid
                        ? 'text-[#008A54] dark:text-emerald-400'
                        : 'text-slate-400'
                    }
                  >
                    {reasonValid
                      ? isBn
                        ? 'কারণ গ্রহণযোগ্য'
                        : 'Reason accepted'
                      : isBn
                        ? 'ন্যূনতম ৮ অক্ষর প্রয়োজন'
                        : 'Minimum 8 characters required'}
                  </span>
                  <span className="tabular-nums text-slate-500">
                    {toBengaliDigits(deletionReason.trim().length, language)}/
                    {toBengaliDigits(8, language)}+
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* LAYER 7 (FINAL STAGE): Mandatory 3-Minute Wait Timer + Final Safety Lock */}
          {step === 7 && (
            <div className="space-y-3.5">
              <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 border-2 border-red-200 dark:border-red-900 p-4 text-center space-y-2.5">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-sm">
                  {waitRemaining > 0 ? (
                    <Clock className="w-7 h-7" />
                  ) : (
                    <Fingerprint className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-red-600 dark:text-red-400">
                    {waitRemaining > 0
                      ? isBn
                        ? 'চূড়ান্ত নিরাপত্তা বিরতি (৩ মিনিট)'
                        : 'Final 3-Minute Cooling-Off Period'
                      : isBn
                        ? '৩ মিনিট অপেক্ষা সম্পন্ন'
                        : '3-Minute Wait Complete'}
                  </p>
                  <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-white mt-0.5">
                    {formatMmSs(waitRemaining, language)}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-red-200/80 dark:bg-red-900/60 overflow-hidden">
                  <div
                    className="h-full bg-red-600 dark:bg-red-400 transition-all duration-1000"
                    style={{ width: `${waitProgressPercent}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {waitRemaining > 0
                    ? isBn
                      ? 'ভুল সিদ্ধান্ত রোধে চূড়ান্ত ডিলিট বাটনটি ৩ মিনিট পর স্বয়ংক্রিয়ভাবে আনলক হবে। চাইলে যেকোনো সময় বাতিল করতে পারেন।'
                      : 'To prevent irreversible mistakes, the final delete lock stays disabled for 3 full minutes. You may cancel anytime.'
                    : isBn
                      ? 'সব ৭টি সুরক্ষা স্তর সম্পন্ন হয়েছে। নিচের আনলক সুইচ চালু করে ডিলিট নিশ্চিত করুন।'
                      : 'All 7 security layers cleared. Enable the final unlock switch below to execute deletion.'}
                </p>
              </div>

              <button
                type="button"
                disabled={waitRemaining > 0 || executing}
                onClick={() => setFinalUnlockSwitch((prev) => !prev)}
                className={`w-full min-h-[48px] px-4 py-2.5 rounded-2xl border-2 flex items-center justify-between gap-3 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  finalUnlockSwitch
                    ? 'bg-red-600/10 border-red-600 text-red-700 dark:text-red-300'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span className="inline-flex items-center gap-2 text-xs font-extrabold">
                  {waitRemaining > 0 ? (
                    <Clock className="w-4 h-4 text-amber-600" />
                  ) : finalUnlockSwitch ? (
                    <ShieldCheck className="w-4 h-4 text-red-600" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    {isBn
                      ? 'ফাইনাল ডিলিট আনলক করুন'
                      : 'Unlock Final Delete Button'}
                  </span>
                </span>
                <span
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center ${
                    finalUnlockSwitch
                      ? 'bg-red-600 justify-end'
                      : 'bg-slate-300 dark:bg-slate-600 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
                </span>
              </button>

              {execError && (
                <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center">
                  {execError}
                </p>
              )}
            </div>
          )}

          {/* Footer Navigation / Execute Buttons */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            {step === 1 ? (
              <button
                type="button"
                disabled={executing}
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
            ) : (
              <button
                type="button"
                disabled={executing}
                onClick={() =>
                  setStep((prev) => Math.max(1, prev - 1) as StepNumber)
                }
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{isBn ? 'আগের ধাপ' : 'Back'}</span>
              </button>
            )}

            {step < 7 ? (
              <button
                type="button"
                disabled={
                  (step === 1 && (!ackVerified || !ackConsequence)) ||
                  (step === 2 && !passwordInput.trim()) ||
                  (step === 3 && !codeMatches) ||
                  (step === 4 && !phraseMatches) ||
                  (step === 5 &&
                    (!generatedOtp ||
                      otpInput.trim().length !== 6 ||
                      otpExpiryLeft <= 0)) ||
                  (step === 6 && !reasonValid)
                }
                onClick={handleNextStep}
                className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <span>
                  {step === 5
                    ? isBn
                      ? 'OTP যাচাই করুন (৬/৭)'
                      : 'Verify OTP (6/7)'
                    : isBn
                      ? `পরবর্তী ধাপ (${toBengaliDigits(step + 1, language)}/৭)`
                      : `Continue (${step + 1}/7)`}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={waitRemaining > 0 || !finalUnlockSwitch || executing}
                onClick={handleFinalExecute}
                className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {executing
                    ? isBn
                      ? 'ডিলিট হচ্ছে...'
                      : 'Deleting...'
                    : waitRemaining > 0
                      ? isBn
                        ? `অপেক্ষা (${formatMmSs(waitRemaining, language)})`
                        : `Locked (${formatMmSs(waitRemaining, language)})`
                      : isBn
                        ? target.actionButtonLabelBn
                        : target.actionButtonLabel}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
