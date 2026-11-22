package com.example.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.model.AuditLog
import com.example.data.model.CartItem
import com.example.data.model.Customer
import com.example.data.model.Product
import com.example.data.model.RecycleBinItem
import com.example.data.model.StaffMember
import com.example.data.model.StoreTransaction
import com.example.data.model.Supplier
import com.example.data.repository.DokanRepository
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Calendar

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

enum class CustomerDueFilter {
    ALL, HAS_DUES, NO_DUES
}

data class DailyStats(
    val todaysSale: Double = 0.0,
    val todaysSaleCount: Int = 0,
    val todaysProfit: Double = 0.0,
    val todaysGivenDue: Double = 0.0,
    val todaysGivenDueCustomerCount: Int = 0,
    val todaysReceivedMoney: Double = 0.0,
    val totalCashIn: Double = 0.0,
    val totalCashOut: Double = 0.0
)

class DokanViewModel(
    private val repository: DokanRepository
) : ViewModel() {

    val productsState: StateFlow<UiState<List<Product>>> =
        repository.observeProducts().toUiStateFlow("products")

    val customersState: StateFlow<UiState<List<Customer>>> =
        repository.observeCustomers().toUiStateFlow("customers")

    val transactionsState: StateFlow<UiState<List<StoreTransaction>>> =
        repository.observeTransactions().toUiStateFlow("transactions")

    val suppliersState: StateFlow<UiState<List<Supplier>>> =
        repository.observeSuppliers().toUiStateFlow("suppliers")

    val staffState: StateFlow<UiState<List<StaffMember>>> =
        repository.observeStaff().toUiStateFlow("staff")

    val auditLogsState: StateFlow<UiState<List<AuditLog>>> =
        repository.observeAuditLogs().toUiStateFlow("audit_logs")

    val recycleBinState: StateFlow<UiState<List<RecycleBinItem>>> =
        repository.observeRecycleBin().toUiStateFlow("recycle_bin")

    private val _cartItems = MutableStateFlow<List<CartItem>>(emptyList())
    val cartItems: StateFlow<List<CartItem>> = _cartItems.asStateFlow()

    private val _productSearchQuery = MutableStateFlow("")
    val productSearchQuery: StateFlow<String> = _productSearchQuery.asStateFlow()

    private val _customerSearchQuery = MutableStateFlow("")
    val customerSearchQuery: StateFlow<String> = _customerSearchQuery.asStateFlow()

    private val _customerFilter = MutableStateFlow(CustomerDueFilter.ALL)
    val customerFilter: StateFlow<CustomerDueFilter> = _customerFilter.asStateFlow()

    private val _statusBanner = MutableStateFlow<String?>(null)
    val statusBanner: StateFlow<String?> = _statusBanner.asStateFlow()

    private val _isBusy = MutableStateFlow(false)
    val isBusy: StateFlow<Boolean> = _isBusy.asStateFlow()

    fun clearBanner() {
        _statusBanner.value = null
    }

    fun setProductSearchQuery(query: String) {
        _productSearchQuery.value = query
    }

    fun setCustomerSearchQuery(query: String) {
        _customerSearchQuery.value = query
    }

    fun setCustomerFilter(filter: CustomerDueFilter) {
        _customerFilter.value = filter
    }

    // --- POS Cart Management ---

    fun addToCart(product: Product, qty: Double = 1.0) {
        _cartItems.update { current ->
            val index = current.indexOfFirst { it.product.id == product.id }
            if (index >= 0) {
                val existing = current[index]
                val updated = existing.copy(quantity = (existing.quantity + qty).coerceAtLeast(0.5))
                current.toMutableList().also { it[index] = updated }
            } else {
                current + CartItem(product = product, quantity = qty)
            }
        }
    }

    fun updateCartItemQuantity(productId: String, newQty: Double) {
        _cartItems.update { current ->
            if (newQty <= 0.0) {
                current.filterNot { it.product.id == productId }
            } else {
                current.map {
                    if (it.product.id == productId) it.copy(quantity = newQty) else it
                }
            }
        }
    }

    fun updateCartItemDetails(
        productId: String,
        newQty: Double? = null,
        newUnit: String? = null,
        newUnitPrice: Double? = null
    ) {
        _cartItems.update { current ->
            current.map { item ->
                if (item.product.id == productId) {
                    item.copy(
                        quantity = newQty?.coerceAtLeast(0.01) ?: item.quantity,
                        customUnit = newUnit ?: item.customUnit,
                        customUnitPrice = newUnitPrice?.coerceAtLeast(0.0) ?: item.customUnitPrice
                    )
                } else {
                    item
                }
            }
        }
    }

    fun removeFromCart(productId: String) {
        _cartItems.update { current ->
            current.filterNot { it.product.id == productId }
        }
    }

    fun clearCart() {
        _cartItems.value = emptyList()
    }

    // --- Store Actions ---

    fun addProduct(
        name: String,
        category: String,
        unit: String,
        buyPrice: Double,
        sellPrice: Double,
        initialStock: Double,
        lowStockThreshold: Double,
        barcode: String,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.addProduct(
                name = name,
                category = category,
                unit = unit,
                buyPrice = buyPrice,
                sellPrice = sellPrice,
                initialStock = initialStock,
                lowStockThreshold = lowStockThreshold,
                barcode = barcode
            )
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Product '$name' added to inventory."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to add product: ${e.localizedMessage ?: "Error"}"
            }
        }
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
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.updateProduct(
                product = product,
                name = name,
                category = category,
                unit = unit,
                buyPrice = buyPrice,
                sellPrice = sellPrice,
                stock = stock,
                lowStockThreshold = lowStockThreshold,
                barcode = barcode
            )
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Product '$name' updated."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to update product: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun adjustProductStock(
        product: Product,
        delta: Double,
        reason: String,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.adjustProductStock(product, delta, reason)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Updated stock for ${product.name}."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Stock update failed: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun voidStockAdjustment(
        product: Product,
        transaction: StoreTransaction?,
        signedDeltaToReverse: Double,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.voidStockAdjustment(
                product = product,
                transaction = transaction,
                signedDeltaToReverse = signedDeltaToReverse
            )
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Stock entry voided for ${product.name}."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Could not void stock entry: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun deleteProduct(product: Product, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.deleteProduct(product.id, product.name)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Removed ${product.name}."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Delete failed: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun addCustomer(
        name: String,
        phone: String,
        address: String,
        initialDue: Double,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.addCustomer(name, phone, address, initialDue)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Customer '$name' added."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to add customer: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun updateCustomer(
        customer: Customer,
        name: String,
        phone: String,
        address: String,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.updateCustomer(customer, name, phone, address)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Customer '$name' updated."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to update customer: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun deleteCustomer(
        customer: Customer,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.deleteCustomer(customer.id, customer.name)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Deleted customer ${customer.name}."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Delete failed: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun recordCustomerDueOrPayment(
        customer: Customer,
        amount: Double,
        isGiveDue: Boolean,
        notes: String,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.recordCustomerDueOrPayment(customer, amount, isGiveDue, notes)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = if (isGiveDue) {
                    "Recorded ৳${formatMoney(amount)} due for ${customer.name}."
                } else {
                    "Received ৳${formatMoney(amount)} from ${customer.name}."
                }
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Transaction failed: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun checkoutCartSale(
        paidAmount: Double,
        selectedCustomer: Customer?,
        notes: String,
        discountAmount: Double = 0.0,
        newCustomerName: String = "",
        newCustomerPhone: String = "",
        newCustomerAddress: String = "",
        onComplete: (StoreTransaction) -> Unit = {}
    ) {
        val currentCart = _cartItems.value
        if (currentCart.isEmpty()) return
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.recordPosSale(
                cartItems = currentCart,
                paidAmount = paidAmount,
                selectedCustomer = selectedCustomer,
                notes = notes,
                discountAmount = discountAmount,
                newCustomerName = newCustomerName,
                newCustomerPhone = newCustomerPhone,
                newCustomerAddress = newCustomerAddress
            )
            _isBusy.value = false
            result.onSuccess { createdTx ->
                _cartItems.value = emptyList()
                onComplete(createdTx)
            }.onFailure { e ->
                _statusBanner.value = "Checkout failed: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun returnOrVoidSale(
        transaction: StoreTransaction,
        currentProducts: List<Product>,
        currentCustomers: List<Customer>,
        isReturn: Boolean,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.returnOrVoidSale(
                transaction = transaction,
                currentProducts = currentProducts,
                currentCustomers = currentCustomers,
                isReturn = isReturn
            )
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = if (isReturn) {
                    "Sale returned — stock restored & customer ledger updated."
                } else {
                    "Sale voided — stock restored & customer ledger updated."
                }
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Could not process sale return/void: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun addSupplier(
        name: String,
        phone: String,
        company: String,
        initialPayable: Double,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.addSupplier(name, phone, company, initialPayable)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Supplier '$name' added."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to add supplier: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun updateSupplier(
        supplier: Supplier,
        name: String,
        phone: String,
        company: String,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.updateSupplier(supplier, name, phone, company)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Supplier '$name' updated."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to update supplier: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun deleteSupplier(
        supplier: Supplier,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.deleteSupplier(supplier.id, supplier.name)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Deleted supplier ${supplier.name}."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Delete failed: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun addSupplierOwed(
        supplier: Supplier,
        amount: Double,
        notes: String,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.addSupplierOwed(supplier, amount, notes)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Added ৳${formatMoney(amount)} owed for ${supplier.name}."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Could not add owed: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun recordStockPurchase(
        product: Product?,
        supplier: Supplier?,
        quantity: Double,
        totalCost: Double,
        paidCash: Double,
        notes: String,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.recordStockPurchase(product, supplier, quantity, totalCost, paidCash, notes)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Stock purchase recorded."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Purchase failed: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun recordMultiItemPurchase(
        cartItems: List<CartItem>,
        paidAmount: Double,
        selectedSupplier: Supplier?,
        newSupplierName: String = "",
        updateBuyingPrice: Boolean = true,
        notes: String = "",
        onComplete: (StoreTransaction) -> Unit = {}
    ) {
        if (cartItems.isEmpty()) return
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.recordMultiItemPurchase(
                cartItems = cartItems,
                paidAmount = paidAmount,
                selectedSupplier = selectedSupplier,
                newSupplierName = newSupplierName,
                updateBuyingPrice = updateBuyingPrice,
                notes = notes
            )
            _isBusy.value = false
            result.onSuccess { createdTx ->
                onComplete(createdTx)
            }.onFailure { e ->
                _statusBanner.value = "Purchase failed: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun voidPurchase(
        transaction: StoreTransaction,
        currentProducts: List<Product>,
        currentSuppliers: List<Supplier>,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.voidPurchase(
                transaction = transaction,
                currentProducts = currentProducts,
                currentSuppliers = currentSuppliers
            )
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Purchase voided — stock & supplier ledger updated."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Could not void purchase: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun paySupplier(
        supplier: Supplier,
        amount: Double,
        notes: String,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.paySupplier(supplier, amount, notes)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Paid ৳${formatMoney(amount)} to ${supplier.name}."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Payment failed: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun recordExpense(
        title: String,
        category: String,
        amount: Double,
        notes: String,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.recordExpense(title, category, amount, notes)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Expense '$title' saved."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to save expense: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun deleteExpense(
        transaction: StoreTransaction,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.deleteExpense(transaction.id, transaction.title)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Expense '${transaction.title}' removed."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to remove expense: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun deleteTransaction(
        transaction: StoreTransaction,
        onComplete: () -> Unit = {}
    ) {
        val currentCust = (customersState.value as? UiState.Success)?.data ?: emptyList()
        val currentSups = (suppliersState.value as? UiState.Success)?.data ?: emptyList()
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.deleteTransaction(
                transaction = transaction,
                currentCustomers = currentCust,
                currentSuppliers = currentSups
            )
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Transaction '${transaction.title}' removed and balances adjusted."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to remove transaction: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun recordAuditLog(
        action: String,
        module: String = "System"
    ) {
        viewModelScope.launch {
            repository.recordAuditLog(action, module)
        }
    }

    fun setStartingCash(
        amount: Double,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.setStartingCash(amount)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Starting cash updated to ৳${formatMoney(amount)}."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to update starting cash: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun addStaffMember(
        name: String,
        role: String,
        phone: String,
        salary: Double,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.addStaffMember(name, role, phone, salary)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Staff member '$name' added."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to add staff: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun toggleStaffActive(staff: StaffMember) {
        viewModelScope.launch {
            repository.toggleStaffActive(staff)
        }
    }

    fun updateStaffMember(
        staff: StaffMember,
        name: String,
        role: String,
        phone: String,
        salary: Double,
        active: Boolean,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.updateStaffMember(staff, name, role, phone, salary, active)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Staff member '$name' updated."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to update staff: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun deleteStaffMember(
        staff: StaffMember,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.deleteStaffMember(staff)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Staff member '${staff.name}' deleted and moved to Recycle Bin."
                onComplete()
            }.onFailure { e ->
                _statusBanner.value = "Failed to delete staff: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    fun restoreRecycleItem(item: RecycleBinItem) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.restoreRecycleItem(item)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "‘${item.name}’ সফলভাবে পুনরুদ্ধার করা হয়েছে।"
            }.onFailure { e ->
                _statusBanner.value = "পুনরুদ্ধার করা যায়নি: ${e.localizedMessage ?: "ত্রুটি"}"
            }
        }
    }

    fun deletePermanentlyFromRecycleBin(binId: String) {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.deletePermanentlyFromRecycleBin(binId)
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "আইটেম স্থায়ীভাবে মুছে ফেলা হয়েছে।"
            }.onFailure { e ->
                _statusBanner.value = "মুছে ফেলা যায়নি: ${e.localizedMessage ?: "ত্রুটি"}"
            }
        }
    }

    fun emptyRecycleBin() {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.emptyRecycleBin()
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "রিসাইকেল বিন সম্পূর্ণ খালি করা হয়েছে।"
            }.onFailure { e ->
                _statusBanner.value = "বিন খালি করা যায়নি: ${e.localizedMessage ?: "ত্রুটি"}"
            }
        }
    }

    fun resetAllStoreData(onCompleted: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            _isBusy.value = true
            val currentProds = (productsState.value as? UiState.Success)?.data ?: emptyList()
            val currentCusts = (customersState.value as? UiState.Success)?.data ?: emptyList()
            val currentTxs = (transactionsState.value as? UiState.Success)?.data ?: emptyList()
            val currentSups = (suppliersState.value as? UiState.Success)?.data ?: emptyList()
            val currentStaff = (staffState.value as? UiState.Success)?.data ?: emptyList()

            val result = repository.resetAllStoreData(
                activeProducts = currentProds,
                activeCustomers = currentCusts,
                activeTransactions = currentTxs,
                activeSuppliers = currentSups,
                activeStaff = currentStaff
            )
            _cartItems.value = emptyList()
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "সকল স্টোর ডাটা সফলভাবে মুছে রিসাইকেল বিনে স্থানান্তর করা হয়েছে!"
                onCompleted(true)
            }.onFailure { e ->
                _statusBanner.value = "ডাটা রিসেট ব্যর্থ: ${e.localizedMessage ?: "ত্রুটি"}"
                onCompleted(false)
            }
        }
    }

    fun seedSampleStore() {
        viewModelScope.launch {
            _isBusy.value = true
            val result = repository.seedSampleDokanData()
            _isBusy.value = false
            result.onSuccess {
                _statusBanner.value = "Sample products, customers, suppliers, and expenses loaded!"
            }.onFailure { e ->
                _statusBanner.value = "Could not load sample data: ${e.localizedMessage ?: "Error"}"
            }
        }
    }

    private fun <T> Flow<List<T>>.toUiStateFlow(label: String): StateFlow<UiState<List<T>>> {
        return this
            .map<List<T>, UiState<List<T>>> { UiState.Success(it) }
            .catch { error ->
                val firestoreError = generateSequence(error) { it.cause }
                    .filterIsInstance<FirebaseFirestoreException>()
                    .firstOrNull()
                if (firestoreError == null && error is CancellationException) throw error
                val rootError = firestoreError ?: error
                Log.w("DokanViewModel", "Error observing $label", rootError)
                emit(UiState.Error(rootError.message ?: "Failed to load $label"))
            }
            .stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5000L),
                initialValue = UiState.Loading
            )
    }

    companion object {
        fun calculateDailyStats(transactions: List<StoreTransaction>): DailyStats {
            val startOfToday = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis

            var todaysSale = 0.0
            var todaysSaleCount = 0
            var todaysProfit = 0.0
            var todaysGivenDue = 0.0
            var todaysReceivedMoney = 0.0
            var totalCashIn = 0.0
            var totalCashOut = 0.0
            val todaysGivenDueCustomers = mutableSetOf<String>()

            for (tx in transactions) {
                val txMillis = (tx.createdAt ?: Timestamp.now()).toDate().time
                val isToday = txMillis >= startOfToday

                when (tx.type) {
                    "SALE" -> {
                        totalCashIn += tx.paidAmount
                        if (isToday) {
                            todaysSale += tx.amount
                            todaysSaleCount += 1
                            todaysProfit += tx.profitAmount
                            todaysGivenDue += tx.dueAmount
                            todaysReceivedMoney += tx.paidAmount
                            if (tx.dueAmount > 0.0) {
                                val key = (tx.customerId.ifBlank { tx.customerName }.ifBlank { tx.id }).trim().lowercase()
                                if (key.isNotEmpty()) todaysGivenDueCustomers.add(key)
                            }
                        }
                    }
                    "GIVE_DUE" -> {
                        if (isToday) {
                            val dueAmt = tx.dueAmount.coerceAtLeast(tx.amount)
                            todaysGivenDue += dueAmt
                            if (dueAmt > 0.0) {
                                val key = (tx.customerId.ifBlank { tx.customerName }.ifBlank { tx.id }).trim().lowercase()
                                if (key.isNotEmpty()) todaysGivenDueCustomers.add(key)
                            }
                        }
                    }
                    "RECEIVE_PAYMENT" -> {
                        totalCashIn += tx.paidAmount.coerceAtLeast(tx.amount)
                        if (isToday) {
                            todaysReceivedMoney += tx.paidAmount.coerceAtLeast(tx.amount)
                        }
                    }
                    "PURCHASE" -> {
                        totalCashOut += tx.paidAmount
                    }
                    "SUPPLIER_PAYMENT" -> {
                        totalCashOut += tx.paidAmount.coerceAtLeast(tx.amount)
                    }
                    "EXPENSE" -> {
                        totalCashOut += tx.paidAmount.coerceAtLeast(tx.amount)
                    }
                }
            }

            return DailyStats(
                todaysSale = todaysSale,
                todaysSaleCount = todaysSaleCount,
                todaysProfit = todaysProfit,
                todaysGivenDue = todaysGivenDue,
                todaysGivenDueCustomerCount = todaysGivenDueCustomers.size,
                todaysReceivedMoney = todaysReceivedMoney,
                totalCashIn = totalCashIn,
                totalCashOut = totalCashOut
            )
        }

        fun formatMoney(value: Double): String {
            return if (value % 1.0 == 0.0) {
                "%,d".format(value.toLong())
            } else {
                "%,.2f".format(value)
            }
        }
    }
}
