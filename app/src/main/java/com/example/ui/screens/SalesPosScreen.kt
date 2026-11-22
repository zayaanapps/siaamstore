package com.example.ui.screens

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.foundation.Image
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.data.auth.VaultAccessManager
import com.example.data.model.CartItem
import com.example.data.model.Customer
import com.example.data.model.Product
import com.example.data.model.SaleLineItem
import com.example.data.model.StoreTransaction
import com.example.ui.i18n.AppLanguage
import com.example.ui.i18n.DokanTranslations
import com.example.ui.viewmodel.DailyStats
import com.example.ui.viewmodel.DokanViewModel
import com.google.firebase.Timestamp
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

private val SellCreamBg = Color(0xFFF0F9F5)
private val SellCardBorder = Color(0xFFB6EADA)
private val SellInputBg = Color(0xFFF8FAFC)
private val SellInputBorder = Color(0xFFD1FAE5)
private val SellTerracotta = Color(0xFF00B368)
private val SellGreen = Color(0xFF00A862)
private val SellRed = Color(0xFFE11D48)
private val SellDarkText = Color(0xFF0F172A)
private val SellMutedSlate = Color(0xFF64748B)
private val SellCornerMint = Color(0xFFDFF7EC)
private val SellCornerRose = Color(0xFFFFE4E6)

enum class SellSubScreen {
    OVERVIEW,
    NEW_SALE,
    SALE_COMPLETE,
    SALE_DETAIL,
    RECEIPT
}

enum class SalePaymentMode {
    FULL_CASH,
    FULL_CREDIT,
    PART_CREDIT
}

@Composable
fun SalesPosScreen(
    products: List<Product>,
    customers: List<Customer>,
    transactions: List<StoreTransaction>,
    cartItems: List<CartItem>,
    dailyStats: DailyStats = DokanViewModel.calculateDailyStats(transactions),
    strings: DokanTranslations,
    loggedInUserName: String = "Siaam Store",
    openNewSaleInitially: Boolean = false,
    onConsumeInitialNewSale: () -> Unit = {},
    onAddToCart: (Product) -> Unit,
    onUpdateCartQty: (String, Double) -> Unit,
    onUpdateCartItemDetails: (productId: String, newQty: Double?, newUnit: String?, newUnitPrice: Double?) -> Unit = { id, qty, _, _ ->
        if (qty != null) onUpdateCartQty(id, qty)
    },
    onRemoveFromCart: (String) -> Unit = { id -> onUpdateCartQty(id, 0.0) },
    onClearCart: () -> Unit,
    onCompleteSale: (
        paidAmount: Double,
        customer: Customer?,
        notes: String,
        discountAmount: Double,
        newCustomerName: String,
        onCompleted: (StoreTransaction) -> Unit
    ) -> Unit,
    onCompleteSaleWithCustomerDetails: (
        paidAmount: Double,
        customer: Customer?,
        notes: String,
        discountAmount: Double,
        newCustomerName: String,
        newCustomerPhone: String,
        newCustomerAddress: String,
        onCompleted: (StoreTransaction) -> Unit
    ) -> Unit = { paid, cust, notes, discount, newName, _, _, onCompleted ->
        onCompleteSale(paid, cust, notes, discount, newName, onCompleted)
    },
    onReturnOrVoidSale: (transaction: StoreTransaction, isReturn: Boolean, onDone: () -> Unit) -> Unit = { _, _, onDone -> onDone() }
) {
    var currentSubScreen by rememberSaveable {
        mutableStateOf(
            if (openNewSaleInitially || cartItems.isNotEmpty()) SellSubScreen.NEW_SALE else SellSubScreen.OVERVIEW
        )
    }

    LaunchedEffect(openNewSaleInitially) {
        if (openNewSaleInitially) {
            currentSubScreen = SellSubScreen.NEW_SALE
            onConsumeInitialNewSale()
        }
    }

    // All SALE transactions sorted oldest -> newest so each has a stable sequential #1, #2, #3, #4 number
    val allSalesChronological = remember(transactions) {
        transactions
            .filter { it.type == "SALE" }
            .sortedBy { (it.createdAt ?: Timestamp(0, 0)).toDate().time }
    }

    val saleNumberById = remember(allSalesChronological) {
        allSalesChronological.mapIndexed { index, tx -> tx.id to (index + 1) }.toMap()
    }

    val isBn = strings.navSales == "বিক্রি"
    var activeTransaction by remember { mutableStateOf<StoreTransaction?>(null) }
    var activeSaleNumber by rememberSaveable { mutableStateOf(1) }
    var receiptReturnSubScreen by rememberSaveable { mutableStateOf(SellSubScreen.SALE_COMPLETE) }
    var initialReceiptLanguage by rememberSaveable { mutableStateOf(if (isBn) AppLanguage.BENGALI else AppLanguage.ENGLISH) }

    when (currentSubScreen) {
        SellSubScreen.OVERVIEW -> {
            SellOverviewContent(
                isBn = isBn,
                allSalesNewestFirst = allSalesChronological.reversed(),
                saleNumberById = saleNumberById,
                dailyStats = dailyStats,
                onStartNewSale = {
                    currentSubScreen = SellSubScreen.NEW_SALE
                },
                onOpenSaleDetail = { tx, saleNum ->
                    activeTransaction = tx
                    activeSaleNumber = saleNum
                    currentSubScreen = SellSubScreen.SALE_DETAIL
                }
            )
        }

        SellSubScreen.NEW_SALE -> {
            BackHandler {
                currentSubScreen = SellSubScreen.OVERVIEW
            }
            NewSaleContent(
                isBn = isBn,
                products = products,
                customers = customers,
                cartItems = cartItems,
                onBack = { currentSubScreen = SellSubScreen.OVERVIEW },
                onAddToCart = onAddToCart,
                onUpdateCartItemDetails = onUpdateCartItemDetails,
                onRemoveFromCart = onRemoveFromCart,
                onClearCart = onClearCart,
                onSubmitSale = { paid, cust, notes, discount, newCustName, newCustPhone, newCustAddress ->
                    onCompleteSaleWithCustomerDetails(
                        paid,
                        cust,
                        notes,
                        discount,
                        newCustName,
                        newCustPhone,
                        newCustAddress
                    ) { createdTx ->
                        val nextNum = (allSalesChronological.size + 1).coerceAtLeast(1)
                        activeTransaction = createdTx
                        activeSaleNumber = saleNumberById[createdTx.id] ?: nextNum
                        currentSubScreen = SellSubScreen.SALE_COMPLETE
                    }
                }
            )
        }

        SellSubScreen.SALE_COMPLETE -> {
            BackHandler {
                currentSubScreen = SellSubScreen.OVERVIEW
            }
            val completedTx = activeTransaction
            SaleCompleteContent(
                isBn = isBn,
                completedAmount = completedTx?.amount ?: 0.0,
                onOpenReceipt = {
                    if (completedTx != null) {
                        activeSaleNumber = saleNumberById[completedTx.id] ?: activeSaleNumber
                        initialReceiptLanguage = if (isBn) AppLanguage.BENGALI else AppLanguage.ENGLISH
                        receiptReturnSubScreen = SellSubScreen.SALE_COMPLETE
                        currentSubScreen = SellSubScreen.RECEIPT
                    } else {
                        currentSubScreen = SellSubScreen.OVERVIEW
                    }
                },
                onStartNewSale = {
                    onClearCart()
                    currentSubScreen = SellSubScreen.NEW_SALE
                },
                onBackToOverview = {
                    currentSubScreen = SellSubScreen.OVERVIEW
                }
            )
        }

        SellSubScreen.SALE_DETAIL -> {
            BackHandler {
                currentSubScreen = SellSubScreen.OVERVIEW
            }
            val tx = activeTransaction?.let { current ->
                transactions.firstOrNull { it.id == current.id } ?: current
            }
            if (tx == null) {
                currentSubScreen = SellSubScreen.OVERVIEW
            } else {
                val resolvedNumber = saleNumberById[tx.id] ?: activeSaleNumber
                SaleDetailContent(
                    isBn = isBn,
                    transaction = tx,
                    customers = customers,
                    saleNumber = resolvedNumber,
                    loggedInUserName = loggedInUserName,
                    onBack = { currentSubScreen = SellSubScreen.OVERVIEW },
                    onOpenReceiptScreen = { chosenLang ->
                        initialReceiptLanguage = chosenLang
                        receiptReturnSubScreen = SellSubScreen.SALE_DETAIL
                        currentSubScreen = SellSubScreen.RECEIPT
                    },
                    onReturnSale = {
                        onReturnOrVoidSale(tx, true) {
                            activeTransaction = null
                            currentSubScreen = SellSubScreen.OVERVIEW
                        }
                    },
                    onVoidSale = {
                        onReturnOrVoidSale(tx, false) {
                            activeTransaction = null
                            currentSubScreen = SellSubScreen.OVERVIEW
                        }
                    }
                )
            }
        }

        SellSubScreen.RECEIPT -> {
            BackHandler {
                currentSubScreen = receiptReturnSubScreen
            }
            val tx = activeTransaction?.let { current ->
                transactions.firstOrNull { it.id == current.id } ?: current
            }
            if (tx == null) {
                currentSubScreen = SellSubScreen.OVERVIEW
            } else {
                val resolvedNumber = saleNumberById[tx.id] ?: activeSaleNumber
                ReceiptViewContent(
                    transaction = tx,
                    customers = customers,
                    saleNumber = resolvedNumber,
                    loggedInUserName = loggedInUserName,
                    initialLanguage = initialReceiptLanguage,
                    onBack = { currentSubScreen = receiptReturnSubScreen }
                )
            }
        }
    }
}

/**
 * Screenshot 4: Main "Sell" Overview Screen
 * - "Sell" Title
 * - "🛒 New sale" full-width terracotta button
 * - 2-card summary row: "Today's sales (count)" and "Credit given today"
 * - Segmented Filter ("Today" | "All")
 * - Clean white rounded card listing sales (#3 · Walk-in (no name) / 10 Nov 2026 · 1 items / ৳ 50)
 */
private enum class SellOverviewTimeFilter {
    TODAY,
    THIS_WEEK,
    THIS_MONTH,
    THIS_YEAR,
    ALL
}

@Composable
private fun SellOverviewContent(
    isBn: Boolean,
    allSalesNewestFirst: List<StoreTransaction>,
    saleNumberById: Map<String, Int>,
    dailyStats: DailyStats,
    onStartNewSale: () -> Unit,
    onOpenSaleDetail: (StoreTransaction, Int) -> Unit
) {
    var selectedFilter by rememberSaveable { mutableStateOf(SellOverviewTimeFilter.TODAY) }
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.ENGLISH) }

    val startOfToday = remember {
        Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }

    val startOfThisWeek = remember(startOfToday) {
        startOfToday - 6L * 24L * 3600L * 1000L
    }

    val startOfThisMonth = remember {
        Calendar.getInstance().apply {
            set(Calendar.DAY_OF_MONTH, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }

    val startOfThisYear = remember {
        Calendar.getInstance().apply {
            set(Calendar.MONTH, Calendar.JANUARY)
            set(Calendar.DAY_OF_MONTH, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }

    val filteredSales = remember(
        allSalesNewestFirst,
        selectedFilter,
        startOfToday,
        startOfThisWeek,
        startOfThisMonth,
        startOfThisYear
    ) {
        when (selectedFilter) {
            SellOverviewTimeFilter.TODAY -> allSalesNewestFirst.filter { tx ->
                (tx.createdAt ?: Timestamp.now()).toDate().time >= startOfToday
            }
            SellOverviewTimeFilter.THIS_WEEK -> allSalesNewestFirst.filter { tx ->
                (tx.createdAt ?: Timestamp.now()).toDate().time >= startOfThisWeek
            }
            SellOverviewTimeFilter.THIS_MONTH -> allSalesNewestFirst.filter { tx ->
                (tx.createdAt ?: Timestamp.now()).toDate().time >= startOfThisMonth
            }
            SellOverviewTimeFilter.THIS_YEAR -> allSalesNewestFirst.filter { tx ->
                (tx.createdAt ?: Timestamp.now()).toDate().time >= startOfThisYear
            }
            SellOverviewTimeFilter.ALL -> allSalesNewestFirst
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(SellCreamBg)
            .testTag("sales_pos_list"),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Title + Upper Sale & Credit Summary Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.5.dp, SellCardBorder),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp)
                ) {
                    Text(
                        text = if (isBn) "বিক্রি" else "Sell",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = SellDarkText
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = if (isBn) {
                            "আজকের বিক্রি (${dailyStats.todaysSaleCount}): ৳${DokanViewModel.formatMoney(dailyStats.todaysSale)} • আজকের বাকি (${dailyStats.todaysGivenDueCustomerCount}): ৳${DokanViewModel.formatMoney(dailyStats.todaysGivenDue)}"
                        } else {
                            "Today's Sales (${dailyStats.todaysSaleCount}): ৳${DokanViewModel.formatMoney(dailyStats.todaysSale)} • Credit Today (${dailyStats.todaysGivenDueCustomerCount}): ৳${DokanViewModel.formatMoney(dailyStats.todaysGivenDue)}"
                        },
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = SellMutedSlate
                    )
                }
            }
        }

        // Primary CTA: "🛒 New sale"
        item {
            Button(
                onClick = onStartNewSale,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .testTag("sell_new_sale_button"),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = SellTerracotta,
                    contentColor = Color.White
                ),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp)
            ) {
                Text(text = "🛒", fontSize = 18.sp)
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = if (isBn) "নতুন বিক্রি" else "New sale",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }

        // 5-Way Segmented Filter Bar ("Today" | "This Week" | "This Month" | "This Year" | "All")
        item {
            val todayCount = remember(allSalesNewestFirst, startOfToday) {
                allSalesNewestFirst.count { (it.createdAt ?: Timestamp.now()).toDate().time >= startOfToday }
            }
            val weekCount = remember(allSalesNewestFirst, startOfThisWeek) {
                allSalesNewestFirst.count { (it.createdAt ?: Timestamp.now()).toDate().time >= startOfThisWeek }
            }
            val monthCount = remember(allSalesNewestFirst, startOfThisMonth) {
                allSalesNewestFirst.count { (it.createdAt ?: Timestamp.now()).toDate().time >= startOfThisMonth }
            }
            val yearCount = remember(allSalesNewestFirst, startOfThisYear) {
                allSalesNewestFirst.count { (it.createdAt ?: Timestamp.now()).toDate().time >= startOfThisYear }
            }
            val allCount = allSalesNewestFirst.size
            val filterOptions = listOf(
                SellOverviewTimeFilter.TODAY to (if (isBn) "আজ($todayCount)" else "Today($todayCount)"),
                SellOverviewTimeFilter.THIS_WEEK to (if (isBn) "এই সপ্তাহ($weekCount)" else "This Week($weekCount)"),
                SellOverviewTimeFilter.THIS_MONTH to (if (isBn) "এই মাস($monthCount)" else "This Month($monthCount)"),
                SellOverviewTimeFilter.THIS_YEAR to (if (isBn) "এই বছর($yearCount)" else "This Year($yearCount)"),
                SellOverviewTimeFilter.ALL to (if (isBn) "সব($allCount)" else "All($allCount)")
            )
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(42.dp),
                shape = RoundedCornerShape(12.dp),
                color = Color.White,
                border = BorderStroke(1.dp, SellInputBorder)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(3.dp),
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    filterOptions.forEach { (filterMode, label) ->
                        val active = selectedFilter == filterMode
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .background(
                                    color = if (active) SellTerracotta else SellCreamBg.copy(alpha = 0.6f),
                                    shape = RoundedCornerShape(8.dp)
                                )
                                .border(
                                    width = 1.dp,
                                    color = if (active) SellTerracotta else SellCardBorder,
                                    shape = RoundedCornerShape(8.dp)
                                )
                                .clickable { selectedFilter = filterMode }
                                .padding(horizontal = 1.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                fontSize = 8.5.sp,
                                fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                                color = if (active) Color.White else SellDarkText,
                                textAlign = TextAlign.Center,
                                maxLines = 1,
                                softWrap = false
                            )
                        }
                    }
                }
            }
        }

        // Sales List Card
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("sales_history_card"),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, SellCardBorder),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                if (filteredSales.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp, horizontal = 20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (showOnlyToday) {
                                if (isBn) "আজ এখনো কোনো বিক্রি হয়নি।" else "No sales recorded today yet."
                            } else {
                                if (isBn) "এখনো কোনো বিক্রি হয়নি।" else "No sales recorded yet."
                            },
                            fontSize = 15.sp,
                            color = SellMutedSlate
                        )
                    }
                } else {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        filteredSales.forEachIndexed { index, tx ->
                            val saleNumber = saleNumberById[tx.id] ?: (filteredSales.size - index)
                            val lineItems = remember(tx.notes, tx.title, tx.amount) {
                                SaleLineItem.parseLineItems(tx)
                            }
                            val dateStr = tx.createdAt?.toDate()?.let { dateFormat.format(it) } ?: (if (isBn) "আজ" else "Today")
                            val displayCustomer = tx.customerName
                                .takeIf {
                                    it.isNotBlank() &&
                                        !it.equals("Walk-in Customer", ignoreCase = true) &&
                                        !it.equals("Walk-in (no name)", ignoreCase = true) &&
                                        !it.equals("Walk-in customer", ignoreCase = true)
                                }
                                ?: (if (isBn) "সাধারণ ক্রেতা" else "Walk-in customer")

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onOpenSaleDetail(tx, saleNumber) }
                                    .padding(horizontal = 18.dp, vertical = 16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = "#$saleNumber",
                                            fontSize = 16.5.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = SellDarkText
                                        )
                                        Text(
                                            text = " · $displayCustomer",
                                            fontSize = 16.5.sp,
                                            fontWeight = FontWeight.Normal,
                                            color = SellDarkText,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = if (isBn) "$dateStr · ${lineItems.size} টি আইটেম" else "$dateStr · ${lineItems.size} items",
                                        fontSize = 13.5.sp,
                                        color = SellMutedSlate
                                    )
                                }

                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = "৳ ${DokanViewModel.formatMoney(tx.amount)}",
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SellDarkText
                                    )
                                    if (tx.dueAmount > 0.0) {
                                        Text(
                                            text = if (isBn) "বাকি ৳ ${DokanViewModel.formatMoney(tx.dueAmount)}" else "Due ৳ ${DokanViewModel.formatMoney(tx.dueAmount)}",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = SellRed
                                        )
                                    }
                                }
                            }

                            if (index < filteredSales.lastIndex) {
                                HorizontalDivider(color = Color(0xFFEFECE6), thickness = 1.dp)
                            }
                        }
                    }
                }
            }
        }

        item { Spacer(modifier = Modifier.height(16.dp)) }
    }
}

/**
 * Screenshot 2 & Screenshot 5: "New sale" Screen
 * - Back button + "New sale" title + "Clear cart" action when cart is non-empty
 * - Search box ("Product name, barcode or category...") + Camera/Barcode button
 * - Product suggestions list card (e.g. গম · 48 kg — ৳ 50/kg, চাল · 35 kg — ৳ 0/kg)
 * - When cart is empty: Shopping bags icon + "Search above and tap a product to add it to the cart."
 * - When cart has items:
 *   - Editable Cart Item cards (Quantity, Unit dropdown, Price input, ৳/unit, Line total, X remove)
 *   - Subtotal, Discount (with ৳ / % toggle), Total
 *   - 3-way Payment Mode ("Full cash" | "Full credit" | "Part credit")
 *   - "Customer (needed for credit)" search input + customer suggestions
 *   - "For what (optional)" note input
 *   - "✓ Complete sale · ৳ 50" terracotta button
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NewSaleContent(
    isBn: Boolean,
    products: List<Product>,
    customers: List<Customer>,
    cartItems: List<CartItem>,
    onBack: () -> Unit,
    onAddToCart: (Product) -> Unit,
    onUpdateCartItemDetails: (productId: String, newQty: Double?, newUnit: String?, newUnitPrice: Double?) -> Unit,
    onRemoveFromCart: (String) -> Unit,
    onClearCart: () -> Unit,
    onSubmitSale: (
        paidAmount: Double,
        customer: Customer?,
        notes: String,
        discountAmount: Double,
        newCustomerName: String,
        newCustomerPhone: String,
        newCustomerAddress: String
    ) -> Unit
) {
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var selectedCategory by rememberSaveable { mutableStateOf("ALL") }
    var showOnlyInCart by rememberSaveable { mutableStateOf(false) }
    var posTabMode by rememberSaveable { mutableStateOf("PRODUCTS") } // "PRODUCTS" or "CART"
    var showBarcodeDialog by remember { mutableStateOf(false) }

    var discountInput by rememberSaveable { mutableStateOf("") }
    var isPercentDiscount by rememberSaveable { mutableStateOf(false) }
    var paymentMode by rememberSaveable { mutableStateOf(SalePaymentMode.FULL_CASH) }
    var partCashReceivedInput by rememberSaveable { mutableStateOf("") }
    var customerSearchInput by rememberSaveable { mutableStateOf("") }
    var newCustomerAddressInput by rememberSaveable { mutableStateOf("") }
    var newCustomerPhoneInput by rememberSaveable { mutableStateOf("") }
    var selectedCustomer by remember { mutableStateOf<Customer?>(null) }
    var forWhatNote by rememberSaveable { mutableStateOf("") }
    var validationError by remember { mutableStateOf<String?>(null) }

    val cartByProductId = remember(cartItems) {
        cartItems.associateBy { it.product.id }
    }

    val categories = remember(products) {
        products.map { it.category.trim() }.filter { it.isNotEmpty() }.distinct()
    }

    val filteredProducts = remember(products, searchQuery, selectedCategory, showOnlyInCart, cartByProductId) {
        val q = searchQuery.trim().lowercase()
        products.filter { prod ->
            val matchesCat = selectedCategory == "ALL" || prod.category.trim() == selectedCategory
            val matchesInCart = !showOnlyInCart || cartByProductId.containsKey(prod.id)
            val matchesQuery = q.isEmpty() ||
                prod.name.lowercase().contains(q) ||
                prod.category.lowercase().contains(q) ||
                prod.barcode.lowercase().contains(q)
            matchesCat && matchesInCart && matchesQuery
        }
    }

    val subtotal = cartItems.sumOf { it.lineTotal }.coerceAtLeast(0.0)
    val rawDiscount = discountInput.toDoubleOrNull() ?: 0.0
    val computedDiscount = remember(subtotal, rawDiscount, isPercentDiscount) {
        if (isPercentDiscount) {
            (subtotal * (rawDiscount.coerceIn(0.0, 100.0) / 100.0)).coerceIn(0.0, subtotal)
        } else {
            rawDiscount.coerceIn(0.0, subtotal)
        }
    }
    val finalTotal = (subtotal - computedDiscount).coerceAtLeast(0.0)

    val matchingCustomers = remember(customers, customerSearchInput) {
        val q = customerSearchInput.trim().lowercase()
        if (q.isEmpty()) {
            customers.take(5)
        } else {
            customers.filter {
                it.name.lowercase().contains(q) || it.phone.lowercase().contains(q)
            }.take(6)
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(SellCreamBg)
            .testTag("new_sale_screen_list"),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // 1. Header Row: Back Button + "New sale" + "Clear cart"
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        modifier = Modifier
                            .size(width = 44.dp, height = 38.dp)
                            .clickable(onClick = onBack)
                            .testTag("new_sale_back_button"),
                        shape = RoundedCornerShape(10.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, SellInputBorder)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = SellDarkText,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = if (isBn) "নতুন বিক্রি" else "New sale",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = SellDarkText
                    )
                }

                if (cartItems.isNotEmpty()) {
                    Text(
                        text = if (isBn) "কার্ট খালি করুন" else "Clear cart",
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = SellRed,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable {
                                onClearCart()
                                discountInput = ""
                                validationError = null
                            }
                            .padding(horizontal = 6.dp, vertical = 4.dp)
                            .testTag("clear_cart_text_button")
                    )
                }
            }
        }

        // 1B. Instant 2-Tab Mode Switcher: "1. Find Products" vs "2. Cart & Bill" (No scrolling required!)
        item {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(46.dp),
                shape = RoundedCornerShape(14.dp),
                color = Color.White,
                border = BorderStroke(1.5.dp, SellCardBorder)
            ) {
                Row(modifier = Modifier.fillMaxSize()) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .background(if (posTabMode == "PRODUCTS") SellTerracotta else Color.Transparent)
                            .clickable { posTabMode = "PRODUCTS" },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (isBn) "১. পণ্য নির্বাচন (${products.size})" else "1. Products (${products.size})",
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (posTabMode == "PRODUCTS") Color.White else SellDarkText
                        )
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .background(if (posTabMode == "CART") SellTerracotta else if (cartItems.isNotEmpty()) SellCornerMint else Color.Transparent)
                            .clickable { posTabMode = "CART" },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (isBn) {
                                "২. কার্ট ও বিল (${cartItems.size}) • ৳${DokanViewModel.formatMoney(finalTotal)}"
                            } else {
                                "2. Cart & Bill (${cartItems.size}) • ৳${DokanViewModel.formatMoney(finalTotal)}"
                            },
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (posTabMode == "CART") Color.White else SellGreen
                        )
                    }
                }
            }
        }

        if (posTabMode == "PRODUCTS") {
            // 2. Search Input & Camera/Barcode Button Row
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    SellStyledTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = if (isBn) "পণ্যের নাম, বারকোড বা ক্যাটাগরি..." else "Product name, barcode or category...",
                        modifier = Modifier
                            .weight(1f)
                            .height(50.dp)
                            .testTag("new_sale_product_search")
                    )

                    if (searchQuery.isNotEmpty()) {
                        Surface(
                            modifier = Modifier
                                .size(width = 44.dp, height = 50.dp)
                                .clickable { searchQuery = "" },
                            shape = RoundedCornerShape(12.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, SellInputBorder)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Clear",
                                    tint = SellMutedSlate
                                )
                            }
                        }
                    }

                    Surface(
                        modifier = Modifier
                            .size(width = 52.dp, height = 50.dp)
                            .clickable { showBarcodeDialog = true }
                            .testTag("new_sale_camera_barcode_button"),
                        shape = RoundedCornerShape(12.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, SellInputBorder)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(text = "📷", fontSize = 20.sp)
                        }
                    }
                }
            }

            // 2B. Quick Filter & Category Chips
            item {
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = !showOnlyInCart && selectedCategory == "ALL",
                        onClick = {
                            showOnlyInCart = false
                            selectedCategory = "ALL"
                        },
                        label = { Text(if (isBn) "সব পণ্য" else "All") }
                    )
                    FilterChip(
                        selected = showOnlyInCart,
                        onClick = { showOnlyInCart = !showOnlyInCart },
                        label = { Text(if (isBn) "কার্টে আছে (${cartItems.size})" else "In Cart (${cartItems.size})") }
                    )
                    categories.forEach { cat ->
                        FilterChip(
                            selected = selectedCategory == cat,
                            onClick = {
                                selectedCategory = if (selectedCategory == cat) "ALL" else cat
                            },
                            label = { Text(cat) }
                        )
                    }
                }
            }

            // 2C. Quick Jump-to-Cart Bar when Cart has items
            if (cartItems.isNotEmpty()) {
                item {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { posTabMode = "CART" },
                        shape = RoundedCornerShape(14.dp),
                        color = Color(0xFF064E3B),
                        border = BorderStroke(1.5.dp, SellTerracotta)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = if (isBn) "${cartItems.size} টি পণ্য কার্টে যোগ হয়েছে" else "${cartItems.size} items in cart",
                                    fontSize = 12.sp,
                                    color = Color(0xFFA7F3D0),
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = "৳ ${DokanViewModel.formatMoney(finalTotal)}",
                                    fontSize = 17.sp,
                                    color = Color.White,
                                    fontWeight = FontWeight.ExtraBold
                                )
                            }
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = Color.White
                            ) {
                                Text(
                                    text = if (isBn) "কার্টে যান ও বিল করুন →" else "Go to Cart & Bill →",
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF064E3B),
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 3. Product Catalog Card with Inline Quantity Steppers
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("new_sale_products_card"),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.5.dp, SellCardBorder),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    if (filteredProducts.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(18.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (isBn) "কোনো পণ্য পাওয়া যায়নি।" else "No matching products found.",
                                fontSize = 14.5.sp,
                                color = SellMutedSlate
                            )
                        }
                    } else {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            filteredProducts.forEachIndexed { index, prod ->
                                val inCart = cartByProductId[prod.id]
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(if (inCart != null) Color(0xFFECFDF5) else Color.White)
                                        .clickable {
                                            onAddToCart(prod)
                                            validationError = null
                                        }
                                        .padding(horizontal = 14.dp, vertical = 12.dp)
                                        .testTag("pos_quick_product_${prod.id}"),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = prod.name,
                                            fontSize = 15.5.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = SellDarkText
                                        )
                                        Text(
                                            text = "৳ ${DokanViewModel.formatMoney(prod.sellPrice)}/${prod.unit}  •  ${if (isBn) "স্টক" else "Stock"}: ${formatCompactNumber(prod.stock)} ${prod.unit}",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = if (prod.stock <= 0) SellRed else SellGreen
                                        )
                                    }

                                    if (inCart != null) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Surface(
                                                modifier = Modifier
                                                    .size(30.dp)
                                                    .clickable {
                                                        val nextQty = (inCart.quantity - 1.0).coerceAtLeast(0.0)
                                                        if (nextQty <= 0.0) {
                                                            onRemoveFromCart(prod.id)
                                                        } else {
                                                            onUpdateCartItemDetails(prod.id, nextQty, null, null)
                                                        }
                                                    },
                                                shape = RoundedCornerShape(8.dp),
                                                color = Color.White,
                                                border = BorderStroke(1.dp, SellCardBorder)
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    Text("-", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                                }
                                            }
                                            Text(
                                                text = "${formatCompactNumber(inCart.quantity)} ${inCart.customUnit}",
                                                fontSize = 13.5.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = SellGreen
                                            )
                                            Surface(
                                                modifier = Modifier
                                                    .size(30.dp)
                                                    .clickable {
                                                        onUpdateCartItemDetails(prod.id, inCart.quantity + 1.0, null, null)
                                                    },
                                                shape = RoundedCornerShape(8.dp),
                                                color = SellTerracotta
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    Text("+", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.White)
                                                }
                                            }
                                        }
                                    } else {
                                        Surface(
                                            shape = RoundedCornerShape(10.dp),
                                            color = SellCornerMint,
                                            border = BorderStroke(1.dp, SellCardBorder)
                                        ) {
                                            Text(
                                                text = if (isBn) "+ যোগ" else "+ Add",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = SellGreen,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                            )
                                        }
                                    }
                                }

                                if (index < filteredProducts.lastIndex) {
                                    HorizontalDivider(color = Color(0xFFEFECE6), thickness = 1.dp)
                                }
                            }
                        }
                    }
                }
            }
        }

        // 4. Empty Cart State OR Active Cart Item Cards + Checkout Form (Shown in CART mode or below if empty)
        if (posTabMode == "CART") {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isBn) "কার্টের পণ্য (${cartItems.size})" else "Cart Items (${cartItems.size})",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = SellDarkText
                    )
                    Surface(
                        modifier = Modifier.clickable { posTabMode = "PRODUCTS" },
                        shape = RoundedCornerShape(10.dp),
                        color = SellCornerMint,
                        border = BorderStroke(1.dp, SellCardBorder)
                    ) {
                        Text(
                            text = if (isBn) "+ আরও পণ্য যোগ করুন" else "+ Add More Products",
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = SellGreen,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        )
                    }
                }
            }
        }

        if (posTabMode == "CART" && cartItems.isEmpty()) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("empty_cart_placeholder_card"),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, SellCardBorder),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp, vertical = 38.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(text = "🛍️", fontSize = 46.sp)
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = if (isBn) "কার্ট খালি আছে। পণ্য নির্বাচন ট্যাব থেকে পণ্য যোগ করুন।" else "Your cart is empty. Switch to Products tab to add items.",
                            fontSize = 16.sp,
                            color = SellMutedSlate,
                            textAlign = TextAlign.Center,
                            lineHeight = 23.sp
                        )
                    }
                }
            }
        } else if (posTabMode == "CART") {
            // Cart Item Cards (Matching Screenshot 5)
            items(cartItems.size) { idx ->
                val item = cartItems[idx]
                EditableCartItemCard(
                    item = item,
                    onUpdateDetails = { newQty, newUnit, newPrice ->
                        onUpdateCartItemDetails(item.product.id, newQty, newUnit, newPrice)
                    },
                    onRemove = {
                        onRemoveFromCart(item.product.id)
                    }
                )
            }

            // Checkout & Payment Card (Matching Screenshot 5)
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("pos_checkout_card"),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, SellCardBorder),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        // Subtotal Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "উপমোট (Subtotal)" else "Subtotal",
                                fontSize = 16.5.sp,
                                color = SellMutedSlate
                            )
                            Text(
                                text = "৳ ${DokanViewModel.formatMoney(subtotal)}",
                                fontSize = 16.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = SellDarkText
                            )
                        }

                        // Discount Row + ৳ / % Toggle
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            SellStyledTextField(
                                value = discountInput,
                                onValueChange = { discountInput = it },
                                placeholder = if (isBn) "ছাড় (Discount)" else "Discount",
                                keyboardType = KeyboardType.Decimal,
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                            )

                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = Color.White,
                                border = BorderStroke(1.dp, SellInputBorder),
                                modifier = Modifier.height(48.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .width(44.dp)
                                            .height(48.dp)
                                            .background(if (!isPercentDiscount) SellTerracotta else Color.Transparent)
                                            .clickable { isPercentDiscount = false },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "৳",
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (!isPercentDiscount) Color.White else SellDarkText
                                        )
                                    }
                                    Box(
                                        modifier = Modifier
                                            .width(44.dp)
                                            .height(48.dp)
                                            .background(if (isPercentDiscount) SellTerracotta else Color.Transparent)
                                            .clickable { isPercentDiscount = true },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "%",
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isPercentDiscount) Color.White else SellDarkText
                                        )
                                    }
                                }
                            }
                        }

                        // Total Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "মোট" else "Total",
                                fontSize = 19.sp,
                                fontWeight = FontWeight.Bold,
                                color = SellDarkText
                            )
                            Text(
                                text = "৳ ${DokanViewModel.formatMoney(finalTotal)}",
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold,
                                color = SellDarkText
                            )
                        }

                        // 3-Way Segmented Payment Mode ("Full cash" | "Full credit" | "Part credit")
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp),
                            shape = RoundedCornerShape(12.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, SellInputBorder)
                        ) {
                            Row(modifier = Modifier.fillMaxSize()) {
                                PaymentModeSegment(
                                    label = if (isBn) "নগদ" else "Full cash",
                                    selected = paymentMode == SalePaymentMode.FULL_CASH,
                                    onClick = {
                                        paymentMode = SalePaymentMode.FULL_CASH
                                        validationError = null
                                    },
                                    modifier = Modifier.weight(1f)
                                )
                                PaymentModeSegment(
                                    label = if (isBn) "পুরো বাকি" else "Full credit",
                                    selected = paymentMode == SalePaymentMode.FULL_CREDIT,
                                    onClick = {
                                        paymentMode = SalePaymentMode.FULL_CREDIT
                                        validationError = null
                                    },
                                    modifier = Modifier.weight(1f)
                                )
                                PaymentModeSegment(
                                    label = if (isBn) "আংশিক বাকি" else "Part credit",
                                    selected = paymentMode == SalePaymentMode.PART_CREDIT,
                                    onClick = {
                                        paymentMode = SalePaymentMode.PART_CREDIT
                                        validationError = null
                                    },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }

                        if (paymentMode == SalePaymentMode.PART_CREDIT) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = if (isBn) "এখন নগদ প্রাপ্তি (৳)" else "Cash received now (৳)",
                                    fontSize = 14.5.sp,
                                    color = SellMutedSlate
                                )
                                SellStyledTextField(
                                    value = partCashReceivedInput,
                                    onValueChange = {
                                        partCashReceivedInput = it
                                        validationError = null
                                    },
                                    placeholder = if (isBn) "নগদ টাকার পরিমাণ লিখুন..." else "Enter partial cash amount...",
                                    keyboardType = KeyboardType.Decimal,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(48.dp)
                                )
                            }
                        }

                        // Customer (needed for credit)
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = if (isBn) "কাস্টমার (বাকির জন্য আবশ্যক)" else "Customer (needed for credit)",
                                fontSize = 14.5.sp,
                                color = SellMutedSlate
                            )
                            SellStyledTextField(
                                value = selectedCustomer?.name ?: customerSearchInput,
                                onValueChange = {
                                    selectedCustomer = null
                                    customerSearchInput = it
                                    validationError = null
                                },
                                placeholder = if (isBn) "নাম বা ফোন দিয়ে খুঁজুন (অথবা সাধারণ ক্রেতা)" else "Search by name or phone (or leave blank for Walk-in customer)",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                            )

                            if (matchingCustomers.isNotEmpty() || selectedCustomer != null || customerSearchInput.isNotBlank()) {
                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    FilterChip(
                                        selected = selectedCustomer == null && customerSearchInput.isBlank(),
                                        onClick = {
                                            selectedCustomer = null
                                            customerSearchInput = ""
                                            newCustomerAddressInput = ""
                                            newCustomerPhoneInput = ""
                                            validationError = null
                                        },
                                        label = {
                                            Text(
                                                text = if (isBn) "সাধারণ ক্রেতা" else "Walk-in customer",
                                                fontSize = 12.5.sp
                                            )
                                        }
                                    )
                                    matchingCustomers.forEach { cust ->
                                        FilterChip(
                                            selected = selectedCustomer?.id == cust.id,
                                            onClick = {
                                                selectedCustomer = cust
                                                customerSearchInput = cust.name
                                                newCustomerAddressInput = cust.address
                                                newCustomerPhoneInput = cust.phone
                                                validationError = null
                                            },
                                            label = {
                                                Text(
                                                    text = "${cust.name} (${cust.phone})",
                                                    fontSize = 12.5.sp
                                                )
                                            }
                                        )
                                    }
                                }
                            }

                            val activeSel = selectedCustomer
                            if (activeSel != null) {
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = SellInputBg,
                                    border = BorderStroke(1.dp, SellInputBorder),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 12.dp, vertical = 10.dp),
                                        verticalArrangement = Arrangement.spacedBy(3.dp)
                                    ) {
                                        Text(
                                            text = if (isBn) "নাম: ${activeSel.name}" else "Name: ${activeSel.name}",
                                            fontSize = 13.5.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = SellDarkText
                                        )
                                        Text(
                                            text = if (isBn) "ঠিকানা: ${activeSel.address.ifBlank { "নেই" }}" else "Address: ${activeSel.address.ifBlank { "N/A" }}",
                                            fontSize = 13.sp,
                                            color = SellMutedSlate
                                        )
                                        Text(
                                            text = if (isBn) "ফোন: ${activeSel.phone.ifBlank { "নেই" }}" else "Phone: ${activeSel.phone.ifBlank { "N/A" }}",
                                            fontSize = 13.sp,
                                            color = SellMutedSlate
                                        )
                                    }
                                }
                            } else if (customerSearchInput.trim().isNotBlank()) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    SellStyledTextField(
                                        value = newCustomerAddressInput,
                                        onValueChange = { newCustomerAddressInput = it },
                                        placeholder = if (isBn) "কাস্টমারের ঠিকানা" else "Customer address",
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(44.dp)
                                    )
                                    SellStyledTextField(
                                        value = newCustomerPhoneInput,
                                        onValueChange = { newCustomerPhoneInput = it },
                                        placeholder = if (isBn) "কাস্টমারের ফোন" else "Customer phone",
                                        keyboardType = KeyboardType.Phone,
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(44.dp)
                                    )
                                }
                            }
                        }

                        // For what (optional)
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = if (isBn) "কিসের জন্য / নোট (ঐচ্ছিক)" else "For what (optional)",
                                fontSize = 14.5.sp,
                                color = SellMutedSlate
                            )
                            SellStyledTextField(
                                value = forWhatNote,
                                onValueChange = { forWhatNote = it },
                                placeholder = "",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                            )
                        }

                        if (validationError != null) {
                            Surface(
                                color = SellCornerRose,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = validationError!!,
                                    color = SellRed,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(10.dp)
                                )
                            }
                        }

                        // Primary Submit CTA: "✓ Complete sale · ৳ 50"
                        Button(
                            onClick = {
                                val resolvedPaid = when (paymentMode) {
                                    SalePaymentMode.FULL_CASH -> finalTotal
                                    SalePaymentMode.FULL_CREDIT -> 0.0
                                    SalePaymentMode.PART_CREDIT -> (partCashReceivedInput.toDoubleOrNull() ?: 0.0).coerceIn(0.0, finalTotal)
                                }
                                val dueAmt = (finalTotal - resolvedPaid).coerceAtLeast(0.0)
                                if (dueAmt > 0.0 && selectedCustomer == null && customerSearchInput.trim().isBlank()) {
                                    validationError = if (isBn) "বাকি বিক্রির জন্য কাস্টমার নির্বাচন বা নাম লিখুন।" else "Please select or enter a customer name for credit sales."
                                    return@Button
                                }
                                onSubmitSale(
                                    resolvedPaid,
                                    selectedCustomer,
                                    forWhatNote.trim(),
                                    computedDiscount,
                                    customerSearchInput.trim(),
                                    newCustomerPhoneInput.trim(),
                                    newCustomerAddressInput.trim()
                                )
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(54.dp)
                                .testTag("complete_pos_sale_button"),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SellTerracotta,
                                contentColor = Color.White
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (isBn) "বিক্রি সম্পন্ন করুন · ৳ ${DokanViewModel.formatMoney(finalTotal)}" else "Complete sale · ৳ ${DokanViewModel.formatMoney(finalTotal)}",
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }
            }
        }

        item { Spacer(modifier = Modifier.height(20.dp)) }
    }

    if (showBarcodeDialog) {
        var barcodeInput by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showBarcodeDialog = false },
            title = { Text(if (isBn) "বারকোড স্ক্যান বা লিখুন" else "Scan or Enter Product Barcode", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = if (isBn) "কার্টে সরাসরি যোগ করতে বারকোড বা পণ্যের নাম লিখুন:" else "Enter barcode or product name to add directly to cart:",
                        style = MaterialTheme.typography.bodySmall
                    )
                    OutlinedTextField(
                        value = barcodeInput,
                        onValueChange = { barcodeInput = it },
                        label = { Text(if (isBn) "বারকোড / পণ্যের নাম" else "Barcode / Product Name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val q = barcodeInput.trim().lowercase()
                        val match = products.firstOrNull {
                            it.barcode.lowercase() == q || it.name.lowercase().contains(q)
                        }
                        if (match != null) {
                            onAddToCart(match)
                        } else {
                            searchQuery = barcodeInput.trim()
                        }
                        showBarcodeDialog = false
                    }
                ) {
                    Text(if (isBn) "কার্টে যোগ করুন" else "Add to Cart")
                }
            },
            dismissButton = {
                TextButton(onClick = { showBarcodeDialog = false }) {
                    Text(if (isBn) "বাতিল" else "Cancel")
                }
            }
        )
    }
}

/**
 * Editable Cart Item Card (Screenshot 5):
 * - Product name on top-left, red X remove button on top-right
 * - 3 boxes: Quantity input | Unit dropdown ("kg v") | Unit price input ("50")
 * - Bottom row: "৳/kg" on left, "৳ 50" on right
 */
@Composable
private fun EditableCartItemCard(
    item: CartItem,
    onUpdateDetails: (newQty: Double?, newUnit: String?, newUnitPrice: Double?) -> Unit,
    onRemove: () -> Unit
) {
    var qtyText by remember(item.product.id, item.quantity) {
        mutableStateOf(formatCompactNumber(item.quantity))
    }
    var priceText by remember(item.product.id, item.customUnitPrice) {
        mutableStateOf(formatCompactNumber(item.customUnitPrice))
    }
    var unitMenuExpanded by remember { mutableStateOf(false) }
    val units = listOf("kg", "gm", "pcs", "ltr", "box")

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("pos_cart_card"),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, SellCardBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = item.product.name,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = SellDarkText
                )
                IconButton(
                    onClick = onRemove,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Remove item",
                        tint = SellRed,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Quantity Box
                SellStyledTextField(
                    value = qtyText,
                    onValueChange = { raw ->
                        qtyText = raw
                        val parsed = raw.toDoubleOrNull()
                        if (parsed != null && parsed > 0.0) {
                            onUpdateDetails(parsed, null, null)
                        }
                    },
                    placeholder = "1",
                    keyboardType = KeyboardType.Decimal,
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp)
                )

                // Unit Dropdown Box
                Box(modifier = Modifier.weight(0.95f)) {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .clickable { unitMenuExpanded = true },
                        shape = RoundedCornerShape(12.dp),
                        color = SellInputBg,
                        border = BorderStroke(1.dp, SellInputBorder)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = item.customUnit,
                                fontSize = 16.sp,
                                color = SellDarkText
                            )
                            Icon(
                                imageVector = Icons.Default.KeyboardArrowDown,
                                contentDescription = "Select unit",
                                tint = SellMutedSlate,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    DropdownMenu(
                        expanded = unitMenuExpanded,
                        onDismissRequest = { unitMenuExpanded = false }
                    ) {
                        units.forEach { u ->
                            DropdownMenuItem(
                                text = { Text(u) },
                                onClick = {
                                    unitMenuExpanded = false
                                    onUpdateDetails(null, u, null)
                                }
                            )
                        }
                    }
                }

                // Unit Price Box
                SellStyledTextField(
                    value = priceText,
                    onValueChange = { raw ->
                        priceText = raw
                        val parsed = raw.toDoubleOrNull()
                        if (parsed != null && parsed >= 0.0) {
                            onUpdateDetails(null, null, parsed)
                        }
                    },
                    placeholder = "0",
                    keyboardType = KeyboardType.Decimal,
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "৳/${item.customUnit}",
                    fontSize = 14.sp,
                    color = SellMutedSlate
                )
                Text(
                    text = "৳ ${DokanViewModel.formatMoney(item.lineTotal)}",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = SellMutedSlate
                )
            }
        }
    }
}

/**
 * Screenshot 1: "Sale complete" Confirmation Screen
 * - White rounded card with concentric green checkmark circle, "Sale complete", and "৳ 50"
 * - "🧾 Receipt" white outlined button
 * - "🛒 New sale" solid terracotta button
 * - "Back" white outlined button
 * - Dark bottom pill toast "Sale complete"
 */
@Composable
private fun SaleCompleteContent(
    isBn: Boolean,
    completedAmount: Double,
    onOpenReceipt: () -> Unit,
    onStartNewSale: () -> Unit,
    onBackToOverview: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(SellCreamBg)
            .padding(horizontal = 16.dp, vertical = 16.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("sale_complete_card"),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, SellCardBorder),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 28.dp, horizontal = 20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Concentric green circle with checkmark matching Screenshot 1
                    Box(
                        modifier = Modifier
                            .size(116.dp)
                            .clip(CircleShape)
                            .border(4.dp, Color(0xFFE5EFEA), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(78.dp)
                                .clip(CircleShape)
                                .background(SellGreen)
                                .border(3.dp, Color(0xFF81B995), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "✓",
                                fontSize = 40.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = if (isBn) "বিক্রি সম্পন্ন হয়েছে" else "Sale complete",
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Bold,
                        color = SellDarkText
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = "৳ ${DokanViewModel.formatMoney(completedAmount)}",
                        fontSize = 36.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = SellDarkText
                    )
                }
            }

            // "🧾 Receipt" Button
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .clickable(onClick = onOpenReceipt)
                    .testTag("sale_complete_receipt_button"),
                shape = RoundedCornerShape(14.dp),
                color = Color.White,
                border = BorderStroke(1.dp, SellInputBorder)
            ) {
                Row(
                    modifier = Modifier.fillMaxSize(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "🧾", fontSize = 18.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isBn) "রসিদ" else "Receipt",
                        fontSize = 16.5.sp,
                        fontWeight = FontWeight.Medium,
                        color = SellDarkText
                    )
                }
            }

            // "🛒 New sale" Button
            Button(
                onClick = onStartNewSale,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .testTag("sale_complete_new_sale_button"),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = SellTerracotta,
                    contentColor = Color.White
                )
            ) {
                Text(text = "🛒", fontSize = 18.sp)
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = if (isBn) "নতুন বিক্রি" else "New sale",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }

            // "Back" Button
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .clickable(onClick = onBackToOverview)
                    .testTag("sale_complete_back_button"),
                shape = RoundedCornerShape(14.dp),
                color = Color.White,
                border = BorderStroke(1.dp, SellInputBorder)
            ) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (isBn) "ফিরে যান" else "Back",
                        fontSize = 16.5.sp,
                        fontWeight = FontWeight.Medium,
                        color = SellDarkText
                    )
                }
            }
        }

        // Bottom dark pill toast "Sale complete" matching Screenshot 1
        Surface(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 12.dp),
            shape = RoundedCornerShape(50),
            color = Color(0xFF111B21),
            shadowElevation = 6.dp
        ) {
            Text(
                text = if (isBn) "বিক্রি সম্পন্ন হয়েছে" else "Sale complete",
                fontSize = 15.5.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)
            )
        }
    }
}

/**
 * Screenshot 3: "Sale #4" Detail / Receipt / Return / Void Screen
 * - Back button + "Sale #4"
 * - Card 1: Date ("10 Nov 2026") & Customer ("Walk-in (no name)")
 * - Card 2: Line items ("গম", "1 kg × ৳ 50/kg", "৳ 50"), Divider, "Total" ("৳ 50"), "Payment" ("৳ 50" in green)
 * - "Which language for the receipt?" + "🧾 রসিদ (বাংলা)" | "🧾 Receipt (English)"
 * - "↩ Return" | "Void sale"
 */
@Composable
private fun SaleDetailContent(
    isBn: Boolean,
    transaction: StoreTransaction,
    customers: List<Customer>,
    saleNumber: Int,
    loggedInUserName: String,
    onBack: () -> Unit,
    onOpenReceiptScreen: (AppLanguage) -> Unit,
    onReturnSale: () -> Unit,
    onVoidSale: () -> Unit
) {
    val context = LocalContext.current
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.ENGLISH) }
    val dateStr = transaction.createdAt?.toDate()?.let { dateFormat.format(it) } ?: (if (isBn) "আজ" else "Today")
    val customerDetails = remember(transaction, customers) {
        SaleLineItem.resolveCustomerDetails(transaction, customers)
    }

    val lineItems = remember(transaction.notes, transaction.title, transaction.amount) {
        SaleLineItem.parseLineItems(transaction)
    }

    var receiptDialogLanguage by remember { mutableStateOf<AppLanguage?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(SellCreamBg)
            .testTag("sale_detail_screen"),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Header Row: Back Button + "Sale #N"
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    modifier = Modifier
                        .size(width = 44.dp, height = 38.dp)
                        .clickable(onClick = onBack)
                        .testTag("sale_detail_back_button"),
                    shape = RoundedCornerShape(10.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, SellInputBorder)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = SellDarkText,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = if (isBn) "বিক্রি #$saleNumber" else "Sale #$saleNumber",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = SellDarkText
                    )
                    Text(
                        text = if (isBn) "সিয়াম স্টোর" else "Siaam Store",
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = SellTerracotta
                    )
                }
            }
        }

        // Card 1: Date, Served By & Customer Details (Name, Address & Phone or Walk-in customer)
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, SellCardBorder),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp, vertical = 18.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "তারিখ" else "Date",
                            fontSize = 16.sp,
                            color = SellMutedSlate
                        )
                        Text(
                            text = dateStr,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = SellDarkText
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "বিক্রয় প্রতিনিধি" else "Served By",
                            fontSize = 15.sp,
                            color = SellMutedSlate
                        )
                        Text(
                            text = loggedInUserName,
                            fontSize = 15.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = SellTerracotta
                        )
                    }

                    if (customerDetails.isWalkIn) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "ক্রেতা" else "Customer",
                                fontSize = 16.sp,
                                color = SellMutedSlate
                            )
                            Text(
                                text = if (isBn) "সাধারণ ক্রেতা" else "Walk-in customer",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = SellDarkText
                            )
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "ক্রেতার নাম" else "Customer Name",
                                fontSize = 15.5.sp,
                                color = SellMutedSlate
                            )
                            Text(
                                text = customerDetails.name,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = SellDarkText
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "ঠিকানা" else "Address",
                                fontSize = 15.sp,
                                color = SellMutedSlate
                            )
                            Text(
                                text = customerDetails.address.ifBlank { if (isBn) "নেই" else "N/A" },
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium,
                                color = SellDarkText
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "ফোন" else "Phone",
                                fontSize = 15.sp,
                                color = SellMutedSlate
                            )
                            Text(
                                text = customerDetails.phone.ifBlank { if (isBn) "নেই" else "N/A" },
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium,
                                color = SellDarkText
                            )
                        }
                    }
                }
            }
        }

        // Card 2: Line Items, Total, Payment
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, SellCardBorder),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp, vertical = 18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    lineItems.forEach { item ->
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = item.productName,
                                    fontSize = 16.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SellDarkText
                                )
                                Text(
                                    text = "৳ ${DokanViewModel.formatMoney(item.lineTotal)}",
                                    fontSize = 16.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SellDarkText
                                )
                            }
                            Text(
                                text = "${formatCompactNumber(item.quantity)} ${item.unit} × ৳ ${DokanViewModel.formatMoney(item.unitPrice)}/${item.unit}",
                                fontSize = 14.5.sp,
                                color = SellMutedSlate
                            )
                        }
                    }

                    HorizontalDivider(color = Color(0xFFEFECE6), thickness = 1.dp)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "মোট" else "Total",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = SellDarkText
                        )
                        Text(
                            text = "৳ ${DokanViewModel.formatMoney(transaction.amount)}",
                            fontSize = 21.sp,
                            fontWeight = FontWeight.Bold,
                            color = SellDarkText
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "পরিশোধিত" else "Paid",
                            fontSize = 16.sp,
                            color = SellMutedSlate
                        )
                        Text(
                            text = "৳ ${DokanViewModel.formatMoney(transaction.paidAmount)}",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = SellGreen
                        )
                    }

                    if (transaction.dueAmount > 0.0) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "বাকি" else "Credit / Due",
                                fontSize = 16.sp,
                                color = SellMutedSlate
                            )
                            Text(
                                text = "৳ ${DokanViewModel.formatMoney(transaction.dueAmount)}",
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = SellRed
                            )
                        }
                    }
                }
            }
        }

        // Receipt Language Selector + Return / Void Sale Buttons
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = if (isBn) "রসিদের ভাষা নির্বাচন করুন:" else "Which language for the receipt?",
                    fontSize = 14.5.sp,
                    color = SellMutedSlate
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .clickable { onOpenReceiptScreen(AppLanguage.BENGALI) },
                        shape = RoundedCornerShape(12.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, SellInputBorder)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = "🧾", fontSize = 16.sp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "রসিদ (বাংলা)",
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.Medium,
                                color = SellDarkText
                            )
                        }
                    }

                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .clickable { onOpenReceiptScreen(AppLanguage.ENGLISH) },
                        shape = RoundedCornerShape(12.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, SellInputBorder)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = "🧾", fontSize = 16.sp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Receipt (English)",
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.Medium,
                                color = SellDarkText
                            )
                        }
                    }
                }

                // Return & Void Sale Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .clickable(onClick = onReturnSale)
                            .testTag("sale_detail_return_button"),
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFE6EAEB),
                        border = BorderStroke(1.dp, SellInputBorder)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Undo,
                                contentDescription = null,
                                tint = SellDarkText,
                                modifier = Modifier.size(17.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (isBn) "ফেরত (Return)" else "Return",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium,
                                color = SellDarkText
                            )
                        }
                    }

                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .clickable(onClick = onVoidSale)
                            .testTag("sale_detail_void_button"),
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFFCECEC)
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (isBn) "বিক্রি বাতিল (Void)" else "Void sale",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium,
                                color = SellRed
                            )
                        }
                    }
                }
            }
        }
    }

    receiptDialogLanguage?.let { lang ->
        val isBn = lang == AppLanguage.BENGALI
        val receiptText = remember(transaction, saleNumber, lineItems, customerDetails, loggedInUserName, isBn) {
            buildString {
                if (isBn) {
                    appendLine(VaultAccessManager.STORE_NAME_BN)
                    appendLine(VaultAccessManager.STORE_BRANCH_LOCATION_BN)
                    appendLine(VaultAccessManager.STORE_PHONE_NUMBERS)
                    appendLine("--------------------------------")
                    appendLine("বিক্রয় রসিদ #$saleNumber")
                    appendLine("তারিখ: $dateStr")
                    appendLine("বিক্রয় প্রতিনিধি: $loggedInUserName")
                    if (customerDetails.isWalkIn) {
                        appendLine("ক্রেতা: Walk-in customer")
                    } else {
                        appendLine("ক্রেতার নাম: ${customerDetails.name}")
                        if (customerDetails.address.isNotBlank()) appendLine("ঠিকানা: ${customerDetails.address}")
                        if (customerDetails.phone.isNotBlank()) appendLine("ফোন: ${customerDetails.phone}")
                    }
                    appendLine("--------------------------------")
                    lineItems.forEach { item ->
                        appendLine("${item.productName}: ${formatCompactNumber(item.quantity)} ${item.unit} × ৳${DokanViewModel.formatMoney(item.unitPrice)} = ৳${DokanViewModel.formatMoney(item.lineTotal)}")
                    }
                    appendLine("--------------------------------")
                    appendLine("মোট বিল: ৳ ${DokanViewModel.formatMoney(transaction.amount)}")
                    appendLine("পরিশোধিত: ৳ ${DokanViewModel.formatMoney(transaction.paidAmount)}")
                    if (transaction.dueAmount > 0.0) {
                        appendLine("বাকি: ৳ ${DokanViewModel.formatMoney(transaction.dueAmount)}")
                    }
                    appendLine("--------------------------------")
                    appendLine("ধন্যবাদ, আবার আসবেন")
                    appendLine(VaultAccessManager.STORE_NAME_BN)
                    appendLine(VaultAccessManager.STORE_BRANCH_LOCATION_BN)
                } else {
                    appendLine(VaultAccessManager.STORE_NAME_EN)
                    appendLine(VaultAccessManager.STORE_BRANCH_LOCATION_EN)
                    appendLine(VaultAccessManager.STORE_PHONE_NUMBERS)
                    appendLine("--------------------------------")
                    appendLine("Sale Receipt #$saleNumber")
                    appendLine("Date: $dateStr")
                    appendLine("Served By: $loggedInUserName")
                    if (customerDetails.isWalkIn) {
                        appendLine("Customer: Walk-in customer")
                    } else {
                        appendLine("Customer Name: ${customerDetails.name}")
                        if (customerDetails.address.isNotBlank()) appendLine("Address: ${customerDetails.address}")
                        if (customerDetails.phone.isNotBlank()) appendLine("Phone: ${customerDetails.phone}")
                    }
                    appendLine("--------------------------------")
                    lineItems.forEach { item ->
                        appendLine("${item.productName}: ${formatCompactNumber(item.quantity)} ${item.unit} × ৳${DokanViewModel.formatMoney(item.unitPrice)} = ৳${DokanViewModel.formatMoney(item.lineTotal)}")
                    }
                    appendLine("--------------------------------")
                    appendLine("Total: ৳ ${DokanViewModel.formatMoney(transaction.amount)}")
                    appendLine("Paid: ৳ ${DokanViewModel.formatMoney(transaction.paidAmount)}")
                    if (transaction.dueAmount > 0.0) {
                        appendLine("Credit Due: ৳ ${DokanViewModel.formatMoney(transaction.dueAmount)}")
                    }
                    appendLine("--------------------------------")
                    appendLine("Thank you, visit again")
                    appendLine(VaultAccessManager.STORE_NAME_EN)
                    appendLine(VaultAccessManager.STORE_BRANCH_LOCATION_EN)
                }
            }
        }

        AlertDialog(
            onDismissRequest = { receiptDialogLanguage = null },
            title = {
                Text(
                    text = if (isBn) "🧾 বিক্রয় রসিদ #$saleNumber" else "🧾 Sale Receipt #$saleNumber",
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Surface(
                    color = SellCreamBg,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, SellCardBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = receiptText,
                        fontSize = 13.5.sp,
                        color = SellDarkText,
                        modifier = Modifier.padding(14.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val sendIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, receiptText)
                        }
                        context.startActivity(Intent.createChooser(sendIntent, "Share Receipt"))
                        receiptDialogLanguage = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = SellTerracotta)
                ) {
                    Text(if (isBn) "শেয়ার রসিদ" else "Share Receipt")
                }
            },
            dismissButton = {
                TextButton(onClick = { receiptDialogLanguage = null }) {
                    Text(if (isBn) "বন্ধ করুন" else "Close")
                }
            }
        )
    }
}

/**
 * Receipt module after sell is complete and clicking receipt:
 * 1. Siaam Store logo (`R.drawable.ic_siaam_store_logo`)
 * 2. Served By / বিক্রয় প্রতিনিধি: Profile logged-in username
 * 3. No "Dokan Manager" text
 * 4. Store Name: English "Siaam Store", Bangla "সিয়াম স্টোর" (Top Header & Bottom Footer)
 * 5. Address: English "Ramchandrapur Haat, Chapainawabganj", Bangla "রামচন্দ্রপুর হাট, চাঁপাইনবাবগঞ্জ"
 * 6. Phone Numbers: "01740999627 & 01303033353"
 * 7. Paid Translation: "পরিশোধিত"
 */
@Composable
private fun ReceiptViewContent(
    transaction: StoreTransaction,
    customers: List<Customer>,
    saleNumber: Int,
    loggedInUserName: String,
    initialLanguage: AppLanguage = AppLanguage.BENGALI,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    var selectedPaperSize by rememberSaveable { mutableStateOf("80 mm") }
    var receiptLang by rememberSaveable(initialLanguage) { mutableStateOf(initialLanguage) }
    val isBn = receiptLang == AppLanguage.BENGALI

    val toBnDigits = { input: String ->
        val bnDigits = charArrayOf('০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯')
        input.map { ch -> if (ch in '0'..'9') bnDigits[ch - '0'] else ch }.joinToString("")
    }

    val storeNameText = if (isBn) VaultAccessManager.STORE_NAME_BN else VaultAccessManager.STORE_NAME_EN
    val storeAddressText = if (isBn) VaultAccessManager.STORE_BRANCH_LOCATION_BN else VaultAccessManager.STORE_BRANCH_LOCATION_EN
    val storePhoneText = if (isBn) VaultAccessManager.STORE_PHONE_NUMBERS_BN else VaultAccessManager.STORE_PHONE_NUMBERS_EN

    val lineItems = remember(transaction.notes, transaction.title, transaction.amount) {
        SaleLineItem.parseLineItems(transaction)
    }

    val customerDetails = remember(transaction, customers) {
        SaleLineItem.resolveCustomerDetails(transaction, customers)
    }

    val customerPhoneFormatted = remember(customerDetails.phone, isBn) {
        if (isBn) toBnDigits(customerDetails.phone) else customerDetails.phone
    }

    val subtotal = remember(lineItems, transaction.amount) {
        val sum = lineItems.sumOf { it.lineTotal }
        if (sum > 0.0) sum else transaction.amount
    }
    val discount = remember(subtotal, transaction.amount) {
        (subtotal - transaction.amount).coerceAtLeast(0.0)
    }

    val cal = remember(transaction.createdAt) {
        Calendar.getInstance().apply {
            transaction.createdAt?.toDate()?.let { time = it }
        }
    }
    val day = cal.get(Calendar.DAY_OF_MONTH)
    val year = cal.get(Calendar.YEAR)
    val monthBn = when (cal.get(Calendar.MONTH)) {
        Calendar.JANUARY -> "জানু"
        Calendar.FEBRUARY -> "ফেব্রু"
        Calendar.MARCH -> "মার্চ"
        Calendar.APRIL -> "এপ্রিল"
        Calendar.MAY -> "মে"
        Calendar.JUNE -> "জুন"
        Calendar.JULY -> "জুলাই"
        Calendar.AUGUST -> "আগস্ট"
        Calendar.SEPTEMBER -> "সেপ্টে"
        Calendar.OCTOBER -> "অক্টো"
        Calendar.NOVEMBER -> "নভে"
        else -> "ডিসে"
    }
    val monthEn = when (cal.get(Calendar.MONTH)) {
        Calendar.JANUARY -> "Jan"
        Calendar.FEBRUARY -> "Feb"
        Calendar.MARCH -> "Mar"
        Calendar.APRIL -> "Apr"
        Calendar.MAY -> "May"
        Calendar.JUNE -> "Jun"
        Calendar.JULY -> "Jul"
        Calendar.AUGUST -> "Aug"
        Calendar.SEPTEMBER -> "Sep"
        Calendar.OCTOBER -> "Oct"
        Calendar.NOVEMBER -> "Nov"
        else -> "Dec"
    }

    val dateFormattedBn = "${toBnDigits(day.toString())} $monthBn, ${toBnDigits(year.toString())}"
    val dateFormattedEn = "$day $monthEn, $year"

    val buildVisualReceiptBitmap = {
        val subtotalStr = if (isBn) toBnDigits(DokanViewModel.formatMoney(subtotal)) else DokanViewModel.formatMoney(subtotal)
        val discountStr = if (discount > 0.0) {
            if (isBn) toBnDigits(DokanViewModel.formatMoney(discount)) else DokanViewModel.formatMoney(discount)
        } else null
        val totalStr = if (isBn) toBnDigits(DokanViewModel.formatMoney(transaction.amount)) else DokanViewModel.formatMoney(transaction.amount)
        val paidStr = if (isBn) toBnDigits(DokanViewModel.formatMoney(transaction.paidAmount)) else DokanViewModel.formatMoney(transaction.paidAmount)
        val dueStr = if (transaction.dueAmount > 0.0) {
            if (isBn) toBnDigits(DokanViewModel.formatMoney(transaction.dueAmount)) else DokanViewModel.formatMoney(transaction.dueAmount)
        } else null

        ReceiptDocumentExporter.renderReceiptBitmap(
            context = context,
            isBn = isBn,
            storeNameText = storeNameText,
            storeAddressText = storeAddressText,
            storePhoneText = storePhoneText,
            receiptNumberTitle = if (isBn) "রসিদ #${toBnDigits(saleNumber.toString())}" else "Receipt #$saleNumber",
            dateFormatted = if (isBn) dateFormattedBn else dateFormattedEn,
            servedByLabel = if (isBn) "বিক্রয় প্রতিনিধি:" else "Served By:",
            servedByValue = loggedInUserName,
            customerHeaderLabel = if (isBn) "ক্রেতার বিবরণ (Customer Details)" else "Customer Details",
            customerDetails = customerDetails,
            customerPhoneFormatted = customerPhoneFormatted,
            lineItems = lineItems,
            formatQtyWithUnit = { item ->
                val unitLabel = if (isBn && item.unit == "kg") "কেজি" else item.unit
                val qtyStr = if (isBn) toBnDigits(formatCompactNumber(item.quantity)) else formatCompactNumber(item.quantity)
                "$qtyStr $unitLabel"
            },
            formatPricePerUnit = { item ->
                val unitLabel = if (isBn && item.unit == "kg") "কেজি" else item.unit
                val priceStr = if (isBn) toBnDigits(DokanViewModel.formatMoney(item.unitPrice)) else DokanViewModel.formatMoney(item.unitPrice)
                "৳ $priceStr/$unitLabel"
            },
            formatLineTotal = { item ->
                val lineTot = if (isBn) toBnDigits(DokanViewModel.formatMoney(item.lineTotal)) else DokanViewModel.formatMoney(item.lineTotal)
                "৳ $lineTot"
            },
            subtotalFormatted = subtotalStr,
            discountFormatted = discountStr,
            grandTotalFormatted = totalStr,
            paidFormatted = paidStr,
            dueFormatted = dueStr,
            thankYouText = if (isBn) "ধন্যবাদ, আবার আসবেন" else "Thank you, visit again"
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(SellCreamBg)
            .testTag("receipt_view_screen"),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Top Navigation Bar: Back Button + Store Name & Receipt Title
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    modifier = Modifier
                        .size(width = 44.dp, height = 38.dp)
                        .clickable(onClick = onBack)
                        .testTag("receipt_back_button"),
                    shape = RoundedCornerShape(10.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, SellInputBorder)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = SellDarkText,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = storeNameText,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = SellTerracotta
                    )
                    Text(
                        text = if (isBn) "রসিদ #${toBnDigits(saleNumber.toString())}" else "Receipt #$saleNumber",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = SellDarkText
                    )
                }
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, SellInputBorder),
                    modifier = Modifier.clickable {
                        receiptLang = if (isBn) AppLanguage.ENGLISH else AppLanguage.BENGALI
                    }
                ) {
                    Text(
                        text = if (isBn) "ENG" else "বাংলা",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = SellTerracotta,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }
        }

        // The White Receipt Slip Card
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("receipt_slip_card"),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, SellCardBorder),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 18.dp)
                ) {
                    // 1. Siaam Store Logo + Store Name + Store Address + Store Phone Numbers (Bangla in Bangla mode)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.ic_siaam_store_logo),
                            contentDescription = "Siaam Store Logo",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(54.dp)
                                .clip(RoundedCornerShape(10.dp))
                        )

                        Spacer(modifier = Modifier.width(14.dp))

                        Column {
                            Text(
                                text = storeNameText,
                                fontSize = 21.sp,
                                fontWeight = FontWeight.Bold,
                                color = SellTerracotta
                            )
                            Text(
                                text = storeAddressText,
                                fontSize = 13.sp,
                                color = SellMutedSlate
                            )
                            Text(
                                text = storePhoneText,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = SellMutedSlate
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))
                    HorizontalDivider(color = Color(0xFFEBE6DF), thickness = 1.dp)
                    Spacer(modifier = Modifier.height(10.dp))

                    // "রসিদ #৫" / "Receipt #5" and Date
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "রসিদ #${toBnDigits(saleNumber.toString())}" else "Receipt #$saleNumber",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = SellDarkText
                        )
                        Text(
                            text = if (isBn) dateFormattedBn else dateFormattedEn,
                            fontSize = 14.5.sp,
                            color = SellMutedSlate
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    // Served By / বিক্রয় প্রতিনিধি: Profile logged-in username
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "বিক্রয় প্রতিনিধি:" else "Served By:",
                            fontSize = 13.5.sp,
                            color = SellMutedSlate,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = loggedInUserName,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = SellTerracotta
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // 3. Customer Details Block with simple indicator header
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("receipt_customer_details_section"),
                        shape = RoundedCornerShape(10.dp),
                        color = Color(0xFFFAF7F2),
                        border = BorderStroke(1.dp, Color(0xFFEBE6DF))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 9.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = if (isBn) "ক্রেতার বিবরণ (Customer Details)" else "Customer Details",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = SellTerracotta
                            )
                            HorizontalDivider(color = Color(0xFFEBE6DF), thickness = 1.dp)

                            if (customerDetails.isWalkIn) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = if (isBn) "ক্রেতা:" else "Customer:",
                                        fontSize = 13.5.sp,
                                        color = SellMutedSlate,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        text = "Walk-in customer",
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SellDarkText
                                    )
                                }
                            } else {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = if (isBn) "নাম:" else "Name:",
                                        fontSize = 13.5.sp,
                                        color = SellMutedSlate,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        text = customerDetails.name,
                                        fontSize = 14.5.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SellDarkText
                                    )
                                }
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = if (isBn) "ঠিকানা:" else "Address:",
                                        fontSize = 13.sp,
                                        color = SellMutedSlate
                                    )
                                    Text(
                                        text = customerDetails.address.ifBlank { "—" },
                                        fontSize = 13.5.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = SellDarkText
                                    )
                                }
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = if (isBn) "ফোন:" else "Phone:",
                                        fontSize = 13.sp,
                                        color = SellMutedSlate
                                    )
                                    Text(
                                        text = customerPhoneFormatted.ifBlank { "—" },
                                        fontSize = 13.5.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = SellDarkText
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    HorizontalDivider(color = Color(0xFFEBE6DF), thickness = 1.dp)
                    Spacer(modifier = Modifier.height(6.dp))

                    // Table Column Headers: পণ্য (Item) | পরিমাণ (Qty) | দাম (Price) | টাকা (Total)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "পণ্য" else "Item",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = SellMutedSlate,
                            modifier = Modifier.weight(1.5f)
                        )
                        Text(
                            text = if (isBn) "পরিমাণ" else "Qty",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = SellMutedSlate,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1.2f)
                        )
                        Text(
                            text = if (isBn) "দাম" else "Price",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = SellMutedSlate,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1.5f)
                        )
                        Text(
                            text = if (isBn) "টাকা" else "Total",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = SellMutedSlate,
                            textAlign = TextAlign.End,
                            modifier = Modifier.weight(1.3f)
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))
                    HorizontalDivider(color = Color(0xFFF0ECE5), thickness = 1.dp)
                    Spacer(modifier = Modifier.height(6.dp))

                    // Line Items
                    lineItems.forEach { item ->
                        val unitLabel = if (isBn && item.unit == "kg") "কেজি" else item.unit
                        val qtyStr = if (isBn) toBnDigits(formatCompactNumber(item.quantity)) else formatCompactNumber(item.quantity)
                        val priceStr = if (isBn) toBnDigits(DokanViewModel.formatMoney(item.unitPrice)) else DokanViewModel.formatMoney(item.unitPrice)
                        val totalStr = if (isBn) toBnDigits(DokanViewModel.formatMoney(item.lineTotal)) else DokanViewModel.formatMoney(item.lineTotal)

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = item.productName,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = SellDarkText,
                                modifier = Modifier.weight(1.5f)
                            )
                            Text(
                                text = "$qtyStr $unitLabel",
                                fontSize = 14.sp,
                                color = SellDarkText,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.weight(1.2f)
                            )
                            Text(
                                text = "৳ $priceStr/$unitLabel",
                                fontSize = 14.sp,
                                color = SellDarkText,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.weight(1.5f)
                            )
                            Text(
                                text = "৳ $totalStr",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = SellDarkText,
                                textAlign = TextAlign.End,
                                modifier = Modifier.weight(1.3f)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    HorizontalDivider(color = Color(0xFFEBE6DF), thickness = 1.dp)
                    Spacer(modifier = Modifier.height(8.dp))

                    // মোট (Subtotal)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "মোট" else "Subtotal",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = SellDarkText
                        )
                        val subtotalStr = if (isBn) toBnDigits(DokanViewModel.formatMoney(subtotal)) else DokanViewModel.formatMoney(subtotal)
                        Text(
                            text = "৳ $subtotalStr",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = SellDarkText
                        )
                    }

                    // ছাড় (Discount) if applicable
                    if (discount > 0.0) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "ছাড়" else "Discount",
                                fontSize = 15.sp,
                                color = SellMutedSlate
                            )
                            val discountStr = if (isBn) toBnDigits(DokanViewModel.formatMoney(discount)) else DokanViewModel.formatMoney(discount)
                            Text(
                                text = "- ৳ $discountStr",
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = SellGreen
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))
                    HorizontalDivider(color = Color(0xFFEBE6DF), thickness = 1.dp)
                    Spacer(modifier = Modifier.height(6.dp))

                    // সর্বমোট (Grand Total)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "সর্বমোট" else "Total",
                            fontSize = 17.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = SellDarkText
                        )
                        val totalStr = if (isBn) toBnDigits(DokanViewModel.formatMoney(transaction.amount)) else DokanViewModel.formatMoney(transaction.amount)
                        Text(
                            text = "৳ $totalStr",
                            fontSize = 19.5.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = SellDarkText
                        )
                    }

                    // পরিশোধিত / Paid
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBn) "পরিশোধিত" else "Paid",
                            fontSize = 15.sp,
                            color = SellMutedSlate
                        )
                        val paidStr = if (isBn) toBnDigits(DokanViewModel.formatMoney(transaction.paidAmount)) else DokanViewModel.formatMoney(transaction.paidAmount)
                        Text(
                            text = "৳ $paidStr",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = SellGreen
                        )
                    }

                    // বাকি (Due) if any
                    if (transaction.dueAmount > 0.0) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "বাকি" else "Due",
                                fontSize = 15.sp,
                                color = SellMutedSlate
                            )
                            val dueStr = if (isBn) toBnDigits(DokanViewModel.formatMoney(transaction.dueAmount)) else DokanViewModel.formatMoney(transaction.dueAmount)
                            Text(
                                text = "৳ $dueStr",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = SellRed
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // 1. Bottom Footer: Thank you + Store Name ("সিয়াম স্টোর" / "Siaam Store") — No address at bottom
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Text(
                            text = if (isBn) "ধন্যবাদ, আবার আসবেন" else "Thank you, visit again",
                            fontSize = 14.sp,
                            color = SellMutedSlate,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = storeNameText,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = SellTerracotta
                        )
                    }
                }
            }
        }

        // 4. Action Buttons Row: "🖨️ Print" & "↓ Download PDF" (Generates visual PDF/Image instead of plain text)
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Red Solid Button: "🖨️ Print"
                Button(
                    onClick = {
                        val bitmap = buildVisualReceiptBitmap()
                        ReceiptDocumentExporter.printVisualReceipt(
                            context = context,
                            saleNumber = saleNumber,
                            selectedPaperSize = selectedPaperSize,
                            bitmap = bitmap
                        )
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .testTag("receipt_print_button"),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = SellTerracotta,
                        contentColor = Color.White
                    )
                ) {
                    Text(text = "🖨️", fontSize = 17.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Print",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                // White Button: "↓ Download PDF"
                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .clickable {
                            val bitmap = buildVisualReceiptBitmap()
                            ReceiptDocumentExporter.downloadVisualReceiptPdf(
                                context = context,
                                saleNumber = saleNumber,
                                bitmap = bitmap
                            )
                        }
                        .testTag("receipt_download_pdf_button"),
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, SellInputBorder)
                ) {
                    Row(
                        modifier = Modifier.fillMaxSize(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = "↓", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = SellDarkText)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Download PDF",
                            fontSize = 15.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = SellDarkText
                        )
                    }
                }
            }
        }

        // Full-width Button: "📤 Share (WhatsApp etc.)" — Shares visual PNG image of the receipt
        item {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .clickable {
                        val bitmap = buildVisualReceiptBitmap()
                        ReceiptDocumentExporter.shareReceiptFile(
                            context = context,
                            saleNumber = saleNumber,
                            bitmap = bitmap,
                            shareAsPdf = false
                        )
                    }
                    .testTag("receipt_share_button"),
                shape = RoundedCornerShape(14.dp),
                color = Color.White,
                border = BorderStroke(1.dp, SellInputBorder)
            ) {
                Row(
                    modifier = Modifier.fillMaxSize(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "📤", fontSize = 17.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Share (WhatsApp etc.)",
                        fontSize = 16.5.sp,
                        fontWeight = FontWeight.Medium,
                        color = SellDarkText
                    )
                }
            }
        }

        // "Paper size" Header & Segmented Bar: "58 mm" | "80 mm" | "A4"
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Paper size",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Normal,
                    color = SellMutedSlate
                )

                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(46.dp),
                    shape = RoundedCornerShape(12.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, SellInputBorder)
                ) {
                    Row(modifier = Modifier.fillMaxSize()) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .background(if (selectedPaperSize == "58 mm") SellTerracotta else Color.Transparent)
                                .clickable { selectedPaperSize = "58 mm" },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "58 mm",
                                fontSize = 15.sp,
                                fontWeight = if (selectedPaperSize == "58 mm") FontWeight.Bold else FontWeight.Medium,
                                color = if (selectedPaperSize == "58 mm") Color.White else SellDarkText
                            )
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .background(if (selectedPaperSize == "80 mm") SellTerracotta else Color.Transparent)
                                .clickable { selectedPaperSize = "80 mm" },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "80 mm",
                                fontSize = 15.sp,
                                fontWeight = if (selectedPaperSize == "80 mm") FontWeight.Bold else FontWeight.Medium,
                                color = if (selectedPaperSize == "80 mm") Color.White else SellDarkText
                            )
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .background(if (selectedPaperSize == "A4") SellTerracotta else Color.Transparent)
                                .clickable { selectedPaperSize = "A4" },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "A4",
                                fontSize = 15.sp,
                                fontWeight = if (selectedPaperSize == "A4") FontWeight.Bold else FontWeight.Medium,
                                color = if (selectedPaperSize == "A4") Color.White else SellDarkText
                            )
                        }
                    }
                }

                Text(
                    text = "Choose 58 or 80 mm to match your thermal printer roll, or A4 for a normal printer. Print opens the phone's print screen, where you can pick a printer or \"Save as PDF\".",
                    fontSize = 13.5.sp,
                    color = SellMutedSlate,
                    lineHeight = 19.sp
                )
            }
        }

        // Thermal printer (Bluetooth) Section
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "Thermal printer (Bluetooth)",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Normal,
                    color = SellMutedSlate
                )

                // "📟 Print to Bluetooth printer" Button
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .clickable {
                            val intent = Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS)
                            try {
                                context.startActivity(intent)
                            } catch (e: Exception) {
                                val bitmap = buildVisualReceiptBitmap()
                                ReceiptDocumentExporter.shareReceiptFile(
                                    context = context,
                                    saleNumber = saleNumber,
                                    bitmap = bitmap,
                                    shareAsPdf = false
                                )
                            }
                        }
                        .testTag("receipt_bluetooth_print_button"),
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, SellInputBorder)
                ) {
                    Row(
                        modifier = Modifier.fillMaxSize(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = "📟", fontSize = 17.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Print to Bluetooth printer",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium,
                            color = SellDarkText
                        )
                    }
                }

                // "🖨️ Print with RawBT app" Button
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .clickable {
                            val bitmap = buildVisualReceiptBitmap()
                            ReceiptDocumentExporter.shareReceiptFile(
                                context = context,
                                saleNumber = saleNumber,
                                bitmap = bitmap,
                                shareAsPdf = false,
                                targetPackage = "ru.a402d.rawbtprinter"
                            )
                        }
                        .testTag("receipt_rawbt_print_button"),
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, SellInputBorder)
                ) {
                    Row(
                        modifier = Modifier.fillMaxSize(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = "🖨️", fontSize = 17.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Print with RawBT app",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium,
                            color = SellDarkText
                        )
                    }
                }

                Text(
                    text = "Switch the printer on and keep the phone's Bluetooth on, then tap the button and pick your printer from the list. Bluetooth Low Energy (BLE) printers work here. If an older (Classic) printer does not appear in the list, install the RawBT app and print through it. Choose the 58 or 80 mm size above.",
                    fontSize = 13.5.sp,
                    color = SellMutedSlate,
                    lineHeight = 19.sp
                )
            }
        }

        item {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SellMiniStatCard(
    modifier: Modifier = Modifier,
    amount: Double,
    amountSuffix: String = "",
    label: String,
    valueColor: Color,
    cornerColor: Color
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, SellCardBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .align(Alignment.TopEnd)
                    .offset(x = 14.dp, y = (-14).dp)
                    .clip(CircleShape)
                    .background(cornerColor)
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 15.dp)
            ) {
                Text(
                    text = "৳ ${DokanViewModel.formatMoney(amount)}$amountSuffix",
                    fontSize = if (amountSuffix.isNotEmpty()) 18.sp else 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = valueColor
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = label,
                    fontSize = 14.sp,
                    color = SellMutedSlate,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun PaymentModeSegment(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(44.dp)
            .background(if (selected) SellTerracotta else Color.Transparent)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 14.5.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            color = if (selected) Color.White else SellDarkText
        )
    }
}

@Composable
private fun SellStyledTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        color = SellInputBg,
        border = BorderStroke(1.dp, SellInputBorder)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 14.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            if (value.isEmpty() && placeholder.isNotEmpty()) {
                Text(
                    text = placeholder,
                    fontSize = 15.5.sp,
                    color = SellMutedSlate,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = TextStyle(
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Normal,
                    color = SellDarkText
                ),
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                cursorBrush = SolidColor(SellTerracotta),
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

private fun formatCompactNumber(value: Double): String {
    return if (value % 1.0 == 0.0) {
        value.toLong().toString()
    } else {
        String.format("%.2f", value).trimEnd('0').trimEnd('.')
    }
}
