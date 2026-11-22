# Siaam Store — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Unmatched paths in `/databases/{database}/documents/{document=**}` are unconditionally denied.
2. **Zero-Trust Verified Auth & Registered Store Membership**: Every entity under `/users/{userId}/...` requires `request.auth != null && request.auth.token.email_verified == true`. Access to `/users/siaam_store_shared/...` additionally requires the verified user's email to exist in `/siaam_store_accounts/acc_<sanitized_email>`. Unauthenticated requests and unregistered users are unconditionally denied.
3. **Strict Key Allowlists**: Every document creation enforces `hasAll` and `hasOnly` for exact schema keys, and every update enforces `affectedKeys().hasOnly(...)` along with immutable `userId` and `createdAt`.
4. **Role-Gated Account Management & Emergency Lock Protection**: In `/siaam_store_accounts/{accountId}`, verified users can read only their own document; only verified `ADMIN` accounts may list, create, update, or delete accounts. Emergency admin records (`addedBy == 'Emergency Lock'`) cannot be updated or deleted.
5. **Immutable Audit Logs**: Documents in `/users/{userId}/audit_logs/{logId}` and `/users/{userId}/recycle_bin/{binId}` cannot be updated once created (`allow update: if false`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Product**: `{ ..., "isVerified": true }` -> Rejected by `hasOnly()`.
2. **Oversized Product Name (Denial of Wallet)**: `name` with 500 chars (> 120 max) -> Rejected by `.size() <= 120`.
3. **Invalid Measurement Unit**: `unit: "gallons"` -> Rejected by `unit in ['kg', 'gm', 'pcs', 'ltr', 'box']`.
4. **Negative Stock or Price**: `buyPrice: -50` -> Rejected by `buyPrice >= 0`.
5. **Cross-Tenant UserId Spoofing**: Writing `data.userId = "victim_uid"` to `/users/siaam_store_shared/products/p1` -> Rejected by `isAuthorizedUserField`.
6. **Immutable `createdAt` Tampering on Update**: Modifying `createdAt` during product or customer update -> Rejected by `incoming().createdAt == existing().createdAt`.
7. **Audit Log Mutation**: Attempting `updateDoc` on `/users/{userId}/audit_logs/{logId}` -> Rejected by `allow update: if false`.
8. **Emergency Admin Deletion**: Attempting `deleteDoc` on an `Emergency Lock` account in `/siaam_store_accounts` -> Rejected by guard.
9. **Weak Password Injection in VaultAccount**: `password: "123"` (< 6 chars) -> Rejected by `data.password.size() >= 6`.
10. **Invalid Role Escalation in VaultAccount**: `role: "SUPER_ROOT"` -> Rejected by `data.role in ['ADMIN', 'ACCOUNT_MANAGER']`.
11. **Path ID Poisoning**: Document ID with special characters or > 128 chars -> Rejected by `isValidId()`.
12. **Future Timestamp Spoofing**: `createdAt` in the future (`> request.time`) -> Rejected by `ts <= request.time`.
