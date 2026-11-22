package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.PointOfSale
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.credentials.CredentialManager
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.example.data.auth.VaultAccessManager
import com.example.data.auth.VaultRole
import com.example.data.auth.VaultUserAccount
import com.example.data.model.Customer
import com.example.data.model.Product
import com.example.data.model.RecycleBinItem
import com.example.data.model.StaffMember
import com.example.data.model.StoreTransaction
import com.example.data.model.Supplier
import com.example.data.repository.DokanRepository
import com.example.ui.i18n.AppLanguage
import com.example.ui.i18n.stringsFor
import com.example.ui.screens.AuthScreen
import com.example.ui.screens.BlueprintGuideDialog
import com.example.ui.screens.ChangeVaultPasswordDialog
import com.example.ui.screens.CustomersScreen
import com.example.ui.screens.HomeDashboardScreen
import com.example.ui.screens.MoreManagementScreen
import com.example.ui.screens.ProductsScreen
import com.example.ui.screens.SalesPosScreen
import com.example.ui.screens.signOut
import com.example.data.repository.LocalVaultStoreFallback
import com.example.ui.theme.AppThemeMode
import com.example.ui.theme.DokanManagerTheme
import com.example.ui.theme.TerracottaDarkHeader
import com.example.ui.theme.TerracottaPrimaryLight
import com.example.ui.viewmodel.DokanViewModel
import com.example.ui.viewmodel.UiState
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FirebaseFirestore

enum class MainNavTab(
    val route: String,
    val emoji: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    HOME("home", "🏠", Icons.Filled.Home, Icons.Outlined.Home),
    SALES("sales", "🛒", Icons.Filled.PointOfSale, Icons.Outlined.PointOfSale),
    PRODUCTS("products", "📦", Icons.Filled.Inventory2, Icons.Outlined.Inventory2),
    CUSTOMERS("customers", "👥", Icons.Filled.People, Icons.Outlined.People),
    MORE("more", "☰", Icons.Filled.Tune, Icons.Outlined.Tune)
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        LocalVaultStoreFallback.init(applicationContext)
        enableEdgeToEdge()
        setContent {
            var themeMode by rememberSaveable { mutableStateOf(AppThemeMode.LIGHT) }
            var language by rememberSaveable { mutableStateOf(AppLanguage.ENGLISH) }
            var showBlueprintDialog by rememberSaveable { mutableStateOf(false) }

            DokanManagerTheme(themeMode = themeMode) {
                DokanAppRoot(
                    language = language,
                    themeMode = themeMode,
                    onLanguageChange = { language = it },
                    onThemeModeChange = { themeMode = it },
                    onOpenBlueprintGuide = { showBlueprintDialog = true }
                )

                if (showBlueprintDialog) {
                    BlueprintGuideDialog(
                        onDismiss = { showBlueprintDialog = false }
                    )
                }
            }
        }
    }
}

@Composable
fun DokanAppRoot(
    language: AppLanguage,
    themeMode: AppThemeMode,
    onLanguageChange: (AppLanguage) -> Unit,
    onThemeModeChange: (AppThemeMode) -> Unit,
    onOpenBlueprintGuide: () -> Unit
) {
    val context = LocalContext.current
    val vaultAccessManager = remember(context) { VaultAccessManager(context) }

    val activeVaultAccount by vaultAccessManager.activeSession.collectAsStateWithLifecycle()
    val allVaultAccounts by vaultAccessManager.accounts.collectAsStateWithLifecycle()

    var currentFirebaseUser by remember { mutableStateOf(Firebase.auth.currentUser) }

    DisposableEffect(Unit) {
        val listener = FirebaseAuth.AuthStateListener { auth ->
            currentFirebaseUser = auth.currentUser
        }
        Firebase.auth.addAuthStateListener(listener)
        onDispose {
            Firebase.auth.removeAuthStateListener(listener)
        }
    }

    val unlockedAccount = activeVaultAccount
    if (unlockedAccount == null) {
        AuthScreen(
            vaultAccessManager = vaultAccessManager,
            onVaultUnlocked = { account ->
                vaultAccessManager.setActiveSession(account)
            },
            onGoogleAuthSuccess = {
                currentFirebaseUser = Firebase.auth.currentUser
            },
            onOpenBlueprintGuide = onOpenBlueprintGuide
        )
    } else {
        val sessionKey = "${currentFirebaseUser?.uid ?: "vault"}_${unlockedAccount.email}"
        key(sessionKey) {
            DokanAuthenticatedShell(
                sessionKey = sessionKey,
                currentVaultAccount = unlockedAccount,
                allVaultAccounts = allVaultAccounts,
                vaultAccessManager = vaultAccessManager,
                language = language,
                themeMode = themeMode,
                onLanguageChange = onLanguageChange,
                onThemeModeChange = onThemeModeChange,
                onOpenBlueprintGuide = onOpenBlueprintGuide,
                onSignedOut = {
                    vaultAccessManager.clearSession()
                    currentFirebaseUser = null
                }
            )
        }
    }
}

@Composable
fun DokanAuthenticatedShell(
    sessionKey: String,
    currentVaultAccount: VaultUserAccount,
    allVaultAccounts: List<VaultUserAccount>,
    vaultAccessManager: VaultAccessManager,
    language: AppLanguage,
    themeMode: AppThemeMode,
    onLanguageChange: (AppLanguage) -> Unit,
    onThemeModeChange: (AppThemeMode) -> Unit,
    onOpenBlueprintGuide: () -> Unit,
    onSignedOut: () -> Unit
) {
    val viewModel: DokanViewModel = viewModel(
        key = sessionKey,
        factory = viewModelFactory {
            initializer {
                val app = checkNotNull(this[APPLICATION_KEY])
                val databaseId = app.getString(R.string.firestore_database_id)
                val db = FirebaseFirestore.getInstance(databaseId)
                DokanViewModel(
                    DokanRepository(
                        db = db,
                        vaultSessionActorEmail = currentVaultAccount.email
                    )
                )
            }
        }
    )

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember(context) { CredentialManager.create(context) }

    val productsState by viewModel.productsState.collectAsStateWithLifecycle()
    val customersState by viewModel.customersState.collectAsStateWithLifecycle()
    val transactionsState by viewModel.transactionsState.collectAsStateWithLifecycle()
    val suppliersState by viewModel.suppliersState.collectAsStateWithLifecycle()
    val staffState by viewModel.staffState.collectAsStateWithLifecycle()
    val auditLogsState by viewModel.auditLogsState.collectAsStateWithLifecycle()

    val cartItems by viewModel.cartItems.collectAsStateWithLifecycle()
    val productSearchQuery by viewModel.productSearchQuery.collectAsStateWithLifecycle()
    val customerSearchQuery by viewModel.customerSearchQuery.collectAsStateWithLifecycle()
    val customerFilter by viewModel.customerFilter.collectAsStateWithLifecycle()
    val statusBanner by viewModel.statusBanner.collectAsStateWithLifecycle()
    val isBusy by viewModel.isBusy.collectAsStateWithLifecycle()

    val products = (productsState as? UiState.Success<List<Product>>)?.data ?: emptyList()
    val customers = (customersState as? UiState.Success<List<Customer>>)?.data ?: emptyList()
    val transactions = (transactionsState as? UiState.Success<List<StoreTransaction>>)?.data ?: emptyList()
    val suppliers = (suppliersState as? UiState.Success<List<Supplier>>)?.data ?: emptyList()
    val staffList = (staffState as? UiState.Success<List<StaffMember>>)?.data ?: emptyList()
    val auditLogs = (auditLogsState as? UiState.Success)?.data ?: emptyList()
    val recycleBinState by viewModel.recycleBinState.collectAsStateWithLifecycle()
    val recycleBinItems = (recycleBinState as? UiState.Success)?.data ?: emptyList()

    val dailyStats = remember(transactions) { DokanViewModel.calculateDailyStats(transactions) }
    val strings = remember(language) { stringsFor(language) }

    var currentTab by rememberSaveable { mutableStateOf(MainNavTab.HOME) }
    var openNewSaleOnLaunch by rememberSaveable { mutableStateOf(false) }
    var openAddProductOnLaunch by rememberSaveable { mutableStateOf(false) }
    var openAddCustomerOnLaunch by rememberSaveable { mutableStateOf(false) }
    var quickDueModalMode by rememberSaveable { mutableStateOf<Boolean?>(null) }
    var showChangePasswordDialog by rememberSaveable { mutableStateOf(false) }
    var localRoleBanner by remember { mutableStateOf<String?>(null) }

    val isAdmin = currentVaultAccount.role == VaultRole.ADMIN

    LaunchedEffect(currentVaultAccount.email) {
        if (currentVaultAccount.email.isNotBlank()) {
            viewModel.recordAuditLog(
                action = "অ্যাক্টিভ সেশন: ${currentVaultAccount.name} (${currentVaultAccount.role.name})",
                module = "Security"
            )
        }
    }

    val activeBanner = localRoleBanner ?: statusBanner

    val isDark = themeMode == AppThemeMode.DARK || (themeMode == AppThemeMode.SYSTEM && isSystemInDarkTheme())
    val scaffoldBg = if (isDark) Color(0xFF0F172A) else Color(0xFFF0F9F5)
    val bottomSurface = if (isDark) Color(0xFF1E293B) else Color.White
    val bottomBorder = if (isDark) Color(0xFF334155) else Color(0xFFD1FAE5)

    Scaffold(
        contentWindowInsets = WindowInsets.safeDrawing,
        containerColor = scaffoldBg,
        topBar = {
            DokanTerracottaHeaderBar(
                shopName = strings.appName,
                shopAddress = strings.subtitle,
                themeMode = themeMode
            )
        },
        bottomBar = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.Transparent)
                    .padding(horizontal = 14.dp, vertical = 8.dp)
                    .testTag("bottom_navigation_bar")
            ) {
                Surface(
                    shape = RoundedCornerShape(28.dp),
                    color = bottomSurface,
                    shadowElevation = 10.dp,
                    border = BorderStroke(1.dp, bottomBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        MainNavTab.entries.forEach { tab ->
                            val label = when (tab) {
                                MainNavTab.HOME -> strings.navHome
                                MainNavTab.SALES -> strings.navSales
                                MainNavTab.PRODUCTS -> strings.navProducts
                                MainNavTab.CUSTOMERS -> strings.navCustomers
                                MainNavTab.MORE -> strings.navMore
                            }
                            val selected = currentTab == tab
                            val activeGreen = Color(0xFF00A862)
                            val inactiveSlate = Color(0xFF64748B)

                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(if (selected) Color(0xFFDFF7EC) else Color.Transparent)
                                    .clickable { currentTab = tab }
                                    .padding(vertical = 8.dp, horizontal = 4.dp)
                                    .testTag("nav_tab_${tab.route}")
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    if (tab == MainNavTab.SALES && cartItems.isNotEmpty()) {
                                        BadgedBox(
                                            badge = {
                                                Badge(containerColor = Color(0xFF00B368)) {
                                                    Text("${cartItems.size}", color = Color.White)
                                                }
                                            }
                                        ) {
                                            Icon(
                                                imageVector = if (selected) tab.selectedIcon else tab.unselectedIcon,
                                                contentDescription = label,
                                                tint = if (selected) activeGreen else inactiveSlate,
                                                modifier = Modifier.size(22.dp)
                                            )
                                        }
                                    } else {
                                        Icon(
                                            imageVector = if (selected) tab.selectedIcon else tab.unselectedIcon,
                                            contentDescription = label,
                                            tint = if (selected) activeGreen else inactiveSlate,
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(3.dp))
                                    Text(
                                        text = label,
                                        fontSize = 11.sp,
                                        fontWeight = if (selected) FontWeight.ExtraBold else FontWeight.Bold,
                                        color = if (selected) activeGreen else inactiveSlate,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(scaffoldBg)
                .padding(innerPadding)
        ) {
            if (isBusy) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0xFF00B368)
                )
            }

            AnimatedVisibility(visible = activeBanner != null) {
                activeBanner?.let { banner ->
                    Surface(
                        color = Color.White,
                        shape = RoundedCornerShape(16.dp),
                        shadowElevation = 4.dp,
                        border = BorderStroke(1.dp, Color(0xFF86EFAC)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 6.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = Color(0xFF00B368),
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = banner,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color(0xFF0F172A),
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            IconButton(
                                onClick = {
                                    localRoleBanner = null
                                    viewModel.clearBanner()
                                }
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Dismiss",
                                    tint = Color(0xFF64748B)
                                )
                            }
                        }
                    }
                }
            }

            Box(modifier = Modifier.weight(1f)) {
                when (currentTab) {
                    MainNavTab.HOME -> {
                        HomeDashboardScreen(
                            userDisplayName = currentVaultAccount.name,
                            currentVaultAccount = currentVaultAccount,
                            allVaultAccounts = allVaultAccounts,
                            products = products,
                            customers = customers,
                            transactions = transactions,
                            dailyStats = dailyStats,
                            strings = strings,
                            language = language,
                            themeMode = themeMode,
                            onToggleLanguage = {
                                onLanguageChange(
                                    if (language == AppLanguage.ENGLISH) AppLanguage.BENGALI else AppLanguage.ENGLISH
                                )
                            },
                            onCycleTheme = {
                                val next = when (themeMode) {
                                    AppThemeMode.LIGHT -> AppThemeMode.DARK
                                    AppThemeMode.DARK -> AppThemeMode.SYSTEM
                                    AppThemeMode.SYSTEM -> AppThemeMode.LIGHT
                                }
                                onThemeModeChange(next)
                            },
                            onNavigateToSales = {
                                openNewSaleOnLaunch = true
                                currentTab = MainNavTab.SALES
                            },
                            onNavigateToAddProduct = {
                                openAddProductOnLaunch = true
                                currentTab = MainNavTab.PRODUCTS
                            },
                            onNavigateToAddCustomer = {
                                openAddCustomerOnLaunch = true
                                currentTab = MainNavTab.CUSTOMERS
                            },
                            onOpenGiveDueDialog = { quickDueModalMode = true },
                            onOpenReceiveMoneyDialog = { quickDueModalMode = false },
                            onRestockProduct = { prod ->
                                viewModel.adjustProductStock(prod, 10.0, "Quick restock from Low Stock Alert")
                            },
                            onLoadSampleStore = { viewModel.seedSampleStore() },
                            onOpenBlueprintGuide = onOpenBlueprintGuide,
                            onAddVaultAccount = { name, email, pass, role ->
                                vaultAccessManager.addAccountByAdmin(name, email, pass, role)
                            },
                            onRemoveVaultAccount = { email ->
                                vaultAccessManager.removeAccountByAdmin(email)
                            },
                            onOpenChangeOwnPassword = { showChangePasswordDialog = true }
                        )
                    }

                    MainNavTab.SALES -> {
                        SalesPosScreen(
                            products = products,
                            customers = customers,
                            transactions = transactions,
                            cartItems = cartItems,
                            dailyStats = dailyStats,
                            strings = strings,
                            loggedInUserName = currentVaultAccount.name,
                            openNewSaleInitially = openNewSaleOnLaunch,
                            onConsumeInitialNewSale = { openNewSaleOnLaunch = false },
                            onAddToCart = { viewModel.addToCart(it) },
                            onUpdateCartQty = { id, qty -> viewModel.updateCartItemQuantity(id, qty) },
                            onUpdateCartItemDetails = { id, qty, unit, price ->
                                viewModel.updateCartItemDetails(id, qty, unit, price)
                            },
                            onRemoveFromCart = { id -> viewModel.removeFromCart(id) },
                            onClearCart = { viewModel.clearCart() },
                            onCompleteSale = { paid, customer, notes, discount, newCustName, onCompleted ->
                                viewModel.checkoutCartSale(
                                    paidAmount = paid,
                                    selectedCustomer = customer,
                                    notes = notes,
                                    discountAmount = discount,
                                    newCustomerName = newCustName,
                                    onComplete = onCompleted
                                )
                            },
                            onCompleteSaleWithCustomerDetails = { paid, customer, notes, discount, newCustName, newCustPhone, newCustAddress, onCompleted ->
                                viewModel.checkoutCartSale(
                                    paidAmount = paid,
                                    selectedCustomer = customer,
                                    notes = notes,
                                    discountAmount = discount,
                                    newCustomerName = newCustName,
                                    newCustomerPhone = newCustPhone,
                                    newCustomerAddress = newCustAddress,
                                    onComplete = onCompleted
                                )
                            },
                            onReturnOrVoidSale = { tx, isReturn, onDone ->
                                viewModel.returnOrVoidSale(
                                    transaction = tx,
                                    currentProducts = products,
                                    currentCustomers = customers,
                                    isReturn = isReturn,
                                    onComplete = onDone
                                )
                            }
                        )
                    }

                    MainNavTab.PRODUCTS -> {
                        ProductsScreen(
                            products = products,
                            transactions = transactions,
                            searchQuery = productSearchQuery,
                            onSearchQueryChange = { viewModel.setProductSearchQuery(it) },
                            strings = strings,
                            showAddDialogInitially = openAddProductOnLaunch,
                            onConsumeInitialAddDialog = { openAddProductOnLaunch = false },
                            onAddProduct = { name, category, unit, buy, sell, stock, threshold, barcode ->
                                viewModel.addProduct(name, category, unit, buy, sell, stock, threshold, barcode)
                            },
                            onUpdateProduct = { prod, name, category, unit, buy, sell, stock, threshold, barcode ->
                                viewModel.updateProduct(prod, name, category, unit, buy, sell, stock, threshold, barcode)
                            },
                            onAdjustStock = { prod, delta, reason ->
                                viewModel.adjustProductStock(prod, delta, reason)
                            },
                            onVoidStockAdjustment = { prod, tx, signedDelta ->
                                viewModel.voidStockAdjustment(prod, tx, signedDelta)
                            },
                            onDeleteProduct = { prod ->
                                viewModel.deleteProduct(prod)
                            },
                            onAddToPosCart = { prod ->
                                viewModel.addToCart(prod)
                                currentTab = MainNavTab.SALES
                            }
                        )
                    }

                    MainNavTab.CUSTOMERS -> {
                        CustomersScreen(
                            customers = customers,
                            transactions = transactions,
                            searchQuery = customerSearchQuery,
                            onSearchQueryChange = { viewModel.setCustomerSearchQuery(it) },
                            selectedFilter = customerFilter,
                            onFilterChange = { viewModel.setCustomerFilter(it) },
                            strings = strings,
                            showAddDialogInitially = openAddCustomerOnLaunch,
                            onConsumeInitialAddDialog = { openAddCustomerOnLaunch = false },
                            onAddCustomer = { name, phone, address, due ->
                                viewModel.addCustomer(name, phone, address, due)
                            },
                            onUpdateCustomer = { customer, name, phone, address ->
                                viewModel.updateCustomer(customer, name, phone, address)
                            },
                            onDeleteCustomer = { customer ->
                                viewModel.deleteCustomer(customer)
                            },
                            onRecordDueOrPayment = { customer, amount, isGiveDue, notes ->
                                viewModel.recordCustomerDueOrPayment(customer, amount, isGiveDue, notes)
                            },
                            onDeleteTransaction = { tx ->
                                viewModel.deleteTransaction(tx)
                            }
                        )
                    }

                    MainNavTab.MORE -> {
                        MoreManagementScreen(
                            userEmail = currentVaultAccount.email,
                            currentVaultAccount = currentVaultAccount,
                            allVaultAccounts = allVaultAccounts,
                            products = products,
                            customers = customers,
                            transactions = transactions,
                            suppliers = suppliers,
                            staffList = staffList,
                            auditLogs = auditLogs,
                            recycleBinItems = recycleBinItems,
                            onRestoreRecycleItem = { viewModel.restoreRecycleItem(it) },
                            onDeletePermanentlyRecycleItem = { viewModel.deletePermanentlyFromRecycleBin(it) },
                            onEmptyRecycleBin = { viewModel.emptyRecycleBin() },
                            onResetAllStoreData = { onDone -> viewModel.resetAllStoreData(onDone) },
                            dailyStats = dailyStats,
                            language = language,
                            themeMode = themeMode,
                            onLanguageChange = onLanguageChange,
                            onThemeModeChange = onThemeModeChange,
                            onAddSupplier = { name, phone, company, payable ->
                                viewModel.addSupplier(name, phone, company, payable)
                            },
                            onUpdateSupplier = { supplier, name, phone, company ->
                                viewModel.updateSupplier(supplier, name, phone, company)
                            },
                            onDeleteSupplier = { supplier ->
                                viewModel.deleteSupplier(supplier)
                            },
                            onDeleteProduct = { product ->
                                viewModel.deleteProduct(product)
                            },
                            onDeleteCustomer = { customer ->
                                viewModel.deleteCustomer(customer)
                            },
                            onAddSupplierOwed = { supplier, amount, notes ->
                                viewModel.addSupplierOwed(supplier, amount, notes)
                            },
                            onRecordPurchase = { prod, sup, qty, cost, paid, notes ->
                                viewModel.recordStockPurchase(prod, sup, qty, cost, paid, notes)
                            },
                            onRecordMultiItemPurchase = { cartItems, paidAmt, selSup, newSupName, updateBuyPrice, notes, onCompleted ->
                                viewModel.recordMultiItemPurchase(
                                    cartItems = cartItems,
                                    paidAmount = paidAmt,
                                    selectedSupplier = selSup,
                                    newSupplierName = newSupName,
                                    updateBuyingPrice = updateBuyPrice,
                                    notes = notes,
                                    onComplete = onCompleted
                                )
                            },
                            onVoidPurchase = { tx, onVoided ->
                                viewModel.voidPurchase(
                                    transaction = tx,
                                    currentProducts = products,
                                    currentSuppliers = suppliers,
                                    onComplete = onVoided
                                )
                            },
                            onPaySupplier = { sup, amt, notes ->
                                viewModel.paySupplier(sup, amt, notes)
                            },
                            onRecordExpense = { title, cat, amt, notes ->
                                viewModel.recordExpense(title, cat, amt, notes)
                            },
                            onDeleteExpense = { tx ->
                                viewModel.deleteExpense(tx)
                            },
                            onDeleteTransaction = { tx ->
                                viewModel.deleteTransaction(tx)
                            },
                            onSetStartingCash = { amount ->
                                viewModel.setStartingCash(amount)
                            },
                            onAddStaff = { name, role, phone, salary ->
                                viewModel.addStaffMember(name, role, phone, salary)
                            },
                            onUpdateStaff = { staff, name, role, phone, salary, active ->
                                viewModel.updateStaffMember(staff, name, role, phone, salary, active)
                            },
                            onDeleteStaff = { staff ->
                                viewModel.deleteStaffMember(staff)
                            },
                            onToggleStaff = { viewModel.toggleStaffActive(it) },
                            onSeedSampleData = { viewModel.seedSampleStore() },
                            onOpenBlueprintGuide = onOpenBlueprintGuide,
                            onAddVaultAccount = { name, email, pass, role ->
                                vaultAccessManager.addAccountByAdmin(name, email, pass, role)
                            },
                            onEditVaultAccount = { originalEmail, newName, newEmail, newPass, newRole ->
                                vaultAccessManager.editAccountByAdmin(
                                    originalEmailInput = originalEmail,
                                    newNameInput = newName,
                                    newEmailInput = newEmail,
                                    newPasswordInput = newPass,
                                    newRole = newRole
                                )
                            },
                            onRemoveVaultAccount = { email ->
                                vaultAccessManager.removeAccountByAdmin(email)
                            },
                            onOpenChangeOwnPassword = { showChangePasswordDialog = true },
                            onSignOut = {
                                signOut(
                                    credentialManager = credentialManager,
                                    scope = scope,
                                    onSignOutComplete = onSignedOut
                                )
                            }
                        )
                    }
                }
            }
        }
    }

    quickDueModalMode?.let { isGiveDue ->
        QuickDueOrReceiveDialog(
            customers = customers,
            isGiveDue = isGiveDue,
            onDismiss = { quickDueModalMode = null },
            onNavigateToAddCustomer = {
                quickDueModalMode = null
                openAddCustomerOnLaunch = true
                currentTab = MainNavTab.CUSTOMERS
            },
            onCreateCustomerAndRecord = { name, phone, amount, notes ->
                viewModel.addCustomer(
                    name = name,
                    phone = phone.ifBlank { "01700-000000" },
                    address = VaultAccessManager.STORE_BRANCH_LOCATION,
                    initialDue = if (isGiveDue) amount else 0.0
                )
                quickDueModalMode = null
            },
            onConfirm = { customer, amount, notes ->
                viewModel.recordCustomerDueOrPayment(customer, amount, isGiveDue, notes)
                quickDueModalMode = null
            }
        )
    }

    if (showChangePasswordDialog) {
        ChangeVaultPasswordDialog(
            initialEmail = currentVaultAccount.email,
            onDismiss = { showChangePasswordDialog = false },
            onSubmit = { targetEmail, currentPass, newPass ->
                val res = vaultAccessManager.changePasswordAndSyncToFirebase(targetEmail, currentPass, newPass)
                res.onSuccess { updatedAcc ->
                    localRoleBanner =
                        "পাসওয়ার্ড স্থায়ীভাবে পরিবর্তন ও ফায়ারবেসে সিঙ্ক হয়েছে! (${updatedAcc.email})"
                    showChangePasswordDialog = false
                }
                res
            }
        )
    }
}

@Composable
private fun DokanTerracottaHeaderBar(
    shopName: String,
    shopAddress: String,
    themeMode: AppThemeMode
) {
    val isDark = themeMode == AppThemeMode.DARK || (themeMode == AppThemeMode.SYSTEM && isSystemInDarkTheme())
    val headerBg = if (isDark) Color(0xFF1E293B) else Color.White
    val textColor = if (isDark) Color(0xFFF8FAFC) else Color(0xFF0F172A)
    val subTextColor = if (isDark) Color(0xFF94A3B8) else Color(0xFF475569)
    val dividerColor = if (isDark) Color(0xFF334155) else Color(0xFFE2E8F0).copy(alpha = 0.7f)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(headerBg)
            .statusBarsPadding()
            .testTag("dokan_terracotta_header_bar")
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = RoundedCornerShape(13.dp),
                color = Color(0xFFE6F8F0),
                border = BorderStroke(1.5.dp, if (isDark) Color(0xFF10B981) else Color(0xFF6EE7B7)),
                shadowElevation = 3.dp,
                modifier = Modifier.size(42.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(2.dp)
                        .clip(RoundedCornerShape(11.dp))
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.ic_siaam_store_logo),
                        contentDescription = "Siaam Store Logo",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
            Spacer(modifier = Modifier.width(11.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = shopName,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = textColor,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = shopAddress,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = subTextColor,
                    lineHeight = 14.sp
                )
            }
        }
        HorizontalDivider(color = dividerColor, thickness = 0.8.dp)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QuickDueOrReceiveDialog(
    customers: List<Customer>,
    isGiveDue: Boolean,
    onDismiss: () -> Unit,
    onNavigateToAddCustomer: () -> Unit,
    onCreateCustomerAndRecord: (name: String, phone: String, amount: Double, notes: String) -> Unit,
    onConfirm: (Customer, Double, String) -> Unit
) {
    var selectedCustomer by remember(customers) { mutableStateOf(customers.firstOrNull()) }
    var newCustomerName by remember { mutableStateOf("") }
    var newCustomerPhone by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (isGiveDue) "+ Gave credit (বাকি দিন)" else "+ Got payment (জমা নিন)",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            if (customers.isEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Add a customer and record credit in Firebase:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedTextField(
                        value = newCustomerName,
                        onValueChange = { newCustomerName = it },
                        label = { Text("Customer Name *") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = newCustomerPhone,
                        onValueChange = { newCustomerPhone = it },
                        label = { Text("Phone Number") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = amount,
                        onValueChange = { amount = it },
                        label = { Text("Amount (৳) *") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Select customer:", style = MaterialTheme.typography.labelMedium)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        customers.take(8).forEach { cust ->
                            FilterChip(
                                selected = selectedCustomer?.id == cust.id,
                                onClick = { selectedCustomer = cust },
                                label = { Text("${cust.name} (৳${DokanViewModel.formatMoney(cust.totalDue)})") }
                            )
                        }
                    }
                    OutlinedTextField(
                        value = amount,
                        onValueChange = { amount = it },
                        label = { Text("Amount (৳) *") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Notes / Details") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        },
        confirmButton = {
            if (customers.isEmpty()) {
                Button(
                    onClick = {
                        val amt = amount.toDoubleOrNull() ?: 0.0
                        if (newCustomerName.isNotBlank() && amt > 0.0) {
                            onCreateCustomerAndRecord(newCustomerName.trim(), newCustomerPhone.trim(), amt, notes)
                        } else {
                            onNavigateToAddCustomer()
                        }
                    },
                    enabled = newCustomerName.isNotBlank() && (amount.toDoubleOrNull() ?: 0.0) > 0.0
                ) {
                    Text(if (isGiveDue) "Save Credit" else "Save Customer")
                }
            } else {
                Button(
                    onClick = {
                        val cust = selectedCustomer
                        val amt = amount.toDoubleOrNull() ?: 0.0
                        if (cust != null && amt > 0.0) {
                            onConfirm(cust, amt, notes)
                        }
                    },
                    enabled = selectedCustomer != null && (amount.toDoubleOrNull() ?: 0.0) > 0.0
                ) {
                    Text(if (isGiveDue) "Save Credit" else "Save Payment")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
