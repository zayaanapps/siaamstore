package com.example.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.Customer
import com.example.data.model.StoreTransaction
import com.example.ui.i18n.DokanTranslations
import com.example.ui.viewmodel.CustomerDueFilter
import java.text.SimpleDateFormat
import java.util.Locale

private val CreamBackground = Color(0xFFF0F9F5)
private val CardBorderColor = Color(0xFFB6EADA)
private val TerracottaPrimary = Color(0xFF00B368)
private val TerracottaGradientStart = Color(0xFF059669)
private val TerracottaGradientEnd = Color(0xFF0EA5E9)
private val PaymentGreen = Color(0xFF00A862)
private val DangerRed = Color(0xFFE11D48)
private val TextPrimary = Color(0xFF0F172A)
private val TextSecondary = Color(0xFF64748B)
private val LinkBlue = Color(0xFF0284C7)

private const val NOTE_SEPARATOR = "||NOTE:"

private fun encodeAddressAndNote(address: String, note: String): String {
    val cleanAddress = address.trim()
    val cleanNote = note.trim()
    return if (cleanNote.isBlank()) {
        cleanAddress.take(200)
    } else {
        "$cleanAddress$NOTE_SEPARATOR$cleanNote".take(200)
    }
}

private fun extractAddressOnly(encoded: String): String {
    return encoded.substringBefore(NOTE_SEPARATOR).trim()
}

private fun extractNoteOnly(encoded: String): String {
    return if (encoded.contains(NOTE_SEPARATOR)) {
        encoded.substringAfter(NOTE_SEPARATOR).trim()
    } else {
        ""
    }
}

private fun displayPhoneOrEmpty(rawPhone: String): String {
    val trimmed = rawPhone.trim()
    return if (trimmed == "—" || trimmed == "-") "" else trimmed
}

private fun formatCleanMoney(value: Double): String {
    return if (value % 1.0 == 0.0) {
        value.toLong().toString()
    } else {
        "%.2f".format(Locale.US, value)
    }
}

@Composable
fun CustomersScreen(
    customers: List<Customer>,
    transactions: List<StoreTransaction> = emptyList(),
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    selectedFilter: CustomerDueFilter,
    onFilterChange: (CustomerDueFilter) -> Unit,
    strings: DokanTranslations,
    showAddDialogInitially: Boolean = false,
    onConsumeInitialAddDialog: () -> Unit = {},
    onAddCustomer: (name: String, phone: String, address: String, initialDue: Double) -> Unit,
    onUpdateCustomer: (customer: Customer, name: String, phone: String, address: String) -> Unit = { _, _, _, _ -> },
    onDeleteCustomer: (Customer) -> Unit = {},
    onRecordDueOrPayment: (Customer, Double, Boolean, String) -> Unit,
    onDeleteTransaction: (StoreTransaction) -> Unit = {}
) {
    val isBn = strings.navSales == "বিক্রি"
    var showAddCustomerSheet by remember(showAddDialogInitially) { mutableStateOf(showAddDialogInitially) }
    var editingCustomer by remember { mutableStateOf<Customer?>(null) }
    var selectedCustomerId by rememberSaveable { mutableStateOf<String?>(null) }

    // Modal state for "+ Gave credit" (true) or "+ Got payment" (false)
    var dueOrPaymentSheetMode by remember { mutableStateOf<Pair<Customer?, Boolean>?>(null) }

    val selectedCustomer = remember(customers, selectedCustomerId) {
        selectedCustomerId?.let { id -> customers.firstOrNull { it.id == id } }
    }

    val filteredCustomers = remember(customers, searchQuery, selectedFilter) {
        customers.filter { cust ->
            val cleanPhone = displayPhoneOrEmpty(cust.phone)
            val matchesQuery = if (searchQuery.isBlank()) {
                true
            } else {
                val q = searchQuery.trim().lowercase()
                cust.name.lowercase().contains(q) || cleanPhone.lowercase().contains(q)
            }
            val matchesFilter = when (selectedFilter) {
                CustomerDueFilter.ALL -> true
                CustomerDueFilter.HAS_DUES -> cust.totalDue > 0.0
                CustomerDueFilter.NO_DUES -> cust.totalDue <= 0.0
            }
            matchesQuery && matchesFilter
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CreamBackground)
    ) {
        if (selectedCustomer != null) {
            BackHandler {
                selectedCustomerId = null
            }
            val customerTransactions = remember(transactions, selectedCustomer.id, selectedCustomer.name) {
                transactions.filter { tx ->
                    (tx.customerId.isNotBlank() && tx.customerId == selectedCustomer.id) ||
                        (tx.customerId.isBlank() && tx.customerName.equals(selectedCustomer.name, ignoreCase = true))
                }
            }
            CustomerDetailView(
                customer = selectedCustomer,
                customerTransactions = customerTransactions,
                isBn = isBn,
                onBack = { selectedCustomerId = null },
                onEditCustomer = { editingCustomer = selectedCustomer },
                onOpenGaveCredit = { dueOrPaymentSheetMode = selectedCustomer to true },
                onOpenGotPayment = { dueOrPaymentSheetMode = selectedCustomer to false },
                onDeleteCustomer = {
                    val target = selectedCustomer
                    selectedCustomerId = null
                    onDeleteCustomer(target)
                },
                onDeleteTransaction = onDeleteTransaction
            )
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // 1. Header Row: "Customers (N)" + "+ New customer"
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.Bottom) {
                            Text(
                                text = if (isBn) "কাস্টমার" else "Customers",
                                fontSize = 24.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "(${customers.size})",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium,
                                color = TextSecondary,
                                modifier = Modifier.padding(bottom = 2.dp)
                            )
                        }

                        Button(
                            onClick = { showAddCustomerSheet = true },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = TerracottaPrimary,
                                contentColor = Color.White
                            ),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
                            modifier = Modifier
                                .height(40.dp)
                                .testTag("fab_add_customer")
                        ) {
                            Text(
                                text = if (isBn) "+ নতুন কাস্টমার" else "+ New customer",
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // 2. Search Field: "Search by name or phone"
                item {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = onSearchQueryChange,
                        placeholder = {
                            Text(
                                text = if (isBn) "নাম বা ফোন নম্বর দিয়ে খুঁজুন" else "Search by name or phone",
                                color = TextSecondary,
                                fontSize = 15.sp
                            )
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = TerracottaPrimary,
                            unfocusedBorderColor = CardBorderColor,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("customer_search_input")
                    )
                }

                // 3. Segmented Filter Bar: "All" | "Owes" | "Clear"
                item {
                    CustomerFilterSegmentedBar(
                        selectedFilter = selectedFilter,
                        isBn = isBn,
                        onSelectFilter = onFilterChange
                    )
                }

                // 4. Empty state OR Customer list card + "+ Gave credit" / "+ Got payment" buttons
                if (filteredCustomers.isEmpty()) {
                    item {
                        Surface(
                            shape = RoundedCornerShape(18.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, CardBorderColor),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 4.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 42.dp, horizontal = 24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = "🛍️",
                                    fontSize = 36.sp
                                )
                                Spacer(modifier = Modifier.height(14.dp))
                                Text(
                                    text = if (isBn) "এখনো কোনো কাস্টমার নেই। প্রথম কাস্টমার যোগ করুন।" else "No customers yet. Add your first customer.",
                                    fontSize = 15.sp,
                                    color = TextSecondary,
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
                            border = BorderStroke(1.dp, CardBorderColor),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.fillMaxWidth()) {
                                filteredCustomers.forEachIndexed { index, customer ->
                                    CustomerListRow(
                                        customer = customer,
                                        onClick = { selectedCustomerId = customer.id }
                                    )
                                    if (index < filteredCustomers.lastIndex) {
                                        HorizontalDivider(
                                            color = Color(0xFFF1ECE6),
                                            thickness = 1.dp
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Bottom Action Buttons on List Screen: "+ Gave credit" | "+ Got payment"
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Button(
                                onClick = {
                                    val defaultCust = filteredCustomers.firstOrNull() ?: customers.firstOrNull()
                                    dueOrPaymentSheetMode = defaultCust to true
                                },
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = TerracottaPrimary,
                                    contentColor = Color.White
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                                    .testTag("list_gave_credit_button")
                            ) {
                                Text(
                                    text = if (isBn) "+ বাকি প্রদান" else "+ Gave credit",
                                    fontSize = 14.5.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Button(
                                onClick = {
                                    val defaultCust = filteredCustomers.firstOrNull() ?: customers.firstOrNull()
                                    dueOrPaymentSheetMode = defaultCust to false
                                },
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = PaymentGreen,
                                    contentColor = Color.White
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                                    .testTag("list_got_payment_button")
                            ) {
                                Text(
                                    text = if (isBn) "+ জমা গ্রহণ" else "+ Got payment",
                                    fontSize = 14.5.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // "+ New customer" Bottom Sheet
    if (showAddCustomerSheet) {
        CustomerFormBottomSheet(
            existingCustomer = null,
            isBn = isBn,
            onDismiss = {
                showAddCustomerSheet = false
                onConsumeInitialAddDialog()
            },
            onSave = { name, phone, encodedAddress ->
                onAddCustomer(name, phone, encodedAddress, 0.0)
                showAddCustomerSheet = false
                onConsumeInitialAddDialog()
            }
        )
    }

    // "Edit customer" Bottom Sheet
    editingCustomer?.let { custToEdit ->
        CustomerFormBottomSheet(
            existingCustomer = custToEdit,
            isBn = isBn,
            onDismiss = { editingCustomer = null },
            onSave = { name, phone, encodedAddress ->
                onUpdateCustomer(custToEdit, name, phone, encodedAddress)
                editingCustomer = null
            }
        )
    }

    // "+ Gave credit" / "+ Got payment" Bottom Sheet
    dueOrPaymentSheetMode?.let { (preselectedCustomer, isGiveDue) ->
        RecordCustomerDueOrPaymentBottomSheet(
            customers = customers,
            initialCustomer = preselectedCustomer,
            isGiveDue = isGiveDue,
            isBn = isBn,
            onDismiss = { dueOrPaymentSheetMode = null },
            onSave = { targetCustomer, amount, note ->
                onRecordDueOrPayment(targetCustomer, amount, isGiveDue, note)
                dueOrPaymentSheetMode = null
            }
        )
    }
}

@Composable
private fun CustomerFilterSegmentedBar(
    selectedFilter: CustomerDueFilter,
    isBn: Boolean,
    onSelectFilter: (CustomerDueFilter) -> Unit
) {
    val options = listOf(
        CustomerDueFilter.ALL to ((if (isBn) "সব" else "All") to "filter_customers_all"),
        CustomerDueFilter.HAS_DUES to ((if (isBn) "বাকি আছে" else "Owes") to "filter_customers_has_dues"),
        CustomerDueFilter.NO_DUES to ((if (isBn) "পরিশোধিত" else "Clear") to "filter_customers_no_dues")
    )

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Color.White,
        border = BorderStroke(1.dp, CardBorderColor),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            options.forEach { (filter, labelAndTag) ->
                val (label, tag) = labelAndTag
                val isSelected = selectedFilter == filter
                Box(
                    modifier = Modifier
                        .clip(
                            if (isSelected) RoundedCornerShape(10.dp) else RoundedCornerShape(0.dp)
                        )
                        .background(
                            if (isSelected) TerracottaPrimary else Color.Transparent
                        )
                        .clickable { onSelectFilter(filter) }
                        .padding(horizontal = 18.dp, vertical = 11.dp)
                        .testTag(tag),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = label,
                        fontSize = 14.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        color = if (isSelected) Color.White else TextPrimary
                    )
                }
            }
        }
    }
}

@Composable
private fun CustomerListRow(
    customer: Customer,
    onClick: () -> Unit
) {
    val cleanPhone = displayPhoneOrEmpty(customer.phone)
    val balanceColor = if (customer.totalDue > 0.0) TerracottaPrimary else TextSecondary

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 16.dp)
            .testTag("customer_card_${customer.id}"),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = customer.name,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (cleanPhone.isNotBlank()) {
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = cleanPhone,
                    fontSize = 13.5.sp,
                    color = TextSecondary
                )
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        Text(
            text = "৳ ${formatCleanMoney(customer.totalDue)}",
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            color = balanceColor
        )
    }
}

@Composable
private fun CustomerDetailView(
    customer: Customer,
    customerTransactions: List<StoreTransaction>,
    isBn: Boolean,
    onBack: () -> Unit,
    onEditCustomer: () -> Unit,
    onOpenGaveCredit: () -> Unit,
    onOpenGotPayment: () -> Unit,
    onDeleteCustomer: () -> Unit,
    onDeleteTransaction: (StoreTransaction) -> Unit = {}
) {
    val context = LocalContext.current
    val cleanPhone = displayPhoneOrEmpty(customer.phone)
    val cleanAddress = extractAddressOnly(customer.address)
    val cleanNote = extractNoteOnly(customer.address)
    val dateFormat = remember { SimpleDateFormat("d MMM yyyy, hh:mm a", Locale.US) }
    var transactionPendingDelete by remember { mutableStateOf<StoreTransaction?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // 1. Top Bar: [←] Customer Name  ... [✏️]
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
                    onClick = onBack,
                    shape = RoundedCornerShape(10.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, CardBorderColor),
                    modifier = Modifier
                        .size(40.dp)
                        .testTag("customer_detail_back_button")
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = if (isBn) "ফিরে যান" else "Back",
                            tint = TextPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Text(
                    text = customer.name,
                    fontSize = 23.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Surface(
                onClick = onEditCustomer,
                shape = RoundedCornerShape(10.dp),
                color = Color.White,
                border = BorderStroke(1.dp, CardBorderColor),
                modifier = Modifier
                    .size(40.dp)
                    .testTag("customer_detail_edit_button")
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = if (isBn) "কাস্টমার এডিট করুন" else "Edit Customer",
                        tint = Color(0xFFEA580C),
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }

        // 2. Phone & Address rows directly under header
        if (cleanPhone.isNotBlank() || cleanAddress.isNotBlank() || cleanNote.isNotBlank()) {
            Column(
                modifier = Modifier.padding(start = 2.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                if (cleanPhone.isNotBlank()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .clickable {
                                runCatching {
                                    val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$cleanPhone"))
                                    context.startActivity(dialIntent)
                                }
                            }
                            .padding(vertical = 2.dp)
                    ) {
                        Text(text = "📞", fontSize = 14.sp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = cleanPhone,
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = LinkBlue
                        )
                    }
                }

                if (cleanAddress.isNotBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(text = "📍", fontSize = 14.sp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = cleanAddress,
                            fontSize = 14.sp,
                            color = TextSecondary
                        )
                    }
                }

                if (cleanNote.isNotBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(text = "📝", fontSize = 14.sp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = cleanNote,
                            fontSize = 13.5.sp,
                            color = TextSecondary
                        )
                    }
                }
            }
        }

        // 3. Hero Balance Card (Terracotta gradient card with top-right decorative circle)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(
                    Brush.linearGradient(
                        colors = listOf(TerracottaGradientStart, TerracottaGradientEnd)
                    )
                )
        ) {
            // Decorative translucent circle in top-right corner
            Box(
                modifier = Modifier
                    .size(110.dp)
                    .align(Alignment.TopEnd)
                    .offset(x = 24.dp, y = (-24).dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.08f))
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 18.dp)
            ) {
                Text(
                    text = if (customer.totalDue > 0.0) {
                        if (isBn) "বাকি আছে" else "Owes"
                    } else {
                        if (isBn) "সব পরিশোধ" else "All clear"
                    },
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White.copy(alpha = 0.88f)
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "৳ ${formatCleanMoney(customer.totalDue)}",
                    fontSize = 36.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isBn) {
                            "মোট বাকি প্রদান: ৳ ${formatCleanMoney(customer.totalPurchased)}"
                        } else {
                            "Total credit given: ৳ ${formatCleanMoney(customer.totalPurchased)}"
                        },
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White.copy(alpha = 0.9f)
                    )
                    Text(
                        text = if (isBn) {
                            "মোট জমা প্রাপ্তি: ৳ ${formatCleanMoney(customer.totalPaid)}"
                        } else {
                            "Total received: ৳ ${formatCleanMoney(customer.totalPaid)}"
                        },
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White.copy(alpha = 0.9f)
                    )
                }
            }
        }

        // 4. Primary Action Row: "+ Gave credit" | "+ Got payment"
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = onOpenGaveCredit,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = TerracottaPrimary,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .weight(1f)
                    .height(50.dp)
                    .testTag("detail_gave_credit_button")
            ) {
                Text(
                    text = if (isBn) "+ বাকি প্রদান" else "+ Gave credit",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Button(
                onClick = onOpenGotPayment,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = PaymentGreen,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .weight(1f)
                    .height(50.dp)
                    .testTag("detail_got_payment_button")
            ) {
                Text(
                    text = if (isBn) "+ জমা গ্রহণ" else "+ Got payment",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // 5. Secondary Action Row: "💬 Remind" | "📄 Share statement"
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Surface(
                onClick = {
                    shareCustomerReminder(context, customer, isBn)
                },
                shape = RoundedCornerShape(14.dp),
                color = Color.White,
                border = BorderStroke(1.dp, CardBorderColor),
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp)
                    .testTag("customer_remind_button")
            ) {
                Row(
                    modifier = Modifier.fillMaxSize(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "💬", fontSize = 15.sp)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isBn) "তাগাদা পাঠান" else "Remind",
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary
                    )
                }
            }

            Surface(
                onClick = {
                    shareCustomerStatement(context, customer, customerTransactions, isBn)
                },
                shape = RoundedCornerShape(14.dp),
                color = Color.White,
                border = BorderStroke(1.dp, CardBorderColor),
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp)
                    .testTag("customer_share_statement_button")
            ) {
                Row(
                    modifier = Modifier.fillMaxSize(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "📄", fontSize = 15.sp)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isBn) "স্টেটমেন্ট শেয়ার" else "Share statement",
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary
                    )
                }
            }
        }

        // 6. Transactions Card
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = Color.White,
            border = BorderStroke(1.dp, CardBorderColor),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp)
            ) {
                Text(
                    text = if (isBn) "লেনদেনসমূহ" else "Transactions",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )

                Spacer(modifier = Modifier.height(14.dp))

                if (customerTransactions.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 14.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (isBn) "এখনো কোনো লেনদেন নেই।" else "No transactions yet.",
                            fontSize = 14.5.sp,
                            color = TextSecondary
                        )
                    }
                } else {
                    customerTransactions.forEachIndexed { idx, tx ->
                        val dateText = tx.createdAt?.toDate()?.let { dateFormat.format(it) } ?: (if (isBn) "এইমাত্র" else "Just now")
                        val isPayment = tx.type == "RECEIVE_PAYMENT"
                        val label = when (tx.type) {
                            "RECEIVE_PAYMENT" -> if (isBn) "জমা গ্রহণ" else "Got payment"
                            "GIVE_DUE" -> if (isBn) "বাকি প্রদান" else "Gave credit"
                            "SALE" -> tx.title.ifBlank { if (isBn) "বিক্রি" else "Sale" }
                            else -> tx.title
                        }
                        val cleanTxNote = tx.notes
                            .substringAfter("||NOTE:", tx.notes)
                            .takeIf { !it.startsWith("ITEMS:") }
                            ?.trim()
                            .orEmpty()

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = label,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = if (cleanTxNote.isNotBlank()) "$dateText • $cleanTxNote" else dateText,
                                    fontSize = 12.5.sp,
                                    color = TextSecondary
                                )
                            }

                            Spacer(modifier = Modifier.width(10.dp))

                            Row(
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (isPayment) {
                                        "- ৳ ${formatCleanMoney(tx.amount)}"
                                    } else {
                                        "+ ৳ ${formatCleanMoney(if (tx.dueAmount > 0.0) tx.dueAmount else tx.amount)}"
                                    },
                                    fontSize = 15.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isPayment) PaymentGreen else TerracottaPrimary
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                IconButton(
                                    onClick = { transactionPendingDelete = tx },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.DeleteOutline,
                                        contentDescription = if (isBn) "এন্ট্রি মুছুন" else "Delete entry",
                                        tint = DangerRed.copy(alpha = 0.8f),
                                        modifier = Modifier.size(19.dp)
                                    )
                                }
                            }
                        }

                        if (idx < customerTransactions.lastIndex) {
                            HorizontalDivider(color = Color(0xFFF1ECE6))
                        }
                    }
                }
            }
        }

        // 7. Bottom "🗑️ Delete customer" button
        OutlinedButton(
            onClick = onDeleteCustomer,
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, DangerRed.copy(alpha = 0.35f)),
            colors = ButtonDefaults.outlinedButtonColors(
                containerColor = Color.White,
                contentColor = DangerRed
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
                .testTag("delete_customer_button")
        ) {
            Text(
                text = if (isBn) "🗑️ কাস্টমার মুছুন" else "🗑️ Delete customer",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = DangerRed
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
    }

    transactionPendingDelete?.let { pendingTx ->
        val isPayment = pendingTx.type == "RECEIVE_PAYMENT"
        val isDue = pendingTx.type == "GIVE_DUE"
        val txAmt = if (isPayment) pendingTx.amount else (if (pendingTx.dueAmount > 0.0) pendingTx.dueAmount else pendingTx.amount)

        AlertDialog(
            onDismissRequest = { transactionPendingDelete = null },
            icon = {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = DangerRed,
                    modifier = Modifier.size(36.dp)
                )
            },
            title = {
                Text(
                    text = if (isBn) {
                        if (isPayment) "জমা এন্ট্রি মুছে ফেলবেন?" else if (isDue) "বাকি এন্ট্রি মুছে ফেলবেন?" else "লেনদেনটি মুছে ফেলবেন?"
                    } else {
                        if (isPayment) "Delete payment entry?" else if (isDue) "Delete credit entry?" else "Delete transaction?"
                    },
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = if (isBn) {
                            if (isPayment) {
                                "সতর্কতা: '${customer.name}'-এর দেওয়া জমা (৳ ${formatCleanMoney(txAmt)}) মুছে ফেললে তার মোট বাকি ৳ ${formatCleanMoney(txAmt)} বৃদ্ধি পাবে।"
                            } else if (isDue) {
                                "সতর্কতা: '${customer.name}'-কে দেওয়া বাকি (৳ ${formatCleanMoney(txAmt)}) মুছে ফেললে তার মোট বাকি ৳ ${formatCleanMoney(txAmt)} হ্রাস পাবে।"
                            } else {
                                "সতর্কতা: '${pendingTx.title}' লেনদেনটি মুছে ফেলা হবে এবং সংশ্লিষ্ট হিসাব সমন্বয় করা হবে।"
                            }
                        } else {
                            if (isPayment) {
                                "Warning: Deleting payment (৳ ${formatCleanMoney(txAmt)}) from '${customer.name}' will increase their due balance by ৳ ${formatCleanMoney(txAmt)}."
                            } else if (isDue) {
                                "Warning: Deleting credit given (৳ ${formatCleanMoney(txAmt)}) to '${customer.name}' will reduce their due balance by ৳ ${formatCleanMoney(txAmt)}."
                            } else {
                                "Warning: Transaction '${pendingTx.title}' will be deleted and related balances adjusted."
                            }
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextPrimary
                    )
                    Text(
                        text = if (isBn) {
                            "রেকর্ডটি মুছে রিসাইকেল বিনে চলে যাবে এবং অডিট লগে এন্ট্রি থাকবে। আপনি কি নিশ্চিত?"
                        } else {
                            "This record will move to the Recycle Bin and be logged in the Audit Log. Are you sure?"
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val toDelete = pendingTx
                        transactionPendingDelete = null
                        onDeleteTransaction(toDelete)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = DangerRed)
                ) {
                    Text(if (isBn) "হ্যাঁ, মুছে ফেলুন" else "Yes, delete")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { transactionPendingDelete = null }) {
                    Text(if (isBn) "বাতিল" else "Cancel")
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CustomerFormBottomSheet(
    existingCustomer: Customer?,
    isBn: Boolean,
    onDismiss: () -> Unit,
    onSave: (name: String, phone: String, encodedAddress: String) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var name by remember(existingCustomer) { mutableStateOf(existingCustomer?.name ?: "") }
    var phone by remember(existingCustomer) {
        mutableStateOf(existingCustomer?.phone?.let { displayPhoneOrEmpty(it) } ?: "")
    }
    var address by remember(existingCustomer) {
        mutableStateOf(existingCustomer?.address?.let { extractAddressOnly(it) } ?: "")
    }
    var note by remember(existingCustomer) {
        mutableStateOf(existingCustomer?.address?.let { extractNoteOnly(it) } ?: "")
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color.White,
        dragHandle = null,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 22.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = if (existingCustomer == null) {
                    if (isBn) "+ নতুন কাস্টমার" else "+ New customer"
                } else {
                    if (isBn) "কাস্টমার এডিট করুন" else "Edit customer"
                },
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                color = TextPrimary
            )

            // 1. Customer name
            CustomerSheetField(
                label = if (isBn) "কাস্টমারের নাম" else "Customer name",
                value = name,
                onValueChange = { name = it },
                placeholder = "",
                isHighlighted = true,
                testTag = "add_customer_name_input"
            )

            // 2. Phone number (optional)
            CustomerSheetField(
                label = if (isBn) "ফোন নম্বর (ঐচ্ছিক)" else "Phone number (optional)",
                value = phone,
                onValueChange = { phone = it },
                placeholder = "",
                keyboardType = KeyboardType.Phone,
                testTag = "add_customer_phone_input"
            )

            // 3. Address (optional)
            CustomerSheetField(
                label = if (isBn) "ঠিকানা (ঐচ্ছিক)" else "Address (optional)",
                value = address,
                onValueChange = { address = it },
                placeholder = "",
                testTag = "add_customer_address_input"
            )

            // 4. Note (optional)
            CustomerSheetField(
                label = if (isBn) "নোট (ঐচ্ছিক)" else "Note (optional)",
                value = note,
                onValueChange = { note = it },
                placeholder = "",
                testTag = "add_customer_note_input"
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Save Button
            Button(
                onClick = {
                    val trimmedName = name.trim()
                    if (trimmedName.isNotEmpty()) {
                        val encodedAddr = encodeAddressAndNote(address, note)
                        onSave(trimmedName, phone.trim(), encodedAddr)
                    }
                },
                enabled = name.trim().isNotEmpty(),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = TerracottaPrimary,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .testTag("confirm_save_customer_button")
            ) {
                Text(
                    text = if (isBn) "সংরক্ষণ করুন" else "Save",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // Cancel Button
            OutlinedButton(
                onClick = onDismiss,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, CardBorderColor),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = Color.White,
                    contentColor = TextPrimary
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

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun RecordCustomerDueOrPaymentBottomSheet(
    customers: List<Customer>,
    initialCustomer: Customer?,
    isGiveDue: Boolean,
    isBn: Boolean,
    onDismiss: () -> Unit,
    onSave: (customer: Customer, amount: Double, note: String) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedCustomer by remember(initialCustomer, customers) {
        mutableStateOf(initialCustomer ?: customers.firstOrNull())
    }
    var amountText by remember { mutableStateOf("") }
    var noteText by remember { mutableStateOf("") }

    val accentColor = if (isGiveDue) TerracottaPrimary else PaymentGreen

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color.White,
        dragHandle = null,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 22.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = if (isGiveDue) {
                    if (isBn) "+ বাকি প্রদান" else "+ Gave credit"
                } else {
                    if (isBn) "+ জমা গ্রহণ" else "+ Got payment"
                },
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                color = TextPrimary
            )

            if (customers.size > 1 && initialCustomer == null) {
                Text(
                    text = if (isBn) "কাস্টমার" else "Customer",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextSecondary
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    customers.forEach { cust ->
                        val isSelected = selectedCustomer?.id == cust.id
                        FilterChip(
                            selected = isSelected,
                            onClick = { selectedCustomer = cust },
                            label = {
                                Text(
                                    text = "${cust.name} (৳ ${formatCleanMoney(cust.totalDue)})",
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                )
                            },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = accentColor.copy(alpha = 0.14f),
                                selectedLabelColor = accentColor
                            )
                        )
                    }
                }
            } else if (selectedCustomer != null) {
                Text(
                    text = if (isBn) {
                        "${selectedCustomer?.name} • বর্তমান বাকি: ৳ ${formatCleanMoney(selectedCustomer?.totalDue ?: 0.0)}"
                    } else {
                        "${selectedCustomer?.name} • Current balance: ৳ ${formatCleanMoney(selectedCustomer?.totalDue ?: 0.0)}"
                    },
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = TextSecondary
                )
            }

            CustomerSheetField(
                label = if (isBn) "পরিমাণ (৳)" else "Amount (৳)",
                value = amountText,
                onValueChange = { amountText = it },
                placeholder = "0",
                keyboardType = KeyboardType.Decimal,
                isHighlighted = true,
                testTag = "due_payment_amount_input"
            )

            CustomerSheetField(
                label = if (isBn) "নোট (ঐচ্ছিক)" else "Note (optional)",
                value = noteText,
                onValueChange = { noteText = it },
                placeholder = if (isGiveDue) {
                    if (isBn) "পণ্য বা বাকির কারণ..." else "Items or credit reason..."
                } else {
                    if (isBn) "নগদ / বিকাশ / নগদ পেমেন্ট..." else "Cash / bKash / Nagad..."
                },
                testTag = "due_payment_note_input"
            )

            Spacer(modifier = Modifier.height(4.dp))

            Button(
                onClick = {
                    val cust = selectedCustomer
                    val amt = amountText.toDoubleOrNull() ?: 0.0
                    if (cust != null && amt > 0.0) {
                        onSave(cust, amt, noteText.trim())
                    }
                },
                enabled = selectedCustomer != null && (amountText.toDoubleOrNull() ?: 0.0) > 0.0,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = accentColor,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .testTag("confirm_due_payment_button")
            ) {
                Text(
                    text = if (isBn) "সংরক্ষণ করুন" else "Save",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            OutlinedButton(
                onClick = onDismiss,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, CardBorderColor),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = Color.White,
                    contentColor = TextPrimary
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

@Composable
private fun CustomerSheetField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    isHighlighted: Boolean = false,
    testTag: String = ""
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Medium,
            color = if (isHighlighted) TerracottaPrimary else TextSecondary
        )
        Spacer(modifier = Modifier.height(6.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = if (placeholder.isNotEmpty()) {
                { Text(text = placeholder, color = TextSecondary, fontSize = 14.5.sp) }
            } else {
                null
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color.White,
                unfocusedContainerColor = Color(0xFFFAF7F2),
                focusedBorderColor = TerracottaPrimary,
                unfocusedBorderColor = if (isHighlighted) TerracottaPrimary else CardBorderColor,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary
            ),
            modifier = Modifier
                .fillMaxWidth()
                .then(if (testTag.isNotEmpty()) Modifier.testTag(testTag) else Modifier)
        )
    }
}

private fun shareCustomerReminder(context: Context, customer: Customer, isBn: Boolean) {
    val dueStr = formatCleanMoney(customer.totalDue)
    val message = if (isBn) {
        if (customer.totalDue > 0.0) {
            "আসসালামু আলাইকুম ${customer.name}, সিয়াম স্টোর থেকে বিনীত অনুরোধ—আপনার বর্তমান বকেয়া হিসাব ৳ $dueStr। ধন্যবাদ!"
        } else {
            "আসসালামু আলাইকুম ${customer.name}, সিয়াম স্টোরে আপনার কোনো বকেয়া নেই (৳ ০)। আমাদের সাথে কেনাকাটার জন্য ধন্যবাদ!"
        }
    } else {
        if (customer.totalDue > 0.0) {
            "Assalamu Alaikum ${customer.name}, a gentle reminder from Siaam Store that your current due balance is ৳ $dueStr. Thank you!"
        } else {
            "Assalamu Alaikum ${customer.name}, your account balance with Siaam Store is all clear (৳ 0). Thank you for shopping with us!"
        }
    }
    val chooserTitle = if (isBn) "তাগাদা পাঠান" else "Send Reminder"
    val cleanPhone = displayPhoneOrEmpty(customer.phone)
    runCatching {
        if (cleanPhone.isNotBlank()) {
            val smsIntent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$cleanPhone")).apply {
                putExtra("sms_body", message)
            }
            context.startActivity(smsIntent)
        } else {
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, message)
            }
            context.startActivity(Intent.createChooser(shareIntent, chooserTitle))
        }
    }.onFailure {
        runCatching {
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, message)
            }
            context.startActivity(Intent.createChooser(shareIntent, chooserTitle))
        }
    }
}

private fun shareCustomerStatement(
    context: Context,
    customer: Customer,
    transactions: List<StoreTransaction>,
    isBn: Boolean
) {
    val dateFormat = SimpleDateFormat("d MMM yyyy", Locale.US)
    val cleanPhone = displayPhoneOrEmpty(customer.phone)
    val cleanAddress = extractAddressOnly(customer.address)

    val statementText = buildString {
        if (isBn) {
            appendLine("📄 কাস্টমার হিসাব বিবরণী — সিয়াম স্টোর")
            appendLine("কাস্টমার: ${customer.name}")
            if (cleanPhone.isNotBlank()) appendLine("ফোন: $cleanPhone")
            if (cleanAddress.isNotBlank()) appendLine("ঠিকানা: $cleanAddress")
            appendLine("--------------------------------")
            appendLine("বর্তমান বকেয়া: ৳ ${formatCleanMoney(customer.totalDue)}")
            appendLine("মোট বাকি প্রদান: ৳ ${formatCleanMoney(customer.totalPurchased)}")
            appendLine("মোট জমা প্রাপ্তি: ৳ ${formatCleanMoney(customer.totalPaid)}")
            appendLine("--------------------------------")
            if (transactions.isEmpty()) {
                appendLine("লেনদেন: এখনো কোনো লেনদেন নেই।")
            } else {
                appendLine("সাম্প্রতিক লেনদেন (${transactions.size}):")
                transactions.take(20).forEach { tx ->
                    val dateStr = tx.createdAt?.toDate()?.let { dateFormat.format(it) } ?: "আজ"
                    val typeStr = when (tx.type) {
                        "RECEIVE_PAYMENT" -> "জমা গ্রহণ"
                        "GIVE_DUE" -> "বাকি প্রদান"
                        else -> tx.title.ifBlank { "বিক্রি" }
                    }
                    appendLine("• $dateStr: $typeStr — ৳ ${formatCleanMoney(tx.amount)}")
                }
            }
        } else {
            appendLine("📄 CUSTOMER STATEMENT — SIAAM STORE")
            appendLine("Customer: ${customer.name}")
            if (cleanPhone.isNotBlank()) appendLine("Phone: $cleanPhone")
            if (cleanAddress.isNotBlank()) appendLine("Address: $cleanAddress")
            appendLine("--------------------------------")
            appendLine("Current Balance Due: ৳ ${formatCleanMoney(customer.totalDue)}")
            appendLine("Total Credit Given: ৳ ${formatCleanMoney(customer.totalPurchased)}")
            appendLine("Total Received: ৳ ${formatCleanMoney(customer.totalPaid)}")
            appendLine("--------------------------------")
            if (transactions.isEmpty()) {
                appendLine("Transactions: No transactions yet.")
            } else {
                appendLine("Recent Transactions (${transactions.size}):")
                transactions.take(20).forEach { tx ->
                    val dateStr = tx.createdAt?.toDate()?.let { dateFormat.format(it) } ?: "Today"
                    val typeStr = when (tx.type) {
                        "RECEIVE_PAYMENT" -> "Got payment"
                        "GIVE_DUE" -> "Gave credit"
                        else -> tx.title.ifBlank { "Sale" }
                    }
                    appendLine("• $dateStr: $typeStr — ৳ ${formatCleanMoney(tx.amount)}")
                }
            }
        }
    }

    runCatching {
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, if (isBn) "হিসাব বিবরণী - ${customer.name}" else "Statement - ${customer.name}")
            putExtra(Intent.EXTRA_TEXT, statementText)
        }
        context.startActivity(Intent.createChooser(shareIntent, if (isBn) "স্টেটমেন্ট শেয়ার করুন" else "Share Customer Statement"))
    }
}
