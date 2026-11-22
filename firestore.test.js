const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_store_123";
const BOB_UID = "bob_store_456";

const [emulatorHost, emulatorPortStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("Unauthenticated user: cannot read or write products", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.collection(`users/${ALICE_UID}/products`).get());
});

test("Authenticated owner: can create, read, and update valid product", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const now = new Date();
  const productRef = aliceDb.doc(`users/${ALICE_UID}/products/prod_1`);

  await assertSucceeds(
    productRef.set({
      userId: ALICE_UID,
      name: "Miniket Rice 5kg",
      category: "Grains",
      unit: "kg",
      buyPrice: 320,
      sellPrice: 360,
      stock: 50,
      lowStockThreshold: 10,
      barcode: "8901234567890",
      createdAt: now,
      updatedAt: now,
    })
  );

  await assertSucceeds(
    aliceDb.collection(`users/${ALICE_UID}/products`).where("userId", "==", ALICE_UID).get()
  );

  await assertSucceeds(
    productRef.update({
      stock: 45,
      updatedAt: now,
    })
  );
});

test("Shadow Update & Cross-User Isolation: rejects ghost fields and cross-user reads", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const now = new Date();
  const productRef = aliceDb.doc(`users/${ALICE_UID}/products/prod_2`);

  await assertSucceeds(
    productRef.set({
      userId: ALICE_UID,
      name: "Soybean Oil 1L",
      category: "Grocery",
      unit: "ltr",
      buyPrice: 150,
      sellPrice: 170,
      stock: 20,
      lowStockThreshold: 5,
      barcode: "8909876543210",
      createdAt: now,
      updatedAt: now,
    })
  );

  // Reject ghost field
  await assertFails(
    productRef.update({
      stock: 19,
      isVerified: true,
      updatedAt: now,
    })
  );

  // Reject cross-user access
  await assertFails(bobDb.doc(`users/${ALICE_UID}/products/prod_2`).get());
  await assertFails(
    bobDb.collection(`users/${ALICE_UID}/products`).where("userId", "==", ALICE_UID).get()
  );
});

test("Authenticated owner: can create customer, transaction, supplier, staff, audit log, and vault_account", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const now = new Date();

  await assertSucceeds(
    aliceDb.doc(`users/${ALICE_UID}/customers/cust_1`).set({
      userId: ALICE_UID,
      name: "Rahim Uddin",
      phone: "01711223344",
      address: "Dhanmondi, Dhaka",
      totalDue: 450,
      totalPurchased: 1450,
      totalPaid: 1000,
      createdAt: now,
      updatedAt: now,
    })
  );

  await assertSucceeds(
    aliceDb.doc(`users/${ALICE_UID}/transactions/tx_1`).set({
      userId: ALICE_UID,
      type: "SALE",
      title: "Miniket Rice x2",
      amount: 720,
      paidAmount: 500,
      dueAmount: 220,
      profitAmount: 80,
      customerId: "cust_1",
      customerName: "Rahim Uddin",
      supplierId: "",
      supplierName: "",
      productId: "prod_1",
      category: "Retail Sale",
      notes: "2x Miniket Rice 5kg",
      createdAt: now,
      updatedAt: now,
    })
  );

  await assertSucceeds(
    aliceDb.doc(`users/${ALICE_UID}/suppliers/sup_1`).set({
      userId: ALICE_UID,
      name: "Karim Traders",
      phone: "01811223344",
      company: "Meghna Group",
      payableBalance: 5000,
      totalPurchased: 25000,
      createdAt: now,
      updatedAt: now,
    })
  );

  await assertSucceeds(
    aliceDb.doc(`users/${ALICE_UID}/staff/staff_1`).set({
      userId: ALICE_UID,
      name: "Hasan Ali",
      role: "Cashier",
      phone: "01911223344",
      salary: 12000,
      active: true,
      createdAt: now,
      updatedAt: now,
    })
  );

  const auditRef = aliceDb.doc(`users/${ALICE_UID}/audit_logs/log_1`);
  await assertSucceeds(
    auditRef.set({
      userId: ALICE_UID,
      actorName: "Owner",
      action: "Added product Miniket Rice 5kg",
      module: "Inventory",
      createdAt: now,
    })
  );

  // Audit logs are immutable
  await assertFails(auditRef.delete());

  // VaultAccount sync test
  const vaultAccRef = aliceDb.doc(`users/${ALICE_UID}/vault_accounts/acc_test_admin_example_com`);
  await assertSucceeds(
    vaultAccRef.set({
      userId: ALICE_UID,
      name: "Test Admin",
      email: "test-admin@example.com",
      password: "TestPass123!",
      role: "ADMIN",
      addedBy: "System Default",
      createdAt: now,
      updatedAt: now,
    })
  );

  await assertSucceeds(
    vaultAccRef.update({
      password: "UpdatedPass456!",
      addedBy: "Reset via Forgot Password",
      updatedAt: now,
    })
  );

  await assertFails(bobDb.doc(`users/${ALICE_UID}/vault_accounts/acc_test_admin_example_com`).get());

  // Unauthenticated users must NEVER be able to read or write shared store accounts or shared store data
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.collection("siaam_store_accounts").get());
  await assertFails(
    unauthDb.doc("siaam_store_accounts/acc_test_admin_example_com").set({
      userId: "siaam_store_shared",
      name: "Unauthorized Attacker",
      email: "attacker@example.com",
      password: "AttackPass999!",
      role: "ADMIN",
      addedBy: "Attacker",
      createdAt: now,
      updatedAt: now,
    })
  );
  await assertFails(
    unauthDb.collection("users/siaam_store_shared/products").where("userId", "==", "siaam_store_shared").get()
  );
});
