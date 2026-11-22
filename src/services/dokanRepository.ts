import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  AppLanguage,
  AuditLog,
  CartItem,
  Customer,
  encodeItemsAndNote,
  ExpenseCategorySetting,
  ExpensePresetSetting,
  formatQty,
  getCartLineProfit,
  getCartLineTotal,
  parseLineItems,
  Product,
  RecycleBinItem,
  StaffMember,
  StoreSettings,
  StoreTransaction,
  Supplier,
} from '../types/dokan';
import { SHARED_STORE_USER_ID } from './vaultAccessService';

function normalizeFirestoreUnit(rawUnit: string): string {
  const trimmed = (rawUnit || '').trim();
  if (!trimmed) return 'pcs';
  switch (trimmed.toLowerCase()) {
    case 'g':
    case 'gram':
      return 'gm';
    case 'kilogram':
      return 'kg';
    case 'l':
    case 'liter':
      return 'ltr';
    case 'pc':
    case 'piece':
      return 'pcs';
    default:
      return trimmed.slice(0, 30);
  }
}

const VALID_STAFF_ROLES = [
  'Owner',
  'Manager',
  'Cashier',
  'Salesman',
  'Inventory Clerk',
  'Helper / Delivery',
] as const;

function normalizeStaffRole(rawRole: string): string {
  const trimmed = (rawRole || '').trim();
  const match = VALID_STAFF_ROLES.find(
    (r) => r.toLowerCase() === trimmed.toLowerCase()
  );
  return match || 'Cashier';
}

const FIRESTORE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function isValidFirestoreDocId(id: unknown): id is string {
  return typeof id === 'string' && FIRESTORE_ID_REGEX.test(id);
}

function extractTimestampMillis(ts: unknown): number | undefined {
  if (!ts) return undefined;
  if (ts instanceof Timestamp) {
    const ms = ts.toMillis();
    return Number.isFinite(ms) && ms > 0 ? ms : undefined;
  }
  if (typeof ts === 'object') {
    const rec = ts as { toMillis?: unknown; seconds?: unknown; nanoseconds?: unknown };
    if (typeof rec.toMillis === 'function') {
      try {
        const ms = (rec.toMillis as () => number)();
        if (Number.isFinite(ms) && ms > 0) return ms;
      } catch {
        // ignore
      }
    }
    if (typeof rec.seconds === 'number' && Number.isFinite(rec.seconds) && rec.seconds > 0) {
      const nanos = typeof rec.nanoseconds === 'number' && Number.isFinite(rec.nanoseconds) ? rec.nanoseconds : 0;
      return Math.floor(rec.seconds * 1000 + nanos / 1e6);
    }
  }
  return undefined;
}

function resolveRestoredCreatedAt(rawMillis: unknown): Timestamp | ReturnType<typeof serverTimestamp> {
  if (typeof rawMillis === 'number' && Number.isFinite(rawMillis) && rawMillis > 0) {
    // Keep at least 1s behind current client clock so Firestore's `ts <= request.time` always passes
    const safeMs = Math.min(Math.floor(rawMillis), Date.now() - 1000);
    if (safeMs > 0) {
      return Timestamp.fromMillis(safeMs);
    }
  }
  return serverTimestamp();
}

function safeSerializePayload(data: Record<string, unknown>): string {
  try {
    const raw = JSON.stringify(data);
    if (raw.length <= 1950) return raw;
    const trimmed: Record<string, unknown> = { ...data };
    if (typeof trimmed.notes === 'string') {
      trimmed.notes = trimmed.notes.slice(0, 200);
    }
    if (typeof trimmed.note === 'string') {
      trimmed.note = trimmed.note.slice(0, 150);
    }
    const shorter = JSON.stringify(trimmed);
    if (shorter.length <= 1950) return shorter;
    if (typeof trimmed.notes === 'string') {
      trimmed.notes = trimmed.notes.slice(0, 80);
    }
    const minimal = JSON.stringify(trimmed);
    return minimal.length <= 1950 ? minimal : '';
  } catch {
    return '';
  }
}

function buildTransactionRecyclePayload(
  tx: StoreTransaction,
  reversedOnDelete: boolean,
  extra?: Record<string, unknown>
): string {
  const createdAtMillis = extractTimestampMillis(tx.createdAt);
  return safeSerializePayload({
    type: tx.type,
    title: tx.title,
    amount: tx.amount,
    paidAmount: tx.paidAmount,
    dueAmount: tx.dueAmount,
    profitAmount: tx.profitAmount,
    customerId: tx.customerId,
    customerName: tx.customerName,
    supplierId: tx.supplierId,
    supplierName: tx.supplierName,
    productId: tx.productId,
    category: tx.category,
    notes: tx.notes,
    ...(createdAtMillis !== undefined ? { createdAtMillis } : {}),
    reversedOnDelete,
    ...(extra || {}),
  });
}

function parseStockAdjustDelta(tx: StoreTransaction): number {
  const note = tx.notes || '';
  if (note.startsWith('DELTA:')) {
    const numStr = note.slice(6).split('|')[0].trim();
    const parsed = Number(numStr);
    if (Number.isFinite(parsed) && parsed !== 0) {
      return parsed;
    }
  }
  const absAmt = Math.abs(tx.amount || 0);
  if ((tx.category || '').toLowerCase().includes('out')) {
    return -absAmt;
  }
  return absAmt;
}

const PRODUCT_EXTRAS_STORAGE_KEY = 'siaam_store_product_extras_v1';

function loadProductExtrasMap(): Record<string, { quality?: string; note?: string }> {
  try {
    const raw = localStorage.getItem(PRODUCT_EXTRAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveProductExtras(id: string, quality?: string, note?: string): void {
  try {
    const map = loadProductExtrasMap();
    map[id] = {
      quality: (quality || '').trim(),
      note: (note || '').trim(),
    };
    localStorage.setItem(PRODUCT_EXTRAS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function encodeBarcodeWithExtras(
  rawBarcode: string,
  quality?: string,
  note?: string
): string {
  const cleanCode = (rawBarcode || '').split('||')[0].trim().slice(0, 24);
  const cleanQ = (quality || '').replace(/\|/g, ' ').trim().slice(0, 16);
  const cleanN = (note || '').replace(/\|/g, ' ').trim().slice(0, 20);
  if (!cleanQ && !cleanN) {
    return cleanCode.slice(0, 64);
  }
  return `${cleanCode}||${cleanQ}||${cleanN}`.slice(0, 64);
}

function decodeBarcodeAndExtras(
  storedBarcode: string,
  productId: string,
  dataQuality?: unknown,
  dataNote?: unknown
): { barcode: string; quality: string; note: string } {
  const localExtras = loadProductExtrasMap()[productId] || {};
  const raw = String(storedBarcode || '');
  if (raw.includes('||')) {
    const [b = '', q = '', n = ''] = raw.split('||');
    const resolvedQuality =
      typeof dataQuality === 'string'
        ? dataQuality
        : localExtras.quality ?? q;
    const resolvedNote =
      typeof dataNote === 'string'
        ? dataNote
        : localExtras.note ?? n;
    return {
      barcode: b.trim(),
      quality: resolvedQuality.trim(),
      note: resolvedNote.trim(),
    };
  }
  const resolvedQuality =
    typeof dataQuality === 'string'
      ? dataQuality
      : String(localExtras.quality ?? '');
  const resolvedNote =
    typeof dataNote === 'string'
      ? dataNote
      : String(localExtras.note ?? '');
  return {
    barcode: raw.trim(),
    quality: resolvedQuality.trim(),
    note: resolvedNote.trim(),
  };
}

const CUSTOMER_EXTRAS_STORAGE_KEY = 'siaam_store_customer_extras_v1';

function loadCustomerExtrasMap(): Record<
  string,
  { identityHint?: string; note?: string }
> {
  try {
    const raw = localStorage.getItem(CUSTOMER_EXTRAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveCustomerExtras(
  id: string,
  identityHint?: string,
  note?: string
): void {
  try {
    const map = loadCustomerExtrasMap();
    map[id] = {
      identityHint: (identityHint || '').trim(),
      note: (note || '').trim(),
    };
    localStorage.setItem(CUSTOMER_EXTRAS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function decodeAddressAndCustomerExtras(
  storedAddress: string,
  customerId: string,
  dataIdentityHint?: unknown,
  dataNote?: unknown
): { address: string; identityHint: string; note: string } {
  const localExtras = loadCustomerExtrasMap()[customerId] || {};
  const raw = String(storedAddress || '');
  if (raw.includes('||')) {
    const [addr = '', hint = '', nt = ''] = raw.split('||');
    const resolvedHint =
      typeof dataIdentityHint === 'string'
        ? dataIdentityHint
        : localExtras.identityHint ?? hint;
    const resolvedNote =
      typeof dataNote === 'string'
        ? dataNote
        : localExtras.note ?? nt;
    return {
      address: addr.trim(),
      identityHint: resolvedHint.trim(),
      note: resolvedNote.trim(),
    };
  }
  const resolvedHint =
    typeof dataIdentityHint === 'string'
      ? dataIdentityHint
      : String(localExtras.identityHint ?? '');
  const resolvedNote =
    typeof dataNote === 'string'
      ? dataNote
      : String(localExtras.note ?? '');
  return {
    address: raw.trim(),
    identityHint: resolvedHint.trim(),
    note: resolvedNote.trim(),
  };
}

export class DokanRepository {
  constructor(private readonly vaultSessionActorEmail: string | null) {}

  private requireUserId(): string {
    if (this.vaultSessionActorEmail && this.vaultSessionActorEmail.trim().length > 0) {
      return SHARED_STORE_USER_ID;
    }
    if (auth.currentUser?.uid) {
      return auth.currentUser.uid;
    }
    return SHARED_STORE_USER_ID;
  }

  private currentActorName(): string {
    return (
      auth.currentUser?.displayName ||
      auth.currentUser?.email?.split('@')[0] ||
      this.vaultSessionActorEmail?.split('@')[0] ||
      'Store Admin'
    );
  }

  // --- Real-time Observers ---

  subscribeProducts(
    onData: (products: Product[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const uid = this.requireUserId();
    const path = `users/${uid}/products`;
    const q = query(collection(db, 'users', uid, 'products'), where('userId', '==', uid));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: Product[] = snapshot.docs.map((d) => {
          const data = d.data();
          const decoded = decodeBarcodeAndExtras(
            String(data.barcode || ''),
            d.id,
            data.quality,
            data.note
          );
          return {
            id: d.id,
            userId: String(data.userId || uid),
            name: String(data.name || ''),
            category: String(data.category || 'General'),
            unit: String(data.unit || 'pcs'),
            buyPrice: Number(data.buyPrice) || 0,
            sellPrice: Number(data.sellPrice) || 0,
            stock: Number(data.stock) || 0,
            lowStockThreshold: Number(data.lowStockThreshold ?? 5),
            barcode: decoded.barcode,
            quality: decoded.quality,
            note: decoded.note,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : null,
          };
        });
        list.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        onData(list);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  subscribeCustomers(
    onData: (customers: Customer[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const uid = this.requireUserId();
    const path = `users/${uid}/customers`;
    const q = query(collection(db, 'users', uid, 'customers'), where('userId', '==', uid));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: Customer[] = snapshot.docs.map((d) => {
          const data = d.data();
          const decoded = decodeAddressAndCustomerExtras(
            String(data.address || ''),
            d.id,
            data.identityHint,
            data.note
          );
          return {
            id: d.id,
            userId: String(data.userId || uid),
            name: String(data.name || ''),
            phone: String(data.phone || ''),
            address: decoded.address,
            identityHint: decoded.identityHint,
            note: decoded.note,
            totalDue: Number(data.totalDue) || 0,
            totalPurchased: Number(data.totalPurchased) || 0,
            totalPaid: Number(data.totalPaid) || 0,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : null,
          };
        });
        list.sort((a, b) => b.totalDue - a.totalDue);
        onData(list);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  subscribeTransactions(
    onData: (transactions: StoreTransaction[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const uid = this.requireUserId();
    const path = `users/${uid}/transactions`;
    const q = query(
      collection(db, 'users', uid, 'transactions'),
      where('userId', '==', uid)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const list: StoreTransaction[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || uid),
            type: data.type || 'SALE',
            title: String(data.title || ''),
            amount: Number(data.amount) || 0,
            paidAmount: Number(data.paidAmount) || 0,
            dueAmount: Number(data.dueAmount) || 0,
            profitAmount: Number(data.profitAmount) || 0,
            customerId: String(data.customerId || ''),
            customerName: String(data.customerName || ''),
            supplierId: String(data.supplierId || ''),
            supplierName: String(data.supplierName || ''),
            productId: String(data.productId || ''),
            category: String(data.category || ''),
            notes: String(data.notes || ''),
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : null,
          };
        });
        list.sort(
          (a, b) =>
            (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
        );
        onData(list);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  subscribeSuppliers(
    onData: (suppliers: Supplier[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const uid = this.requireUserId();
    const path = `users/${uid}/suppliers`;
    const q = query(collection(db, 'users', uid, 'suppliers'), where('userId', '==', uid));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: Supplier[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || uid),
            name: String(data.name || ''),
            phone: String(data.phone || ''),
            company: String(data.company || ''),
            payableBalance: Number(data.payableBalance) || 0,
            totalPurchased: Number(data.totalPurchased) || 0,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : null,
          };
        });
        list.sort((a, b) => b.payableBalance - a.payableBalance);
        onData(list);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  subscribeStaff(
    onData: (staff: StaffMember[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const uid = this.requireUserId();
    const path = `users/${uid}/staff`;
    const q = query(collection(db, 'users', uid, 'staff'), where('userId', '==', uid));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: StaffMember[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || uid),
            name: String(data.name || ''),
            role: String(data.role || 'Cashier'),
            phone: String(data.phone || ''),
            salary: Number(data.salary) || 0,
            active: data.active !== false,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : null,
          };
        });
        list.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        onData(list);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  subscribeAuditLogs(
    onData: (logs: AuditLog[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const uid = this.requireUserId();
    const path = `users/${uid}/audit_logs`;
    const q = query(
      collection(db, 'users', uid, 'audit_logs'),
      where('userId', '==', uid)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const list: AuditLog[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || uid),
            actorName: String(data.actorName || 'Store Admin'),
            action: String(data.action || ''),
            module: String(data.module || 'System'),
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
          };
        });
        list.sort(
          (a, b) =>
            (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
        );
        onData(list);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  subscribeRecycleBin(
    onData: (items: RecycleBinItem[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const uid = this.requireUserId();
    const path = `users/${uid}/recycle_bin`;
    const q = query(
      collection(db, 'users', uid, 'recycle_bin'),
      where('userId', '==', uid)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const list: RecycleBinItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || uid),
            itemType: String(data.itemType || 'PRODUCT'),
            itemId: String(data.itemId || d.id),
            name: String(data.name || ''),
            details: String(data.details || ''),
            payloadJson: String(data.payloadJson || ''),
            deletedBy: String(data.deletedBy || 'Admin'),
            deletedAt: data.deletedAt instanceof Timestamp ? data.deletedAt : null,
          };
        });
        list.sort(
          (a, b) =>
            (b.deletedAt?.toMillis() || 0) - (a.deletedAt?.toMillis() || 0)
        );
        onData(list);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  subscribeStoreSettings(
    onData: (settings: StoreSettings | null) => void,
    onError?: (err: Error) => void
  ): () => void {
    const uid = this.requireUserId();
    const docRef = doc(db, 'users', uid, 'store_settings', 'config');
    return onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          onData(null);
          return;
        }
        const data = snap.data();
        const productCategories = Array.isArray(data.productCategories)
          ? data.productCategories
              .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              .map((x) => x.trim())
          : [];
        const productUnits = Array.isArray(data.productUnits)
          ? data.productUnits
              .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              .map((x) => x.trim())
          : [];
        const productQualities = Array.isArray(data.productQualities)
          ? data.productQualities
              .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              .map((x) => x.trim())
          : [];
        const expenseCategories: ExpenseCategorySetting[] = Array.isArray(
          data.expenseCategories
        )
          ? data.expenseCategories
              .filter(
                (x): x is Record<string, unknown> =>
                  Boolean(x) && typeof x === 'object' && typeof (x as Record<string, unknown>).id === 'string'
              )
              .map((x) => ({
                id: String(x.id).trim(),
                labelEn: String(x.labelEn || x.id).trim(),
                labelBn: String(x.labelBn || x.id).trim(),
                colorKey: String(x.colorKey || 'emerald').trim(),
              }))
              .filter((x) => x.id.length > 0)
          : [];
        const expensePresets: ExpensePresetSetting[] = Array.isArray(data.expensePresets)
          ? data.expensePresets
              .filter(
                (x): x is Record<string, unknown> =>
                  Boolean(x) && typeof x === 'object' && typeof (x as Record<string, unknown>).id === 'string'
              )
              .map((x) => {
                const amt = Number(x.defaultAmount);
                const base: ExpensePresetSetting = {
                  id: String(x.id).trim(),
                  titleEn: String(x.titleEn || x.titleBn || '').trim(),
                  titleBn: String(x.titleBn || x.titleEn || '').trim(),
                  category: String(x.category || 'Other').trim(),
                };
                if (Number.isFinite(amt) && amt > 0) {
                  base.defaultAmount = amt;
                }
                return base;
              })
              .filter((x) => x.id.length > 0 && (x.titleEn.length > 0 || x.titleBn.length > 0))
          : [];
        const language =
          data.language === AppLanguage.ENGLISH
            ? AppLanguage.ENGLISH
            : AppLanguage.BENGALI;
        onData({
          userId: String(data.userId || uid),
          productCategories,
          productUnits,
          productQualities,
          expenseCategories,
          expensePresets,
          startingCashBalance: Math.max(0, Number(data.startingCashBalance) || 0),
          language,
          isDarkMode: Boolean(data.isDarkMode),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : null,
        });
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.GET, docRef.path);
      }
    );
  }

  async saveStoreSettings(
    patch: Partial<Omit<StoreSettings, 'userId' | 'updatedAt'>>,
    currentSettings: StoreSettings | null
  ): Promise<void> {
    const uid = this.requireUserId();
    const docRef = doc(db, 'users', uid, 'store_settings', 'config');

    const cleanStringList = (list: string[] | undefined): string[] =>
      Array.from(
        new Set(
          (list || [])
            .map((s) => String(s || '').trim().slice(0, 60))
            .filter((s) => s.length > 0)
        )
      ).slice(0, 100);

    const cleanExpCategories = (
      list: ExpenseCategorySetting[] | undefined
    ): ExpenseCategorySetting[] =>
      (list || [])
        .filter((c) => c && typeof c.id === 'string' && c.id.trim().length > 0)
        .slice(0, 100)
        .map((c) => ({
          id: c.id.trim().slice(0, 60),
          labelEn: (c.labelEn || c.id).trim().slice(0, 60),
          labelBn: (c.labelBn || c.id).trim().slice(0, 60),
          colorKey: (c.colorKey || 'emerald').trim().slice(0, 30),
        }));

    const cleanExpPresets = (
      list: ExpensePresetSetting[] | undefined
    ): Array<Record<string, unknown>> =>
      (list || [])
        .filter(
          (p) =>
            p &&
            typeof p.id === 'string' &&
            p.id.trim().length > 0 &&
            (Boolean(p.titleEn?.trim()) || Boolean(p.titleBn?.trim()))
        )
        .slice(0, 100)
        .map((p) => {
          const item: Record<string, unknown> = {
            id: p.id.trim().slice(0, 60),
            titleEn: (p.titleEn || p.titleBn || '').trim().slice(0, 100),
            titleBn: (p.titleBn || p.titleEn || '').trim().slice(0, 100),
            category: (p.category || 'Other').trim().slice(0, 60),
          };
          if (typeof p.defaultAmount === 'number' && Number.isFinite(p.defaultAmount) && p.defaultAmount > 0) {
            item.defaultAmount = p.defaultAmount;
          }
          return item;
        });

    const payload = {
      userId: uid,
      productCategories: cleanStringList(
        patch.productCategories ?? currentSettings?.productCategories ?? []
      ),
      productUnits: cleanStringList(
        patch.productUnits ?? currentSettings?.productUnits ?? []
      ),
      productQualities: cleanStringList(
        patch.productQualities ?? currentSettings?.productQualities ?? []
      ),
      expenseCategories: cleanExpCategories(
        patch.expenseCategories ?? currentSettings?.expenseCategories ?? []
      ),
      expensePresets: cleanExpPresets(
        patch.expensePresets ?? currentSettings?.expensePresets ?? []
      ),
      startingCashBalance: Math.max(
        0,
        Number(
          patch.startingCashBalance ?? currentSettings?.startingCashBalance ?? 0
        ) || 0
      ),
      language:
        (patch.language ?? currentSettings?.language) === AppLanguage.ENGLISH
          ? AppLanguage.ENGLISH
          : AppLanguage.BENGALI,
      isDarkMode: Boolean(
        patch.isDarkMode ?? currentSettings?.isDarkMode ?? false
      ),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(docRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docRef.path);
    }
  }

  // --- Audit Log ---

  async recordAuditLog(action: string, moduleName: string = 'System'): Promise<void> {
    const uid = this.requireUserId();
    const logRef = doc(collection(db, 'users', uid, 'audit_logs'));
    try {
      await setDoc(logRef, {
        userId: uid,
        actorName: this.currentActorName().slice(0, 100),
        action: action.slice(0, 200),
        module: moduleName.slice(0, 60),
        createdAt: serverTimestamp(),
      });
    } catch {
      // Best-effort audit logging
    }
  }

  // --- Products CRUD & Stock Adjustment ---

  async addProduct(params: {
    name: string;
    category: string;
    unit: string;
    buyPrice: number;
    sellPrice: number;
    initialStock: number;
    lowStockThreshold: number;
    barcode: string;
    quality?: string;
    note?: string;
  }): Promise<string> {
    const uid = this.requireUserId();
    const cleanUnit = normalizeFirestoreUnit(params.unit);
    const cleanStock = Math.max(0, params.initialStock || 0);
    const docRef = doc(collection(db, 'users', uid, 'products'));
    const cleanQuality = (params.quality || '').trim().slice(0, 100);
    const cleanNote = (params.note || '').trim().slice(0, 300);
    saveProductExtras(docRef.id, cleanQuality, cleanNote);
    const payload = {
      userId: uid,
      name: params.name.trim().slice(0, 120),
      category: (params.category.trim() || 'General').slice(0, 60),
      unit: cleanUnit,
      buyPrice: Math.max(0, params.buyPrice || 0),
      sellPrice: Math.max(0, params.sellPrice || 0),
      stock: cleanStock,
      lowStockThreshold: Math.max(0, params.lowStockThreshold ?? 5),
      barcode: (params.barcode || '').trim().slice(0, 64),
      quality: cleanQuality,
      note: cleanNote,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const batch = writeBatch(db);
      batch.set(docRef, payload);
      if (cleanStock > 0) {
        const txRef = doc(collection(db, 'users', uid, 'transactions'));
        batch.set(txRef, {
          userId: uid,
          type: 'STOCK_ADJUST',
          title: 'Opening stock',
          amount: cleanStock,
          paidAmount: 0,
          dueAmount: 0,
          profitAmount: 0,
          customerId: '',
          customerName: '',
          supplierId: '',
          supplierName: '',
          productId: docRef.id,
          category: 'Opening Stock',
          notes: `DELTA:+${formatQty(cleanStock)}|REASON:Opening stock`.slice(0, 300),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await this.recordAuditLog(
        `Added product ${params.name.trim()} (${cleanStock} ${cleanUnit})`,
        'Inventory'
      );
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docRef.path);
    }
  }

  async updateProduct(
    product: Product,
    params: {
      name: string;
      category: string;
      unit: string;
      buyPrice: number;
      sellPrice: number;
      stock: number;
      lowStockThreshold: number;
      barcode: string;
      quality?: string;
      note?: string;
    }
  ): Promise<void> {
    const uid = this.requireUserId();
    const cleanUnit = normalizeFirestoreUnit(params.unit);
    const prodRef = doc(db, 'users', uid, 'products', product.id);
    const cleanQuality = (params.quality || '').trim().slice(0, 100);
    const cleanNote = (params.note || '').trim().slice(0, 300);
    saveProductExtras(product.id, cleanQuality, cleanNote);
    try {
      await updateDoc(prodRef, {
        name: (params.name.trim() || product.name).slice(0, 120),
        category: (params.category.trim() || 'General').slice(0, 60),
        unit: cleanUnit,
        buyPrice: Math.max(0, params.buyPrice || 0),
        sellPrice: Math.max(0, params.sellPrice || 0),
        stock: Math.max(0, params.stock || 0),
        lowStockThreshold: Math.max(0, params.lowStockThreshold ?? 5),
        barcode: (params.barcode || '').trim().slice(0, 64),
        quality: cleanQuality,
        note: cleanNote,
        updatedAt: serverTimestamp(),
      });
      await this.recordAuditLog(`Updated product ${params.name.trim()}`, 'Inventory');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, prodRef.path);
    }
  }

  async adjustProductStock(
    product: Product,
    delta: number,
    reason: string
  ): Promise<void> {
    const uid = this.requireUserId();
    const newStock = Math.max(0, product.stock + delta);
    const prodRef = doc(db, 'users', uid, 'products', product.id);
    const txRef = doc(collection(db, 'users', uid, 'transactions'));

    const lowerReason = (reason || '').toLowerCase();
    const cleanTitle =
      lowerReason.includes('reason:damaged') || lowerReason.startsWith('damaged')
        ? 'Damaged / lost'
        : lowerReason.includes('reason:removed') || lowerReason.startsWith('removed')
        ? 'Removed stock'
        : lowerReason.includes('reason:opening') || lowerReason.startsWith('opening')
        ? 'Opening stock'
        : delta >= 0
        ? 'Added stock'
        : 'Removed stock';

    const signedDeltaStr = delta >= 0 ? `+${formatQty(delta)}` : formatQty(delta);
    const encodedNotes = reason.startsWith('DELTA:')
      ? reason.slice(0, 300)
      : `DELTA:${signedDeltaStr}|${reason.trim() || cleanTitle}`.slice(0, 300);

    try {
      const batch = writeBatch(db);
      batch.update(prodRef, {
        stock: newStock,
        updatedAt: serverTimestamp(),
      });
      batch.set(txRef, {
        userId: uid,
        type: 'STOCK_ADJUST',
        title: cleanTitle,
        amount: Math.abs(delta),
        paidAmount: 0,
        dueAmount: 0,
        profitAmount: 0,
        customerId: '',
        customerName: '',
        supplierId: '',
        supplierName: '',
        productId: product.id,
        category: delta >= 0 ? 'Stock In' : 'Stock Out',
        notes: encodedNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      await this.recordAuditLog(
        `${cleanTitle} (${signedDeltaStr} ${product.unit}) for ${product.name}`,
        'Inventory'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, prodRef.path);
    }
  }

  async voidStockAdjustment(
    product: Product,
    transaction: StoreTransaction | null,
    signedDeltaToReverse: number
  ): Promise<void> {
    const uid = this.requireUserId();
    const restoredStock = Math.max(0, Number((product.stock - signedDeltaToReverse).toFixed(4)));
    const prodRef = doc(db, 'users', uid, 'products', product.id);
    try {
      const batch = writeBatch(db);
      batch.update(prodRef, {
        stock: restoredStock,
        updatedAt: serverTimestamp(),
      });
      if (transaction?.id) {
        batch.delete(doc(db, 'users', uid, 'transactions', transaction.id));
        const binRef = doc(collection(db, 'users', uid, 'recycle_bin'));
        batch.set(binRef, {
          userId: uid,
          itemType: 'TRANSACTION',
          itemId: transaction.id,
          name: (transaction.title || `Stock Adjust - ${product.name}`).slice(0, 200),
          details: `Type: STOCK_ADJUST | Product: ${product.name} | Delta: ${
            signedDeltaToReverse >= 0 ? `+${signedDeltaToReverse}` : signedDeltaToReverse
          } ${product.unit}`.slice(0, 300),
          payloadJson: buildTransactionRecyclePayload(transaction, true, {
            stockAdjustDelta: signedDeltaToReverse,
          }),
          deletedBy: this.currentActorName().slice(0, 120),
          deletedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await this.recordAuditLog(`Voided stock adjustment for ${product.name}`, 'Inventory');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, prodRef.path);
    }
  }

  async deleteProduct(productId: string, productName: string): Promise<void> {
    const uid = this.requireUserId();
    const docRef = doc(db, 'users', uid, 'products', productId);
    const binRef = doc(collection(db, 'users', uid, 'recycle_bin'));
    try {
      let payloadJson = '';
      let details = `Product: ${productName}`.slice(0, 300);
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const d = snap.data();
          const decoded = decodeBarcodeAndExtras(
            String(d.barcode ?? ''),
            productId,
            d.quality,
            d.note
          );
          const createdAtMillis = extractTimestampMillis(d.createdAt);
          payloadJson = safeSerializePayload({
            name: String(d.name ?? productName),
            category: String(d.category ?? 'General'),
            unit: String(d.unit ?? 'pcs'),
            buyPrice: Number(d.buyPrice ?? 0),
            sellPrice: Number(d.sellPrice ?? 0),
            stock: Number(d.stock ?? 0),
            lowStockThreshold: Number(d.lowStockThreshold ?? 5),
            barcode: decoded.barcode,
            quality: decoded.quality,
            note: decoded.note,
            ...(createdAtMillis !== undefined ? { createdAtMillis } : {}),
          });
          details = `Stock: ${Number(d.stock ?? 0)} ${String(d.unit ?? 'pcs')} | Buy: ৳${Number(d.buyPrice ?? 0)} | Sell: ৳${Number(d.sellPrice ?? 0)}`.slice(0, 300);
        }
      } catch {
        // Proceed with soft-delete even if pre-read fails
      }

      const batch = writeBatch(db);
      batch.delete(docRef);
      batch.set(binRef, {
        userId: uid,
        itemType: 'PRODUCT',
        itemId: productId,
        name: productName.slice(0, 200) || 'Product',
        details,
        payloadJson,
        deletedBy: this.currentActorName().slice(0, 120),
        deletedAt: serverTimestamp(),
      });
      await batch.commit();
      await this.recordAuditLog(
        `Deleted product ${productName} (moved to Recycle Bin)`,
        'Inventory'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docRef.path);
    }
  }

  // --- Customers & Dues ---

  async addCustomer(params: {
    name: string;
    phone: string;
    address: string;
    initialDue: number;
    identityHint?: string;
    note?: string;
  }): Promise<string> {
    const uid = this.requireUserId();
    const docRef = doc(collection(db, 'users', uid, 'customers'));
    const cleanDue = Math.max(0, params.initialDue || 0);
    const cleanHint = (params.identityHint || '').trim().slice(0, 150);
    const cleanNote = (params.note || '').trim().slice(0, 300);
    saveCustomerExtras(docRef.id, cleanHint, cleanNote);
    const payload = {
      userId: uid,
      name: params.name.trim().slice(0, 100),
      phone: (params.phone.trim() || '—').slice(0, 30),
      address: (params.address || '').trim().slice(0, 200),
      identityHint: cleanHint,
      note: cleanNote,
      totalDue: cleanDue,
      totalPurchased: cleanDue,
      totalPaid: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const batch = writeBatch(db);
      batch.set(docRef, payload);
      if (cleanDue > 0) {
        const txRef = doc(collection(db, 'users', uid, 'transactions'));
        batch.set(txRef, {
          userId: uid,
          type: 'GIVE_DUE',
          title: `Opening Due - ${params.name.trim()}`.slice(0, 200),
          amount: cleanDue,
          paidAmount: 0,
          dueAmount: cleanDue,
          profitAmount: 0,
          customerId: docRef.id,
          customerName: params.name.trim().slice(0, 100),
          supplierId: '',
          supplierName: '',
          productId: '',
          category: 'Customer Due',
          notes: 'Initial opening due balance',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await this.recordAuditLog(`Added customer ${params.name.trim()}`, 'Customers');
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docRef.path);
    }
  }

  async updateCustomer(
    customer: Customer,
    params: {
      name: string;
      phone: string;
      address: string;
      identityHint?: string;
      note?: string;
    }
  ): Promise<void> {
    const uid = this.requireUserId();
    const custRef = doc(db, 'users', uid, 'customers', customer.id);
    const cleanHint = (params.identityHint || '').trim().slice(0, 150);
    const cleanNote = (params.note || '').trim().slice(0, 300);
    saveCustomerExtras(customer.id, cleanHint, cleanNote);
    try {
      await updateDoc(custRef, {
        name: (params.name.trim() || customer.name).slice(0, 100),
        phone: (params.phone.trim() || '—').slice(0, 30),
        address: (params.address || '').trim().slice(0, 200),
        identityHint: cleanHint,
        note: cleanNote,
        updatedAt: serverTimestamp(),
      });
      await this.recordAuditLog(`Updated customer ${params.name.trim()}`, 'Customers');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, custRef.path);
    }
  }

  async deleteCustomer(customerId: string, customerName: string): Promise<void> {
    const uid = this.requireUserId();
    const docRef = doc(db, 'users', uid, 'customers', customerId);
    const binRef = doc(collection(db, 'users', uid, 'recycle_bin'));
    try {
      let payloadJson = '';
      let details = `Customer: ${customerName}`.slice(0, 300);
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const d = snap.data();
          const decoded = decodeAddressAndCustomerExtras(
            String(d.address ?? ''),
            customerId,
            d.identityHint,
            d.note
          );
          const createdAtMillis = extractTimestampMillis(d.createdAt);
          payloadJson = safeSerializePayload({
            name: String(d.name ?? customerName),
            phone: String(d.phone ?? '—'),
            address: decoded.address,
            identityHint: decoded.identityHint,
            note: decoded.note,
            totalDue: Number(d.totalDue ?? 0),
            totalPurchased: Number(d.totalPurchased ?? 0),
            totalPaid: Number(d.totalPaid ?? 0),
            ...(createdAtMillis !== undefined ? { createdAtMillis } : {}),
          });
          details = `Phone: ${String(d.phone ?? '—')} | Due: ৳${Number(d.totalDue ?? 0)} | Paid: ৳${Number(d.totalPaid ?? 0)}`.slice(0, 300);
        }
      } catch {
        // Proceed even if pre-read fails
      }

      const batch = writeBatch(db);
      batch.delete(docRef);
      batch.set(binRef, {
        userId: uid,
        itemType: 'CUSTOMER',
        itemId: customerId,
        name: customerName.slice(0, 200) || 'Customer',
        details,
        payloadJson,
        deletedBy: this.currentActorName().slice(0, 120),
        deletedAt: serverTimestamp(),
      });
      await batch.commit();
      await this.recordAuditLog(
        `Deleted customer ${customerName} (moved to Recycle Bin)`,
        'Customers'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docRef.path);
    }
  }

  async recordCustomerDueOrPayment(params: {
    customer: Customer;
    amount: number;
    isGiveDue: boolean;
    notes: string;
  }): Promise<void> {
    const uid = this.requireUserId();
    const cleanAmount = Math.max(0, params.amount || 0);
    const custRef = doc(db, 'users', uid, 'customers', params.customer.id);
    const txRef = doc(collection(db, 'users', uid, 'transactions'));

    const newDue = params.isGiveDue
      ? params.customer.totalDue + cleanAmount
      : Math.max(0, params.customer.totalDue - cleanAmount);
    const newPurchased = params.isGiveDue
      ? params.customer.totalPurchased + cleanAmount
      : params.customer.totalPurchased;
    const newPaid = !params.isGiveDue
      ? params.customer.totalPaid + cleanAmount
      : params.customer.totalPaid;

    try {
      const batch = writeBatch(db);
      batch.update(custRef, {
        totalDue: newDue,
        totalPurchased: newPurchased,
        totalPaid: newPaid,
        updatedAt: serverTimestamp(),
      });
      batch.set(txRef, {
        userId: uid,
        type: params.isGiveDue ? 'GIVE_DUE' : 'RECEIVE_PAYMENT',
        title: (params.isGiveDue
          ? `Due Given to ${params.customer.name}`
          : `Payment Received from ${params.customer.name}`
        ).slice(0, 200),
        amount: cleanAmount,
        paidAmount: params.isGiveDue ? 0 : cleanAmount,
        dueAmount: params.isGiveDue ? cleanAmount : 0,
        profitAmount: 0,
        customerId: params.customer.id,
        customerName: params.customer.name.slice(0, 100),
        supplierId: '',
        supplierName: '',
        productId: '',
        category: params.isGiveDue ? 'Due Given' : 'Due Collection',
        notes: (
          params.notes.trim() ||
          (params.isGiveDue ? 'Credit entry' : 'Cash due collection')
        ).slice(0, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      await this.recordAuditLog(
        params.isGiveDue
          ? `Gave due ৳${cleanAmount} to ${params.customer.name}`
          : `Received ৳${cleanAmount} from ${params.customer.name}`,
        'Customers'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, custRef.path);
    }
  }

  // --- POS Checkout / Sales ---

  async recordPosSale(params: {
    cartItems: CartItem[];
    paidAmount: number;
    selectedCustomer: Customer | null;
    notes: string;
    discountAmount?: number;
    newCustomerName?: string;
    newCustomerPhone?: string;
    newCustomerAddress?: string;
  }): Promise<StoreTransaction> {
    if (params.cartItems.length === 0) {
      throw new Error('Cart cannot be empty');
    }
    const uid = this.requireUserId();
    const subtotalAmount = Math.max(
      0,
      params.cartItems.reduce((acc, item) => acc + getCartLineTotal(item), 0)
    );
    const cleanDiscount = Math.min(
      subtotalAmount,
      Math.max(0, params.discountAmount || 0)
    );
    const totalAmount = Math.max(0, subtotalAmount - cleanDiscount);
    const totalProfit =
      params.cartItems.reduce((acc, item) => acc + getCartLineProfit(item), 0) -
      cleanDiscount;
    const cleanPaid = Math.min(totalAmount, Math.max(0, params.paidAmount || 0));
    const dueAmount = Math.max(0, totalAmount - cleanPaid);

    const resolvedPhone =
      params.selectedCustomer?.phone || (params.newCustomerPhone || '').trim();
    const resolvedAddress =
      params.selectedCustomer?.address || (params.newCustomerAddress || '').trim();

    const summaryTitle = params.cartItems
      .map((i) => `${i.product.name} x${formatQty(i.quantity)}`)
      .join(', ')
      .slice(0, 200);

    const encodedNotes = encodeItemsAndNote(
      params.cartItems,
      params.notes,
      resolvedPhone,
      resolvedAddress
    );

    const txRef = doc(collection(db, 'users', uid, 'transactions'));
    const now = Timestamp.now();

    let resolvedCustomerId = params.selectedCustomer?.id || '';
    let resolvedCustomerName =
      params.selectedCustomer?.name ||
      (params.newCustomerName || '').trim() ||
      'Walk-in customer';

    try {
      const batch = writeBatch(db);
      for (const item of params.cartItems) {
        if (item.product.id) {
          const prodRef = doc(db, 'users', uid, 'products', item.product.id);
          const remainingStock = Math.max(0, item.product.stock - item.quantity);
          batch.update(prodRef, {
            stock: remainingStock,
            updatedAt: serverTimestamp(),
          });
        }
      }

      if (params.selectedCustomer && params.selectedCustomer.id) {
        const custRef = doc(db, 'users', uid, 'customers', params.selectedCustomer.id);
        batch.update(custRef, {
          totalDue: params.selectedCustomer.totalDue + dueAmount,
          totalPurchased: params.selectedCustomer.totalPurchased + totalAmount,
          totalPaid: params.selectedCustomer.totalPaid + cleanPaid,
          updatedAt: serverTimestamp(),
        });
      } else if ((params.newCustomerName || '').trim().length > 0) {
        const newCustRef = doc(collection(db, 'users', uid, 'customers'));
        resolvedCustomerId = newCustRef.id;
        resolvedCustomerName = (params.newCustomerName || '').trim().slice(0, 100);
        batch.set(newCustRef, {
          userId: uid,
          name: resolvedCustomerName,
          phone: ((params.newCustomerPhone || '').trim() || '01700-000000').slice(0, 30),
          address: (params.newCustomerAddress || '').trim().slice(0, 200),
          identityHint: '',
          note: '',
          totalDue: dueAmount,
          totalPurchased: totalAmount,
          totalPaid: cleanPaid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const txTitle = summaryTitle || 'POS Sale';
      const firstProdId = params.cartItems[0]?.product.id || '';

      batch.set(txRef, {
        userId: uid,
        type: 'SALE',
        title: txTitle,
        amount: totalAmount,
        paidAmount: cleanPaid,
        dueAmount,
        profitAmount: totalProfit,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName.slice(0, 100),
        supplierId: '',
        supplierName: '',
        productId: firstProdId,
        category: 'POS Sale',
        notes: encodedNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      await this.recordAuditLog(
        `Recorded sale ৳${totalAmount} (Paid: ৳${cleanPaid}, Due: ৳${dueAmount})`,
        'POS'
      );

      return {
        id: txRef.id,
        userId: uid,
        type: 'SALE',
        title: txTitle,
        amount: totalAmount,
        paidAmount: cleanPaid,
        dueAmount,
        profitAmount: totalProfit,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName.slice(0, 100),
        supplierId: '',
        supplierName: '',
        productId: firstProdId,
        category: 'POS Sale',
        notes: encodedNotes,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, txRef.path);
    }
  }

  async returnOrVoidSale(params: {
    transaction: StoreTransaction;
    currentProducts: Product[];
    currentCustomers: Customer[];
    isReturn: boolean;
  }): Promise<void> {
    const uid = this.requireUserId();
    const txRef = doc(db, 'users', uid, 'transactions', params.transaction.id);
    const lineItems = parseLineItems(params.transaction);

    try {
      const batch = writeBatch(db);
      const qtyByProdId = new Map<string, number>();
      for (const li of lineItems) {
        if (li.productId) {
          qtyByProdId.set(
            li.productId,
            (qtyByProdId.get(li.productId) || 0) + li.quantity
          );
        }
      }

      for (const [prodId, restoreQty] of qtyByProdId.entries()) {
        if (prodId && restoreQty > 0) {
          const matchingProduct = params.currentProducts.find((p) => p.id === prodId);
          if (matchingProduct) {
            const prodRef = doc(db, 'users', uid, 'products', prodId);
            batch.update(prodRef, {
              stock: matchingProduct.stock + restoreQty,
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      if (params.transaction.customerId) {
        const matchingCustomer = params.currentCustomers.find(
          (c) => c.id === params.transaction.customerId
        );
        if (matchingCustomer) {
          const custRef = doc(db, 'users', uid, 'customers', matchingCustomer.id);
          batch.update(custRef, {
            totalDue: Math.max(
              0,
              matchingCustomer.totalDue - params.transaction.dueAmount
            ),
            totalPurchased: Math.max(
              0,
              matchingCustomer.totalPurchased - params.transaction.amount
            ),
            totalPaid: Math.max(
              0,
              matchingCustomer.totalPaid - params.transaction.paidAmount
            ),
            updatedAt: serverTimestamp(),
          });
        }
      }

      batch.delete(txRef);
      const binRef = doc(collection(db, 'users', uid, 'recycle_bin'));
      batch.set(binRef, {
        userId: uid,
        itemType: 'TRANSACTION',
        itemId: params.transaction.id,
        name: (params.transaction.title || 'POS Sale').slice(0, 200),
        details: `Type: SALE (${params.isReturn ? 'Returned' : 'Voided'}) | Amount: ৳${params.transaction.amount} | Customer: ${
          params.transaction.customerName || 'Walk-in'
        }`.slice(0, 300),
        payloadJson: buildTransactionRecyclePayload(params.transaction, true),
        deletedBy: this.currentActorName().slice(0, 120),
        deletedAt: serverTimestamp(),
      });
      await batch.commit();
      await this.recordAuditLog(
        `${params.isReturn ? 'Returned sale' : 'Voided sale'} (${params.transaction.title} • ৳${params.transaction.amount})`,
        'POS'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, txRef.path);
    }
  }

  // --- Suppliers, Purchases & Expenses ---

  async addSupplier(params: {
    name: string;
    phone: string;
    company: string;
    initialPayable: number;
  }): Promise<string> {
    const uid = this.requireUserId();
    const docRef = doc(collection(db, 'users', uid, 'suppliers'));
    const cleanPayable = Math.max(0, params.initialPayable || 0);
    const cleanName = params.name.trim().slice(0, 100);
    try {
      const batch = writeBatch(db);
      batch.set(docRef, {
        userId: uid,
        name: cleanName,
        phone: (params.phone.trim() || '—').slice(0, 30),
        company: (params.company || '').trim().slice(0, 100),
        payableBalance: cleanPayable,
        totalPurchased: cleanPayable,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (cleanPayable > 0) {
        const txRef = doc(collection(db, 'users', uid, 'transactions'));
        batch.set(txRef, {
          userId: uid,
          type: 'PURCHASE',
          title: `Opening Payable - ${cleanName}`.slice(0, 200),
          amount: cleanPayable,
          paidAmount: 0,
          dueAmount: cleanPayable,
          profitAmount: 0,
          customerId: '',
          customerName: '',
          supplierId: docRef.id,
          supplierName: cleanName,
          productId: '',
          category: 'Supplier Credit',
          notes: 'Initial opening payable balance',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await this.recordAuditLog(
        `Added supplier ${cleanName} (${params.company.trim()})`,
        'Accounts'
      );
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docRef.path);
    }
  }

  async updateSupplier(
    supplier: Supplier,
    params: { name: string; phone: string; company: string }
  ): Promise<void> {
    const uid = this.requireUserId();
    const supRef = doc(db, 'users', uid, 'suppliers', supplier.id);
    try {
      await updateDoc(supRef, {
        name: (params.name.trim() || supplier.name).slice(0, 100),
        phone: (params.phone.trim() || '—').slice(0, 30),
        company: (params.company || '').trim().slice(0, 100),
        updatedAt: serverTimestamp(),
      });
      await this.recordAuditLog(`Updated supplier ${params.name.trim()}`, 'Accounts');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, supRef.path);
    }
  }

  async deleteSupplier(supplierId: string, supplierName: string): Promise<void> {
    const uid = this.requireUserId();
    const docRef = doc(db, 'users', uid, 'suppliers', supplierId);
    const binRef = doc(collection(db, 'users', uid, 'recycle_bin'));
    try {
      let payloadJson = '';
      let details = `Supplier: ${supplierName}`.slice(0, 300);
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const d = snap.data();
          const createdAtMillis = extractTimestampMillis(d.createdAt);
          payloadJson = safeSerializePayload({
            name: String(d.name ?? supplierName),
            phone: String(d.phone ?? '—'),
            company: String(d.company ?? ''),
            payableBalance: Number(d.payableBalance ?? 0),
            totalPurchased: Number(d.totalPurchased ?? 0),
            ...(createdAtMillis !== undefined ? { createdAtMillis } : {}),
          });
          details = `Phone: ${String(d.phone ?? '—')} | Payable: ৳${Number(d.payableBalance ?? 0)}`.slice(0, 300);
        }
      } catch {
        // Proceed even if pre-read fails
      }

      const batch = writeBatch(db);
      batch.delete(docRef);
      batch.set(binRef, {
        userId: uid,
        itemType: 'SUPPLIER',
        itemId: supplierId,
        name: supplierName.slice(0, 200) || 'Supplier',
        details,
        payloadJson,
        deletedBy: this.currentActorName().slice(0, 120),
        deletedAt: serverTimestamp(),
      });
      await batch.commit();
      await this.recordAuditLog(
        `Deleted supplier ${supplierName} (moved to Recycle Bin)`,
        'Suppliers'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docRef.path);
    }
  }

  async addSupplierOwed(
    supplier: Supplier,
    amount: number,
    notes: string
  ): Promise<void> {
    const uid = this.requireUserId();
    const cleanAmount = Math.max(0, amount || 0);
    const supRef = doc(db, 'users', uid, 'suppliers', supplier.id);
    const txRef = doc(collection(db, 'users', uid, 'transactions'));
    try {
      const batch = writeBatch(db);
      batch.update(supRef, {
        payableBalance: supplier.payableBalance + cleanAmount,
        totalPurchased: supplier.totalPurchased + cleanAmount,
        updatedAt: serverTimestamp(),
      });
      batch.set(txRef, {
        userId: uid,
        type: 'PURCHASE',
        title: `Added owed - ${supplier.name}`.slice(0, 200),
        amount: cleanAmount,
        paidAmount: 0,
        dueAmount: cleanAmount,
        profitAmount: 0,
        customerId: '',
        customerName: '',
        supplierId: supplier.id,
        supplierName: supplier.name.slice(0, 100),
        productId: '',
        category: 'Supplier Credit',
        notes: (notes.trim() || 'Added supplier payable').slice(0, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      await this.recordAuditLog(
        `Added owed ৳${cleanAmount} for supplier ${supplier.name}`,
        'Accounts'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, supRef.path);
    }
  }

  async paySupplier(
    supplier: Supplier,
    amount: number,
    notes: string
  ): Promise<void> {
    const uid = this.requireUserId();
    const cleanAmount = Math.max(0, amount || 0);
    const supRef = doc(db, 'users', uid, 'suppliers', supplier.id);
    const txRef = doc(collection(db, 'users', uid, 'transactions'));
    try {
      const batch = writeBatch(db);
      batch.update(supRef, {
        payableBalance: Math.max(0, supplier.payableBalance - cleanAmount),
        updatedAt: serverTimestamp(),
      });
      batch.set(txRef, {
        userId: uid,
        type: 'SUPPLIER_PAYMENT',
        title: `Paid Supplier - ${supplier.name}`.slice(0, 200),
        amount: cleanAmount,
        paidAmount: cleanAmount,
        dueAmount: 0,
        profitAmount: 0,
        customerId: '',
        customerName: '',
        supplierId: supplier.id,
        supplierName: supplier.name.slice(0, 100),
        productId: '',
        category: 'Supplier Payment',
        notes: (notes.trim() || 'Supplier payable settlement').slice(0, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      await this.recordAuditLog(
        `Paid ৳${cleanAmount} to supplier ${supplier.name}`,
        'Accounts'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, supRef.path);
    }
  }

  async recordMultiItemPurchase(params: {
    cartItems: CartItem[];
    paidAmount: number;
    selectedSupplier: Supplier | null;
    newSupplierName: string;
    updateBuyingPrice: boolean;
    notes: string;
  }): Promise<StoreTransaction> {
    if (params.cartItems.length === 0) {
      throw new Error('Purchase cart cannot be empty');
    }
    const uid = this.requireUserId();
    const totalCost = Math.max(
      0,
      params.cartItems.reduce((acc, i) => acc + getCartLineTotal(i), 0)
    );
    const cleanPaid = Math.min(totalCost, Math.max(0, params.paidAmount || 0));
    const payableDue = Math.max(0, totalCost - cleanPaid);
    const summaryTitle =
      params.cartItems
        .map((i) => `${i.product.name} x${formatQty(i.quantity)}`)
        .join(', ')
        .slice(0, 200) || 'Purchase';
    const encodedNotes = encodeItemsAndNote(params.cartItems, params.notes);
    const txRef = doc(collection(db, 'users', uid, 'transactions'));
    const now = Timestamp.now();

    let resolvedSupplierId = params.selectedSupplier?.id || '';
    let resolvedSupplierName =
      params.selectedSupplier?.name ||
      (params.newSupplierName || '').trim() ||
      'No supplier';

    try {
      const batch = writeBatch(db);
      for (const item of params.cartItems) {
        if (item.product.id) {
          const prodRef = doc(db, 'users', uid, 'products', item.product.id);
          const newStock = Math.max(0, item.product.stock + item.quantity);
          const updates: Record<string, unknown> = {
            stock: newStock,
            updatedAt: serverTimestamp(),
          };
          if (params.updateBuyingPrice) {
            updates.buyPrice = Math.max(0, item.customUnitPrice);
          }
          batch.update(prodRef, updates);
        }
      }

      if (params.selectedSupplier && params.selectedSupplier.id) {
        const supRef = doc(db, 'users', uid, 'suppliers', params.selectedSupplier.id);
        batch.update(supRef, {
          payableBalance: params.selectedSupplier.payableBalance + payableDue,
          totalPurchased: params.selectedSupplier.totalPurchased + totalCost,
          updatedAt: serverTimestamp(),
        });
      } else if ((params.newSupplierName || '').trim().length > 0) {
        const newSupRef = doc(collection(db, 'users', uid, 'suppliers'));
        resolvedSupplierId = newSupRef.id;
        resolvedSupplierName = (params.newSupplierName || '').trim().slice(0, 100);
        batch.set(newSupRef, {
          userId: uid,
          name: resolvedSupplierName,
          phone: '—',
          company: '',
          payableBalance: payableDue,
          totalPurchased: totalCost,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const firstProdId = params.cartItems[0]?.product.id || '';
      batch.set(txRef, {
        userId: uid,
        type: 'PURCHASE',
        title: summaryTitle,
        amount: totalCost,
        paidAmount: cleanPaid,
        dueAmount: payableDue,
        profitAmount: 0,
        customerId: '',
        customerName: '',
        supplierId: resolvedSupplierId,
        supplierName: resolvedSupplierName.slice(0, 100),
        productId: firstProdId,
        category: 'Stock Purchase',
        notes: encodedNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      await this.recordAuditLog(
        `Recorded purchase ৳${totalCost} (Paid: ৳${cleanPaid}, Due: ৳${payableDue})`,
        'Accounts'
      );

      return {
        id: txRef.id,
        userId: uid,
        type: 'PURCHASE',
        title: summaryTitle,
        amount: totalCost,
        paidAmount: cleanPaid,
        dueAmount: payableDue,
        profitAmount: 0,
        customerId: '',
        customerName: '',
        supplierId: resolvedSupplierId,
        supplierName: resolvedSupplierName.slice(0, 100),
        productId: firstProdId,
        category: 'Stock Purchase',
        notes: encodedNotes,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, txRef.path);
    }
  }

  async voidPurchase(params: {
    transaction: StoreTransaction;
    currentProducts: Product[];
    currentSuppliers: Supplier[];
  }): Promise<void> {
    const uid = this.requireUserId();
    const txRef = doc(db, 'users', uid, 'transactions', params.transaction.id);
    const lineItems = parseLineItems(params.transaction);
    try {
      const batch = writeBatch(db);
      const qtyByProdId = new Map<string, number>();
      for (const li of lineItems) {
        if (li.productId) {
          qtyByProdId.set(
            li.productId,
            (qtyByProdId.get(li.productId) || 0) + li.quantity
          );
        }
      }
      for (const [prodId, deductQty] of qtyByProdId.entries()) {
        if (prodId && deductQty > 0) {
          const matchingProduct = params.currentProducts.find((p) => p.id === prodId);
          if (matchingProduct) {
            const prodRef = doc(db, 'users', uid, 'products', prodId);
            batch.update(prodRef, {
              stock: Math.max(0, matchingProduct.stock - deductQty),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      if (params.transaction.supplierId || params.transaction.supplierName) {
        const matchingSupplier = params.currentSuppliers.find(
          (sup) =>
            (params.transaction.supplierId &&
              sup.id === params.transaction.supplierId) ||
            (params.transaction.supplierName &&
              sup.name.toLowerCase() ===
                params.transaction.supplierName.toLowerCase())
        );
        if (matchingSupplier) {
          const supRef = doc(db, 'users', uid, 'suppliers', matchingSupplier.id);
          batch.update(supRef, {
            payableBalance: Math.max(
              0,
              matchingSupplier.payableBalance - params.transaction.dueAmount
            ),
            totalPurchased: Math.max(
              0,
              matchingSupplier.totalPurchased - params.transaction.amount
            ),
            updatedAt: serverTimestamp(),
          });
        }
      }

      batch.delete(txRef);
      const binRef = doc(collection(db, 'users', uid, 'recycle_bin'));
      batch.set(binRef, {
        userId: uid,
        itemType: 'TRANSACTION',
        itemId: params.transaction.id,
        name: (params.transaction.title || 'Purchase').slice(0, 200),
        details: `Type: PURCHASE (Voided) | Amount: ৳${params.transaction.amount} | Supplier: ${
          params.transaction.supplierName || 'N/A'
        }`.slice(0, 300),
        payloadJson: buildTransactionRecyclePayload(params.transaction, true),
        deletedBy: this.currentActorName().slice(0, 120),
        deletedAt: serverTimestamp(),
      });
      await batch.commit();
      await this.recordAuditLog(
        `Voided purchase (${params.transaction.title} • ৳${params.transaction.amount})`,
        'Accounts'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, txRef.path);
    }
  }

  async recordExpense(params: {
    title: string;
    category: string;
    amount: number;
    notes: string;
  }): Promise<string> {
    const uid = this.requireUserId();
    const cleanAmount = Math.max(0, params.amount || 0);
    const txRef = doc(collection(db, 'users', uid, 'transactions'));
    try {
      await setDoc(txRef, {
        userId: uid,
        type: 'EXPENSE',
        title: params.title.trim().slice(0, 200),
        amount: cleanAmount,
        paidAmount: cleanAmount,
        dueAmount: 0,
        profitAmount: 0,
        customerId: '',
        customerName: '',
        supplierId: '',
        supplierName: '',
        productId: '',
        category: (params.category.trim() || 'Shop Expense').slice(0, 60),
        notes: (params.notes.trim() || 'Operating expense').slice(0, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await this.recordAuditLog(
        `Recorded expense: ${params.title.trim()} (৳${cleanAmount})`,
        'Accounts'
      );
      return txRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, txRef.path);
    }
  }

  async deleteExpense(transactionId: string, title: string): Promise<void> {
    const uid = this.requireUserId();
    const txRef = doc(db, 'users', uid, 'transactions', transactionId);
    const binRef = doc(collection(db, 'users', uid, 'recycle_bin'));
    try {
      let payloadJson = '';
      let details = `Expense: ${title}`.slice(0, 300);
      try {
        const snap = await getDoc(txRef);
        if (snap.exists()) {
          const d = snap.data();
          const createdAtMillis = extractTimestampMillis(d.createdAt);
          payloadJson = safeSerializePayload({
            type: 'EXPENSE',
            title: String(d.title ?? title),
            amount: Number(d.amount ?? 0),
            paidAmount: Number(d.paidAmount ?? d.amount ?? 0),
            dueAmount: Number(d.dueAmount ?? 0),
            profitAmount: Number(d.profitAmount ?? 0),
            customerId: String(d.customerId ?? ''),
            customerName: String(d.customerName ?? ''),
            supplierId: String(d.supplierId ?? ''),
            supplierName: String(d.supplierName ?? ''),
            productId: String(d.productId ?? ''),
            category: String(d.category ?? 'General'),
            notes: String(d.notes ?? ''),
            ...(createdAtMillis !== undefined ? { createdAtMillis } : {}),
            reversedOnDelete: false,
          });
          details = `Expense: ${String(d.title ?? title)} | ৳${Number(d.amount ?? 0)} | ${String(d.category ?? 'General')}`.slice(0, 300);
        }
      } catch {
        // Proceed even if pre-read fails
      }

      const batch = writeBatch(db);
      batch.delete(txRef);
      batch.set(binRef, {
        userId: uid,
        itemType: 'EXPENSE',
        itemId: transactionId,
        name: title.slice(0, 200) || 'Expense',
        details,
        payloadJson,
        deletedBy: this.currentActorName().slice(0, 120),
        deletedAt: serverTimestamp(),
      });
      await batch.commit();
      await this.recordAuditLog(
        `Deleted expense: ${title} (moved to Recycle Bin)`,
        'Accounts'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, txRef.path);
    }
  }

  async deleteTransaction(
    transaction: StoreTransaction,
    currentCustomers: Customer[],
    currentSuppliers: Supplier[],
    currentProducts: Product[] = []
  ): Promise<void> {
    const uid = this.requireUserId();
    const txRef = doc(db, 'users', uid, 'transactions', transaction.id);
    const binRef = doc(collection(db, 'users', uid, 'recycle_bin'));

    try {
      const batch = writeBatch(db);
      batch.delete(txRef);

      if (transaction.customerId || transaction.customerName) {
        const matchingCustomer = currentCustomers.find(
          (cust) =>
            (transaction.customerId && cust.id === transaction.customerId) ||
            (transaction.customerName &&
              cust.name.toLowerCase() === transaction.customerName.toLowerCase())
        );
        if (matchingCustomer) {
          const custRef = doc(db, 'users', uid, 'customers', matchingCustomer.id);
          if (transaction.type === 'GIVE_DUE') {
            batch.update(custRef, {
              totalDue: Math.max(0, matchingCustomer.totalDue - transaction.dueAmount),
              totalPurchased: Math.max(
                0,
                matchingCustomer.totalPurchased - transaction.amount
              ),
              updatedAt: serverTimestamp(),
            });
          } else if (transaction.type === 'RECEIVE_PAYMENT') {
            batch.update(custRef, {
              totalDue: matchingCustomer.totalDue + transaction.amount,
              totalPaid: Math.max(0, matchingCustomer.totalPaid - transaction.amount),
              updatedAt: serverTimestamp(),
            });
          } else if (transaction.type === 'SALE') {
            batch.update(custRef, {
              totalDue: Math.max(0, matchingCustomer.totalDue - transaction.dueAmount),
              totalPurchased: Math.max(
                0,
                matchingCustomer.totalPurchased - transaction.amount
              ),
              totalPaid: Math.max(
                0,
                matchingCustomer.totalPaid - transaction.paidAmount
              ),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      if (
        (transaction.type === 'SUPPLIER_PAYMENT' || transaction.type === 'PURCHASE') &&
        (transaction.supplierId || transaction.supplierName)
      ) {
        const matchingSupplier = currentSuppliers.find(
          (sup) =>
            (transaction.supplierId && sup.id === transaction.supplierId) ||
            (transaction.supplierName &&
              sup.name.toLowerCase() === transaction.supplierName.toLowerCase())
        );
        if (matchingSupplier) {
          const supRef = doc(db, 'users', uid, 'suppliers', matchingSupplier.id);
          if (transaction.type === 'SUPPLIER_PAYMENT') {
            batch.update(supRef, {
              payableBalance: matchingSupplier.payableBalance + transaction.amount,
              updatedAt: serverTimestamp(),
            });
          } else if (transaction.type === 'PURCHASE') {
            batch.update(supRef, {
              payableBalance: Math.max(
                0,
                matchingSupplier.payableBalance - transaction.dueAmount
              ),
              totalPurchased: Math.max(
                0,
                matchingSupplier.totalPurchased - transaction.amount
              ),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      // Reverse product inventory stock consistently with Sales, Purchases, and Stock Adjustments
      if (currentProducts.length > 0) {
        const stockDeltas = new Map<string, { product: Product; delta: number }>();

        if (transaction.type === 'SALE') {
          const lineItems = parseLineItems(transaction);
          for (const item of lineItems) {
            const matched = currentProducts.find(
              (p) =>
                (item.productId && p.id === item.productId) ||
                p.name.toLowerCase() === item.productName.toLowerCase()
            );
            if (matched && item.quantity > 0) {
              const prev = stockDeltas.get(matched.id) || { product: matched, delta: 0 };
              prev.delta += item.quantity;
              stockDeltas.set(matched.id, prev);
            }
          }
        } else if (
          transaction.type === 'PURCHASE' &&
          ((transaction.notes || '').startsWith('ITEMS:') || Boolean(transaction.productId))
        ) {
          const lineItems = parseLineItems(transaction);
          for (const item of lineItems) {
            const matched = currentProducts.find(
              (p) =>
                (item.productId && p.id === item.productId) ||
                p.name.toLowerCase() === item.productName.toLowerCase()
            );
            if (matched && item.quantity > 0) {
              const prev = stockDeltas.get(matched.id) || { product: matched, delta: 0 };
              prev.delta -= item.quantity;
              stockDeltas.set(matched.id, prev);
            }
          }
        } else if (
          transaction.type === 'STOCK_ADJUST' &&
          transaction.category !== 'STARTING_CASH' &&
          transaction.productId
        ) {
          const matched = currentProducts.find((p) => p.id === transaction.productId);
          if (matched) {
            const originalDelta = parseStockAdjustDelta(transaction);
            stockDeltas.set(matched.id, { product: matched, delta: -originalDelta });
          }
        }

        for (const [prodId, { product, delta }] of stockDeltas.entries()) {
          if (delta === 0) continue;
          const prodRef = doc(db, 'users', uid, 'products', prodId);
          batch.update(prodRef, {
            stock: Math.max(0, Number((product.stock + delta).toFixed(4))),
            updatedAt: serverTimestamp(),
          });
        }
      }

      const payloadJson = buildTransactionRecyclePayload(transaction, true);

      batch.set(binRef, {
        userId: uid,
        itemType: transaction.type === 'EXPENSE' ? 'EXPENSE' : 'TRANSACTION',
        itemId: transaction.id,
        name: (transaction.title || transaction.type).slice(0, 200),
        details: `Type: ${transaction.type} | Amount: ৳${transaction.amount} | Customer: ${
          transaction.customerName || 'N/A'
        }`.slice(0, 300),
        payloadJson,
        deletedBy: this.currentActorName().slice(0, 120),
        deletedAt: serverTimestamp(),
      });

      await batch.commit();
      await this.recordAuditLog(
        `Deleted transaction: ${transaction.title} (৳${transaction.amount})`,
        'Transactions'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, txRef.path);
    }
  }

  async setStartingCash(amount: number): Promise<string> {
    const uid = this.requireUserId();
    const cleanAmount = Math.max(0, amount || 0);
    const txRef = doc(collection(db, 'users', uid, 'transactions'));
    try {
      await setDoc(txRef, {
        userId: uid,
        type: 'STOCK_ADJUST',
        title: 'Starting Cash',
        amount: cleanAmount,
        paidAmount: 0,
        dueAmount: 0,
        profitAmount: 0,
        customerId: '',
        customerName: '',
        supplierId: '',
        supplierName: '',
        productId: '',
        category: 'STARTING_CASH',
        notes: 'Cash at start',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await this.recordAuditLog(`Set starting cash: ৳${cleanAmount}`, 'Accounts');
      return txRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, txRef.path);
    }
  }

  // --- Staff Management ---

  async addStaffMember(params: {
    name: string;
    role: string;
    phone: string;
    salary: number;
  }): Promise<string> {
    const uid = this.requireUserId();
    const docRef = doc(collection(db, 'users', uid, 'staff'));
    const safeRole = normalizeStaffRole(params.role);
    try {
      await setDoc(docRef, {
        userId: uid,
        name: params.name.trim().slice(0, 100),
        role: safeRole,
        phone: (params.phone.trim() || '—').slice(0, 30),
        salary: Math.max(0, params.salary || 0),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await this.recordAuditLog(
        `Added staff ${params.name.trim()} as ${safeRole}`,
        'Settings'
      );
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docRef.path);
    }
  }

  async toggleStaffActive(staff: StaffMember): Promise<void> {
    const uid = this.requireUserId();
    const docRef = doc(db, 'users', uid, 'staff', staff.id);
    try {
      await updateDoc(docRef, {
        active: !staff.active,
        updatedAt: serverTimestamp(),
      });
      await this.recordAuditLog(`Updated status for staff ${staff.name}`, 'Settings');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docRef.path);
    }
  }

  async updateStaffMember(
    staff: StaffMember,
    params: {
      name: string;
      role: string;
      phone: string;
      salary: number;
      active: boolean;
    }
  ): Promise<void> {
    const uid = this.requireUserId();
    const docRef = doc(db, 'users', uid, 'staff', staff.id);
    const safeRole = normalizeStaffRole(params.role);
    try {
      await updateDoc(docRef, {
        name: params.name.trim().slice(0, 100),
        role: safeRole,
        phone: (params.phone.trim() || '—').slice(0, 30),
        salary: Math.max(0, params.salary || 0),
        active: params.active,
        updatedAt: serverTimestamp(),
      });
      await this.recordAuditLog(
        `Updated staff: ${params.name.trim()} (${safeRole})`,
        'Settings'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docRef.path);
    }
  }

  async deleteStaffMember(staff: StaffMember): Promise<void> {
    const uid = this.requireUserId();
    const staffRef = doc(db, 'users', uid, 'staff', staff.id);
    const binRef = doc(collection(db, 'users', uid, 'recycle_bin'));
    const createdAtMillis = extractTimestampMillis(staff.createdAt);
    const payloadJson = safeSerializePayload({
      name: staff.name,
      role: normalizeStaffRole(staff.role),
      phone: staff.phone,
      salary: staff.salary,
      active: staff.active,
      ...(createdAtMillis !== undefined ? { createdAtMillis } : {}),
    });
    try {
      const batch = writeBatch(db);
      batch.delete(staffRef);
      batch.set(binRef, {
        userId: uid,
        itemType: 'STAFF',
        itemId: staff.id,
        name: staff.name.slice(0, 200) || 'Staff',
        details: `Role: ${staff.role} | Phone: ${staff.phone} | Salary: ৳${staff.salary}`.slice(
          0,
          300
        ),
        payloadJson,
        deletedBy: this.currentActorName().slice(0, 120),
        deletedAt: serverTimestamp(),
      });
      await batch.commit();
      await this.recordAuditLog(
        `Deleted staff: ${staff.name} (moved to Recycle Bin)`,
        'Settings'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, staffRef.path);
    }
  }

  // --- Recycle Bin & Store Reset ---

  private async resolveRestoreDocRef(
    uid: string,
    collectionName: 'products' | 'customers' | 'suppliers' | 'transactions' | 'staff',
    originalId: string
  ) {
    if (isValidFirestoreDocId(originalId)) {
      const candidate = doc(db, 'users', uid, collectionName, originalId);
      try {
        const existingSnap = await getDoc(candidate);
        if (!existingSnap.exists()) {
          return candidate;
        }
      } catch {
        // If pre-check fails, still prefer restoring to original ID
        return candidate;
      }
    }
    return doc(collection(db, 'users', uid, collectionName));
  }

  async restoreRecycleItem(
    item: RecycleBinItem,
    currentCustomers: Customer[] = [],
    currentSuppliers: Supplier[] = [],
    currentProducts: Product[] = []
  ): Promise<void> {
    const uid = this.requireUserId();
    const binRef = doc(db, 'users', uid, 'recycle_bin', item.id);
    let parsed: Record<string, unknown> = {};
    if (item.payloadJson) {
      try {
        const obj = JSON.parse(item.payloadJson);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          parsed = obj as Record<string, unknown>;
        }
      } catch {
        parsed = {};
      }
    }

    const restoredCreatedAt = resolveRestoredCreatedAt(parsed.createdAtMillis);
    const batch = writeBatch(db);
    let targetPathForError = binRef.path;

    if (item.itemType === 'PRODUCT') {
      const prodRef = await this.resolveRestoreDocRef(uid, 'products', item.itemId);
      targetPathForError = prodRef.path;
      const cleanName = (String(parsed.name || item.name || 'Restored Product').trim() || 'Restored Product').slice(0, 120);
      const cleanCategory = (String(parsed.category || 'General').trim() || 'General').slice(0, 60);
      const cleanUnit = normalizeFirestoreUnit(String(parsed.unit || 'pcs'));
      const cleanBuyPrice = Math.max(0, Number(parsed.buyPrice ?? 0) || 0);
      const cleanSellPrice = Math.max(0, Number(parsed.sellPrice ?? 0) || 0);
      const cleanStock = Math.max(
        0,
        parsed.stock !== undefined && parsed.stock !== null ? Number(parsed.stock) || 0 : 0
      );
      const cleanLowStock = Math.max(
        0,
        parsed.lowStockThreshold !== undefined && parsed.lowStockThreshold !== null
          ? Number(parsed.lowStockThreshold) || 0
          : 5
      );
      const cleanBarcode = String(parsed.barcode || '').trim().slice(0, 64);
      const cleanQuality = String(parsed.quality || '').trim().slice(0, 100);
      const cleanNote = String(parsed.note || '').trim().slice(0, 300);

      saveProductExtras(prodRef.id, cleanQuality, cleanNote);

      batch.set(prodRef, {
        userId: uid,
        name: cleanName,
        category: cleanCategory,
        unit: cleanUnit,
        buyPrice: cleanBuyPrice,
        sellPrice: cleanSellPrice,
        stock: cleanStock,
        lowStockThreshold: cleanLowStock,
        barcode: cleanBarcode,
        quality: cleanQuality,
        note: cleanNote,
        createdAt: restoredCreatedAt,
        updatedAt: serverTimestamp(),
      });
    } else if (item.itemType === 'CUSTOMER') {
      const custRef = await this.resolveRestoreDocRef(uid, 'customers', item.itemId);
      targetPathForError = custRef.path;
      const cleanName = (String(parsed.name || item.name || 'Restored Customer').trim() || 'Restored Customer').slice(0, 100);
      const cleanPhone = (String(parsed.phone || '—').trim() || '—').slice(0, 30);
      const cleanAddress = String(parsed.address || '').trim().slice(0, 200);
      const cleanHint = String(parsed.identityHint || '').trim().slice(0, 150);
      const cleanNote = String(parsed.note || '').trim().slice(0, 300);

      saveCustomerExtras(custRef.id, cleanHint, cleanNote);

      batch.set(custRef, {
        userId: uid,
        name: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        identityHint: cleanHint,
        note: cleanNote,
        totalDue: Number(parsed.totalDue ?? 0) || 0,
        totalPurchased: Math.max(0, Number(parsed.totalPurchased ?? 0) || 0),
        totalPaid: Math.max(0, Number(parsed.totalPaid ?? 0) || 0),
        createdAt: restoredCreatedAt,
        updatedAt: serverTimestamp(),
      });
    } else if (item.itemType === 'SUPPLIER') {
      const supRef = await this.resolveRestoreDocRef(uid, 'suppliers', item.itemId);
      targetPathForError = supRef.path;
      const cleanName = (String(parsed.name || item.name || 'Restored Supplier').trim() || 'Restored Supplier').slice(0, 100);
      const cleanPhone = (String(parsed.phone || '—').trim() || '—').slice(0, 30);
      const cleanCompany = String(parsed.company || '').trim().slice(0, 100);

      batch.set(supRef, {
        userId: uid,
        name: cleanName,
        phone: cleanPhone,
        company: cleanCompany,
        payableBalance: Math.max(0, Number(parsed.payableBalance ?? 0) || 0),
        totalPurchased: Math.max(0, Number(parsed.totalPurchased ?? 0) || 0),
        createdAt: restoredCreatedAt,
        updatedAt: serverTimestamp(),
      });
    } else if (item.itemType === 'EXPENSE') {
      const txRef = await this.resolveRestoreDocRef(uid, 'transactions', item.itemId);
      targetPathForError = txRef.path;
      const cleanAmount = Math.max(0, Number(parsed.amount ?? 0) || 0);
      const cleanPaid =
        parsed.paidAmount !== undefined && parsed.paidAmount !== null
          ? Math.max(0, Number(parsed.paidAmount) || 0)
          : cleanAmount;
      const cleanTitle = (String(parsed.title || item.name || 'Restored Expense').trim() || 'Restored Expense').slice(0, 200);

      batch.set(txRef, {
        userId: uid,
        type: 'EXPENSE',
        title: cleanTitle,
        amount: cleanAmount,
        paidAmount: cleanPaid,
        dueAmount: Math.max(0, Number(parsed.dueAmount ?? 0) || 0),
        profitAmount: Number(parsed.profitAmount ?? 0) || 0,
        customerId: String(parsed.customerId || '').slice(0, 128),
        customerName: String(parsed.customerName || '').slice(0, 100),
        supplierId: String(parsed.supplierId || '').slice(0, 128),
        supplierName: String(parsed.supplierName || '').slice(0, 100),
        productId: String(parsed.productId || '').slice(0, 128),
        category: (String(parsed.category || 'Shop Expense').trim() || 'Shop Expense').slice(0, 60),
        notes: String(parsed.notes ?? '').slice(0, 300),
        createdAt: restoredCreatedAt,
        updatedAt: serverTimestamp(),
      });
    } else if (item.itemType === 'STAFF') {
      const staffRef = await this.resolveRestoreDocRef(uid, 'staff', item.itemId);
      targetPathForError = staffRef.path;
      const cleanName = (String(parsed.name || item.name || 'Restored Staff').trim() || 'Restored Staff').slice(0, 100);
      const cleanPhone = (String(parsed.phone || '—').trim() || '—').slice(0, 30);

      batch.set(staffRef, {
        userId: uid,
        name: cleanName,
        role: normalizeStaffRole(String(parsed.role || 'Cashier')),
        phone: cleanPhone,
        salary: Math.max(0, Number(parsed.salary ?? 0) || 0),
        active: typeof parsed.active === 'boolean' ? parsed.active : true,
        createdAt: restoredCreatedAt,
        updatedAt: serverTimestamp(),
      });
    } else if (item.itemType === 'TRANSACTION' && typeof parsed.type === 'string') {
      const validTypes = [
        'SALE',
        'GIVE_DUE',
        'RECEIVE_PAYMENT',
        'PURCHASE',
        'SUPPLIER_PAYMENT',
        'EXPENSE',
        'STOCK_ADJUST',
      ];
      const txType = validTypes.includes(parsed.type)
        ? (parsed.type as StoreTransaction['type'])
        : null;

      if (txType) {
        const txRef = await this.resolveRestoreDocRef(uid, 'transactions', item.itemId);
        targetPathForError = txRef.path;
        const restoredTx: StoreTransaction = {
          id: txRef.id,
          userId: uid,
          type: txType,
          title: (String(parsed.title || item.name || txType).trim() || txType).slice(0, 200),
          amount: Math.max(0, Number(parsed.amount ?? 0) || 0),
          paidAmount: Math.max(0, Number(parsed.paidAmount ?? 0) || 0),
          dueAmount: Math.max(0, Number(parsed.dueAmount ?? 0) || 0),
          profitAmount: Number(parsed.profitAmount ?? 0) || 0,
          customerId: String(parsed.customerId || '').slice(0, 128),
          customerName: String(parsed.customerName || '').slice(0, 100),
          supplierId: String(parsed.supplierId || '').slice(0, 128),
          supplierName: String(parsed.supplierName || '').slice(0, 100),
          productId: String(parsed.productId || '').slice(0, 128),
          category: String(parsed.category || '').slice(0, 60),
          notes: String(parsed.notes || '').slice(0, 300),
          createdAt: null,
          updatedAt: null,
        };

        batch.set(txRef, {
          userId: uid,
          type: restoredTx.type,
          title: restoredTx.title,
          amount: restoredTx.amount,
          paidAmount: restoredTx.paidAmount,
          dueAmount: restoredTx.dueAmount,
          profitAmount: restoredTx.profitAmount,
          customerId: restoredTx.customerId,
          customerName: restoredTx.customerName,
          supplierId: restoredTx.supplierId,
          supplierName: restoredTx.supplierName,
          productId: restoredTx.productId,
          category: restoredTx.category,
          notes: restoredTx.notes,
          createdAt: restoredCreatedAt,
          updatedAt: serverTimestamp(),
        });

        // Only re-apply balance/stock mutations when they were reversed upon deletion.
        // Items moved during resetAllStoreData carry reversedOnDelete: false so restoring
        // everything after a reset never double-counts customer/supplier/product state.
        const shouldReapplySideEffects = parsed.reversedOnDelete !== false;

        if (shouldReapplySideEffects) {
          // 1) Re-apply linked customer balance using live Firestore document
          if (
            (restoredTx.type === 'GIVE_DUE' ||
              restoredTx.type === 'RECEIVE_PAYMENT' ||
              restoredTx.type === 'SALE') &&
            (restoredTx.customerId || restoredTx.customerName)
          ) {
            let liveCustomerId = isValidFirestoreDocId(restoredTx.customerId)
              ? restoredTx.customerId
              : '';
            let liveCustData: Record<string, unknown> | null = null;

            if (liveCustomerId) {
              try {
                const snap = await getDoc(doc(db, 'users', uid, 'customers', liveCustomerId));
                if (snap.exists()) {
                  liveCustData = snap.data();
                } else {
                  liveCustomerId = '';
                }
              } catch {
                liveCustomerId = '';
              }
            }

            if (!liveCustData && restoredTx.customerName) {
              const matchedCust = currentCustomers.find(
                (c) => c.name.toLowerCase() === restoredTx.customerName.toLowerCase()
              );
              if (matchedCust && isValidFirestoreDocId(matchedCust.id)) {
                try {
                  const snap = await getDoc(doc(db, 'users', uid, 'customers', matchedCust.id));
                  if (snap.exists()) {
                    liveCustomerId = matchedCust.id;
                    liveCustData = snap.data();
                  }
                } catch {
                  // ignore
                }
              }
            }

            if (liveCustomerId && liveCustData) {
              const curDue = Number(liveCustData.totalDue ?? 0) || 0;
              const curPurchased = Math.max(0, Number(liveCustData.totalPurchased ?? 0) || 0);
              const curPaid = Math.max(0, Number(liveCustData.totalPaid ?? 0) || 0);
              const custRef = doc(db, 'users', uid, 'customers', liveCustomerId);

              if (restoredTx.type === 'GIVE_DUE') {
                batch.update(custRef, {
                  totalDue: curDue + restoredTx.dueAmount,
                  totalPurchased: curPurchased + restoredTx.amount,
                  updatedAt: serverTimestamp(),
                });
              } else if (restoredTx.type === 'RECEIVE_PAYMENT') {
                batch.update(custRef, {
                  totalDue: Math.max(0, curDue - restoredTx.amount),
                  totalPaid: curPaid + restoredTx.amount,
                  updatedAt: serverTimestamp(),
                });
              } else if (restoredTx.type === 'SALE') {
                batch.update(custRef, {
                  totalDue: curDue + restoredTx.dueAmount,
                  totalPurchased: curPurchased + restoredTx.amount,
                  totalPaid: curPaid + restoredTx.paidAmount,
                  updatedAt: serverTimestamp(),
                });
              }
            }
          }

          // 2) Re-apply linked supplier balance using live Firestore document
          if (
            (restoredTx.type === 'SUPPLIER_PAYMENT' || restoredTx.type === 'PURCHASE') &&
            (restoredTx.supplierId || restoredTx.supplierName)
          ) {
            let liveSupplierId = isValidFirestoreDocId(restoredTx.supplierId)
              ? restoredTx.supplierId
              : '';
            let liveSupData: Record<string, unknown> | null = null;

            if (liveSupplierId) {
              try {
                const snap = await getDoc(doc(db, 'users', uid, 'suppliers', liveSupplierId));
                if (snap.exists()) {
                  liveSupData = snap.data();
                } else {
                  liveSupplierId = '';
                }
              } catch {
                liveSupplierId = '';
              }
            }

            if (!liveSupData && restoredTx.supplierName) {
              const matchedSup = currentSuppliers.find(
                (s) => s.name.toLowerCase() === restoredTx.supplierName.toLowerCase()
              );
              if (matchedSup && isValidFirestoreDocId(matchedSup.id)) {
                try {
                  const snap = await getDoc(doc(db, 'users', uid, 'suppliers', matchedSup.id));
                  if (snap.exists()) {
                    liveSupplierId = matchedSup.id;
                    liveSupData = snap.data();
                  }
                } catch {
                  // ignore
                }
              }
            }

            if (liveSupplierId && liveSupData) {
              const curPayable = Math.max(0, Number(liveSupData.payableBalance ?? 0) || 0);
              const curPurchased = Math.max(0, Number(liveSupData.totalPurchased ?? 0) || 0);
              const supRef = doc(db, 'users', uid, 'suppliers', liveSupplierId);

              if (restoredTx.type === 'SUPPLIER_PAYMENT') {
                batch.update(supRef, {
                  payableBalance: Math.max(0, curPayable - restoredTx.amount),
                  updatedAt: serverTimestamp(),
                });
              } else if (restoredTx.type === 'PURCHASE') {
                batch.update(supRef, {
                  payableBalance: curPayable + restoredTx.dueAmount,
                  totalPurchased: curPurchased + restoredTx.amount,
                  updatedAt: serverTimestamp(),
                });
              }
            }
          }

          // 3) Re-apply linked product stock using live Firestore documents
          const rawDeltasById = new Map<string, number>();
          const resolveProductId = (liProductId: string, liProductName: string): string => {
            if (isValidFirestoreDocId(liProductId)) return liProductId;
            if (liProductName) {
              const matched = currentProducts.find(
                (p) => p.name.toLowerCase() === liProductName.toLowerCase()
              );
              if (matched && isValidFirestoreDocId(matched.id)) return matched.id;
            }
            return '';
          };

          if (restoredTx.type === 'SALE') {
            for (const li of parseLineItems(restoredTx)) {
              const prodId = resolveProductId(li.productId, li.productName);
              if (prodId && li.quantity > 0) {
                rawDeltasById.set(prodId, (rawDeltasById.get(prodId) || 0) - li.quantity);
              }
            }
          } else if (
            restoredTx.type === 'PURCHASE' &&
            (restoredTx.notes.startsWith('ITEMS:') || Boolean(restoredTx.productId))
          ) {
            for (const li of parseLineItems(restoredTx)) {
              const prodId = resolveProductId(li.productId, li.productName);
              if (prodId && li.quantity > 0) {
                rawDeltasById.set(prodId, (rawDeltasById.get(prodId) || 0) + li.quantity);
              }
            }
          } else if (
            restoredTx.type === 'STOCK_ADJUST' &&
            restoredTx.category !== 'STARTING_CASH' &&
            isValidFirestoreDocId(restoredTx.productId)
          ) {
            const explicitDelta =
              typeof parsed.stockAdjustDelta === 'number' && Number.isFinite(parsed.stockAdjustDelta)
                ? parsed.stockAdjustDelta
                : parseStockAdjustDelta(restoredTx);
            if (explicitDelta !== 0) {
              rawDeltasById.set(restoredTx.productId, explicitDelta);
            }
          }

          for (const [prodId, delta] of rawDeltasById.entries()) {
            if (delta === 0) continue;
            const prodRef = doc(db, 'users', uid, 'products', prodId);
            try {
              const prodSnap = await getDoc(prodRef);
              if (prodSnap.exists()) {
                const liveStock = Math.max(0, Number(prodSnap.data().stock ?? 0) || 0);
                batch.update(prodRef, {
                  stock: Math.max(0, Number((liveStock + delta).toFixed(4))),
                  updatedAt: serverTimestamp(),
                });
              }
            } catch {
              // Product may not exist yet or was deleted; skip stock update safely
            }
          }
        }

        // 4) Sync starting cash setting if a STARTING_CASH record is restored
        if (restoredTx.type === 'STOCK_ADJUST' && restoredTx.category === 'STARTING_CASH') {
          const settingsRef = doc(db, 'users', uid, 'store_settings', 'config');
          try {
            const settingsSnap = await getDoc(settingsRef);
            if (settingsSnap.exists()) {
              batch.update(settingsRef, {
                startingCashBalance: restoredTx.amount,
                updatedAt: serverTimestamp(),
              });
            }
          } catch {
            // Best-effort sync
          }
        }
      }
    }

    // Atomically remove the Recycle Bin entry in the exact same commit
    batch.delete(binRef);

    try {
      await batch.commit();
      await this.recordAuditLog(
        `Restored ${item.name} (${item.itemType}) from Recycle Bin`,
        'RecycleBin'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, targetPathForError);
    }
  }

  async deletePermanentlyFromRecycleBin(binId: string): Promise<void> {
    const uid = this.requireUserId();
    const binRef = doc(db, 'users', uid, 'recycle_bin', binId);
    try {
      await deleteDoc(binRef);
      await this.recordAuditLog('Permanently deleted item from Recycle Bin', 'RecycleBin');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, binRef.path);
    }
  }

  async emptyRecycleBin(): Promise<void> {
    const uid = this.requireUserId();
    const colRef = collection(db, 'users', uid, 'recycle_bin');
    try {
      const snaps = await getDocs(query(colRef, where('userId', '==', uid)));
      const CHUNK_SIZE = 450;
      for (let i = 0; i < snaps.docs.length; i += CHUNK_SIZE) {
        const chunk = snaps.docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await this.recordAuditLog('Emptied Recycle Bin', 'RecycleBin');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}/recycle_bin`);
    }
  }

  async resetAllStoreData(params: {
    activeProducts: Product[];
    activeCustomers: Customer[];
    activeTransactions: StoreTransaction[];
    activeSuppliers: Supplier[];
    activeStaff: StaffMember[];
  }): Promise<void> {
    const uid = this.requireUserId();
    const actor = this.currentActorName().slice(0, 120);

    type ResetEntry = {
      deleteRef: ReturnType<typeof doc>;
      binPayload: Record<string, unknown>;
    };
    const entries: ResetEntry[] = [];

    for (const prod of params.activeProducts) {
      const createdAtMillis = extractTimestampMillis(prod.createdAt);
      entries.push({
        deleteRef: doc(db, 'users', uid, 'products', prod.id),
        binPayload: {
          userId: uid,
          itemType: 'PRODUCT',
          itemId: prod.id,
          name: (prod.name || 'Product').slice(0, 200),
          details: `Stock: ${prod.stock} ${prod.unit} | Buy: ৳${prod.buyPrice} | Sell: ৳${prod.sellPrice}`.slice(
            0,
            280
          ),
          payloadJson: safeSerializePayload({
            name: prod.name,
            category: prod.category,
            unit: prod.unit,
            buyPrice: prod.buyPrice,
            sellPrice: prod.sellPrice,
            stock: prod.stock,
            lowStockThreshold: prod.lowStockThreshold,
            barcode: prod.barcode,
            quality: prod.quality || '',
            note: prod.note || '',
            ...(createdAtMillis !== undefined ? { createdAtMillis } : {}),
          }),
          deletedBy: actor,
          deletedAt: serverTimestamp(),
        },
      });
    }

    for (const cust of params.activeCustomers) {
      const createdAtMillis = extractTimestampMillis(cust.createdAt);
      entries.push({
        deleteRef: doc(db, 'users', uid, 'customers', cust.id),
        binPayload: {
          userId: uid,
          itemType: 'CUSTOMER',
          itemId: cust.id,
          name: (cust.name || 'Customer').slice(0, 200),
          details: `Phone: ${cust.phone} | Due: ৳${cust.totalDue} | Paid: ৳${cust.totalPaid}`.slice(
            0,
            280
          ),
          payloadJson: safeSerializePayload({
            name: cust.name,
            phone: cust.phone,
            address: cust.address || '',
            identityHint: cust.identityHint || '',
            note: cust.note || '',
            totalDue: cust.totalDue,
            totalPurchased: cust.totalPurchased,
            totalPaid: cust.totalPaid,
            ...(createdAtMillis !== undefined ? { createdAtMillis } : {}),
          }),
          deletedBy: actor,
          deletedAt: serverTimestamp(),
        },
      });
    }

    for (const sup of params.activeSuppliers) {
      const createdAtMillis = extractTimestampMillis(sup.createdAt);
      entries.push({
        deleteRef: doc(db, 'users', uid, 'suppliers', sup.id),
        binPayload: {
          userId: uid,
          itemType: 'SUPPLIER',
          itemId: sup.id,
          name: (sup.name || 'Supplier').slice(0, 200),
          details: `Phone: ${sup.phone} | Payable: ৳${sup.payableBalance}`.slice(0, 280),
          payloadJson: safeSerializePayload({
            name: sup.name,
            phone: sup.phone,
            company: sup.company,
            payableBalance: sup.payableBalance,
            totalPurchased: sup.totalPurchased,
            ...(createdAtMillis !== undefined ? { createdAtMillis } : {}),
          }),
          deletedBy: actor,
          deletedAt: serverTimestamp(),
        },
      });
    }

    for (const tx of params.activeTransactions) {
      entries.push({
        deleteRef: doc(db, 'users', uid, 'transactions', tx.id),
        binPayload: {
          userId: uid,
          itemType: tx.type === 'EXPENSE' ? 'EXPENSE' : 'TRANSACTION',
          itemId: tx.id,
          name: (tx.title || tx.type).slice(0, 200),
          details: `Type: ${tx.type} | Amount: ৳${tx.amount} | Due: ৳${tx.dueAmount}`.slice(
            0,
            280
          ),
          payloadJson: buildTransactionRecyclePayload(tx, false),
          deletedBy: actor,
          deletedAt: serverTimestamp(),
        },
      });
    }

    for (const st of params.activeStaff) {
      const createdAtMillis = extractTimestampMillis(st.createdAt);
      entries.push({
        deleteRef: doc(db, 'users', uid, 'staff', st.id),
        binPayload: {
          userId: uid,
          itemType: 'STAFF',
          itemId: st.id,
          name: (st.name || 'Staff').slice(0, 200),
          details: `Role: ${st.role} | Phone: ${st.phone} | Salary: ৳${st.salary}`.slice(
            0,
            280
          ),
          payloadJson: safeSerializePayload({
            name: st.name,
            role: normalizeStaffRole(st.role),
            phone: st.phone,
            salary: st.salary,
            active: st.active,
            ...(createdAtMillis !== undefined ? { createdAtMillis } : {}),
          }),
          deletedBy: actor,
          deletedAt: serverTimestamp(),
        },
      });
    }

    try {
      // Each entry performs 2 Firestore writes (delete + recycle_bin set); keep batches safely below 500 ops
      const ENTRIES_PER_BATCH = 220;
      for (let i = 0; i < entries.length; i += ENTRIES_PER_BATCH) {
        const chunk = entries.slice(i, i + ENTRIES_PER_BATCH);
        const batch = writeBatch(db);
        for (const entry of chunk) {
          batch.delete(entry.deleteRef);
          const binRef = doc(collection(db, 'users', uid, 'recycle_bin'));
          batch.set(binRef, entry.binPayload);
        }
        await batch.commit();
      }
      await this.recordAuditLog(
        'Reset all store data (moved active items to Recycle Bin)',
        'Settings'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  }

  // --- Rice Catalog One-Time Initialization ---

  private static riceInitStartedForUid = new Set<string>();

  async ensureRiceCatalogProducts(): Promise<void> {
    const uid = this.requireUserId();
    if (DokanRepository.riceInitStartedForUid.has(uid)) {
      return;
    }
    DokanRepository.riceInitStartedForUid.add(uid);

    const markerRef = doc(db, 'users', uid, 'audit_logs', 'init_rice_catalog_v1');
    try {
      const markerSnap = await getDoc(markerRef);
      if (markerSnap.exists()) {
        return;
      }

      const existingSnaps = await getDocs(
        query(collection(db, 'users', uid, 'products'), where('userId', '==', uid))
      );
      const existingIds = new Set<string>();
      const existingNames = new Set<string>();
      existingSnaps.docs.forEach((d) => {
        existingIds.add(d.id);
        const name = String(d.data().name ?? '').trim().toLowerCase();
        if (name) existingNames.add(name);
      });

      const riceVarieties: Array<{
        id: string;
        name: string;
        matchTerms: string[];
        buyPrice: number;
        sellPrice: number;
        quality: string;
        note: string;
      }> = [
        {
          id: 'rice_nazirshail',
          name: 'নাজিরশাইল চাল (Nazirshail Rice)',
          matchTerms: ['নাজিরশাইল', 'nazirshail'],
          buyPrice: 74,
          sellPrice: 82,
          quality: 'Premium',
          note: 'সরু ও উন্নতমানের নাজিরশাইল চাল',
        },
        {
          id: 'rice_jirashail',
          name: 'জিরাশাইল চাল (Jirashail Rice)',
          matchTerms: ['জিরাশাইল', 'jirashail'],
          buyPrice: 70,
          sellPrice: 78,
          quality: 'Premium',
          note: 'চিকন ও জনপ্রিয় জিরাশাইল চাল',
        },
        {
          id: 'rice_miniket',
          name: 'মিনিকেট চাল (Miniket Rice)',
          matchTerms: ['মিনিকেট', 'miniket'],
          buyPrice: 68,
          sellPrice: 75,
          quality: 'Premium',
          note: 'সাদা ও চিকন মিনিকেট চাল',
        },
        {
          id: 'rice_chinigura',
          name: 'চিনিগুড়া চাল (Chinigura Rice)',
          matchTerms: ['চিনিগুড়া', 'চিনিগুড়া', 'chinigura'],
          buyPrice: 132,
          sellPrice: 148,
          quality: 'Premium',
          note: 'পোলাও ও পায়েসের সুগন্ধি চিনিগুড়া চাল',
        },
        {
          id: 'rice_basmati',
          name: 'বাসমতি চাল (Basmati Rice)',
          matchTerms: ['বাসমতি', 'basmati'],
          buyPrice: 205,
          sellPrice: 230,
          quality: 'Imported',
          note: 'বিরিয়ানি ও কাচ্চির লম্বা দানা বাসমতি চাল',
        },
        {
          id: 'rice_kataribhog',
          name: 'কাটারিভোগ চাল (Kataribhog Rice)',
          matchTerms: ['কাটারিভোগ', 'kataribhog'],
          buyPrice: 74,
          sellPrice: 82,
          quality: 'Grade A',
          note: 'দিনাজপুরের বিখ্যাত কাটারিভোগ চাল',
        },
        {
          id: 'rice_kalijira',
          name: 'কালিজিরা চাল (Kalijira Rice)',
          matchTerms: ['কালিজিরা', 'kalijira'],
          buyPrice: 138,
          sellPrice: 155,
          quality: 'Premium',
          note: 'ছোট দানা সুগন্ধি কালিজিরা পোলাও চাল',
        },
        {
          id: 'rice_br28',
          name: 'বিআর-২৮ চাল (BR-28 Rice)',
          matchTerms: ['বিআর-২৮', 'বিআর ২৮', 'br-28', 'br28'],
          buyPrice: 56,
          sellPrice: 63,
          quality: 'Standard',
          note: 'প্রতিদিনের খাবারের মাঝারি দানা বিআর-২৮ চাল',
        },
        {
          id: 'rice_br29',
          name: 'বিআর-২৯ চাল (BR-29 Rice)',
          matchTerms: ['বিআর-২৯', 'বিআর ২৯', 'br-29', 'br29'],
          buyPrice: 55,
          sellPrice: 62,
          quality: 'Standard',
          note: 'প্রতিদিনের ভাতের মাঝারি দানা বিআর-২৯ চাল',
        },
        {
          id: 'rice_paijam',
          name: 'পাইজাম চাল (Paijam Rice)',
          matchTerms: ['পাইজাম', 'paijam'],
          buyPrice: 57,
          sellPrice: 64,
          quality: 'Standard',
          note: 'নরম ভাতের জনপ্রিয় পাইজাম চাল',
        },
        {
          id: 'rice_swarna',
          name: 'স্বর্ণা চাল (Swarna Rice)',
          matchTerms: ['স্বর্ণা', 'swarna'],
          buyPrice: 50,
          sellPrice: 56,
          quality: 'Regular',
          note: 'সাশ্রয়ী মোটা দানা স্বর্ণা চাল',
        },
        {
          id: 'rice_atap',
          name: 'আতপ চাল (Atap Rice)',
          matchTerms: ['আতপ', 'atap'],
          buyPrice: 60,
          sellPrice: 68,
          quality: 'Local',
          note: 'পিঠা, পায়েস ও খিচুড়ির সাদা আতপ চাল',
        },
        {
          id: 'rice_lal_chal',
          name: 'লাল চাল (Red Rice)',
          matchTerms: ['লাল চাল', 'red rice'],
          buyPrice: 78,
          sellPrice: 88,
          quality: 'Local',
          note: 'পুষ্টিকর ঢেঁকিছাঁটা লাল চাল',
        },
        {
          id: 'rice_tulshimala',
          name: 'তুলশীমালা চাল (Tulshimala Rice)',
          matchTerms: ['তুলশীমালা', 'তুলসিমালা', 'tulshimala'],
          buyPrice: 128,
          sellPrice: 142,
          quality: 'Premium',
          note: 'সুগন্ধি তুলশীমালা পোলাও চাল',
        },
        {
          id: 'rice_siddho',
          name: 'সিদ্ধ চাল (Parboiled Rice)',
          matchTerms: ['সিদ্ধ চাল', 'parboiled'],
          buyPrice: 52,
          sellPrice: 58,
          quality: 'Regular',
          note: 'সাধারণ সিদ্ধ মোটা চাল',
        },
      ];

      const batch = writeBatch(db);
      const baseMs = Date.now() - 60000;
      let addedCount = 0;

      riceVarieties.forEach((rice, index) => {
        if (existingIds.has(rice.id)) return;
        const alreadyExists = Array.from(existingNames).some((existingName) =>
          rice.matchTerms.some((term) => existingName.includes(term))
        );
        if (alreadyExists) return;

        const prodRef = doc(db, 'users', uid, 'products', rice.id);
        saveProductExtras(prodRef.id, rice.quality, rice.note);
        batch.set(prodRef, {
          userId: uid,
          name: rice.name.slice(0, 120),
          category: 'Grains & Rice',
          unit: 'kg',
          buyPrice: rice.buyPrice,
          sellPrice: rice.sellPrice,
          stock: 0,
          lowStockThreshold: 10,
          barcode: '',
          quality: rice.quality,
          note: rice.note,
          createdAt: Timestamp.fromMillis(baseMs + index * 1000),
          updatedAt: serverTimestamp(),
        });
        addedCount += 1;
      });

      batch.set(markerRef, {
        userId: uid,
        actorName: this.currentActorName().slice(0, 100),
        action:
          addedCount > 0
            ? `Added ${addedCount} rice varieties to products`
            : 'Verified rice varieties catalog',
        module: 'Inventory',
        createdAt: serverTimestamp(),
      });

      await batch.commit();
    } catch {
      // Allow retry on next session if offline or transient failure
      DokanRepository.riceInitStartedForUid.delete(uid);
    }
  }
}
