package com.example.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.material.icons.automirrored.filled.FactCheck
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Store
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.BuildConfig
import com.example.R
import com.example.data.auth.VaultRole
import com.example.data.auth.VaultUserAccount
import com.example.data.model.AuditLog
import com.example.data.model.CartItem
import com.example.data.model.Customer
import com.example.data.model.Product
import com.example.data.model.RecycleBinItem
import com.example.data.model.StaffMember
import com.example.data.model.StoreTransaction
import com.example.data.model.Supplier
import com.example.ui.i18n.AppLanguage
import com.example.ui.i18n.stringsFor
import com.example.ui.theme.AppThemeMode
import com.example.ui.util.ExportHelper
import com.example.ui.viewmodel.DailyStats
import com.example.ui.viewmodel.DokanViewModel
import java.text.SimpleDateFormat
import java.util.Locale

enum class MoreSubScreen(val bnTitle: String, val enTitle: String) {
    MENU("টুলস ও সেটিংস", "Tools & Settings"),
    PURCHASE_TRACKER("মাল কেনা (স্টক ইন)", "Purchase Tracker (Stock In)"),
    SUPPLIER_LEDGER("সাপ্লায়ার খাতা", "Supplier Ledger (Payables)"),
    EXPENSE_TRACKING("দোকানের খরচ", "Shop Expenses"),
    CASH_BOOK("ক্যাশ খাতা", "Cash Book (Inflow / Outflow)"),
    BUSINESS_REPORTS("ব্যবসার রিপোর্ট", "Business Reports & Analytics"),
    DUE_REPORTS("বাকির রিপোর্ট", "Due Reports & Defaulters"),
    BACKUP_RESTORE("ফায়ারবেস সিঙ্ক ও ডাটা ব্যাকআপ", "Firebase Sync & Backup"),
    TRANSACTION_DELETION("ডাটা মুছে ফেলা ও রিসেট (ফিল্টার)", "Data Removal & Deletion Center"),
    RECYCLE_BIN("রিসাইকেল বিন", "Recycle Bin (Trash)"),
    USER_MANAGEMENT("ইউজার ম্যানেজমেন্ট", "User Management"),
    STAFF_ROLES("স্টাফ ম্যানেজমেন্ট", "Staff Management & Roles"),
    AUDIT_LOG("অডিট লগ", "Audit Log (Activity Trail)")
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MoreManagementScreen(
    userEmail: String,
    currentVaultAccount: VaultUserAccount,
    allVaultAccounts: List<VaultUserAccount>,
    products: List<Product>,
    customers: List<Customer>,
    transactions: List<StoreTransaction>,
    suppliers: List<Supplier>,
    staffList: List<StaffMember>,
    auditLogs: List<AuditLog>,
    recycleBinItems: List<RecycleBinItem> = emptyList(),
    dailyStats: DailyStats,
    language: AppLanguage,
    themeMode: AppThemeMode,
    onLanguageChange: (AppLanguage) -> Unit,
    onThemeModeChange: (AppThemeMode) -> Unit,
    onAddSupplier: (name: String, phone: String, company: String, payable: Double) -> Unit,
    onUpdateSupplier: (supplier: Supplier, name: String, phone: String, company: String) -> Unit = { _, _, _, _ -> },
    onDeleteSupplier: (Supplier) -> Unit = {},
    onDeleteProduct: (Product) -> Unit = {},
    onDeleteCustomer: (Customer) -> Unit = {},
    onAddSupplierOwed: (supplier: Supplier, amount: Double, notes: String) -> Unit = { _, _, _ -> },
    onRecordPurchase: (Product?, Supplier?, Double, Double, Double, String) -> Unit,
    onRecordMultiItemPurchase: (
        cartItems: List<CartItem>,
        paidAmount: Double,
        selectedSupplier: Supplier?,
        newSupplierName: String,
        updateBuyingPrice: Boolean,
        notes: String,
        onCompleted: (StoreTransaction) -> Unit
    ) -> Unit = { _, _, _, _, _, _, _ -> },
    onVoidPurchase: (
        transaction: StoreTransaction,
        onVoided: () -> Unit
    ) -> Unit = { _, _ -> },
    onPaySupplier: (Supplier, Double, String) -> Unit,
    onRecordExpense: (title: String, category: String, amount: Double, notes: String) -> Unit,
    onDeleteExpense: (StoreTransaction) -> Unit = {},
    onDeleteTransaction: (StoreTransaction) -> Unit = {},
    onSetStartingCash: (Double) -> Unit = {},
    onAddStaff: (name: String, role: String, phone: String, salary: Double) -> Unit,
    onUpdateStaff: (staff: StaffMember, name: String, role: String, phone: String, salary: Double, active: Boolean) -> Unit = { _, _, _, _, _, _ -> },
    onDeleteStaff: (StaffMember) -> Unit = {},
    onToggleStaff: (StaffMember) -> Unit,
    onRestoreRecycleItem: (RecycleBinItem) -> Unit = {},
    onDeletePermanentlyRecycleItem: (String) -> Unit = {},
    onEmptyRecycleBin: () -> Unit = {},
    onResetAllStoreData: ((Boolean) -> Unit) -> Unit = {},
    onSeedSampleData: () -> Unit,
    onOpenBlueprintGuide: () -> Unit,
    onAddVaultAccount: (name: String, email: String, password: String, role: VaultRole) -> Result<VaultUserAccount>,
    onEditVaultAccount: (
        originalEmail: String,
        newName: String,
        newEmail: String,
        newPassword: String,
        newRole: VaultRole
    ) -> Result<VaultUserAccount> = { _, name, email, pass, role ->
        onAddVaultAccount(name, email, pass, role)
    },
    onRemoveVaultAccount: (email: String) -> Result<Unit>,
    onOpenChangeOwnPassword: () -> Unit,
    onSignOut: () -> Unit
) {
    val context = LocalContext.current
    val strings = remember(language) { stringsFor(language) }
    var activeSubScreen by remember { mutableStateOf(MoreSubScreen.MENU) }
    var adminGateBanner by remember { mutableStateOf<String?>(null) }
    var showResetDialog by remember { mutableStateOf(false) }
    var showProfileDialog by remember { mutableStateOf(false) }
    var showAboutDevDialog by remember { mutableStateOf(false) }

    // Developer Photos: Color Portrait and Artistic Sketch
    val devPhotos = remember {
        listOf(
            R.drawable.img_developer_photo_1,
            R.drawable.img_developer_photo_2
        )
    }
    // Random selection on different visits
    var activeDevPhotoIndex by remember {
        mutableIntStateOf(kotlin.random.Random.nextInt(devPhotos.size))
    }

    val isBn = language == AppLanguage.BENGALI
    val isAdmin = currentVaultAccount.role == VaultRole.ADMIN

    fun openSubScreenIfAdmin(target: MoreSubScreen) {
        if (isAdmin) {
            adminGateBanner = null
            activeSubScreen = target
        } else {
            adminGateBanner = if (isBn) {
                "🔒 স্টোরের মূল ব্যাকএন্ড শুধুমাত্র অ্যাডমিন দ্বারা নিয়ন্ত্রিত। অ্যাকাউন্ট ম্যানেজার শুধুমাত্র দোকানে পণ্য বিক্রি ও কাস্টমার সেবা পরিচালনা করতে পারবেন।"
            } else {
                "🔒 Main Store backend functionality is managed by Admin only. Account Managers are authorized for shop sales and customer service."
            }
        }
    }

    if (activeSubScreen == MoreSubScreen.PURCHASE_TRACKER) {
        PurchaseModuleScreen(
            products = products,
            suppliers = suppliers,
            purchaseTransactions = transactions.filter { it.type == "PURCHASE" },
            language = language,
            onBackToMoreMenu = { activeSubScreen = MoreSubScreen.MENU },
            onCompletePurchase = onRecordMultiItemPurchase,
            onVoidPurchase = onVoidPurchase
        )
        return
    }

    if (activeSubScreen == MoreSubScreen.SUPPLIER_LEDGER) {
        SupplierModuleScreen(
            suppliers = suppliers,
            transactions = transactions,
            language = language,
            themeMode = themeMode,
            onBackToMoreMenu = { activeSubScreen = MoreSubScreen.MENU },
            onAddSupplier = onAddSupplier,
            onUpdateSupplier = onUpdateSupplier,
            onDeleteSupplier = onDeleteSupplier,
            onPaySupplier = onPaySupplier,
            onAddSupplierOwed = onAddSupplierOwed
        )
        return
    }

    if (activeSubScreen == MoreSubScreen.EXPENSE_TRACKING) {
        ExpenseModuleScreen(
            transactions = transactions,
            language = language,
            themeMode = themeMode,
            onBackToMoreMenu = { activeSubScreen = MoreSubScreen.MENU },
            onRecordExpense = onRecordExpense,
            onDeleteExpense = onDeleteExpense
        )
        return
    }

    if (activeSubScreen == MoreSubScreen.CASH_BOOK) {
        CashBookModuleScreen(
            transactions = transactions,
            language = language,
            onBackToMoreMenu = { activeSubScreen = MoreSubScreen.MENU },
            onSetStartingCash = onSetStartingCash
        )
        return
    }

    if (activeSubScreen == MoreSubScreen.DUE_REPORTS) {
        DueReportsModuleScreen(
            storeOwnerName = currentVaultAccount.name,
            customers = customers,
            transactions = transactions,
            language = language,
            onBackToMoreMenu = { activeSubScreen = MoreSubScreen.MENU }
        )
        return
    }

    if (activeSubScreen == MoreSubScreen.BUSINESS_REPORTS) {
        BusinessReportsModuleScreen(
            storeOwnerName = currentVaultAccount.name,
            products = products,
            customers = customers,
            suppliers = suppliers,
            transactions = transactions,
            language = language,
            onBackToMoreMenu = { activeSubScreen = MoreSubScreen.MENU }
        )
        return
    }

    if (activeSubScreen != MoreSubScreen.MENU) {
        BackHandler { activeSubScreen = MoreSubScreen.MENU }
    }

    val isDark = themeMode == AppThemeMode.DARK || (themeMode == AppThemeMode.SYSTEM && isSystemInDarkTheme())
    val menuBg = if (isDark) Color(0xFF0F172A) else Color(0xFFF0F9F5)
    val cardBg = if (isDark) Color(0xFF1E293B) else Color.White
    val cardBorder = if (isDark) Color(0xFF334155) else Color(0xFFC6F0DF)
    val textPrimary = if (isDark) Color(0xFFF8FAFC) else Color(0xFF0F172A)
    val dividerColor = if (isDark) Color(0xFF334155) else Color(0xFFE2E8F0).copy(alpha = 0.6f)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(menuBg)
            .padding(horizontal = 16.dp, vertical = 14.dp)
    ) {
        if (activeSubScreen != MoreSubScreen.MENU) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = { activeSubScreen = MoreSubScreen.MENU },
                    modifier = Modifier.testTag("more_back_button")
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = textPrimary
                    )
                }
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = if (isBn) activeSubScreen.bnTitle else activeSubScreen.enTitle,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = textPrimary
                )
            }
        }

        when (activeSubScreen) {
            MoreSubScreen.MENU -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .testTag("more_menu_list"),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    contentPadding = PaddingValues(bottom = 36.dp)
                ) {
                    // Header: "🛠️ Tools & Settings" (or "টুলস ও সেটিংস")
                    item {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(top = 2.dp)
                        ) {
                            Text(text = "🛠️", fontSize = 24.sp)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = strings.toolsTitle,
                                fontSize = 23.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFF0F172A)
                            )
                        }
                    }

                    if (adminGateBanner != null) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.errorContainer
                                )
                            ) {
                                Text(
                                    text = adminGateBanner!!,
                                    color = MaterialTheme.colorScheme.onErrorContainer,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(14.dp)
                                )
                            }
                        }
                    }

                    // SECTION 1: Store Operations (দোকান ও ব্যবসা পরিচালনা)
                    item {
                        SectionHeader(title = strings.secStoreOps)
                        Spacer(modifier = Modifier.height(6.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(22.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            border = BorderStroke(1.dp, Color(0xFFC6F0DF)),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.fillMaxWidth()) {
                                ToolsMenuRow(
                                    emoji = "🧾",
                                    title = strings.menuPurchases,
                                    subtitle = strings.menuPurchasesSub,
                                    onClick = {
                                        adminGateBanner = null
                                        activeSubScreen = MoreSubScreen.PURCHASE_TRACKER
                                    }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    emoji = "🚚",
                                    title = strings.menuSuppliers,
                                    subtitle = strings.menuSuppliersSub,
                                    onClick = {
                                        adminGateBanner = null
                                        activeSubScreen = MoreSubScreen.SUPPLIER_LEDGER
                                    }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    emoji = "💸",
                                    title = strings.menuExpenses,
                                    subtitle = strings.menuExpensesSub,
                                    onClick = {
                                        adminGateBanner = null
                                        activeSubScreen = MoreSubScreen.EXPENSE_TRACKING
                                    }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    emoji = "📒",
                                    title = strings.menuCashBook,
                                    subtitle = strings.menuCashBookSub,
                                    onClick = {
                                        adminGateBanner = null
                                        activeSubScreen = MoreSubScreen.CASH_BOOK
                                    }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    emoji = "💹",
                                    title = strings.menuBusinessReports,
                                    subtitle = strings.menuBusinessReportsSub,
                                    onClick = {
                                        adminGateBanner = null
                                        activeSubScreen = MoreSubScreen.BUSINESS_REPORTS
                                    }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    emoji = "📈",
                                    title = strings.menuDueReports,
                                    subtitle = strings.menuDueReportsSub,
                                    onClick = {
                                        adminGateBanner = null
                                        activeSubScreen = MoreSubScreen.DUE_REPORTS
                                    }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    emoji = "👥",
                                    title = strings.menuStaff,
                                    subtitle = strings.menuStaffSub,
                                    onClick = { openSubScreenIfAdmin(MoreSubScreen.STAFF_ROLES) }
                                )
                            }
                        }
                    }

                    // SECTION 2: Firebase Manager (ফায়ারবেস ম্যানেজার - সিঙ্ক, ব্যাকআপ, ইউজার ম্যানেজমেন্ট, ডিলিট ও রিসেট)
                    item {
                        SectionHeader(title = strings.secDataCloud)
                        Spacer(modifier = Modifier.height(6.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(22.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            border = BorderStroke(1.dp, Color(0xFFC6F0DF)),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.fillMaxWidth()) {
                                ToolsMenuRow(
                                    emoji = "☁️",
                                    title = strings.menuBackup,
                                    subtitle = strings.menuBackupSub,
                                    onClick = { openSubScreenIfAdmin(MoreSubScreen.BACKUP_RESTORE) }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    emoji = "🔐",
                                    title = strings.menuUserMgmt,
                                    subtitle = strings.menuUserMgmtSub,
                                    badgeText = "${allVaultAccounts.size}",
                                    onClick = {
                                        adminGateBanner = null
                                        activeSubScreen = MoreSubScreen.USER_MANAGEMENT
                                    }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    emoji = "🛡️",
                                    title = strings.menuAuditLog,
                                    subtitle = strings.menuAuditLogSub,
                                    badgeText = if (auditLogs.isNotEmpty()) "${auditLogs.size}" else (if (isBn) "সক্রিয়" else "Active"),
                                    onClick = { openSubScreenIfAdmin(MoreSubScreen.AUDIT_LOG) }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    emoji = "🗑️",
                                    title = strings.menuRecycleBin,
                                    subtitle = strings.menuRecycleBinSub,
                                    badgeText = if (recycleBinItems.isNotEmpty()) "${recycleBinItems.size}" else null,
                                    onClick = { openSubScreenIfAdmin(MoreSubScreen.RECYCLE_BIN) }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    emoji = "✂️",
                                    title = strings.menuDeleteTransactions,
                                    subtitle = strings.menuDeleteTransactionsSub,
                                    isDanger = true,
                                    onClick = { openSubScreenIfAdmin(MoreSubScreen.TRANSACTION_DELETION) }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    emoji = "⚠️",
                                    title = strings.menuResetAll,
                                    subtitle = strings.menuResetAllSub,
                                    isDanger = true,
                                    onClick = {
                                        if (isAdmin) {
                                            showResetDialog = true
                                        } else {
                                            adminGateBanner = if (isBn) "শুধুমাত্র অ্যাডমিন পুরো ডাটা রিসেট করতে পারবেন।" else "Only Admin can reset store data."
                                        }
                                    }
                                )
                            }
                        }
                    }

                    // SECTION 3: App Preferences (অ্যাপ সেটিংস ও রূপরেখা)
                    item {
                        SectionHeader(title = strings.secAppSettings)
                        Spacer(modifier = Modifier.height(6.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(22.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            border = BorderStroke(1.dp, Color(0xFFC6F0DF)),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(18.dp),
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                // 1. Language Header
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        contentAlignment = Alignment.Center,
                                        modifier = Modifier
                                            .size(36.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(Color(0xFFE6F9F1))
                                    ) {
                                        Icon(
                                            Icons.Default.Language,
                                            contentDescription = null,
                                            tint = Color(0xFF00B368),
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(
                                            text = strings.menuLanguage,
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF0F172A)
                                        )
                                        Text(
                                            text = if (isBn) "অ্যাপের ডিসপ্লে ভাষা নির্বাচন করুন" else "Select display language",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF64748B)
                                        )
                                    }
                                }

                                // Beautiful single-line bordered Language selector
                                Surface(
                                    shape = RoundedCornerShape(16.dp),
                                    color = Color(0xFFF8FAFC),
                                    border = BorderStroke(1.2.dp, Color(0xFFD1FAE5)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(6.dp),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        AppLanguage.entries.forEach { lang ->
                                            val isSelected = language == lang
                                            val (emoji, displayLabel) = when (lang) {
                                                AppLanguage.BENGALI -> "🇧🇩" to "বাংলা"
                                                AppLanguage.ENGLISH -> "🇬🇧" to "English"
                                            }
                                            SingleLinePreferenceOption(
                                                selected = isSelected,
                                                onClick = { onLanguageChange(lang) },
                                                label = displayLabel,
                                                leadingEmoji = emoji,
                                                modifier = Modifier.weight(1f)
                                            )
                                        }
                                    }
                                }

                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.8f))

                                // 2. Theme Mode Header
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        contentAlignment = Alignment.Center,
                                        modifier = Modifier
                                            .size(36.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(Color(0xFFE6F9F1))
                                    ) {
                                        Icon(
                                            Icons.Default.Palette,
                                            contentDescription = null,
                                            tint = Color(0xFF00B368),
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(
                                            text = strings.menuTheme,
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF0F172A)
                                        )
                                        Text(
                                            text = if (isBn) "অ্যাপের থিম ও ডার্ক মোড পছন্দ নির্বাচন করুন" else "Choose theme and color appearance",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF64748B)
                                        )
                                    }
                                }

                                // Beautiful single-line bordered Theme Mode selector
                                Surface(
                                    shape = RoundedCornerShape(16.dp),
                                    color = Color(0xFFF8FAFC),
                                    border = BorderStroke(1.2.dp, Color(0xFFD1FAE5)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    val themeOptions = listOf(
                                        Triple(AppThemeMode.LIGHT, "☀️", if (isBn) "লাইট" else "Light"),
                                        Triple(AppThemeMode.DARK, "🌙", if (isBn) "ডার্ক" else "Dark"),
                                        Triple(AppThemeMode.SYSTEM, "📱", if (isBn) "সিস্টেম" else "System")
                                    )
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(6.dp),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        themeOptions.forEach { (mode, emoji, label) ->
                                            SingleLinePreferenceOption(
                                                selected = themeMode == mode,
                                                onClick = { onThemeModeChange(mode) },
                                                label = label,
                                                leadingEmoji = emoji,
                                                modifier = Modifier.weight(1f)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // SECTION 5: Profile & About App (প্রোফাইল ও অ্যাপ তথ্য)
                    item {
                        SectionHeader(title = strings.secProfileAbout)
                        Spacer(modifier = Modifier.height(6.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(22.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            border = BorderStroke(1.dp, Color(0xFFC6F0DF)),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.fillMaxWidth()) {
                                ToolsMenuRow(
                                    leadingContent = {
                                        Image(
                                            painter = painterResource(id = R.drawable.ic_siaam_store_logo),
                                            contentDescription = "Store Logo",
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxSize()
                                        )
                                    },
                                    title = strings.menuProfile,
                                    subtitle = strings.menuProfileSub,
                                    onClick = { showProfileDialog = true }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    leadingContent = {
                                        Image(
                                            painter = painterResource(id = devPhotos[activeDevPhotoIndex]),
                                            contentDescription = "Developer",
                                            contentScale = ContentScale.Crop,
                                            alignment = BiasAlignment(0f, -0.15f),
                                            modifier = Modifier.fillMaxSize()
                                        )
                                    },
                                    title = strings.menuAboutDev,
                                    subtitle = strings.menuAboutDevSub,
                                    onClick = {
                                        activeDevPhotoIndex = kotlin.random.Random.nextInt(devPhotos.size)
                                        showAboutDevDialog = true
                                    }
                                )
                                HorizontalDivider(color = Color(0xFFE2E8F0).copy(alpha = 0.6f))
                                ToolsMenuRow(
                                    emoji = "📲",
                                    title = strings.menuShareApp,
                                    subtitle = strings.menuShareAppSub,
                                    onClick = {
                                        val downloadLink = "https://github.com/g4scumilla/g4scumilla.github.io/raw/refs/heads/main/Files/Android_App/Siaam_Store.apk"
                                        val shareSubject = if (isBn) {
                                            "🛒 সিয়াম স্টোর (Siaam Store)"
                                        } else {
                                            "🛒 Siaam Store"
                                        }
                                        val shareBody = if (isBn) {
                                            """
                                            🛒 সিয়াম স্টোর (Siaam Store)
                                            আপনার দোকানের বিক্রি, আয়-ব্যয়, পণ্য, স্টক ও বাকি হিসাব পরিচালনা করুন সহজেই একটি স্মার্ট অ্যাপের মাধ্যমে।
                                            📱 ব্যবসা হোক আরও সহজ ও আধুনিক!
                                            ⬇️ অ্যাপ ডাউনলোড করুন: $downloadLink
                                            """.trimIndent()
                                        } else {
                                            """
                                            🛒 Siaam Store
                                            Manage your sales, income, expenses, products, inventory, and customer dues — all in one smart app.
                                            📱 Make your business easier and smarter!
                                            ⬇️ Download the App: $downloadLink
                                            """.trimIndent()
                                        }
                                        ExportHelper.shareText(
                                            context = context,
                                            subject = shareSubject,
                                            bodyText = shareBody
                                        )
                                    }
                                )
                            }
                        }
                    }

                    // Terminate Session Row
                    item {
                        Surface(
                            onClick = onSignOut,
                            shape = RoundedCornerShape(18.dp),
                            color = Color(0xFFFDEDED),
                            border = BorderStroke(1.2.dp, Color(0xFFF5B7B7)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("sign_out_button")
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 16.dp, horizontal = 20.dp),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.PowerSettingsNew,
                                    contentDescription = if (isBn) "সেশন সমাপ্ত করুন" else "Terminate Session",
                                    tint = Color(0xFFEF4444),
                                    modifier = Modifier.size(21.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = if (isBn) "সেশন সমাপ্ত করুন" else "Terminate Session",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFEF4444)
                                )
                            }
                        }
                    }
                }
            }

            MoreSubScreen.USER_MANAGEMENT -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .testTag("user_management_screen"),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    contentPadding = PaddingValues(bottom = 32.dp)
                ) {
                    item {
                        AdminAccessControlPanel(
                            currentAccount = currentVaultAccount,
                            allAccounts = allVaultAccounts,
                            isBengali = isBn,
                            onAddAccount = onAddVaultAccount,
                            onEditAccount = onEditVaultAccount,
                            onRemoveAccount = onRemoveVaultAccount,
                            onOpenChangeOwnPassword = onOpenChangeOwnPassword
                        )
                    }
                }
            }

            MoreSubScreen.PURCHASE_TRACKER -> {
                PurchaseModuleScreen(
                    products = products,
                    suppliers = suppliers,
                    purchaseTransactions = transactions.filter { it.type == "PURCHASE" },
                    language = language,
                    onBackToMoreMenu = { activeSubScreen = MoreSubScreen.MENU },
                    onCompletePurchase = onRecordMultiItemPurchase,
                    onVoidPurchase = onVoidPurchase
                )
            }

            MoreSubScreen.SUPPLIER_LEDGER -> {
                SupplierModuleScreen(
                    suppliers = suppliers,
                    transactions = transactions,
                    language = language,
                    themeMode = themeMode,
                    onBackToMoreMenu = { activeSubScreen = MoreSubScreen.MENU },
                    onAddSupplier = onAddSupplier,
                    onUpdateSupplier = onUpdateSupplier,
                    onDeleteSupplier = onDeleteSupplier,
                    onPaySupplier = onPaySupplier,
                    onAddSupplierOwed = onAddSupplierOwed
                )
            }

            MoreSubScreen.EXPENSE_TRACKING -> {
                ExpenseTrackingView(
                    expenses = transactions.filter { it.type == "EXPENSE" },
                    onRecordExpense = onRecordExpense
                )
            }

            MoreSubScreen.CASH_BOOK -> {
                CashBookView(
                    transactions = transactions,
                    dailyStats = dailyStats
                )
            }

            MoreSubScreen.BUSINESS_REPORTS -> {
                BusinessReportsView(
                    products = products,
                    transactions = transactions
                )
            }

            MoreSubScreen.DUE_REPORTS -> {
                DueReportsView(
                    customers = customers,
                    transactions = transactions
                )
            }

            MoreSubScreen.STAFF_ROLES -> {
                StaffManagementView(
                    staffList = staffList,
                    isBn = isBn,
                    isAdmin = isAdmin,
                    onBackToMoreMenu = { activeSubScreen = MoreSubScreen.MENU },
                    onAddStaff = onAddStaff,
                    onUpdateStaff = onUpdateStaff,
                    onDeleteStaff = onDeleteStaff,
                    onToggleStaff = onToggleStaff
                )
            }

            MoreSubScreen.AUDIT_LOG -> {
                AuditLogView(auditLogs = auditLogs, isBn = isBn)
            }

            MoreSubScreen.BACKUP_RESTORE -> {
                BackupAndOfflineSyncView(
                    products = products,
                    customers = customers,
                    transactions = transactions,
                    suppliers = suppliers,
                    staffList = staffList,
                    storeName = currentVaultAccount.name,
                    isBn = isBn,
                    onSeedSampleData = onSeedSampleData,
                    onOpenBlueprintGuide = onOpenBlueprintGuide
                )
            }

            MoreSubScreen.RECYCLE_BIN -> {
                RecycleBinView(
                    items = recycleBinItems,
                    isBn = isBn,
                    onRestore = onRestoreRecycleItem,
                    onDeletePermanently = onDeletePermanentlyRecycleItem,
                    onEmptyBin = onEmptyRecycleBin
                )
            }

            MoreSubScreen.TRANSACTION_DELETION -> {
                TransactionDeletionView(
                    transactions = transactions,
                    products = products,
                    customers = customers,
                    suppliers = suppliers,
                    staffList = staffList,
                    isBn = isBn,
                    themeMode = themeMode,
                    onDeleteTransaction = onDeleteTransaction,
                    onDeleteProduct = onDeleteProduct,
                    onDeleteCustomer = onDeleteCustomer,
                    onDeleteSupplier = onDeleteSupplier,
                    onDeleteStaff = onDeleteStaff,
                    deleterName = currentVaultAccount.name,
                    deleterEmail = currentVaultAccount.email,
                    onOpenResetAllDialog = { showResetDialog = true }
                )
            }
        }
    }

    if (showResetDialog) {
        MultiLayerStoreResetDialog(
            isBn = isBn,
            deleterName = currentVaultAccount.name,
            deleterEmail = currentVaultAccount.email,
            productsCount = products.size,
            customersCount = customers.size,
            transactionsCount = transactions.size,
            suppliersCount = suppliers.size,
            staffCount = staffList.size,
            onDismiss = { showResetDialog = false },
            onConfirmResetAll = {
                showResetDialog = false
                onResetAllStoreData {
                    activeSubScreen = MoreSubScreen.MENU
                }
            }
        )
    }

    if (showProfileDialog) {
        fun dialNumber(phone: String) {
            runCatching {
                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            }
        }

        AlertDialog(
            onDismissRequest = { showProfileDialog = false },
            title = {
                Text(
                    text = if (isBn) "স্টোর প্রোফাইল" else "Store Profile",
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    // 1. Store Logo at the Top
                    Surface(
                        shape = RoundedCornerShape(22.dp),
                        border = BorderStroke(2.5.dp, Color(0xFF00A862)),
                        shadowElevation = 4.dp,
                        modifier = Modifier.size(104.dp)
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.ic_siaam_store_logo),
                            contentDescription = if (isBn) "সিয়াম স্টোর লোগো" else "Siaam Store Logo",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    }

                    HorizontalDivider(color = Color(0xFFE2E8F0))

                    // 2. Store Name, Location & Contact Numbers Card
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Color(0xFFF8FAFC),
                        border = BorderStroke(1.dp, Color(0xFFD1FAE5)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            // Store Name
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    text = if (isBn) "দোকানের নাম" else "Store Name",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFF64748B)
                                )
                                Text(
                                    text = if (isBn) "সিয়াম স্টোর" else "Siaam Store",
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color(0xFF0F172A)
                                )
                            }

                            HorizontalDivider(color = Color(0xFFE2E8F0))

                            // Location
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    text = if (isBn) "ঠিকানা" else "Location",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFF64748B)
                                )
                                Text(
                                    text = if (isBn) {
                                        "রামচন্দ্রপুর হাট, চাঁপাইনবাবগঞ্জ"
                                    } else {
                                        "Ramchandrapur Haat, Chapainawabganj"
                                    },
                                    fontSize = 14.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF1E293B)
                                )
                            }

                            HorizontalDivider(color = Color(0xFFE2E8F0))

                            // Contact Numbers (two numbers used inside voucher)
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = if (isBn) "যোগাযোগ নম্বর" else "Contact Numbers",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFF64748B)
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Surface(
                                        onClick = { dialNumber("01740999627") },
                                        shape = RoundedCornerShape(10.dp),
                                        color = Color.White,
                                        border = BorderStroke(1.dp, Color(0xFFC6F0DF)),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(
                                            text = if (isBn) "📞 ০১৭৪০৯৯৯৬২৭" else "📞 01740999627",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF00A862),
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)
                                        )
                                    }
                                    Surface(
                                        onClick = { dialNumber("01303033353") },
                                        shape = RoundedCornerShape(10.dp),
                                        color = Color.White,
                                        border = BorderStroke(1.dp, Color(0xFFC6F0DF)),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(
                                            text = if (isBn) "📞 ০১৩০৩০৩৩৩৫৩" else "📞 01303033353",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF00A862),
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showProfileDialog = false }) {
                    Text(if (isBn) "ঠিক আছে" else "OK")
                }
            }
        )
    }

    if (showAboutDevDialog) {
        // Automatically ensure a fresh random choice each time the dialog opens
        LaunchedEffect(showAboutDevDialog) {
            if (showAboutDevDialog) {
                activeDevPhotoIndex = kotlin.random.Random.nextInt(devPhotos.size)
            }
        }

        val currentVersionText = if (isBn) {
            "সিয়াম স্টোর V${BuildConfig.VERSION_NAME}"
        } else {
            "Siaam Store V${BuildConfig.VERSION_NAME}"
        }
        fun openExternalLink(url: String) {
            runCatching {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            }
        }

        AlertDialog(
            onDismissRequest = { showAboutDevDialog = false },
            title = null,
            text = {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    // 1. Developer Photo at the Top (kept as it is, face centered within the circular frame)
                    Surface(
                        shape = CircleShape,
                        border = BorderStroke(3.dp, Color(0xFF00A862)),
                        shadowElevation = 4.dp,
                        modifier = Modifier
                            .size(124.dp)
                            .clickable {
                                activeDevPhotoIndex = (activeDevPhotoIndex + 1) % devPhotos.size
                            }
                    ) {
                        Image(
                            painter = painterResource(id = devPhotos[activeDevPhotoIndex]),
                            contentDescription = "Abdullahil Kuafi",
                            contentScale = ContentScale.Crop,
                            alignment = BiasAlignment(0f, -0.15f),
                            modifier = Modifier.fillMaxSize()
                        )
                    }

                    // 2. Developer Name & App Version Badge (Compact)
                    Text(
                        text = if (isBn) "আব্দুল্লাহিল কাফি" else "Abdullahil Kuafi",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFF0F172A),
                        textAlign = TextAlign.Center
                    )

                    Surface(
                        shape = RoundedCornerShape(50),
                        color = Color(0xFFE8F8F0),
                        border = BorderStroke(1.dp, Color(0xFFC6F0DF))
                    ) {
                        Text(
                            text = currentVersionText,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF047857),
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 3.dp)
                        )
                    }

                    // 3. Minimal Bio Text
                    Text(
                        text = if (isBn) {
                            "সরকারি তিতুমীর কলেজ, ঢাকা-এর একজন প্রযুক্তি-প্রেমী এবং প্রোডাক্টিভিটি-কেন্দ্রিক অ্যাপ ডেভেলপার।"
                        } else {
                            "A tech enthusiast and productivity-focused app developer from Government Titumir College, Dhaka."
                        },
                        fontSize = 12.5.sp,
                        lineHeight = 17.sp,
                        color = Color(0xFF475569),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )

                    HorizontalDivider(
                        color = Color(0xFFE2E8F0),
                        modifier = Modifier.padding(vertical = 2.dp)
                    )

                    // 4. Compact Contact Buttons (No raw URLs shown; clicking redirects directly)
                    Text(
                        text = if (isBn) "ডেভেলপারের সাথে যোগাযোগ" else "Contact the Developer",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF065F46)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CompactDevContactButton(
                            emoji = "🌐",
                            label = if (isBn) "ফেসবুক" else "Facebook",
                            onClick = { openExternalLink("https://fb.me/themadkafi") },
                            modifier = Modifier.weight(1f)
                        )
                        CompactDevContactButton(
                            emoji = "💬",
                            label = if (isBn) "মেসেঞ্জার" else "Messenger",
                            onClick = { openExternalLink("https://m.me/themadkafi") },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CompactDevContactButton(
                            emoji = "📱",
                            label = if (isBn) "হোয়াটসঅ্যাপ" else "WhatsApp",
                            onClick = { openExternalLink("https://wa.me/8801313209156") },
                            modifier = Modifier.weight(1f)
                        )
                        CompactDevContactButton(
                            emoji = "✉️",
                            label = if (isBn) "ইমেইল" else "Email",
                            onClick = { openExternalLink("mailto:themadkafi@gmail.com") },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showAboutDevDialog = false }) {
                    Text(if (isBn) "ঠিক আছে" else "OK")
                }
            }
        )
    }
}

@Composable
private fun CompactDevContactButton(
    emoji: String,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(11.dp),
        color = Color(0xFFF0FDF8),
        border = BorderStroke(1.1.dp, Color(0xFFB7EBCD)),
        modifier = modifier.height(38.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Text(text = emoji, fontSize = 14.sp)
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = label,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF065F46),
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        fontSize = 14.5.sp,
        fontWeight = FontWeight.Bold,
        color = Color(0xFF00A862),
        modifier = Modifier.padding(start = 4.dp, bottom = 2.dp)
    )
}

@Composable
private fun SingleLinePreferenceOption(
    selected: Boolean,
    onClick: () -> Unit,
    label: String,
    leadingEmoji: String,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = if (selected) Color(0xFFE6F9F1) else Color.White,
        border = BorderStroke(
            width = if (selected) 1.8.dp else 1.1.dp,
            color = if (selected) Color(0xFF00A862) else Color(0xFFCBD5E1)
        ),
        shadowElevation = if (selected) 2.dp else 0.dp,
        modifier = modifier.height(44.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Text(text = leadingEmoji, fontSize = 15.sp)
            Spacer(modifier = Modifier.width(5.dp))
            Text(
                text = label,
                fontSize = 13.sp,
                fontWeight = if (selected) FontWeight.ExtraBold else FontWeight.SemiBold,
                color = if (selected) Color(0xFF065F46) else Color(0xFF334155),
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Ellipsis
            )
            if (selected) {
                Spacer(modifier = Modifier.width(4.dp))
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = "Selected",
                    tint = Color(0xFF00A862),
                    modifier = Modifier.size(14.dp)
                )
            }
        }
    }
}

@Composable
private fun BorderedPreferenceChip(
    selected: Boolean,
    onClick: () -> Unit,
    label: String,
    leadingEmoji: String? = null,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(13.dp),
        color = if (selected) Color(0xFFE8F8F0) else Color.White,
        border = BorderStroke(
            width = if (selected) 1.8.dp else 1.2.dp,
            color = if (selected) Color(0xFF00A862) else Color(0xFFCBD5E1)
        ),
        shadowElevation = if (selected) 1.5.dp else 0.dp,
        modifier = modifier
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (leadingEmoji != null) {
                Text(text = leadingEmoji, fontSize = 17.sp)
            }
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                color = if (selected) Color(0xFF065F46) else Color(0xFF334155)
            )
            if (selected) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = "Selected",
                    tint = Color(0xFF00A862),
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}

@Composable
private fun ToolsMenuRow(
    emoji: String = "",
    leadingContent: (@Composable () -> Unit)? = null,
    title: String,
    subtitle: String,
    badgeText: String? = null,
    isDanger: Boolean = false,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(13.dp))
                    .background(if (isDanger) Color(0xFFFFE4E6) else Color(0xFFE6F9F1))
            ) {
                if (leadingContent != null) {
                    leadingContent()
                } else {
                    Text(
                        text = emoji,
                        fontSize = 20.sp
                    )
                }
            }
            Spacer(modifier = Modifier.width(14.dp))
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = title,
                        fontSize = 16.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isDanger) Color(0xFFDC2626) else Color(0xFF0F172A)
                    )
                    if (badgeText != null) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            shape = CircleShape,
                            color = Color(0xFFDC2626),
                            modifier = Modifier.size(20.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = badgeText,
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = subtitle,
                    fontSize = 13.sp,
                    color = Color(0xFF64748B)
                )
            }
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = Color(0xFF94A3B8)
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecycleBinView(
    items: List<RecycleBinItem>,
    isBn: Boolean,
    onRestore: (RecycleBinItem) -> Unit,
    onDeletePermanently: (String) -> Unit,
    onEmptyBin: () -> Unit
) {
    var showEmptyConfirm by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedTypeFilter by remember { mutableStateOf("ALL") }

    val filterOptions = listOf(
        "ALL" to if (isBn) "সব (${items.size})" else "All (${items.size})",
        "TRANSACTION" to if (isBn) "লেনদেন" else "Transactions",
        "PRODUCT" to if (isBn) "পণ্য" else "Products",
        "CUSTOMER" to if (isBn) "কাস্টমার" else "Customers",
        "SUPPLIER" to if (isBn) "মহাজন" else "Suppliers",
        "EXPENSE" to if (isBn) "খরচ" else "Expenses",
        "STAFF" to if (isBn) "স্টাফ" else "Staff"
    )

    val filteredItems = remember(items, searchQuery, selectedTypeFilter) {
        items.filter { item ->
            val matchesType = when (selectedTypeFilter) {
                "ALL" -> true
                "TRANSACTION" -> item.itemType == "TRANSACTION" || item.itemType == "SALE" || item.itemType == "RECEIVE_PAYMENT" || item.itemType == "GIVE_DUE"
                else -> item.itemType.equals(selectedTypeFilter, ignoreCase = true)
            }
            val matchesSearch = if (searchQuery.isBlank()) {
                true
            } else {
                val q = searchQuery.trim().lowercase()
                item.name.lowercase().contains(q) ||
                    item.details.lowercase().contains(q) ||
                    item.itemType.lowercase().contains(q)
            }
            matchesType && matchesSearch
        }
    }

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFC6F0DF))
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (isBn) "রিসাইকেল বিন (Recycle Bin)" else "Recycle Bin",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF0F172A)
                            )
                            Text(
                                text = if (isBn) "মোট আইটেম: ${items.size} টি • ফিল্টারকৃত: ${filteredItems.size} টি" else "Total items: ${items.size} • Filtered: ${filteredItems.size}",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF64748B)
                            )
                        }
                        if (items.isNotEmpty()) {
                            Button(
                                onClick = { showEmptyConfirm = true },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.DeleteForever, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(if (isBn) "বিন খালি করুন" else "Empty Bin")
                            }
                        }
                    }

                    if (items.isNotEmpty()) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = { Text(if (isBn) "মুছে ফেলা ডাটা খুঁজুন..." else "Search deleted items...") },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Color(0xFF64748B)) },
                            trailingIcon = {
                                if (searchQuery.isNotBlank()) {
                                    IconButton(onClick = { searchQuery = "" }) {
                                        Icon(Icons.Default.Close, contentDescription = "Clear", tint = Color(0xFF64748B))
                                    }
                                }
                            },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            filterOptions.forEach { (key, label) ->
                                BorderedPreferenceChip(
                                    selected = selectedTypeFilter == key,
                                    onClick = { selectedTypeFilter = key },
                                    label = label
                                )
                            }
                        }
                    }
                }
            }
        }

        if (filteredItems.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(text = "🗑️", fontSize = 42.sp)
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = if (items.isEmpty()) {
                                if (isBn) "রিসাইকেল বিন সম্পূর্ণ খালি" else "Recycle Bin is Empty"
                            } else {
                                if (isBn) "এই ফিল্টারে কোনো ডাটা পাওয়া যায়নি" else "No items match this filter"
                            },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (isBn) "কোনো মুছে ফেলা পণ্য, কাস্টমার বা খরচ নেই।" else "No deleted products, customers, or expenses found.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF64748B)
                        )
                    }
                }
            }
        } else {
            items(filteredItems, key = { it.id }) { item ->
                val typeEmoji = when (item.itemType) {
                    "PRODUCT" -> "📦"
                    "CUSTOMER" -> "👥"
                    "SUPPLIER" -> "🚚"
                    "EXPENSE" -> "💸"
                    "STAFF" -> "🧑‍💼"
                    else -> "🧾"
                }
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(0xFFF1F5F9))
                            ) {
                                Text(text = typeEmoji, fontSize = 20.sp)
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = item.name,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF0F172A)
                                )
                                if (item.details.isNotBlank()) {
                                    Text(
                                        text = item.details,
                                        fontSize = 12.5.sp,
                                        color = Color(0xFF64748B)
                                    )
                                }
                                Text(
                                    text = "${item.itemType} • Deleted by ${item.deletedBy}",
                                    fontSize = 11.5.sp,
                                    color = Color(0xFF94A3B8)
                                )
                            }
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedButton(
                                onClick = { onRestore(item) },
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, Color(0xFF00B368)),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Icon(Icons.Default.Restore, contentDescription = null, tint = Color(0xFF00B368), modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(if (isBn) "পুনরুদ্ধার" else "Restore", color = Color(0xFF00B368), fontSize = 13.sp)
                            }
                            IconButton(onClick = { onDeletePermanently(item.id) }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFDC2626))
                            }
                        }
                    }
                }
            }
        }
    }

    if (showEmptyConfirm) {
        AlertDialog(
            onDismissRequest = { showEmptyConfirm = false },
            title = { Text(if (isBn) "রিসাইকেল বিন সম্পূর্ণ খালি করবেন?" else "Empty Recycle Bin?") },
            text = { Text(if (isBn) "বিন খালি করলে সকল মুছে ফেলা আইটেম স্থায়ীভাবে মুছে যাবে এবং আর উদ্ধার করা যাবে না।" else "This will permanently remove all deleted items.") },
            confirmButton = {
                Button(
                    onClick = {
                        showEmptyConfirm = false
                        onEmptyBin()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    Text(if (isBn) "হ্যাঁ, খালি করুন" else "Yes, Empty Bin")
                }
            },
            dismissButton = {
                TextButton(onClick = { showEmptyConfirm = false }) {
                    Text(if (isBn) "বাতিল" else "Cancel")
                }
            }
        )
    }
}

@Composable
private fun BackupAndOfflineSyncView(
    products: List<Product>,
    customers: List<Customer>,
    transactions: List<StoreTransaction>,
    suppliers: List<Supplier>,
    staffList: List<StaffMember>,
    storeName: String,
    isBn: Boolean,
    onSeedSampleData: () -> Unit,
    onOpenBlueprintGuide: () -> Unit
) {
    val context = LocalContext.current
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = BorderStroke(1.dp, Color(0xFFC6F0DF))
        ) {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.AutoMirrored.Filled.FactCheck, contentDescription = null, tint = Color(0xFF00B368))
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        if (isBn) "ক্লাউড ফায়ারস্টোর সিঙ্ক স্ট্যাটাস" else "Cloud Firestore & Sync Status",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A)
                    )
                }
                Text(if (isBn) "• মোট পণ্য: ${products.size} টি" else "• Products Synced: ${products.size}")
                Text(if (isBn) "• মোট কাস্টমার: ${customers.size} জন" else "• Customers Synced: ${customers.size}")
                Text(if (isBn) "• মোট লেনদেন: ${transactions.size} টি" else "• Transactions Synced: ${transactions.size}")
                Text(if (isBn) "• মোট সাপ্লায়ার: ${suppliers.size} জন" else "• Suppliers Synced: ${suppliers.size}")
                Text(if (isBn) "• মোট স্টাফ: ${staffList.size} জন" else "• Staff Members: ${staffList.size}")
                Spacer(modifier = Modifier.height(4.dp))
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFE6F9F1),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = if (isBn) "● লাইভ ফায়ারস্টোর সিঙ্ক সক্রিয়। সমস্ত বিক্রি, বাকি এবং স্টকের হিসাব স্থায়ীভাবে ক্লাউডে সংরক্ষিত।" else "● Live Firestore Sync Active. All store data is safely mirrored in the cloud.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF00A862),
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(12.dp)
                    )
                }

                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFF0F9FF),
                    border = BorderStroke(1.dp, Color(0xFFBAE6FD)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = if (isBn) {
                            "☁️ এই অ্যাপের সকল তথ্য নিরাপদ Google Firebase Firestore ক্লাউড ডেটাবেসে সংরক্ষিত থাকে।"
                        } else {
                            "☁️ All data of this app is securely stored in Google Firebase Firestore cloud database."
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF0369A1),
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }
        }

        Button(
            onClick = {
                val jsonBuilder = StringBuilder()
                jsonBuilder.append("{\n")
                jsonBuilder.append("  \"storeName\": \"${storeName.ifBlank { "Siaam Store" }}\",\n")
                jsonBuilder.append("  \"exportedAt\": \"${System.currentTimeMillis()}\",\n")
                jsonBuilder.append("  \"productsCount\": ${products.size},\n")
                jsonBuilder.append("  \"customersCount\": ${customers.size},\n")
                jsonBuilder.append("  \"transactionsCount\": ${transactions.size},\n")
                jsonBuilder.append("  \"suppliersCount\": ${suppliers.size},\n")
                jsonBuilder.append("  \"products\": [\n")
                products.forEachIndexed { i, p ->
                    jsonBuilder.append("    {\"name\": \"${p.name}\", \"category\": \"${p.category}\", \"stock\": ${p.stock}, \"buyPrice\": ${p.buyPrice}, \"sellPrice\": ${p.sellPrice}}${if (i < products.size - 1) "," else ""}\n")
                }
                jsonBuilder.append("  ],\n")
                jsonBuilder.append("  \"customers\": [\n")
                customers.forEachIndexed { i, c ->
                    jsonBuilder.append("    {\"name\": \"${c.name}\", \"phone\": \"${c.phone}\", \"due\": ${c.totalDue}}${if (i < customers.size - 1) "," else ""}\n")
                }
                jsonBuilder.append("  ]\n")
                jsonBuilder.append("}")

                ExportHelper.shareJsonBackup(
                    context = context,
                    storeName = storeName.ifBlank { "Siaam_Store" },
                    jsonContent = jsonBuilder.toString()
                )
            },
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00B368)),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth().height(50.dp)
        ) {
            Icon(Icons.Default.Share, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(if (isBn) "স্টোরের সম্পূর্ণ ডাটা ব্যাকআপ (JSON এক্সপোর্ট)" else "Export Full Store Backup (JSON)", fontWeight = FontWeight.Bold)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ExpenseTrackingView(
    expenses: List<StoreTransaction>,
    onRecordExpense: (title: String, category: String, amount: Double, notes: String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("দোকান ভাড়া") }
    var amount by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    val categories = listOf("দোকান ভাড়া", "বিদ্যুৎ ও বিল", "স্টাফ বেতন", "পরিবহন", "অন্যান্য")

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFC6F0DF))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("নতুন খরচ লিখুন (Record Expense)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        categories.forEach { cat ->
                            FilterChip(
                                selected = category == cat,
                                onClick = { category = cat },
                                label = { Text(cat) }
                            )
                        }
                    }
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("খরচের বিবরণ *") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = amount,
                            onValueChange = { amount = it },
                            label = { Text("টাকার পরিমাণ (৳) *") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = { Text("নোট") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Button(
                        onClick = {
                            val amt = amount.toDoubleOrNull() ?: 0.0
                            if (title.isNotBlank() && amt > 0) {
                                onRecordExpense(title, category, amt, notes)
                                title = ""
                                amount = ""
                                notes = ""
                            }
                        },
                        enabled = title.isNotBlank() && amount.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00B368)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("খরচ সেভ করুন")
                    }
                }
            }
        }

        items(expenses, key = { it.id }) { exp ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(exp.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text("${exp.category} • ${exp.notes}", style = MaterialTheme.typography.bodySmall)
                    }
                    Text(
                        "- ৳${DokanViewModel.formatMoney(exp.amount)}",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color(0xFFE11D48),
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun CashBookView(
    transactions: List<StoreTransaction>,
    dailyStats: DailyStats
) {
    val netCash = dailyStats.totalCashIn - dailyStats.totalCashOut
    val cashEntries = transactions.filter { it.paidAmount > 0.0 }

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFC6F0DF))
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text("ক্যাশ খাতা • হাতে থাকা নগদ (Net Cash)", style = MaterialTheme.typography.labelLarge, color = Color(0xFF64748B))
                    Text(
                        "৳ ${DokanViewModel.formatMoney(netCash)}",
                        style = MaterialTheme.typography.displayMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = if (netCash >= 0) Color(0xFF00A862) else Color(0xFFE11D48)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("মোট জমা (In): +৳${DokanViewModel.formatMoney(dailyStats.totalCashIn)}", fontWeight = FontWeight.SemiBold, color = Color(0xFF00A862))
                        Text("মোট খরচ (Out): -৳${DokanViewModel.formatMoney(dailyStats.totalCashOut)}", fontWeight = FontWeight.SemiBold, color = Color(0xFFE11D48))
                    }
                }
            }
        }

        items(cashEntries, key = { it.id }) { tx ->
            val isInflow = tx.type == "SALE" || tx.type == "RECEIVE_PAYMENT"
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(tx.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text("${tx.type} • ${tx.category}", style = MaterialTheme.typography.bodySmall)
                    }
                    Text(
                        text = "${if (isInflow) "+" else "-"} ৳${DokanViewModel.formatMoney(tx.paidAmount)}",
                        style = MaterialTheme.typography.titleMedium,
                        color = if (isInflow) Color(0xFF00A862) else Color(0xFFE11D48),
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun BusinessReportsView(
    products: List<Product>,
    transactions: List<StoreTransaction>
) {
    val sales = transactions.filter { it.type == "SALE" }
    val totalRevenue = sales.sumOf { it.amount }
    val totalGrossProfit = sales.sumOf { it.profitAmount }
    val totalExpenses = transactions.filter { it.type == "EXPENSE" }.sumOf { it.amount }
    val netProfit = totalGrossProfit - totalExpenses
    val inventoryBuyValuation = products.sumOf { it.buyPrice * it.stock }
    val inventoryRetailValuation = products.sumOf { it.sellPrice * it.stock }

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFC6F0DF))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("লাভ-ক্ষতির হিসাব (Profit & Loss)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("মোট বিক্রি (Total Sales): ৳ ${DokanViewModel.formatMoney(totalRevenue)}")
                    Text("মোট বিক্রয় লাভ (Gross Profit): ৳ ${DokanViewModel.formatMoney(totalGrossProfit)}")
                    Text("মোট খরচ (Operating Expenses): ৳ ${DokanViewModel.formatMoney(totalExpenses)}")
                    HorizontalDivider()
                    Text(
                        "নিট লাভ (Net Profit): ৳ ${DokanViewModel.formatMoney(netProfit)}",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color(0xFF00A862),
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFC6F0DF))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("স্টকের বর্তমান মূল্যমান (Inventory Valuation)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("মোট পণ্য সংখ্যা: ${products.size} টি")
                    Text("কেনা দামে স্টকের মূল্য: ৳ ${DokanViewModel.formatMoney(inventoryBuyValuation)}")
                    Text("বিক্রয় দামে স্টকের মূল্য: ৳ ${DokanViewModel.formatMoney(inventoryRetailValuation)}")
                }
            }
        }
    }
}

@Composable
private fun DueReportsView(
    customers: List<Customer>,
    transactions: List<StoreTransaction>
) {
    val defaulters = customers.filter { it.totalDue > 0.0 }.sortedByDescending { it.totalDue }
    val totalReceivable = defaulters.sumOf { it.totalDue }
    val totalCollected = transactions.filter { it.type == "RECEIVE_PAYMENT" }.sumOf { it.paidAmount }

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFFECDD3))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "মোট বকেয়া পাওনা: ৳ ${DokanViewModel.formatMoney(totalReceivable)}",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFE11D48)
                    )
                    Text(
                        "বাকি থাকা কাস্টমার: ${defaulters.size} জন • মোট আদায়: ৳ ${DokanViewModel.formatMoney(totalCollected)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF64748B)
                    )
                }
            }
        }

        items(defaulters, key = { it.id }) { cust ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(cust.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text("${cust.phone} • ${cust.address}", style = MaterialTheme.typography.bodySmall)
                    }
                    Text(
                        "৳ ${DokanViewModel.formatMoney(cust.totalDue)}",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color(0xFFE11D48),
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
private fun StaffManagementView(
    staffList: List<StaffMember>,
    isBn: Boolean,
    isAdmin: Boolean,
    onBackToMoreMenu: () -> Unit,
    onAddStaff: (name: String, role: String, phone: String, salary: Double) -> Unit,
    onUpdateStaff: (staff: StaffMember, name: String, role: String, phone: String, salary: Double, active: Boolean) -> Unit,
    onDeleteStaff: (StaffMember) -> Unit,
    onToggleStaff: (StaffMember) -> Unit
) {
    val context = LocalContext.current
    var searchQuery by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf("ALL") }
    var showNewStaffSheet by remember { mutableStateOf(false) }
    var editingStaff by remember { mutableStateOf<StaffMember?>(null) }
    var staffPendingDelete by remember { mutableStateOf<StaffMember?>(null) }

    val filterOptions = listOf(
        "ALL" to if (isBn) "সব স্টাফ" else "All Staff",
        "ACTIVE" to if (isBn) "কর্মরত (Active)" else "Active",
        "INACTIVE" to if (isBn) "নিষ্ক্রিয় (Inactive)" else "Inactive",
        "Manager" to if (isBn) "ম্যানেজার" else "Manager",
        "Cashier" to if (isBn) "ক্যাশিয়ার" else "Cashier",
        "Inventory Clerk" to if (isBn) "ইনভেন্টরি ক্লার্ক" else "Inventory Clerk",
        "Owner" to if (isBn) "মালিক" else "Owner"
    )

    val filteredStaff = remember(staffList, searchQuery, selectedFilter) {
        staffList.filter { s ->
            val matchesFilter = when (selectedFilter) {
                "ALL" -> true
                "ACTIVE" -> s.active
                "INACTIVE" -> !s.active
                "Manager" -> s.role.equals("Manager", ignoreCase = true)
                "Cashier" -> s.role.equals("Cashier", ignoreCase = true)
                "Inventory Clerk" -> s.role.equals("Inventory Clerk", ignoreCase = true)
                "Owner" -> s.role.equals("Owner", ignoreCase = true)
                else -> true
            }
            val matchesQuery = if (searchQuery.isBlank()) {
                true
            } else {
                val q = searchQuery.trim().lowercase()
                s.name.lowercase().contains(q) ||
                    s.phone.lowercase().contains(q) ||
                    s.role.lowercase().contains(q)
            }
            matchesFilter && matchesQuery
        }
    }

    val totalMonthlySalary = remember(staffList) {
        staffList.filter { it.active }.sumOf { it.salary }
    }

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        // 1. Header Row (Alike to Supplier Header): [←] Staff (N) ... [+ New staff]
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
                        border = BorderStroke(1.dp, Color(0xFFC6F0DF)),
                        modifier = Modifier.size(40.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = Color(0xFF0F172A),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column {
                        Text(
                            text = if (isBn) "স্টাফ ও বেতন খাতা (${staffList.size})" else "Staff & Payroll (${staffList.size})",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = if (isBn) "মাসিক সক্রিয় বেতন বাজেট: ৳${totalMonthlySalary.toLong()}" else "Active monthly payroll: ৳${totalMonthlySalary.toLong()}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF00A862)
                        )
                    }
                }

                if (isAdmin) {
                    Button(
                        onClick = { showNewStaffSheet = true },
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF00A862),
                            contentColor = Color.White
                        ),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
                        modifier = Modifier.height(40.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (isBn) "নতুন স্টাফ" else "New staff",
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // 2. Search Field
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = {
                    Text(
                        text = if (isBn) "স্টাফের নাম বা মোবাইল নম্বর দিয়ে খুঁজুন..." else "Search by name or phone...",
                        color = Color(0xFF64748B),
                        fontSize = 14.5.sp
                    )
                },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = null, tint = Color(0xFF64748B))
                },
                trailingIcon = {
                    if (searchQuery.isNotBlank()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear", tint = Color(0xFF64748B))
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                    focusedBorderColor = Color(0xFF00A862),
                    unfocusedBorderColor = Color(0xFFC6F0DF),
                    focusedTextColor = Color(0xFF0F172A),
                    unfocusedTextColor = Color(0xFF0F172A)
                ),
                modifier = Modifier.fillMaxWidth()
            )
        }

        // 3. Filter Chips
        item {
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                filterOptions.forEach { (key, label) ->
                    val isSelected = selectedFilter == key
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedFilter = key },
                        label = {
                            Text(
                                text = label,
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    )
                }
            }
        }

        // 4. Staff List or Empty Card
        if (filteredStaff.isEmpty()) {
            item {
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, Color(0xFFC6F0DF)),
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 36.dp, horizontal = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(text = "👥", fontSize = 36.sp)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = if (isBn) "কোনো স্টাফ পাওয়া যায়নি। নতুন স্টাফ যোগ করতে উপরের বাটনে চাপুন।" else "No staff found. Tap '+ New staff' to add team members.",
                            fontSize = 14.5.sp,
                            color = Color(0xFF64748B),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }
        } else {
            items(filteredStaff, key = { it.id }) { staff ->
                val cleanPhone = staff.phone.trim()
                val roleBg = when (staff.role) {
                    "Manager" -> Color(0xFFEDE9FE)
                    "Cashier" -> Color(0xFFDCFCE7)
                    "Inventory Clerk" -> Color(0xFFE0F2FE)
                    "Owner" -> Color(0xFFFEF3C7)
                    else -> Color(0xFFF1F5F9)
                }
                val roleTextColor = when (staff.role) {
                    "Manager" -> Color(0xFF5B21B6)
                    "Cashier" -> Color(0xFF166534)
                    "Inventory Clerk" -> Color(0xFF0369A1)
                    "Owner" -> Color(0xFF92400E)
                    else -> Color(0xFF475569)
                }

                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, if (staff.active) Color(0xFFC6F0DF) else Color(0xFFE2E8F0)),
                    shadowElevation = 1.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                // Avatar circle
                                Box(
                                    modifier = Modifier
                                        .size(42.dp)
                                        .clip(CircleShape)
                                        .background(roleBg),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = staff.name.firstOrNull()?.uppercase() ?: "S",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 18.sp,
                                        color = roleTextColor
                                    )
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                Column {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = staff.name,
                                            fontSize = 16.5.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = Color(0xFF0F172A)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = roleBg
                                        ) {
                                            Text(
                                                text = staff.role,
                                                fontSize = 11.5.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = roleTextColor,
                                                modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(3.dp))

                                    if (cleanPhone.isNotBlank()) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.clickable {
                                                runCatching {
                                                    val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$cleanPhone"))
                                                    context.startActivity(dialIntent)
                                                }
                                            }
                                        ) {
                                            Text(text = "📞 $cleanPhone", fontSize = 13.sp, color = Color(0xFF0284C7))
                                        }
                                    }
                                }
                            }

                            // Active Switch
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Switch(
                                    checked = staff.active,
                                    onCheckedChange = { onToggleStaff(staff) }
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = Color(0xFFF1F5F9))
                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = if (isBn) "মাসিক বেতন" else "Monthly Salary",
                                    fontSize = 11.5.sp,
                                    color = Color(0xFF64748B)
                                )
                                Text(
                                    text = "৳ ${staff.salary.toLong()}",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF00A862)
                                )
                            }

                            if (isAdmin) {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    // Edit button
                                    OutlinedButton(
                                        onClick = { editingStaff = staff },
                                        shape = RoundedCornerShape(10.dp),
                                        border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                        modifier = Modifier.height(36.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Edit,
                                            contentDescription = "Edit",
                                            tint = Color(0xFF0F172A),
                                            modifier = Modifier.size(15.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = if (isBn) "এডিট" else "Edit",
                                            fontSize = 12.5.sp,
                                            color = Color(0xFF0F172A),
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }

                                    // Delete button
                                    OutlinedButton(
                                        onClick = { staffPendingDelete = staff },
                                        shape = RoundedCornerShape(10.dp),
                                        border = BorderStroke(1.dp, Color(0xFFFCA5A5)),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFDC2626)),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                        modifier = Modifier.height(36.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.DeleteOutline,
                                            contentDescription = "Delete",
                                            tint = Color(0xFFDC2626),
                                            modifier = Modifier.size(15.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = if (isBn) "মুছুন" else "Delete",
                                            fontSize = 12.5.sp,
                                            fontWeight = FontWeight.SemiBold
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

    // Bottom Sheet for Add/Edit Staff (Supplier model UI)
    if (showNewStaffSheet || editingStaff != null) {
        val target = editingStaff
        StaffFormBottomSheet(
            existingStaff = target,
            isBn = isBn,
            onDismiss = {
                showNewStaffSheet = false
                editingStaff = null
            },
            onSave = { name, role, phone, salary, active ->
                if (target == null) {
                    onAddStaff(name, role, phone, salary)
                } else {
                    onUpdateStaff(target, name, role, phone, salary, active)
                }
                showNewStaffSheet = false
                editingStaff = null
            }
        )
    }

    // Prior Warning Confirmation Dialog before Delete
    staffPendingDelete?.let { target ->
        AlertDialog(
            onDismissRequest = { staffPendingDelete = null },
            icon = {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = Color(0xFFDC2626),
                    modifier = Modifier.size(36.dp)
                )
            },
            title = {
                Text(
                    text = if (isBn) "স্টাফ মুছে ফেলার নিশ্চিতকরণ" else "Confirm Staff Deletion",
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = if (isBn) {
                            "সতর্কতা: আপনি কি নিশ্চিত যে স্টাফ '${target.name}' (${target.role})-কে মুছে ফেলতে চান?"
                        } else {
                            "Warning: Are you sure you want to delete staff '${target.name}' (${target.role})?"
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF0F172A)
                    )
                    Text(
                        text = if (isBn) {
                            "রেকর্ডটি সক্রিয় তালিকা থেকে অপসারিত হয়ে রিসাইকেল বিনে চলে যাবে এবং অডিট লগে সংরক্ষণ করা হবে।"
                        } else {
                            "This staff record will be moved to the Recycle Bin and logged into the audit trail."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF64748B)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val toDelete = target
                        staffPendingDelete = null
                        onDeleteStaff(toDelete)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    Text(if (isBn) "হ্যাঁ, মুছে ফেলুন" else "Yes, Delete")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { staffPendingDelete = null }) {
                    Text(if (isBn) "বাতিল" else "Cancel")
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun StaffFormBottomSheet(
    existingStaff: StaffMember?,
    isBn: Boolean,
    onDismiss: () -> Unit,
    onSave: (name: String, role: String, phone: String, salary: Double, active: Boolean) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var name by remember(existingStaff) { mutableStateOf(existingStaff?.name ?: "") }
    var role by remember(existingStaff) { mutableStateOf(existingStaff?.role ?: "Cashier") }
    var phone by remember(existingStaff) { mutableStateOf(existingStaff?.phone ?: "") }
    var salaryText by remember(existingStaff) {
        mutableStateOf(existingStaff?.salary?.let { if (it % 1.0 == 0.0) it.toLong().toString() else it.toString() } ?: "12000")
    }
    var active by remember(existingStaff) { mutableStateOf(existingStaff?.active ?: true) }

    val roles = listOf("Owner", "Manager", "Cashier", "Inventory Clerk")

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
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = if (isBn) {
                    if (existingStaff == null) "+ নতুন স্টাফ যোগ করুন" else "স্টাফ তথ্য পরিবর্তন (Edit Staff)"
                } else {
                    if (existingStaff == null) "+ Add New Staff" else "Edit Staff Details"
                },
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color(0xFF0F172A)
            )

            // Staff Name
            Column {
                Text(
                    text = if (isBn) "স্টাফের পূর্ণ নাম *" else "Full Name *",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF00A862)
                )
                Spacer(modifier = Modifier.height(6.dp))
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    placeholder = { Text(if (isBn) "যেমন: মো: রফিকুল ইসলাম" else "e.g. John Doe") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color(0xFFF8FAFC),
                        focusedBorderColor = Color(0xFF00A862),
                        unfocusedBorderColor = Color(0xFFC6F0DF)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Role selection
            Column {
                Text(
                    text = if (isBn) "দোকানের দায়িত্ব / রোল নির্বাচন করুন *" else "Designation / Role *",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF475569)
                )
                Spacer(modifier = Modifier.height(6.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    roles.forEach { r ->
                        val isSelected = role == r
                        val roleLabel = when (r) {
                            "Manager" -> if (isBn) "ম্যানেজার (Manager)" else "Manager"
                            "Cashier" -> if (isBn) "ক্যাশিয়ার (Cashier)" else "Cashier"
                            "Inventory Clerk" -> if (isBn) "ইনভেন্টরি ক্লার্ক" else "Inventory Clerk"
                            "Owner" -> if (isBn) "মালিক (Owner)" else "Owner"
                            else -> r
                        }
                        FilterChip(
                            selected = isSelected,
                            onClick = { role = r },
                            label = { Text(roleLabel, fontSize = 12.5.sp) }
                        )
                    }
                }
            }

            // Phone
            Column {
                Text(
                    text = if (isBn) "মোবাইল নম্বর *" else "Phone Number *",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF475569)
                )
                Spacer(modifier = Modifier.height(6.dp))
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    placeholder = { Text("017XXXXXXXX") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color(0xFFF8FAFC),
                        focusedBorderColor = Color(0xFF00A862),
                        unfocusedBorderColor = Color(0xFFCBD5E1)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Salary
            Column {
                Text(
                    text = if (isBn) "মাসিক বেতন (৳) *" else "Monthly Salary (৳) *",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF00A862)
                )
                Spacer(modifier = Modifier.height(6.dp))
                OutlinedTextField(
                    value = salaryText,
                    onValueChange = { salaryText = it },
                    placeholder = { Text("12000") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color(0xFFF8FAFC),
                        focusedBorderColor = Color(0xFF00A862),
                        unfocusedBorderColor = Color(0xFFC6F0DF)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Active Switch
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = if (isBn) "কর্মরত অবস্থা (Active Status)" else "Active Status",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF0F172A)
                    )
                    Text(
                        text = if (active) (if (isBn) "স্টাফ বর্তমানে কর্মরত" else "Currently working") else (if (isBn) "ছুটি / নিষ্ক্রিয়" else "On leave / inactive"),
                        fontSize = 12.sp,
                        color = Color(0xFF64748B)
                    )
                }
                Switch(
                    checked = active,
                    onCheckedChange = { active = it }
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Action Buttons
            Button(
                onClick = {
                    val salaryNum = salaryText.toDoubleOrNull() ?: 0.0
                    if (name.isNotBlank() && phone.isNotBlank()) {
                        onSave(name.trim(), role, phone.trim(), salaryNum, active)
                    }
                },
                enabled = name.isNotBlank() && phone.isNotBlank(),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF00A862),
                    contentColor = Color.White
                ),
                modifier = Modifier.fillMaxWidth().height(50.dp)
            ) {
                Text(
                    text = if (isBn) {
                        if (existingStaff == null) "স্টাফ সংরক্ষণ করুন" else "তথ্য আপডেট করুন"
                    } else {
                        if (existingStaff == null) "Save Staff" else "Update Staff"
                    },
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            OutlinedButton(
                onClick = onDismiss,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text(
                    text = if (isBn) "বাতিল" else "Cancel",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF475569)
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AuditLogView(
    auditLogs: List<AuditLog>,
    isBn: Boolean
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedModule by remember { mutableStateOf("ALL") }
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy, hh:mm:ss a", Locale.getDefault()) }

    val moduleOptions = listOf(
        "ALL" to if (isBn) "সব খতিয়ান" else "All Logs",
        "POS" to if (isBn) "বিক্রি ও পিওএস" else "POS & Sales",
        "Customers" to if (isBn) "কাস্টমার ও বাকি" else "Customers & Dues",
        "Inventory" to if (isBn) "পণ্য ও স্টক" else "Inventory & Stock",
        "Accounts" to if (isBn) "খরচ ও মহাজন" else "Accounts & Expenses",
        "Transactions" to if (isBn) "লেনদেন ডিলিট" else "Deleted Transactions",
        "Security" to if (isBn) "লগইন ও এক্সেস" else "Security & Login",
        "System" to if (isBn) "সিস্টেম ও ব্যাকআপ" else "System"
    )

    val filteredLogs = remember(auditLogs, searchQuery, selectedModule) {
        auditLogs.filter { log ->
            val matchesModule = when (selectedModule) {
                "ALL" -> true
                "POS" -> log.module.equals("POS", ignoreCase = true)
                "Customers" -> log.module.equals("Customers", ignoreCase = true)
                "Inventory" -> log.module.equals("Inventory", ignoreCase = true)
                "Accounts" -> log.module.equals("Accounts", ignoreCase = true) || log.module.equals("Suppliers", ignoreCase = true)
                "Transactions" -> log.module.equals("Transactions", ignoreCase = true)
                "Security" -> log.module.equals("Security", ignoreCase = true) || log.module.equals("Settings", ignoreCase = true)
                "System" -> log.module.equals("System", ignoreCase = true) || log.module.equals("RecycleBin", ignoreCase = true)
                else -> log.module.equals(selectedModule, ignoreCase = true)
            }
            val matchesSearch = if (searchQuery.isBlank()) {
                true
            } else {
                val q = searchQuery.trim().lowercase()
                log.action.lowercase().contains(q) ||
                    log.actorName.lowercase().contains(q) ||
                    log.module.lowercase().contains(q)
            }
            matchesModule && matchesSearch
        }
    }

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(10.dp),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        // 1. ACTIVE AUDIT STATUS BANNER
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4)),
                border = BorderStroke(1.dp, Color(0xFFBBF7D0)),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFDCFCE7)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "🛡️", fontSize = 18.sp)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = Color(0xFF16A34A)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.5.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(7.dp)
                                            .clip(CircleShape)
                                            .background(Color.White)
                                    )
                                    Spacer(modifier = Modifier.width(5.dp))
                                    Text(
                                        text = if (isBn) "অডিট লগ সক্রিয়" else "AUDIT LOG ACTIVE",
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.ExtraBold
                                    )
                                }
                            }

                            Text(
                                text = "• 100% Tracking",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF15803D)
                            )
                        }
                        Spacer(modifier = Modifier.height(5.dp))
                        Text(
                            text = if (isBn) {
                                "দোকানের প্রতিটি বিক্রি, বাকি দেওয়া, জমা গ্রহণ, খরচ, মহাজন পরিশোধ, স্টক পরিবর্তন ও আইটেম মুছে ফেলার কার্যক্রম স্বয়ংক্রিয়ভাবে অডিট লগে সংরক্ষিত হচ্ছে।"
                            } else {
                                "Every sale, credit given, payment collected, expense, supplier payment, inventory stock change, and item deletion is actively recorded in real time."
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF14532D),
                            lineHeight = 17.sp
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = if (isBn) "মোট সংরক্ষিত রেকর্ড: ${auditLogs.size} টি" else "Total recorded events: ${auditLogs.size}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF166534)
                        )
                    }
                }
            }
        }

        // 2. SEARCH FIELD
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = {
                    Text(if (isBn) "অ্যাকশন বা ইউজারের নাম দিয়ে খুঁজুন..." else "Search by action or actor...")
                },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = null, tint = Color(0xFF64748B))
                },
                trailingIcon = {
                    if (searchQuery.isNotBlank()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear", tint = Color(0xFF64748B))
                        }
                    }
                },
                shape = RoundedCornerShape(14.dp),
                singleLine = true
            )
        }

        // 3. MODULE FILTER CHIPS
        item {
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                moduleOptions.forEach { (key, label) ->
                    val isSelected = selectedModule == key
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedModule = key },
                        label = {
                            Text(
                                text = label,
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    )
                }
            }
        }

        // 4. SUMMARY ROW
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (isBn) "লগ তালিকা (${filteredLogs.size} টি)" else "Activity Trail (${filteredLogs.size})",
                    style = MaterialTheme.typography.titleSmall,
                    color = Color(0xFF334155),
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // 5. AUDIT LOG ITEMS
        if (filteredLogs.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0))
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = if (isBn) "কোনো অডিট রেকর্ড পাওয়া যায়নি।" else "No audit records match your search.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF64748B)
                        )
                    }
                }
            }
        } else {
            items(filteredLogs, key = { it.id.ifBlank { "${it.actorName}_${it.action}_${it.createdAt?.seconds}" } }) { log ->
                val dateStr = log.createdAt?.toDate()?.let { dateFormat.format(it) } ?: "Just now"

                val (badgeBg, badgeTextColor) = when (log.module) {
                    "POS" -> Color(0xFFDCFCE7) to Color(0xFF166534)
                    "Customers" -> Color(0xFFFEF3C7) to Color(0xFF92400E)
                    "Inventory" -> Color(0xFFE0F2FE) to Color(0xFF0369A1)
                    "Accounts", "Suppliers" -> Color(0xFFEDE9FE) to Color(0xFF5B21B6)
                    "Transactions" -> Color(0xFFFEE2E2) to Color(0xFF991B1B)
                    "Security" -> Color(0xFFE0E7FF) to Color(0xFF3730A3)
                    else -> Color(0xFFF1F5F9) to Color(0xFF475569)
                }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = badgeBg
                            ) {
                                Text(
                                    text = log.module,
                                    style = MaterialTheme.typography.labelMedium,
                                    color = badgeTextColor,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                            Text(
                                text = dateStr,
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF94A3B8)
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = log.action,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF0F172A)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "👤 ${if (isBn) "সম্পাদনকারী:" else "Actor:"} ${log.actorName.ifBlank { "Admin" }}",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF64748B)
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TransactionDeletionView(
    transactions: List<StoreTransaction>,
    products: List<Product> = emptyList(),
    customers: List<Customer> = emptyList(),
    suppliers: List<Supplier> = emptyList(),
    staffList: List<StaffMember> = emptyList(),
    isBn: Boolean,
    themeMode: AppThemeMode,
    onDeleteTransaction: (StoreTransaction) -> Unit,
    onDeleteProduct: (Product) -> Unit = {},
    onDeleteCustomer: (Customer) -> Unit = {},
    onDeleteSupplier: (Supplier) -> Unit = {},
    onDeleteStaff: (StaffMember) -> Unit = {},
    deleterName: String = "Store Admin",
    deleterEmail: String = "",
    onOpenResetAllDialog: () -> Unit = {}
) {
    // Unified Data Type Dropdown Filter covering ALL input data types in the app
    var selectedDataFilter by remember { mutableStateOf("ALL_DATA") }
    var selectedConditionFilter by remember { mutableStateOf("ALL_TIME") }
    var searchQuery by remember { mutableStateOf("") }

    var dataDropdownExpanded by remember { mutableStateOf(false) }
    var conditionDropdownExpanded by remember { mutableStateOf(false) }

    // Confirmation Dialog States
    var transactionPendingDelete by remember { mutableStateOf<StoreTransaction?>(null) }
    var productPendingDelete by remember { mutableStateOf<Product?>(null) }
    var customerPendingDelete by remember { mutableStateOf<Customer?>(null) }
    var supplierPendingDelete by remember { mutableStateOf<Supplier?>(null) }
    var staffPendingDelete by remember { mutableStateOf<StaffMember?>(null) }
    var showBulkDeleteConfirm by remember { mutableStateOf(false) }

    val dateFormat = remember { SimpleDateFormat("d MMM yyyy, hh:mm a", Locale.US) }

    val startOfTodayMillis = remember {
        java.util.Calendar.getInstance().apply {
            set(java.util.Calendar.HOUR_OF_DAY, 0)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }.timeInMillis
    }

    val last7DaysMillis = remember {
        startOfTodayMillis - (7L * 24L * 60L * 60L * 1000L)
    }

    val totalAllCount = transactions.size + products.size + customers.size + suppliers.size + staffList.size
    val saleCount = transactions.count { it.type == "SALE" }
    val giveDueCount = transactions.count { it.type == "GIVE_DUE" }
    val receivePaymentCount = transactions.count { it.type == "RECEIVE_PAYMENT" }
    val purchaseCount = transactions.count { it.type == "PURCHASE" }
    val supplierPaymentCount = transactions.count { it.type == "SUPPLIER_PAYMENT" }
    val expenseCount = transactions.count { it.type == "EXPENSE" }
    val stockAdjustCount = transactions.count { it.type == "STOCK_ADJUST" }

    val dataFilterOptions = listOf(
        Triple("ALL_DATA", "🗂️", if (isBn) "সব ধরনের ইনপুট ডাটা ($totalAllCount)" else "All Input Data ($totalAllCount)"),
        Triple("TX_ALL", "🧾", if (isBn) "সব লেনদেন (${transactions.size})" else "All Transactions (${transactions.size})"),
        Triple("TX_SALE", "🛒", if (isBn) "বিক্রি / POS Sales ($saleCount)" else "POS Sales ($saleCount)"),
        Triple("TX_GIVE_DUE", "📒", if (isBn) "বাকি প্রদান / Gave Credit ($giveDueCount)" else "Gave Credit ($giveDueCount)"),
        Triple("TX_RECEIVE_PAYMENT", "💵", if (isBn) "জমা গ্রহণ / Got Payment ($receivePaymentCount)" else "Got Payment ($receivePaymentCount)"),
        Triple("TX_PURCHASE", "📥", if (isBn) "মাল কেনা ও মহাজন বাকি ($purchaseCount)" else "Stock Purchases ($purchaseCount)"),
        Triple("TX_SUPPLIER_PAYMENT", "🏦", if (isBn) "মহাজন পরিশোধ ($supplierPaymentCount)" else "Supplier Payments ($supplierPaymentCount)"),
        Triple("TX_EXPENSE", "💸", if (isBn) "দোকানের খরচ ($expenseCount)" else "Shop Expenses ($expenseCount)"),
        Triple("TX_STOCK_ADJUST", "⚖️", if (isBn) "স্টক সমন্বয় ও প্রারম্ভিক ক্যাশ ($stockAdjustCount)" else "Stock Adjust & Starting Cash ($stockAdjustCount)"),
        Triple("PRODUCTS", "📦", if (isBn) "পণ্য ও ইনভেন্টরি (${products.size})" else "Products & Inventory (${products.size})"),
        Triple("CUSTOMERS", "👥", if (isBn) "কাস্টমার ও বাকি খাতা (${customers.size})" else "Customers & Due Ledger (${customers.size})"),
        Triple("SUPPLIERS", "🚚", if (isBn) "মহাজন ও ডিলার খাতা (${suppliers.size})" else "Suppliers & Dealers (${suppliers.size})"),
        Triple("STAFF", "🧑‍💼", if (isBn) "স্টাফ ও বেতন খাতা (${staffList.size})" else "Staff & Payroll (${staffList.size})")
    )

    val conditionFilterOptions = listOf(
        Triple("ALL_TIME", "🗓️", if (isBn) "সব সময় ও সকল এন্ট্রি" else "All Time & All Entries"),
        Triple("TODAY", "📅", if (isBn) "শুধু আজকের এন্ট্রি" else "Today's Entries Only"),
        Triple("LAST_7_DAYS", "📆", if (isBn) "গত ৭ দিনের এন্ট্রি" else "Last 7 Days"),
        Triple("HAS_BALANCE", "💰", if (isBn) "বাকি / পাওনা বা স্টক আছে এমন" else "With Due / Balance / Stock Only")
    )

    val includeTransactions = selectedDataFilter == "ALL_DATA" || selectedDataFilter.startsWith("TX_")
    val includeProducts = selectedDataFilter == "ALL_DATA" || selectedDataFilter == "PRODUCTS"
    val includeCustomers = selectedDataFilter == "ALL_DATA" || selectedDataFilter == "CUSTOMERS"
    val includeSuppliers = selectedDataFilter == "ALL_DATA" || selectedDataFilter == "SUPPLIERS"
    val includeStaff = selectedDataFilter == "ALL_DATA" || selectedDataFilter == "STAFF"

    val filteredTransactions = remember(transactions, searchQuery, selectedDataFilter, selectedConditionFilter) {
        if (!includeTransactions) emptyList()
        else transactions.filter { tx ->
            val matchesType = when (selectedDataFilter) {
                "ALL_DATA", "TX_ALL" -> true
                "TX_SALE" -> tx.type == "SALE"
                "TX_GIVE_DUE" -> tx.type == "GIVE_DUE"
                "TX_RECEIVE_PAYMENT" -> tx.type == "RECEIVE_PAYMENT"
                "TX_PURCHASE" -> tx.type == "PURCHASE"
                "TX_SUPPLIER_PAYMENT" -> tx.type == "SUPPLIER_PAYMENT"
                "TX_EXPENSE" -> tx.type == "EXPENSE"
                "TX_STOCK_ADJUST" -> tx.type == "STOCK_ADJUST"
                else -> false
            }
            val createdMillis = tx.createdAt?.toDate()?.time ?: 0L
            val matchesCondition = when (selectedConditionFilter) {
                "TODAY" -> createdMillis >= startOfTodayMillis
                "LAST_7_DAYS" -> createdMillis >= last7DaysMillis
                "HAS_BALANCE" -> tx.dueAmount > 0.0 || tx.amount > 0.0
                else -> true
            }
            val matchesSearch = if (searchQuery.isBlank()) {
                true
            } else {
                val q = searchQuery.trim().lowercase()
                tx.title.lowercase().contains(q) ||
                    tx.customerName.lowercase().contains(q) ||
                    tx.supplierName.lowercase().contains(q) ||
                    tx.category.lowercase().contains(q) ||
                    tx.notes.lowercase().contains(q) ||
                    tx.type.lowercase().contains(q)
            }
            matchesType && matchesCondition && matchesSearch
        }
    }

    val filteredProducts = remember(products, searchQuery, selectedDataFilter, selectedConditionFilter) {
        if (!includeProducts) emptyList()
        else products.filter { p ->
            val createdMillis = p.createdAt?.toDate()?.time ?: 0L
            val matchesCondition = when (selectedConditionFilter) {
                "TODAY" -> createdMillis >= startOfTodayMillis
                "LAST_7_DAYS" -> createdMillis >= last7DaysMillis
                "HAS_BALANCE" -> p.stock > 0.0
                else -> true
            }
            val matchesSearch = if (searchQuery.isBlank()) true
            else {
                val q = searchQuery.trim().lowercase()
                p.name.lowercase().contains(q) || p.category.lowercase().contains(q) || p.barcode.lowercase().contains(q)
            }
            matchesCondition && matchesSearch
        }
    }

    val filteredCustomers = remember(customers, searchQuery, selectedDataFilter, selectedConditionFilter) {
        if (!includeCustomers) emptyList()
        else customers.filter { c ->
            val createdMillis = c.createdAt?.toDate()?.time ?: 0L
            val matchesCondition = when (selectedConditionFilter) {
                "TODAY" -> createdMillis >= startOfTodayMillis
                "LAST_7_DAYS" -> createdMillis >= last7DaysMillis
                "HAS_BALANCE" -> c.totalDue > 0.0
                else -> true
            }
            val matchesSearch = if (searchQuery.isBlank()) true
            else {
                val q = searchQuery.trim().lowercase()
                c.name.lowercase().contains(q) || c.phone.lowercase().contains(q) || c.address.lowercase().contains(q)
            }
            matchesCondition && matchesSearch
        }
    }

    val filteredSuppliers = remember(suppliers, searchQuery, selectedDataFilter, selectedConditionFilter) {
        if (!includeSuppliers) emptyList()
        else suppliers.filter { s ->
            val createdMillis = s.createdAt?.toDate()?.time ?: 0L
            val matchesCondition = when (selectedConditionFilter) {
                "TODAY" -> createdMillis >= startOfTodayMillis
                "LAST_7_DAYS" -> createdMillis >= last7DaysMillis
                "HAS_BALANCE" -> s.payableBalance > 0.0
                else -> true
            }
            val matchesSearch = if (searchQuery.isBlank()) true
            else {
                val q = searchQuery.trim().lowercase()
                s.name.lowercase().contains(q) || s.phone.lowercase().contains(q) || s.company.lowercase().contains(q)
            }
            matchesCondition && matchesSearch
        }
    }

    val filteredStaff = remember(staffList, searchQuery, selectedDataFilter, selectedConditionFilter) {
        if (!includeStaff) emptyList()
        else staffList.filter { st ->
            val createdMillis = st.createdAt?.toDate()?.time ?: 0L
            val matchesCondition = when (selectedConditionFilter) {
                "TODAY" -> createdMillis >= startOfTodayMillis
                "LAST_7_DAYS" -> createdMillis >= last7DaysMillis
                "HAS_BALANCE" -> st.salary > 0.0
                else -> true
            }
            val matchesSearch = if (searchQuery.isBlank()) true
            else {
                val q = searchQuery.trim().lowercase()
                st.name.lowercase().contains(q) || st.phone.lowercase().contains(q) || st.role.lowercase().contains(q)
            }
            matchesCondition && matchesSearch
        }
    }

    val currentFilteredCount = filteredTransactions.size +
        filteredProducts.size +
        filteredCustomers.size +
        filteredSuppliers.size +
        filteredStaff.size

    val selectedDataOption = dataFilterOptions.firstOrNull { it.first == selectedDataFilter } ?: dataFilterOptions.first()
    val selectedConditionOption = conditionFilterOptions.firstOrNull { it.first == selectedConditionFilter } ?: conditionFilterOptions.first()

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 36.dp)
    ) {
        // 1. QUICK RESET ALL DATA & SAFETY GUARD CARD
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2)),
                border = BorderStroke(1.2.dp, Color(0xFFFECACA))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = null,
                                tint = Color(0xFFDC2626),
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = if (isBn) "অ্যাডমিন ডাটা রিমুভাল ও রিসেট সেন্টার" else "Admin Data Removal & Reset Center",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = Color(0xFF991B1B)
                                )
                                Text(
                                    text = if (isBn) "সব মুছে ফেলা ডাটা নিরাপদে রিসাইকেল বিনে জমা থাকে" else "All deleted records are safely routed to Recycle Bin",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF7F1D1D)
                                )
                            }
                        }
                        Button(
                            onClick = onOpenResetAllDialog,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Icon(Icons.Default.DeleteForever, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = if (isBn) "সব ডাটা রিসেট" else "Reset All Data",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        // 2. COMPACT & BEAUTIFUL DROPDOWN FILTER MENU + SEARCH
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.2.dp, Color(0xFFC6F0DF))
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = if (isBn) "ফিল্টার ডাটা রিসেট (ড্রপডাউন থেকে ডাটার ধরন ও সময় নির্বাচন করুন)" else "Filter Data Reset (Select Input Data Type & Time)",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A)
                    )

                    // Compact 2-Dropdown Row (or stacked cleanly for readability)
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        // DROPDOWN 1: Input Data Type Selector
                        Box(modifier = Modifier.fillMaxWidth()) {
                            Surface(
                                onClick = { dataDropdownExpanded = true },
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFFF0FDF8),
                                border = BorderStroke(1.4.dp, Color(0xFF00A862)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(text = selectedDataOption.second, fontSize = 18.sp)
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Column {
                                            Text(
                                                text = if (isBn) "ইনপুট ডাটার ধরন (Input Data Type)" else "Input Data Type",
                                                fontSize = 11.sp,
                                                color = Color(0xFF047857),
                                                fontWeight = FontWeight.SemiBold
                                            )
                                            Text(
                                                text = selectedDataOption.third,
                                                fontSize = 13.5.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF0F172A),
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }
                                    Icon(
                                        imageVector = Icons.Default.ArrowDropDown,
                                        contentDescription = "Select Data Type",
                                        tint = Color(0xFF047857),
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                            }

                            DropdownMenu(
                                expanded = dataDropdownExpanded,
                                onDismissRequest = { dataDropdownExpanded = false },
                                modifier = Modifier
                                    .fillMaxWidth(0.88f)
                                    .background(Color.White)
                            ) {
                                dataFilterOptions.forEach { (key, emoji, label) ->
                                    val isSelected = selectedDataFilter == key
                                    DropdownMenuItem(
                                        text = {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                Text(text = emoji, fontSize = 16.sp)
                                                Text(
                                                    text = label,
                                                    fontSize = 13.5.sp,
                                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                                    color = if (isSelected) Color(0xFF047857) else Color(0xFF0F172A)
                                                )
                                            }
                                        },
                                        trailingIcon = {
                                            if (isSelected) {
                                                Icon(
                                                    imageVector = Icons.Default.Check,
                                                    contentDescription = null,
                                                    tint = Color(0xFF00A862),
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }
                                        },
                                        onClick = {
                                            selectedDataFilter = key
                                            dataDropdownExpanded = false
                                        }
                                    )
                                }
                            }
                        }

                        // DROPDOWN 2: Time & Condition Filter Selector
                        Box(modifier = Modifier.fillMaxWidth()) {
                            Surface(
                                onClick = { conditionDropdownExpanded = true },
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFFF8FAFC),
                                border = BorderStroke(1.2.dp, Color(0xFFCBD5E1)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(text = selectedConditionOption.second, fontSize = 18.sp)
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Column {
                                            Text(
                                                text = if (isBn) "সময় ও শর্ত ফিল্টার (Time & Condition)" else "Time & Condition Filter",
                                                fontSize = 11.sp,
                                                color = Color(0xFF475569),
                                                fontWeight = FontWeight.SemiBold
                                            )
                                            Text(
                                                text = selectedConditionOption.third,
                                                fontSize = 13.5.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF0F172A),
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }
                                    Icon(
                                        imageVector = Icons.Default.ArrowDropDown,
                                        contentDescription = "Select Time Filter",
                                        tint = Color(0xFF475569),
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                            }

                            DropdownMenu(
                                expanded = conditionDropdownExpanded,
                                onDismissRequest = { conditionDropdownExpanded = false },
                                modifier = Modifier
                                    .fillMaxWidth(0.88f)
                                    .background(Color.White)
                            ) {
                                conditionFilterOptions.forEach { (key, emoji, label) ->
                                    val isSelected = selectedConditionFilter == key
                                    DropdownMenuItem(
                                        text = {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                Text(text = emoji, fontSize = 16.sp)
                                                Text(
                                                    text = label,
                                                    fontSize = 13.5.sp,
                                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                                    color = if (isSelected) Color(0xFF047857) else Color(0xFF0F172A)
                                                )
                                            }
                                        },
                                        trailingIcon = {
                                            if (isSelected) {
                                                Icon(
                                                    imageVector = Icons.Default.Check,
                                                    contentDescription = null,
                                                    tint = Color(0xFF00A862),
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }
                                        },
                                        onClick = {
                                            selectedConditionFilter = key
                                            conditionDropdownExpanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }

                    // Search Field inside the same compact filter card
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = {
                            Text(
                                if (isBn) "নাম, মোবাইল নম্বর বা বিবরণ লিখে খুঁজুন..."
                                else "Search by name, phone, title or note..."
                            )
                        },
                        leadingIcon = {
                            Icon(Icons.Default.Search, contentDescription = null, tint = Color(0xFF64748B))
                        },
                        trailingIcon = {
                            if (searchQuery.isNotBlank()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(Icons.Default.Close, contentDescription = "Clear", tint = Color(0xFF64748B))
                                }
                            }
                        },
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )
                }
            }
        }

        // 3. FILTERED COUNT & BULK DELETE ACTION BAR
        item {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = Color.White,
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isBn) "ফিল্টারকৃত ফলাফল: $currentFilteredCount টি" else "Filtered items: $currentFilteredCount",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF0F172A),
                        fontWeight = FontWeight.Bold
                    )

                    if (currentFilteredCount > 0) {
                        OutlinedButton(
                            onClick = {
                                if (selectedDataFilter == "ALL_DATA" &&
                                    selectedConditionFilter == "ALL_TIME" &&
                                    searchQuery.isBlank()
                                ) {
                                    onOpenResetAllDialog()
                                } else {
                                    showBulkDeleteConfirm = true
                                }
                            },
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.2.dp, Color(0xFFDC2626)),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFDC2626)),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(Icons.Default.DeleteForever, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (isBn) "ফিল্টারকৃত সব মুছুন ($currentFilteredCount)" else "Delete All Filtered ($currentFilteredCount)",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        // 4. UNIFIED / FILTERED ITEM LIST ACROSS ALL INPUT DATA TYPES
        if (currentFilteredCount == 0) {
            item {
                EmptyDeletionFilterCard(isBn = isBn)
            }
        } else {
            // 4A. TRANSACTIONS (Sales, Give Due, Receive Payment, Purchases, Supplier Payments, Expenses, Stock Adjust / Starting Cash)
            if (filteredTransactions.isNotEmpty()) {
                items(filteredTransactions, key = { "tx_${it.id}" }) { tx ->
                    val dateStr = tx.createdAt?.toDate()?.let { dateFormat.format(it) } ?: "Just now"
                    val isPayment = tx.type == "RECEIVE_PAYMENT"
                    val isDue = tx.type == "GIVE_DUE"
                    val isExpense = tx.type == "EXPENSE"

                    val badgeText = when (tx.type) {
                        "RECEIVE_PAYMENT" -> if (isBn) "জমা গ্রহণ (Got payment)" else "Got payment"
                        "GIVE_DUE" -> if (isBn) "বাকি প্রদান (Gave credit)" else "Gave credit"
                        "SALE" -> if (isBn) "বিক্রি (Sale)" else "Sale"
                        "PURCHASE" -> if (isBn) "মাল কেনা / মহাজন বাকি (Purchase)" else "Stock Purchase"
                        "EXPENSE" -> if (isBn) "দোকানের খরচ (Expense)" else "Expense"
                        "SUPPLIER_PAYMENT" -> if (isBn) "মহাজন পরিশোধ" else "Supplier payment"
                        "STOCK_ADJUST" -> if (tx.category == "STARTING_CASH") {
                            if (isBn) "প্রারম্ভিক ক্যাশ (Starting Cash)" else "Starting Cash"
                        } else {
                            if (isBn) "স্টক সমন্বয় (Stock Adjust)" else "Stock Adjust"
                        }
                        else -> tx.type
                    }

                    val badgeBg = when (tx.type) {
                        "RECEIVE_PAYMENT" -> Color(0xFFDCFCE7)
                        "GIVE_DUE" -> Color(0xFFFEF3C7)
                        "SALE" -> Color(0xFFE0F2FE)
                        "PURCHASE" -> Color(0xFFFEF9C3)
                        "EXPENSE" -> Color(0xFFFEE2E2)
                        "SUPPLIER_PAYMENT" -> Color(0xFFEDE9FE)
                        "STOCK_ADJUST" -> Color(0xFFE0E7FF)
                        else -> Color(0xFFF1F5F9)
                    }

                    val badgeTextColor = when (tx.type) {
                        "RECEIVE_PAYMENT" -> Color(0xFF166534)
                        "GIVE_DUE" -> Color(0xFF92400E)
                        "SALE" -> Color(0xFF0369A1)
                        "PURCHASE" -> Color(0xFF854D0E)
                        "EXPENSE" -> Color(0xFF991B1B)
                        "SUPPLIER_PAYMENT" -> Color(0xFF5B21B6)
                        "STOCK_ADJUST" -> Color(0xFF3730A3)
                        else -> Color(0xFF475569)
                    }

                    val cleanTxNote = tx.notes
                        .substringAfter("||NOTE:", tx.notes)
                        .takeIf { !it.startsWith("ITEMS:") }
                        ?.trim()
                        .orEmpty()

                    val customerOrSupplier = when {
                        tx.customerName.isNotBlank() -> tx.customerName
                        tx.supplierName.isNotBlank() -> tx.supplierName
                        tx.notes.contains("Supplier:") -> tx.notes.substringAfter("Supplier:").substringBefore(";").trim()
                        else -> tx.title
                    }

                    val impactHint = when (tx.type) {
                        "RECEIVE_PAYMENT" -> if (isBn) "মুছলে কাস্টমারের বাকি ৳${tx.amount.toLong()} বেড়ে যাবে" else "Will restore ৳${tx.amount.toLong()} to customer due"
                        "GIVE_DUE" -> if (isBn) "মুছলে কাস্টমারের বাকি ৳${tx.amount.toLong()} কমে যাবে" else "Will reduce ৳${tx.amount.toLong()} from customer due"
                        "SALE" -> if (tx.dueAmount > 0) {
                            if (isBn) "মুছলে বাকির ৳${tx.dueAmount.toLong()} হ্রাস পাবে" else "Will deduct ৳${tx.dueAmount.toLong()} due"
                        } else {
                            if (isBn) "বিক্রির ক্যাশ খাতা থেকে বাদ যাবে" else "Removes sale from cashbook"
                        }
                        "PURCHASE" -> if (tx.dueAmount > 0) {
                            if (isBn) "মুছলে মহাজনের পাওনা ৳${tx.dueAmount.toLong()} কমে যাবে" else "Will deduct ৳${tx.dueAmount.toLong()} from supplier payable"
                        } else {
                            if (isBn) "মাল কেনার রেকর্ড মুছে রিসাইকেল বিনে যাবে" else "Moves purchase record to Recycle Bin"
                        }
                        "EXPENSE" -> if (isBn) "খরচটি ক্যাশ খাতা থেকে মুছে যাবে" else "Removes expense from cashbook"
                        "SUPPLIER_PAYMENT" -> if (isBn) "মুছলে মহাজনের দেনা ৳${tx.amount.toLong()} বেড়ে যাবে" else "Will restore ৳${tx.amount.toLong()} to supplier payable"
                        "STOCK_ADJUST" -> if (isBn) "স্টক/ক্যাশ সমন্বয় রেকর্ড মুছে যাবে" else "Removes stock/cash adjustment"
                        else -> if (isBn) "ডাটা রিসাইকেল বিনে চলে যাবে" else "Moves to recycle bin"
                    }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = badgeBg
                                ) {
                                    Text(
                                        text = badgeText,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = badgeTextColor,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                                Text(
                                    text = dateStr,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF94A3B8)
                                )
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = customerOrSupplier,
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF0F172A)
                                    )
                                    if (cleanTxNote.isNotBlank()) {
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = cleanTxNote,
                                            fontSize = 12.5.sp,
                                            color = Color(0xFF64748B)
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.width(8.dp))

                                Text(
                                    text = when {
                                        isPayment -> "- ৳ ${tx.amount.toLong()}"
                                        isDue -> "+ ৳ ${tx.amount.toLong()}"
                                        isExpense -> "- ৳ ${tx.amount.toLong()}"
                                        else -> "৳ ${tx.amount.toLong()}"
                                    },
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = when {
                                        isPayment -> Color(0xFF00A862)
                                        isDue -> Color(0xFFEA580C)
                                        isExpense -> Color(0xFFDC2626)
                                        else -> Color(0xFF0F172A)
                                    }
                                )
                            }

                            Spacer(modifier = Modifier.height(8.dp))
                            HorizontalDivider(color = Color(0xFFF1F5F9))
                            Spacer(modifier = Modifier.height(8.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    modifier = Modifier.weight(1f),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "ℹ️ $impactHint",
                                        fontSize = 12.sp,
                                        color = Color(0xFF475569)
                                    )
                                }

                                Button(
                                    onClick = { transactionPendingDelete = tx },
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                    modifier = Modifier.height(34.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.DeleteOutline,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = if (isBn) "মুছুন" else "Delete",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 4B. PRODUCTS
            if (filteredProducts.isNotEmpty()) {
                items(filteredProducts, key = { "prod_${it.id}" }) { product ->
                    SimpleDeletionRowCard(
                        emoji = "📦",
                        title = product.name,
                        subtitle = "${product.category} • Stock: ${product.stock.toInt()} ${product.unit} • Sell: ৳${product.sellPrice.toLong()}",
                        isBn = isBn,
                        onDeleteClick = { productPendingDelete = product }
                    )
                }
            }

            // 4C. CUSTOMERS
            if (filteredCustomers.isNotEmpty()) {
                items(filteredCustomers, key = { "cust_${it.id}" }) { customer ->
                    SimpleDeletionRowCard(
                        emoji = "👥",
                        title = customer.name,
                        subtitle = "${customer.phone} • ${if (isBn) "বাকি:" else "Due:"} ৳${customer.totalDue.toLong()}",
                        isBn = isBn,
                        onDeleteClick = { customerPendingDelete = customer }
                    )
                }
            }

            // 4D. SUPPLIERS
            if (filteredSuppliers.isNotEmpty()) {
                items(filteredSuppliers, key = { "sup_${it.id}" }) { supplier ->
                    SimpleDeletionRowCard(
                        emoji = "🚚",
                        title = supplier.name,
                        subtitle = "${supplier.company.ifBlank { supplier.phone }} • ${if (isBn) "পাওনা:" else "Payable:"} ৳${supplier.payableBalance.toLong()}",
                        isBn = isBn,
                        onDeleteClick = { supplierPendingDelete = supplier }
                    )
                }
            }

            // 4E. STAFF
            if (filteredStaff.isNotEmpty()) {
                items(filteredStaff, key = { "staff_${it.id}" }) { staff ->
                    SimpleDeletionRowCard(
                        emoji = "🧑‍💼",
                        title = staff.name,
                        subtitle = "${staff.role} • ${staff.phone} • ৳${staff.salary.toLong()}/mo",
                        isBn = isBn,
                        onDeleteClick = { staffPendingDelete = staff }
                    )
                }
            }
        }
    }

    // SINGLE TRANSACTION DELETE CONFIRMATION
    transactionPendingDelete?.let { pendingTx ->
        val isPayment = pendingTx.type == "RECEIVE_PAYMENT"
        val isDue = pendingTx.type == "GIVE_DUE"
        val isExpense = pendingTx.type == "EXPENSE"
        val isSupplier = pendingTx.type == "SUPPLIER_PAYMENT"
        val isPurchase = pendingTx.type == "PURCHASE"
        val txAmt = if (isPayment) pendingTx.amount else (if (pendingTx.dueAmount > 0.0) pendingTx.dueAmount else pendingTx.amount)

        AlertDialog(
            onDismissRequest = { transactionPendingDelete = null },
            icon = {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = Color(0xFFDC2626),
                    modifier = Modifier.size(36.dp)
                )
            },
            title = {
                Text(
                    text = if (isBn) "লেনদেনটি মুছে ফেলার নিশ্চিতকরণ" else "Confirm Transaction Deletion",
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = if (isBn) {
                            when {
                                isPayment -> "সতর্কতা: '${pendingTx.customerName.ifBlank { pendingTx.title }}'-এর জমা বাবদ ৳ ${txAmt.toLong()} মুছে ফেললে কাস্টমারের বাকির পরিমাণ ৳ ${txAmt.toLong()} বৃদ্ধি পাবে।"
                                isDue -> "সতর্কতা: '${pendingTx.customerName.ifBlank { pendingTx.title }}'-কে দেওয়া বাকি বাবদ ৳ ${txAmt.toLong()} মুছে ফেললে কাস্টমারের বাকির পরিমাণ ৳ ${txAmt.toLong()} হ্রাস পাবে।"
                                isPurchase -> "সতর্কতা: '${pendingTx.title}' মাল কেনার রেকর্ড মুছে ফেললে মহাজনের হিসাব সমন্বয় হবে।"
                                isExpense -> "সতর্কতা: '${pendingTx.title}' খরচ বাবদ ৳ ${txAmt.toLong()} মুছে ফেলা হবে এবং ক্যাশ খাতা সমন্বয় হবে।"
                                isSupplier -> "সতর্কতা: মহাজনকে দেওয়া পরিশোধ বাবদ ৳ ${txAmt.toLong()} মুছে ফেললে মহাজনের দেনা বৃদ্ধি পাবে।"
                                else -> "সতর্কতা: '${pendingTx.title}' লেনদেনটি মুছে ফেলা হবে।"
                            }
                        } else {
                            when {
                                isPayment -> "Warning: Deleting 'Got payment' (৳ ${txAmt.toLong()}) will restore ৳ ${txAmt.toLong()} to customer due."
                                isDue -> "Warning: Deleting 'Gave credit' (৳ ${txAmt.toLong()}) will deduct ৳ ${txAmt.toLong()} from customer due."
                                isPurchase -> "Warning: Deleting purchase '${pendingTx.title}' will adjust supplier payable balance."
                                isExpense -> "Warning: Deleting '${pendingTx.title}' (৳ ${txAmt.toLong()}) will remove it from shop expenses."
                                isSupplier -> "Warning: Deleting supplier payment (৳ ${txAmt.toLong()}) will restore payable balance."
                                else -> "Warning: '${pendingTx.title}' will be removed."
                            }
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF0F172A)
                    )
                    Text(
                        text = if (isBn) {
                            "রেকর্ডটি সক্রিয় হিসাব থেকে অপসারিত হয়ে রিসাইকেল বিনে চলে যাবে এবং অডিট ট্রেইলে সংরক্ষণ করা হবে।"
                        } else {
                            "This record will be moved to the Recycle Bin and an audit log entry will be created."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF64748B)
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
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    Text(if (isBn) "হ্যাঁ, মুছে ফেলুন" else "Yes, Delete")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { transactionPendingDelete = null }) {
                    Text(if (isBn) "বাতিল" else "Cancel")
                }
            }
        )
    }

    // PRODUCT DELETE WARNING DIALOG
    productPendingDelete?.let { prod ->
        PriorWarningDeleteDialog(
            title = if (isBn) "পণ্য মুছে ফেলার সতর্কবার্তা" else "Confirm Product Deletion",
            message = if (isBn) "সতর্কতা: আপনি কি নিশ্চিত যে '${prod.name}' পণ্যটি মুছে ফেলতে চান? এটি রিসাইকেল বিনে চলে যাবে।" else "Warning: Are you sure you want to delete product '${prod.name}'? It will be moved to the Recycle Bin.",
            isBn = isBn,
            onConfirm = {
                productPendingDelete = null
                onDeleteProduct(prod)
            },
            onDismiss = { productPendingDelete = null }
        )
    }

    // CUSTOMER DELETE WARNING DIALOG
    customerPendingDelete?.let { cust ->
        PriorWarningDeleteDialog(
            title = if (isBn) "কাস্টমার মুছে ফেলার সতর্কবার্তা" else "Confirm Customer Deletion",
            message = if (isBn) "সতর্কতা: '${cust.name}' (বাকি: ৳${cust.totalDue.toLong()}) কাস্টমারকে মুছে ফেলতে চান? এটি রিসাইকেল বিনে চলে যাবে।" else "Warning: Delete customer '${cust.name}' (Due: ৳${cust.totalDue.toLong()})? It will be moved to the Recycle Bin.",
            isBn = isBn,
            onConfirm = {
                customerPendingDelete = null
                onDeleteCustomer(cust)
            },
            onDismiss = { customerPendingDelete = null }
        )
    }

    // SUPPLIER DELETE WARNING DIALOG
    supplierPendingDelete?.let { sup ->
        PriorWarningDeleteDialog(
            title = if (isBn) "মহাজন মুছে ফেলার সতর্কবার্তা" else "Confirm Supplier Deletion",
            message = if (isBn) "সতর্কতা: '${sup.name}' মহাজনকে মুছে ফেলতে চান? এটি রিসাইকেল বিনে চলে যাবে।" else "Warning: Delete supplier '${sup.name}'? It will be moved to the Recycle Bin.",
            isBn = isBn,
            onConfirm = {
                supplierPendingDelete = null
                onDeleteSupplier(sup)
            },
            onDismiss = { supplierPendingDelete = null }
        )
    }

    // STAFF DELETE WARNING DIALOG
    staffPendingDelete?.let { st ->
        PriorWarningDeleteDialog(
            title = if (isBn) "স্টাফ মুছে ফেলার সতর্কবার্তা" else "Confirm Staff Deletion",
            message = if (isBn) "সতর্কতা: '${st.name}' (${st.role}) স্টাফকে মুছে ফেলতে চান? এটি রিসাইকেল বিনে চলে যাবে।" else "Warning: Delete staff member '${st.name}' (${st.role})? It will be moved to the Recycle Bin.",
            isBn = isBn,
            onConfirm = {
                staffPendingDelete = null
                onDeleteStaff(st)
            },
            onDismiss = { staffPendingDelete = null }
        )
    }

    // BULK DELETE / FILTER DATA RESET 4-LAYER WARNING DIALOG (deletes all currently filtered items across whichever input data types match)
    if (showBulkDeleteConfirm) {
        MultiLayerStoreResetDialog(
            isBn = isBn,
            deleterName = deleterName,
            deleterEmail = deleterEmail,
            productsCount = filteredProducts.size,
            customersCount = filteredCustomers.size,
            transactionsCount = filteredTransactions.size,
            suppliersCount = filteredSuppliers.size,
            staffCount = filteredStaff.size,
            onDismiss = { showBulkDeleteConfirm = false },
            onConfirmResetAll = {
                showBulkDeleteConfirm = false
                filteredTransactions.toList().forEach { onDeleteTransaction(it) }
                filteredProducts.toList().forEach { onDeleteProduct(it) }
                filteredCustomers.toList().forEach { onDeleteCustomer(it) }
                filteredSuppliers.toList().forEach { onDeleteSupplier(it) }
                filteredStaff.toList().forEach { onDeleteStaff(it) }
            }
        )
    }
}

@Composable
private fun EmptyDeletionFilterCard(isBn: Boolean) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFE2E8F0))
    ) {
        Text(
            text = if (isBn) "এই ফিল্টারে মুছে ফেলার মতো কোনো ডাটা পাওয়া যায়নি।" else "No records match your current filter.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF64748B),
            modifier = Modifier.padding(20.dp)
        )
    }
}

@Composable
private fun SimpleDeletionRowCard(
    emoji: String,
    title: String,
    subtitle: String,
    isBn: Boolean,
    onDeleteClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(42.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFF1F5F9))
                ) {
                    Text(text = emoji, fontSize = 20.sp)
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = title,
                        fontSize = 15.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A)
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = subtitle,
                        fontSize = 12.5.sp,
                        color = Color(0xFF64748B)
                    )
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Button(
                onClick = onDeleteClick,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                modifier = Modifier.height(34.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.DeleteOutline,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = if (isBn) "মুছুন" else "Delete",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun PriorWarningDeleteDialog(
    title: String,
    message: String,
    isBn: Boolean,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = Color(0xFFDC2626),
                modifier = Modifier.size(36.dp)
            )
        },
        title = {
            Text(text = title, fontWeight = FontWeight.Bold)
        },
        text = {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF0F172A)
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
            ) {
                Text(if (isBn) "হ্যাঁ, মুছে ফেলুন" else "Yes, Delete")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text(if (isBn) "বাতিল" else "Cancel")
            }
        }
    )
}

@Composable
private fun MultiLayerStoreResetDialog(
    isBn: Boolean,
    deleterName: String,
    deleterEmail: String,
    productsCount: Int,
    customersCount: Int,
    transactionsCount: Int,
    suppliersCount: Int,
    staffCount: Int,
    onDismiss: () -> Unit,
    onConfirmResetAll: () -> Unit
) {
    val requiredConfirmationPhrase = "Delete all my store data and deleting will not cause any problem"

    var currentLayer by remember { mutableIntStateOf(1) }
    var checkAckLedgerWipe by remember { mutableStateOf(false) }
    var checkAckCloudSync by remember { mutableStateOf(false) }
    var typedPhrase by remember { mutableStateOf("") }

    val normalizedTyped = remember(typedPhrase) {
        typedPhrase.trim().removeSuffix(".").replace(Regex("\\s+"), " ")
    }
    val isPhraseMatched = normalizedTyped.equals(requiredConfirmationPhrase, ignoreCase = true)

    val totalRecordsCount = productsCount + customersCount + transactionsCount + suppliersCount + staffCount

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = Color(0xFFDC2626),
                modifier = Modifier.size(36.dp)
            )
        },
        title = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Surface(
                    shape = RoundedCornerShape(50),
                    color = Color(0xFFFEE2E2),
                    border = BorderStroke(1.dp, Color(0xFFFCA5A5))
                ) {
                    Text(
                        text = if (isBn) {
                            "নিরাপত্তা স্তর $currentLayer / ৪ • Security Layer $currentLayer of 4"
                        } else {
                            "Security Confirmation • Layer $currentLayer of 4"
                        },
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFF991B1B),
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                    )
                }

                // 4-step visual progress bar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    for (step in 1..4) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(5.dp)
                                .clip(RoundedCornerShape(50))
                                .background(
                                    if (step <= currentLayer) Color(0xFFDC2626) else Color(0xFFFECACA)
                                )
                        )
                    }
                }

                Text(
                    text = when (currentLayer) {
                        1 -> if (isBn) "স্তর ১: প্রাথমিক বিপদ ও ডাটা সতর্কবার্তা" else "Layer 1: Danger & Impact Warning"
                        2 -> if (isBn) "স্তর ২: নিরাপত্তা চেকলিস্ট যাচাইকরণ" else "Layer 2: Mandatory Safety Checklist"
                        3 -> if (isBn) "স্তর ৩: লিখিত অনুমোদন বাক্য যাচাই" else "Layer 3: Type Confirmation Phrase"
                        else -> if (isBn) "স্তর ৪: চূড়ান্ত ও শেষ নিশ্চিতকরণ" else "Layer 4: Final Execution Lock"
                    },
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    color = Color(0xFF0F172A)
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                when (currentLayer) {
                    1 -> {
                        Text(
                            text = if (isBn) {
                                "সতর্কতা! আপনি দোকানের সম্পূর্ণ ডাটাবেজ ডিলিট ও রিসেট করার প্রক্রিয়া শুরু করেছেন। এটি অত্যন্ত সংবেদনশীল একটি পদক্ষেপ।"
                            } else {
                                "WARNING! You are initiating a complete store data wipe and reset. This is a critical operation that affects your entire store."
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF991B1B)
                        )

                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFFEF2F2),
                            border = BorderStroke(1.dp, Color(0xFFFECACA)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = if (isBn) {
                                        "📊 যেসব সক্রিয় ডাটা মুছে যাবে (মোট $totalRecordsCount টি):"
                                    } else {
                                        "📊 Active Store Records to Be Wiped (Total: $totalRecordsCount):"
                                    },
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = Color(0xFF7F1D1D)
                                )
                                Text("• 📦 ${if (isBn) "পণ্য (Products)" else "Products"}: $productsCount", fontSize = 12.5.sp, color = Color(0xFF0F172A))
                                Text("• 👥 ${if (isBn) "কাস্টমার (Customers)" else "Customers"}: $customersCount", fontSize = 12.5.sp, color = Color(0xFF0F172A))
                                Text("• 🧾 ${if (isBn) "লেনদেন, বিক্রি ও বাকি (Transactions)" else "Transactions & Dues"}: $transactionsCount", fontSize = 12.5.sp, color = Color(0xFF0F172A))
                                Text("• 🚚 ${if (isBn) "মহাজন (Suppliers)" else "Suppliers"}: $suppliersCount", fontSize = 12.5.sp, color = Color(0xFF0F172A))
                                Text("• 🧑‍💼 ${if (isBn) "স্টাফ (Staff)" else "Staff Members"}: $staffCount", fontSize = 12.5.sp, color = Color(0xFF0F172A))
                            }
                        }

                        Text(
                            text = if (isBn) {
                                "সব আইটেম সক্রিয় খাতা থেকে মুছে রিসাইকেল বিনে চলে যাবে। আপনি যদি সত্যিই এগিয়ে যেতে চান, তবে পরের নিরাপত্তা স্তরে যান।"
                            } else {
                                "All active items will be wiped from your live store screens and moved to the Recycle Bin. Proceed to Layer 2 only if you are sure."
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF475569)
                        )
                    }

                    2 -> {
                        Text(
                            text = if (isBn) {
                                "পরবর্তী ধাপে যেতে নিচের দুটি নিরাপত্তা শর্তে টিক (✓) দিন:"
                            } else {
                                "Please check both safety acknowledgments below to unlock Layer 3:"
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF0F172A)
                        )

                        Surface(
                            onClick = { checkAckLedgerWipe = !checkAckLedgerWipe },
                            shape = RoundedCornerShape(12.dp),
                            color = if (checkAckLedgerWipe) Color(0xFFFEF2F2) else Color(0xFFF8FAFC),
                            border = BorderStroke(
                                1.2.dp,
                                if (checkAckLedgerWipe) Color(0xFFDC2626) else Color(0xFFCBD5E1)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Checkbox(
                                    checked = checkAckLedgerWipe,
                                    onCheckedChange = { checkAckLedgerWipe = it },
                                    colors = CheckboxDefaults.colors(checkedColor = Color(0xFFDC2626))
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (isBn) {
                                        "আমি নিশ্চিত করছি যে দোকানের সব পণ্য, কাস্টমার, বাকি, বিক্রি, খরচ ও মহাজনের হিসাব শূন্য (রিসেট) হয়ে যাবে।"
                                    } else {
                                        "I confirm that all products, customers, dues, sales, expenses, and supplier balances will be wiped to zero."
                                    },
                                    fontSize = 12.5.sp,
                                    color = Color(0xFF0F172A)
                                )
                            }
                        }

                        Surface(
                            onClick = { checkAckCloudSync = !checkAckCloudSync },
                            shape = RoundedCornerShape(12.dp),
                            color = if (checkAckCloudSync) Color(0xFFFEF2F2) else Color(0xFFF8FAFC),
                            border = BorderStroke(
                                1.2.dp,
                                if (checkAckCloudSync) Color(0xFFDC2626) else Color(0xFFCBD5E1)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Checkbox(
                                    checked = checkAckCloudSync,
                                    onCheckedChange = { checkAckCloudSync = it },
                                    colors = CheckboxDefaults.colors(checkedColor = Color(0xFFDC2626))
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (isBn) {
                                        "আমি বুঝতে পেরেছি যে এটি লাইভ ক্লাউড (Firebase) এবং লোকাল ডাটাবেজ একসাথে রিসেট করবে।"
                                    } else {
                                        "I understand that this action immediately resets both live Firebase Cloud and local store data."
                                    },
                                    fontSize = 12.5.sp,
                                    color = Color(0xFF0F172A)
                                )
                            }
                        }
                    }

                    3 -> {
                        Text(
                            text = if (isBn) {
                                "দুর্ঘটনাবশত ডিলিট রোধ করতে নিচের বক্সে হুবহু এই ইংরেজি বাক্যটি টাইপ করুন:"
                            } else {
                                "To prevent accidental deletion, please type the following exact sentence in the box below:"
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF0F172A)
                        )

                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFFEF2F2),
                            border = BorderStroke(1.4.dp, Color(0xFFDC2626)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = if (isBn) "টাইপ করার নির্ধারিত বাক্য:" else "Required Verification Sentence:",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF991B1B)
                                )
                                Text(
                                    text = requiredConfirmationPhrase,
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color(0xFF7F1D1D)
                                )
                            }
                        }

                        OutlinedTextField(
                            value = typedPhrase,
                            onValueChange = { typedPhrase = it },
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("reset_store_confirmation_phrase_input"),
                            label = {
                                Text(
                                    if (isBn) "এখানে বাক্যটি হুবহু টাইপ করুন" else "Type the exact sentence here"
                                )
                            },
                            placeholder = {
                                Text(
                                    text = requiredConfirmationPhrase,
                                    fontSize = 12.sp
                                )
                            },
                            singleLine = false,
                            minLines = 2,
                            maxLines = 3,
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = if (isPhraseMatched) Color(0xFF00A862) else Color(0xFFDC2626),
                                unfocusedBorderColor = if (isPhraseMatched) Color(0xFF00A862) else Color(0xFFCBD5E1)
                            )
                        )

                        Text(
                            text = if (isPhraseMatched) {
                                if (isBn) "✅ নিশ্চিতকরণ বাক্যটি সঠিকভাবে মিলেছে!" else "✅ Confirmation sentence matched!"
                            } else {
                                if (isBn) {
                                    "⚠️ পরের ধাপে যেতে উপরের বাক্যটি হুবহু টাইপ করা বাধ্যতামূলক।"
                                } else {
                                    "⚠️ You must type 'Delete all my store data and deleting will not cause any problem' to continue."
                                }
                            },
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isPhraseMatched) Color(0xFF00A862) else Color(0xFFB45309)
                        )
                    }

                    else -> {
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = Color(0xFFFEF2F2),
                            border = BorderStroke(1.5.dp, Color(0xFFDC2626)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = if (isBn) "🚨 চূড়ান্ত ও শেষ সতর্কবার্তা (স্তর ৪/৪)" else "🚨 Final Authorization Lock (Layer 4/4)",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 14.sp,
                                    color = Color(0xFF991B1B)
                                )
                                Text(
                                    text = if (isBn) {
                                        "আপনি আগের ৩টি নিরাপত্তা স্তর ও লিখিত অঙ্গীকার সম্পন্ন করেছেন। নিচের চূড়ান্ত লাল বাটনে চাপ দিলেই দোকানের সব ডাটা ($totalRecordsCount টি রেকর্ড) সাথে সাথে মুছে যাবে এবং দোকান নতুনভাবে শুরু হবে।"
                                    } else {
                                        "You have passed all 3 prior security layers and typed the written authorization. Pressing the final button below will immediately wipe all $totalRecordsCount active store records and start fresh."
                                    },
                                    fontSize = 12.5.sp,
                                    color = Color(0xFF7F1D1D)
                                )
                                HorizontalDivider(color = Color(0xFFFECACA))
                                Text(
                                    text = if (isBn) {
                                        "👤 অনুমোদনকারী: $deleterName ($deleterEmail)"
                                    } else {
                                        "👤 Authorized By: $deleterName ($deleterEmail)"
                                    },
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF0F172A)
                                )
                                Text(
                                    text = "✅ \"$requiredConfirmationPhrase\"",
                                    fontSize = 11.5.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFF166534)
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            when (currentLayer) {
                1 -> {
                    Button(
                        onClick = { currentLayer = 2 },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                        modifier = Modifier.testTag("reset_layer_1_next_button")
                    ) {
                        Text(
                            if (isBn) "ঝুঁকি বুঝেছি — পরের ধাপ (১/৪)" else "I Understand — Next (1/4)",
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                2 -> {
                    Button(
                        onClick = { currentLayer = 3 },
                        enabled = checkAckLedgerWipe && checkAckCloudSync,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                        modifier = Modifier.testTag("reset_layer_2_next_button")
                    ) {
                        Text(
                            if (isBn) "পরের ধাপ (২/৪)" else "Next Step (2/4)",
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                3 -> {
                    Button(
                        onClick = { currentLayer = 4 },
                        enabled = isPhraseMatched,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                        modifier = Modifier.testTag("reset_layer_3_next_button")
                    ) {
                        Text(
                            if (isBn) "চূড়ান্ত ধাপে যান (৩/৪)" else "Final Step (3/4)",
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                else -> {
                    Button(
                        onClick = onConfirmResetAll,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFB91C1C)),
                        modifier = Modifier.testTag("reset_layer_4_confirm_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.DeleteForever,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            if (isBn) "হ্যাঁ, সব ডাটা রিসেট করুন (৪/৪)" else "Yes, Delete All Store Data (4/4)",
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            }
        },
        dismissButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (currentLayer > 1) {
                    OutlinedButton(
                        onClick = { currentLayer -= 1 }
                    ) {
                        Text(if (isBn) "পেছনে" else "Back")
                    }
                }
                TextButton(onClick = onDismiss) {
                    Text(if (isBn) "বাতিল" else "Cancel")
                }
            }
        }
    )
}


