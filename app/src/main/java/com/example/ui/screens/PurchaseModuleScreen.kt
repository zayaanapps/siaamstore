package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.CartItem
import com.example.data.model.Product
import com.example.data.model.SaleLineItem
import com.example.data.model.StoreTransaction
import com.example.data.model.Supplier
import com.example.ui.i18n.AppLanguage
import com.google.firebase.Timestamp
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

private val PurchaseCreamBg = Color(0xFFF0F9F5)
private val PurchaseCardBorder = Color(0xFFB6EADA)
private val PurchaseTerracotta = Color(0xFF00B368)
private val PurchaseGreen = Color(0xFF00B368)
private val PurchaseDarkGreen = Color(0xFF00A862)
private val PurchaseDangerRed = Color(0xFFE11D48)
private val PurchaseDangerBg = Color(0xFFFFF1F2)
private val PurchaseTextPrimary = Color(0xFF0F172A)
private val PurchaseTextSecondary = Color(0xFF64748B)
private val PurchaseCheckboxBlue = Color(0xFF00B368)

private enum class PurchaseSubView {
    LIST,
    NEW_PURCHASE,
    COMPLETE,
    DETAIL
}

private enum class PurchaseTimeFilter {
    THIS_MONTH,
    ALL
}

private enum class PurchasePaymentMode {
    FULL_CASH,
    FULL_CREDIT,
    PART_CREDIT
}

private fun formatCleanNum(value: Double): String {
    return if (value % 1.0 == 0.0) {
        value.toLong().toString()
    } else {
        "%.2f".format(Locale.US, value)
    }
}

@Composable
fun PurchaseModuleScreen(
    products: List<Product>,
    suppliers: List<Supplier>,
    purchaseTransactions: List<StoreTransaction>,
    onBackToMoreMenu: () -> Unit,
    onCompletePurchase: (
        cartItems: List<CartItem>,
        paidAmount: Double,
        selectedSupplier: Supplier?,
        newSupplierName: String,
        updateBuyingPrice: Boolean,
        notes: String,
        onCompleted: (StoreTransaction) -> Unit
    ) -> Unit,
    onVoidPurchase: (
        transaction: StoreTransaction,
        onVoided: () -> Unit
    ) -> Unit,
    language: AppLanguage = AppLanguage.BENGALI
) {
    val isBn = language == AppLanguage.BENGALI
    var currentView by rememberSaveable { mutableStateOf(PurchaseSubView.LIST) }
    var timeFilter by rememberSaveable { mutableStateOf(PurchaseTimeFilter.THIS_MONTH) }
    var activeTransactionId by rememberSaveable { mutableStateOf<String?>(null) }
    var lastCompletedTx by remember { mutableStateOf<StoreTransaction?>(null) }

    // Sorted oldest-to-newest for assigning stable Purchase #1, #2, ...
    val chronologicalIds = remember(purchaseTransactions) {
        purchaseTransactions
            .sortedBy { it.createdAt?.toDate()?.time ?: 0L }
            .mapIndexed { idx, tx -> tx.id to (idx + 1) }
            .toMap()
    }

    val activeTransaction = remember(purchaseTransactions, activeTransactionId, lastCompletedTx) {
        activeTransactionId?.let { id ->
            purchaseTransactions.firstOrNull { it.id == id }
                ?: lastCompletedTx?.takeIf { it.id == id }
        } ?: lastCompletedTx
    }

    BackHandler {
        when (currentView) {
            PurchaseSubView.LIST -> onBackToMoreMenu()
            PurchaseSubView.NEW_PURCHASE -> currentView = PurchaseSubView.LIST
            PurchaseSubView.COMPLETE -> currentView = PurchaseSubView.LIST
            PurchaseSubView.DETAIL -> currentView = PurchaseSubView.LIST
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PurchaseCreamBg)
    ) {
        when (currentView) {
            PurchaseSubView.LIST -> {
                PurchasesListView(
                    isBn = isBn,
                    purchaseTransactions = purchaseTransactions,
                    chronologicalIds = chronologicalIds,
                    timeFilter = timeFilter,
                    onTimeFilterChange = { timeFilter = it },
                    onBack = onBackToMoreMenu,
                    onStartNewPurchase = {
                        currentView = PurchaseSubView.NEW_PURCHASE
                    },
                    onSelectPurchase = { tx ->
                        activeTransactionId = tx.id
                        lastCompletedTx = tx
                        currentView = PurchaseSubView.DETAIL
                    }
                )
            }

            PurchaseSubView.NEW_PURCHASE -> {
                NewPurchaseFormView(
                    isBn = isBn,
                    products = products,
                    suppliers = suppliers,
                    onBack = { currentView = PurchaseSubView.LIST },
                    onSubmitPurchase = { cartItems, paidAmt, selSupplier, newSupName, updateBuyPrice, note ->
                        onCompletePurchase(
                            cartItems,
                            paidAmt,
                            selSupplier,
                            newSupName,
                            updateBuyPrice,
                            note
                        ) { createdTx ->
                            lastCompletedTx = createdTx
                            activeTransactionId = createdTx.id
                            currentView = PurchaseSubView.COMPLETE
                        }
                    }
                )
            }

            PurchaseSubView.COMPLETE -> {
                val tx = activeTransaction
                if (tx == null) {
                    currentView = PurchaseSubView.LIST
                } else {
                    PurchaseCompleteView(
                        isBn = isBn,
                        transaction = tx,
                        onOpenDetails = {
                            activeTransactionId = tx.id
                            currentView = PurchaseSubView.DETAIL
                        },
                        onStartNewPurchase = {
                            currentView = PurchaseSubView.NEW_PURCHASE
                        },
                        onBackToPurchases = {
                            currentView = PurchaseSubView.LIST
                        }
                    )
                }
            }

            PurchaseSubView.DETAIL -> {
                val tx = activeTransaction
                if (tx == null) {
                    currentView = PurchaseSubView.LIST
                } else {
                    val purchaseNumber = chronologicalIds[tx.id] ?: (purchaseTransactions.size.coerceAtLeast(1))
                    PurchaseDetailView(
                        isBn = isBn,
                        transaction = tx,
                        purchaseNumber = purchaseNumber,
                        onBack = { currentView = PurchaseSubView.LIST },
                        onVoidPurchase = {
                            onVoidPurchase(tx) {
                                activeTransactionId = null
                                lastCompletedTx = null
                                currentView = PurchaseSubView.LIST
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun PurchasesListView(
    isBn: Boolean,
    purchaseTransactions: List<StoreTransaction>,
    chronologicalIds: Map<String, Int>,
    timeFilter: PurchaseTimeFilter,
    onTimeFilterChange: (PurchaseTimeFilter) -> Unit,
    onBack: () -> Unit,
    onStartNewPurchase: () -> Unit,
    onSelectPurchase: (StoreTransaction) -> Unit
) {
    val startOfMonthMillis = remember {
        Calendar.getInstance().apply {
            set(Calendar.DAY_OF_MONTH, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }

    val filteredPurchases = remember(purchaseTransactions, timeFilter, startOfMonthMillis) {
        when (timeFilter) {
            PurchaseTimeFilter.THIS_MONTH -> {
                purchaseTransactions.filter { tx ->
                    val millis = (tx.createdAt ?: Timestamp.now()).toDate().time
                    millis >= startOfMonthMillis
                }
            }
            PurchaseTimeFilter.ALL -> purchaseTransactions
        }
    }

    val totalAmount = remember(filteredPurchases) {
        filteredPurchases.sumOf { it.amount }
    }
    val dateFormat = remember { SimpleDateFormat("d MMM yyyy", Locale.US) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Header: [←] Purchases
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Surface(
                    onClick = onBack,
                    shape = RoundedCornerShape(10.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, PurchaseCardBorder),
                    modifier = Modifier
                        .size(40.dp)
                        .testTag("purchases_back_button")
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = PurchaseTextPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Text(
                    text = if (isBn) "ক্রয় ও মাল কেনা" else "Purchases",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = PurchaseTextPrimary
                )
            }
        }

        // 2. Full-width "🧾 New purchase" Button
        item {
            Button(
                onClick = onStartNewPurchase,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = PurchaseTerracotta,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .testTag("new_purchase_button")
            ) {
                Text(text = "🧾", fontSize = 16.sp)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isBn) "নতুন ক্রয়" else "New purchase",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // 3. Segmented Filter Bar: "This month" | "All"
        item {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = Color.White,
                border = BorderStroke(1.dp, PurchaseCardBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val tabs = listOf(
                        PurchaseTimeFilter.THIS_MONTH to (if (isBn) "এই মাস" else "This month"),
                        PurchaseTimeFilter.ALL to (if (isBn) "সব" else "All")
                    )
                    tabs.forEach { (tab, label) ->
                        val isSelected = timeFilter == tab
                        Box(
                            modifier = Modifier
                                .clip(if (isSelected) RoundedCornerShape(10.dp) else RoundedCornerShape(0.dp))
                                .background(if (isSelected) PurchaseTerracotta else Color.Transparent)
                                .clickable { onTimeFilterChange(tab) }
                                .padding(horizontal = 18.dp, vertical = 11.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                fontSize = 14.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSelected) Color.White else PurchaseTextPrimary
                            )
                        }
                    }
                }
            }
        }

        // 4. Summary Card: "৳ 0" + "Total purchases (0)" with decorative top-right circle
        item {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color.White,
                border = BorderStroke(1.dp, PurchaseCardBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .align(Alignment.TopEnd)
                            .offset(x = 16.dp, y = (-16).dp)
                            .clip(CircleShape)
                            .background(PurchaseTerracotta.copy(alpha = 0.08f))
                    )
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp, vertical = 16.dp)
                    ) {
                        Text(
                            text = "৳ ${formatCleanNum(totalAmount)}",
                            fontSize = 26.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = PurchaseTextPrimary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (isBn) "মোট ক্রয় (${filteredPurchases.size})" else "Total purchases (${filteredPurchases.size})",
                            fontSize = 13.5.sp,
                            color = PurchaseTextSecondary
                        )
                    }
                }
            }
        }

        // 5. Empty State OR Purchases List Card
        if (filteredPurchases.isEmpty()) {
            item {
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, PurchaseCardBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 44.dp, horizontal = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(text = "🛍️", fontSize = 36.sp)
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = if (isBn) "এখনো কোনো ক্রয় করা হয়নি।" else "No purchases yet.",
                            fontSize = 15.sp,
                            color = PurchaseTextSecondary,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            item {
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, PurchaseCardBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        filteredPurchases.forEachIndexed { idx, tx ->
                            val purchaseNo = chronologicalIds[tx.id] ?: (filteredPurchases.size - idx)
                            val dateStr = tx.createdAt?.toDate()?.let { dateFormat.format(it) } ?: (if (isBn) "আজ" else "Today")
                            val supplierLabel = tx.supplierName.ifBlank { if (isBn) "মহাজন নেই" else "No supplier" }

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onSelectPurchase(tx) }
                                    .padding(horizontal = 18.dp, vertical = 15.dp)
                                    .testTag("purchase_row_${tx.id}"),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = if (isBn) "ক্রয় #$purchaseNo" else "Purchase #$purchaseNo",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = PurchaseTextPrimary
                                    )
                                    Spacer(modifier = Modifier.height(3.dp))
                                    Text(
                                        text = "$dateStr · $supplierLabel · ${tx.title}",
                                        fontSize = 13.sp,
                                        color = PurchaseTextSecondary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = "৳ ${formatCleanNum(tx.amount)}",
                                        fontSize = 16.5.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = PurchaseTextPrimary
                                    )
                                    if (tx.dueAmount > 0.0) {
                                        Text(
                                            text = if (isBn) "বাকি: ৳ ${formatCleanNum(tx.dueAmount)}" else "Due: ৳ ${formatCleanNum(tx.dueAmount)}",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = PurchaseTerracotta
                                        )
                                    }
                                }
                            }

                            if (idx < filteredPurchases.lastIndex) {
                                HorizontalDivider(color = Color(0xFFF1ECE6))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NewPurchaseFormView(
    isBn: Boolean,
    products: List<Product>,
    suppliers: List<Supplier>,
    onBack: () -> Unit,
    onSubmitPurchase: (
        cartItems: List<CartItem>,
        paidAmount: Double,
        selectedSupplier: Supplier?,
        newSupplierName: String,
        updateBuyingPrice: Boolean,
        notes: String
    ) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var purchaseCart by remember { mutableStateOf<List<CartItem>>(emptyList()) }
    var paymentMode by remember { mutableStateOf(PurchasePaymentMode.FULL_CASH) }
    var partPaidText by remember { mutableStateOf("") }

    var supplierSearchText by remember { mutableStateOf("") }
    var selectedSupplier by remember { mutableStateOf<Supplier?>(null) }
    var updateBuyingPrice by remember { mutableStateOf(true) }
    var noteText by remember { mutableStateOf("") }

    val filteredProducts = remember(products, searchQuery) {
        if (searchQuery.isBlank()) {
            products
        } else {
            val q = searchQuery.trim().lowercase()
            products.filter {
                it.name.lowercase().contains(q) ||
                    it.barcode.lowercase().contains(q) ||
                    it.category.lowercase().contains(q)
            }
        }
    }

    val matchingSuppliers = remember(suppliers, supplierSearchText) {
        val q = supplierSearchText.trim().lowercase()
        if (q.isEmpty()) {
            emptyList()
        } else {
            suppliers.filter {
                it.name.lowercase().contains(q) || it.phone.lowercase().contains(q)
            }
        }
    }

    val exactSupplierMatch = remember(suppliers, supplierSearchText) {
        val q = supplierSearchText.trim()
        suppliers.firstOrNull { it.name.equals(q, ignoreCase = true) }
    }

    val totalAmount = remember(purchaseCart) {
        purchaseCart.sumOf { it.lineTotal }.coerceAtLeast(0.0)
    }

    val paidAmount = when (paymentMode) {
        PurchasePaymentMode.FULL_CASH -> totalAmount
        PurchasePaymentMode.FULL_CREDIT -> 0.0
        PurchasePaymentMode.PART_CREDIT -> (partPaidText.toDoubleOrNull() ?: 0.0).coerceIn(0.0, totalAmount)
    }
    val dueAmount = (totalAmount - paidAmount).coerceAtLeast(0.0)
    val hasSupplier = selectedSupplier != null || supplierSearchText.trim().isNotBlank()
    val canComplete = purchaseCart.isNotEmpty() && totalAmount >= 0.0 && (dueAmount <= 0.0 || hasSupplier)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // 1. Header Row: [←] New purchase  ...  Clear cart
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    onClick = onBack,
                    shape = RoundedCornerShape(10.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, PurchaseCardBorder),
                    modifier = Modifier
                        .size(40.dp)
                        .testTag("new_purchase_back_button")
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = PurchaseTextPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Text(
                    text = if (isBn) "নতুন ক্রয়" else "New purchase",
                    fontSize = 23.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = PurchaseTextPrimary
                )
            }

            if (purchaseCart.isNotEmpty()) {
                TextButton(
                    onClick = { purchaseCart = emptyList() },
                    modifier = Modifier.testTag("purchase_clear_cart_button")
                ) {
                    Text(
                        text = if (isBn) "কার্ট খালি করুন" else "Clear cart",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PurchaseTerracotta
                    )
                }
            }
        }

        // 2. Search input: "Product name, barcode or category..."
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = {
                Text(
                    text = if (isBn) "পণ্যের নাম, বারকোড বা ক্যাটাগরি..." else "Product name, barcode or category...",
                    color = PurchaseTextSecondary,
                    fontSize = 15.sp
                )
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color.White,
                unfocusedContainerColor = Color.White,
                focusedBorderColor = PurchaseTerracotta,
                unfocusedBorderColor = PurchaseCardBorder,
                focusedTextColor = PurchaseTextPrimary,
                unfocusedTextColor = PurchaseTextPrimary
            ),
            modifier = Modifier
                .fillMaxWidth()
                .testTag("purchase_product_search_input")
        )

        // 3. Product Picker Card (e.g. "গম · 50 kg" on left, "৳ 50/kg" on right)
        if (filteredProducts.isNotEmpty()) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color.White,
                border = BorderStroke(1.dp, PurchaseCardBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    filteredProducts.forEachIndexed { index, product ->
                        val displayBuyPrice = if (product.buyPrice > 0.0) product.buyPrice else product.sellPrice
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    val existingIdx = purchaseCart.indexOfFirst { it.product.id == product.id }
                                    purchaseCart = if (existingIdx >= 0) {
                                        val current = purchaseCart[existingIdx]
                                        purchaseCart.toMutableList().also {
                                            it[existingIdx] = current.copy(quantity = current.quantity + 1.0)
                                        }
                                    } else {
                                        purchaseCart + CartItem(
                                            product = product,
                                            quantity = 1.0,
                                            customUnit = product.unit,
                                            customUnitPrice = displayBuyPrice
                                        )
                                    }
                                }
                                .padding(horizontal = 18.dp, vertical = 14.dp)
                                .testTag("purchase_pick_product_${product.id}"),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = product.name,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PurchaseTextPrimary
                                )
                                Text(
                                    text = " · ${formatCleanNum(product.stock)} ${product.unit}",
                                    fontSize = 14.5.sp,
                                    color = PurchaseTextSecondary
                                )
                            }

                            Text(
                                text = "৳ ${formatCleanNum(displayBuyPrice)}/${product.unit}",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = PurchaseTextPrimary
                            )
                        }

                        if (index < filteredProducts.lastIndex) {
                            HorizontalDivider(color = Color(0xFFF1ECE6))
                        }
                    }
                }
            }
        }

        // 4. Purchase Cart Item Cards
        purchaseCart.forEach { cartItem ->
            PurchaseCartItemCard(
                isBn = isBn,
                cartItem = cartItem,
                onUpdateItem = { newQty, newUnit, newBuyPrice ->
                    purchaseCart = purchaseCart.map { item ->
                        if (item.product.id == cartItem.product.id) {
                            item.copy(
                                quantity = newQty?.coerceAtLeast(0.01) ?: item.quantity,
                                customUnit = newUnit ?: item.customUnit,
                                customUnitPrice = newBuyPrice?.coerceAtLeast(0.0) ?: item.customUnitPrice
                            )
                        } else item
                    }
                },
                onRemove = {
                    purchaseCart = purchaseCart.filterNot { it.product.id == cartItem.product.id }
                }
            )
        }

        // 5. Checkout Summary Card (Total, Payment Mode, Supplier, Checkbox, Note, Complete Button)
        if (purchaseCart.isNotEmpty()) {
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = Color.White,
                border = BorderStroke(1.dp, PurchaseCardBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // Total row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "মোট" else "Total",
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Bold,
                            color = PurchaseTextPrimary
                        )
                        Text(
                            text = "৳ ${formatCleanNum(totalAmount)}",
                            fontSize = 23.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = PurchaseTextPrimary
                        )
                    }

                    // Segmented Bar: Full cash | Full credit | Part credit
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFFAF7F2),
                        border = BorderStroke(1.dp, PurchaseCardBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val modes = listOf(
                                PurchasePaymentMode.FULL_CASH to (if (isBn) "নগদ" else "Full cash"),
                                PurchasePaymentMode.FULL_CREDIT to (if (isBn) "পুরো বাকি" else "Full credit"),
                                PurchasePaymentMode.PART_CREDIT to (if (isBn) "আংশিক বাকি" else "Part credit")
                            )
                            modes.forEach { (mode, label) ->
                                val isSelected = paymentMode == mode
                                Box(
                                    modifier = Modifier
                                        .clip(if (isSelected) RoundedCornerShape(10.dp) else RoundedCornerShape(0.dp))
                                        .background(if (isSelected) PurchaseTerracotta else Color.Transparent)
                                        .clickable { paymentMode = mode }
                                        .padding(horizontal = 16.dp, vertical = 11.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = label,
                                        fontSize = 14.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = if (isSelected) Color.White else PurchaseTextPrimary
                                    )
                                }
                            }
                        }
                    }

                    // Part credit cash input
                    if (paymentMode == PurchasePaymentMode.PART_CREDIT) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = if (isBn) "এখন নগদ পরিশোধ (৳)" else "Cash paid now (৳)",
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Medium,
                                color = PurchaseTextSecondary
                            )
                            OutlinedTextField(
                                value = partPaidText,
                                onValueChange = { partPaidText = it },
                                placeholder = { Text("0", color = PurchaseTextSecondary) },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                shape = RoundedCornerShape(12.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = Color.White,
                                    unfocusedContainerColor = Color(0xFFFAF7F2),
                                    focusedBorderColor = PurchaseTerracotta,
                                    unfocusedBorderColor = PurchaseCardBorder
                                ),
                                modifier = Modifier.fillMaxWidth()
                            )
                            Text(
                                text = if (isBn) "মহাজনের পাওনা বাকি: ৳ ${formatCleanNum(dueAmount)}" else "Payable due to supplier: ৳ ${formatCleanNum(dueAmount)}",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PurchaseTerracotta
                            )
                        }
                    }

                    // Supplier (needed if you owe)
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = if (isBn) "মহাজন / সাপ্লায়ার (বাকি থাকলে আবশ্যক)" else "Supplier (needed if you owe)",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = PurchaseTextSecondary
                        )

                        OutlinedTextField(
                            value = supplierSearchText,
                            onValueChange = {
                                supplierSearchText = it
                                selectedSupplier = suppliers.firstOrNull { s ->
                                    s.name.equals(it.trim(), ignoreCase = true)
                                }
                            },
                            placeholder = {
                                Text(
                                    text = if (isBn) "নাম বা ফোন দিয়ে খুঁজুন" else "Search by name or phone",
                                    color = PurchaseTextSecondary,
                                    fontSize = 15.sp
                                )
                            },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Color.White,
                                unfocusedContainerColor = Color(0xFFFAF7F2),
                                focusedBorderColor = PurchaseTerracotta,
                                unfocusedBorderColor = PurchaseCardBorder,
                                focusedTextColor = PurchaseTextPrimary,
                                unfocusedTextColor = PurchaseTextPrimary
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("purchase_supplier_input")
                        )

                        // Matching existing suppliers
                        if (matchingSuppliers.isNotEmpty() && selectedSupplier == null) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFFFAF7F2),
                                border = BorderStroke(1.dp, PurchaseCardBorder),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.fillMaxWidth()) {
                                    matchingSuppliers.take(5).forEachIndexed { i, sup ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clickable {
                                                    selectedSupplier = sup
                                                    supplierSearchText = sup.name
                                                }
                                                .padding(horizontal = 14.dp, vertical = 12.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = sup.name,
                                                fontSize = 14.5.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = PurchaseTextPrimary
                                            )
                                            if (sup.payableBalance > 0.0) {
                                                Text(
                                                    text = if (isBn) "পাওনা: ৳ ${formatCleanNum(sup.payableBalance)}" else "Payable: ৳ ${formatCleanNum(sup.payableBalance)}",
                                                    fontSize = 13.sp,
                                                    color = PurchaseTerracotta
                                                )
                                            }
                                        }
                                        if (i < matchingSuppliers.take(5).lastIndex) {
                                            HorizontalDivider(color = Color(0xFFF1ECE6))
                                        }
                                    }
                                }
                            }
                        }

                        // "+ New supplier: <name>" card matching Screenshot 5
                        if (supplierSearchText.trim().isNotBlank() && exactSupplierMatch == null) {
                            Surface(
                                onClick = {
                                    selectedSupplier = null
                                },
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFFFAF7F2),
                                border = BorderStroke(1.dp, PurchaseCardBorder),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("purchase_new_supplier_suggestion")
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp, vertical = 14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = if (isBn) "+ নতুন মহাজন:  " else "+ New supplier:  ",
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = PurchaseTerracotta
                                    )
                                    Text(
                                        text = supplierSearchText.trim(),
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = PurchaseTerracotta
                                    )
                                }
                            }
                        }
                    }

                    // Checkbox: "Update the product's buying price"
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { updateBuyingPrice = !updateBuyingPrice }
                            .padding(vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = updateBuyingPrice,
                            onCheckedChange = { updateBuyingPrice = it },
                            colors = CheckboxDefaults.colors(
                                checkedColor = PurchaseCheckboxBlue,
                                checkmarkColor = Color.White
                            )
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isBn) "পণ্যের ক্রয়মূল্য আপডেট করুন" else "Update the product's buying price",
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = PurchaseTextPrimary
                        )
                    }

                    // Note field: "For what (optional)"
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = if (isBn) "কিসের জন্য / নোট (ঐচ্ছিক)" else "For what (optional)",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = PurchaseTextSecondary
                        )
                        OutlinedTextField(
                            value = noteText,
                            onValueChange = { noteText = it },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Color.White,
                                unfocusedContainerColor = Color(0xFFFAF7F2),
                                focusedBorderColor = PurchaseTerracotta,
                                unfocusedBorderColor = PurchaseCardBorder,
                                focusedTextColor = PurchaseTextPrimary,
                                unfocusedTextColor = PurchaseTextPrimary
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("purchase_note_input")
                        )
                    }

                    // Submit Button: "✓ Complete purchase · ৳ 50"
                    Button(
                        onClick = {
                            val resolvedExisting = selectedSupplier ?: exactSupplierMatch
                            val resolvedNewName = if (resolvedExisting == null) supplierSearchText.trim() else ""
                            onSubmitPurchase(
                                purchaseCart,
                                paidAmount,
                                resolvedExisting,
                                resolvedNewName,
                                updateBuyingPrice,
                                noteText.trim()
                            )
                        },
                        enabled = canComplete,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = PurchaseTerracotta,
                            contentColor = Color.White
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .testTag("complete_purchase_button")
                    ) {
                        Text(
                            text = if (isBn) "✓ ক্রয় সম্পন্ন করুন · ৳ ${formatCleanNum(totalAmount)}" else "✓ Complete purchase · ৳ ${formatCleanNum(totalAmount)}",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun PurchaseCartItemCard(
    isBn: Boolean,
    cartItem: CartItem,
    onUpdateItem: (newQty: Double?, newUnit: String?, newBuyPrice: Double?) -> Unit,
    onRemove: () -> Unit
) {
    var qtyText by remember(cartItem.product.id, cartItem.quantity) {
        mutableStateOf(formatCleanNum(cartItem.quantity))
    }
    var priceText by remember(cartItem.product.id, cartItem.customUnitPrice) {
        mutableStateOf(formatCleanNum(cartItem.customUnitPrice))
    }
    var unitMenuExpanded by remember { mutableStateOf(false) }
    val unitOptions = listOf("kg", "gm", "pcs", "ltr", "box")

    Surface(
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        border = BorderStroke(1.dp, PurchaseCardBorder),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Top Row: Product Name + Red '✕' Remove Button
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = cartItem.product.name,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = PurchaseTextPrimary
                )

                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Remove Item",
                    tint = Color(0xFFEF4444),
                    modifier = Modifier
                        .size(22.dp)
                        .clickable(onClick = onRemove)
                )
            }

            // Middle Row: [Qty] [Unit ⌄] [Buying Price]
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = qtyText,
                    onValueChange = {
                        qtyText = it
                        it.toDoubleOrNull()?.let { q ->
                            if (q > 0.0) onUpdateItem(q, null, null)
                        }
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color(0xFFFAF7F2),
                        focusedBorderColor = PurchaseTerracotta,
                        unfocusedBorderColor = PurchaseCardBorder,
                        focusedTextColor = PurchaseTextPrimary,
                        unfocusedTextColor = PurchaseTextPrimary
                    ),
                    modifier = Modifier.weight(1f)
                )

                Box(modifier = Modifier.weight(1f)) {
                    Surface(
                        onClick = { unitMenuExpanded = true },
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFFAF7F2),
                        border = BorderStroke(1.dp, PurchaseCardBorder),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = cartItem.customUnit,
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.Medium,
                                color = PurchaseTextPrimary
                            )
                            Icon(
                                imageVector = Icons.Default.KeyboardArrowDown,
                                contentDescription = null,
                                tint = PurchaseTextSecondary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    DropdownMenu(
                        expanded = unitMenuExpanded,
                        onDismissRequest = { unitMenuExpanded = false }
                    ) {
                        unitOptions.forEach { u ->
                            DropdownMenuItem(
                                text = { Text(u) },
                                onClick = {
                                    onUpdateItem(null, u, null)
                                    unitMenuExpanded = false
                                }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = priceText,
                    onValueChange = {
                        priceText = it
                        it.toDoubleOrNull()?.let { p ->
                            if (p >= 0.0) onUpdateItem(null, null, p)
                        }
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color(0xFFFAF7F2),
                        focusedBorderColor = PurchaseTerracotta,
                        unfocusedBorderColor = PurchaseCardBorder,
                        focusedTextColor = PurchaseTextPrimary,
                        unfocusedTextColor = PurchaseTextPrimary
                    ),
                    modifier = Modifier.weight(1f)
                )
            }

            // Bottom Row: "৳/kg (Buying price)" on left, "৳ 50" on right
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (isBn) "৳/${cartItem.customUnit} (ক্রয়মূল্য)" else "৳/${cartItem.customUnit} (Buying price)",
                    fontSize = 13.5.sp,
                    color = PurchaseTextSecondary
                )

                Text(
                    text = "৳ ${formatCleanNum(cartItem.lineTotal)}",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = PurchaseDarkGreen
                )
            }
        }
    }
}

@Composable
private fun PurchaseCompleteView(
    isBn: Boolean,
    transaction: StoreTransaction,
    onOpenDetails: () -> Unit,
    onStartNewPurchase: () -> Unit,
    onBackToPurchases: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Completion Card
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color.White,
            border = BorderStroke(1.dp, PurchaseCardBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 32.dp, horizontal = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .clip(CircleShape)
                        .background(PurchaseGreen),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = "Purchase Complete",
                        tint = Color.White,
                        modifier = Modifier.size(38.dp)
                    )
                }

                Spacer(modifier = Modifier.height(18.dp))

                Text(
                    text = if (isBn) "ক্রয় সম্পন্ন হয়েছে" else "Purchase complete",
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    color = PurchaseTextPrimary
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "৳ ${formatCleanNum(transaction.amount)}",
                    fontSize = 36.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = PurchaseTextPrimary
                )
            }
        }

        // 2. "🧾 Details" Button
        Surface(
            onClick = onOpenDetails,
            shape = RoundedCornerShape(14.dp),
            color = Color.White,
            border = BorderStroke(1.dp, PurchaseCardBorder),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
                .testTag("purchase_complete_details_button")
        ) {
            Row(
                modifier = Modifier.fillMaxSize(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = "🧾", fontSize = 16.sp)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isBn) "বিস্তারিত" else "Details",
                    fontSize = 15.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PurchaseTextPrimary
                )
            }
        }

        // 3. "🧾 New purchase" Button
        Button(
            onClick = onStartNewPurchase,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = PurchaseTerracotta,
                contentColor = Color.White
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .testTag("purchase_complete_new_button")
        ) {
            Text(text = "🧾", fontSize = 16.sp)
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (isBn) "নতুন ক্রয়" else "New purchase",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        }

        // 4. "Back" Button
        Surface(
            onClick = onBackToPurchases,
            shape = RoundedCornerShape(14.dp),
            color = Color.White,
            border = BorderStroke(1.dp, PurchaseCardBorder),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
                .testTag("purchase_complete_back_button")
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (isBn) "ফিরে যান" else "Back",
                    fontSize = 15.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PurchaseTextPrimary
                )
            }
        }
    }
}

@Composable
private fun PurchaseDetailView(
    isBn: Boolean,
    transaction: StoreTransaction,
    purchaseNumber: Int,
    onBack: () -> Unit,
    onVoidPurchase: () -> Unit
) {
    val dateFormat = remember { SimpleDateFormat("d MMM yyyy", Locale.US) }
    val dateText = remember(transaction.createdAt) {
        transaction.createdAt?.toDate()?.let { dateFormat.format(it) } ?: dateFormat.format(Timestamp.now().toDate())
    }
    val supplierText = transaction.supplierName.ifBlank { if (isBn) "মহাজন নেই" else "No supplier" }
    val lineItems = remember(transaction) { SaleLineItem.parseLineItems(transaction) }
    val userNote = remember(transaction) { SaleLineItem.parseUserNote(transaction) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Header: [←] Purchase #1
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Surface(
                onClick = onBack,
                shape = RoundedCornerShape(10.dp),
                color = Color.White,
                border = BorderStroke(1.dp, PurchaseCardBorder),
                modifier = Modifier
                    .size(40.dp)
                    .testTag("purchase_detail_back_button")
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = PurchaseTextPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Text(
                text = if (isBn) "ক্রয় #$purchaseNumber" else "Purchase #$purchaseNumber",
                fontSize = 23.sp,
                fontWeight = FontWeight.ExtraBold,
                color = PurchaseTextPrimary
            )
        }

        // 2. Date & Supplier Card
        Surface(
            shape = RoundedCornerShape(18.dp),
            color = Color.White,
            border = BorderStroke(1.dp, PurchaseCardBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isBn) "তারিখ" else "Date",
                        fontSize = 15.sp,
                        color = PurchaseTextSecondary
                    )
                    Text(
                        text = dateText,
                        fontSize = 15.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = PurchaseTextPrimary
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isBn) "মহাজন" else "Supplier",
                        fontSize = 15.sp,
                        color = PurchaseTextSecondary
                    )
                    Text(
                        text = supplierText,
                        fontSize = 15.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = PurchaseTextPrimary
                    )
                }

                if (userNote.isNotBlank() && userNote != "Wholesale stock purchase") {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "নোট" else "Note",
                            fontSize = 15.sp,
                            color = PurchaseTextSecondary
                        )
                        Text(
                            text = userNote,
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = PurchaseTextPrimary
                        )
                    }
                }
            }
        }

        // 3. Purchased Line Items & Total / Paid Card
        Surface(
            shape = RoundedCornerShape(18.dp),
            color = Color.White,
            border = BorderStroke(1.dp, PurchaseCardBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                lineItems.forEach { item ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = item.productName,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = PurchaseTextPrimary
                            )
                            Spacer(modifier = Modifier.height(3.dp))
                            Text(
                                text = "${formatCleanNum(item.quantity)} ${item.unit} × ৳ ${formatCleanNum(item.unitPrice)}/${item.unit}",
                                fontSize = 14.sp,
                                color = PurchaseTextSecondary
                            )
                        }

                        Text(
                            text = "৳ ${formatCleanNum(item.lineTotal)}",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = PurchaseTextPrimary
                        )
                    }
                }

                HorizontalDivider(color = Color(0xFFF1ECE6))

                // Total Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isBn) "মোট" else "Total",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = PurchaseTextPrimary
                    )
                    Text(
                        text = "৳ ${formatCleanNum(transaction.amount)}",
                        fontSize = 21.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = PurchaseTextPrimary
                    )
                }

                // Paid Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isBn) "পরিশোধিত" else "Paid",
                        fontSize = 15.5.sp,
                        color = PurchaseTextSecondary
                    )
                    Text(
                        text = "৳ ${formatCleanNum(transaction.paidAmount)}",
                        fontSize = 16.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = PurchaseTextPrimary
                    )
                }

                if (transaction.dueAmount > 0.0) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "বাকি (দেয়া লাগবে)" else "Due (Payable)",
                            fontSize = 15.5.sp,
                            color = PurchaseTerracotta
                        )
                        Text(
                            text = "৳ ${formatCleanNum(transaction.dueAmount)}",
                            fontSize = 16.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = PurchaseTerracotta
                        )
                    }
                }
            }
        }

        // 4. "Void purchase" Danger Button
        OutlinedButton(
            onClick = onVoidPurchase,
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, PurchaseDangerRed.copy(alpha = 0.35f)),
            colors = ButtonDefaults.outlinedButtonColors(
                containerColor = PurchaseDangerBg,
                contentColor = PurchaseDangerRed
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .testTag("void_purchase_button")
        ) {
            Text(
                text = if (isBn) "ক্রয় বাতিল করুন (Void)" else "Void purchase",
                fontSize = 15.5.sp,
                fontWeight = FontWeight.Bold,
                color = PurchaseDangerRed
            )
        }
    }
}
