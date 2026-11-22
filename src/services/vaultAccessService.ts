import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { VaultRole, VaultUserAccount } from '../types/dokan';

const STORAGE_ACCOUNTS_KEY = 'siaam_store_vault_accounts_v1';
const STORAGE_ACTIVE_EMAIL_KEY = 'siaam_store_vault_active_email_v1';

export const SHARED_ACCOUNTS_COLLECTION = 'siaam_store_accounts';
export const SHARED_STORE_USER_ID = 'siaam_store_shared';
export const DEFAULT_SEED_TIMESTAMP = 1000;
export const DEFAULT_ACCOUNT_MANAGER_EMAIL = 'sales@siaamstore.com';
export const DEFAULT_ACCOUNT_MANAGER_NAME = 'Sales Manager (Siaam Store)';

export const STORE_NAME_BN = 'সিয়াম স্টোর';
export const STORE_NAME_EN = 'Siaam Store';
export const STORE_BRANCH_LOCATION = 'Ramchandrapur Haat, Chapainawabganj';
export const STORE_BRANCH_LOCATION_EN = 'Ramchandrapur Haat, Chapainawabganj';
export const STORE_BRANCH_LOCATION_BN = 'রামচন্দ্রপুর হাট, চাঁপাইনবাবগঞ্জ';
export const STORE_PHONE_NUMBERS = '01740999627 & 01303033353';
export const STORE_PHONE_NUMBERS_EN = '01740999627 & 01303033353';
export const STORE_PHONE_NUMBERS_BN = '০১৭৪০৯৯৯৬২৭ ও ০১৩০৩০৩৩৩৫৩';

function parseEnvList(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const ENV_EMERGENCY_ADMIN_EMAILS: string[] = parseEnvList(
  import.meta.env.VITE_EMERGENCY_ADMIN_EMAILS
).map((e) => e.toLowerCase());

export const EMERGENCY_ADMIN_PASSWORDS: string[] = parseEnvList(
  import.meta.env.VITE_EMERGENCY_ADMIN_PASSWORDS
);

const ENV_DELETION_OTP_EMAILS: string[] = parseEnvList(
  import.meta.env.VITE_DELETION_OTP_EMAILS
).map((e) => e.toLowerCase());

export const LOCKED_EMERGENCY_ADMINS: Record<string, string> = Object.fromEntries(
  ENV_EMERGENCY_ADMIN_EMAILS.map((email) => [email, 'Emergency Admin'])
);

export function isLockedEmergencyAdmin(
  emailOrAccount: string | VaultUserAccount
): boolean {
  if (typeof emailOrAccount !== 'string') {
    if (emailOrAccount.isLockedEmergencyAdmin) return true;
    const clean = (emailOrAccount.email || '').trim().toLowerCase();
    return ENV_EMERGENCY_ADMIN_EMAILS.includes(clean);
  }
  const clean = (emailOrAccount || '').trim().toLowerCase();
  return ENV_EMERGENCY_ADMIN_EMAILS.includes(clean);
}

export function isPasswordValidForAccount(
  account: VaultUserAccount,
  inputPassword: string
): boolean {
  const cleanInput = (inputPassword || '').trim();
  if (!cleanInput) return false;
  if (account.password && account.password === cleanInput) {
    return true;
  }
  if (
    isLockedEmergencyAdmin(account) &&
    EMERGENCY_ADMIN_PASSWORDS.length > 0
  ) {
    return EMERGENCY_ADMIN_PASSWORDS.includes(cleanInput);
  }
  return false;
}

function accountDocIdForEmail(email: string): string {
  const sanitized = email
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  return `acc_${sanitized.slice(0, 100)}`;
}

function buildFirestorePayload(account: VaultUserAccount, ownerUserId: string) {
  const safeCreatedMillis = Math.max(1000, account.createdAtMillis || DEFAULT_SEED_TIMESTAMP);
  const createdTs = Timestamp.fromMillis(safeCreatedMillis);
  return {
    userId: ownerUserId,
    name: (account.name || 'Store User').trim().slice(0, 100) || 'Store User',
    email: account.email.trim().toLowerCase().slice(0, 120),
    password: (account.password || '').trim().slice(0, 120),
    role: account.role,
    addedBy: (account.addedBy || 'System').trim().slice(0, 120) || 'System',
    createdAt: createdTs,
    updatedAt: serverTimestamp(),
  };
}

type Listener = () => void;

class VaultAccessService {
  private accounts: VaultUserAccount[] = [];
  private activeSession: VaultUserAccount | null = null;
  private isCloudSynced = false;
  private isAuthReady = false;
  private authCheckSeq = 0;
  private listeners: Set<Listener> = new Set();
  private unsubscribeShared: (() => void) | null = null;
  private listeningUid: string | null = null;

  constructor() {
    this.ensureSeededDefaultAccounts();
    this.observeFirebaseAuthAndSync();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  getAccounts(): VaultUserAccount[] {
    return this.accounts;
  }

  getActiveSession(): VaultUserAccount | null {
    return this.activeSession;
  }

  getIsAuthReady(): boolean {
    return this.isAuthReady;
  }

  getIsCloudSynced(): boolean {
    return this.isCloudSynced;
  }

  getAuthorizedOtpEmails(): string[] {
    if (ENV_DELETION_OTP_EMAILS.length > 0) {
      return [...ENV_DELETION_OTP_EMAILS];
    }
    const lockedEmails = this.accounts
      .filter((a) => a.isLockedEmergencyAdmin && a.email.includes('@'))
      .map((a) => a.email.toLowerCase().trim());
    if (lockedEmails.length > 0) {
      return Array.from(new Set(lockedEmails));
    }
    const adminEmails = this.accounts
      .filter((a) => a.role === VaultRole.ADMIN && a.email.includes('@'))
      .map((a) => a.email.toLowerCase().trim());
    if (adminEmails.length > 0) {
      return Array.from(new Set(adminEmails));
    }
    if (this.activeSession?.email && this.activeSession.email.includes('@')) {
      return [this.activeSession.email.toLowerCase().trim()];
    }
    return [];
  }

  private readAccountsFromStorage(): VaultUserAccount[] {
    try {
      const raw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.map((item) => {
        const email = String(item.email || '').trim().toLowerCase();
        const role =
          item.role === VaultRole.ADMIN ? VaultRole.ADMIN : VaultRole.ACCOUNT_MANAGER;
        const addedBy = String(item.addedBy || 'System');
        const locked =
          Boolean(item.isLockedEmergencyAdmin) ||
          addedBy === 'Emergency Lock' ||
          isLockedEmergencyAdmin(email);
        return {
          name: String(item.name || 'Store User'),
          email,
          password: String(item.password || ''),
          role: locked ? VaultRole.ADMIN : role,
          addedBy,
          createdAtMillis: Number(item.createdAtMillis) || DEFAULT_SEED_TIMESTAMP,
          updatedAtMillis: Number(item.updatedAtMillis) || DEFAULT_SEED_TIMESTAMP,
          pendingCloudSync: Boolean(item.pendingCloudSync),
          isLockedEmergencyAdmin: locked,
        };
      });
    } catch {
      return [];
    }
  }

  private saveAccountsToStorage(list: VaultUserAccount[]) {
    try {
      localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(list));
    } catch {
      // Ignore storage quota issues
    }
  }

  private ensureSeededDefaultAccounts() {
    const existing = [...this.readAccountsFromStorage()];
    let modified = false;

    const envInitialPassword = EMERGENCY_ADMIN_PASSWORDS[0] || '';
    for (const email of ENV_EMERGENCY_ADMIN_EMAILS) {
      const normalized = email.toLowerCase().trim();
      if (!normalized || !normalized.includes('@')) continue;
      const idx = existing.findIndex((a) => a.email.toLowerCase() === normalized);
      if (idx < 0 && envInitialPassword.length >= 6) {
        existing.push({
          name: 'Emergency Admin',
          email: normalized,
          password: envInitialPassword,
          role: VaultRole.ADMIN,
          addedBy: 'Emergency Lock',
          createdAtMillis: DEFAULT_SEED_TIMESTAMP,
          updatedAtMillis: DEFAULT_SEED_TIMESTAMP,
          pendingCloudSync: false,
          isLockedEmergencyAdmin: true,
        });
        modified = true;
      } else if (idx >= 0) {
        const current = existing[idx];
        if (!current.isLockedEmergencyAdmin || current.role !== VaultRole.ADMIN) {
          existing[idx] = {
            ...current,
            role: VaultRole.ADMIN,
            addedBy: 'Emergency Lock',
            isLockedEmergencyAdmin: true,
          };
          modified = true;
        }
      }
    }

    if (modified) {
      this.saveAccountsToStorage(existing);
    }
    this.accounts = existing;
  }

  private stopSharedStoreFirestoreSync() {
    if (this.unsubscribeShared) {
      this.unsubscribeShared();
      this.unsubscribeShared = null;
    }
  }

  private parseAccountDocData(
    data: Record<string, unknown>,
    fallbackEmail: string
  ): VaultUserAccount | null {
    const email = String(data.email || fallbackEmail || '')
      .toLowerCase()
      .trim();
    if (!email || !email.includes('@')) return null;

    const remoteName = String(data.name || '').trim() || 'Store User';
    const remotePassword = String(data.password || '').trim();
    const remoteRole =
      data.role === VaultRole.ADMIN ? VaultRole.ADMIN : VaultRole.ACCOUNT_MANAGER;
    const remoteAddedBy = String(data.addedBy || '').trim() || 'Cloud Sync';
    const remoteCreatedMillis =
      data.createdAt instanceof Timestamp
        ? data.createdAt.toMillis()
        : DEFAULT_SEED_TIMESTAMP;
    const remoteUpdatedMillis =
      data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : Date.now();
    const locked =
      remoteAddedBy === 'Emergency Lock' || isLockedEmergencyAdmin(email);

    return {
      name: remoteName,
      email,
      password: remotePassword,
      role: locked ? VaultRole.ADMIN : remoteRole,
      addedBy: locked ? 'Emergency Lock' : remoteAddedBy,
      createdAtMillis: remoteCreatedMillis,
      updatedAtMillis: remoteUpdatedMillis,
      pendingCloudSync: false,
      isLockedEmergencyAdmin: locked,
    };
  }

  private async fetchOwnAccountFromFirestore(
    emailInput: string
  ): Promise<VaultUserAccount | null> {
    const cleanEmail = (emailInput || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return null;
    const docId = accountDocIdForEmail(cleanEmail);
    const ref = doc(db, SHARED_ACCOUNTS_COLLECTION, docId);
    try {
      const snap = await getDocFromServer(ref);
      if (!snap.exists()) return null;
      return this.parseAccountDocData(
        snap.data() as Record<string, unknown>,
        cleanEmail
      );
    } catch {
      try {
        const cachedSnap = await getDoc(ref);
        if (!cachedSnap.exists()) return null;
        return this.parseAccountDocData(
          cachedSnap.data() as Record<string, unknown>,
          cleanEmail
        );
      } catch {
        return null;
      }
    }
  }

  private async resolveSignedInFirebaseUser(
    fbUser: FirebaseUser,
    seq: number
  ): Promise<void> {
    const cleanEmail = (fbUser.email || '').trim().toLowerCase();
    if (!cleanEmail || !fbUser.emailVerified) {
      this.stopSharedStoreFirestoreSync();
      this.listeningUid = null;
      this.activeSession = null;
      try {
        localStorage.removeItem(STORAGE_ACTIVE_EMAIL_KEY);
      } catch {
        // Ignore storage error
      }
      if (seq === this.authCheckSeq) {
        this.isAuthReady = true;
        this.notify();
      }
      return;
    }

    const account = await this.fetchOwnAccountFromFirestore(cleanEmail);
    if (seq !== this.authCheckSeq) return;

    if (!account) {
      this.stopSharedStoreFirestoreSync();
      this.listeningUid = null;
      this.activeSession = null;
      try {
        localStorage.removeItem(STORAGE_ACTIVE_EMAIL_KEY);
      } catch {
        // Ignore storage error
      }
      try {
        await firebaseSignOut(auth);
      } catch {
        // Ignore signout error
      }
      this.isAuthReady = true;
      this.notify();
      return;
    }

    const resolvedAccount: VaultUserAccount =
      fbUser.displayName &&
      account.name !== fbUser.displayName &&
      !isLockedEmergencyAdmin(cleanEmail)
        ? { ...account, name: fbUser.displayName }
        : account;

    this.listeningUid = fbUser.uid;
    this.isCloudSynced = true;
    this.activeSession = resolvedAccount;
    try {
      localStorage.setItem(STORAGE_ACTIVE_EMAIL_KEY, cleanEmail);
    } catch {
      // Ignore storage error
    }

    if (resolvedAccount.role === VaultRole.ADMIN) {
      const existingIdx = this.accounts.findIndex(
        (a) => a.email.toLowerCase() === cleanEmail
      );
      if (existingIdx >= 0) {
        const copy = [...this.accounts];
        copy[existingIdx] = resolvedAccount;
        this.accounts = copy;
      } else {
        this.accounts = [...this.accounts, resolvedAccount];
      }
      this.saveAccountsToStorage(this.accounts);
      this.startSharedStoreFirestoreSync();
    } else {
      this.stopSharedStoreFirestoreSync();
      this.accounts = [resolvedAccount];
      this.saveAccountsToStorage(this.accounts);
    }

    this.isAuthReady = true;
    this.notify();
  }

  private observeFirebaseAuthAndSync() {
    onAuthStateChanged(auth, (user) => {
      const seq = ++this.authCheckSeq;
      if (!user) {
        this.stopSharedStoreFirestoreSync();
        this.listeningUid = null;
        this.activeSession = null;
        try {
          localStorage.removeItem(STORAGE_ACTIVE_EMAIL_KEY);
        } catch {
          // Ignore storage error
        }
        this.isAuthReady = true;
        this.notify();
        return;
      }

      void this.resolveSignedInFirebaseUser(user, seq);
    });
  }

  private async pushAccountToUserSubcollection(uid: string, account: VaultUserAccount) {
    const docId = accountDocIdForEmail(account.email);
    const userRef = doc(db, 'users', uid, 'vault_accounts', docId);
    try {
      await setDoc(userRef, buildFirestorePayload(account, uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/vault_accounts/${docId}`);
    }
  }

  private async pushAccountToFirestore(account: VaultUserAccount) {
    const docId = accountDocIdForEmail(account.email);
    const sharedRef = doc(db, SHARED_ACCOUNTS_COLLECTION, docId);
    const sharedPayload = buildFirestorePayload(account, SHARED_STORE_USER_ID);
    try {
      await setDoc(sharedRef, sharedPayload);
      this.isCloudSynced = true;
      this.markAccountSyncedLocally(account.email, account.updatedAtMillis);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${SHARED_ACCOUNTS_COLLECTION}/${docId}`);
    }

    const uid = auth.currentUser?.uid;
    if (uid) {
      await this.pushAccountToUserSubcollection(uid, account);
    }
  }

  async pushAccountToFirestoreAwait(account: VaultUserAccount): Promise<boolean> {
    try {
      await this.pushAccountToFirestore(account);
      return true;
    } catch {
      return false;
    }
  }

  private markAccountSyncedLocally(email: string, syncedUpdatedAtMillis: number) {
    const idx = this.accounts.findIndex((a) => a.email.toLowerCase() === email.toLowerCase());
    if (idx >= 0) {
      const current = this.accounts[idx];
      if (current.pendingCloudSync && current.updatedAtMillis <= syncedUpdatedAtMillis) {
        const cleared = { ...current, pendingCloudSync: false };
        const updatedList = [...this.accounts];
        updatedList[idx] = cleared;
        this.accounts = updatedList;
        this.saveAccountsToStorage(updatedList);
        if (this.activeSession?.email.toLowerCase() === email.toLowerCase()) {
          this.activeSession = cleared;
        }
        this.notify();
      }
    }
  }

  private async deleteAccountFromFirestore(email: string) {
    const docId = accountDocIdForEmail(email);
    const sharedRef = doc(db, SHARED_ACCOUNTS_COLLECTION, docId);
    try {
      await deleteDoc(sharedRef);
      const uid = auth.currentUser?.uid;
      if (uid) {
        await deleteDoc(doc(db, 'users', uid, 'vault_accounts', docId));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${SHARED_ACCOUNTS_COLLECTION}/${docId}`);
    }
  }

  setActiveSession(account: VaultUserAccount | null) {
    this.activeSession = account;
    try {
      if (!account) {
        localStorage.removeItem(STORAGE_ACTIVE_EMAIL_KEY);
      } else {
        localStorage.setItem(
          STORAGE_ACTIVE_EMAIL_KEY,
          account.email.toLowerCase().trim()
        );
      }
    } catch {
      // Ignore storage error
    }
    this.notify();
  }

  clearSession() {
    this.stopSharedStoreFirestoreSync();
    this.setActiveSession(null);
  }

  private startSharedStoreFirestoreSync() {
    if (!auth.currentUser || !auth.currentUser.emailVerified) {
      return;
    }
    this.stopSharedStoreFirestoreSync();
    const sharedQuery = query(
      collection(db, SHARED_ACCOUNTS_COLLECTION),
      where('userId', '==', SHARED_STORE_USER_ID)
    );
    this.unsubscribeShared = onSnapshot(
      sharedQuery,
      (snapshot) => {
        this.isCloudSynced = true;
        const currentLocalList = this.accounts;
        const localByEmail = new Map(
          currentLocalList.map((a) => [a.email.toLowerCase().trim(), a])
        );

        if (snapshot.empty) {
          currentLocalList.forEach((acc) => {
            void this.pushAccountToFirestore(acc);
          });
          this.notify();
          return;
        }

        const mergedByEmail = new Map<string, VaultUserAccount>();

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const email = String(data.email || '').toLowerCase().trim();
          if (!email || !email.includes('@')) return;

          const remoteName = String(data.name || '').trim() || 'Store User';
          const remotePassword = String(data.password || '').trim();
          const remoteRole =
            data.role === VaultRole.ADMIN ? VaultRole.ADMIN : VaultRole.ACCOUNT_MANAGER;
          const remoteAddedBy = String(data.addedBy || '').trim() || 'Cloud Sync';
          const remoteCreatedMillis =
            data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : DEFAULT_SEED_TIMESTAMP;
          const remoteUpdatedMillis =
            data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : Date.now();

          const localAcc = localByEmail.get(email);
          if (
            localAcc &&
            localAcc.pendingCloudSync &&
            localAcc.updatedAtMillis > remoteUpdatedMillis
          ) {
            mergedByEmail.set(email, localAcc);
            void this.pushAccountToFirestore(localAcc);
          } else {
            const locked =
              remoteAddedBy === 'Emergency Lock' || isLockedEmergencyAdmin(email);
            const resolvedAccount: VaultUserAccount = {
              name: remoteName,
              email,
              password: remotePassword,
              role: locked ? VaultRole.ADMIN : remoteRole,
              addedBy: locked ? 'Emergency Lock' : remoteAddedBy,
              createdAtMillis: remoteCreatedMillis,
              updatedAtMillis: remoteUpdatedMillis,
              pendingCloudSync: false,
              isLockedEmergencyAdmin: locked,
            };
            mergedByEmail.set(email, resolvedAccount);
          }
        });

        currentLocalList.forEach((localAcc) => {
          const cleanEmail = localAcc.email.toLowerCase().trim();
          if (!mergedByEmail.has(cleanEmail) && localAcc.pendingCloudSync) {
            mergedByEmail.set(cleanEmail, localAcc);
            void this.pushAccountToFirestore(localAcc);
          }
        });

        const envInitialPassword = EMERGENCY_ADMIN_PASSWORDS[0] || '';
        for (const envEmail of ENV_EMERGENCY_ADMIN_EMAILS) {
          const normalized = envEmail.toLowerCase().trim();
          if (!normalized || !normalized.includes('@')) continue;
          if (!mergedByEmail.has(normalized) && envInitialPassword.length >= 6) {
            const seeded: VaultUserAccount = {
              name: 'Emergency Admin',
              email: normalized,
              password: envInitialPassword,
              role: VaultRole.ADMIN,
              addedBy: 'Emergency Lock',
              createdAtMillis: DEFAULT_SEED_TIMESTAMP,
              updatedAtMillis: DEFAULT_SEED_TIMESTAMP,
              pendingCloudSync: false,
              isLockedEmergencyAdmin: true,
            };
            mergedByEmail.set(normalized, seeded);
            void this.pushAccountToFirestore(seeded);
          }
        }

        const finalAccounts = Array.from(mergedByEmail.values());
        this.saveAccountsToStorage(finalAccounts);
        this.accounts = finalAccounts;

        if (this.activeSession) {
          const refreshed = finalAccounts.find(
            (a) => a.email.toLowerCase() === this.activeSession?.email.toLowerCase()
          );
          if (refreshed) {
            this.activeSession = refreshed;
          }
        }
        this.notify();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, SHARED_ACCOUNTS_COLLECTION);
      }
    );
  }

  async refreshAccountFromFirestoreIfNeeded(emailInput: string): Promise<void> {
    const cleanEmail = (emailInput || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return;
    const docId = accountDocIdForEmail(cleanEmail);
    try {
      const snap = await getDocFromServer(doc(db, SHARED_ACCOUNTS_COLLECTION, docId));
      if (snap.exists()) {
        const data = snap.data();
        const email = String(data.email || '').toLowerCase().trim();
        if (!email) return;
        const remoteAddedBy = String(data.addedBy || '').trim() || 'Cloud Sync';
        const locked =
          remoteAddedBy === 'Emergency Lock' || isLockedEmergencyAdmin(email);
        const remoteName = String(data.name || '').trim() || 'Store User';
        const remotePassword = String(data.password || '').trim();
        const remoteRole =
          data.role === VaultRole.ADMIN ? VaultRole.ADMIN : VaultRole.ACCOUNT_MANAGER;
        const remoteUpdatedMillis =
          data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : Date.now();

        const fetched: VaultUserAccount = {
          name: remoteName,
          email,
          password: remotePassword,
          role: locked ? VaultRole.ADMIN : remoteRole,
          addedBy: locked ? 'Emergency Lock' : remoteAddedBy,
          createdAtMillis: DEFAULT_SEED_TIMESTAMP,
          updatedAtMillis: remoteUpdatedMillis,
          pendingCloudSync: false,
          isLockedEmergencyAdmin: locked,
        };

        const list = [...this.accounts];
        const idx = list.findIndex((a) => a.email.toLowerCase() === email);
        if (idx >= 0) {
          list[idx] = fetched;
        } else {
          list.push(fetched);
        }
        this.accounts = list;
        this.saveAccountsToStorage(list);
        this.notify();
      }
    } catch {
      // Best-effort server refresh
    }
  }

  authenticateWithEmailPassword(emailInput: string, passwordInput: string): VaultUserAccount {
    const cleanEmail = (emailInput || '').trim().toLowerCase();
    const cleanPassword = (passwordInput || '').trim();

    if (!cleanEmail) {
      throw new Error('Please enter your registered system email.');
    }
    if (!cleanPassword) {
      throw new Error('Please enter your vault password.');
    }

    const account = this.accounts.find((a) => a.email.toLowerCase() === cleanEmail);
    if (!account) {
      throw new Error(
        `Unauthorized email (${cleanEmail}). Only registered Admin or Account Manager accounts can sign in.`
      );
    }

    if (!isPasswordValidForAccount(account, cleanPassword)) {
      throw new Error('Incorrect vault password. Please verify your credentials.');
    }

    this.setActiveSession(account);
    return account;
  }

  async authenticateWithEmailPasswordCloudAware(
    emailInput: string,
    passwordInput: string
  ): Promise<VaultUserAccount> {
    const cleanEmail = (emailInput || '').trim().toLowerCase();
    const cleanPassword = (passwordInput || '').trim();

    if (!cleanEmail) {
      throw new Error('Please enter your registered system email.');
    }
    if (!cleanPassword) {
      throw new Error('Please enter your vault password.');
    }

    // If Firebase Auth is not yet signed in, attempt real Firebase Email/Password authentication
    if (!auth.currentUser || !auth.currentUser.emailVerified) {
      try {
        const cred = await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          cleanPassword
        );
        if (!cred.user.emailVerified) {
          await firebaseSignOut(auth);
          throw new Error(
            'Email verification is required for cloud security. Please use "Sign in with Google" with your registered store Gmail.'
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (message.includes('Email verification is required')) {
          throw err;
        }
        throw new Error(
          'Cloud security is active for public repository protection. Please use "Sign in with Google" with your registered Admin or Staff Google account.'
        );
      }
    }

    await this.refreshAccountFromFirestoreIfNeeded(cleanEmail);
    const account = this.authenticateWithEmailPassword(cleanEmail, cleanPassword);
    if (account.role === VaultRole.ADMIN) {
      this.startSharedStoreFirestoreSync();
    }
    return account;
  }

  async signInAdminWithGooglePopup(): Promise<VaultUserAccount> {
    const cred = await signInWithPopup(auth, googleProvider);
    const fbUser = cred.user;
    const cleanEmail = (fbUser.email || '').trim().toLowerCase();
    if (!cleanEmail || !fbUser.emailVerified) {
      await firebaseSignOut(auth);
      throw new Error(
        'Google Sign-In failed: Could not verify your Google account email.'
      );
    }

    const existing = await this.fetchOwnAccountFromFirestore(cleanEmail);
    if (!existing) {
      await firebaseSignOut(auth);
      throw new Error(
        `Access Denied: Your Google account (${cleanEmail}) is not registered in Siaam Store. Ask a Store Admin to add this email in User Management.`
      );
    }

    const updatedAccount: VaultUserAccount =
      fbUser.displayName &&
      existing.name !== fbUser.displayName &&
      !isLockedEmergencyAdmin(cleanEmail)
        ? { ...existing, name: fbUser.displayName }
        : existing;

    this.isCloudSynced = true;
    this.isAuthReady = true;

    if (updatedAccount.role === VaultRole.ADMIN) {
      const idx = this.accounts.findIndex(
        (a) => a.email.toLowerCase() === cleanEmail
      );
      if (idx >= 0) {
        const copy = [...this.accounts];
        copy[idx] = updatedAccount;
        this.accounts = copy;
      } else {
        this.accounts = [...this.accounts, updatedAccount];
      }
      this.saveAccountsToStorage(this.accounts);
      this.startSharedStoreFirestoreSync();
    } else {
      this.stopSharedStoreFirestoreSync();
      this.accounts = [updatedAccount];
      this.saveAccountsToStorage(this.accounts);
    }

    this.setActiveSession(updatedAccount);
    return updatedAccount;
  }

  verifyAdminForEmailReset(emailInput: string): VaultUserAccount {
    const cleanEmail = (emailInput || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid registered email address.');
    }
    const account = this.accounts.find((a) => a.email.toLowerCase() === cleanEmail);
    if (!account) {
      throw new Error('This email is not registered as an Admin. Please ask a Store Admin for help.');
    }
    if (account.role !== VaultRole.ADMIN) {
      throw new Error(
        'Account Managers cannot reset their password or sign in with Google. Please ask a Store Admin for help to reset your password.'
      );
    }
    return account;
  }

  async changePasswordAndSyncToFirebase(
    emailInput: string,
    currentPasswordInput: string,
    newPasswordInput: string
  ): Promise<VaultUserAccount> {
    await this.refreshAccountFromFirestoreIfNeeded(emailInput);
    const cleanEmail = (emailInput || '').trim().toLowerCase();
    const currentPassword = (currentPasswordInput || '').trim();
    const newPassword = (newPasswordInput || '').trim();

    if (!cleanEmail) {
      throw new Error('Please enter your registered email.');
    }
    const list = [...this.accounts];
    const index = list.findIndex((a) => a.email.toLowerCase() === cleanEmail);
    if (index < 0) {
      throw new Error(`No registered account found for ${cleanEmail}.`);
    }

    const existing = list[index];
    if (isLockedEmergencyAdmin(existing)) {
      throw new Error(
        `Locked Emergency Admin (${cleanEmail}): Emergency passwords are permanently locked and cannot be modified.`
      );
    }
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }
    if (!isPasswordValidForAccount(existing, currentPassword)) {
      throw new Error(`Current password is incorrect for ${cleanEmail}.`);
    }

    const now = Date.now();
    const updated: VaultUserAccount = {
      ...existing,
      password: newPassword,
      addedBy: 'Changed Password',
      updatedAtMillis: now,
      pendingCloudSync: true,
    };

    list[index] = updated;
    this.accounts = list;
    this.saveAccountsToStorage(list);
    if (this.activeSession?.email.toLowerCase() === cleanEmail) {
      this.activeSession = updated;
    }
    this.notify();
    await this.pushAccountToFirestoreAwait(updated);
    return updated;
  }

  async resetPasswordByAdminAndSyncToFirebase(
    targetEmailInput: string,
    newPasswordInput: string
  ): Promise<VaultUserAccount> {
    await this.refreshAccountFromFirestoreIfNeeded(targetEmailInput);
    const adminAcc = this.verifyAdminForEmailReset(targetEmailInput);
    const cleanEmail = adminAcc.email.toLowerCase();
    const newPassword = (newPasswordInput || '').trim();

    if (isLockedEmergencyAdmin(adminAcc)) {
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
      } catch {
        // Best-effort Firebase Auth email dispatch
      }
      return adminAcc;
    }

    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }

    const list = [...this.accounts];
    const index = list.findIndex((a) => a.email.toLowerCase() === cleanEmail);
    if (index < 0) {
      throw new Error(`Account not found: ${cleanEmail}`);
    }

    const now = Date.now();
    const updated: VaultUserAccount = {
      ...list[index],
      password: newPassword,
      addedBy: 'Reset via Forgot Password',
      updatedAtMillis: now,
      pendingCloudSync: true,
    };
    list[index] = updated;
    this.accounts = list;
    this.saveAccountsToStorage(list);
    if (this.activeSession?.email.toLowerCase() === cleanEmail) {
      this.activeSession = updated;
    }
    this.notify();
    await this.pushAccountToFirestoreAwait(updated);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch {
      // Best-effort Firebase Auth email dispatch
    }
    return updated;
  }

  addAccountByAdmin(
    nameInput: string,
    emailInput: string,
    passwordInput: string,
    role: VaultRole
  ): VaultUserAccount {
    if (this.activeSession && this.activeSession.role !== VaultRole.ADMIN) {
      throw new Error('Only Admin can add or update accounts.');
    }

    const cleanEmail = (emailInput || '').trim().toLowerCase();
    const fallbackName = cleanEmail.split('@')[0] || 'Store User';
    const cleanName =
      (nameInput || '').trim() ||
      fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);
    const cleanPassword = (passwordInput || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    const list = [...this.accounts];
    const existingIdx = list.findIndex((a) => a.email.toLowerCase() === cleanEmail);
    if (
      isLockedEmergencyAdmin(cleanEmail) ||
      (existingIdx >= 0 && isLockedEmergencyAdmin(list[existingIdx]))
    ) {
      throw new Error(
        `Locked Emergency Admin (${cleanEmail}) is permanently protected and cannot be edited by anyone.`
      );
    }
    if (cleanPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    if (existingIdx >= 0) {
      const existing = list[existingIdx];
      if (
        existing.role === VaultRole.ACCOUNT_MANAGER &&
        role !== VaultRole.ACCOUNT_MANAGER
      ) {
        const managerCount = list.filter(
          (a) => a.role === VaultRole.ACCOUNT_MANAGER
        ).length;
        if (managerCount <= 1) {
          throw new Error(
            'At least 1 Account Manager account is mandatory for shop sales.'
          );
        }
      }
    }

    const now = Date.now();
    const newAccount: VaultUserAccount = {
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      role,
      addedBy: this.activeSession?.email || 'Admin',
      createdAtMillis: existingIdx >= 0 ? list[existingIdx].createdAtMillis : now,
      updatedAtMillis: now,
      pendingCloudSync: true,
      isLockedEmergencyAdmin: false,
    };

    if (existingIdx >= 0) {
      list[existingIdx] = newAccount;
    } else {
      list.push(newAccount);
    }

    this.accounts = list;
    this.saveAccountsToStorage(list);
    void this.pushAccountToFirestore(newAccount);
    if (this.activeSession?.email.toLowerCase() === cleanEmail) {
      this.activeSession = newAccount;
    }
    this.notify();
    return newAccount;
  }

  editAccountByAdmin(
    originalEmailInput: string,
    newNameInput: string,
    newEmailInput: string,
    newPasswordInput: string,
    newRole: VaultRole
  ): VaultUserAccount {
    if (this.activeSession && this.activeSession.role !== VaultRole.ADMIN) {
      throw new Error('Only Admin can edit user accounts.');
    }

    const cleanOriginalEmail = (originalEmailInput || '').trim().toLowerCase();
    const cleanNewEmail = (newEmailInput || '').trim().toLowerCase();
    const fallbackName = cleanNewEmail.split('@')[0] || 'Store User';
    const cleanNewName =
      (newNameInput || '').trim() ||
      fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);
    const cleanNewPassword = (newPasswordInput || '').trim();

    const list = [...this.accounts];
    const targetIdx = list.findIndex((a) => a.email.toLowerCase() === cleanOriginalEmail);
    if (targetIdx < 0) {
      throw new Error(`Account not found (${cleanOriginalEmail}).`);
    }

    const target = list[targetIdx];
    if (
      isLockedEmergencyAdmin(target) ||
      isLockedEmergencyAdmin(cleanOriginalEmail) ||
      isLockedEmergencyAdmin(cleanNewEmail)
    ) {
      throw new Error(
        'Locked Emergency Admin accounts cannot be edited by anyone.'
      );
    }
    if (!cleanNewEmail || !cleanNewEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (cleanNewPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    if (cleanOriginalEmail !== cleanNewEmail) {
      const duplicate = list.some((a) => a.email.toLowerCase() === cleanNewEmail);
      if (duplicate) {
        throw new Error(`Another account with email ${cleanNewEmail} already exists.`);
      }
    }

    if (
      target.role === VaultRole.ACCOUNT_MANAGER &&
      newRole !== VaultRole.ACCOUNT_MANAGER
    ) {
      const managerCount = list.filter(
        (a) => a.role === VaultRole.ACCOUNT_MANAGER
      ).length;
      if (managerCount <= 1) {
        throw new Error(
          'At least 1 Account Manager account is mandatory! Cannot change role of the last Account Manager.'
        );
      }
    }

    const now = Date.now();
    const updatedAccount: VaultUserAccount = {
      ...target,
      name: cleanNewName,
      email: cleanNewEmail,
      password: cleanNewPassword,
      role: newRole,
      addedBy: 'Edited by Admin',
      updatedAtMillis: now,
      pendingCloudSync: true,
    };

    list[targetIdx] = updatedAccount;
    this.accounts = list;
    this.saveAccountsToStorage(list);

    if (cleanOriginalEmail !== cleanNewEmail) {
      void this.deleteAccountFromFirestore(cleanOriginalEmail);
    }
    void this.pushAccountToFirestore(updatedAccount);

    if (this.activeSession?.email.toLowerCase() === cleanOriginalEmail) {
      this.setActiveSession(updatedAccount);
    }
    this.notify();
    return updatedAccount;
  }

  removeAccountByAdmin(targetEmailInput: string): void {
    if (this.activeSession && this.activeSession.role !== VaultRole.ADMIN) {
      throw new Error('Only Admin can remove accounts.');
    }

    const cleanTarget = (targetEmailInput || '').trim().toLowerCase();
    const list = [...this.accounts];
    const target = list.find((a) => a.email.toLowerCase() === cleanTarget);
    if (!target) {
      throw new Error(`Account not found (${cleanTarget}).`);
    }
    if (isLockedEmergencyAdmin(target)) {
      throw new Error(
        `Locked Emergency Admin (${cleanTarget}) is permanently locked and cannot be removed by anyone.`
      );
    }

    if (target.role === VaultRole.ACCOUNT_MANAGER) {
      const managerCount = list.filter(
        (a) => a.role === VaultRole.ACCOUNT_MANAGER
      ).length;
      if (managerCount <= 1) {
        throw new Error(
          'At least 1 Account Manager account is mandatory and cannot be removed.'
        );
      }
    }

    if (target.role === VaultRole.ADMIN) {
      const adminCount = list.filter((a) => a.role === VaultRole.ADMIN).length;
      if (adminCount <= 1) {
        throw new Error('Cannot remove the last remaining Admin.');
      }
      if (this.activeSession?.email.toLowerCase() === cleanTarget) {
        throw new Error('Cannot remove your own currently logged-in Admin account.');
      }
    }

    const filtered = list.filter((a) => a.email.toLowerCase() !== cleanTarget);
    this.accounts = filtered;
    this.saveAccountsToStorage(filtered);
    void this.deleteAccountFromFirestore(cleanTarget);
    this.notify();
  }

  async signOutVaultAndFirebase(): Promise<void> {
    this.clearSession();
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore signout error
    }
  }
}

export const vaultAccessService = new VaultAccessService();
