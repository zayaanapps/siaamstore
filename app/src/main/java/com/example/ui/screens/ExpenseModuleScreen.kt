package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.StoreTransaction
import com.example.ui.i18n.AppLanguage
import com.example.ui.theme.AppThemeMode
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

private val ExpenseCreamBg = Color(0xFFF0F9F5)
private val ExpenseCardBorder = Color(0xFFB6EADA)
private val ExpenseTerracotta = Color(0xFF00B368)
private val ExpenseTextPrimary = Color(0xFF0F172A)
private val ExpenseTextSecondary = Color(0xFF64748B)
private val ExpenseDangerRed = Color(0xFFE11D48)

private val EXPENSE_WHAT_FOR_PRESETS_EN = listOf(
    "Shop rent",
    "Electricity",
    "Salary",
    "Transport",
    "Snacks/tea",
    "Repair",
    "Other"
)

private val EXPENSE_WHAT_FOR_PRESETS_BN = listOf(
    "দোকান ভাড়া",
    "বিদ্যুৎ বিল",
    "কর্মচারীর বেতন",
    "পরিবহন খরচ",
    "চা / নাস্তা",
    "মেরামত",
    "অন্যান্য"
)

private const val EXPENSE_DATE_PREFIX = "DATE:"
private const val EXPENSE_NOTE_SEP = "||NOTE:"

private fun encodeExpenseDateAndNote(dateMillis: Long, optionalNote: String): String {
    val cleanNote = optionalNote.trim()
    return if (cleanNote.isBlank()) {
        "$EXPENSE_DATE_PREFIX$dateMillis"
    } else {
        "$EXPENSE_DATE_PREFIX$dateMillis$EXPENSE_NOTE_SEP$cleanNote".take(300)
    }
}

private fun extractExpenseEffectiveMillis(tx: StoreTransaction): Long {
    val rawNotes = tx.notes.trim()
    if (rawNotes.startsWith(EXPENSE_DATE_PREFIX)) {
        val millisPart = rawNotes
            .removePrefix(EXPENSE_DATE_PREFIX)
            .substringBefore(EXPENSE_NOTE_SEP)
            .trim()
        millisPart.toLongOrNull()?.let { return it }
    }
    return tx.createdAt?.toDate()?.time ?: System.currentTimeMillis()
}

private fun extractExpenseUserNote(tx: StoreTransaction): String {
    val rawNotes = tx.notes.trim()
    return when {
        rawNotes.startsWith(EXPENSE_DATE_PREFIX) -> {
            if (rawNotes.contains(EXPENSE_NOTE_SEP)) {
                rawNotes.substringAfter(EXPENSE_NOTE_SEP).trim()
            } else {
                ""
            }
        }
        rawNotes == "Operating expense" -> ""
        else -> rawNotes
    }
}

private fun formatExpenseAmount(value: Double): String {
    return if (value % 1.0 == 0.0) {
        "%,d".format(Locale.US, value.toLong())
    } else {
        "%,.2f".format(Locale.US, value)
    }
}

@Composable
fun ExpenseModuleScreen(
    transactions: List<StoreTransaction>,
    language: AppLanguage = AppLanguage.ENGLISH,
    themeMode: AppThemeMode = AppThemeMode.LIGHT,
    onBackToMoreMenu: () -> Unit,
    onRecordExpense: (title: String, category: String, amount: Double, notes: String) -> Unit,
    onDeleteExpense: (StoreTransaction) -> Unit = {}
) {
    val isBn = language == AppLanguage.BENGALI
    val isDark = themeMode == AppThemeMode.DARK || (themeMode == AppThemeMode.SYSTEM && isSystemInDarkTheme())
    val bgColor = if (isDark) Color(0xFF0F172A) else ExpenseCreamBg
    val cardBg = if (isDark) Color(0xFF1E293B) else Color.White
    val cardBorder = if (isDark) Color(0xFF334155) else ExpenseCardBorder
    val textPrimary = if (isDark) Color(0xFFF8FAFC) else ExpenseTextPrimary
    val textSecondary = if (isDark) Color(0xFF94A3B8) else ExpenseTextSecondary

    val initialCal = remember { Calendar.getInstance() }
    var selectedYear by rememberSaveable { mutableIntStateOf(initialCal.get(Calendar.YEAR)) }
    var selectedMonth by rememberSaveable { mutableIntStateOf(initialCal.get(Calendar.MONTH)) }
    var showAddExpenseSheet by rememberSaveable { mutableStateOf(false) }
    var expensePendingDelete by remember { mutableStateOf<StoreTransaction?>(null) }

    BackHandler {
        onBackToMoreMenu()
    }

    val monthLabel = remember(selectedYear, selectedMonth) {
        val cal = Calendar.getInstance().apply {
            set(Calendar.YEAR, selectedYear)
            set(Calendar.MONTH, selectedMonth)
            set(Calendar.DAY_OF_MONTH, 1)
        }
        SimpleDateFormat("MMMM yyyy", Locale.US).format(cal.time)
    }

    val expenseTransactions = remember(transactions) {
        transactions.filter { it.type == "EXPENSE" }
    }

    val monthlyExpenses = remember(expenseTransactions, selectedYear, selectedMonth) {
        expenseTransactions.filter { tx ->
            val millis = extractExpenseEffectiveMillis(tx)
            val cal = Calendar.getInstance().apply { timeInMillis = millis }
            cal.get(Calendar.YEAR) == selectedYear && cal.get(Calendar.MONTH) == selectedMonth
        }.sortedByDescending { extractExpenseEffectiveMillis(it) }
    }

    val monthlyTotal = remember(monthlyExpenses) {
        monthlyExpenses.sumOf { it.amount }
    }

    fun stepMonth(delta: Int) {
        val cal = Calendar.getInstance().apply {
            set(Calendar.YEAR, selectedYear)
            set(Calendar.MONTH, selectedMonth)
            set(Calendar.DAY_OF_MONTH, 1)
            add(Calendar.MONTH, delta)
        }
        selectedYear = cal.get(Calendar.YEAR)
        selectedMonth = cal.get(Calendar.MONTH)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgColor)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .testTag("expenses_module_list"),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // 1. Top Bar: [←] Expenses  ...  [+ Add expense]
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
                            color = cardBg,
                            border = BorderStroke(1.dp, cardBorder),
                            modifier = Modifier
                                .size(40.dp)
                                .testTag("expenses_back_button")
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "Back",
                                    tint = textPrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Text(
                            text = if (isBn) "দোকানের খরচ" else "Expenses",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = textPrimary
                        )
                    }

                    Button(
                        onClick = { showAddExpenseSheet = true },
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = ExpenseTerracotta,
                            contentColor = Color.White
                        ),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
                        modifier = Modifier
                            .height(40.dp)
                            .testTag("add_expense_button")
                    ) {
                        Text(
                            text = if (isBn) "+ খরচ লিখুন" else "+ Add expense",
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // 2. Month Selector Row: [‹]   November 2026   [›]
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        onClick = { stepMonth(-1) },
                        shape = RoundedCornerShape(10.dp),
                        color = cardBg,
                        border = BorderStroke(1.dp, cardBorder),
                        modifier = Modifier
                            .size(36.dp)
                            .testTag("expense_prev_month_button")
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = "‹",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = textPrimary
                            )
                        }
                    }

                    Text(
                        text = monthLabel,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = textPrimary,
                        modifier = Modifier.testTag("expense_month_label")
                    )

                    Surface(
                        onClick = { stepMonth(1) },
                        shape = RoundedCornerShape(10.dp),
                        color = cardBg,
                        border = BorderStroke(1.dp, cardBorder),
                        modifier = Modifier
                            .size(36.dp)
                            .testTag("expense_next_month_button")
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = "›",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = textPrimary
                            )
                        }
                    }
                }
            }

            // 3. Monthly Summary Card with decorative top-right circle
            item {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = cardBg,
                    border = BorderStroke(1.dp, cardBorder),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("expense_monthly_summary_card")
                ) {
                    Box(modifier = Modifier.fillMaxWidth()) {
                        Box(
                            modifier = Modifier
                                .size(76.dp)
                                .align(Alignment.TopEnd)
                                .offset(x = 20.dp, y = (-20).dp)
                                .clip(CircleShape)
                                .background(ExpenseTerracotta.copy(alpha = 0.08f))
                        )

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 18.dp, vertical = 18.dp)
                        ) {
                            Text(
                                text = "৳ ${formatExpenseAmount(monthlyTotal)}",
                                fontSize = 28.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = ExpenseTerracotta
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = if (isBn) "এই মাসের মোট খরচ" else "This month's expenses",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                color = textSecondary
                            )
                        }
                    }
                }
            }

            // 4. Empty State Card OR Monthly Expense List Card
            if (monthlyExpenses.isEmpty()) {
                item {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = cardBg,
                        border = BorderStroke(1.dp, cardBorder),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("expenses_empty_state_card")
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 44.dp, horizontal = 24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "🛍️",
                                fontSize = 44.sp
                            )
                            Spacer(modifier = Modifier.height(14.dp))
                            Text(
                                text = if (isBn) "এই মাসে কোনো খরচ লেখা হয়নি।" else "No expenses this month.",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium,
                                color = textSecondary
                            )
                        }
                    }
                }
            } else {
                item {
                    val dateFormat = remember { SimpleDateFormat("dd/MM/yyyy", Locale.US) }
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = cardBg,
                        border = BorderStroke(1.dp, cardBorder),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("expenses_list_card")
                    ) {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            monthlyExpenses.forEachIndexed { index, tx ->
                                val effectiveMillis = extractExpenseEffectiveMillis(tx)
                                val formattedDate = dateFormat.format(Date(effectiveMillis))
                                val userNote = extractExpenseUserNote(tx)
                                val displayTitle = tx.title.ifBlank { tx.category.ifBlank { if (isBn) "খরচ" else "Expense" } }

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp, vertical = 14.dp)
                                        .testTag("expense_item_${tx.id}"),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .weight(1f)
                                            .padding(end = 12.dp)
                                    ) {
                                        Text(
                                            text = displayTitle,
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = textPrimary,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Spacer(modifier = Modifier.height(3.dp))
                                        Text(
                                            text = if (userNote.isNotBlank()) {
                                                "$formattedDate • $userNote"
                                            } else {
                                                formattedDate
                                            },
                                            fontSize = 13.sp,
                                            color = textSecondary,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }

                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = "৳ ${formatExpenseAmount(tx.amount)}",
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = ExpenseTerracotta
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        IconButton(
                                            onClick = { expensePendingDelete = tx },
                                            modifier = Modifier
                                                .size(36.dp)
                                                .testTag("delete_expense_${tx.id}")
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.DeleteOutline,
                                                contentDescription = "Delete expense",
                                                tint = ExpenseDangerRed,
                                                modifier = Modifier.size(18.dp)
                                            )
                                        }
                                    }
                                }

                                if (index < monthlyExpenses.lastIndex) {
                                    HorizontalDivider(color = cardBorder)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Warning confirmation dialog before deleting an expense
    expensePendingDelete?.let { tx ->
        AlertDialog(
            onDismissRequest = { expensePendingDelete = null },
            icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = ExpenseDangerRed) },
            title = {
                Text(
                    text = if (isBn) "সতর্কতা: খরচ ডিলিট" else "Warning: Delete Expense",
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    text = if (isBn) {
                        "আপনি কি নিশ্চিত যে '${tx.title.ifBlank { "এই খরচ" }}' (৳${formatExpenseAmount(tx.amount)}) মুছে ফেলতে চান? এটি স্টোর খাতা থেকে বাদ দেওয়া হবে।"
                    } else {
                        "Are you sure you want to delete this expense of ৳${formatExpenseAmount(tx.amount)}?"
                    }
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val target = tx
                        expensePendingDelete = null
                        onDeleteExpense(target)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ExpenseDangerRed)
                ) {
                    Text(if (isBn) "হ্যাঁ, ডিলিট করুন" else "Yes, Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { expensePendingDelete = null }) {
                    Text(if (isBn) "বাতিল" else "Cancel")
                }
            }
        )
    }

    if (showAddExpenseSheet) {
        AddExpenseBottomSheet(
            isBn = isBn,
            onDismiss = { showAddExpenseSheet = false },
            onSave = { whatFor, amount, forWhatNote, selectedDateMillis ->
                val encodedNotes = encodeExpenseDateAndNote(selectedDateMillis, forWhatNote)
                onRecordExpense(whatFor, whatFor, amount, encodedNotes)
                val savedCal = Calendar.getInstance().apply { timeInMillis = selectedDateMillis }
                selectedYear = savedCal.get(Calendar.YEAR)
                selectedMonth = savedCal.get(Calendar.MONTH)
                showAddExpenseSheet = false
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun AddExpenseBottomSheet(
    isBn: Boolean = false,
    onDismiss: () -> Unit,
    onSave: (whatFor: String, amount: Double, forWhatNote: String, dateMillis: Long) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var amountInput by rememberSaveable { mutableStateOf("") }
    var selectedPreset by rememberSaveable { mutableStateOf("") }
    var customWhatFor by rememberSaveable { mutableStateOf("") }
    var forWhatOptional by rememberSaveable { mutableStateOf("") }
    var selectedDateMillis by rememberSaveable { mutableLongStateOf(System.currentTimeMillis()) }
    var showDatePicker by remember { mutableStateOf(false) }
    var validationError by remember { mutableStateOf<String?>(null) }

    val formattedDate = remember(selectedDateMillis) {
        SimpleDateFormat("dd/MM/yyyy", Locale.US).format(Date(selectedDateMillis))
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color.White,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        dragHandle = null
    ) {
        val presets = if (isBn) EXPENSE_WHAT_FOR_PRESETS_BN else EXPENSE_WHAT_FOR_PRESETS_EN

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 22.dp)
        ) {
            Text(
                text = if (isBn) "+ খরচ লিখুন" else "+ Add expense",
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                color = ExpenseTextPrimary
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Amount (৳)
            Text(
                text = if (isBn) "টাকার পরিমাণ (৳) *" else "Amount (৳)",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = ExpenseTextSecondary
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = amountInput,
                onValueChange = {
                    amountInput = it
                    validationError = null
                },
                placeholder = {
                    Text(
                        text = "0",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = ExpenseTextSecondary.copy(alpha = 0.6f)
                    )
                },
                textStyle = TextStyle(
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = ExpenseTextPrimary
                ),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = ExpenseTerracotta,
                    unfocusedBorderColor = ExpenseTerracotta,
                    focusedContainerColor = ExpenseCreamBg.copy(alpha = 0.45f),
                    unfocusedContainerColor = ExpenseCreamBg.copy(alpha = 0.45f),
                    focusedTextColor = ExpenseTextPrimary,
                    unfocusedTextColor = ExpenseTextPrimary,
                    cursorColor = ExpenseTerracotta
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("expense_amount_input")
            )

            Spacer(modifier = Modifier.height(14.dp))

            // What for
            Text(
                text = if (isBn) "কী বাবদ খরচ? *" else "What for",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = ExpenseTextSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))

            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                presets.forEach { preset ->
                    val isSelected = selectedPreset == preset && customWhatFor.isBlank()
                    Surface(
                        onClick = {
                            selectedPreset = preset
                            customWhatFor = ""
                            validationError = null
                        },
                        shape = RoundedCornerShape(50),
                        color = if (isSelected) ExpenseTerracotta.copy(alpha = 0.12f) else ExpenseCreamBg.copy(alpha = 0.6f),
                        border = BorderStroke(
                            width = 1.dp,
                            color = if (isSelected) ExpenseTerracotta else ExpenseCardBorder
                        ),
                        modifier = Modifier.testTag("expense_preset_${preset.lowercase().replace('/', '_').replace(' ', '_')}")
                    ) {
                        Text(
                            text = preset,
                            fontSize = 14.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                            color = if (isSelected) ExpenseTerracotta else ExpenseTextPrimary,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 9.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedTextField(
                value = customWhatFor,
                onValueChange = {
                    customWhatFor = it
                    if (it.isNotBlank()) {
                        selectedPreset = ""
                    }
                    validationError = null
                },
                placeholder = {
                    Text(
                        text = if (isBn) "অথবা নিজের মতো লিখুন" else "or type your own",
                        color = ExpenseTextSecondary.copy(alpha = 0.7f),
                        fontSize = 15.sp
                    )
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = ExpenseTerracotta,
                    unfocusedBorderColor = ExpenseCardBorder,
                    focusedContainerColor = ExpenseCreamBg.copy(alpha = 0.55f),
                    unfocusedContainerColor = ExpenseCreamBg.copy(alpha = 0.55f),
                    focusedTextColor = ExpenseTextPrimary,
                    unfocusedTextColor = ExpenseTextPrimary
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("expense_custom_what_for_input")
            )

            Spacer(modifier = Modifier.height(14.dp))

            // For what (optional)
            Text(
                text = if (isBn) "অতিরিক্ত বিবরণ / নোট (ঐচ্ছিক)" else "For what (optional)",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = ExpenseTextSecondary
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = forWhatOptional,
                onValueChange = { forWhatOptional = it },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = ExpenseTerracotta,
                    unfocusedBorderColor = ExpenseCardBorder,
                    focusedContainerColor = ExpenseCreamBg.copy(alpha = 0.55f),
                    unfocusedContainerColor = ExpenseCreamBg.copy(alpha = 0.55f),
                    focusedTextColor = ExpenseTextPrimary,
                    unfocusedTextColor = ExpenseTextPrimary
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("expense_for_what_note_input")
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Date
            Text(
                text = if (isBn) "তারিখ" else "Date",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = ExpenseTextSecondary
            )
            Spacer(modifier = Modifier.height(6.dp))
            Surface(
                onClick = { showDatePicker = true },
                shape = RoundedCornerShape(12.dp),
                color = ExpenseCreamBg.copy(alpha = 0.55f),
                border = BorderStroke(1.dp, ExpenseCardBorder),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .testTag("expense_date_picker_button")
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = formattedDate,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = ExpenseTextPrimary
                    )
                    Icon(
                        imageVector = Icons.Default.KeyboardArrowDown,
                        contentDescription = "Select date",
                        tint = ExpenseTextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            if (validationError != null) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = validationError!!,
                    color = ExpenseDangerRed,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Save Button
            Button(
                onClick = {
                    val amount = amountInput.trim().toDoubleOrNull() ?: 0.0
                    val resolvedWhatFor = customWhatFor.trim().ifBlank { selectedPreset.trim() }
                    when {
                        amount <= 0.0 -> {
                            validationError = if (isBn) "অনুগ্রহ করে ০ টাকার বেশি পরিমাণ লিখুন।" else "Please enter an expense amount greater than 0."
                        }
                        resolvedWhatFor.isBlank() -> {
                            validationError = if (isBn) "খরচের খাত নির্বাচন করুন বা লিখুন।" else "Please choose 'What for' or type your own."
                        }
                        else -> {
                            onSave(resolvedWhatFor, amount, forWhatOptional.trim(), selectedDateMillis)
                        }
                    }
                },
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = ExpenseTerracotta,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .testTag("save_expense_button")
            ) {
                Text(
                    text = if (isBn) "সংরক্ষণ করুন" else "Save",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Cancel Button
            OutlinedButton(
                onClick = onDismiss,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, ExpenseCardBorder),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = ExpenseCreamBg.copy(alpha = 0.6f),
                    contentColor = ExpenseTextPrimary
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .testTag("cancel_expense_button")
            ) {
                Text(
                    text = if (isBn) "বাতিল" else "Cancel",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = selectedDateMillis
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        datePickerState.selectedDateMillis?.let { millis ->
                            selectedDateMillis = millis
                        }
                        showDatePicker = false
                    }
                ) {
                    Text("OK", color = ExpenseTerracotta, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) {
                    Text("Cancel", color = ExpenseTextSecondary)
                }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }
}
