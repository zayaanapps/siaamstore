package com.example.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.example.data.model.AuditLog
import com.example.data.model.CartItem
import com.example.data.model.Customer
import com.example.data.model.Product
import com.example.data.model.RecycleBinItem
import com.example.data.model.StaffMember
import com.example.data.model.StoreTransaction
import com.example.data.model.Supplier
import com.google.firebase.Timestamp
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.util.UUID

data class StoreResetFilterState(
    val isResetActive: Boolean = false,
    val whitelistedIds: Set<String> = emptySet(),
    val deletedIds: Set<String> = emptySet(),
    val generation: Long = 0L
) {
    fun isAllowed(docId: String): Boolean {
        if (docId.isBlank()) return false
        if (docId in deletedIds) return false
        if (isResetActive && docId !in whitelistedIds) return false
        return true
    }
}

/**
 * Shared local store state for Siaam Store (সিয়াম স্টোর) when accessed via Vault credentials
 * on devices/emulators before Google Play credentials are linked, allowing Admins and
 * Account Managers to share store inventory, POS sales, and ledgers seamlessly.
 */
object LocalVaultStoreFallback {

    private const val STORE_USER_ID = "siaam_store_vault"
    private const val PREFS_NAME = "dokan_store_reset_filter_prefs"
    private const val KEY_IS_RESET_ACTIVE = "is_reset_active"
    private const val KEY_WHITELISTED_IDS = "whitelisted_ids"
    private const val KEY_DELETED_IDS = "deleted_ids"

    private var prefs: SharedPreferences? = null

    private val _resetFilterState = MutableStateFlow(StoreResetFilterState())
    val resetFilterState: StateFlow<StoreResetFilterState> = _resetFilterState.asStateFlow()

    fun init(context: Context) {
        if (prefs != null) return
        val sp = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs = sp
        val isReset = sp.getBoolean(KEY_IS_RESET_ACTIVE, false)
        val whitelisted = sp.getStringSet(KEY_WHITELISTED_IDS, emptySet())?.toSet() ?: emptySet()
        val deleted = sp.getStringSet(KEY_DELETED_IDS, emptySet())?.toSet() ?: emptySet()
        _resetFilterState.value = StoreResetFilterState(
            isResetActive = isReset,
            whitelistedIds = whitelisted,
            deletedIds = deleted,
            generation = System.currentTimeMillis()
        )
    }

    private fun persistFilterState(state: StoreResetFilterState) {
        prefs?.edit()
            ?.putBoolean(KEY_IS_RESET_ACTIVE, state.isResetActive)
            ?.putStringSet(KEY_WHITELISTED_IDS, state.whitelistedIds)
            ?.putStringSet(KEY_DELETED_IDS, state.deletedIds)
            ?.apply()
    }

    fun registerCreatedId(id: String) {
        if (id.isBlank()) return
        _resetFilterState.update { current ->
            val next = current.copy(
                whitelistedIds = current.whitelistedIds + id,
                deletedIds = current.deletedIds - id,
                generation = current.generation + 1
            )
            persistFilterState(next)
            next
        }
    }

    fun registerCreatedIds(ids: Collection<String>) {
        val clean = ids.filter { it.isNotBlank() }.toSet()
        if (clean.isEmpty()) return
        _resetFilterState.update { current ->
            val next = current.copy(
                whitelistedIds = current.whitelistedIds + clean,
                deletedIds = current.deletedIds - clean,
                generation = current.generation + 1
            )
            persistFilterState(next)
            next
        }
    }

    fun markIdDeleted(id: String) {
        if (id.isBlank()) return
        _resetFilterState.update { current ->
            val next = current.copy(
                whitelistedIds = current.whitelistedIds - id,
                deletedIds = current.deletedIds + id,
                generation = current.generation + 1
            )
            persistFilterState(next)
            next
        }
    }

    fun activateFullStoreReset(allWipedIds: Collection<String>) {
        val cleanWiped = allWipedIds.filter { it.isNotBlank() }.toSet()
        _resetFilterState.update { current ->
            val next = StoreResetFilterState(
                isResetActive = true,
                whitelistedIds = emptySet(),
                deletedIds = current.deletedIds + cleanWiped,
                generation = current.generation + 1
            )
            persistFilterState(next)
            next
        }
    }

    private val _products = MutableStateFlow<List<Product>>(emptyList())
    val products: StateFlow<List<Product>> = _products.asStateFlow()

    private val _customers = MutableStateFlow<List<Customer>>(emptyList())
    val customers: StateFlow<List<Customer>> = _customers.asStateFlow()

    private val _transactions = MutableStateFlow<List<StoreTransaction>>(emptyList())
    val transactions: StateFlow<List<StoreTransaction>> = _transactions.asStateFlow()

    private val _suppliers = MutableStateFlow<List<Supplier>>(emptyList())
    val suppliers: StateFlow<List<Supplier>> = _suppliers.asStateFlow()

    private val _staff = MutableStateFlow<List<StaffMember>>(emptyList())
    val staff: StateFlow<List<StaffMember>> = _staff.asStateFlow()

    private val _auditLogs = MutableStateFlow<List<AuditLog>>(emptyList())
    val auditLogs: StateFlow<List<AuditLog>> = _auditLogs.asStateFlow()

    private val _recycleBin = MutableStateFlow<List<RecycleBinItem>>(emptyList())
    val recycleBin: StateFlow<List<RecycleBinItem>> = _recycleBin.asStateFlow()

    fun addProduct(
        name: String,
        category: String,
        unit: String,
        buyPrice: Double,
        sellPrice: Double,
        initialStock: Double,
        lowStockThreshold: Double,
        barcode: String,
        actorName: String
    ): String {
        val id = "prod_${UUID.randomUUID().toString().take(8)}"
        val now = Timestamp.now()
        val cleanStock = initialStock.coerceAtLeast(0.0)
        val prod = Product(
            id = id,
            userId = STORE_USER_ID,
            name = name.trim().take(120),
            category = category.trim().ifBlank { "General" }.take(60),
            unit = unit,
            buyPrice = buyPrice.coerceAtLeast(0.0),
            sellPrice = sellPrice.coerceAtLeast(0.0),
            stock = cleanStock,
            lowStockThreshold = lowStockThreshold.coerceAtLeast(0.0),
            barcode = barcode.trim().take(64),
            createdAt = now,
            updatedAt = now
        )
        _products.update { (it + prod).sortedBy { p -> p.name.lowercase() } }
        if (cleanStock > 0.0) {
            val tx = StoreTransaction(
                id = "tx_${UUID.randomUUID().toString().take(8)}",
                userId = STORE_USER_ID,
                type = "STOCK_ADJUST",
                title = "Opening stock",
                amount = cleanStock,
                paidAmount = 0.0,
                dueAmount = 0.0,
                profitAmount = 0.0,
                productId = id,
                category = "Opening Stock",
                notes = "DELTA:+${cleanStock}|REASON:Opening stock",
                createdAt = now,
                updatedAt = now
            )
            _transactions.update { listOf(tx) + it }
        }
        recordAuditLog(actorName, "Added product ${prod.name} ($cleanStock $unit)", "Inventory")
        return id
    }

    fun updateProduct(
        product: Product,
        name: String,
        category: String,
        unit: String,
        buyPrice: Double,
        sellPrice: Double,
        stock: Double,
        lowStockThreshold: Double,
        barcode: String,
        actorName: String
    ) {
        val now = Timestamp.now()
        _products.update { list ->
            list.map {
                if (it.id == product.id) {
                    it.copy(
                        name = name.trim().ifBlank { product.name }.take(120),
                        category = category.trim().ifBlank { "General" }.take(60),
                        unit = unit,
                        buyPrice = buyPrice.coerceAtLeast(0.0),
                        sellPrice = sellPrice.coerceAtLeast(0.0),
                        stock = stock.coerceAtLeast(0.0),
                        lowStockThreshold = lowStockThreshold.coerceAtLeast(0.0),
                        barcode = barcode.trim().take(64),
                        updatedAt = now
                    )
                } else it
            }.sortedBy { p -> p.name.lowercase() }
        }
        recordAuditLog(actorName, "Updated product ${name.trim()}", "Inventory")
    }

    fun adjustProductStock(
        product: Product,
        delta: Double,
        reason: String,
        actorName: String
    ) {
        val now = Timestamp.now()
        val newStock = (product.stock + delta).coerceAtLeast(0.0)
        _products.update { list ->
            list.map { if (it.id == product.id) it.copy(stock = newStock, updatedAt = now) else it }
        }
        val cleanTitle = when {
            reason.startsWith("Removed", ignoreCase = true) -> "Removed stock"
            reason.startsWith("Damaged", ignoreCase = true) -> "Damaged / lost"
            reason.startsWith("Opening", ignoreCase = true) -> "Opening stock"
            delta >= 0 -> "Added stock"
            else -> "Removed stock"
        }
        val signedDelta = if (delta >= 0) "+$delta" else "$delta"
        val tx = StoreTransaction(
            id = "tx_${UUID.randomUUID().toString().take(8)}",
            userId = STORE_USER_ID,
            type = "STOCK_ADJUST",
            title = cleanTitle,
            amount = kotlin.math.abs(delta),
            paidAmount = 0.0,
            dueAmount = 0.0,
            profitAmount = 0.0,
            productId = product.id,
            category = if (delta >= 0) "Stock In" else "Stock Out",
            notes = "DELTA:$signedDelta|${reason.trim()}".take(300),
            createdAt = now,
            updatedAt = now
        )
        _transactions.update { listOf(tx) + it }
        recordAuditLog(actorName, "$cleanTitle ($signedDelta ${product.unit}) for ${product.name}", "Inventory")
    }

    fun voidStockAdjustment(
        product: Product,
        transaction: StoreTransaction?,
        signedDeltaToReverse: Double,
        actorName: String
    ) {
        val now = Timestamp.now()
        val restoredStock = (product.stock - signedDeltaToReverse).coerceAtLeast(0.0)
        _products.update { list ->
            list.map { if (it.id == product.id) it.copy(stock = restoredStock, updatedAt = now) else it }
        }
        if (transaction != null && transaction.id.isNotBlank()) {
            _transactions.update { list -> list.filterNot { it.id == transaction.id } }
        }
        recordAuditLog(actorName, "Voided stock adjustment for ${product.name}", "Inventory")
    }

    fun deleteProduct(productId: String, productName: String, actorName: String) {
        _products.update { list -> list.filterNot { it.id == productId } }
        recordAuditLog(actorName, "Deleted product $productName", "Inventory")
    }

    fun getProductById(productId: String): Product? {
        return _products.value.firstOrNull { it.id == productId }
    }

    fun addCustomer(
        name: String,
        phone: String,
        address: String,
        initialDue: Double,
        actorName: String
    ): String {
        val id = "cust_${UUID.randomUUID().toString().take(8)}"
        val now = Timestamp.now()
        val cleanDue = initialDue.coerceAtLeast(0.0)
        val cust = Customer(
            id = id,
            userId = STORE_USER_ID,
            name = name.trim().take(100),
            phone = phone.trim().ifBlank { "—" }.take(30),
            address = address.trim().take(200),
            totalDue = cleanDue,
            totalPurchased = cleanDue,
            totalPaid = 0.0,
            createdAt = now,
            updatedAt = now
        )
        _customers.update { (it + cust).sortedByDescending { c -> c.totalDue } }
        if (cleanDue > 0.0) {
            val tx = StoreTransaction(
                id = "tx_${UUID.randomUUID().toString().take(8)}",
                userId = STORE_USER_ID,
                type = "GIVE_DUE",
                title = "Opening Due - ${cust.name}",
                amount = cleanDue,
                paidAmount = 0.0,
                dueAmount = cleanDue,
                profitAmount = 0.0,
                customerId = id,
                customerName = cust.name,
                category = "Customer Due",
                notes = "Initial opening due balance",
                createdAt = now,
                updatedAt = now
            )
            _transactions.update { listOf(tx) + it }
        }
        recordAuditLog(actorName, "Added customer ${cust.name}", "Customers")
        return id
    }

    fun updateCustomer(
        customer: Customer,
        name: String,
        phone: String,
        address: String,
        actorName: String
    ) {
        val now = Timestamp.now()
        _customers.update { list ->
            list.map {
                if (it.id == customer.id) {
                    it.copy(
                        name = name.trim().ifBlank { customer.name }.take(100),
                        phone = phone.trim().ifBlank { "—" }.take(30),
                        address = address.trim().take(200),
                        updatedAt = now
                    )
                } else it
            }.sortedByDescending { c -> c.totalDue }
        }
        recordAuditLog(actorName, "Updated customer ${name.trim()}", "Customers")
    }

    fun deleteCustomer(
        customerId: String,
        customerName: String,
        actorName: String
    ) {
        _customers.update { list -> list.filterNot { it.id == customerId } }
        recordAuditLog(actorName, "Deleted customer $customerName", "Customers")
    }

    fun recordCustomerDueOrPayment(
        customer: Customer,
        amount: Double,
        isGiveDue: Boolean,
        notes: String,
        actorName: String
    ) {
        val now = Timestamp.now()
        val cleanAmount = amount.coerceAtLeast(0.0)
        val newDue = if (isGiveDue) customer.totalDue + cleanAmount else (customer.totalDue - cleanAmount).coerceAtLeast(0.0)
        val newPurchased = if (isGiveDue) customer.totalPurchased + cleanAmount else customer.totalPurchased
        val newPaid = if (!isGiveDue) customer.totalPaid + cleanAmount else customer.totalPaid

        _customers.update { list ->
            list.map {
                if (it.id == customer.id) {
                    it.copy(
                        totalDue = newDue,
                        totalPurchased = newPurchased,
                        totalPaid = newPaid,
                        updatedAt = now
                    )
                } else it
            }.sortedByDescending { it.totalDue }
        }

        val tx = StoreTransaction(
            id = "tx_${UUID.randomUUID().toString().take(8)}",
            userId = STORE_USER_ID,
            type = if (isGiveDue) "GIVE_DUE" else "RECEIVE_PAYMENT",
            title = if (isGiveDue) "Due Given to ${customer.name}" else "Payment Received from ${customer.name}",
            amount = cleanAmount,
            paidAmount = if (isGiveDue) 0.0 else cleanAmount,
            dueAmount = if (isGiveDue) cleanAmount else 0.0,
            profitAmount = 0.0,
            customerId = customer.id,
            customerName = customer.name,
            category = if (isGiveDue) "Due Given" else "Due Collection",
            notes = notes.trim().ifBlank { if (isGiveDue) "Credit entry" else "Cash due collection" },
            createdAt = now,
            updatedAt = now
        )
        _transactions.update { listOf(tx) + it }
        recordAuditLog(
            actorName,
            if (isGiveDue) "Gave due ৳$cleanAmount to ${customer.name}" else "Received ৳$cleanAmount from ${customer.name}",
            "Customers"
        )
    }

    fun recordPosSale(
        cartItems: List<CartItem>,
        paidAmount: Double,
        selectedCustomer: Customer?,
        notes: String,
        actorName: String,
        discountAmount: Double = 0.0,
        newCustomerName: String = "",
        newCustomerPhone: String = "",
        newCustomerAddress: String = ""
    ): StoreTransaction {
        val now = Timestamp.now()
        val subtotalAmount = cartItems.sumOf { it.lineTotal }.coerceAtLeast(0.0)
        val cleanDiscount = discountAmount.coerceIn(0.0, subtotalAmount)
        val totalAmount = (subtotalAmount - cleanDiscount).coerceAtLeast(0.0)
        val totalProfit = cartItems.sumOf { it.lineProfit } - cleanDiscount
        val cleanPaid = paidAmount.coerceIn(0.0, totalAmount)
        val dueAmount = (totalAmount - cleanPaid).coerceAtLeast(0.0)

        val summaryTitle = cartItems.joinToString(", ") { "${it.product.name} x${it.quantity}" }.take(200)
        val resolvedPhone = selectedCustomer?.phone?.takeIf { it.isNotBlank() } ?: newCustomerPhone.trim()
        val resolvedAddress = selectedCustomer?.address?.takeIf { it.isNotBlank() } ?: newCustomerAddress.trim()
        val encodedNotes = com.example.data.model.SaleLineItem.encodeItemsAndNote(
            cartItems = cartItems,
            userNote = notes,
            customerPhone = resolvedPhone,
            customerAddress = resolvedAddress
        )

        _products.update { list ->
            list.map { prod ->
                val soldItem = cartItems.firstOrNull { it.product.id == prod.id }
                if (soldItem != null) {
                    prod.copy(
                        stock = (prod.stock - soldItem.quantity).coerceAtLeast(0.0),
                        updatedAt = now
                    )
                } else prod
            }
        }

        var resolvedCustomerId = selectedCustomer?.id ?: ""
        var resolvedCustomerName = selectedCustomer?.name?.takeIf { it.isNotBlank() }
            ?: newCustomerName.trim().takeIf { it.isNotBlank() }
            ?: "Walk-in customer"

        if (selectedCustomer != null && selectedCustomer.id.isNotBlank()) {
            _customers.update { list ->
                list.map { cust ->
                    if (cust.id == selectedCustomer.id) {
                        cust.copy(
                            totalDue = cust.totalDue + dueAmount,
                            totalPurchased = cust.totalPurchased + totalAmount,
                            totalPaid = cust.totalPaid + cleanPaid,
                            updatedAt = now
                        )
                    } else cust
                }.sortedByDescending { it.totalDue }
            }
        } else if (newCustomerName.trim().isNotBlank()) {
            val newId = "cust_${UUID.randomUUID().toString().take(8)}"
            resolvedCustomerId = newId
            resolvedCustomerName = newCustomerName.trim().take(100)
            val newCust = Customer(
                id = newId,
                userId = STORE_USER_ID,
                name = resolvedCustomerName,
                phone = newCustomerPhone.trim().ifBlank { "01700-000000" }.take(30),
                address = newCustomerAddress.trim().take(200),
                totalDue = dueAmount,
                totalPurchased = totalAmount,
                totalPaid = cleanPaid,
                createdAt = now,
                updatedAt = now
            )
            _customers.update { (it + newCust).sortedByDescending { c -> c.totalDue } }
        }

        val id = "tx_${UUID.randomUUID().toString().take(8)}"
        val tx = StoreTransaction(
            id = id,
            userId = STORE_USER_ID,
            type = "SALE",
            title = summaryTitle.ifBlank { "POS Sale" },
            amount = totalAmount,
            paidAmount = cleanPaid,
            dueAmount = dueAmount,
            profitAmount = totalProfit,
            customerId = resolvedCustomerId,
            customerName = resolvedCustomerName,
            productId = cartItems.firstOrNull()?.product?.id ?: "",
            category = "POS Sale",
            notes = encodedNotes,
            createdAt = now,
            updatedAt = now
        )
        _transactions.update { listOf(tx) + it }
        recordAuditLog(actorName, "Recorded sale ৳$totalAmount (Paid: ৳$cleanPaid, Due: ৳$dueAmount)", "POS")
        return tx
    }

    fun returnOrVoidSale(
        transaction: StoreTransaction,
        isReturn: Boolean,
        actorName: String
    ) {
        val now = Timestamp.now()
        val lineItems = com.example.data.model.SaleLineItem.parseLineItems(transaction)
        val qtyByProdId = lineItems.groupBy { it.productId }
            .mapValues { entry -> entry.value.sumOf { it.quantity } }

        _products.update { list ->
            list.map { prod ->
                val restoreQty = qtyByProdId[prod.id] ?: 0.0
                if (restoreQty > 0.0) {
                    prod.copy(stock = prod.stock + restoreQty, updatedAt = now)
                } else prod
            }
        }

        if (transaction.customerId.isNotBlank() || transaction.customerName.isNotBlank()) {
            _customers.update { list ->
                list.map { cust ->
                    val matches = (transaction.customerId.isNotBlank() && cust.id == transaction.customerId) ||
                        (transaction.customerName.isNotBlank() && cust.name.equals(transaction.customerName, ignoreCase = true))
                    if (matches) {
                        cust.copy(
                            totalDue = (cust.totalDue - transaction.dueAmount).coerceAtLeast(0.0),
                            totalPurchased = (cust.totalPurchased - transaction.amount).coerceAtLeast(0.0),
                            totalPaid = (cust.totalPaid - transaction.paidAmount).coerceAtLeast(0.0),
                            updatedAt = now
                        )
                    } else cust
                }.sortedByDescending { it.totalDue }
            }
        }

        _transactions.update { list -> list.filterNot { it.id == transaction.id } }
        recordAuditLog(
            actorName,
            if (isReturn) "Returned sale ৳${transaction.amount}" else "Voided sale ৳${transaction.amount}",
            "POS"
        )
    }

    fun addSupplier(
        name: String,
        phone: String,
        company: String,
        initialPayable: Double,
        actorName: String
    ): String {
        val id = "sup_${UUID.randomUUID().toString().take(8)}"
        val now = Timestamp.now()
        val cleanPayable = initialPayable.coerceAtLeast(0.0)
        val sup = Supplier(
            id = id,
            userId = STORE_USER_ID,
            name = name.trim().take(100),
            phone = phone.trim().ifBlank { "—" }.take(30),
            company = company.trim().take(100),
            payableBalance = cleanPayable,
            totalPurchased = cleanPayable,
            createdAt = now,
            updatedAt = now
        )
        _suppliers.update { (it + sup).sortedByDescending { s -> s.payableBalance } }
        recordAuditLog(actorName, "Added supplier ${sup.name}", "Accounts")
        return id
    }

    fun updateSupplier(
        supplier: Supplier,
        name: String,
        phone: String,
        company: String,
        actorName: String
    ) {
        val now = Timestamp.now()
        _suppliers.update { list ->
            list.map {
                if (it.id == supplier.id) {
                    it.copy(
                        name = name.trim().ifBlank { supplier.name }.take(100),
                        phone = phone.trim().ifBlank { "—" }.take(30),
                        company = company.trim().take(100),
                        updatedAt = now
                    )
                } else it
            }.sortedByDescending { s -> s.payableBalance }
        }
        recordAuditLog(actorName, "Updated supplier ${name.trim()}", "Accounts")
    }

    fun deleteSupplier(
        supplierId: String,
        supplierName: String,
        actorName: String
    ) {
        _suppliers.update { list -> list.filterNot { it.id == supplierId } }
        recordAuditLog(actorName, "Deleted supplier $supplierName", "Accounts")
    }

    fun addSupplierOwed(
        supplier: Supplier,
        amount: Double,
        notes: String,
        actorName: String
    ) {
        val now = Timestamp.now()
        val cleanAmount = amount.coerceAtLeast(0.0)
        _suppliers.update { list ->
            list.map {
                if (it.id == supplier.id) {
                    it.copy(
                        payableBalance = it.payableBalance + cleanAmount,
                        totalPurchased = it.totalPurchased + cleanAmount,
                        updatedAt = now
                    )
                } else it
            }.sortedByDescending { it.payableBalance }
        }
        val tx = StoreTransaction(
            id = "tx_${UUID.randomUUID().toString().take(8)}",
            userId = STORE_USER_ID,
            type = "PURCHASE",
            title = "Added owed - ${supplier.name}",
            amount = cleanAmount,
            paidAmount = 0.0,
            dueAmount = cleanAmount,
            profitAmount = 0.0,
            supplierId = supplier.id,
            supplierName = supplier.name,
            category = "Supplier Credit",
            notes = notes.trim().ifBlank { "Added supplier payable" },
            createdAt = now,
            updatedAt = now
        )
        _transactions.update { listOf(tx) + it }
        recordAuditLog(actorName, "Added owed ৳$cleanAmount for supplier ${supplier.name}", "Accounts")
    }

    fun recordStockPurchase(
        product: Product?,
        supplier: Supplier?,
        quantity: Double,
        totalCost: Double,
        paidCash: Double,
        notes: String,
        actorName: String
    ) {
        val now = Timestamp.now()
        val cleanCost = totalCost.coerceAtLeast(0.0)
        val cleanPaid = paidCash.coerceIn(0.0, cleanCost)
        val payableDue = (cleanCost - cleanPaid).coerceAtLeast(0.0)

        if (product != null && product.id.isNotBlank() && quantity > 0.0) {
            _products.update { list ->
                list.map {
                    if (it.id == product.id) it.copy(stock = it.stock + quantity, updatedAt = now) else it
                }
            }
        }
        if (supplier != null && supplier.id.isNotBlank()) {
            _suppliers.update { list ->
                list.map {
                    if (it.id == supplier.id) {
                        it.copy(
                            payableBalance = it.payableBalance + payableDue,
                            totalPurchased = it.totalPurchased + cleanCost,
                            updatedAt = now
                        )
                    } else it
                }.sortedByDescending { it.payableBalance }
            }
        }
        val tx = StoreTransaction(
            id = "tx_${UUID.randomUUID().toString().take(8)}",
            userId = STORE_USER_ID,
            type = "PURCHASE",
            title = "Purchase: ${product?.name ?: "Store Inventory"}",
            amount = cleanCost,
            paidAmount = cleanPaid,
            dueAmount = payableDue,
            supplierId = supplier?.id ?: "",
            supplierName = supplier?.name ?: "No supplier",
            productId = product?.id ?: "",
            category = "Stock Purchase",
            notes = notes.trim().ifBlank { "Wholesale stock purchase" },
            createdAt = now,
            updatedAt = now
        )
        _transactions.update { listOf(tx) + it }
        recordAuditLog(actorName, "Recorded purchase ৳$cleanCost", "Accounts")
    }

    fun recordMultiItemPurchase(
        cartItems: List<CartItem>,
        paidAmount: Double,
        selectedSupplier: Supplier?,
        newSupplierName: String,
        updateBuyingPrice: Boolean,
        notes: String,
        actorName: String
    ): StoreTransaction {
        val now = Timestamp.now()
        val totalCost = cartItems.sumOf { it.lineTotal }.coerceAtLeast(0.0)
        val cleanPaid = paidAmount.coerceIn(0.0, totalCost)
        val payableDue = (totalCost - cleanPaid).coerceAtLeast(0.0)

        _products.update { list ->
            list.map { prod ->
                val purchasedItem = cartItems.firstOrNull { it.product.id == prod.id }
                if (purchasedItem != null) {
                    prod.copy(
                        stock = prod.stock + purchasedItem.quantity,
                        buyPrice = if (updateBuyingPrice) purchasedItem.customUnitPrice.coerceAtLeast(0.0) else prod.buyPrice,
                        updatedAt = now
                    )
                } else prod
            }
        }

        var resolvedSupplierId = selectedSupplier?.id ?: ""
        var resolvedSupplierName = selectedSupplier?.name?.takeIf { it.isNotBlank() }
            ?: newSupplierName.trim().takeIf { it.isNotBlank() }
            ?: "No supplier"

        if (selectedSupplier != null && selectedSupplier.id.isNotBlank()) {
            _suppliers.update { list ->
                list.map { sup ->
                    if (sup.id == selectedSupplier.id) {
                        sup.copy(
                            payableBalance = sup.payableBalance + payableDue,
                            totalPurchased = sup.totalPurchased + totalCost,
                            updatedAt = now
                        )
                    } else sup
                }.sortedByDescending { it.payableBalance }
            }
        } else if (newSupplierName.trim().isNotBlank()) {
            val newId = "sup_${UUID.randomUUID().toString().take(8)}"
            resolvedSupplierId = newId
            resolvedSupplierName = newSupplierName.trim().take(100)
            val newSup = Supplier(
                id = newId,
                userId = STORE_USER_ID,
                name = resolvedSupplierName,
                phone = "—",
                company = "",
                payableBalance = payableDue,
                totalPurchased = totalCost,
                createdAt = now,
                updatedAt = now
            )
            _suppliers.update { (it + newSup).sortedByDescending { s -> s.payableBalance } }
        }

        val summaryTitle = cartItems.joinToString(", ") { "${it.product.name} x${it.quantity}" }
            .ifBlank { "Purchase" }
            .take(200)
        val encodedNotes = com.example.data.model.SaleLineItem.encodeItemsAndNote(
            cartItems = cartItems,
            userNote = notes
        )

        val tx = StoreTransaction(
            id = "tx_${UUID.randomUUID().toString().take(8)}",
            userId = STORE_USER_ID,
            type = "PURCHASE",
            title = summaryTitle,
            amount = totalCost,
            paidAmount = cleanPaid,
            dueAmount = payableDue,
            profitAmount = 0.0,
            supplierId = resolvedSupplierId,
            supplierName = resolvedSupplierName,
            productId = cartItems.firstOrNull()?.product?.id ?: "",
            category = "Stock Purchase",
            notes = encodedNotes,
            createdAt = now,
            updatedAt = now
        )
        _transactions.update { listOf(tx) + it }
        recordAuditLog(actorName, "Recorded purchase ৳$totalCost (Paid: ৳$cleanPaid, Due: ৳$payableDue)", "Accounts")
        return tx
    }

    fun voidPurchase(
        transaction: StoreTransaction,
        actorName: String
    ) {
        val now = Timestamp.now()
        val lineItems = com.example.data.model.SaleLineItem.parseLineItems(transaction)
        val qtyByProdId = lineItems.groupBy { it.productId }
            .mapValues { entry -> entry.value.sumOf { it.quantity } }

        _products.update { list ->
            list.map { prod ->
                val deductQty = qtyByProdId[prod.id] ?: 0.0
                if (deductQty > 0.0) {
                    prod.copy(stock = (prod.stock - deductQty).coerceAtLeast(0.0), updatedAt = now)
                } else prod
            }
        }

        if (transaction.supplierId.isNotBlank() || transaction.supplierName.isNotBlank()) {
            _suppliers.update { list ->
                list.map { sup ->
                    val matches = (transaction.supplierId.isNotBlank() && sup.id == transaction.supplierId) ||
                        (transaction.supplierName.isNotBlank() && sup.name.equals(transaction.supplierName, ignoreCase = true))
                    if (matches) {
                        sup.copy(
                            payableBalance = (sup.payableBalance - transaction.dueAmount).coerceAtLeast(0.0),
                            totalPurchased = (sup.totalPurchased - transaction.amount).coerceAtLeast(0.0),
                            updatedAt = now
                        )
                    } else sup
                }.sortedByDescending { it.payableBalance }
            }
        }

        _transactions.update { list -> list.filterNot { it.id == transaction.id } }
        recordAuditLog(actorName, "Voided purchase ৳${transaction.amount}", "Accounts")
    }

    fun paySupplier(
        supplier: Supplier,
        amount: Double,
        notes: String,
        actorName: String
    ) {
        val now = Timestamp.now()
        val cleanAmount = amount.coerceAtLeast(0.0)
        _suppliers.update { list ->
            list.map {
                if (it.id == supplier.id) {
                    it.copy(
                        payableBalance = (it.payableBalance - cleanAmount).coerceAtLeast(0.0),
                        updatedAt = now
                    )
                } else it
            }.sortedByDescending { it.payableBalance }
        }
        val tx = StoreTransaction(
            id = "tx_${UUID.randomUUID().toString().take(8)}",
            userId = STORE_USER_ID,
            type = "SUPPLIER_PAYMENT",
            title = "Paid Supplier - ${supplier.name}",
            amount = cleanAmount,
            paidAmount = cleanAmount,
            supplierId = supplier.id,
            supplierName = supplier.name,
            category = "Supplier Payment",
            notes = notes.trim().ifBlank { "Supplier payable settlement" },
            createdAt = now,
            updatedAt = now
        )
        _transactions.update { listOf(tx) + it }
        recordAuditLog(actorName, "Paid ৳$cleanAmount to supplier ${supplier.name}", "Accounts")
    }

    fun recordExpense(
        title: String,
        category: String,
        amount: Double,
        notes: String,
        actorName: String
    ): String {
        val id = "tx_${UUID.randomUUID().toString().take(8)}"
        val now = Timestamp.now()
        val cleanAmount = amount.coerceAtLeast(0.0)
        val tx = StoreTransaction(
            id = id,
            userId = STORE_USER_ID,
            type = "EXPENSE",
            title = title.trim().take(200),
            amount = cleanAmount,
            paidAmount = cleanAmount,
            category = category.trim().ifBlank { "Shop Expense" },
            notes = notes.trim().ifBlank { "Operating expense" },
            createdAt = now,
            updatedAt = now
        )
        _transactions.update { listOf(tx) + it }
        recordAuditLog(actorName, "Recorded expense: ${tx.title} (৳$cleanAmount)", "Accounts")
        return id
    }

    fun deleteExpense(
        transactionId: String,
        title: String,
        actorName: String
    ) {
        _transactions.update { list -> list.filterNot { it.id == transactionId } }
        recordAuditLog(actorName, "Deleted expense: $title", "Accounts")
    }

    fun deleteTransaction(
        transaction: StoreTransaction,
        actorName: String
    ) {
        // 1. Revert customer due/purchased/paid if applicable
        if (transaction.customerId.isNotBlank() || transaction.customerName.isNotBlank()) {
            _customers.update { list ->
                list.map { cust ->
                    val isMatch = (transaction.customerId.isNotBlank() && cust.id == transaction.customerId) ||
                        (transaction.customerName.isNotBlank() && cust.name.equals(transaction.customerName, ignoreCase = true))
                    if (isMatch) {
                        when (transaction.type) {
                            "GIVE_DUE" -> {
                                cust.copy(
                                    totalDue = (cust.totalDue - transaction.dueAmount).coerceAtLeast(0.0),
                                    totalPurchased = (cust.totalPurchased - transaction.amount).coerceAtLeast(0.0),
                                    updatedAt = Timestamp.now()
                                )
                            }
                            "RECEIVE_PAYMENT" -> {
                                cust.copy(
                                    totalDue = cust.totalDue + transaction.amount,
                                    totalPaid = (cust.totalPaid - transaction.amount).coerceAtLeast(0.0),
                                    updatedAt = Timestamp.now()
                                )
                            }
                            "SALE" -> {
                                cust.copy(
                                    totalDue = (cust.totalDue - transaction.dueAmount).coerceAtLeast(0.0),
                                    totalPurchased = (cust.totalPurchased - transaction.amount).coerceAtLeast(0.0),
                                    totalPaid = (cust.totalPaid - transaction.paidAmount).coerceAtLeast(0.0),
                                    updatedAt = Timestamp.now()
                                )
                            }
                            else -> cust
                        }
                    } else cust
                }.sortedByDescending { it.totalDue }
            }
        }

        // 2. Revert supplier balance if supplier payment
        if (transaction.type == "SUPPLIER_PAYMENT") {
            _suppliers.update { list ->
                list.map { sup ->
                    val isMatch = (transaction.supplierId.isNotBlank() && sup.id == transaction.supplierId) ||
                        (transaction.supplierName.isNotBlank() && sup.name.equals(transaction.supplierName, ignoreCase = true))
                    if (isMatch) {
                        sup.copy(
                            payableBalance = sup.payableBalance + transaction.amount,
                            updatedAt = Timestamp.now()
                        )
                    } else sup
                }
            }
        }

        // 3. Remove transaction from active transactions
        _transactions.update { list -> list.filterNot { it.id == transaction.id } }

        // 4. Move to Recycle Bin
        val binItem = RecycleBinItem(
            id = "bin_${UUID.randomUUID().toString().take(8)}",
            userId = STORE_USER_ID,
            itemType = "TRANSACTION",
            itemId = transaction.id,
            name = transaction.title.ifBlank { transaction.type },
            details = "Type: ${transaction.type} | Amount: ৳${transaction.amount} | Customer: ${transaction.customerName.ifBlank { "N/A" }}",
            payloadJson = "",
            deletedBy = actorName,
            deletedAt = Timestamp.now()
        )
        _recycleBin.update { listOf(binItem) + it }

        // 5. Audit log
        recordAuditLog(actorName, "Deleted transaction ${transaction.title} (৳${transaction.amount})", "Transactions")
    }

    fun setStartingCash(
        amount: Double,
        actorName: String
    ): String {
        val id = "tx_${UUID.randomUUID().toString().take(8)}"
        val now = Timestamp.now()
        val cleanAmount = amount.coerceAtLeast(0.0)
        val tx = StoreTransaction(
            id = id,
            userId = STORE_USER_ID,
            type = "STOCK_ADJUST",
            title = "Starting Cash",
            amount = cleanAmount,
            paidAmount = 0.0,
            category = "STARTING_CASH",
            notes = "Cash at start",
            createdAt = now,
            updatedAt = now
        )
        _transactions.update { current ->
            listOf(tx) + current.filterNot { it.category == "STARTING_CASH" }
        }
        recordAuditLog(actorName, "Updated starting cash to ৳$cleanAmount", "Accounts")
        return id
    }

    fun addStaffMember(
        name: String,
        role: String,
        phone: String,
        salary: Double,
        actorName: String
    ): String {
        val id = "staff_${UUID.randomUUID().toString().take(8)}"
        val now = Timestamp.now()
        val staffMember = StaffMember(
            id = id,
            userId = STORE_USER_ID,
            name = name.trim().take(100),
            role = role,
            phone = phone.trim().take(30),
            salary = salary.coerceAtLeast(0.0),
            active = true,
            createdAt = now,
            updatedAt = now
        )
        _staff.update { (it + staffMember).sortedBy { s -> s.name.lowercase() } }
        recordAuditLog(actorName, "Added staff ${staffMember.name} as $role", "Settings")
        return id
    }

    fun toggleStaffActive(staff: StaffMember, actorName: String) {
        val now = Timestamp.now()
        _staff.update { list ->
            list.map { if (it.id == staff.id) it.copy(active = !it.active, updatedAt = now) else it }
        }
        recordAuditLog(actorName, "Updated status for staff ${staff.name}", "Settings")
    }

    fun updateStaffMember(
        staff: StaffMember,
        name: String,
        role: String,
        phone: String,
        salary: Double,
        active: Boolean,
        actorName: String
    ) {
        val now = Timestamp.now()
        _staff.update { list ->
            list.map {
                if (it.id == staff.id) {
                    it.copy(
                        name = name.trim().take(100),
                        role = role,
                        phone = phone.trim().take(30),
                        salary = salary.coerceAtLeast(0.0),
                        active = active,
                        updatedAt = now
                    )
                } else it
            }.sortedBy { s -> s.name.lowercase() }
        }
        recordAuditLog(actorName, "Updated staff: ${name.trim()} ($role)", "Settings")
    }

    fun deleteStaffMember(staff: StaffMember, actorName: String) {
        val staffName = staff.name
        _staff.update { list -> list.filterNot { it.id == staff.id } }

        val binItem = RecycleBinItem(
            id = "bin_${UUID.randomUUID().toString().take(8)}",
            userId = STORE_USER_ID,
            itemType = "STAFF",
            itemId = staff.id,
            name = staffName,
            details = "Role: ${staff.role} | Phone: ${staff.phone} | Salary: ৳${staff.salary}",
            payloadJson = "",
            deletedBy = actorName,
            deletedAt = Timestamp.now()
        )
        _recycleBin.update { listOf(binItem) + it }
        recordAuditLog(actorName, "Deleted staff: $staffName (moved to Recycle Bin)", "Settings")
    }

    init {
        ensureAuditLogActivated("Admin")
    }

    fun ensureAuditLogActivated(actorName: String = "Admin") {
        if (_auditLogs.value.isEmpty()) {
            val log = AuditLog(
                id = "log_init_${UUID.randomUUID().toString().take(8)}",
                userId = STORE_USER_ID,
                actorName = actorName,
                action = "অডিট লগ সিস্টেম সক্রিয় করা হয়েছে (Audit Log tracking active)",
                module = "System",
                createdAt = Timestamp.now()
            )
            _auditLogs.value = listOf(log)
        }
    }

    fun recordAuditLog(actorName: String, action: String, module: String) {
        val log = AuditLog(
            id = "log_${UUID.randomUUID().toString().take(8)}",
            userId = STORE_USER_ID,
            actorName = actorName.take(100),
            action = action.take(200),
            module = module.take(60),
            createdAt = Timestamp.now()
        )
        _auditLogs.update { listOf(log) + it }
    }

    fun mirrorProducts(cloudProducts: List<Product>) {
        _products.value = cloudProducts
    }

    fun mirrorCustomers(cloudCustomers: List<Customer>) {
        _customers.value = cloudCustomers
    }

    fun mirrorTransactions(cloudTransactions: List<StoreTransaction>) {
        _transactions.value = cloudTransactions
    }

    fun mirrorSuppliers(cloudSuppliers: List<Supplier>) {
        _suppliers.value = cloudSuppliers
    }

    fun mirrorStaff(cloudStaff: List<StaffMember>) {
        _staff.value = cloudStaff
    }

    fun mirrorAuditLogs(cloudLogs: List<AuditLog>) {
        _auditLogs.value = cloudLogs
    }

    fun mirrorRecycleBin(cloudItems: List<RecycleBinItem>) {
        _recycleBin.update { currentLocal ->
            (cloudItems + currentLocal)
                .distinctBy { it.itemId.ifBlank { it.id } }
                .sortedByDescending { it.deletedAt ?: Timestamp(0, 0) }
        }
    }

    fun moveToRecycleBin(item: RecycleBinItem) {
        _recycleBin.update { listOf(item) + it }
    }

    fun removeFromRecycleBin(itemId: String) {
        _recycleBin.update { list -> list.filterNot { it.id == itemId || it.itemId == itemId } }
    }

    fun emptyRecycleBin() {
        _recycleBin.value = emptyList()
    }

    fun resetAllData(actorName: String) {
        resetAllDataAndMoveToRecycleBin(actorName)
    }

    fun resetAllDataAndMoveToRecycleBin(actorName: String) {
        val now = Timestamp.now()
        val newBinItems = mutableListOf<com.example.data.model.RecycleBinItem>()

        _products.value.forEach { prod ->
            newBinItems.add(
                com.example.data.model.RecycleBinItem(
                    id = "bin_prod_${prod.id}",
                    userId = STORE_USER_ID,
                    itemType = "PRODUCT",
                    itemId = prod.id,
                    name = prod.name,
                    details = "Stock: ${prod.stock} ${prod.unit} | Buy: ৳${prod.buyPrice} | Sell: ৳${prod.sellPrice}",
                    payloadJson = "",
                    deletedBy = actorName,
                    deletedAt = now
                )
            )
        }

        _customers.value.forEach { cust ->
            newBinItems.add(
                com.example.data.model.RecycleBinItem(
                    id = "bin_cust_${cust.id}",
                    userId = STORE_USER_ID,
                    itemType = "CUSTOMER",
                    itemId = cust.id,
                    name = cust.name,
                    details = "Phone: ${cust.phone} | Due: ৳${cust.totalDue} | Paid: ৳${cust.totalPaid}",
                    payloadJson = "",
                    deletedBy = actorName,
                    deletedAt = now
                )
            )
        }

        _suppliers.value.forEach { sup ->
            newBinItems.add(
                com.example.data.model.RecycleBinItem(
                    id = "bin_sup_${sup.id}",
                    userId = STORE_USER_ID,
                    itemType = "SUPPLIER",
                    itemId = sup.id,
                    name = sup.name,
                    details = "Phone: ${sup.phone} | Payable: ৳${sup.payableBalance}",
                    payloadJson = "",
                    deletedBy = actorName,
                    deletedAt = now
                )
            )
        }

        _transactions.value.forEach { tx ->
            newBinItems.add(
                com.example.data.model.RecycleBinItem(
                    id = "bin_tx_${tx.id}",
                    userId = STORE_USER_ID,
                    itemType = if (tx.type == "EXPENSE") "EXPENSE" else "TRANSACTION",
                    itemId = tx.id,
                    name = tx.title.ifBlank { tx.type },
                    details = "Type: ${tx.type} | Amount: ৳${tx.amount} | Due: ৳${tx.dueAmount} | ${tx.notes}",
                    payloadJson = "",
                    deletedBy = actorName,
                    deletedAt = now
                )
            )
        }

        _staff.value.forEach { st ->
            newBinItems.add(
                com.example.data.model.RecycleBinItem(
                    id = "bin_staff_${st.id}",
                    userId = STORE_USER_ID,
                    itemType = "STAFF",
                    itemId = st.id,
                    name = st.name,
                    details = "Role: ${st.role} | Phone: ${st.phone} | Salary: ৳${st.salary}",
                    payloadJson = "",
                    deletedBy = actorName,
                    deletedAt = now
                )
            )
        }

        _recycleBin.update { newBinItems + it }

        _products.value = emptyList()
        _customers.value = emptyList()
        _transactions.value = emptyList()
        _suppliers.value = emptyList()
        _staff.value = emptyList()
        recordAuditLog(actorName, "Store reset: moved ${newBinItems.size} items to Recycle Bin", "Settings")
    }
}

