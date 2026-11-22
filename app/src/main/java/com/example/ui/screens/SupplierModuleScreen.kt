package com.example.ui.screens

import android.content.Intent
import android.net.Uri
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
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.TextButton
import com.example.ui.i18n.AppLanguage
import com.example.ui.theme.AppThemeMode
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
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
import com.example.data.model.StoreTransaction
import com.example.data.model.Supplier
import java.text.SimpleDateFormat
import java.util.Locale

private val SupplierCreamBg = Color(0xFFF0F9F5)
private val SupplierCardBorder = Color(0xFFB6EADA)
private val SupplierTerracotta = Color(0xFF00B368)
private val SupplierGradientStart = Color(0xFF059669)
private val SupplierGradientEnd = Color(0xFF0EA5E9)
private val SupplierPaidGreen = Color(0xFF00B368)
private val SupplierDarkGreen = Color(0xFF00A862)
private val SupplierDangerRed = Color(0xFFE11D48)
private val SupplierDangerBg = Color(0xFFFFF1F2)
private val SupplierTextPrimary = Color(0xFF0F172A)
private val SupplierTextSecondary = Color(0xFF64748B)
private val SupplierLinkBlue = Color(0xFF0284C7)

private const val SUPPLIER_NOTE_SEP = "||NOTE:"

private fun encodeSupplierAddressAndNote(address: String, note: String): String {
    val cleanAddress = address.trim()
    val cleanNote = note.trim()
    return if (cleanNote.isBlank()) {
        cleanAddress.take(100)
    } else {
        "$cleanAddress$SUPPLIER_NOTE_SEP$cleanNote".take(100)
    }
}

private fun extractSupplierAddress(companyField: String): String {
    return companyField.substringBefore(SUPPLIER_NOTE_SEP).trim()
}

private fun extractSupplierNote(companyField: String): String {
    return if (companyField.contains(SUPPLIER_NOTE_SEP)) {
        companyField.substringAfter(SUPPLIER_NOTE_SEP).trim()
    } else {
        ""
    }
}

private fun formatSupplierPhoneDisplay(rawPhone: String): String {
    val trimmed = rawPhone.trim()
    return if (trimmed.isBlank() || trimmed == "-") "—" else trimmed
}

private fun formatCleanAmount(value: Double): String {
    return if (value % 1.0 == 0.0) {
        value.toLong().toString()
    } else {
        "%.2f".format(Locale.US, value)
    }
}

@Composable
fun SupplierModuleScreen(
    suppliers: List<Supplier>,
    transactions: List<StoreTransaction>,
    language: AppLanguage = AppLanguage.ENGLISH,
    themeMode: AppThemeMode = AppThemeMode.LIGHT,
    onBackToMoreMenu: () -> Unit,
    onAddSupplier: (name: String, phone: String, companyEncoded: String, initialPayable: Double) -> Unit,
    onUpdateSupplier: (supplier: Supplier, name: String, phone: String, companyEncoded: String) -> Unit,
    onDeleteSupplier: (Supplier) -> Unit,
    onPaySupplier: (supplier: Supplier, amount: Double, notes: String) -> Unit,
    onAddSupplierOwed: (supplier: Supplier, amount: Double, notes: String) -> Unit
) {
    val isBn = language == AppLanguage.BENGALI
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var selectedSupplierId by rememberSaveable { mutableStateOf<String?>(null) }
    var showNewSupplierSheet by remember { mutableStateOf(false) }
    var editingSupplier by remember { mutableStateOf<Supplier?>(null) }
    var supplierPendingDelete by remember { mutableStateOf<Supplier?>(null) }

    // Pair<Supplier, Boolean>: second = true for "I paid", false for "Add owed"
    var supplierEntrySheet by remember { mutableStateOf<Pair<Supplier, Boolean>?>(null) }

    val selectedSupplier = remember(suppliers, selectedSupplierId) {
        selectedSupplierId?.let { id -> suppliers.firstOrNull { it.id == id } }
    }

    val filteredSuppliers = remember(suppliers, searchQuery) {
        if (searchQuery.isBlank()) {
            suppliers
        } else {
            val q = searchQuery.trim().lowercase()
            suppliers.filter { sup ->
                sup.name.lowercase().contains(q) || sup.phone.lowercase().contains(q)
            }
        }
    }

    BackHandler {
        if (selectedSupplier != null) {
            selectedSupplierId = null
        } else {
            onBackToMoreMenu()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(SupplierCreamBg)
    ) {
        if (selectedSupplier != null) {
            val supplierTransactions = remember(transactions, selectedSupplier.id, selectedSupplier.name) {
                transactions.filter { tx ->
                    (tx.supplierId.isNotBlank() && tx.supplierId == selectedSupplier.id) ||
                        (tx.supplierId.isBlank() && tx.supplierName.equals(selectedSupplier.name, ignoreCase = true))
                }
            }
            SupplierDetailView(
                supplier = selectedSupplier,
                supplierTransactions = supplierTransactions,
                isBn = isBn,
                onBack = { selectedSupplierId = null },
                onEditSupplier = { editingSupplier = selectedSupplier },
                onOpenIPaid = { supplierEntrySheet = selectedSupplier to true },
                onOpenAddOwed = { supplierEntrySheet = selectedSupplier to false },
                onDeleteSupplier = {
                    supplierPendingDelete = selectedSupplier
                }
            )
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // 1. Header Row: [←] Suppliers (N)  ...  [+ New supplier]
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
                                border = BorderStroke(1.dp, SupplierCardBorder),
                                modifier = Modifier
                                    .size(40.dp)
                                    .testTag("suppliers_back_button")
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                        contentDescription = "Back",
                                        tint = SupplierTextPrimary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.width(12.dp))

                            Text(
                                text = if (isBn) "সাপ্লায়ার (${suppliers.size})" else "Suppliers (${suppliers.size})",
                                fontSize = 23.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = SupplierTextPrimary
                            )
                        }

                        Button(
                            onClick = { showNewSupplierSheet = true },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SupplierTerracotta,
                                contentColor = Color.White
                            ),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
                            modifier = Modifier
                                .height(40.dp)
                                .testTag("add_new_supplier_button")
                        ) {
                            Text(
                                text = if (isBn) "+ নতুন সাপ্লায়ার" else "+ New supplier",
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // 2. Search Input: "Search by name or phone"
                item {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = {
                            Text(
                                text = if (isBn) "নাম বা মোবাইল নম্বর দিয়ে খুঁজুন" else "Search by name or phone",
                                color = SupplierTextSecondary,
                                fontSize = 15.sp
                            )
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = SupplierTerracotta,
                            unfocusedBorderColor = SupplierCardBorder,
                            focusedTextColor = SupplierTextPrimary,
                            unfocusedTextColor = SupplierTextPrimary
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("supplier_search_input")
                    )
                }

                // 3. Suppliers List Card OR Empty State Card
                if (filteredSuppliers.isEmpty()) {
                    item {
                        Surface(
                            shape = RoundedCornerShape(18.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, SupplierCardBorder),
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
                                Text(text = "🚚", fontSize = 36.sp)
                                Spacer(modifier = Modifier.height(14.dp))
                                Text(
                                    text = "No suppliers yet. Add your first supplier.",
                                    fontSize = 15.sp,
                                    color = SupplierTextSecondary,
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
                            border = BorderStroke(1.dp, SupplierCardBorder),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.fillMaxWidth()) {
                                filteredSuppliers.forEachIndexed { index, supplier ->
                                    val phoneLabel = formatSupplierPhoneDisplay(supplier.phone)
                                    val balanceColor = if (supplier.payableBalance > 0.0) {
                                        SupplierTerracotta
                                    } else {
                                        SupplierTextSecondary
                                    }

                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable { selectedSupplierId = supplier.id }
                                            .padding(horizontal = 18.dp, vertical = 16.dp)
                                            .testTag("supplier_row_${supplier.id}"),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = supplier.name,
                                                fontSize = 17.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = SupplierTextPrimary,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            Spacer(modifier = Modifier.height(3.dp))
                                            Text(
                                                text = phoneLabel,
                                                fontSize = 14.sp,
                                                color = SupplierTextSecondary
                                            )
                                        }

                                        Spacer(modifier = Modifier.width(12.dp))

                                        Text(
                                            text = "৳ ${formatCleanAmount(supplier.payableBalance)}",
                                            fontSize = 17.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = balanceColor
                                        )
                                    }

                                    if (index < filteredSuppliers.lastIndex) {
                                        HorizontalDivider(
                                            color = Color(0xFFF1ECE6),
                                            thickness = 1.dp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // "+ New supplier" Bottom Sheet
    if (showNewSupplierSheet) {
        SupplierFormBottomSheet(
            existingSupplier = null,
            isBn = isBn,
            onDismiss = { showNewSupplierSheet = false },
            onSave = { name, phone, encodedCompany ->
                onAddSupplier(name, phone, encodedCompany, 0.0)
                showNewSupplierSheet = false
            }
        )
    }

    // "Edit supplier" Bottom Sheet
    editingSupplier?.let { supToEdit ->
        SupplierFormBottomSheet(
            existingSupplier = supToEdit,
            isBn = isBn,
            onDismiss = { editingSupplier = null },
            onSave = { name, phone, encodedCompany ->
                onUpdateSupplier(supToEdit, name, phone, encodedCompany)
                editingSupplier = null
            }
        )
    }

    // "I paid" / "Add owed" Bottom Sheet
    supplierEntrySheet?.let { (targetSupplier, isIPaid) ->
        SupplierPaymentOrOwedBottomSheet(
            supplier = targetSupplier,
            isIPaid = isIPaid,
            isBn = isBn,
            onDismiss = { supplierEntrySheet = null },
            onSave = { amount, note ->
                if (isIPaid) {
                    onPaySupplier(targetSupplier, amount, note)
                } else {
                    onAddSupplierOwed(targetSupplier, amount, note)
                }
                supplierEntrySheet = null
            }
        )
    }

    supplierPendingDelete?.let { target ->
        AlertDialog(
            onDismissRequest = { supplierPendingDelete = null },
            icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = SupplierDangerRed) },
            title = {
                Text(
                    text = if (isBn) "সতর্কতা: সাপ্লায়ার ডিলিট" else "Warning: Delete Supplier",
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    text = if (isBn) {
                        "আপনি কি নিশ্চিত যে সাপ্লায়ার '${target.name}' মুছে ফেলতে চান? এটি খাতা থেকে মুছে রিসাইকেল বিনে চলে যাবে।"
                    } else {
                        "Are you sure you want to delete supplier '${target.name}'? This supplier will be moved to the Recycle Bin."
                    }
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val sup = target
                        supplierPendingDelete = null
                        selectedSupplierId = null
                        onDeleteSupplier(sup)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = SupplierDangerRed)
                ) {
                    Text(if (isBn) "হ্যাঁ, ডিলিট করুন" else "Yes, Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { supplierPendingDelete = null }) {
                    Text(if (isBn) "বাতিল" else "Cancel")
                }
            }
        )
    }
}

@Composable
private fun SupplierDetailView(
    supplier: Supplier,
    supplierTransactions: List<StoreTransaction>,
    isBn: Boolean = false,
    onBack: () -> Unit,
    onEditSupplier: () -> Unit,
    onOpenIPaid: () -> Unit,
    onOpenAddOwed: () -> Unit,
    onDeleteSupplier: () -> Unit
) {
    val context = LocalContext.current
    val rawPhone = supplier.phone.trim()
    val hasPhone = rawPhone.isNotBlank() && rawPhone != "—" && rawPhone != "-"
    val cleanAddress = extractSupplierAddress(supplier.company)
    val cleanNote = extractSupplierNote(supplier.company)
    val dateFormat = remember { SimpleDateFormat("d MMM yyyy, hh:mm a", Locale.US) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Top Bar: [←] Rice supplier 2  ...  [✏️ Edit]
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
                    border = BorderStroke(1.dp, SupplierCardBorder),
                    modifier = Modifier
                        .size(40.dp)
                        .testTag("supplier_detail_back_button")
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = SupplierTextPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Text(
                    text = supplier.name,
                    fontSize = 23.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = SupplierTextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Surface(
                onClick = onEditSupplier,
                shape = RoundedCornerShape(10.dp),
                color = Color.White,
                border = BorderStroke(1.dp, SupplierCardBorder),
                modifier = Modifier
                    .height(38.dp)
                    .testTag("supplier_detail_edit_button")
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = "Edit Supplier",
                        tint = SupplierTextPrimary,
                        modifier = Modifier.size(15.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isBn) "সম্পাদনা" else "Edit",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = SupplierTextPrimary
                    )
                }
            }
        }

        // Optional Phone / Address / Note row under header
        if (hasPhone || cleanAddress.isNotBlank() || cleanNote.isNotBlank()) {
            Column(
                modifier = Modifier.padding(start = 2.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                if (hasPhone) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .clickable {
                                runCatching {
                                    val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$rawPhone"))
                                    context.startActivity(dialIntent)
                                }
                            }
                            .padding(vertical = 2.dp)
                    ) {
                        Text(text = "📞", fontSize = 14.sp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = rawPhone,
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = SupplierLinkBlue
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
                            color = SupplierTextSecondary
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
                            color = SupplierTextSecondary
                        )
                    }
                }
            }
        }

        // 2. Hero Payable Card: "I owe" + "৳ 0" with decorative right circle
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(
                    Brush.linearGradient(
                        colors = listOf(SupplierGradientStart, SupplierGradientEnd)
                    )
                )
        ) {
            Box(
                modifier = Modifier
                    .size(110.dp)
                    .align(Alignment.TopEnd)
                    .offset(x = 24.dp, y = (-20).dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.08f))
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 20.dp)
            ) {
                Text(
                    text = if (isBn) "মোট দেনা (বাকি)" else "I owe",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White.copy(alpha = 0.88f)
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "৳ ${formatCleanAmount(supplier.payableBalance)}",
                    fontSize = 36.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White
                )
            }
        }

        // 3. Action Buttons Row: "I paid" (Green) | "Add owed" (Terracotta/Orange)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = onOpenIPaid,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = SupplierPaidGreen,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .weight(1f)
                    .height(52.dp)
                    .testTag("supplier_i_paid_button")
            ) {
                Text(
                    text = if (isBn) "টাকা পরিশোধ" else "I paid",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Button(
                onClick = onOpenAddOwed,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = SupplierTerracotta,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .weight(1f)
                    .height(52.dp)
                    .testTag("supplier_add_owed_button")
            ) {
                Text(
                    text = if (isBn) "বাকি মাল নিলাম" else "Add owed",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // 4. Transactions Card
        Surface(
            shape = RoundedCornerShape(18.dp),
            color = Color.White,
            border = BorderStroke(1.dp, SupplierCardBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp)
            ) {
                Text(
                    text = if (isBn) "লেনদেন ইতিহাস" else "Transactions",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = SupplierTextPrimary
                )

                Spacer(modifier = Modifier.height(10.dp))

                if (supplierTransactions.isEmpty()) {
                    Text(
                        text = if (isBn) "এখনও কোনো লেনদেন নেই।" else "No transactions yet.",
                        fontSize = 14.5.sp,
                        color = SupplierTextSecondary
                    )
                } else {
                    supplierTransactions.forEachIndexed { idx, tx ->
                        val dateStr = tx.createdAt?.toDate()?.let { dateFormat.format(it) } ?: "Just now"
                        val isPayment = tx.type == "SUPPLIER_PAYMENT"
                        val label = when {
                            isPayment -> if (isBn) "টাকা পরিশোধ" else "I paid"
                            tx.category == "Supplier Credit" -> if (isBn) "বাকি মাল যোগ" else "Added owed"
                            else -> tx.title.ifBlank { if (isBn) "পণ্য ক্রয়" else "Purchase" }
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
                                    color = SupplierTextPrimary
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = if (cleanTxNote.isNotBlank()) "$dateStr • $cleanTxNote" else dateStr,
                                    fontSize = 12.5.sp,
                                    color = SupplierTextSecondary
                                )
                            }

                            Spacer(modifier = Modifier.width(10.dp))

                            Text(
                                text = if (isPayment) {
                                    "- ৳ ${formatCleanAmount(tx.amount)}"
                                } else {
                                    "+ ৳ ${formatCleanAmount(if (tx.dueAmount > 0.0) tx.dueAmount else tx.amount)}"
                                },
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isPayment) SupplierDarkGreen else SupplierTerracotta
                            )
                        }

                        if (idx < supplierTransactions.lastIndex) {
                            HorizontalDivider(color = Color(0xFFF1ECE6))
                        }
                    }
                }
            }
        }

        // 5. "🗑️ Delete supplier" Button (matching Screenshot 2)
        OutlinedButton(
            onClick = onDeleteSupplier,
            shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, SupplierDangerRed.copy(alpha = 0.35f)),
            colors = ButtonDefaults.outlinedButtonColors(
                containerColor = SupplierDangerBg,
                contentColor = SupplierDangerRed
            ),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 12.dp),
            modifier = Modifier
                .height(46.dp)
                .testTag("delete_supplier_button")
        ) {
            Text(
                text = if (isBn) "🗑️ সাপ্লায়ার মুছুন" else "🗑️ Delete supplier",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = SupplierDangerRed
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SupplierFormBottomSheet(
    existingSupplier: Supplier?,
    isBn: Boolean = false,
    onDismiss: () -> Unit,
    onSave: (name: String, phone: String, encodedCompany: String) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var name by remember(existingSupplier) { mutableStateOf(existingSupplier?.name ?: "") }
    var phone by remember(existingSupplier) {
        val raw = existingSupplier?.phone?.trim().orEmpty()
        mutableStateOf(if (raw == "—" || raw == "-") "" else raw)
    }
    var address by remember(existingSupplier) {
        mutableStateOf(existingSupplier?.company?.let { extractSupplierAddress(it) } ?: "")
    }
    var note by remember(existingSupplier) {
        mutableStateOf(existingSupplier?.company?.let { extractSupplierNote(it) } ?: "")
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
                text = if (isBn) {
                    if (existingSupplier == null) "+ নতুন সাপ্লায়ার" else "সাপ্লায়ার তথ্য পরিবর্তন"
                } else {
                    if (existingSupplier == null) "+ New supplier" else "Edit supplier"
                },
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                color = SupplierTextPrimary
            )

            // 1. Supplier name
            SupplierSheetField(
                label = if (isBn) "সাপ্লায়ারের নাম *" else "Supplier name",
                value = name,
                onValueChange = { name = it },
                isHighlighted = true,
                testTag = "supplier_name_input"
            )

            // 2. Phone number (optional)
            SupplierSheetField(
                label = if (isBn) "মোবাইল নম্বর (ঐচ্ছিক)" else "Phone number (optional)",
                value = phone,
                onValueChange = { phone = it },
                keyboardType = KeyboardType.Phone,
                testTag = "supplier_phone_input"
            )

            // 3. Address (optional)
            SupplierSheetField(
                label = if (isBn) "কোম্পানি বা ঠিকানা (ঐচ্ছিক)" else "Address (optional)",
                value = address,
                onValueChange = { address = it },
                testTag = "supplier_address_input"
            )

            // 4. Note (optional)
            SupplierSheetField(
                label = if (isBn) "নোট / বিবরণ (ঐচ্ছিক)" else "Note (optional)",
                value = note,
                onValueChange = { note = it },
                testTag = "supplier_note_input"
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Save Button
            Button(
                onClick = {
                    val trimmedName = name.trim()
                    if (trimmedName.isNotEmpty()) {
                        val encodedCompany = encodeSupplierAddressAndNote(address, note)
                        onSave(trimmedName, phone.trim(), encodedCompany)
                    }
                },
                enabled = name.trim().isNotEmpty(),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = SupplierTerracotta,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .testTag("confirm_save_supplier_button")
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
                border = BorderStroke(1.dp, SupplierCardBorder),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = Color.White,
                    contentColor = SupplierTextPrimary
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SupplierPaymentOrOwedBottomSheet(
    supplier: Supplier,
    isIPaid: Boolean,
    isBn: Boolean = false,
    onDismiss: () -> Unit,
    onSave: (amount: Double, note: String) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var amountText by remember { mutableStateOf("") }
    var noteText by remember { mutableStateOf("") }
    val accentColor = if (isIPaid) SupplierPaidGreen else SupplierTerracotta

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
                text = if (isBn) {
                    if (isIPaid) "টাকা পরিশোধ" else "বাকি মাল যোগ"
                } else {
                    if (isIPaid) "I paid" else "Add owed"
                },
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                color = SupplierTextPrimary
            )

            Text(
                text = if (isBn) {
                    "${supplier.name} • বর্তমান দেনা: ৳ ${formatCleanAmount(supplier.payableBalance)}"
                } else {
                    "${supplier.name} • Current payable: ৳ ${formatCleanAmount(supplier.payableBalance)}"
                },
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = SupplierTextSecondary
            )

            SupplierSheetField(
                label = if (isBn) "টাকার পরিমাণ (৳) *" else "Amount (৳)",
                value = amountText,
                onValueChange = { amountText = it },
                keyboardType = KeyboardType.Decimal,
                isHighlighted = true,
                testTag = "supplier_entry_amount_input"
            )

            SupplierSheetField(
                label = if (isBn) "নোট / বিবরণ (ঐচ্ছিক)" else "Note (optional)",
                value = noteText,
                onValueChange = { noteText = it },
                testTag = "supplier_entry_note_input"
            )

            Spacer(modifier = Modifier.height(4.dp))

            Button(
                onClick = {
                    val amt = amountText.toDoubleOrNull() ?: 0.0
                    if (amt > 0.0) {
                        onSave(amt, noteText.trim())
                    }
                },
                enabled = (amountText.toDoubleOrNull() ?: 0.0) > 0.0,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = accentColor,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .testTag("confirm_supplier_entry_button")
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
                border = BorderStroke(1.dp, SupplierCardBorder),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = Color.White,
                    contentColor = SupplierTextPrimary
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
private fun SupplierSheetField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    keyboardType: KeyboardType = KeyboardType.Text,
    isHighlighted: Boolean = false,
    testTag: String = ""
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Medium,
            color = if (isHighlighted) SupplierTerracotta else SupplierTextSecondary
        )
        Spacer(modifier = Modifier.height(6.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color.White,
                unfocusedContainerColor = Color(0xFFFAF7F2),
                focusedBorderColor = SupplierTerracotta,
                unfocusedBorderColor = if (isHighlighted) SupplierTerracotta else SupplierCardBorder,
                focusedTextColor = SupplierTextPrimary,
                unfocusedTextColor = SupplierTextPrimary
            ),
            modifier = Modifier
                .fillMaxWidth()
                .then(if (testTag.isNotEmpty()) Modifier.testTag(testTag) else Modifier)
        )
    }
}
