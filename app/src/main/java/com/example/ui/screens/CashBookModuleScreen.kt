package com.example.ui.screens

import android.content.Intent
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.StoreTransaction
import com.example.ui.i18n.AppLanguage
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

private val CashBookCreamBg = Color(0xFFF0F9F5)
private val CashBookCardBorder = Color(0xFFB6EADA)
private val CashBookTerracotta = Color(0xFF00B368)
private val CashBookActiveOrange = Color(0xFF00B368)
private val CashBookHeroStart = Color(0xFF059669)
private val CashBookHeroEnd = Color(0xFF0EA5E9)
private val CashBookInGreen = Color(0xFF00A862)
private val CashBookOutCoral = Color(0xFFE11D48)
private val CashBookTextPrimary = Color(0xFF0F172A)
private val CashBookTextSecondary = Color(0xFF64748B)

enum class CashBookRangeFilter(val label: String, val bnLabel: String) {
    TODAY("Today", "আজ"),
    SEVEN_DAYS("7 days", "৭ দিন"),
    THIS_MONTH("This month", "এই মাস"),
    PICK_DATES("Pick dates", "তারিখ বাছুন")
}

private data class DailyCashCategoryItem(
    val label: String,
    val amount: Double,
    val isInflow: Boolean
)

private data class DailyCashGroup(
    val dayKey: Long,
    val dateLabel: String,
    val closingCashInHand: Double,
    val items: List<DailyCashCategoryItem>
)

private fun formatCashBookAmount(value: Double): String {
    return if (value % 1.0 == 0.0) {
        "%,d".format(Locale.US, value.toLong())
    } else {
        "%,.2f".format(Locale.US, value)
    }
}

private fun startOfDayMillis(millis: Long): Long {
    return Calendar.getInstance().apply {
        timeInMillis = millis
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
}

private fun endOfDayMillis(millis: Long): Long {
    return Calendar.getInstance().apply {
        timeInMillis = millis
        set(Calendar.HOUR_OF_DAY, 23)
        set(Calendar.MINUTE, 59)
        set(Calendar.SECOND, 59)
        set(Calendar.MILLISECOND, 999)
    }.timeInMillis
}

private fun effectiveTxMillis(tx: StoreTransaction): Long {
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

private fun classifyCashMovement(tx: StoreTransaction): DailyCashCategoryItem? {
    if (tx.category == "STARTING_CASH") return null
    val isVoid = tx.title.startsWith("[VOID]", ignoreCase = true) ||
        tx.notes.startsWith("[VOID]", ignoreCase = true)
    if (isVoid) return null

    val isReturn = tx.title.startsWith("[RETURN]", ignoreCase = true) ||
        tx.notes.startsWith("[RETURN]", ignoreCase = true)

    return when (tx.type) {
        "SALE" -> {
            if (isReturn) {
                val refundAmt = tx.paidAmount.coerceAtLeast(tx.amount)
                if (refundAmt > 0.0) DailyCashCategoryItem("Cash refunds", refundAmt, isInflow = false) else null
            } else {
                if (tx.paidAmount > 0.0) DailyCashCategoryItem("Cash sales", tx.paidAmount, isInflow = true) else null
            }
        }
        "RECEIVE_PAYMENT" -> {
            val amt = tx.paidAmount.coerceAtLeast(tx.amount)
            if (amt > 0.0) DailyCashCategoryItem("Customer payments", amt, isInflow = true) else null
        }
        "EXPENSE" -> {
            val amt = tx.paidAmount.coerceAtLeast(tx.amount)
            if (amt > 0.0) DailyCashCategoryItem("Expenses", amt, isInflow = false) else null
        }
        "PURCHASE" -> {
            if (tx.paidAmount > 0.0) DailyCashCategoryItem("Paid for purchases", tx.paidAmount, isInflow = false) else null
        }
        "SUPPLIER_PAYMENT" -> {
            val amt = tx.paidAmount.coerceAtLeast(tx.amount)
            if (amt > 0.0) DailyCashCategoryItem("Supplier payments", amt, isInflow = false) else null
        }
        else -> null
    }
}

private fun translateCashCategoryLabel(label: String, isBn: Boolean): String {
    if (!isBn) return label
    return when (label) {
        "Cash sales" -> "নগদ বিক্রি"
        "Customer payments" -> "কাস্টমারের জমা"
        "Cash refunds" -> "নগদ ফেরত"
        "Expenses" -> "দোকানের খরচ"
        "Paid for purchases" -> "মাল কেনায় নগদ পরিশোধ"
        "Supplier payments" -> "মহাজন পরিশোধ"
        else -> label
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CashBookModuleScreen(
    transactions: List<StoreTransaction>,
    language: AppLanguage = AppLanguage.BENGALI,
    onBackToMoreMenu: () -> Unit,
    onSetStartingCash: (Double) -> Unit
) {
    val isBn = language == AppLanguage.BENGALI
    val context = LocalContext.current
    var selectedRange by rememberSaveable { mutableStateOf(CashBookRangeFilter.SEVEN_DAYS) }
    var customStartMillis by rememberSaveable {
        mutableLongStateOf(System.currentTimeMillis() - 6L * 24L * 3600L * 1000L)
    }
    var customEndMillis by rememberSaveable {
        mutableLongStateOf(System.currentTimeMillis())
    }
    var pickingStartDate by remember { mutableStateOf<Boolean?>(null) }
    var showStartingCashSheet by rememberSaveable { mutableStateOf(false) }

    BackHandler {
        onBackToMoreMenu()
    }

    val startingCash = remember(transactions) {
        transactions
            .filter { it.category == "STARTING_CASH" }
            .maxByOrNull { it.createdAt?.toDate()?.time ?: 0L }
            ?.amount ?: 0.0
    }

    val (rangeStartMillis, rangeEndMillis) = remember(selectedRange, customStartMillis, customEndMillis) {
        val now = System.currentTimeMillis()
        when (selectedRange) {
            CashBookRangeFilter.TODAY -> {
                startOfDayMillis(now) to endOfDayMillis(now)
            }
            CashBookRangeFilter.SEVEN_DAYS -> {
                val cal = Calendar.getInstance().apply {
                    timeInMillis = now
                    add(Calendar.DAY_OF_YEAR, -6)
                }
                startOfDayMillis(cal.timeInMillis) to endOfDayMillis(now)
            }
            CashBookRangeFilter.THIS_MONTH -> {
                val cal = Calendar.getInstance().apply {
                    timeInMillis = now
                    set(Calendar.DAY_OF_MONTH, 1)
                }
                startOfDayMillis(cal.timeInMillis) to endOfDayMillis(now)
            }
            CashBookRangeFilter.PICK_DATES -> {
                val s = minOf(customStartMillis, customEndMillis)
                val e = maxOf(customStartMillis, customEndMillis)
                startOfDayMillis(s) to endOfDayMillis(e)
            }
        }
    }

    val dateFormatter = remember { SimpleDateFormat("d MMM yyyy", Locale.US) }

    // Pair of (dayStartMillis, DailyCashCategoryItem)
    val allCashEvents = remember(transactions) {
        transactions.mapNotNull { tx ->
            val movement = classifyCashMovement(tx) ?: return@mapNotNull null
            val millis = effectiveTxMillis(tx)
            Triple(startOfDayMillis(millis), millis, movement)
        }
    }

    val cashInHandAtEnd = remember(startingCash, allCashEvents, rangeEndMillis) {
        val cumulativeDelta = allCashEvents
            .filter { it.second <= rangeEndMillis }
            .sumOf { (_, _, item) -> if (item.isInflow) item.amount else -item.amount }
        startingCash + cumulativeDelta
    }

    val periodEvents = remember(allCashEvents, rangeStartMillis, rangeEndMillis) {
        allCashEvents.filter { (_, millis, _) -> millis in rangeStartMillis..rangeEndMillis }
    }

    val periodTotalIn = remember(periodEvents) {
        periodEvents.filter { it.third.isInflow }.sumOf { it.third.amount }
    }

    val periodTotalOut = remember(periodEvents) {
        periodEvents.filter { !it.third.isInflow }.sumOf { it.third.amount }
    }

    val dailyGroups = remember(periodEvents, allCashEvents, startingCash) {
        val groupedByDay = periodEvents.groupBy { it.first }
        val categoryOrder = listOf(
            "Cash sales",
            "Customer payments",
            "Cash refunds",
            "Expenses",
            "Paid for purchases",
            "Supplier payments"
        )
        groupedByDay.keys.sortedDescending().map { dayStart ->
            val dayEnd = endOfDayMillis(dayStart)
            val closingCash = startingCash + allCashEvents
                .filter { it.second <= dayEnd }
                .sumOf { (_, _, item) -> if (item.isInflow) item.amount else -item.amount }

            val dayMovements = groupedByDay[dayStart].orEmpty().map { it.third }
            val aggregatedCategories = categoryOrder.mapNotNull { label ->
                val matching = dayMovements.filter { it.label == label }
                if (matching.isEmpty()) {
                    null
                } else {
                    DailyCashCategoryItem(
                        label = label,
                        amount = matching.sumOf { it.amount },
                        isInflow = matching.first().isInflow
                    )
                }
            }

            DailyCashGroup(
                dayKey = dayStart,
                dateLabel = dateFormatter.format(Date(dayStart)),
                closingCashInHand = closingCash,
                items = aggregatedCategories
            )
        }
    }

    val endDateLabel = remember(rangeEndMillis) {
        dateFormatter.format(Date(rangeEndMillis))
    }

    fun exportCashBookCsv() {
        val sb = StringBuilder()
        sb.appendLine("Date,Category,Type,Amount,Closing Cash In Hand")
        dailyGroups.forEach { group ->
            group.items.forEach { item ->
                val signedAmt = if (item.isInflow) "+${item.amount}" else "-${item.amount}"
                sb.appendLine("\"${group.dateLabel}\",\"${translateCashCategoryLabel(item.label, isBn)}\",\"${if (item.isInflow) "In" else "Out"}\",\"$signedAmt\",\"${group.closingCashInHand}\"")
            }
        }
        com.example.ui.util.ExportHelper.shareCsv(
            context = context,
            filenamePrefix = "cash_book_report",
            title = if (isBn) "ক্যাশ বুক ($endDateLabel)" else "Cash Book ($endDateLabel)",
            csvContent = sb.toString()
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CashBookCreamBg)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .testTag("cash_book_module_list"),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // 1. Top Bar: [←] Cash book   ...   [↓ CSV]
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Surface(
                            onClick = onBackToMoreMenu,
                            shape = RoundedCornerShape(10.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, CashBookCardBorder),
                            modifier = Modifier
                                .size(40.dp)
                                .testTag("cash_book_back_button")
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "Back",
                                    tint = CashBookTextPrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Text(
                            text = if (isBn) "ক্যাশ বুক" else "Cash book",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = CashBookTextPrimary
                        )
                    }

                    Surface(
                        onClick = { exportCashBookCsv() },
                        shape = RoundedCornerShape(10.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, CashBookCardBorder),
                        modifier = Modifier
                            .height(40.dp)
                            .testTag("cash_book_export_csv_button")
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier.padding(horizontal = 14.dp)
                        ) {
                            Text(
                                text = "↓ CSV",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = CashBookTextPrimary
                            )
                        }
                    }
                }
            }

            // 2. Segmented Filter Row: Today | 7 days | This month | Pick dates
            item {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, CashBookCardBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CashBookRangeFilter.entries.forEach { filter ->
                            val isSelected = selectedRange == filter
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .weight(1f)
                                    .background(
                                        if (isSelected) CashBookActiveOrange else Color.Transparent
                                    )
                                    .clickable { selectedRange = filter }
                                    .padding(vertical = 11.dp, horizontal = 4.dp)
                                    .testTag("cash_book_filter_${filter.name.lowercase()}")
                            ) {
                                Text(
                                    text = if (isBn) filter.bnLabel else filter.label,
                                    fontSize = 13.5.sp,
                                    fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.SemiBold,
                                    color = if (isSelected) Color.White else CashBookTextPrimary,
                                    maxLines = 1
                                )
                            }
                        }
                    }
                }
            }

            // Custom Date Picker Row when "Pick dates" is active
            if (selectedRange == CashBookRangeFilter.PICK_DATES) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Surface(
                            onClick = { pickingStartDate = true },
                            shape = RoundedCornerShape(10.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, CashBookCardBorder),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                                Text(if (isBn) "শুরু" else "From", fontSize = 11.sp, color = CashBookTextSecondary)
                                Text(
                                    text = dateFormatter.format(Date(customStartMillis)),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = CashBookTextPrimary
                                )
                            }
                        }
                        Surface(
                            onClick = { pickingStartDate = false },
                            shape = RoundedCornerShape(10.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, CashBookCardBorder),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                                Text(if (isBn) "শেষ" else "To", fontSize = 11.sp, color = CashBookTextSecondary)
                                Text(
                                    text = dateFormatter.format(Date(customEndMillis)),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = CashBookTextPrimary
                                )
                            }
                        }
                    }
                }
            }

            // 3. Hero Gradient Card: Cash in hand
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(
                            Brush.linearGradient(
                                colors = listOf(CashBookHeroStart, CashBookHeroEnd)
                            )
                        )
                        .testTag("cash_book_hero_card")
                ) {
                    // Decorative translucent circle in top-right corner
                    Box(
                        modifier = Modifier
                            .size(116.dp)
                            .align(Alignment.TopEnd)
                            .offset(x = 26.dp, y = (-22).dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.14f))
                    )

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 20.dp)
                    ) {
                        Text(
                            text = if (isBn) "হাতে নগদ ক্যাশ ($endDateLabel)" else "Cash in hand ($endDateLabel)",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color.White.copy(alpha = 0.9f)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "৳ ${formatCashBookAmount(cashInHandAtEnd)}",
                            fontSize = 32.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = if (isBn) {
                                "শুরুর ক্যাশ: ৳ ${formatCashBookAmount(startingCash)}"
                            } else {
                                "Cash at start: ৳ ${formatCashBookAmount(startingCash)}"
                            },
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color.White.copy(alpha = 0.9f)
                        )
                    }
                }
            }

            // 4. Two Side-by-Side Summary Cards: Total in | Total out
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Total in
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, CashBookCardBorder),
                        modifier = Modifier
                            .weight(1f)
                            .testTag("cash_book_total_in_card")
                    ) {
                        Box(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .size(58.dp)
                                    .align(Alignment.TopEnd)
                                    .offset(x = 16.dp, y = (-16).dp)
                                    .clip(CircleShape)
                                    .background(CashBookInGreen.copy(alpha = 0.09f))
                            )
                            Column(
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp)
                            ) {
                                Text(
                                    text = "৳ ${formatCashBookAmount(periodTotalIn)}",
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = CashBookInGreen
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = if (isBn) "মোট জমা (In)" else "Total in",
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = CashBookTextSecondary
                                )
                            }
                        }
                    }

                    // Total out
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, CashBookCardBorder),
                        modifier = Modifier
                            .weight(1f)
                            .testTag("cash_book_total_out_card")
                    ) {
                        Box(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .size(58.dp)
                                    .align(Alignment.TopEnd)
                                    .offset(x = 16.dp, y = (-16).dp)
                                    .clip(CircleShape)
                                    .background(CashBookOutCoral.copy(alpha = 0.09f))
                            )
                            Column(
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp)
                            ) {
                                Text(
                                    text = "৳ ${formatCashBookAmount(periodTotalOut)}",
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = CashBookOutCoral
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = if (isBn) "মোট খরচ (Out)" else "Total out",
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = CashBookTextSecondary
                                )
                            }
                        }
                    }
                }
            }

            // 5. Daily Breakdown Cards
            if (dailyGroups.isEmpty()) {
                item {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, CashBookCardBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 36.dp, horizontal = 20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = if (isBn) "এই সময়ে কোনো নগদ লেনদেন নেই।" else "No cash transactions in this period.",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium,
                                color = CashBookTextSecondary
                            )
                        }
                    }
                }
            } else {
                items(dailyGroups, key = { it.dayKey }) { group ->
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, CashBookCardBorder),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("cash_book_day_${group.dayKey}")
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 18.dp, vertical = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            // Day Header: Date on left, closing Cash in Hand on right
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = group.dateLabel,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = CashBookTextPrimary
                                )
                                Text(
                                    text = "৳ ${formatCashBookAmount(group.closingCashInHand)}",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = CashBookTextPrimary
                                )
                            }

                            // Category rows
                            group.items.forEach { catItem ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = translateCashCategoryLabel(catItem.label, isBn),
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = CashBookTextSecondary
                                    )
                                    Text(
                                        text = "${if (catItem.isInflow) "+" else "-"}৳ ${formatCashBookAmount(catItem.amount)}",
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (catItem.isInflow) CashBookInGreen else CashBookOutCoral
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 6. Bottom Action: "✏️ Set starting cash"
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showStartingCashSheet = true }
                        .padding(vertical = 10.dp)
                        .testTag("set_starting_cash_button"),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = null,
                        tint = CashBookActiveOrange,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isBn) "শুরুর ক্যাশ সেট করুন" else "Set starting cash",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = CashBookActiveOrange,
                        textAlign = TextAlign.Center
                    )
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
                    Text(if (isBn) "ঠিক আছে" else "OK", color = CashBookTerracotta, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { pickingStartDate = null }) {
                    Text(if (isBn) "বাতিল" else "Cancel", color = CashBookTextSecondary)
                }
            }
        ) {
            DatePicker(state = pickerState)
        }
    }

    if (showStartingCashSheet) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        var amountInput by rememberSaveable {
            mutableStateOf(
                if (startingCash % 1.0 == 0.0) startingCash.toLong().toString() else startingCash.toString()
            )
        }

        ModalBottomSheet(
            onDismissRequest = { showStartingCashSheet = false },
            sheetState = sheetState,
            containerColor = Color.White,
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
            dragHandle = null
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 22.dp)
            ) {
                Text(
                    text = if (isBn) "শুরুর ক্যাশ সেট করুন" else "Set starting cash",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = CashBookTextPrimary
                )
                Spacer(modifier = Modifier.height(14.dp))
                Text(
                    text = if (isBn) "পরিমাণ (৳)" else "Amount (৳)",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = CashBookTextSecondary
                )
                Spacer(modifier = Modifier.height(6.dp))
                OutlinedTextField(
                    value = amountInput,
                    onValueChange = { amountInput = it },
                    placeholder = {
                        Text(
                            text = "0",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = CashBookTextSecondary.copy(alpha = 0.6f)
                        )
                    },
                    textStyle = TextStyle(
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = CashBookTextPrimary
                    ),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = CashBookTerracotta,
                        unfocusedBorderColor = CashBookTerracotta,
                        focusedContainerColor = CashBookCreamBg.copy(alpha = 0.45f),
                        unfocusedContainerColor = CashBookCreamBg.copy(alpha = 0.45f),
                        focusedTextColor = CashBookTextPrimary,
                        unfocusedTextColor = CashBookTextPrimary
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("starting_cash_amount_input")
                )

                Spacer(modifier = Modifier.height(20.dp))

                Button(
                    onClick = {
                        val parsed = amountInput.trim().toDoubleOrNull() ?: 0.0
                        onSetStartingCash(parsed.coerceAtLeast(0.0))
                        showStartingCashSheet = false
                    },
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CashBookActiveOrange,
                        contentColor = Color.White
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .testTag("save_starting_cash_button")
                ) {
                    Text(
                        text = if (isBn) "সংরক্ষণ করুন" else "Save",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedButton(
                    onClick = { showStartingCashSheet = false },
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, CashBookCardBorder),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = CashBookCreamBg.copy(alpha = 0.6f),
                        contentColor = CashBookTextPrimary
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    Text(
                        text = if (isBn) "বাতিল" else "Cancel",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}
