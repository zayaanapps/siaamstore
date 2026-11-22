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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import com.example.data.model.StoreTransaction
import com.example.ui.i18n.AppLanguage
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

private val DueReportCreamBg = Color(0xFFF0F9F5)
private val DueReportCardBorder = Color(0xFFB6EADA)
private val DueReportActiveOrange = Color(0xFF00B368)
private val DueReportCoral = Color(0xFFE11D48)
private val DueReportGreen = Color(0xFF00A862)
private val DueReportTextPrimary = Color(0xFF0F172A)
private val DueReportTextSecondary = Color(0xFF64748B)

enum class DueReportTab(val label: String, val bnLabel: String) {
    OUTSTANDING_LIST("Outstanding list", "বকেয়া তালিকা"),
    MONTHLY_TRANSACTIONS("Monthly transactions", "মাসিক লেনদেন")
}

private data class OutstandingCustomerRow(
    val customerId: String,
    val customerName: String,
    val phone: String,
    val creditGiven: Double,
    val received: Double,
    val balance: Double,
    val lastEntryDate: String
)

private data class MonthlyCreditTxRow(
    val id: String,
    val dateLabel: String,
    val customerName: String,
    val typeLabel: String,
    val note: String,
    val creditGiven: Double,
    val received: Double,
    val timestampMillis: Long
)

private fun formatReportAmount(value: Double): String {
    return if (value % 1.0 == 0.0) {
        "%,d".format(Locale.US, value.toLong())
    } else {
        "%,.2f".format(Locale.US, value)
    }
}

private fun cleanReportNote(rawNote: String): String {
    val trimmed = rawNote.substringBefore("||ITEMS:").trim()
    val defaultPhrases = setOf(
        "Baki entry",
        "Due payment received",
        "POS Checkout",
        "Customer credit entry",
        "Customer payment received",
        "Initial balance"
    )
    return if (trimmed in defaultPhrases) "" else trimmed
}

private fun printHtmlReport(context: Context, jobName: String, htmlContent: String) {
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

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DueReportsModuleScreen(
    storeOwnerName: String,
    customers: List<Customer>,
    transactions: List<StoreTransaction>,
    language: AppLanguage = AppLanguage.BENGALI,
    onBackToMoreMenu: () -> Unit
) {
    val isBn = language == AppLanguage.BENGALI
    val context = LocalContext.current
    var activeTab by rememberSaveable { mutableStateOf(DueReportTab.OUTSTANDING_LIST) }

    val initialCal = remember { Calendar.getInstance() }
    var selectedYear by rememberSaveable { mutableIntStateOf(initialCal.get(Calendar.YEAR)) }
    var selectedMonth by rememberSaveable { mutableIntStateOf(initialCal.get(Calendar.MONTH)) }
    var showMonthDropdown by remember { mutableStateOf(false) }

    BackHandler {
        onBackToMoreMenu()
    }

    val dateFormatter = remember { SimpleDateFormat("d MMM yyyy", Locale.US) }
    val generatedDateLabel = remember { dateFormatter.format(Date()) }
    val ownerDisplay = storeOwnerName.trim().ifBlank { if (isBn) "স্টোর" else "Store" }

    val selectedMonthDisplay = remember(selectedYear, selectedMonth) {
        val cal = Calendar.getInstance().apply {
            set(Calendar.YEAR, selectedYear)
            set(Calendar.MONTH, selectedMonth)
            set(Calendar.DAY_OF_MONTH, 1)
        }
        SimpleDateFormat("MMMM yyyy", Locale.US).format(cal.time)
    }

    val selectedYearMonthCode = remember(selectedYear, selectedMonth) {
        "%04d-%02d".format(Locale.US, selectedYear, selectedMonth + 1)
    }

    // Month options for dropdown (last 12 months + next 2 months)
    val monthDropdownOptions = remember {
        val list = mutableListOf<Triple<Int, Int, String>>()
        val fmt = SimpleDateFormat("MMMM yyyy", Locale.US)
        for (offset in -11..2) {
            val c = Calendar.getInstance().apply {
                set(Calendar.DAY_OF_MONTH, 1)
                add(Calendar.MONTH, offset)
            }
            list.add(
                Triple(
                    c.get(Calendar.YEAR),
                    c.get(Calendar.MONTH),
                    fmt.format(c.time)
                )
            )
        }
        list.reversed()
    }

    // 1. Compute Outstanding Customer Rows
    val outstandingRows = remember(customers, transactions) {
        customers
            .filter { it.totalDue > 0.0 }
            .sortedByDescending { it.totalDue }
            .map { cust ->
                val custTxs = transactions.filter { tx ->
                    val isVoidOrReturn = tx.title.startsWith("[VOID]", ignoreCase = true) ||
                        tx.title.startsWith("[RETURN]", ignoreCase = true) ||
                        tx.notes.startsWith("[VOID]", ignoreCase = true) ||
                        tx.notes.startsWith("[RETURN]", ignoreCase = true)
                    !isVoidOrReturn && (
                        (tx.customerId.isNotBlank() && tx.customerId == cust.id) ||
                            (tx.customerId.isBlank() && tx.customerName.equals(cust.name, ignoreCase = true))
                        )
                }

                val txCredit = custTxs.sumOf { tx ->
                    when (tx.type) {
                        "GIVE_DUE" -> tx.dueAmount.coerceAtLeast(tx.amount)
                        "SALE" -> tx.dueAmount
                        else -> 0.0
                    }
                }
                val txReceived = custTxs.sumOf { tx ->
                    when (tx.type) {
                        "RECEIVE_PAYMENT" -> tx.paidAmount.coerceAtLeast(tx.amount)
                        else -> 0.0
                    }
                }

                val balance = cust.totalDue.coerceAtLeast(0.0)
                val received = maxOf(txReceived, cust.totalPaid)
                val creditGiven = maxOf(txCredit, balance + received)

                val latestMillis = custTxs.maxOfOrNull { it.createdAt?.toDate()?.time ?: 0L }
                    ?: cust.updatedAt?.toDate()?.time
                    ?: cust.createdAt?.toDate()?.time
                    ?: System.currentTimeMillis()

                OutstandingCustomerRow(
                    customerId = cust.id,
                    customerName = cust.name,
                    phone = cust.phone.ifBlank { "—" },
                    creditGiven = creditGiven,
                    received = received,
                    balance = balance,
                    lastEntryDate = dateFormatter.format(Date(latestMillis))
                )
            }
    }

    val totalOutstandingCreditGiven = remember(outstandingRows) {
        outstandingRows.sumOf { it.creditGiven }
    }
    val totalOutstandingReceived = remember(outstandingRows) {
        outstandingRows.sumOf { it.received }
    }
    val totalOutstandingBalance = remember(outstandingRows) {
        outstandingRows.sumOf { it.balance }
    }

    // 2. Compute Monthly Transactions Rows
    val monthlyRows = remember(transactions, selectedYear, selectedMonth) {
        transactions.mapNotNull { tx ->
            val isVoidOrReturn = tx.title.startsWith("[VOID]", ignoreCase = true) ||
                tx.title.startsWith("[RETURN]", ignoreCase = true) ||
                tx.notes.startsWith("[VOID]", ignoreCase = true) ||
                tx.notes.startsWith("[RETURN]", ignoreCase = true)
            if (isVoidOrReturn) return@mapNotNull null

            val millis = tx.createdAt?.toDate()?.time ?: System.currentTimeMillis()
            val cal = Calendar.getInstance().apply { timeInMillis = millis }
            if (cal.get(Calendar.YEAR) != selectedYear || cal.get(Calendar.MONTH) != selectedMonth) {
                return@mapNotNull null
            }

            when (tx.type) {
                "GIVE_DUE" -> {
                    val creditAmt = tx.dueAmount.coerceAtLeast(tx.amount)
                    if (creditAmt <= 0.0) return@mapNotNull null
                    MonthlyCreditTxRow(
                        id = tx.id,
                        dateLabel = dateFormatter.format(Date(millis)),
                        customerName = tx.customerName.ifBlank { "Customer" },
                        typeLabel = "Credit",
                        note = cleanReportNote(tx.notes),
                        creditGiven = creditAmt,
                        received = 0.0,
                        timestampMillis = millis
                    )
                }
                "SALE" -> {
                    if (tx.dueAmount <= 0.0) return@mapNotNull null
                    MonthlyCreditTxRow(
                        id = tx.id,
                        dateLabel = dateFormatter.format(Date(millis)),
                        customerName = tx.customerName.ifBlank { "Customer" },
                        typeLabel = "Credit",
                        note = cleanReportNote(tx.notes),
                        creditGiven = tx.dueAmount,
                        received = 0.0,
                        timestampMillis = millis
                    )
                }
                "RECEIVE_PAYMENT" -> {
                    val recAmt = tx.paidAmount.coerceAtLeast(tx.amount)
                    if (recAmt <= 0.0) return@mapNotNull null
                    MonthlyCreditTxRow(
                        id = tx.id,
                        dateLabel = dateFormatter.format(Date(millis)),
                        customerName = tx.customerName.ifBlank { "Customer" },
                        typeLabel = "Payment",
                        note = cleanReportNote(tx.notes),
                        creditGiven = 0.0,
                        received = recAmt,
                        timestampMillis = millis
                    )
                }
                else -> null
            }
        }.sortedBy { it.timestampMillis }
    }

    val monthlyCreditGivenTotal = remember(monthlyRows) {
        monthlyRows.sumOf { it.creditGiven }
    }
    val monthlyReceivedTotal = remember(monthlyRows) {
        monthlyRows.sumOf { it.received }
    }

    fun exportCsv() {
        val sb = StringBuilder()
        if (activeTab == DueReportTab.OUTSTANDING_LIST) {
            sb.appendLine("Customer,Phone,Credit given,Received,Balance,Last entry")
            outstandingRows.forEach { row ->
                sb.appendLine("\"${row.customerName}\",\"${row.phone}\",\"${row.creditGiven}\",\"${row.received}\",\"${row.balance}\",\"${row.lastEntryDate}\"")
            }
            sb.appendLine("\"Total\",\"\",\"$totalOutstandingCreditGiven\",\"$totalOutstandingReceived\",\"$totalOutstandingBalance\",\"\"")
        } else {
            sb.appendLine("Date,Customer,Type,Note,Credit given,Received")
            monthlyRows.forEach { row ->
                sb.appendLine("\"${row.dateLabel}\",\"${row.customerName}\",\"${row.typeLabel}\",\"${row.note}\",\"${if (row.creditGiven > 0) row.creditGiven else ""}\",\"${if (row.received > 0) row.received else ""}\"")
            }
            sb.appendLine("\"Total\",\"\",\"\",\"\",\"$monthlyCreditGivenTotal\",\"$monthlyReceivedTotal\"")
        }

        val reportTitle = if (activeTab == DueReportTab.OUTSTANDING_LIST) {
            if (isBn) "বাকি রিপোর্ট - বকেয়া তালিকা" else "Due Report - Outstanding List"
        } else {
            if (isBn) "বাকি রিপোর্ট - মাসিক লেনদেন ($selectedYearMonthCode)" else "Due Report - Monthly Transactions ($selectedYearMonthCode)"
        }
        com.example.ui.util.ExportHelper.shareCsv(
            context = context,
            filenamePrefix = if (activeTab == DueReportTab.OUTSTANDING_LIST) "due_outstanding_report" else "due_monthly_report",
            title = reportTitle,
            csvContent = sb.toString()
        )
    }

    fun printOrSavePdf() {
        val html = if (activeTab == DueReportTab.OUTSTANDING_LIST) {
            buildString {
                append("<html><head><style>")
                append("body { font-family: sans-serif; padding: 16px; color: #1A1C1E; }")
                append("h2 { margin-bottom: 4px; } p { margin-top: 0; color: #6B7280; font-size: 12px; }")
                append("table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }")
                append("th, td { border-bottom: 1px solid #E5E7EB; padding: 8px 6px; text-align: left; }")
                append(".num { text-align: right; } .total { font-weight: bold; }")
                append("</style></head><body>")
                append("<h2>${if (isBn) "বকেয়া কাস্টমার তালিকা" else "Outstanding list"}</h2>")
                append("<p>$ownerDisplay &middot; ${if (isBn) "তৈরির তারিখ" else "Generated on"}: $generatedDateLabel</p>")
                append("<table><thead><tr><th>${if (isBn) "কাস্টমার" else "Customer"}</th><th>${if (isBn) "ফোন" else "Phone"}</th><th class='num'>${if (isBn) "বাকি প্রদান" else "Credit given"}</th><th class='num'>${if (isBn) "জমা আদায়" else "Received"}</th><th class='num'>${if (isBn) "বর্তমান বাকি" else "Balance"}</th><th>${if (isBn) "শেষ লেনদেন" else "Last entry"}</th></tr></thead><tbody>")
                outstandingRows.forEach { r ->
                    append("<tr><td>${r.customerName}</td><td>${r.phone}</td><td class='num'>৳ ${formatReportAmount(r.creditGiven)}</td><td class='num'>৳ ${formatReportAmount(r.received)}</td><td class='num'>৳ ${formatReportAmount(r.balance)}</td><td>${r.lastEntryDate}</td></tr>")
                }
                append("<tr class='total'><td>${if (isBn) "মোট" else "Total"}</td><td></td><td class='num'>৳ ${formatReportAmount(totalOutstandingCreditGiven)}</td><td class='num'>৳ ${formatReportAmount(totalOutstandingReceived)}</td><td class='num'>৳ ${formatReportAmount(totalOutstandingBalance)}</td><td></td></tr>")
                append("</tbody></table></body></html>")
            }
        } else {
            buildString {
                append("<html><head><style>")
                append("body { font-family: sans-serif; padding: 16px; color: #1A1C1E; }")
                append("h2 { margin-bottom: 4px; } p { margin-top: 0; color: #6B7280; font-size: 12px; }")
                append("table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }")
                append("th, td { border-bottom: 1px solid #E5E7EB; padding: 8px 6px; text-align: left; }")
                append(".num { text-align: right; } .total { font-weight: bold; }")
                append("</style></head><body>")
                append("<h2>${if (isBn) "মাসিক লেনদেন" else "Monthly transactions"} &middot; $selectedYearMonthCode</h2>")
                append("<p>$ownerDisplay &middot; ${if (isBn) "তৈরির তারিখ" else "Generated on"}: $generatedDateLabel</p>")
                append("<table><thead><tr><th>${if (isBn) "তারিখ" else "Date"}</th><th>${if (isBn) "কাস্টমার" else "Customer"}</th><th>${if (isBn) "ধরন" else "Type"}</th><th>${if (isBn) "নোট" else "Note"}</th><th class='num'>${if (isBn) "বাকি প্রদান" else "Credit given"}</th><th class='num'>${if (isBn) "জমা আদায়" else "Received"}</th></tr></thead><tbody>")
                monthlyRows.forEach { r ->
                    val cg = if (r.creditGiven > 0) "৳ ${formatReportAmount(r.creditGiven)}" else ""
                    val rc = if (r.received > 0) "৳ ${formatReportAmount(r.received)}" else ""
                    val tLabel = if (isBn) {
                        if (r.typeLabel == "Credit") "বাকি" else "জমা"
                    } else r.typeLabel
                    append("<tr><td>${r.dateLabel}</td><td>${r.customerName}</td><td>$tLabel</td><td>${r.note}</td><td class='num'>$cg</td><td class='num'>$rc</td></tr>")
                }
                append("<tr class='total'><td>${if (isBn) "মোট" else "Total"}</td><td></td><td></td><td></td><td class='num'>৳ ${formatReportAmount(monthlyCreditGivenTotal)}</td><td class='num'>৳ ${formatReportAmount(monthlyReceivedTotal)}</td></tr>")
                append("</tbody></table></body></html>")
            }
        }

        printHtmlReport(
            context = context,
            jobName = if (activeTab == DueReportTab.OUTSTANDING_LIST) "Outstanding_List" else "Monthly_Transactions_$selectedYearMonthCode",
            htmlContent = html
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DueReportCreamBg)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .testTag("due_reports_module_list"),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // 1. Top Bar: [←] Reports
            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Surface(
                        onClick = onBackToMoreMenu,
                        shape = RoundedCornerShape(10.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, DueReportCardBorder),
                        modifier = Modifier
                            .size(38.dp)
                            .testTag("due_reports_back_button")
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = DueReportTextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Text(
                        text = if (isBn) "বাকি ও বকেয়া রিপোর্ট" else "Reports",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = DueReportTextPrimary
                    )
                }
            }

            // 2. Section Heading: "Reports"
            item {
                Text(
                    text = if (isBn) "বকেয়া রিপোর্টসমূহ" else "Reports",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = DueReportTextPrimary
                )
            }

            // 3. Segmented Tab Bar + Optional Month Dropdown
            item {
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, DueReportCardBorder)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            DueReportTab.entries.forEach { tab ->
                                val isSelected = activeTab == tab
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier
                                        .background(
                                            if (isSelected) DueReportActiveOrange else Color.Transparent
                                        )
                                        .clickable { activeTab = tab }
                                        .padding(horizontal = 14.dp, vertical = 9.dp)
                                        .testTag("due_report_tab_${tab.name.lowercase()}")
                                ) {
                                    Text(
                                        text = if (isBn) tab.bnLabel else tab.label,
                                        fontSize = 13.sp,
                                        fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.SemiBold,
                                        color = if (isSelected) Color.White else DueReportTextPrimary
                                    )
                                }
                            }
                        }
                    }

                    if (activeTab == DueReportTab.MONTHLY_TRANSACTIONS) {
                        Box {
                            Surface(
                                onClick = { showMonthDropdown = true },
                                shape = RoundedCornerShape(10.dp),
                                color = Color.White,
                                border = BorderStroke(1.dp, DueReportCardBorder),
                                modifier = Modifier.testTag("due_report_month_selector")
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = selectedMonthDisplay,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = DueReportTextPrimary
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Icon(
                                        imageVector = Icons.Default.KeyboardArrowDown,
                                        contentDescription = "Select month",
                                        tint = DueReportTextSecondary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }

                            DropdownMenu(
                                expanded = showMonthDropdown,
                                onDismissRequest = { showMonthDropdown = false }
                            ) {
                                monthDropdownOptions.forEach { (yr, mo, label) ->
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                text = label,
                                                fontWeight = if (yr == selectedYear && mo == selectedMonth) FontWeight.Bold else FontWeight.Normal
                                            )
                                        },
                                        onClick = {
                                            selectedYear = yr
                                            selectedMonth = mo
                                            showMonthDropdown = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 4. Summary Cards
            item {
                if (activeTab == DueReportTab.OUTSTANDING_LIST) {
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, DueReportCardBorder),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("due_report_total_outstanding_card")
                    ) {
                        Box(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .size(64.dp)
                                    .align(Alignment.TopEnd)
                                    .offset(x = 18.dp, y = (-18).dp)
                                    .clip(CircleShape)
                                    .background(DueReportCoral.copy(alpha = 0.09f))
                            )
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 14.dp)
                            ) {
                                Text(
                                    text = "৳ ${formatReportAmount(totalOutstandingBalance)}",
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = DueReportCoral
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = if (isBn) "মোট বকেয়া পাওনা" else "Total outstanding",
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = DueReportTextSecondary
                                )
                            }
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Credit given
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, DueReportCardBorder),
                            modifier = Modifier
                                .weight(1f)
                                .testTag("due_report_credit_given_card")
                        ) {
                            Box(modifier = Modifier.fillMaxWidth()) {
                                Box(
                                    modifier = Modifier
                                        .size(56.dp)
                                        .align(Alignment.TopEnd)
                                        .offset(x = 16.dp, y = (-16).dp)
                                        .clip(CircleShape)
                                        .background(DueReportCoral.copy(alpha = 0.09f))
                                )
                                Column(
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)
                                ) {
                                    Text(
                                        text = "৳ ${formatReportAmount(monthlyCreditGivenTotal)}",
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = DueReportCoral
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = if (isBn) "বাকি প্রদান" else "Credit given",
                                        fontSize = 12.5.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = DueReportTextSecondary
                                    )
                                }
                            }
                        }

                        // Received
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, DueReportCardBorder),
                            modifier = Modifier
                                .weight(1f)
                                .testTag("due_report_received_card")
                        ) {
                            Box(modifier = Modifier.fillMaxWidth()) {
                                Box(
                                    modifier = Modifier
                                        .size(56.dp)
                                        .align(Alignment.TopEnd)
                                        .offset(x = 16.dp, y = (-16).dp)
                                        .clip(CircleShape)
                                        .background(DueReportGreen.copy(alpha = 0.09f))
                                )
                                Column(
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)
                                ) {
                                    Text(
                                        text = "৳ ${formatReportAmount(monthlyReceivedTotal)}",
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = DueReportGreen
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = if (isBn) "জমা আদায়" else "Received",
                                        fontSize = 12.5.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = DueReportTextSecondary
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 5. Export Buttons Row: [↓ CSV]  [🖨️ PDF / Print]
            item {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        onClick = { exportCsv() },
                        shape = RoundedCornerShape(8.dp),
                        color = DueReportActiveOrange,
                        modifier = Modifier.testTag("due_report_export_csv_button")
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
                        onClick = { printOrSavePdf() },
                        shape = RoundedCornerShape(8.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, DueReportCardBorder),
                        modifier = Modifier.testTag("due_report_print_pdf_button")
                    ) {
                        Text(
                            text = if (isBn) "🖨️ পিডিএফ / প্রিন্ট" else "🖨️ PDF / Print",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = DueReportTextPrimary,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp)
                        )
                    }
                }
            }

            // 6. Report Table Card
            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, DueReportCardBorder),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("due_report_table_card")
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 16.dp)
                    ) {
                        if (activeTab == DueReportTab.OUTSTANDING_LIST) {
                            Text(
                                text = if (isBn) "বকেয়া কাস্টমার তালিকা" else "Outstanding list",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = DueReportTextPrimary
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = if (isBn) {
                                    "$ownerDisplay · তৈরির তারিখ: $generatedDateLabel"
                                } else {
                                    "$ownerDisplay · Generated on: $generatedDateLabel"
                                },
                                fontSize = 12.sp,
                                color = DueReportTextSecondary
                            )

                            Spacer(modifier = Modifier.height(14.dp))

                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .horizontalScroll(rememberScrollState())
                            ) {
                                // Table Header
                                Row(
                                    modifier = Modifier.padding(vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    ReportCell(if (isBn) "কাস্টমার" else "Customer", width = 105.dp, isHeader = true)
                                    ReportCell(if (isBn) "ফোন" else "Phone", width = 105.dp, isHeader = true)
                                    ReportCell(if (isBn) "বাকি প্রদান" else "Credit given", width = 95.dp, isHeader = true, alignRight = true)
                                    ReportCell(if (isBn) "জমা আদায়" else "Received", width = 85.dp, isHeader = true, alignRight = true)
                                    ReportCell(if (isBn) "বর্তমান বাকি" else "Balance", width = 85.dp, isHeader = true, alignRight = true)
                                    ReportCell(if (isBn) "শেষ লেনদেন" else "Last entry", width = 95.dp, isHeader = true, alignRight = true)
                                }
                                HorizontalDivider(color = DueReportCardBorder)

                                if (outstandingRows.isEmpty()) {
                                    Text(
                                        text = if (isBn) "কোনো বকেয়া হিসাব নেই।" else "No outstanding balances.",
                                        fontSize = 13.sp,
                                        color = DueReportTextSecondary,
                                        modifier = Modifier.padding(vertical = 18.dp)
                                    )
                                } else {
                                    outstandingRows.forEach { row ->
                                        Row(
                                            modifier = Modifier.padding(vertical = 8.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            ReportCell(row.customerName, width = 105.dp)
                                            ReportCell(row.phone, width = 105.dp)
                                            ReportCell("৳ ${formatReportAmount(row.creditGiven)}", width = 95.dp, alignRight = true)
                                            ReportCell("৳ ${formatReportAmount(row.received)}", width = 85.dp, alignRight = true)
                                            ReportCell("৳ ${formatReportAmount(row.balance)}", width = 85.dp, alignRight = true, isBold = true)
                                            ReportCell(row.lastEntryDate, width = 95.dp, alignRight = true)
                                        }
                                        HorizontalDivider(color = DueReportCardBorder.copy(alpha = 0.6f))
                                    }
                                }

                                // Total Row
                                Row(
                                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    ReportCell(if (isBn) "মোট" else "Total", width = 105.dp, isBold = true)
                                    ReportCell("", width = 105.dp)
                                    ReportCell("৳ ${formatReportAmount(totalOutstandingCreditGiven)}", width = 95.dp, alignRight = true, isBold = true)
                                    ReportCell("৳ ${formatReportAmount(totalOutstandingReceived)}", width = 85.dp, alignRight = true, isBold = true)
                                    ReportCell("৳ ${formatReportAmount(totalOutstandingBalance)}", width = 85.dp, alignRight = true, isBold = true)
                                    ReportCell("", width = 95.dp)
                                }
                            }
                        } else {
                            Text(
                                text = if (isBn) "মাসিক লেনদেন · $selectedYearMonthCode" else "Monthly transactions · $selectedYearMonthCode",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = DueReportTextPrimary
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = if (isBn) {
                                    "$ownerDisplay · তৈরির তারিখ: $generatedDateLabel"
                                } else {
                                    "$ownerDisplay · Generated on: $generatedDateLabel"
                                },
                                fontSize = 12.sp,
                                color = DueReportTextSecondary
                            )

                            Spacer(modifier = Modifier.height(14.dp))

                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .horizontalScroll(rememberScrollState())
                            ) {
                                // Table Header
                                Row(
                                    modifier = Modifier.padding(vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    ReportCell(if (isBn) "তারিখ" else "Date", width = 95.dp, isHeader = true)
                                    ReportCell(if (isBn) "কাস্টমার" else "Customer", width = 105.dp, isHeader = true)
                                    ReportCell(if (isBn) "ধরন" else "Type", width = 75.dp, isHeader = true)
                                    ReportCell(if (isBn) "নোট" else "Note", width = 95.dp, isHeader = true)
                                    ReportCell(if (isBn) "বাকি প্রদান" else "Credit given", width = 95.dp, isHeader = true, alignRight = true)
                                    ReportCell(if (isBn) "জমা আদায়" else "Received", width = 85.dp, isHeader = true, alignRight = true)
                                }
                                HorizontalDivider(color = DueReportCardBorder)

                                if (monthlyRows.isEmpty()) {
                                    Text(
                                        text = if (isBn) "এই মাসে কোনো বাকি বা জমার লেনদেন নেই।" else "No credit or payment transactions in this month.",
                                        fontSize = 13.sp,
                                        color = DueReportTextSecondary,
                                        modifier = Modifier.padding(vertical = 18.dp)
                                    )
                                } else {
                                    monthlyRows.forEach { row ->
                                        val displayType = if (isBn) {
                                            if (row.typeLabel == "Credit") "বাকি" else "জমা"
                                        } else row.typeLabel
                                        Row(
                                            modifier = Modifier.padding(vertical = 8.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            ReportCell(row.dateLabel, width = 95.dp)
                                            ReportCell(row.customerName, width = 105.dp)
                                            ReportCell(displayType, width = 75.dp)
                                            ReportCell(row.note, width = 95.dp)
                                            ReportCell(
                                                text = if (row.creditGiven > 0.0) "৳ ${formatReportAmount(row.creditGiven)}" else "",
                                                width = 95.dp,
                                                alignRight = true
                                            )
                                            ReportCell(
                                                text = if (row.received > 0.0) "৳ ${formatReportAmount(row.received)}" else "",
                                                width = 85.dp,
                                                alignRight = true
                                            )
                                        }
                                        HorizontalDivider(color = DueReportCardBorder.copy(alpha = 0.6f))
                                    }
                                }

                                // Total Row
                                Row(
                                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    ReportCell(if (isBn) "মোট" else "Total", width = 95.dp, isBold = true)
                                    ReportCell("", width = 105.dp)
                                    ReportCell("", width = 75.dp)
                                    ReportCell("", width = 95.dp)
                                    ReportCell("৳ ${formatReportAmount(monthlyCreditGivenTotal)}", width = 95.dp, alignRight = true, isBold = true)
                                    ReportCell("৳ ${formatReportAmount(monthlyReceivedTotal)}", width = 85.dp, alignRight = true, isBold = true)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReportCell(
    text: String,
    width: androidx.compose.ui.unit.Dp,
    isHeader: Boolean = false,
    isBold: Boolean = false,
    alignRight: Boolean = false
) {
    Text(
        text = text,
        fontSize = 12.5.sp,
        fontWeight = when {
            isHeader || isBold -> FontWeight.Bold
            else -> FontWeight.Medium
        },
        color = if (isHeader) DueReportTextPrimary else DueReportTextPrimary.copy(alpha = 0.92f),
        textAlign = if (alignRight) TextAlign.End else TextAlign.Start,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier
            .width(width)
            .padding(end = 8.dp)
    )
}
