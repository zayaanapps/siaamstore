import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Cloud,
} from 'lucide-react';
import { vaultAccessService } from '../services/vaultAccessService';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthScreenProps {
  onSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Change Password Modal
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [changeEmail, setChangeEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Forgot Password (Admin Reset) Modal
  const [showForgotPasswordDialog, setShowForgotPasswordDialog] = useState(false);
  const [forgotAdminEmail, setForgotAdminEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusBanner(null);
    setIsLoading(true);

    try {
      await vaultAccessService.authenticateWithEmailPasswordCloudAware(
        emailInput,
        passwordInput
      );
      onSuccess();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAdminSignIn = async () => {
    setErrorMessage(null);
    setStatusBanner(null);
    setIsLoading(true);
    try {
      await vaultAccessService.signInAdminWithGooglePopup();
      onSuccess();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError(null);
    if (newPassword !== confirmNewPassword) {
      setChangeError('New passwords do not match.');
      return;
    }
    setIsChangingPassword(true);
    try {
      await vaultAccessService.changePasswordAndSyncToFirebase(
        changeEmail,
        currentPassword,
        newPassword
      );
      setShowChangePasswordDialog(false);
      setStatusBanner(
        'Password changed and synced to Firebase! Use your new password to log in.'
      );
      setEmailInput(changeEmail.trim());
      setPasswordInput('');
    } catch (err) {
      setChangeError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAdminForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('New passwords do not match.');
      return;
    }
    setIsResettingPassword(true);
    try {
      await vaultAccessService.resetPasswordByAdminAndSyncToFirebase(
        forgotAdminEmail,
        forgotNewPassword
      );
      setShowForgotPasswordDialog(false);
      setStatusBanner(
        'Admin password reset & synced to Firebase! Use your new password to log in.'
      );
      setEmailInput(forgotAdminEmail.trim());
      setPasswordInput('');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to reset admin password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#E9F7F3] via-[#F4FAF8] to-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[440px] bg-white rounded-[28px] border border-[#DCECE6] shadow-[0_20px_50px_rgba(6,78,59,0.08)] overflow-hidden">
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#064E3B] via-[#00965E] to-[#0D9488]" />

        <div className="p-6 sm:p-7 flex flex-col items-center">
          {/* Decorated Rounded-Square Logo Frame */}
          <div className="relative p-1.5 rounded-[24px] bg-gradient-to-br from-[#E6F8F0] via-white to-[#D1FAE5] border-[1.5px] border-[#A7F3D0] shadow-[0_10px_25px_rgba(0,168,107,0.16)] ring-4 ring-[#00965E]/10">
            <div className="w-[82px] h-[82px] rounded-[18px] overflow-hidden bg-[#1D3BB8] shadow-inner flex items-center justify-center">
              <img
                src="/assets/drawable/ic_siaam_store_logo.png"
                alt="Siaam Store Logo"
                className="w-full h-full object-cover scale-[1.04]"
              />
            </div>
          </div>

          {/* Security Badge Pill */}
          <div className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#E6F8F0] border border-[#B5F1D6]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
            <span className="text-[10px] font-extrabold tracking-[0.1em] text-[#059669] uppercase">
              ENCRYPTED CLOUD VAULT
            </span>
          </div>

          {/* Store Title & Subtitle */}
          <h1 className="mt-3 text-[23px] font-black text-[#064E3B] tracking-tight text-center">
            সিয়াম স্টোর | Siaam Store
          </h1>
          <p className="mt-1.5 text-[13.5px] font-medium text-[#64748B] text-center leading-relaxed max-w-[340px]">
            Sign in with your authorized store credentials to continue to Siaam Store
          </p>

          {/* Form */}
          <form onSubmit={handleUnlockVault} className="w-full mt-5 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                System Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#00965E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="admin@store.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-[14px] bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#00965E] focus:bg-white focus:outline-none text-sm text-[#0F172A] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                Vault Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#00965E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={passwordVisible ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Enter vault password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-[14px] bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#00965E] focus:bg-white focus:outline-none text-sm text-[#0F172A] transition"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
                  title={passwordVisible ? 'Hide password' : 'Show password'}
                >
                  {passwordVisible ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password & Change Password Row */}
            <div className="flex items-center justify-between pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setForgotAdminEmail(emailInput);
                  setForgotNewPassword('');
                  setForgotConfirmPassword('');
                  setForgotError(null);
                  setShowForgotPasswordDialog(true);
                }}
                className="text-xs font-bold text-[#DC2626] hover:underline"
              >
                Forgot Password?
              </button>

              <button
                type="button"
                onClick={() => {
                  setChangeEmail(emailInput);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setChangeError(null);
                  setShowChangePasswordDialog(true);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#00965E] hover:underline"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Change Password
              </button>
            </div>

            {/* Status Banner */}
            {statusBanner && (
              <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#065F46] shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-[#065F46] leading-relaxed">
                  {statusBanner}
                </p>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-[#B91C1C] leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Unlock Vault Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !emailInput.trim() || !passwordInput}
              className="w-full h-[50px] rounded-[14px] bg-[#00965E] hover:bg-[#057A50] disabled:bg-[#CBD5E1] text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Unlock Vault</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="w-full flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
              GOOGLE CLOUD SIGN-IN
            </span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          {/* Google Sign-In Button (Admin & Staff) */}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleGoogleAdminSignIn}
            className="w-full h-[46px] rounded-[14px] bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Cloud className="w-4 h-4 text-[#00965E]" />
            <span>Sign in with Google (Admin & Staff)</span>
          </button>

          {/* In-App PWA Install (iOS Safari Add to Home Screen & Android/Desktop) */}
          <PWAInstallButton variant="auth" />

          {/* Footer Status Bar: Firebase on Left, Location Ramchandrapur Haat on Right */}
          <div className="w-full mt-5 pt-3.5 border-t border-[#E2E8F0] flex items-center justify-between text-xs font-semibold text-[#64748B]">
            <div className="inline-flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-[#00965E]" />
              <span>Firebase</span>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#0088E8]" />
              <span>Ramchandrapur Haat</span>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePasswordDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-extrabold text-slate-900">
              Change Vault Password
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Update your password. Changes are synced in real time with Firebase Cloud so they work on all devices.
            </p>

            <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Email
                </label>
                <input
                  type="email"
                  required
                  value={changeEmail}
                  onChange={(e) => setChangeEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:border-[#00965E] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:border-[#00965E] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password (min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:border-[#00965E] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:border-[#00965E] focus:outline-none"
                />
              </div>

              {changeError && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  {changeError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordDialog(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00965E] hover:bg-[#057A50] text-white disabled:opacity-50"
                >
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Forgot Password Modal */}
      {showForgotPasswordDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-extrabold text-slate-900">
              Forgot Password? (Admin Reset)
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Verified Admin emails can directly reset their password and sync it to Firebase Cloud.
              Account Managers must ask an Admin to view or reset their password.
            </p>

            <form onSubmit={handleAdminForgotPassword} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={forgotAdminEmail}
                  onChange={(e) => setForgotAdminEmail(e.target.value)}
                  placeholder="Enter admin email"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:border-[#00965E] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password (min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:border-[#00965E] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:border-[#00965E] focus:outline-none"
                />
              </div>

              {forgotError && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  {forgotError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordDialog(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00965E] hover:bg-[#057A50] text-white disabled:opacity-50"
                >
                  {isResettingPassword ? 'Resetting...' : 'Reset & Sync to Firebase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
