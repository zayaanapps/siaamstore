/**
 * Phase 0 Security Rules Specification Verification Suite
 * Documents and verifies all "Dirty Dozen" adversarial payloads defined in security_spec.md
 * against the constraints enforced in firestore.rules.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'delete';
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Product',
    collectionPath: '/users/siaam_store_shared/products/prod_1',
    operation: 'create',
    payload: {
      userId: 'siaam_store_shared',
      name: 'Miniket Rice',
      category: 'Rice',
      unit: 'kg',
      buyPrice: 60,
      sellPrice: 70,
      stock: 50,
      lowStockThreshold: 10,
      barcode: '890101',
      isVerified: true
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 2,
    name: 'Oversized Product Name (>120 chars)',
    collectionPath: '/users/siaam_store_shared/products/prod_2',
    operation: 'create',
    payload: {
      userId: 'siaam_store_shared',
      name: 'A'.repeat(150),
      category: 'Rice',
      unit: 'kg',
      buyPrice: 60,
      sellPrice: 70,
      stock: 50,
      lowStockThreshold: 10,
      barcode: '890101'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 3,
    name: 'Invalid Measurement Unit',
    collectionPath: '/users/siaam_store_shared/products/prod_3',
    operation: 'create',
    payload: {
      userId: 'siaam_store_shared',
      name: 'Soybean Oil',
      category: 'Oil',
      unit: 'gallons',
      buyPrice: 300,
      sellPrice: 330,
      stock: 10,
      lowStockThreshold: 5,
      barcode: '890102'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 4,
    name: 'Negative Buy Price',
    collectionPath: '/users/siaam_store_shared/products/prod_4',
    operation: 'create',
    payload: {
      userId: 'siaam_store_shared',
      name: 'Sugar',
      category: 'Grocery',
      unit: 'kg',
      buyPrice: -50,
      sellPrice: 130,
      stock: 10,
      lowStockThreshold: 5,
      barcode: '890103'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 5,
    name: 'Cross-Tenant UserId Spoofing',
    collectionPath: '/users/siaam_store_shared/products/prod_5',
    operation: 'create',
    payload: {
      userId: 'other_user_uid',
      name: 'Sugar',
      category: 'Grocery',
      unit: 'kg',
      buyPrice: 110,
      sellPrice: 130,
      stock: 10,
      lowStockThreshold: 5,
      barcode: '890103'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 6,
    name: 'Immutable createdAt Tampering on Update',
    collectionPath: '/users/siaam_store_shared/customers/cust_1',
    operation: 'update',
    payload: {
      createdAt: '2020-01-01T00:00:00Z'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 7,
    name: 'Audit Log Mutation Attempt',
    collectionPath: '/users/siaam_store_shared/audit_logs/log_1',
    operation: 'update',
    payload: {
      action: 'Tampered audit log'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 8,
    name: 'Locked Emergency Admin Deletion Attempt',
    collectionPath: '/siaam_store_accounts/acc_emergency_admin_example_com',
    operation: 'delete',
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 9,
    name: 'Weak Vault Account Password (<6 chars)',
    collectionPath: '/siaam_store_accounts/acc_weak_user',
    operation: 'create',
    payload: {
      userId: 'siaam_store_shared',
      name: 'Weak User',
      email: 'weak@example.com',
      password: '123',
      role: 'ACCOUNT_MANAGER',
      addedBy: 'Admin'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 10,
    name: 'Invalid Role Escalation in VaultAccount',
    collectionPath: '/siaam_store_accounts/acc_escalated_user',
    operation: 'create',
    payload: {
      userId: 'siaam_store_shared',
      name: 'Escalated',
      email: 'root@example.com',
      password: 'TestPassword99!',
      role: 'SUPER_ROOT',
      addedBy: 'Admin'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 11,
    name: 'Path ID Poisoning',
    collectionPath: '/users/siaam_store_shared/products/invalid$id!@#',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED'
  },
  {
    id: 12,
    name: 'Future Timestamp Spoofing',
    collectionPath: '/users/siaam_store_shared/audit_logs/log_future',
    operation: 'create',
    payload: {
      userId: 'siaam_store_shared',
      actorName: 'Attacker',
      action: 'Future timestamp',
      module: 'POS',
      createdAt: '2099-01-01T00:00:00Z'
    },
    expectedOutcome: 'PERMISSION_DENIED'
  }
];
