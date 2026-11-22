package com.example.data.repository

import android.content.Context
import com.example.R
import com.example.data.model.AuditLog
import com.example.data.model.CartItem
import com.example.data.model.Customer
import com.example.data.model.Product
import com.example.data.model.RecycleBinItem
import com.example.data.model.SaleLineItem
import com.example.data.model.StaffMember
import com.example.data.model.StoreTransaction
import com.example.data.model.Supplier
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.auth.auth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await

class DokanRepository(
    private val db: FirebaseFirestore,
    private val vaultSessionActorEmail: String? = null
) {

    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(
            context.applicationContext.getString(R.string.firestore_database_id)
        ),
        null
    )

    private val auth = Firebase.auth

    private val useLocalVaultStore: Boolean
        get() = false

    private fun requireUserId(): String {
        return vaultSessionActorEmail?.takeIf { it.isNotBlank() }?.let { "siaam_store_shared" }
            ?: auth.currentUser?.uid
            ?: throw IllegalStateException("User must be signed in before accessing Firestore.")
    }

    private fun currentActorName(): String {
        return auth.currentUser?.displayName?.takeIf { it.isNotBlank() }
            ?: auth.currentUser?.email?.substringBefore("@")?.takeIf { it.isNotBlank() }
            ?: vaultSessionActorEmail?.substringBefore("@")?.takeIf { it.isNotBlank() }
            ?: "Store Admin"
    }

    companion object {
        var hasBeenResetByUser: Boolean = false
    }

    private var syncedUidOnce: String? = null

    private suspend fun syncLocalFallbackToCloudIfNeeded(uid: String) {
        if (hasBeenResetByUser) return
        if (syncedUidOnce == uid) return
        syncedUidOnce = uid
    }

    // --- Real-time Observers ---

    fun observeProducts(): Flow<List<Product>> = flow {
        if (useLocalVaultStore) {
            emitAll(LocalVaultStoreFallback.products)
            return@flow
        }
        val uid = requireUserId()
        syncLocalFallbackToCloudIfNeeded(uid)
        val path = "users/$uid/products"
        val cloudFlow = db.collection("users").document(uid).collection("products")
            .whereEqualTo("userId", uid)
            .snapshots()
            .map { snapshot ->
                snapshot.toObjects(Product::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
            }
            .catch { error ->
                logStreamError(error, uid, path)
                throw error
            }

        emitAll(
            combine(cloudFlow, LocalVaultStoreFallback.resetFilterState) { list, filterState ->
                list.filter { filterState.isAllowed(it.id) }
                    .sortedBy { it.name.lowercase() }
                    .also { LocalVaultStoreFallback.mirrorProducts(it) }
            }
        )
    }

    fun observeCustomers(): Flow<List<Customer>> = flow {
        if (useLocalVaultStore) {
            emitAll(LocalVaultStoreFallback.customers)
            return@flow
        }
        val uid = requireUserId()
        val path = "users/$uid/customers"
        val cloudFlow = db.collection("users").document(uid).collection("customers")
            .whereEqualTo("userId", uid)
            .snapshots()
            .map { snapshot ->
                snapshot.toObjects(Customer::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
            }
            .catch { error ->
                logStreamError(error, uid, path)
                throw error
            }

        emitAll(
            combine(cloudFlow, LocalVaultStoreFallback.resetFilterState) { list, filterState ->
                list.filter { filterState.isAllowed(it.id) }
                    .sortedByDescending { it.totalDue }
                    .also { LocalVaultStoreFallback.mirrorCustomers(it) }
            }
        )
    }

    fun observeTransactions(): Flow<List<StoreTransaction>> = flow {
        if (useLocalVaultStore) {
            emitAll(LocalVaultStoreFallback.transactions)
            return@flow
        }
        val uid = requireUserId()
        val path = "users/$uid/transactions"
        val cloudFlow = db.collection("users").document(uid).collection("transactions")
            .whereEqualTo("userId", uid)
            .snapshots()
            .map { snapshot ->
                snapshot.toObjects(StoreTransaction::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
            }
            .catch { error ->
                logStreamError(error, uid, path)
                throw error
            }

        emitAll(
            combine(cloudFlow, LocalVaultStoreFallback.resetFilterState) { list, filterState ->
                list.filter { filterState.isAllowed(it.id) }
                    .sortedByDescending { it.createdAt ?: Timestamp(0, 0) }
                    .also { LocalVaultStoreFallback.mirrorTransactions(it) }
            }
        )
    }

    fun observeSuppliers(): Flow<List<Supplier>> = flow {
        if (useLocalVaultStore) {
            emitAll(LocalVaultStoreFallback.suppliers)
            return@flow
        }
        val uid = requireUserId()
        val path = "users/$uid/suppliers"
        val cloudFlow = db.collection("users").document(uid).collection("suppliers")
            .whereEqualTo("userId", uid)
            .snapshots()
            .map { snapshot ->
                snapshot.toObjects(Supplier::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
            }
            .catch { error ->
                logStreamError(error, uid, path)
                throw error
            }

        emitAll(
            combine(cloudFlow, LocalVaultStoreFallback.resetFilterState) { list, filterState ->
                list.filter { filterState.isAllowed(it.id) }
                    .sortedByDescending { it.payableBalance }
                    .also { LocalVaultStoreFallback.mirrorSuppliers(it) }
            }
        )
    }

    fun observeStaff(): Flow<List<StaffMember>> = flow {
        if (useLocalVaultStore) {
            emitAll(LocalVaultStoreFallback.staff)
            return@flow
        }
        val uid = requireUserId()
        val path = "users/$uid/staff"
        val cloudFlow = db.collection("users").document(uid).collection("staff")
            .whereEqualTo("userId", uid)
            .snapshots()
            .map { snapshot ->
                snapshot.toObjects(StaffMember::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
            }
            .catch { error ->
                logStreamError(error, uid, path)
                throw error
            }

        emitAll(
            combine(cloudFlow, LocalVaultStoreFallback.resetFilterState) { list, filterState ->
                list.filter { filterState.isAllowed(it.id) }
                    .sortedBy { it.name.lowercase() }
                    .also { LocalVaultStoreFallback.mirrorStaff(it) }
            }
        )
    }

    fun observeAuditLogs(): Flow<List<AuditLog>> = flow {
        if (useLocalVaultStore) {
            emitAll(LocalVaultStoreFallback.auditLogs)
            return@flow
        }
        val uid = requireUserId()
        val path = "users/$uid/audit_logs"
        try {
            emitAll(
                db.collection("users").document(uid).collection("audit_logs")
                    .whereEqualTo("userId", uid)
                    .snapshots()
                    .map { snapshot ->
                        val cloudLogs = snapshot.toObjects(AuditLog::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.createdAt ?: Timestamp(0, 0) }
                        if (cloudLogs.isNotEmpty()) {
                            LocalVaultStoreFallback.mirrorAuditLogs(cloudLogs)
                            cloudLogs
                        } else {
                            LocalVaultStoreFallback.auditLogs.value
                        }
                    }
                    .catch { error ->
                        logStreamError(error, uid, path)
                        emitAll(LocalVaultStoreFallback.auditLogs)
                    }
            )
        } catch (_: Exception) {
            emitAll(LocalVaultStoreFallback.auditLogs)
        }
    }

    fun observeRecycleBin(): Flow<List<RecycleBinItem>> = flow {
        if (useLocalVaultStore) {
            emitAll(LocalVaultStoreFallback.recycleBin)
            return@flow
        }
        val uid = requireUserId()
        val path = "users/$uid/recycle_bin"
        val cloudFlow = db.collection("users").document(uid).collection("recycle_bin")
            .whereEqualTo("userId", uid)
            .snapshots()
            .map { snapshot ->
                snapshot.toObjects(RecycleBinItem::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
            }
            .catch { error ->
                logStreamError(error, uid, path)
                emit(emptyList())
            }

        emitAll(
            combine(cloudFlow, LocalVaultStoreFallback.recycleBin) { cloudItems, localItems ->
                (cloudItems + localItems)
                    .distinctBy { it.itemId.ifBlank { it.id } }
                    .sortedByDescending { it.deletedAt ?: Timestamp(0, 0) }
            }
        )
    }

    private fun logStreamError(error: Throwable, uid: String, path: String) {
        val firestoreError = generateSequence(error) { it.cause }
            .filterIsInstance<FirebaseFirestoreException>()
            .firstOrNull()
        if (firestoreError == null && error is CancellationException) throw error
        val exceptionToLog = firestoreError ?: (error as? Exception)
        if (exceptionToLog != null && auth.currentUser?.uid == uid) {
            handleFirestoreError(exceptionToLog, OperationType.LIST, path)
        }
    }

    // --- Products CRUD & Stock Adjustment ---

    private fun normalizeFirestoreUnit(rawUnit: String): String {
        return when (rawUnit.trim().lowercase()) {
            "g", "gm", "gram" -> "gm"
            "kg", "kilogram" -> "kg"
            "l", "ltr", "liter", "ml" -> "ltr"
            "box", "carton", "pack" -> "box"
            "pcs", "pc", "piece" -> "pcs"
            else -> "kg"
        }
    }

    suspend fun addProduct(
        name: String,
        category: String,
        unit: String,
        buyPrice: Double,
        sellPrice: Double,
        initialStock: Double,
        lowStockThreshold: Double,
        barcode: String
    ): Result<String> = runCatching {
        val cleanUnit = normalizeFirestoreUnit(unit)
        val cleanStock = initialStock.coerceAtLeast(0.0)
        if (useLocalVaultStore) {
            return@runCatching LocalVaultStoreFallback.addProduct(
                name, category, cleanUnit, buyPrice, sellPrice, cleanStock, lowStockThreshold, barcode, currentActorName()
            )
        }
        val uid = requireUserId()
        val docRef = db.collection("users").document(uid).collection("products").document()
        val payload = mapOf(
            "userId" to uid,
            "name" to name.trim().take(120),
            "category" to category.trim().ifBlank { "General" }.take(60),
            "unit" to cleanUnit,
            "buyPrice" to buyPrice.coerceAtLeast(0.0),
            "sellPrice" to sellPrice.coerceAtLeast(0.0),
            "stock" to cleanStock,
            "lowStockThreshold" to lowStockThreshold.coerceAtLeast(0.0),
            "barcode" to barcode.trim().take(64),
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp()
        )
        try {
            val batch = db.batch()
            LocalVaultStoreFallback.registerCreatedId(docRef.id)
            batch.set(docRef, payload)
            if (cleanStock > 0.0) {
                val txRef = db.collection("users").document(uid).collection("transactions").document()
                LocalVaultStoreFallback.registerCreatedId(txRef.id)
                batch.set(
                    txRef,
                    mapOf(
                        "userId" to uid,
                        "type" to "STOCK_ADJUST",
                        "title" to "Opening stock",
                        "amount" to cleanStock,
                        "paidAmount" to 0.0,
                        "dueAmount" to 0.0,
                        "profitAmount" to 0.0,
                        "customerId" to "",
                        "customerName" to "",
                        "supplierId" to "",
                        "supplierName" to "",
                        "productId" to docRef.id,
                        "category" to "Opening Stock",
                        "notes" to "DELTA:+${formatQty(cleanStock)}|REASON:Opening stock".take(300),
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
            }
            batch.commit().await()
            recordAuditLog("Added product ${name.trim()} ($cleanStock $cleanUnit)", "Inventory")
            docRef.id
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docRef.path)
            throw e
        }
    }

    suspend fun updateProduct(
        product: Product,
        name: String,
        category: String,
        unit: String,
        buyPrice: Double,
        sellPrice: Double,
        stock: Double,
        lowStockThreshold: Double,
        barcode: String
    ): Result<Unit> = runCatching {
        val cleanUnit = normalizeFirestoreUnit(unit)
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.updateProduct(
                product = product,
                name = name,
                category = category,
                unit = cleanUnit,
                buyPrice = buyPrice,
                sellPrice = sellPrice,
                stock = stock,
                lowStockThreshold = lowStockThreshold,
                barcode = barcode,
                actorName = currentActorName()
            )
            return@runCatching
        }
        val uid = requireUserId()
        require(product.id.isNotBlank()) { "Product ID must not be blank" }
        val prodRef = db.collection("users").document(uid).collection("products").document(product.id)
        val updates = mapOf(
            "name" to name.trim().ifBlank { product.name }.take(120),
            "category" to category.trim().ifBlank { "General" }.take(60),
            "unit" to cleanUnit,
            "buyPrice" to buyPrice.coerceAtLeast(0.0),
            "sellPrice" to sellPrice.coerceAtLeast(0.0),
            "stock" to stock.coerceAtLeast(0.0),
            "lowStockThreshold" to lowStockThreshold.coerceAtLeast(0.0),
            "barcode" to barcode.trim().take(64),
            "updatedAt" to FieldValue.serverTimestamp()
        )
        try {
            prodRef.update(updates).await()
            recordAuditLog("Updated product ${name.trim()}", "Inventory")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, prodRef.path)
            throw e
        }
    }

    suspend fun adjustProductStock(
        product: Product,
        delta: Double,
        reason: String
    ): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.adjustProductStock(product, delta, reason, currentActorName())
            return@runCatching
        }
        val uid = requireUserId()
        require(product.id.isNotBlank()) { "Product ID must not be blank" }
        val newStock = (product.stock + delta).coerceAtLeast(0.0)
        val prodRef = db.collection("users").document(uid).collection("products").document(product.id)
        val txRef = db.collection("users").document(uid).collection("transactions").document()

        val cleanTitle = when {
            reason.contains("REASON:Damaged", ignoreCase = true) || reason.startsWith("Damaged", ignoreCase = true) -> "Damaged / lost"
            reason.contains("REASON:Removed", ignoreCase = true) || reason.startsWith("Removed", ignoreCase = true) -> "Removed stock"
            reason.contains("REASON:Opening", ignoreCase = true) || reason.startsWith("Opening", ignoreCase = true) -> "Opening stock"
            delta >= 0 -> "Added stock"
            else -> "Removed stock"
        }
        val signedDeltaStr = if (delta >= 0) "+${formatQty(delta)}" else formatQty(delta)
        val encodedNotes = if (reason.startsWith("DELTA:")) {
            reason.take(300)
        } else {
            "DELTA:$signedDeltaStr|${reason.trim().ifBlank { cleanTitle }}".take(300)
        }

        try {
            LocalVaultStoreFallback.registerCreatedId(txRef.id)
            val batch = db.batch()
            batch.update(
                prodRef,
                mapOf(
                    "stock" to newStock,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.set(
                txRef,
                mapOf(
                    "userId" to uid,
                    "type" to "STOCK_ADJUST",
                    "title" to cleanTitle,
                    "amount" to kotlin.math.abs(delta),
                    "paidAmount" to 0.0,
                    "dueAmount" to 0.0,
                    "profitAmount" to 0.0,
                    "customerId" to "",
                    "customerName" to "",
                    "supplierId" to "",
                    "supplierName" to "",
                    "productId" to product.id,
                    "category" to if (delta >= 0) "Stock In" else "Stock Out",
                    "notes" to encodedNotes,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.commit().await()
            recordAuditLog("$cleanTitle ($signedDeltaStr ${product.unit}) for ${product.name}", "Inventory")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, prodRef.path)
            throw e
        }
    }

    suspend fun voidStockAdjustment(
        product: Product,
        transaction: StoreTransaction?,
        signedDeltaToReverse: Double
    ): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.voidStockAdjustment(
                product = product,
                transaction = transaction,
                signedDeltaToReverse = signedDeltaToReverse,
                actorName = currentActorName()
            )
            return@runCatching
        }
        val uid = requireUserId()
        require(product.id.isNotBlank()) { "Product ID must not be blank" }
        val restoredStock = (product.stock - signedDeltaToReverse).coerceAtLeast(0.0)
        val prodRef = db.collection("users").document(uid).collection("products").document(product.id)

        try {
            val batch = db.batch()
            batch.update(
                prodRef,
                mapOf(
                    "stock" to restoredStock,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            if (transaction != null && transaction.id.isNotBlank()) {
                LocalVaultStoreFallback.markIdDeleted(transaction.id)
                val txRef = db.collection("users").document(uid).collection("transactions").document(transaction.id)
                batch.delete(txRef)
            }
            batch.commit().await()
            recordAuditLog("Voided stock adjustment for ${product.name}", "Inventory")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, prodRef.path)
            throw e
        }
    }

    suspend fun deleteProduct(productId: String, productName: String): Result<Unit> = runCatching {
        LocalVaultStoreFallback.markIdDeleted(productId)
        LocalVaultStoreFallback.deleteProduct(productId, productName, currentActorName())
        if (useLocalVaultStore) {
            return@runCatching
        }
        val uid = requireUserId()
        val docRef = db.collection("users").document(uid).collection("products").document(productId)
        val binRef = db.collection("users").document(uid).collection("recycle_bin").document()
        try {
            val deleteTask = docRef.delete()
            val binTask = binRef.set(
                mapOf(
                    "userId" to uid,
                    "itemType" to "PRODUCT",
                    "itemId" to productId,
                    "name" to productName,
                    "details" to "Product: $productName",
                    "payloadJson" to "",
                    "deletedBy" to currentActorName(),
                    "deletedAt" to FieldValue.serverTimestamp()
                )
            )
            kotlinx.coroutines.withTimeoutOrNull(1800L) {
                runCatching { deleteTask.await() }
                runCatching { binTask.await() }
            }
            recordAuditLog("Deleted product $productName (moved to Recycle Bin)", "Inventory")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, docRef.path)
        }
    }

    suspend fun getProductById(productId: String): Result<Product?> = runCatching {
        if (useLocalVaultStore) {
            return@runCatching LocalVaultStoreFallback.getProductById(productId)
        }
        val uid = requireUserId()
        val docRef = db.collection("users").document(uid).collection("products").document(productId)
        try {
            docRef.get().await().toObject(Product::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.GET, docRef.path)
            throw e
        }
    }

    // --- Customers & Dues ---

    suspend fun addCustomer(
        name: String,
        phone: String,
        address: String,
        initialDue: Double = 0.0
    ): Result<String> = runCatching {
        if (useLocalVaultStore) {
            return@runCatching LocalVaultStoreFallback.addCustomer(name, phone, address, initialDue, currentActorName())
        }
        val uid = requireUserId()
        val docRef = db.collection("users").document(uid).collection("customers").document()
        val cleanDue = initialDue.coerceAtLeast(0.0)
        val payload = mapOf(
            "userId" to uid,
            "name" to name.trim().take(100),
            "phone" to phone.trim().ifBlank { "—" }.take(30),
            "address" to address.trim().take(200),
            "totalDue" to cleanDue,
            "totalPurchased" to cleanDue,
            "totalPaid" to 0.0,
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp()
        )
        try {
            LocalVaultStoreFallback.registerCreatedId(docRef.id)
            docRef.set(payload).await()
            if (cleanDue > 0.0) {
                val txRef = db.collection("users").document(uid).collection("transactions").document()
                LocalVaultStoreFallback.registerCreatedId(txRef.id)
                txRef.set(
                    mapOf(
                        "userId" to uid,
                        "type" to "GIVE_DUE",
                        "title" to "Opening Due - ${name.trim()}",
                        "amount" to cleanDue,
                        "paidAmount" to 0.0,
                        "dueAmount" to cleanDue,
                        "profitAmount" to 0.0,
                        "customerId" to docRef.id,
                        "customerName" to name.trim().take(100),
                        "supplierId" to "",
                        "supplierName" to "",
                        "productId" to "",
                        "category" to "Customer Due",
                        "notes" to "Initial opening due balance",
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            }
            recordAuditLog("Added customer ${name.trim()}", "Customers")
            docRef.id
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docRef.path)
            throw e
        }
    }

    suspend fun updateCustomer(
        customer: Customer,
        name: String,
        phone: String,
        address: String
    ): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.updateCustomer(customer, name, phone, address, currentActorName())
            return@runCatching
        }
        val uid = requireUserId()
        require(customer.id.isNotBlank()) { "Customer ID must not be blank" }
        val custRef = db.collection("users").document(uid).collection("customers").document(customer.id)
        val updates = mapOf(
            "name" to name.trim().ifBlank { customer.name }.take(100),
            "phone" to phone.trim().ifBlank { "—" }.take(30),
            "address" to address.trim().take(200),
            "updatedAt" to FieldValue.serverTimestamp()
        )
        try {
            custRef.update(updates).await()
            recordAuditLog("Updated customer ${name.trim()}", "Customers")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, custRef.path)
            throw e
        }
    }

    suspend fun deleteCustomer(
        customerId: String,
        customerName: String
    ): Result<Unit> = runCatching {
        LocalVaultStoreFallback.markIdDeleted(customerId)
        LocalVaultStoreFallback.deleteCustomer(customerId, customerName, currentActorName())
        if (useLocalVaultStore) {
            return@runCatching
        }
        val uid = requireUserId()
        val docRef = db.collection("users").document(uid).collection("customers").document(customerId)
        val binRef = db.collection("users").document(uid).collection("recycle_bin").document()
        try {
            val deleteTask = docRef.delete()
            val binTask = binRef.set(
                mapOf(
                    "userId" to uid,
                    "itemType" to "CUSTOMER",
                    "itemId" to customerId,
                    "name" to customerName,
                    "details" to "Customer: $customerName",
                    "payloadJson" to "",
                    "deletedBy" to currentActorName(),
                    "deletedAt" to FieldValue.serverTimestamp()
                )
            )
            kotlinx.coroutines.withTimeoutOrNull(1800L) {
                runCatching { deleteTask.await() }
                runCatching { binTask.await() }
            }
            recordAuditLog("Deleted customer $customerName (moved to Recycle Bin)", "Customers")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, docRef.path)
        }
    }

    suspend fun recordCustomerDueOrPayment(
        customer: Customer,
        amount: Double,
        isGiveDue: Boolean,
        notes: String
    ): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.recordCustomerDueOrPayment(customer, amount, isGiveDue, notes, currentActorName())
            return@runCatching
        }
        val uid = requireUserId()
        val cleanAmount = amount.coerceAtLeast(0.0)
        val custRef = db.collection("users").document(uid).collection("customers").document(customer.id)
        val txRef = db.collection("users").document(uid).collection("transactions").document()

        val newDue = if (isGiveDue) customer.totalDue + cleanAmount else (customer.totalDue - cleanAmount).coerceAtLeast(0.0)
        val newPurchased = if (isGiveDue) customer.totalPurchased + cleanAmount else customer.totalPurchased
        val newPaid = if (!isGiveDue) customer.totalPaid + cleanAmount else customer.totalPaid

        try {
            LocalVaultStoreFallback.registerCreatedId(txRef.id)
            val batch = db.batch()
            batch.update(
                custRef,
                mapOf(
                    "totalDue" to newDue,
                    "totalPurchased" to newPurchased,
                    "totalPaid" to newPaid,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.set(
                txRef,
                mapOf(
                    "userId" to uid,
                    "type" to if (isGiveDue) "GIVE_DUE" else "RECEIVE_PAYMENT",
                    "title" to if (isGiveDue) "Due Given to ${customer.name}" else "Payment Received from ${customer.name}",
                    "amount" to cleanAmount,
                    "paidAmount" to if (isGiveDue) 0.0 else cleanAmount,
                    "dueAmount" to if (isGiveDue) cleanAmount else 0.0,
                    "profitAmount" to 0.0,
                    "customerId" to customer.id,
                    "customerName" to customer.name.take(100),
                    "supplierId" to "",
                    "supplierName" to "",
                    "productId" to "",
                    "category" to if (isGiveDue) "Due Given" else "Due Collection",
                    "notes" to notes.trim().ifBlank { if (isGiveDue) "Credit entry" else "Cash due collection" }.take(300),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.commit().await()
            recordAuditLog(
                if (isGiveDue) "Gave due ৳$cleanAmount to ${customer.name}" else "Received ৳$cleanAmount from ${customer.name}",
                "Customers"
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, custRef.path)
            throw e
        }
    }

    // --- POS Checkout / Sales ---

    suspend fun recordPosSale(
        cartItems: List<CartItem>,
        paidAmount: Double,
        selectedCustomer: Customer?,
        notes: String,
        discountAmount: Double = 0.0,
        newCustomerName: String = "",
        newCustomerPhone: String = "",
        newCustomerAddress: String = ""
    ): Result<StoreTransaction> = runCatching {
        require(cartItems.isNotEmpty()) { "Cart cannot be empty" }
        if (useLocalVaultStore) {
            return@runCatching LocalVaultStoreFallback.recordPosSale(
                cartItems = cartItems,
                paidAmount = paidAmount,
                selectedCustomer = selectedCustomer,
                notes = notes,
                actorName = currentActorName(),
                discountAmount = discountAmount,
                newCustomerName = newCustomerName,
                newCustomerPhone = newCustomerPhone,
                newCustomerAddress = newCustomerAddress
            )
        }
        val uid = requireUserId()

        val subtotalAmount = cartItems.sumOf { it.lineTotal }.coerceAtLeast(0.0)
        val cleanDiscount = discountAmount.coerceIn(0.0, subtotalAmount)
        val totalAmount = (subtotalAmount - cleanDiscount).coerceAtLeast(0.0)
        val totalProfit = cartItems.sumOf { it.lineProfit } - cleanDiscount
        val cleanPaid = paidAmount.coerceIn(0.0, totalAmount)
        val dueAmount = (totalAmount - cleanPaid).coerceAtLeast(0.0)

        val resolvedPhone = selectedCustomer?.phone?.takeIf { it.isNotBlank() } ?: newCustomerPhone.trim()
        val resolvedAddress = selectedCustomer?.address?.takeIf { it.isNotBlank() } ?: newCustomerAddress.trim()

        val summaryTitle = cartItems.joinToString(", ") { "${it.product.name} x${formatQty(it.quantity)}" }.take(200)
        val encodedNotes = SaleLineItem.encodeItemsAndNote(
            cartItems = cartItems,
            userNote = notes,
            customerPhone = resolvedPhone,
            customerAddress = resolvedAddress
        )

        val txRef = db.collection("users").document(uid).collection("transactions").document()
        val now = Timestamp.now()

        var resolvedCustomerId = selectedCustomer?.id ?: ""
        var resolvedCustomerName = selectedCustomer?.name?.takeIf { it.isNotBlank() }
            ?: newCustomerName.trim().takeIf { it.isNotBlank() }
            ?: "Walk-in customer"

        try {
            val batch = db.batch()
            for (item in cartItems) {
                if (item.product.id.isNotBlank()) {
                    val prodRef = db.collection("users").document(uid).collection("products").document(item.product.id)
                    val remainingStock = (item.product.stock - item.quantity).coerceAtLeast(0.0)
                    batch.update(
                        prodRef,
                        mapOf(
                            "stock" to remainingStock,
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    )
                }
            }

            if (selectedCustomer != null && selectedCustomer.id.isNotBlank()) {
                val custRef = db.collection("users").document(uid).collection("customers").document(selectedCustomer.id)
                batch.update(
                    custRef,
                    mapOf(
                        "totalDue" to (selectedCustomer.totalDue + dueAmount),
                        "totalPurchased" to (selectedCustomer.totalPurchased + totalAmount),
                        "totalPaid" to (selectedCustomer.totalPaid + cleanPaid),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
            } else if (newCustomerName.trim().isNotBlank()) {
                val newCustRef = db.collection("users").document(uid).collection("customers").document()
                LocalVaultStoreFallback.registerCreatedId(newCustRef.id)
                resolvedCustomerId = newCustRef.id
                resolvedCustomerName = newCustomerName.trim().take(100)
                batch.set(
                    newCustRef,
                    mapOf(
                        "userId" to uid,
                        "name" to resolvedCustomerName,
                        "phone" to newCustomerPhone.trim().ifBlank { "01700-000000" }.take(30),
                        "address" to newCustomerAddress.trim().take(200),
                        "totalDue" to dueAmount,
                        "totalPurchased" to totalAmount,
                        "totalPaid" to cleanPaid,
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
            }

            val txTitle = summaryTitle.ifBlank { "POS Sale" }
            val firstProdId = cartItems.firstOrNull()?.product?.id ?: ""

            LocalVaultStoreFallback.registerCreatedId(txRef.id)
            batch.set(
                txRef,
                mapOf(
                    "userId" to uid,
                    "type" to "SALE",
                    "title" to txTitle,
                    "amount" to totalAmount,
                    "paidAmount" to cleanPaid,
                    "dueAmount" to dueAmount,
                    "profitAmount" to totalProfit,
                    "customerId" to resolvedCustomerId,
                    "customerName" to resolvedCustomerName.take(100),
                    "supplierId" to "",
                    "supplierName" to "",
                    "productId" to firstProdId,
                    "category" to "POS Sale",
                    "notes" to encodedNotes,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )

            batch.commit().await()
            recordAuditLog("Recorded sale ৳$totalAmount (Paid: ৳$cleanPaid, Due: ৳$dueAmount)", "POS")
            StoreTransaction(
                id = txRef.id,
                userId = uid,
                type = "SALE",
                title = txTitle,
                amount = totalAmount,
                paidAmount = cleanPaid,
                dueAmount = dueAmount,
                profitAmount = totalProfit,
                customerId = resolvedCustomerId,
                customerName = resolvedCustomerName.take(100),
                productId = firstProdId,
                category = "POS Sale",
                notes = encodedNotes,
                createdAt = now,
                updatedAt = now
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, txRef.path)
            throw e
        }
    }

    suspend fun returnOrVoidSale(
        transaction: StoreTransaction,
        currentProducts: List<Product>,
        currentCustomers: List<Customer>,
        isReturn: Boolean
    ): Result<Unit> = runCatching {
        require(transaction.id.isNotBlank()) { "Transaction ID is required" }
        LocalVaultStoreFallback.markIdDeleted(transaction.id)
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.returnOrVoidSale(transaction, isReturn, currentActorName())
            return@runCatching
        }
        val uid = requireUserId()
        val txRef = db.collection("users").document(uid).collection("transactions").document(transaction.id)
        val lineItems = SaleLineItem.parseLineItems(transaction)

        try {
            val batch = db.batch()
            // 1. Restore stock for each sold product
            val qtyByProdId = lineItems.groupBy { it.productId }
                .mapValues { entry -> entry.value.sumOf { it.quantity } }
            for ((prodId, restoreQty) in qtyByProdId) {
                if (prodId.isNotBlank() && restoreQty > 0.0) {
                    val matchingProduct = currentProducts.firstOrNull { it.id == prodId }
                    if (matchingProduct != null) {
                        val prodRef = db.collection("users").document(uid).collection("products").document(prodId)
                        batch.update(
                            prodRef,
                            mapOf(
                                "stock" to (matchingProduct.stock + restoreQty),
                                "updatedAt" to FieldValue.serverTimestamp()
                            )
                        )
                    }
                }
            }

            // 2. Reverse customer due / purchased / paid balances if linked to a customer
            if (transaction.customerId.isNotBlank()) {
                val matchingCustomer = currentCustomers.firstOrNull { it.id == transaction.customerId }
                if (matchingCustomer != null) {
                    val custRef = db.collection("users").document(uid).collection("customers").document(matchingCustomer.id)
                    batch.update(
                        custRef,
                        mapOf(
                            "totalDue" to (matchingCustomer.totalDue - transaction.dueAmount).coerceAtLeast(0.0),
                            "totalPurchased" to (matchingCustomer.totalPurchased - transaction.amount).coerceAtLeast(0.0),
                            "totalPaid" to (matchingCustomer.totalPaid - transaction.paidAmount).coerceAtLeast(0.0),
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    )
                }
            }

            // 3. Delete the sale transaction document
            batch.delete(txRef)
            batch.commit().await()
            val actionLabel = if (isReturn) "Returned sale" else "Voided sale"
            recordAuditLog("$actionLabel (${transaction.title} • ৳${transaction.amount})", "POS")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, txRef.path)
            throw e
        }
    }

    // --- Suppliers, Purchases & Expenses ---

    suspend fun addSupplier(
        name: String,
        phone: String,
        company: String,
        initialPayable: Double = 0.0
    ): Result<String> = runCatching {
        if (useLocalVaultStore) {
            return@runCatching LocalVaultStoreFallback.addSupplier(name, phone, company, initialPayable, currentActorName())
        }
        val uid = requireUserId()
        val docRef = db.collection("users").document(uid).collection("suppliers").document()
        val cleanPayable = initialPayable.coerceAtLeast(0.0)
        val payload = mapOf(
            "userId" to uid,
            "name" to name.trim().take(100),
            "phone" to phone.trim().ifBlank { "—" }.take(30),
            "company" to company.trim().take(100),
            "payableBalance" to cleanPayable,
            "totalPurchased" to cleanPayable,
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp()
        )
        try {
            LocalVaultStoreFallback.registerCreatedId(docRef.id)
            docRef.set(payload).await()
            recordAuditLog("Added supplier ${name.trim()} (${company.trim()})", "Accounts")
            docRef.id
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docRef.path)
            throw e
        }
    }

    suspend fun updateSupplier(
        supplier: Supplier,
        name: String,
        phone: String,
        company: String
    ): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.updateSupplier(supplier, name, phone, company, currentActorName())
            return@runCatching
        }
        val uid = requireUserId()
        require(supplier.id.isNotBlank()) { "Supplier ID must not be blank" }
        val supRef = db.collection("users").document(uid).collection("suppliers").document(supplier.id)
        val updates = mapOf(
            "name" to name.trim().ifBlank { supplier.name }.take(100),
            "phone" to phone.trim().ifBlank { "—" }.take(30),
            "company" to company.trim().take(100),
            "updatedAt" to FieldValue.serverTimestamp()
        )
        try {
            supRef.update(updates).await()
            recordAuditLog("Updated supplier ${name.trim()}", "Accounts")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, supRef.path)
            throw e
        }
    }

    suspend fun deleteSupplier(
        supplierId: String,
        supplierName: String
    ): Result<Unit> = runCatching {
        LocalVaultStoreFallback.markIdDeleted(supplierId)
        LocalVaultStoreFallback.deleteSupplier(supplierId, supplierName, currentActorName())
        if (useLocalVaultStore) {
            return@runCatching
        }
        val uid = requireUserId()
        val docRef = db.collection("users").document(uid).collection("suppliers").document(supplierId)
        val binRef = db.collection("users").document(uid).collection("recycle_bin").document()
        try {
            val deleteTask = docRef.delete()
            val binTask = binRef.set(
                mapOf(
                    "userId" to uid,
                    "itemType" to "SUPPLIER",
                    "itemId" to supplierId,
                    "name" to supplierName,
                    "details" to "Supplier: $supplierName",
                    "payloadJson" to "",
                    "deletedBy" to currentActorName(),
                    "deletedAt" to FieldValue.serverTimestamp()
                )
            )
            kotlinx.coroutines.withTimeoutOrNull(1800L) {
                runCatching { deleteTask.await() }
                runCatching { binTask.await() }
            }
            recordAuditLog("Deleted supplier $supplierName (moved to Recycle Bin)", "Suppliers")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, docRef.path)
        }
    }

    suspend fun addSupplierOwed(
        supplier: Supplier,
        amount: Double,
        notes: String
    ): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.addSupplierOwed(supplier, amount, notes, currentActorName())
            return@runCatching
        }
        val uid = requireUserId()
        val cleanAmount = amount.coerceAtLeast(0.0)
        val supRef = db.collection("users").document(uid).collection("suppliers").document(supplier.id)
        val txRef = db.collection("users").document(uid).collection("transactions").document()

        try {
            LocalVaultStoreFallback.registerCreatedId(txRef.id)
            val batch = db.batch()
            batch.update(
                supRef,
                mapOf(
                    "payableBalance" to (supplier.payableBalance + cleanAmount),
                    "totalPurchased" to (supplier.totalPurchased + cleanAmount),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.set(
                txRef,
                mapOf(
                    "userId" to uid,
                    "type" to "PURCHASE",
                    "title" to "Added owed - ${supplier.name}".take(200),
                    "amount" to cleanAmount,
                    "paidAmount" to 0.0,
                    "dueAmount" to cleanAmount,
                    "profitAmount" to 0.0,
                    "customerId" to "",
                    "customerName" to "",
                    "supplierId" to supplier.id,
                    "supplierName" to supplier.name.take(100),
                    "productId" to "",
                    "category" to "Supplier Credit",
                    "notes" to notes.trim().ifBlank { "Added supplier payable" }.take(300),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.commit().await()
            recordAuditLog("Added owed ৳$cleanAmount for supplier ${supplier.name}", "Accounts")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, supRef.path)
            throw e
        }
    }

    suspend fun recordStockPurchase(
        product: Product?,
        supplier: Supplier?,
        quantity: Double,
        totalCost: Double,
        paidCash: Double,
        notes: String
    ): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.recordStockPurchase(product, supplier, quantity, totalCost, paidCash, notes, currentActorName())
            return@runCatching
        }
        val uid = requireUserId()
        val cleanCost = totalCost.coerceAtLeast(0.0)
        val cleanPaid = paidCash.coerceIn(0.0, cleanCost)
        val payableDue = (cleanCost - cleanPaid).coerceAtLeast(0.0)
        val txRef = db.collection("users").document(uid).collection("transactions").document()

        try {
            LocalVaultStoreFallback.registerCreatedId(txRef.id)
            val batch = db.batch()
            if (product != null && product.id.isNotBlank() && quantity > 0.0) {
                val prodRef = db.collection("users").document(uid).collection("products").document(product.id)
                batch.update(
                    prodRef,
                    mapOf(
                        "stock" to (product.stock + quantity),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
            }
            if (supplier != null && supplier.id.isNotBlank()) {
                val supRef = db.collection("users").document(uid).collection("suppliers").document(supplier.id)
                batch.update(
                    supRef,
                    mapOf(
                        "payableBalance" to (supplier.payableBalance + payableDue),
                        "totalPurchased" to (supplier.totalPurchased + cleanCost),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
            }
            val title = buildString {
                append("Purchase: ")
                append(product?.name ?: "Store Inventory")
                if (quantity > 0) append(" (+${formatQty(quantity)} ${product?.unit ?: "pcs"})")
            }.take(200)

            batch.set(
                txRef,
                mapOf(
                    "userId" to uid,
                    "type" to "PURCHASE",
                    "title" to title,
                    "amount" to cleanCost,
                    "paidAmount" to cleanPaid,
                    "dueAmount" to payableDue,
                    "profitAmount" to 0.0,
                    "customerId" to "",
                    "customerName" to "",
                    "supplierId" to (supplier?.id ?: ""),
                    "supplierName" to (supplier?.name ?: "No supplier").take(100),
                    "productId" to (product?.id ?: ""),
                    "category" to "Stock Purchase",
                    "notes" to notes.trim().ifBlank { "Wholesale stock purchase" }.take(300),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.commit().await()
            recordAuditLog("Recorded purchase ৳$cleanCost (${product?.name ?: "Inventory"})", "Accounts")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, txRef.path)
            throw e
        }
    }

    suspend fun recordMultiItemPurchase(
        cartItems: List<CartItem>,
        paidAmount: Double,
        selectedSupplier: Supplier?,
        newSupplierName: String,
        updateBuyingPrice: Boolean,
        notes: String
    ): Result<StoreTransaction> = runCatching {
        require(cartItems.isNotEmpty()) { "Purchase cart cannot be empty" }
        if (useLocalVaultStore) {
            return@runCatching LocalVaultStoreFallback.recordMultiItemPurchase(
                cartItems = cartItems,
                paidAmount = paidAmount,
                selectedSupplier = selectedSupplier,
                newSupplierName = newSupplierName,
                updateBuyingPrice = updateBuyingPrice,
                notes = notes,
                actorName = currentActorName()
            )
        }
        val uid = requireUserId()
        val totalCost = cartItems.sumOf { it.lineTotal }.coerceAtLeast(0.0)
        val cleanPaid = paidAmount.coerceIn(0.0, totalCost)
        val payableDue = (totalCost - cleanPaid).coerceAtLeast(0.0)
        val summaryTitle = cartItems.joinToString(", ") { "${it.product.name} x${formatQty(it.quantity)}" }
            .ifBlank { "Purchase" }
            .take(200)
        val encodedNotes = SaleLineItem.encodeItemsAndNote(
            cartItems = cartItems,
            userNote = notes
        )

        val txRef = db.collection("users").document(uid).collection("transactions").document()
        val now = Timestamp.now()

        var resolvedSupplierId = selectedSupplier?.id ?: ""
        var resolvedSupplierName = selectedSupplier?.name?.takeIf { it.isNotBlank() }
            ?: newSupplierName.trim().takeIf { it.isNotBlank() }
            ?: "No supplier"

        try {
            val batch = db.batch()
            for (item in cartItems) {
                if (item.product.id.isNotBlank()) {
                    val prodRef = db.collection("users").document(uid).collection("products").document(item.product.id)
                    val newStock = (item.product.stock + item.quantity).coerceAtLeast(0.0)
                    val prodUpdates = mutableMapOf<String, Any>(
                        "stock" to newStock,
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                    if (updateBuyingPrice) {
                        prodUpdates["buyPrice"] = item.customUnitPrice.coerceAtLeast(0.0)
                    }
                    batch.update(prodRef, prodUpdates)
                }
            }

            if (selectedSupplier != null && selectedSupplier.id.isNotBlank()) {
                val supRef = db.collection("users").document(uid).collection("suppliers").document(selectedSupplier.id)
                batch.update(
                    supRef,
                    mapOf(
                        "payableBalance" to (selectedSupplier.payableBalance + payableDue),
                        "totalPurchased" to (selectedSupplier.totalPurchased + totalCost),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
            } else if (newSupplierName.trim().isNotBlank()) {
                val newSupRef = db.collection("users").document(uid).collection("suppliers").document()
                LocalVaultStoreFallback.registerCreatedId(newSupRef.id)
                resolvedSupplierId = newSupRef.id
                resolvedSupplierName = newSupplierName.trim().take(100)
                batch.set(
                    newSupRef,
                    mapOf(
                        "userId" to uid,
                        "name" to resolvedSupplierName,
                        "phone" to "—",
                        "company" to "",
                        "payableBalance" to payableDue,
                        "totalPurchased" to totalCost,
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
            }

            val firstProdId = cartItems.firstOrNull()?.product?.id ?: ""
            LocalVaultStoreFallback.registerCreatedId(txRef.id)
            batch.set(
                txRef,
                mapOf(
                    "userId" to uid,
                    "type" to "PURCHASE",
                    "title" to summaryTitle,
                    "amount" to totalCost,
                    "paidAmount" to cleanPaid,
                    "dueAmount" to payableDue,
                    "profitAmount" to 0.0,
                    "customerId" to "",
                    "customerName" to "",
                    "supplierId" to resolvedSupplierId,
                    "supplierName" to resolvedSupplierName.take(100),
                    "productId" to firstProdId,
                    "category" to "Stock Purchase",
                    "notes" to encodedNotes,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )

            batch.commit().await()
            recordAuditLog("Recorded purchase ৳$totalCost (Paid: ৳$cleanPaid, Due: ৳$payableDue)", "Accounts")
            StoreTransaction(
                id = txRef.id,
                userId = uid,
                type = "PURCHASE",
                title = summaryTitle,
                amount = totalCost,
                paidAmount = cleanPaid,
                dueAmount = payableDue,
                profitAmount = 0.0,
                supplierId = resolvedSupplierId,
                supplierName = resolvedSupplierName.take(100),
                productId = firstProdId,
                category = "Stock Purchase",
                notes = encodedNotes,
                createdAt = now,
                updatedAt = now
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, txRef.path)
            throw e
        }
    }

    suspend fun voidPurchase(
        transaction: StoreTransaction,
        currentProducts: List<Product>,
        currentSuppliers: List<Supplier>
    ): Result<Unit> = runCatching {
        require(transaction.id.isNotBlank()) { "Transaction ID is required" }
        LocalVaultStoreFallback.markIdDeleted(transaction.id)
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.voidPurchase(transaction, currentActorName())
            return@runCatching
        }
        val uid = requireUserId()
        val txRef = db.collection("users").document(uid).collection("transactions").document(transaction.id)
        val lineItems = SaleLineItem.parseLineItems(transaction)

        try {
            val batch = db.batch()
            // 1. Deduct purchased stock from each product
            val qtyByProdId = lineItems.groupBy { it.productId }
                .mapValues { entry -> entry.value.sumOf { it.quantity } }
            for ((prodId, deductQty) in qtyByProdId) {
                if (prodId.isNotBlank() && deductQty > 0.0) {
                    val matchingProduct = currentProducts.firstOrNull { it.id == prodId }
                    if (matchingProduct != null) {
                        val prodRef = db.collection("users").document(uid).collection("products").document(prodId)
                        batch.update(
                            prodRef,
                            mapOf(
                                "stock" to (matchingProduct.stock - deductQty).coerceAtLeast(0.0),
                                "updatedAt" to FieldValue.serverTimestamp()
                            )
                        )
                    }
                }
            }

            // 2. Reverse supplier payable & totalPurchased if linked to a supplier
            if (transaction.supplierId.isNotBlank() || transaction.supplierName.isNotBlank()) {
                val matchingSupplier = currentSuppliers.firstOrNull { sup ->
                    (transaction.supplierId.isNotBlank() && sup.id == transaction.supplierId) ||
                        (transaction.supplierName.isNotBlank() && sup.name.equals(transaction.supplierName, ignoreCase = true))
                }
                if (matchingSupplier != null && matchingSupplier.id.isNotBlank()) {
                    val supRef = db.collection("users").document(uid).collection("suppliers").document(matchingSupplier.id)
                    batch.update(
                        supRef,
                        mapOf(
                            "payableBalance" to (matchingSupplier.payableBalance - transaction.dueAmount).coerceAtLeast(0.0),
                            "totalPurchased" to (matchingSupplier.totalPurchased - transaction.amount).coerceAtLeast(0.0),
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    )
                }
            }

            // 3. Delete the purchase transaction document
            batch.delete(txRef)
            batch.commit().await()
            recordAuditLog("Voided purchase (${transaction.title} • ৳${transaction.amount})", "Accounts")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, txRef.path)
            throw e
        }
    }

    suspend fun paySupplier(
        supplier: Supplier,
        amount: Double,
        notes: String
    ): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.paySupplier(supplier, amount, notes, currentActorName())
            return@runCatching
        }
        val uid = requireUserId()
        val cleanAmount = amount.coerceAtLeast(0.0)
        val supRef = db.collection("users").document(uid).collection("suppliers").document(supplier.id)
        val txRef = db.collection("users").document(uid).collection("transactions").document()

        try {
            LocalVaultStoreFallback.registerCreatedId(txRef.id)
            val batch = db.batch()
            batch.update(
                supRef,
                mapOf(
                    "payableBalance" to (supplier.payableBalance - cleanAmount).coerceAtLeast(0.0),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.set(
                txRef,
                mapOf(
                    "userId" to uid,
                    "type" to "SUPPLIER_PAYMENT",
                    "title" to "Paid Supplier - ${supplier.name}",
                    "amount" to cleanAmount,
                    "paidAmount" to cleanAmount,
                    "dueAmount" to 0.0,
                    "profitAmount" to 0.0,
                    "customerId" to "",
                    "customerName" to "",
                    "supplierId" to supplier.id,
                    "supplierName" to supplier.name.take(100),
                    "productId" to "",
                    "category" to "Supplier Payment",
                    "notes" to notes.trim().ifBlank { "Supplier payable settlement" }.take(300),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.commit().await()
            recordAuditLog("Paid ৳$cleanAmount to supplier ${supplier.name}", "Accounts")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, supRef.path)
            throw e
        }
    }

    suspend fun recordExpense(
        title: String,
        category: String,
        amount: Double,
        notes: String
    ): Result<String> = runCatching {
        if (useLocalVaultStore) {
            return@runCatching LocalVaultStoreFallback.recordExpense(title, category, amount, notes, currentActorName())
        }
        val uid = requireUserId()
        val cleanAmount = amount.coerceAtLeast(0.0)
        val txRef = db.collection("users").document(uid).collection("transactions").document()
        try {
            LocalVaultStoreFallback.registerCreatedId(txRef.id)
            txRef.set(
                mapOf(
                    "userId" to uid,
                    "type" to "EXPENSE",
                    "title" to title.trim().take(200),
                    "amount" to cleanAmount,
                    "paidAmount" to cleanAmount,
                    "dueAmount" to 0.0,
                    "profitAmount" to 0.0,
                    "customerId" to "",
                    "customerName" to "",
                    "supplierId" to "",
                    "supplierName" to "",
                    "productId" to "",
                    "category" to category.trim().ifBlank { "Shop Expense" }.take(60),
                    "notes" to notes.trim().ifBlank { "Operating expense" }.take(300),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            recordAuditLog("Recorded expense: ${title.trim()} (৳$cleanAmount)", "Accounts")
            txRef.id
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, txRef.path)
            throw e
        }
    }

    suspend fun deleteExpense(
        transactionId: String,
        title: String
    ): Result<Unit> = runCatching {
        LocalVaultStoreFallback.markIdDeleted(transactionId)
        LocalVaultStoreFallback.deleteExpense(transactionId, title, currentActorName())
        if (useLocalVaultStore) {
            return@runCatching
        }
        val uid = requireUserId()
        val txRef = db.collection("users").document(uid).collection("transactions").document(transactionId)
        val binRef = db.collection("users").document(uid).collection("recycle_bin").document()
        try {
            val deleteTask = txRef.delete()
            val binTask = binRef.set(
                mapOf(
                    "userId" to uid,
                    "itemType" to "EXPENSE",
                    "itemId" to transactionId,
                    "name" to title,
                    "details" to "Expense: $title",
                    "payloadJson" to "",
                    "deletedBy" to currentActorName(),
                    "deletedAt" to FieldValue.serverTimestamp()
                )
            )
            kotlinx.coroutines.withTimeoutOrNull(1800L) {
                runCatching { deleteTask.await() }
                runCatching { binTask.await() }
            }
            recordAuditLog("Deleted expense: $title (moved to Recycle Bin)", "Accounts")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, txRef.path)
        }
    }

    suspend fun deleteTransaction(
        transaction: StoreTransaction,
        currentCustomers: List<Customer> = emptyList(),
        currentSuppliers: List<Supplier> = emptyList()
    ): Result<Unit> = runCatching {
        require(transaction.id.isNotBlank()) { "Transaction ID is required" }
        LocalVaultStoreFallback.markIdDeleted(transaction.id)
        LocalVaultStoreFallback.deleteTransaction(transaction, currentActorName())
        if (useLocalVaultStore) {
            return@runCatching
        }
        val uid = requireUserId()
        val txRef = db.collection("users").document(uid).collection("transactions").document(transaction.id)
        val binRef = db.collection("users").document(uid).collection("recycle_bin").document()

        try {
            val batch = db.batch()
            batch.delete(txRef)

            // 1. Revert customer balance if applicable
            if (transaction.customerId.isNotBlank() || transaction.customerName.isNotBlank()) {
                val matchingCustomer = currentCustomers.firstOrNull { cust ->
                    (transaction.customerId.isNotBlank() && cust.id == transaction.customerId) ||
                        (transaction.customerName.isNotBlank() && cust.name.equals(transaction.customerName, ignoreCase = true))
                }
                if (matchingCustomer != null && matchingCustomer.id.isNotBlank()) {
                    val custRef = db.collection("users").document(uid).collection("customers").document(matchingCustomer.id)
                    when (transaction.type) {
                        "GIVE_DUE" -> {
                            batch.update(
                                custRef,
                                mapOf(
                                    "totalDue" to (matchingCustomer.totalDue - transaction.dueAmount).coerceAtLeast(0.0),
                                    "totalPurchased" to (matchingCustomer.totalPurchased - transaction.amount).coerceAtLeast(0.0),
                                    "updatedAt" to FieldValue.serverTimestamp()
                                )
                            )
                        }
                        "RECEIVE_PAYMENT" -> {
                            batch.update(
                                custRef,
                                mapOf(
                                    "totalDue" to (matchingCustomer.totalDue + transaction.amount),
                                    "totalPaid" to (matchingCustomer.totalPaid - transaction.amount).coerceAtLeast(0.0),
                                    "updatedAt" to FieldValue.serverTimestamp()
                                )
                            )
                        }
                        "SALE" -> {
                            batch.update(
                                custRef,
                                mapOf(
                                    "totalDue" to (matchingCustomer.totalDue - transaction.dueAmount).coerceAtLeast(0.0),
                                    "totalPurchased" to (matchingCustomer.totalPurchased - transaction.amount).coerceAtLeast(0.0),
                                    "totalPaid" to (matchingCustomer.totalPaid - transaction.paidAmount).coerceAtLeast(0.0),
                                    "updatedAt" to FieldValue.serverTimestamp()
                                )
                            )
                        }
                    }
                }
            }

            // 2. Revert supplier balance if applicable
            if ((transaction.type == "SUPPLIER_PAYMENT" || transaction.type == "PURCHASE") &&
                (transaction.supplierId.isNotBlank() || transaction.supplierName.isNotBlank())
            ) {
                val matchingSupplier = currentSuppliers.firstOrNull { sup ->
                    (transaction.supplierId.isNotBlank() && sup.id == transaction.supplierId) ||
                        (transaction.supplierName.isNotBlank() && sup.name.equals(transaction.supplierName, ignoreCase = true))
                }
                if (matchingSupplier != null && matchingSupplier.id.isNotBlank()) {
                    val supRef = db.collection("users").document(uid).collection("suppliers").document(matchingSupplier.id)
                    when (transaction.type) {
                        "SUPPLIER_PAYMENT" -> {
                            batch.update(
                                supRef,
                                mapOf(
                                    "payableBalance" to (matchingSupplier.payableBalance + transaction.amount),
                                    "updatedAt" to FieldValue.serverTimestamp()
                                )
                            )
                        }
                        "PURCHASE" -> {
                            batch.update(
                                supRef,
                                mapOf(
                                    "payableBalance" to (matchingSupplier.payableBalance - transaction.dueAmount).coerceAtLeast(0.0),
                                    "totalPurchased" to (matchingSupplier.totalPurchased - transaction.amount).coerceAtLeast(0.0),
                                    "updatedAt" to FieldValue.serverTimestamp()
                                )
                            )
                        }
                    }
                }
            }

            val commitTask = batch.commit()
            val binTask = binRef.set(
                mapOf(
                    "userId" to uid,
                    "itemType" to "TRANSACTION",
                    "itemId" to transaction.id,
                    "name" to transaction.title.ifBlank { transaction.type },
                    "details" to "Type: ${transaction.type} | Amount: ৳${transaction.amount} | Customer: ${transaction.customerName.ifBlank { "N/A" }}",
                    "payloadJson" to "",
                    "deletedBy" to currentActorName(),
                    "deletedAt" to FieldValue.serverTimestamp()
                )
            )
            kotlinx.coroutines.withTimeoutOrNull(1800L) {
                runCatching { commitTask.await() }
                runCatching { binTask.await() }
            }
            recordAuditLog("Deleted transaction: ${transaction.title} (৳${transaction.amount})", "Transactions")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, txRef.path)
        }
    }

    suspend fun setStartingCash(
        amount: Double
    ): Result<String> = runCatching {
        if (useLocalVaultStore) {
            return@runCatching LocalVaultStoreFallback.setStartingCash(amount, currentActorName())
        }
        val uid = requireUserId()
        val cleanAmount = amount.coerceAtLeast(0.0)
        val txRef = db.collection("users").document(uid).collection("transactions").document()
        try {
            LocalVaultStoreFallback.registerCreatedId(txRef.id)
            txRef.set(
                mapOf(
                    "userId" to uid,
                    "type" to "STOCK_ADJUST",
                    "title" to "Starting Cash",
                    "amount" to cleanAmount,
                    "paidAmount" to 0.0,
                    "dueAmount" to 0.0,
                    "profitAmount" to 0.0,
                    "customerId" to "",
                    "customerName" to "",
                    "supplierId" to "",
                    "supplierName" to "",
                    "productId" to "",
                    "category" to "STARTING_CASH",
                    "notes" to "Cash at start",
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            recordAuditLog("Set starting cash: ৳$cleanAmount", "Accounts")
            txRef.id
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, txRef.path)
            throw e
        }
    }

    // --- Staff Management ---

    suspend fun addStaffMember(
        name: String,
        role: String,
        phone: String,
        salary: Double
    ): Result<String> = runCatching {
        if (useLocalVaultStore) {
            return@runCatching LocalVaultStoreFallback.addStaffMember(name, role, phone, salary, currentActorName())
        }
        val uid = requireUserId()
        val docRef = db.collection("users").document(uid).collection("staff").document()
        val payload = mapOf(
            "userId" to uid,
            "name" to name.trim().take(100),
            "role" to role,
            "phone" to phone.trim().take(30),
            "salary" to salary.coerceAtLeast(0.0),
            "active" to true,
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp()
        )
        try {
            LocalVaultStoreFallback.registerCreatedId(docRef.id)
            docRef.set(payload).await()
            recordAuditLog("Added staff ${name.trim()} as $role", "Settings")
            docRef.id
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docRef.path)
            throw e
        }
    }

    suspend fun toggleStaffActive(staff: StaffMember): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.toggleStaffActive(staff, currentActorName())
            return@runCatching
        }
        val uid = requireUserId()
        val docRef = db.collection("users").document(uid).collection("staff").document(staff.id)
        try {
            docRef.update(
                mapOf(
                    "active" to !staff.active,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            recordAuditLog("Updated status for staff ${staff.name}", "Settings")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docRef.path)
            throw e
        }
    }

    suspend fun updateStaffMember(
        staff: StaffMember,
        name: String,
        role: String,
        phone: String,
        salary: Double,
        active: Boolean
    ): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.updateStaffMember(staff, name, role, phone, salary, active, currentActorName())
            return@runCatching
        }
        val uid = requireUserId()
        val docRef = db.collection("users").document(uid).collection("staff").document(staff.id)
        val payload = mapOf(
            "name" to name.trim().take(100),
            "role" to role,
            "phone" to phone.trim().take(30),
            "salary" to salary.coerceAtLeast(0.0),
            "active" to active,
            "updatedAt" to FieldValue.serverTimestamp()
        )
        try {
            docRef.update(payload).await()
            recordAuditLog("Updated staff: ${name.trim()} ($role)", "Settings")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docRef.path)
            throw e
        }
    }

    suspend fun deleteStaffMember(staff: StaffMember): Result<Unit> = runCatching {
        LocalVaultStoreFallback.markIdDeleted(staff.id)
        LocalVaultStoreFallback.deleteStaffMember(staff, currentActorName())
        if (useLocalVaultStore) {
            return@runCatching
        }
        val uid = requireUserId()
        val staffRef = db.collection("users").document(uid).collection("staff").document(staff.id)
        val binRef = db.collection("users").document(uid).collection("recycle_bin").document("bin_staff_${staff.id.take(30)}")

        try {
            val deleteTask = staffRef.delete()
            val binTask = binRef.set(
                mapOf(
                    "userId" to uid,
                    "itemType" to "STAFF",
                    "itemId" to staff.id,
                    "name" to staff.name,
                    "details" to "Role: ${staff.role} | Phone: ${staff.phone} | Salary: ৳${staff.salary}",
                    "payloadJson" to "",
                    "deletedBy" to currentActorName(),
                    "deletedAt" to FieldValue.serverTimestamp()
                )
            )
            kotlinx.coroutines.withTimeoutOrNull(1800L) {
                runCatching { deleteTask.await() }
                runCatching { binTask.await() }
            }
            recordAuditLog("Deleted staff: ${staff.name} (moved to Recycle Bin)", "Settings")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, staffRef.path)
        }
    }

    // --- Starter Sample Store Data Seeding (User-Triggered or Quick Setup) ---

    suspend fun seedSampleDokanData(): Result<Unit> = runCatching {
        addProduct("Miniket Rice Premium", "Grains & Rice", "kg", 64.0, 72.0, 85.0, 20.0, "890101").getOrThrow()
        addProduct("Rupchanda Soybean Oil 2L", "Cooking Oil", "ltr", 310.0, 338.0, 6.0, 10.0, "890102").getOrThrow()
        addProduct("Fresh Refined Sugar", "Grocery", "kg", 118.0, 130.0, 4.0, 15.0, "890103").getOrThrow()
        addProduct("Aarong Dairy UHT Milk 1L", "Dairy", "ltr", 92.0, 105.0, 24.0, 8.0, "890104").getOrThrow()
        addProduct("Ispahani Mirzapore Tea 400g", "Beverages", "pcs", 185.0, 210.0, 3.0, 6.0, "890105").getOrThrow()

        addCustomer("Tariqul Islam", "01711-458920", "Ramchandrapur Hat, Chapainawabganj", 0.0).getOrThrow()
        addCustomer("Nusrat Jahan", "01819-332190", "Chapainawabganj Sadar", 0.0).getOrThrow()
        addCustomer("Mahmudul Hasan", "01912-887412", "Ramchandrapur Hat", 0.0).getOrThrow()

        addSupplier("Meghna Wholesale Depot", "01713-900112", "Meghna Group", 0.0).getOrThrow()
        addSupplier("City Agro Distributors", "01844-220198", "City Group", 0.0).getOrThrow()

        addStaffMember("Sabbir Hossain", "Cashier", "01611-223344", 14000.0).getOrThrow()
    }

    suspend fun recordAuditLog(action: String, module: String) {
        // 1. Immediately record in LocalVaultStoreFallback so local StateFlow updates in real time
        LocalVaultStoreFallback.recordAuditLog(currentActorName(), action, module)

        if (useLocalVaultStore) return

        val uid = auth.currentUser?.uid
            ?: vaultSessionActorEmail?.takeIf { it.isNotBlank() }?.let { "siaam_store_shared" }
            ?: return
        val logRef = db.collection("users").document(uid).collection("audit_logs").document()
        try {
            logRef.set(
                mapOf(
                    "userId" to uid,
                    "actorName" to currentActorName().take(100),
                    "action" to action.take(200),
                    "module" to module.take(60),
                    "createdAt" to FieldValue.serverTimestamp()
                )
            ).await()
        } catch (_: Exception) {
            // Best-effort audit logging
        }
    }

    suspend fun restoreRecycleItem(item: RecycleBinItem): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.removeFromRecycleBin(item.id)
            return@runCatching
        }
        val uid = requireUserId()
        val binRef = db.collection("users").document(uid).collection("recycle_bin").document(item.id)
        when (item.itemType) {
            "PRODUCT" -> {
                addProduct(
                    name = item.name,
                    category = "General",
                    unit = "pcs",
                    buyPrice = 0.0,
                    sellPrice = 0.0,
                    initialStock = 1.0,
                    lowStockThreshold = 5.0,
                    barcode = ""
                ).getOrThrow()
            }
            "CUSTOMER" -> {
                addCustomer(
                    name = item.name,
                    phone = "—",
                    address = "Restored",
                    initialDue = 0.0
                ).getOrThrow()
            }
            "SUPPLIER" -> {
                addSupplier(
                    name = item.name,
                    phone = "—",
                    company = "Restored",
                    initialPayable = 0.0
                ).getOrThrow()
            }
            "EXPENSE" -> {
                recordExpense(
                    title = item.name,
                    category = "General",
                    amount = 0.0,
                    notes = "Restored from Recycle Bin"
                ).getOrThrow()
            }
        }
        try {
            binRef.delete().await()
            LocalVaultStoreFallback.removeFromRecycleBin(item.id)
            recordAuditLog("Restored ${item.name} (${item.itemType}) from Recycle Bin", "RecycleBin")
        } catch (_: Exception) {}
    }

    suspend fun deletePermanentlyFromRecycleBin(binId: String): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.removeFromRecycleBin(binId)
            return@runCatching
        }
        val uid = requireUserId()
        val binRef = db.collection("users").document(uid).collection("recycle_bin").document(binId)
        try {
            binRef.delete().await()
            LocalVaultStoreFallback.removeFromRecycleBin(binId)
            recordAuditLog("Permanently deleted item from Recycle Bin", "RecycleBin")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, binRef.path)
            throw e
        }
    }

    suspend fun emptyRecycleBin(): Result<Unit> = runCatching {
        if (useLocalVaultStore) {
            LocalVaultStoreFallback.emptyRecycleBin()
            return@runCatching
        }
        val uid = requireUserId()
        val colRef = db.collection("users").document(uid).collection("recycle_bin")
        try {
            val snaps = colRef.get().await()
            for (chunk in snaps.documents.chunked(400)) {
                val batch = db.batch()
                for (doc in chunk) {
                    batch.delete(doc.reference)
                }
                batch.commit().await()
            }
            LocalVaultStoreFallback.emptyRecycleBin()
            recordAuditLog("Emptied Recycle Bin", "RecycleBin")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, colRef.path)
            throw e
        }
    }

    suspend fun resetAllStoreData(
        activeProducts: List<Product> = emptyList(),
        activeCustomers: List<Customer> = emptyList(),
        activeTransactions: List<StoreTransaction> = emptyList(),
        activeSuppliers: List<Supplier> = emptyList(),
        activeStaff: List<StaffMember> = emptyList()
    ): Result<Unit> = runCatching {
        hasBeenResetByUser = true
        syncedUidOnce = "RESET_COMPLETED"
        val activeUid = requireUserId()
        val actor = currentActorName()

        // 1. Snapshot current in-memory / local fallback items before clearing
        val productsToWipe = (activeProducts + LocalVaultStoreFallback.products.value).distinctBy { it.id }.filter { it.id.isNotBlank() }
        val customersToWipe = (activeCustomers + LocalVaultStoreFallback.customers.value).distinctBy { it.id }.filter { it.id.isNotBlank() }
        val transactionsToWipe = (activeTransactions + LocalVaultStoreFallback.transactions.value).distinctBy { it.id }.filter { it.id.isNotBlank() }
        val suppliersToWipe = (activeSuppliers + LocalVaultStoreFallback.suppliers.value).distinctBy { it.id }.filter { it.id.isNotBlank() }
        val staffToWipe = (activeStaff + LocalVaultStoreFallback.staff.value).distinctBy { it.id }.filter { it.id.isNotBlank() }

        // Ensure LocalVaultStoreFallback has all active items before moving them to Recycle Bin
        LocalVaultStoreFallback.mirrorProducts(productsToWipe)
        LocalVaultStoreFallback.mirrorCustomers(customersToWipe)
        LocalVaultStoreFallback.mirrorTransactions(transactionsToWipe)
        LocalVaultStoreFallback.mirrorSuppliers(suppliersToWipe)
        LocalVaultStoreFallback.mirrorStaff(staffToWipe)

        val allWipedIds = buildSet {
            productsToWipe.forEach { add(it.id) }
            customersToWipe.forEach { add(it.id) }
            transactionsToWipe.forEach { add(it.id) }
            suppliersToWipe.forEach { add(it.id) }
            staffToWipe.forEach { add(it.id) }
        }

        // 2. IMMEDIATELY activate persistent store reset filter so all 5 UI StateFlows emit emptyList() in 0ms!
        LocalVaultStoreFallback.activateFullStoreReset(allWipedIds)
        LocalVaultStoreFallback.resetAllDataAndMoveToRecycleBin(actor)

        val targetUids = listOfNotNull("siaam_store_shared", auth.currentUser?.uid, activeUid).distinct()

        for (uid in targetUids) {
            val userDocRef = db.collection("users").document(uid)
            val binColRef = userDocRef.collection("recycle_bin")

            val directDeleteRefs = mutableListOf<com.google.firebase.firestore.DocumentReference>()
            val binPayloads = mutableListOf<Map<String, Any>>()

            productsToWipe.forEach { prod ->
                directDeleteRefs.add(userDocRef.collection("products").document(prod.id))
                binPayloads.add(
                    mapOf(
                        "userId" to uid,
                        "itemType" to "PRODUCT",
                        "itemId" to prod.id,
                        "name" to prod.name.ifBlank { "Product" },
                        "details" to "Stock: ${prod.stock} ${prod.unit} | Buy: ৳${prod.buyPrice} | Sell: ৳${prod.sellPrice}".take(280),
                        "payloadJson" to "",
                        "deletedBy" to actor,
                        "deletedAt" to FieldValue.serverTimestamp()
                    )
                )
            }

            customersToWipe.forEach { cust ->
                directDeleteRefs.add(userDocRef.collection("customers").document(cust.id))
                binPayloads.add(
                    mapOf(
                        "userId" to uid,
                        "itemType" to "CUSTOMER",
                        "itemId" to cust.id,
                        "name" to cust.name.ifBlank { "Customer" },
                        "details" to "Phone: ${cust.phone} | Due: ৳${cust.totalDue} | Paid: ৳${cust.totalPaid}".take(280),
                        "payloadJson" to "",
                        "deletedBy" to actor,
                        "deletedAt" to FieldValue.serverTimestamp()
                    )
                )
            }

            suppliersToWipe.forEach { sup ->
                directDeleteRefs.add(userDocRef.collection("suppliers").document(sup.id))
                binPayloads.add(
                    mapOf(
                        "userId" to uid,
                        "itemType" to "SUPPLIER",
                        "itemId" to sup.id,
                        "name" to sup.name.ifBlank { "Supplier" },
                        "details" to "Phone: ${sup.phone} | Payable: ৳${sup.payableBalance}".take(280),
                        "payloadJson" to "",
                        "deletedBy" to actor,
                        "deletedAt" to FieldValue.serverTimestamp()
                    )
                )
            }

            transactionsToWipe.forEach { tx ->
                directDeleteRefs.add(userDocRef.collection("transactions").document(tx.id))
                binPayloads.add(
                    mapOf(
                        "userId" to uid,
                        "itemType" to if (tx.type == "EXPENSE") "EXPENSE" else "TRANSACTION",
                        "itemId" to tx.id,
                        "name" to tx.title.ifBlank { tx.type },
                        "details" to "Type: ${tx.type} | Amount: ৳${tx.amount} | Due: ৳${tx.dueAmount} | ${tx.notes}".take(280),
                        "payloadJson" to "",
                        "deletedBy" to actor,
                        "deletedAt" to FieldValue.serverTimestamp()
                    )
                )
            }

            staffToWipe.forEach { st ->
                directDeleteRefs.add(userDocRef.collection("staff").document(st.id))
                binPayloads.add(
                    mapOf(
                        "userId" to uid,
                        "itemType" to "STAFF",
                        "itemId" to st.id,
                        "name" to st.name.ifBlank { "Staff" },
                        "details" to "Role: ${st.role} | Phone: ${st.phone} | Salary: ৳${st.salary}".take(280),
                        "payloadJson" to "",
                        "deletedBy" to actor,
                        "deletedAt" to FieldValue.serverTimestamp()
                    )
                )
            }

            // Fire immediate local-cache & server deletes without blocking on offline queues
            for (ref in directDeleteRefs) {
                runCatching { ref.delete() }
            }

            // Write recycle bin entries immediately (local cache + background server queue)
            if (uid == activeUid && binPayloads.isNotEmpty()) {
                for (payload in binPayloads) {
                    runCatching { binColRef.document().set(payload) }
                }
            }

            // Best-effort bounded server sweep (up to 3.5s) to also wipe any un-cached server docs
            kotlinx.coroutines.withTimeoutOrNull(3500L) {
                val collectionsToWipe = listOf("products", "customers", "transactions", "suppliers", "staff")
                for (colName in collectionsToWipe) {
                    try {
                        val colRef = userDocRef.collection(colName)
                        val snap = try {
                            colRef.whereEqualTo("userId", uid).get().await()
                        } catch (_: Exception) {
                            colRef.get().await()
                        }
                        if (snap.isEmpty) continue

                        for (doc in snap.documents) {
                            LocalVaultStoreFallback.markIdDeleted(doc.id)
                            runCatching { doc.reference.delete() }
                        }
                        for (chunk in snap.documents.chunked(200)) {
                            try {
                                val batch = db.batch()
                                for (doc in chunk) {
                                    batch.delete(doc.reference)
                                }
                                batch.commit().await()
                            } catch (_: Exception) {}
                        }
                    } catch (_: Exception) {}
                }
            }
        }

        recordAuditLog("Reset all store data: all active records wiped and moved to Recycle Bin", "System")
    }

    private fun formatQty(value: Double): String {
        return if (value % 1.0 == 0.0) value.toLong().toString() else String.format("%.2f", value)
    }
}
