package com.example.ui.screens

import android.content.Context
import android.content.Intent
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.Customer
import com.example.data.model.Product
import com.example.data.model.SaleLineItem
import com.example.data.model.StoreTransaction
import com.example.data.model.Supplier
import com.example.ui.i18n.AppLanguage
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

private val BizReportCreamBg = Color(0xFFF0F9F5)
private val BizReportCardBorder = Color(0xFFB6EADA)
private val BizReportActiveOrange = Color(0xFF00B368)
private val BizReportTerracotta = Color(0xFF00B368)
private val BizReportCoral = Color(0xFFE11D48)
private val BizReportTealBar = Color(0xFF00B368)
private val BizReportGreen = Color(0xFF00A862)
private val BizReportTextPrimary = Color(0xFF0F172A)
private val BizReportTextSecondary = Color(0xFF64748B)

enum class BizReportRangeFilter(val label: String, val bnLabel: String) {
    TODAY("Today", "আজ"),
    SEVEN_DAYS("7 days", "৭ দিন"),
    THIS_MONTH("This month", "এই মাস"),
    LAST_MONTH("Last month", "গত মাস"),
    PICK_DATES("Pick dates", "তারিখ বাছুন")
}

enum class TopProductsSortMode(val label: String, val bnLabel: String) {
    PROFIT("Profit", "লাভ"),
    QUANTITY("Quantity", "পরিমাণ")
}

private data class DayByDayRow(
    val dayStartMillis: Long,
    val dayOfMonthLabel: String,
    val dateLabel: String,
    val netSales: Double,
    val grossProfit: Double
)

private data class TopProductSummaryRow(
    val key: String,
    val productName: String,
    val quantity: Double,
    val unit: String,
    val profit: Double
)

private data class SlowProductRow(
    val productId: String,
    val productName: String,
    val stockText: String,
    val lastSaleLabel: String
)

private fun formatBizAmount(value: Double): String {
    val clean = if (abs(value) < 0.005) 0.0 else value
    return if (clean % 1.0 == 0.0) {
        "%,d".format(Locale.US, clean.toLong())
    } else {
        "%,.2f".format(Locale.US, clean)
    }
}

private fun formatCleanQty(value: Double): String {
    return if (value % 1.0 == 0.0) {
        value.toLong().toString()
    } else {
        "%.2f".format(Locale.US, value)
    }
}

private fun startOfDay(millis: Long): Long {
    return Calendar.getInstance().apply {
        timeInMillis = millis
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
}

private fun endOfDay(millis: Long): Long {
    return Calendar.getInstance().apply {
        timeInMillis = millis
        set(Calendar.HOUR_OF_DAY, 23)
        set(Calendar.MINUTE, 59)
        set(Calendar.SECOND, 59)
        set(Calendar.MILLISECOND, 999)
    }.timeInMillis
}

private fun txEffectiveTime(tx: StoreTransaction): Long {
    val rawNotes = tx.notes.trim()
    if (tx.type == "EXPENSE" && rawNotes.startsWith("DATE:")) {
        val millisPart = rawNotes
            .removePrefix("DATE:")
            .substringBefore("||NOTE:")
            .trim()
        millisPart.toLongOrNull()?.let { return it }
    }
    return tx.createdAt?.toDate()?.time ?: System.currentTimeMillis()
}

private fun printBusinessReportHtml(context: Context, jobName: String, htmlContent: String) {
    val webView = WebView(context)
    webView.webViewClient = object : WebViewClient() {
        override fun onPageFinished(view: WebView, url: String?) {
            val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager
            val adapter = view.createPrintDocumentAdapter(jobName)
            printManager?.print(jobName, adapter, PrintAttributes.Builder().build())
        }
    }
    webView.loadDataWithBaseURL(null, htmlContent, "text/HTML", "UTF-8", null)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BusinessReportsModuleScreen(
    storeOwnerName: String,
    products: List<Product>,
    customers: List<Customer>,
    suppliers: List<Supplier>,
    transactions: List<StoreTransaction>,
    onBackToMoreMenu: () -> Unit,
    language: AppLanguage = AppLanguage.BENGALI
) {
    val isBn = language == AppLanguage.BENGALI
    val context = LocalContext.current
    var selectedRange by rememberSaveable { mutableStateOf(BizReportRangeFilter.SEVEN_DAYS) }
    var topProductsSort by rememberSaveable { mutableStateOf(TopProductsSortMode.PROFIT) }

    var customStartMillis by rememberSaveable {
        mutableLongStateOf(System.currentTimeMillis() - 6L * 24L * 3600L * 1000L)
    }
    var customEndMillis by rememberSaveable {
        mutableLongStateOf(System.currentTimeMillis())
    }
    var pickingStartDate by remember { mutableStateOf<Boolean?>(null) }

    BackHandler {
        onBackToMoreMenu()
    }

    val (rangeStartMillis, rangeEndMillis) = remember(selectedRange, customStartMillis, customEndMillis) {
        val now = System.currentTimeMillis()
        when (selectedRange) {
            BizReportRangeFilter.TODAY -> {
                startOfDay(now) to endOfDay(now)
            }
            BizReportRangeFilter.SEVEN_DAYS -> {
                val cal = Calendar.getInstance().apply {
                    timeInMillis = now
                    add(Calendar.DAY_OF_YEAR, -6)
                }
                startOfDay(cal.timeInMillis) to endOfDay(now)
            }
            BizReportRangeFilter.THIS_MONTH -> {
                val cal = Calendar.getInstance().apply {
                    timeInMillis = now
                    set(Calendar.DAY_OF_MONTH, 1)
                }
                startOfDay(cal.timeInMillis) to endOfDay(now)
            }
            BizReportRangeFilter.LAST_MONTH -> {
                val startCal = Calendar.getInstance().apply {
                    timeInMillis = now
                    add(Calendar.MONTH, -1)
                    set(Calendar.DAY_OF_MONTH, 1)
                }
                val endCal = Calendar.getInstance().apply {
                    timeInMillis = startCal.timeInMillis
                    set(Calendar.DAY_OF_MONTH, getActualMaximum(Calendar.DAY_OF_MONTH))
                }
                startOfDay(startCal.timeInMillis) to endOfDay(endCal.timeInMillis)
            }
            BizReportRangeFilter.PICK_DATES -> {
                val s = minOf(customStartMillis, customEndMillis)
                val e = maxOf(customStartMillis, customEndMillis)
                startOfDay(s) to endOfDay(e)
            }
        }
    }

    val dateFormatter = remember { SimpleDateFormat("d MMM yyyy", Locale.US) }
    val dayNumberFormatter = remember { SimpleDateFormat("d", Locale.US) }
    val ownerDisplay = storeOwnerName.trim().ifBlank { if (isBn) "দোকান" else "Store" }
    val periodSubtitle = remember(ownerDisplay, rangeStartMillis, rangeEndMillis) {
        "$ownerDisplay · ${dateFormatter.format(Date(rangeStartMillis))} – ${dateFormatter.format(Date(rangeEndMillis))}"
    }

    val productById = remember(products) { products.associateBy { it.id } }
    val productByName = remember(products) { products.associateBy { it.name.lowercase() } }

    // Filter transactions in period
    val periodTxs = remember(transactions, rangeStartMillis, rangeEndMillis) {
        transactions.filter { tx ->
            tx.category != "STARTING_CASH" &&
                txEffectiveTime(tx) in rangeStartMillis..rangeEndMillis
        }
    }

    // Active (non-void, non-return) sales vs returned sales in period
    val activeSalesInPeriod = remember(periodTxs) {
        periodTxs.filter { tx ->
            tx.type == "SALE" &&
                !tx.title.startsWith("[VOID]", ignoreCase = true) &&
                !tx.notes.startsWith("[VOID]", ignoreCase = true) &&
                !tx.title.startsWith("[RETURN]", ignoreCase = true) &&
                !tx.notes.startsWith("[RETURN]", ignoreCase = true)
        }
    }

    val returnedSalesInPeriod = remember(periodTxs) {
        periodTxs.filter { tx ->
            tx.type == "SALE" &&
                !tx.title.startsWith("[VOID]", ignoreCase = true) &&
                !tx.notes.startsWith("[VOID]", ignoreCase = true) &&
                (tx.title.startsWith("[RETURN]", ignoreCase = true) || tx.notes.startsWith("[RETURN]", ignoreCase = true))
        }
    }

    val expensesInPeriod = remember(periodTxs) {
        periodTxs.filter { it.type == "EXPENSE" }
    }

    // Helper to compute a single active sale's (grossSubtotal, discount, netAmount, cogs, profit)
    fun analyzeActiveSale(tx: StoreTransaction): Array<Double> {
        val lineItems = SaleLineItem.parseLineItems(tx)
        val grossSubtotal = lineItems.sumOf { it.lineTotal }.coerceAtLeast(tx.amount)
        val discount = (grossSubtotal - tx.amount).coerceAtLeast(0.0)
        val netSaleAmt = tx.amount

        var cogs = 0.0
        for (li in lineItems) {
            val matchedProd = productById[li.productId]
                ?: productByName[li.productName.trim().lowercase()]
            val unitBuyPrice = matchedProd?.buyPrice ?: 0.0
            cogs += unitBuyPrice * li.quantity
        }
        // If product wasn't found in current catalog, fallback to (tx.amount - tx.profitAmount)
        if (cogs == 0.0 && tx.profitAmount != 0.0) {
            cogs = (tx.amount - tx.profitAmount).coerceAtLeast(0.0)
        }
        val profit = netSaleAmt - cogs
        return arrayOf(grossSubtotal, discount, netSaleAmt, cogs, profit)
    }

    val salesBreakdown = remember(activeSalesInPeriod, returnedSalesInPeriod, expensesInPeriod, products) {
        var sumGrossBeforeDiscount = 0.0
        var sumDiscount = 0.0
        var sumActiveNet = 0.0
        var sumCogs = 0.0

        activeSalesInPeriod.forEach { tx ->
            val stats = analyzeActiveSale(tx)
            sumGrossBeforeDiscount += stats[0]
            sumDiscount += stats[1]
            sumActiveNet += stats[2]
            sumCogs += stats[3]
        }

        val returnsTotal = returnedSalesInPeriod.sumOf { it.amount }
        val totalSalesGross = sumGrossBeforeDiscount + returnsTotal
        val netSales = (totalSalesGross - sumDiscount - returnsTotal).coerceAtLeast(0.0)
        val grossProfit = netSales - sumCogs
        val totalExpenses = expensesInPeriod.sumOf { it.amount }
        val netProfit = grossProfit - totalExpenses
        val salesCount = activeSalesInPeriod.size
        val avgSale = if (salesCount > 0) (sumActiveNet / salesCount).roundToLong().toDouble() else 0.0

        listOf(
            netSales,
            grossProfit,
            totalExpenses,
            netProfit,
            totalSalesGross,
            sumDiscount,
            returnsTotal,
            sumCogs,
            salesCount.toDouble(),
            avgSale
        )
    }

    val netSales = salesBreakdown[0]
    val grossProfit = salesBreakdown[1]
    val totalExpenses = salesBreakdown[2]
    val netProfit = salesBreakdown[3]
    val totalSalesGross = salesBreakdown[4]
    val totalDiscount = salesBreakdown[5]
    val totalReturns = salesBreakdown[6]
    val totalCogs = salesBreakdown[7]
    val activeSalesCount = salesBreakdown[8].toInt()
    val averageSale = salesBreakdown[9]

    // Day by day rows
    val dayByDayRows = remember(activeSalesInPeriod, returnedSalesInPeriod, rangeStartMillis, rangeEndMillis, products) {
        val allRangeDays = mutableListOf<Long>()
        var cursor = startOfDay(rangeStartMillis)
        val endDay = startOfDay(rangeEndMillis)
        while (cursor <= endDay) {
            allRangeDays.add(cursor)
            val nextCal = Calendar.getInstance().apply {
                timeInMillis = cursor
                add(Calendar.DAY_OF_YEAR, 1)
            }
            cursor = startOfDay(nextCal.timeInMillis)
        }

        // Determine the earliest day in range that has sale/return activity (or show last 3 days if empty)
        val activeDaysSet = (activeSalesInPeriod + returnedSalesInPeriod)
            .map { startOfDay(txEffectiveTime(it)) }
            .toSet()
        val firstActiveDay = activeDaysSet.minOrNull()
        val visibleDays = if (firstActiveDay != null) {
            allRangeDays.filter { it >= firstActiveDay }
        } else {
            allRangeDays.takeLast(3.coerceAtMost(allRangeDays.size))
        }

        visibleDays.map { dayStart ->
            val dayEnd = endOfDay(dayStart)
            val dayActiveSales = activeSalesInPeriod.filter { txEffectiveTime(it) in dayStart..dayEnd }
            val dayReturns = returnedSalesInPeriod.filter { txEffectiveTime(it) in dayStart..dayEnd }

            var dayNet = 0.0
            var dayCogs = 0.0
            dayActiveSales.forEach { tx ->
                val stats = analyzeActiveSale(tx)
                dayNet += stats[2]
                dayCogs += stats[3]
            }
            val dayReturnAmt = dayReturns.sumOf { it.amount }
            val finalDaySales = (dayNet - dayReturnAmt).coerceAtLeast(0.0)
            val finalDayProfit = finalDaySales - dayCogs

            DayByDayRow(
                dayStartMillis = dayStart,
                dayOfMonthLabel = dayNumberFormatter.format(Date(dayStart)),
                dateLabel = dateFormatter.format(Date(dayStart)),
                netSales = finalDaySales,
                grossProfit = finalDayProfit
            )
        }
    }

    // Top products in period
    val topProductsList = remember(activeSalesInPeriod, products, topProductsSort) {
        data class MutableAgg(
            val name: String,
            var qty: Double,
            val unit: String,
            var profit: Double
        )
        val map = linkedMapOf<String, MutableAgg>()

        activeSalesInPeriod.forEach { tx ->
            val lineItems = SaleLineItem.parseLineItems(tx)
            val grossSubtotal = lineItems.sumOf { it.lineTotal }.coerceAtLeast(tx.amount)
            val txDiscount = (grossSubtotal - tx.amount).coerceAtLeast(0.0)

            lineItems.forEach { li ->
                val matchedProd = productById[li.productId]
                    ?: productByName[li.productName.trim().lowercase()]
                val unitBuy = matchedProd?.buyPrice ?: 0.0
                val unitLabel = li.unit.ifBlank { matchedProd?.unit ?: "kg" }
                val discountShare = if (grossSubtotal > 0.0) txDiscount * (li.lineTotal / grossSubtotal) else 0.0
                val lineNet = li.lineTotal - discountShare
                val lineProfit = lineNet - (unitBuy * li.quantity)

                val key = (matchedProd?.id?.takeIf { it.isNotBlank() } ?: li.productName.trim().lowercase())
                val existing = map[key]
                if (existing == null) {
                    map[key] = MutableAgg(
                        name = matchedProd?.name ?: li.productName,
                        qty = li.quantity,
                        unit = unitLabel,
                        profit = lineProfit
                    )
                } else {
                    existing.qty += li.quantity
                    existing.profit += lineProfit
                }
            }
        }

        val rows = map.map { (k, v) ->
            TopProductSummaryRow(
                key = k,
                productName = v.name,
                quantity = v.qty,
                unit = v.unit,
                profit = v.profit
            )
        }

        when (topProductsSort) {
            TopProductsSortMode.PROFIT -> rows.sortedByDescending { it.profit }
            TopProductsSortMode.QUANTITY -> rows.sortedByDescending { it.quantity }
        }
    }

    // Slow products: Not sold in 30 days but still in stock
    val slowProductsList = remember(products, transactions) {
        val thirtyDaysAgoMillis = System.currentTimeMillis() - 30L * 24L * 3600L * 1000L
        val allValidSales = transactions.filter { tx ->
            tx.type == "SALE" &&
                !tx.title.startsWith("[VOID]", ignoreCase = true) &&
                !tx.notes.startsWith("[VOID]", ignoreCase = true) &&
                !tx.title.startsWith("[RETURN]", ignoreCase = true) &&
                !tx.notes.startsWith("[RETURN]", ignoreCase = true)
        }

        val lastSaleByProduct = mutableMapOf<String, Long>()
        allValidSales.forEach { tx ->
            val saleTime = txEffectiveTime(tx)
            SaleLineItem.parseLineItems(tx).forEach { li ->
                val idKey = li.productId.trim()
                val nameKey = li.productName.trim().lowercase()
                if (idKey.isNotBlank()) {
                    lastSaleByProduct[idKey] = maxOf(lastSaleByProduct[idKey] ?: 0L, saleTime)
                }
                if (nameKey.isNotBlank()) {
                    lastSaleByProduct[nameKey] = maxOf(lastSaleByProduct[nameKey] ?: 0L, saleTime)
                }
            }
        }

        products
            .filter { it.stock > 0.0 }
            .mapNotNull { prod ->
                val lastSoldMillis = lastSaleByProduct[prod.id]
                    ?: lastSaleByProduct[prod.name.trim().lowercase()]
                if (lastSoldMillis == null || lastSoldMillis < thirtyDaysAgoMillis) {
                    SlowProductRow(
                        productId = prod.id,
                        productName = prod.name,
                        stockText = "${formatCleanQty(prod.stock)} ${prod.unit}",
                        lastSaleLabel = if (lastSoldMillis == null) (if (isBn) "কখনোই না" else "Never") else dateFormatter.format(Date(lastSoldMillis))
                    )
                } else {
                    null
                }
            }
    }

    // Shop position metrics
    val stockValueBuyPrice = remember(products) {
        products.sumOf { it.buyPrice * it.stock.coerceAtLeast(0.0) }
    }
    val stockValueSellPrice = remember(products) {
        products.sumOf { it.sellPrice * it.stock.coerceAtLeast(0.0) }
    }
    val customersOweTotal = remember(customers) {
        customers.sumOf { it.totalDue.coerceAtLeast(0.0) }
    }
    val owedToSuppliersTotal = remember(suppliers) {
        suppliers.sumOf { it.payableBalance.coerceAtLeast(0.0) }
    }
    val cashInHandCurrent = remember(transactions) {
        val startingCash = transactions
            .filter { it.category == "STARTING_CASH" }
            .maxByOrNull { it.createdAt?.toDate()?.time ?: 0L }
            ?.amount ?: 0.0

        var delta = 0.0
        transactions.forEach { tx ->
            if (tx.category == "STARTING_CASH") return@forEach
            val isVoid = tx.title.startsWith("[VOID]", ignoreCase = true) ||
                tx.notes.startsWith("[VOID]", ignoreCase = true)
            if (isVoid) return@forEach
            val isReturn = tx.title.startsWith("[RETURN]", ignoreCase = true) ||
                tx.notes.startsWith("[RETURN]", ignoreCase = true)

            when (tx.type) {
                "SALE" -> {
                    if (isReturn) {
                        delta -= tx.paidAmount.coerceAtLeast(tx.amount)
                    } else {
                        delta += tx.paidAmount
                    }
                }
                "RECEIVE_PAYMENT" -> delta += tx.paidAmount.coerceAtLeast(tx.amount)
                "EXPENSE" -> delta -= tx.paidAmount.coerceAtLeast(tx.amount)
                "PURCHASE" -> delta -= tx.paidAmount
                "SUPPLIER_PAYMENT" -> delta -= tx.paidAmount.coerceAtLeast(tx.amount)
            }
        }
        startingCash + delta
    }

    fun exportBusinessReportCsv() {
        val sb = StringBuilder()
        sb.appendLine("Business Report,$periodSubtitle")
        sb.appendLine("Metric,Amount")
        sb.appendLine("Net sales,$netSales")
        sb.appendLine("Gross profit,$grossProfit")
        sb.appendLine("Expenses,$totalExpenses")
        sb.appendLine("Net profit,$netProfit")
        sb.appendLine("Total sales,$totalSalesGross")
        sb.appendLine("Discount,$totalDiscount")
        sb.appendLine("Returns,$totalReturns")
        sb.appendLine("Cost of goods sold,$totalCogs")
        sb.appendLine()
        sb.appendLine("Day by day")
        sb.appendLine("Date,Sales,Profit")
        dayByDayRows.forEach { d ->
            sb.appendLine("\"${d.dateLabel}\",\"${d.netSales}\",\"${d.grossProfit}\"")
        }
        sb.appendLine()
        sb.appendLine("Top products")
        sb.appendLine("Product,Quantity,Profit")
        topProductsList.forEach { p ->
            sb.appendLine("\"${p.productName}\",\"${formatCleanQty(p.quantity)} ${p.unit}\",\"${p.profit}\"")
        }
        sb.appendLine()
        sb.appendLine("Shop position")
        sb.appendLine("Stock value (buy price),$stockValueBuyPrice")
        sb.appendLine("Stock value (sell price),$stockValueSellPrice")
        sb.appendLine("Customers owe,$customersOweTotal")
        sb.appendLine("Owed to suppliers,$owedToSuppliersTotal")
        sb.appendLine("Cash in hand,$cashInHandCurrent")

        com.example.ui.util.ExportHelper.shareCsv(
            context = context,
            filenamePrefix = "business_report",
            title = "Business Report ($periodSubtitle)",
            csvContent = sb.toString()
        )
    }

    fun printBusinessReportPdf() {
        val html = buildString {
            append("<html><head><style>")
            append("body { font-family: sans-serif; padding: 16px; color: #1A1C1E; }")
            append("h2 { margin-bottom: 4px; } h3 { margin-top: 18px; margin-bottom: 6px; }")
            append("p { margin-top: 0; color: #6B7280; font-size: 12px; }")
            append("table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }")
            append("th, td { border-bottom: 1px solid #E5E7EB; padding: 7px 6px; text-align: left; }")
            append(".num { text-align: right; }")
            append("</style></head><body>")
            append("<h2>${if (isBn) "ব্যবসায়িক রিপোর্ট" else "Business report"}</h2>")
            append("<p>$periodSubtitle</p>")
            append("<table><tbody>")
            append("<tr><td>${if (isBn) "নিট বিক্রি" else "Net sales"}</td><td class='num'>৳ ${formatBizAmount(netSales)}</td></tr>")
            append("<tr><td>${if (isBn) "মোট লাভ (Gross)" else "Gross profit"}</td><td class='num'>৳ ${formatBizAmount(grossProfit)}</td></tr>")
            append("<tr><td>${if (isBn) "খরচ" else "Expenses"}</td><td class='num'>৳ ${formatBizAmount(totalExpenses)}</td></tr>")
            append("<tr><td>${if (isBn) "নিট লাভ" else "Net profit"}</td><td class='num'>৳ ${formatBizAmount(netProfit)}</td></tr>")
            append("<tr><td>${if (isBn) "মোট বিক্রি" else "Total sales"}</td><td class='num'>৳ ${formatBizAmount(totalSalesGross)}</td></tr>")
            append("<tr><td>&minus; ${if (isBn) "ছাড় (Discount)" else "Discount"}</td><td class='num'>৳ ${formatBizAmount(totalDiscount)}</td></tr>")
            append("<tr><td>&minus; ${if (isBn) "ফেরত (Returns)" else "Returns"}</td><td class='num'>৳ ${formatBizAmount(totalReturns)}</td></tr>")
            append("<tr><td>&minus; ${if (isBn) "পণ্যের ক্রয়মূল্য (COGS)" else "Cost of goods sold"}</td><td class='num'>৳ ${formatBizAmount(totalCogs)}</td></tr>")
            append("</tbody></table>")
            append("<h3>${if (isBn) "প্রতিদিনের হিসাব" else "Day by day"}</h3>")
            append("<table><thead><tr><th>${if (isBn) "তারিখ" else "Date"}</th><th class='num'>${if (isBn) "বিক্রি" else "Sales"}</th><th class='num'>${if (isBn) "লাভ" else "Profit"}</th></tr></thead><tbody>")
            dayByDayRows.forEach { d ->
                append("<tr><td>${d.dateLabel}</td><td class='num'>৳ ${formatBizAmount(d.netSales)}</td><td class='num'>৳ ${formatBizAmount(d.grossProfit)}</td></tr>")
            }
            append("</tbody></table>")
            append("<h3>${if (isBn) "দোকানের বর্তমান অবস্থা" else "Shop position"}</h3>")
            append("<table><tbody>")
            append("<tr><td>${if (isBn) "স্টকের মূল্য (ক্রয়মূল্য)" else "Stock value (buy price)"}</td><td class='num'>৳ ${formatBizAmount(stockValueBuyPrice)}</td></tr>")
            append("<tr><td>${if (isBn) "স্টকের মূল্য (বিক্রয়মূল্য)" else "Stock value (sell price)"}</td><td class='num'>৳ ${formatBizAmount(stockValueSellPrice)}</td></tr>")
            append("<tr><td>${if (isBn) "কাস্টমারের কাছে পাওনা" else "Customers owe"}</td><td class='num'>৳ ${formatBizAmount(customersOweTotal)}</td></tr>")
            append("<tr><td>${if (isBn) "মহাজনের পাওনা" else "Owed to suppliers"}</td><td class='num'>৳ ${formatBizAmount(owedToSuppliersTotal)}</td></tr>")
            append("<tr><td>${if (isBn) "হাতে নগদ ক্যাশ" else "Cash in hand"}</td><td class='num'>৳ ${formatBizAmount(cashInHandCurrent)}</td></tr>")
            append("</tbody></table></body></html>")
        }
        printBusinessReportHtml(context, "Business_Report", html)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BizReportCreamBg)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .testTag("business_report_module_list"),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // 1. Top Bar: [←] Business report
            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Surface(
                        onClick = onBackToMoreMenu,
                        shape = RoundedCornerShape(10.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, BizReportCardBorder),
                        modifier = Modifier
                            .size(38.dp)
                            .testTag("business_report_back_button")
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = BizReportTextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Text(
                        text = if (isBn) "ব্যবসায়িক রিপোর্ট" else "Business report",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = BizReportTextPrimary
                    )
                }
            }

            // 2. 5-Segment Period Filter: Today | 7 days | This month | Last month | Pick dates
            item {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, BizReportCardBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        BizReportRangeFilter.entries.forEach { filter ->
                            val isSelected = selectedRange == filter
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .weight(1f)
                                    .background(
                                        if (isSelected) BizReportActiveOrange else Color.Transparent
                                    )
                                    .clickable { selectedRange = filter }
                                    .padding(vertical = 9.dp, horizontal = 2.dp)
                                    .testTag("biz_report_filter_${filter.name.lowercase()}")
                            ) {
                                Text(
                                    text = if (isBn) filter.bnLabel else filter.label,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.SemiBold,
                                    color = if (isSelected) Color.White else BizReportTextPrimary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }

            // Custom Date Picker Row when "Pick dates" is selected
            if (selectedRange == BizReportRangeFilter.PICK_DATES) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Surface(
                            onClick = { pickingStartDate = true },
                            shape = RoundedCornerShape(10.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, BizReportCardBorder),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                                Text(if (isBn) "শুরু" else "From", fontSize = 11.sp, color = BizReportTextSecondary)
                                Text(
                                    text = dateFormatter.format(Date(customStartMillis)),
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = BizReportTextPrimary
                                )
                            }
                        }
                        Surface(
                            onClick = { pickingStartDate = false },
                            shape = RoundedCornerShape(10.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, BizReportCardBorder),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                                Text(if (isBn) "শেষ" else "To", fontSize = 11.sp, color = BizReportTextSecondary)
                                Text(
                                    text = dateFormatter.format(Date(customEndMillis)),
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = BizReportTextPrimary
                                )
                            }
                        }
                    }
                }
            }

            // 3. Export Buttons Row + Period Subtitle
            item {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            onClick = { exportBusinessReportCsv() },
                            shape = RoundedCornerShape(8.dp),
                            color = BizReportActiveOrange,
                            modifier = Modifier.testTag("biz_report_export_csv_button")
                        ) {
                            Text(
                                text = "↓ CSV",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.White,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp)
                            )
                        }

                        Surface(
                            onClick = { printBusinessReportPdf() },
                            shape = RoundedCornerShape(8.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, BizReportCardBorder),
                            modifier = Modifier.testTag("biz_report_print_pdf_button")
                        ) {
                            Text(
                                text = if (isBn) "🖨️ পিডিএফ / প্রিন্ট" else "🖨️ PDF / Print",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = BizReportTextPrimary,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp)
                            )
                        }
                    }

                    Text(
                        text = periodSubtitle,
                        fontSize = 12.5.sp,
                        color = BizReportTextSecondary
                    )
                }
            }

            // 4. 2x2 KPI Summary Cards: Net sales | Gross profit / Expenses | Net profit
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        BizKpiCard(
                            amountText = "৳ ${formatBizAmount(netSales)}",
                            label = if (isBn) "নিট বিক্রি" else "Net sales",
                            valueColor = BizReportTextPrimary,
                            modifier = Modifier.weight(1f)
                        )
                        BizKpiCard(
                            amountText = "৳ ${formatBizAmount(grossProfit)}",
                            label = if (isBn) "মোট লাভ (Gross)" else "Gross profit",
                            valueColor = BizReportTextPrimary,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        BizKpiCard(
                            amountText = "৳ ${formatBizAmount(totalExpenses)}",
                            label = if (isBn) "খরচ" else "Expenses",
                            valueColor = BizReportTextPrimary,
                            modifier = Modifier.weight(1f)
                        )
                        BizKpiCard(
                            amountText = "৳ ${formatBizAmount(netProfit)}",
                            label = if (isBn) "নিট লাভ" else "Net profit",
                            valueColor = when {
                                netProfit < 0.0 -> BizReportCoral
                                netProfit > 0.0 -> BizReportGreen
                                else -> BizReportTextPrimary
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            // 5. Sales & COGS Breakdown Card
            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, BizReportCardBorder),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("biz_report_sales_breakdown_card")
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        BizKeyValueRow(if (isBn) "মোট বিক্রি" else "Total sales", "৳ ${formatBizAmount(totalSalesGross)}", isValueBold = true)
                        BizKeyValueRow(if (isBn) "− ছাড় (Discount)" else "− Discount", "৳ ${formatBizAmount(totalDiscount)}", isValueBold = true)
                        BizKeyValueRow(if (isBn) "− ফেরত (Returns)" else "− Returns", "৳ ${formatBizAmount(totalReturns)}", isValueBold = true)
                        BizKeyValueRow(if (isBn) "− পণ্যের ক্রয়মূল্য (COGS)" else "− Cost of goods sold", "৳ ${formatBizAmount(totalCogs)}", isValueBold = true)

                        Spacer(modifier = Modifier.height(2.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "মোট বিক্রয় সংখ্যা: $activeSalesCount" else "Sales: $activeSalesCount",
                                fontSize = 12.sp,
                                color = BizReportTextSecondary
                            )
                            Text(
                                text = if (isBn) "গড় বিক্রি: ৳ ${formatBizAmount(averageSale)}" else "Average sale: ৳ ${formatBizAmount(averageSale)}",
                                fontSize = 12.sp,
                                color = BizReportTextSecondary
                            )
                        }
                    }
                }
            }

            // 6. "Day by day" Card with Bar Chart & Table
            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, BizReportCardBorder),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("biz_report_day_by_day_card")
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 16.dp)
                    ) {
                        Text(
                            text = if (isBn) "প্রতিদিনের হিসাব" else "Day by day",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = BizReportTextPrimary
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        if (dayByDayRows.isNotEmpty()) {
                            val maxSales = remember(dayByDayRows) {
                                dayByDayRows.maxOfOrNull { it.netSales }?.coerceAtLeast(1.0) ?: 1.0
                            }

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(78.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.Bottom
                            ) {
                                dayByDayRows.forEach { d ->
                                    val fraction = (d.netSales / maxSales).toFloat().coerceIn(0f, 1f)
                                    Column(
                                        modifier = Modifier
                                            .weight(1f)
                                            .fillMaxHeight(),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Bottom
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .weight(1f),
                                            contentAlignment = Alignment.BottomCenter
                                        ) {
                                            if (d.netSales > 0.0) {
                                                Box(
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .fillMaxHeight(fraction.coerceAtLeast(0.08f))
                                                        .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                                        .background(BizReportTealBar)
                                                )
                                            } else {
                                                Box(
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .height(2.dp)
                                                        .background(BizReportTealBar.copy(alpha = 0.7f))
                                                )
                                            }
                                        }
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = d.dayOfMonthLabel,
                                            fontSize = 10.sp,
                                            color = BizReportTextSecondary
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(14.dp))
                        }

                        // Table Header: Date | Sales | Profit
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "তারিখ" else "Date",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = BizReportTextPrimary,
                                modifier = Modifier.weight(1.4f)
                            )
                            Text(
                                text = if (isBn) "বিক্রি" else "Sales",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = BizReportTextPrimary,
                                textAlign = TextAlign.End,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                text = if (isBn) "লাভ" else "Profit",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = BizReportTextPrimary,
                                textAlign = TextAlign.End,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        HorizontalDivider(color = BizReportCardBorder)

                        dayByDayRows.forEachIndexed { index, row ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = row.dateLabel,
                                    fontSize = 13.sp,
                                    color = BizReportTextPrimary,
                                    modifier = Modifier.weight(1.4f)
                                )
                                Text(
                                    text = "৳ ${formatBizAmount(row.netSales)}",
                                    fontSize = 13.sp,
                                    color = BizReportTextPrimary,
                                    textAlign = TextAlign.End,
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    text = "৳ ${formatBizAmount(row.grossProfit)}",
                                    fontSize = 13.sp,
                                    color = BizReportTextPrimary,
                                    textAlign = TextAlign.End,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            if (index < dayByDayRows.lastIndex) {
                                HorizontalDivider(color = BizReportCardBorder.copy(alpha = 0.6f))
                            }
                        }
                    }
                }
            }

            // 7. "Top products" Card with Profit | Quantity toggle
            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, BizReportCardBorder),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("biz_report_top_products_card")
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "সেরা পণ্যসমূহ" else "Top products",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = BizReportTextPrimary
                            )

                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = Color.White,
                                border = BorderStroke(1.dp, BizReportCardBorder)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    TopProductsSortMode.entries.forEach { mode ->
                                        val selected = topProductsSort == mode
                                        Box(
                                            contentAlignment = Alignment.Center,
                                            modifier = Modifier
                                                .background(
                                                    if (selected) BizReportActiveOrange else Color.Transparent
                                                )
                                                .clickable { topProductsSort = mode }
                                                .padding(horizontal = 11.dp, vertical = 6.dp)
                                                .testTag("top_products_sort_${mode.name.lowercase()}")
                                        ) {
                                            Text(
                                                text = if (isBn) mode.bnLabel else mode.label,
                                                fontSize = 12.sp,
                                                fontWeight = if (selected) FontWeight.ExtraBold else FontWeight.SemiBold,
                                                color = if (selected) Color.White else BizReportTextPrimary
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "পণ্য" else "Product",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = BizReportTextPrimary,
                                modifier = Modifier.weight(1.4f)
                            )
                            Text(
                                text = if (isBn) "পরিমাণ" else "Quantity",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = BizReportTextPrimary,
                                textAlign = TextAlign.End,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                text = if (isBn) "লাভ" else "Profit",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = BizReportTextPrimary,
                                textAlign = TextAlign.End,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        HorizontalDivider(color = BizReportCardBorder)

                        if (topProductsList.isEmpty()) {
                            Text(
                                text = if (isBn) "এই সময়ে কোনো পণ্য বিক্রি হয়নি।" else "No product sales in this period.",
                                fontSize = 13.sp,
                                color = BizReportTextSecondary,
                                modifier = Modifier.padding(vertical = 12.dp)
                            )
                        } else {
                            topProductsList.forEachIndexed { index, row ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = row.productName,
                                        fontSize = 13.sp,
                                        color = BizReportTextPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.weight(1.4f)
                                    )
                                    Text(
                                        text = "${formatCleanQty(row.quantity)} ${row.unit}",
                                        fontSize = 13.sp,
                                        color = BizReportTextPrimary,
                                        textAlign = TextAlign.End,
                                        modifier = Modifier.weight(1f)
                                    )
                                    Text(
                                        text = "৳ ${formatBizAmount(row.profit)}",
                                        fontSize = 13.sp,
                                        color = BizReportTextPrimary,
                                        textAlign = TextAlign.End,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                                if (index < topProductsList.lastIndex) {
                                    HorizontalDivider(color = BizReportCardBorder.copy(alpha = 0.6f))
                                }
                            }
                        }
                    }
                }
            }

            // 8. "Slow products" Card
            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, BizReportCardBorder),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("biz_report_slow_products_card")
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 16.dp)
                    ) {
                        Text(
                            text = if (isBn) "ধীরগতির পণ্য (Slow products)" else "Slow products",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = BizReportTextPrimary
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = if (isBn) "৩০ দিনে বিক্রি হয়নি কিন্তু স্টকে আছে" else "Not sold in 30 days but still in stock",
                            fontSize = 12.sp,
                            color = BizReportTextSecondary
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isBn) "পণ্য" else "Product",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = BizReportTextPrimary,
                                modifier = Modifier.weight(1.4f)
                            )
                            Text(
                                text = if (isBn) "স্টক" else "Stock",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = BizReportTextPrimary,
                                textAlign = TextAlign.End,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                text = if (isBn) "শেষ বিক্রি" else "Last sale",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = BizReportTextPrimary,
                                textAlign = TextAlign.End,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        HorizontalDivider(color = BizReportCardBorder)

                        if (slowProductsList.isEmpty()) {
                            Text(
                                text = if (isBn) "স্টকে থাকা সব পণ্যের সাম্প্রতিক বিক্রি রয়েছে।" else "All stocked products have recent sales.",
                                fontSize = 13.sp,
                                color = BizReportTextSecondary,
                                modifier = Modifier.padding(vertical = 12.dp)
                            )
                        } else {
                            slowProductsList.forEachIndexed { index, row ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = row.productName,
                                        fontSize = 13.sp,
                                        color = BizReportTextPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.weight(1.4f)
                                    )
                                    Text(
                                        text = row.stockText,
                                        fontSize = 13.sp,
                                        color = BizReportTextPrimary,
                                        textAlign = TextAlign.End,
                                        modifier = Modifier.weight(1f)
                                    )
                                    Text(
                                        text = row.lastSaleLabel,
                                        fontSize = 13.sp,
                                        color = BizReportTextPrimary,
                                        textAlign = TextAlign.End,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                                if (index < slowProductsList.lastIndex) {
                                    HorizontalDivider(color = BizReportCardBorder.copy(alpha = 0.6f))
                                }
                            }
                        }
                    }
                }
            }

            // 9. "Shop position" Card
            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, BizReportCardBorder),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("biz_report_shop_position_card")
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = if (isBn) "দোকানের বর্তমান অবস্থা" else "Shop position",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = BizReportTextPrimary
                        )

                        BizKeyValueRow(
                            label = if (isBn) "স্টকের মূল্য (ক্রয়মূল্য)" else "Stock value (buy price)",
                            value = "৳ ${formatBizAmount(stockValueBuyPrice)}",
                            isValueBold = true
                        )
                        BizKeyValueRow(
                            label = if (isBn) "স্টকের মূল্য (বিক্রয়মূল্য)" else "Stock value (sell price)",
                            value = "৳ ${formatBizAmount(stockValueSellPrice)}",
                            isValueBold = true
                        )
                        BizKeyValueRow(
                            label = if (isBn) "কাস্টমারের কাছে পাওনা" else "Customers owe",
                            value = "৳ ${formatBizAmount(customersOweTotal)}",
                            isValueBold = true
                        )
                        BizKeyValueRow(
                            label = if (isBn) "মহাজনের পাওনা" else "Owed to suppliers",
                            value = "৳ ${formatBizAmount(owedToSuppliersTotal)}",
                            isValueBold = true
                        )
                        BizKeyValueRow(
                            label = if (isBn) "হাতে নগদ ক্যাশ" else "Cash in hand",
                            value = "৳ ${formatBizAmount(cashInHandCurrent)}",
                            isValueBold = true
                        )
                    }
                }
            }
        }
    }

    if (pickingStartDate != null) {
        val isPickingStart = pickingStartDate == true
        val pickerState = rememberDatePickerState(
            initialSelectedDateMillis = if (isPickingStart) customStartMillis else customEndMillis
        )
        DatePickerDialog(
            onDismissRequest = { pickingStartDate = null },
            confirmButton = {
                TextButton(
                    onClick = {
                        pickerState.selectedDateMillis?.let { millis ->
                            if (isPickingStart) {
                                customStartMillis = millis
                            } else {
                                customEndMillis = millis
                            }
                        }
                        pickingStartDate = null
                    }
                ) {
                    Text(if (isBn) "ঠিক আছে" else "OK", color = BizReportTerracotta, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { pickingStartDate = null }) {
                    Text(if (isBn) "বাতিল" else "Cancel", color = BizReportTextSecondary)
                }
            }
        ) {
            DatePicker(state = pickerState)
        }
    }
}

@Composable
private fun BizKpiCard(
    amountText: String,
    label: String,
    valueColor: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Color.White,
        border = BorderStroke(1.dp, BizReportCardBorder),
        modifier = modifier
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .align(Alignment.TopEnd)
                    .offset(x = 16.dp, y = (-16).dp)
                    .clip(CircleShape)
                    .background(BizReportTerracotta.copy(alpha = 0.08f))
            )
            Column(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)
            ) {
                Text(
                    text = amountText,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = valueColor
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = label,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = BizReportTextSecondary
                )
            }
        }
    }
}

@Composable
private fun BizKeyValueRow(
    label: String,
    value: String,
    isValueBold: Boolean = false
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            fontSize = 13.5.sp,
            color = BizReportTextPrimary.copy(alpha = 0.88f)
        )
        Text(
            text = value,
            fontSize = 13.5.sp,
            fontWeight = if (isValueBold) FontWeight.Bold else FontWeight.Medium,
            color = BizReportTextPrimary
        )
    }
}
