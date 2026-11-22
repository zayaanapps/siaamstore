package com.example.ui.screens

import android.app.DatePickerDialog
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.data.model.Product
import com.example.data.model.StoreTransaction
import com.example.ui.i18n.DokanTranslations
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.random.Random

// Emerald-Mint & Crisp White Palette matching reference app screenshots
private val ProductsCreamBg = Color(0xFFF0F9F5)
private val ProductsInputBg = Color(0xFFF8FAFC)
private val ProductsCardBorder = Color(0xFFB6EADA)
private val ProductsFieldBorder = Color(0xFFD1FAE5)
private val ProductsDivider = Color(0xFFE2E8F0)
private val ProductsTerracotta = Color(0xFF00B368)
private val ProductsTerracottaDark = Color(0xFF059669)
private val ProductsGreen = Color(0xFF00A862)
private val ProductsAmberWarning = Color(0xFFD97706)
private val ProductsDangerRed = Color(0xFFE11D48)
private val ProductsTextDark = Color(0xFF0F172A)
private val ProductsTextMuted = Color(0xFF64748B)

private enum class ProductStockFilter {
    ALL, LOW_STOCK, OUT_OF_STOCK
}

private enum class MeasurementGroup(
    val displayLabel: String,
    val bnLabel: String,
    val units: List<String>
) {
    WEIGHT("Weight (kg/g)", "ওজন (কেজি/গ্রাম)", listOf("kg", "gm")),
    COUNT("Count (pcs/box)", "সংখ্যা (পিস/বক্স)", listOf("pcs", "box")),
    VOLUME("Volume (ltr)", "আয়তন (লিটার)", listOf("ltr"));

    companion object {
        fun forUnit(unit: String): MeasurementGroup {
            return when (unit.lowercase()) {
                "kg", "gm", "g" -> WEIGHT
                "ltr", "ml" -> VOLUME
                else -> COUNT
            }
        }
    }
}

private data class ParsedStockMovement(
    val transaction: StoreTransaction?,
    val title: String,
    val signedDelta: Double,
    val dateLabel: String,
    val noteLabel: String
)

@Composable
fun ProductsScreen(
    products: List<Product>,
    transactions: List<StoreTransaction>,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    strings: DokanTranslations,
    showAddDialogInitially: Boolean = false,
    onConsumeInitialAddDialog: () -> Unit = {},
    onAddProduct: (
        name: String,
        category: String,
        unit: String,
        buyPrice: Double,
        sellPrice: Double,
        initialStock: Double,
        lowStockThreshold: Double,
        barcode: String
    ) -> Unit,
    onUpdateProduct: (
        product: Product,
        name: String,
        category: String,
        unit: String,
        buyPrice: Double,
        sellPrice: Double,
        stock: Double,
        lowStockThreshold: Double,
        barcode: String
    ) -> Unit = { _, _, _, _, _, _, _, _, _ -> },
    onAdjustStock: (Product, Double, String) -> Unit,
    onVoidStockAdjustment: (Product, StoreTransaction?, Double) -> Unit = { prod, _, delta ->
        onAdjustStock(prod, -delta, "Void stock adjustment")
    },
    onDeleteProduct: (Product) -> Unit,
    onAddToPosCart: (Product) -> Unit
) {
    val isBn = strings.navSales == "বিক্রি"
    var showAddOrEditModal by remember(showAddDialogInitially) { mutableStateOf(showAddDialogInitially) }
    var productBeingEdited by remember { mutableStateOf<Product?>(null) }
    var selectedProductId by rememberSaveable { mutableStateOf<String?>(null) }

    var stockFilter by rememberSaveable { mutableStateOf(ProductStockFilter.ALL) }
    var selectedCategory by rememberSaveable { mutableStateOf("All categories") }
    var showCategoryDropdown by remember { mutableStateOf(false) }

    var showAddStockSheetFor by remember { mutableStateOf<Product?>(null) }
    var showRemoveStockSheetFor by remember { mutableStateOf<Product?>(null) }
    var showBarcodesSheet by remember { mutableStateOf(false) }

    val selectedProduct = remember(products, selectedProductId) {
        selectedProductId?.let { id -> products.firstOrNull { it.id == id } }
    }

    val distinctCategories = remember(products) {
        val cats = products
            .map { it.category.trim() }
            .filter { it.isNotBlank() }
            .distinct()
            .sorted()
        listOf("All categories") + cats
    }

    val filteredProducts = remember(products, searchQuery, stockFilter, selectedCategory) {
        products.filter { prod ->
            val matchesQuery = if (searchQuery.isBlank()) {
                true
            } else {
                val q = searchQuery.trim().lowercase()
                prod.name.lowercase().contains(q) ||
                    prod.category.lowercase().contains(q) ||
                    prod.barcode.lowercase().contains(q)
            }
            val matchesStock = when (stockFilter) {
                ProductStockFilter.ALL -> true
                ProductStockFilter.LOW_STOCK -> prod.stock > 0.0 && prod.stock <= prod.lowStockThreshold
                ProductStockFilter.OUT_OF_STOCK -> prod.stock <= 0.0
            }
            val matchesCat = selectedCategory == "All categories" ||
                prod.category.equals(selectedCategory, ignoreCase = true)

            matchesQuery && matchesStock && matchesCat
        }
    }

    if (selectedProduct != null) {
        BackHandler {
            selectedProductId = null
        }

        val stockHistoryItems = remember(selectedProduct, transactions, isBn) {
            buildStockMovementsForProduct(selectedProduct, transactions, isBn)
        }

        ProductDetailView(
            isBn = isBn,
            product = selectedProduct,
            stockMovements = stockHistoryItems,
            onBack = { selectedProductId = null },
            onEditClick = {
                productBeingEdited = selectedProduct
                showAddOrEditModal = true
            },
            onAddStockClick = { showAddStockSheetFor = selectedProduct },
            onRemoveStockClick = { showRemoveStockSheetFor = selectedProduct },
            onGenerateBarcodeClick = {
                val newCode = "890" + Random.nextInt(100000000, 999999999).toString()
                onUpdateProduct(
                    selectedProduct,
                    selectedProduct.name,
                    selectedProduct.category,
                    selectedProduct.unit,
                    selectedProduct.buyPrice,
                    selectedProduct.sellPrice,
                    selectedProduct.stock,
                    selectedProduct.lowStockThreshold,
                    newCode
                )
            },
            onVoidMovement = { movement ->
                onVoidStockAdjustment(selectedProduct, movement.transaction, movement.signedDelta)
            },
            onRemoveFromList = {
                val prodToDelete = selectedProduct
                selectedProductId = null
                onDeleteProduct(prodToDelete)
            }
        )
    } else {
        // Main Products List Screen (Matching Screenshot 1)
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(ProductsCreamBg)
                .testTag("products_list_screen"),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // 1. Header Row: "Products (2)" | "🏷️ Barcodes" | "+ New product"
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.Bottom,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = if (isBn) "পণ্যসমূহ" else "Products",
                            fontSize = 26.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = ProductsTextDark
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "(${products.size})",
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Normal,
                            color = ProductsTextMuted,
                            modifier = Modifier.padding(bottom = 2.dp)
                        )
                    }

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { showBarcodesSheet = true }
                                .testTag("barcodes_header_button"),
                            color = Color.White,
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, ProductsFieldBorder)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(text = "🏷️", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (isBn) "বারকোড" else "Barcodes",
                                    fontSize = 14.5.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = ProductsTextDark
                                )
                            }
                        }

                        Surface(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .clickable {
                                    productBeingEdited = null
                                    showAddOrEditModal = true
                                }
                                .testTag("fab_add_product"),
                            color = ProductsTerracotta,
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (isBn) "+ নতুন পণ্য" else "+ New product",
                                    fontSize = 14.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                        }
                    }
                }
            }

            // 2. Search Input ("Product name, barcode or category...")
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = onSearchQueryChange,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("product_search_input"),
                    placeholder = {
                        Text(
                            text = if (isBn) "পণ্যের নাম, বারকোড বা ক্যাটাগরি..." else "Product name, barcode or category...",
                            color = ProductsTextMuted,
                            fontSize = 16.sp
                        )
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = ProductsInputBg,
                        unfocusedContainerColor = ProductsInputBg,
                        focusedBorderColor = ProductsTerracotta,
                        unfocusedBorderColor = ProductsFieldBorder,
                        focusedTextColor = ProductsTextDark,
                        unfocusedTextColor = ProductsTextDark
                    )
                )
            }

            // 3. Stock Filter Segmented Bar ("All" | "Low stock" | "Out of stock")
            item {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, ProductsFieldBorder)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        StockFilterTab(
                            label = if (isBn) "সব" else "All",
                            selected = stockFilter == ProductStockFilter.ALL,
                            onClick = { stockFilter = ProductStockFilter.ALL }
                        )
                        StockFilterTab(
                            label = if (isBn) "স্টক কম" else "Low stock",
                            selected = stockFilter == ProductStockFilter.LOW_STOCK,
                            onClick = { stockFilter = ProductStockFilter.LOW_STOCK }
                        )
                        StockFilterTab(
                            label = if (isBn) "স্টক শেষ" else "Out of stock",
                            selected = stockFilter == ProductStockFilter.OUT_OF_STOCK,
                            onClick = { stockFilter = ProductStockFilter.OUT_OF_STOCK }
                        )
                    }
                }
            }

            // 4. Category Dropdown ("All categories")
            item {
                Box(modifier = Modifier.fillMaxWidth()) {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .clickable { showCategoryDropdown = true }
                            .testTag("category_filter_dropdown"),
                        shape = RoundedCornerShape(14.dp),
                        color = ProductsInputBg,
                        border = BorderStroke(1.dp, ProductsFieldBorder)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (selectedCategory == "All categories" && isBn) "সব ক্যাটাগরি" else selectedCategory,
                                fontSize = 16.sp,
                                color = ProductsTextDark,
                                fontWeight = FontWeight.Normal
                            )
                            Icon(
                                imageVector = Icons.Default.KeyboardArrowDown,
                                contentDescription = "Select category",
                                tint = ProductsTextDark,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    DropdownMenu(
                        expanded = showCategoryDropdown,
                        onDismissRequest = { showCategoryDropdown = false },
                        modifier = Modifier.background(Color.White)
                    ) {
                        distinctCategories.forEach { cat ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = if (cat == "All categories" && isBn) "সব ক্যাটাগরি" else cat,
                                        fontWeight = if (cat == selectedCategory) FontWeight.Bold else FontWeight.Normal,
                                        color = ProductsTextDark
                                    )
                                },
                                onClick = {
                                    selectedCategory = cat
                                    showCategoryDropdown = false
                                }
                            )
                        }
                    }
                }
            }

            // 5. Grouped Product List Card
            item {
                if (filteredProducts.isEmpty()) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, ProductsCardBorder)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = if (isBn) "কোনো পণ্য পাওয়া যায়নি" else "No products found",
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = ProductsTextDark
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = if (isBn) "নতুন পণ্য যোগ করতে '+ নতুন পণ্য' বাটনে ট্যাপ করুন।" else "Tap '+ New product' to add products to your store.",
                                fontSize = 14.sp,
                                color = ProductsTextMuted,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                } else {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, ProductsCardBorder),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            filteredProducts.forEachIndexed { index, product ->
                                ProductListRow(
                                    product = product,
                                    onClick = { selectedProductId = product.id }
                                )
                                if (index < filteredProducts.lastIndex) {
                                    HorizontalDivider(
                                        color = ProductsDivider,
                                        thickness = 1.dp
                                    )
                                }
                            }
                        }
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }

    // "+ New product" / "Edit product" Bottom Sheet Modal (Screenshot 2)
    if (showAddOrEditModal) {
        val editing = productBeingEdited
        NewOrEditProductModal(
            isBn = isBn,
            existingProduct = editing,
            onDismiss = {
                showAddOrEditModal = false
                productBeingEdited = null
                onConsumeInitialAddDialog()
            },
            onSave = { name, category, unit, buyPrice, sellPrice, stockVal, lowStockLevel, barcode ->
                if (editing == null) {
                    onAddProduct(
                        name,
                        category,
                        unit,
                        buyPrice,
                        sellPrice,
                        stockVal,
                        lowStockLevel,
                        barcode
                    )
                } else {
                    onUpdateProduct(
                        editing,
                        name,
                        category,
                        unit,
                        buyPrice,
                        sellPrice,
                        stockVal,
                        lowStockLevel,
                        barcode
                    )
                }
                showAddOrEditModal = false
                productBeingEdited = null
                onConsumeInitialAddDialog()
            }
        )
    }

    // "Add stock — <Product>" Bottom Sheet Modal (Screenshot 5)
    showAddStockSheetFor?.let { targetProd ->
        val freshProd = products.firstOrNull { it.id == targetProd.id } ?: targetProd
        AddOrRemoveStockModal(
            isBn = isBn,
            product = freshProd,
            isAddStock = true,
            onDismiss = { showAddStockSheetFor = null },
            onSave = { deltaInProductUnit, encodedReason ->
                onAdjustStock(freshProd, deltaInProductUnit, encodedReason)
                showAddStockSheetFor = null
            }
        )
    }

    // "Remove stock — <Product>" Bottom Sheet Modal (Screenshot 4)
    showRemoveStockSheetFor?.let { targetProd ->
        val freshProd = products.firstOrNull { it.id == targetProd.id } ?: targetProd
        AddOrRemoveStockModal(
            isBn = isBn,
            product = freshProd,
            isAddStock = false,
            onDismiss = { showRemoveStockSheetFor = null },
            onSave = { deltaInProductUnit, encodedReason ->
                onAdjustStock(freshProd, -abs(deltaInProductUnit), encodedReason)
                showRemoveStockSheetFor = null
            }
        )
    }

    // "🏷️ Barcodes" Sheet
    if (showBarcodesSheet) {
        BarcodesOverviewModal(
            isBn = isBn,
            products = products,
            onDismiss = { showBarcodesSheet = false },
            onGenerateBarcodeFor = { prod ->
                val generated = "890" + Random.nextInt(100000000, 999999999).toString()
                onUpdateProduct(
                    prod,
                    prod.name,
                    prod.category,
                    prod.unit,
                    prod.buyPrice,
                    prod.sellPrice,
                    prod.stock,
                    prod.lowStockThreshold,
                    generated
                )
            }
        )
    }
}

@Composable
private fun StockFilterTab(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) ProductsTerracotta else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 15.5.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            color = if (selected) Color.White else ProductsTextDark
        )
    }
}

@Composable
private fun ProductListRow(
    product: Product,
    onClick: () -> Unit
) {
    val stockColor = when {
        product.stock <= 0.0 -> ProductsDangerRed
        product.isLowStock -> ProductsAmberWarning
        else -> ProductsTextDark
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 16.dp)
            .testTag("product_card_${product.id}"),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = product.name,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = ProductsTextDark,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = product.category,
                fontSize = 14.5.sp,
                color = ProductsTextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = "${formatCleanNumber(product.stock)} ${product.unit}",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = stockColor
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "৳ ${formatCleanNumber(product.sellPrice)}/${product.unit}",
                fontSize = 14.5.sp,
                color = ProductsTextMuted
            )
        }
    }
}

/**
 * Full-Screen Product Details View matching Screenshot 3 (`Screenshot_20261110_233647_59264a9e.jpg`)
 */
@Composable
private fun ProductDetailView(
    isBn: Boolean,
    product: Product,
    stockMovements: List<ParsedStockMovement>,
    onBack: () -> Unit,
    onEditClick: () -> Unit,
    onAddStockClick: () -> Unit,
    onRemoveStockClick: () -> Unit,
    onGenerateBarcodeClick: () -> Unit,
    onVoidMovement: (ParsedStockMovement) -> Unit,
    onRemoveFromList: () -> Unit
) {
    val profitPerUnit = product.sellPrice - product.buyPrice

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(ProductsCreamBg)
            .testTag("product_detail_screen"),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Top Navigation Row: [←] Product Name ... [✏️ Edit]
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
                        modifier = Modifier
                            .size(42.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .clickable(onClick = onBack)
                            .testTag("product_detail_back_button"),
                        color = Color.White,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, ProductsFieldBorder)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = ProductsTextDark,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Text(
                        text = product.name,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = ProductsTextDark,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Surface(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .clickable(onClick = onEditClick)
                        .testTag("product_detail_edit_button"),
                    color = Color.White,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, ProductsFieldBorder)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Edit",
                            tint = ProductsTextDark,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isBn) "এডিট" else "Edit",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ProductsTextDark
                        )
                    }
                }
            }
        }

        // 2. Hero "Stock now" Card (Terracotta gradient with top-right circle)
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(
                                    ProductsTerracotta,
                                    ProductsTerracottaDark
                                )
                            )
                        )
                ) {
                    Box(
                        modifier = Modifier
                            .size(150.dp)
                            .align(Alignment.TopEnd)
                            .offset(x = 32.dp, y = (-26).dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.13f))
                    )

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 22.dp, vertical = 20.dp)
                    ) {
                        Text(
                            text = if (isBn) "বর্তমান স্টক" else "Stock now",
                            fontSize = 15.sp,
                            color = Color.White.copy(alpha = 0.92f)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "${formatCleanNumber(product.stock)} ${product.unit}",
                            fontSize = 38.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "${product.category} · ৳ ${formatCleanNumber(product.sellPrice)}/${product.unit}",
                            fontSize = 15.sp,
                            color = Color.White.copy(alpha = 0.92f)
                        )
                    }
                }
            }
        }

        // 3. "+ Add stock" (Green) & "− Remove stock" (Terracotta) Side-by-Side Buttons
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = onAddStockClick,
                    modifier = Modifier
                        .weight(1f)
                        .height(50.dp)
                        .testTag("btn_add_stock"),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ProductsGreen,
                        contentColor = Color.White
                    )
                ) {
                    Text(
                        text = if (isBn) "+ স্টক যোগ" else "+ Add stock",
                        fontSize = 16.5.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Button(
                    onClick = onRemoveStockClick,
                    modifier = Modifier
                        .weight(1f)
                        .height(50.dp)
                        .testTag("btn_remove_stock"),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ProductsTerracotta,
                        contentColor = Color.White
                    )
                ) {
                    Text(
                        text = if (isBn) "− স্টক কমান" else "− Remove stock",
                        fontSize = 16.5.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // 4. Pricing & Low-stock Level Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, ProductsCardBorder)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp, vertical = 18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    DetailMetricRow(
                        label = if (isBn) "ক্রয়মূল্য" else "Buying price",
                        value = "৳ ${formatCleanNumber(product.buyPrice)}/${product.unit}",
                        valueColor = ProductsTextDark
                    )
                    DetailMetricRow(
                        label = if (isBn) "বিক্রয়মূল্য" else "Selling price",
                        value = "৳ ${formatCleanNumber(product.sellPrice)}/${product.unit}",
                        valueColor = ProductsTextDark
                    )
                    DetailMetricRow(
                        label = if (isBn) "লাভ (প্রতি একক)" else "Profit (per unit)",
                        value = "৳ ${formatCleanNumber(profitPerUnit)}/${product.unit}",
                        valueColor = if (profitPerUnit >= 0.0) ProductsGreen else ProductsDangerRed
                    )
                    DetailMetricRow(
                        label = if (isBn) "লো-স্টক সীমা" else "Low-stock level",
                        value = "${formatCleanNumber(product.lowStockThreshold)} ${product.unit}",
                        valueColor = ProductsTextDark
                    )
                }
            }
        }

        // 5. "✨ Generate barcode" Button / Barcode Display
        item {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .clickable(onClick = onGenerateBarcodeClick)
                    .testTag("btn_generate_barcode"),
                shape = RoundedCornerShape(14.dp),
                color = Color.White,
                border = BorderStroke(1.dp, ProductsCardBorder)
            ) {
                if (product.barcode.isBlank()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 15.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = "✨", fontSize = 16.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isBn) "বারকোড তৈরি করুন" else "Generate barcode",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ProductsTextDark
                        )
                    }
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp, vertical = 14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        BarcodeBarsPreview(code = product.barcode)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = product.barcode,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ProductsTextDark
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (isBn) "✨ নতুন বারকোড তৈরি করতে ট্যাপ করুন" else "✨ Tap to regenerate barcode",
                            fontSize = 12.5.sp,
                            color = ProductsTextMuted
                        )
                    }
                }
            }
        }

        // 6. "Stock history" Header & List Card
        item {
            Text(
                text = if (isBn) "স্টক ইতিহাস" else "Stock history",
                fontSize = 19.sp,
                fontWeight = FontWeight.ExtraBold,
                color = ProductsTextDark,
                modifier = Modifier.padding(top = 4.dp)
            )
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, ProductsCardBorder)
            ) {
                if (stockMovements.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp, vertical = 22.dp)
                    ) {
                        Text(
                            text = if (isBn) "এখনো কোনো স্টক ইতিহাস নেই" else "No stock history yet",
                            fontSize = 15.sp,
                            color = ProductsTextMuted
                        )
                    }
                } else {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        stockMovements.forEachIndexed { idx, movement ->
                            val isPositive = movement.signedDelta >= 0.0
                            val qtySign = if (isPositive) "+" else "-"
                            val qtyFormatted = "$qtySign${formatCleanNumber(abs(movement.signedDelta))} ${product.unit}"

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 18.dp, vertical = 16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = movement.title,
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = ProductsTextDark
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    val subLine = if (movement.noteLabel.isNotBlank() &&
                                        !movement.noteLabel.equals(movement.title, ignoreCase = true)
                                    ) {
                                        "${movement.dateLabel} · ${movement.noteLabel}"
                                    } else {
                                        movement.dateLabel
                                    }
                                    Text(
                                        text = subLine,
                                        fontSize = 14.5.sp,
                                        color = ProductsTextMuted
                                    )
                                }

                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = qtyFormatted,
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isPositive) ProductsGreen else ProductsTerracotta
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = if (isBn) "বাতিল" else "Void",
                                        fontSize = 14.5.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = ProductsTerracotta,
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(6.dp))
                                            .clickable { onVoidMovement(movement) }
                                            .padding(horizontal = 4.dp, vertical = 2.dp)
                                            .testTag("void_stock_movement_$idx")
                                    )
                                }
                            }

                            if (idx < stockMovements.lastIndex) {
                                HorizontalDivider(color = ProductsDivider, thickness = 1.dp)
                            }
                        }
                    }
                }
            }
        }

        // 7. "Remove from list" Bottom Action
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (isBn) "তালিকা থেকে মুছুন" else "Remove from list",
                    fontSize = 16.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = ProductsDangerRed,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(onClick = onRemoveFromList)
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .testTag("btn_remove_product_from_list")
                )
            }
        }
    }
}

@Composable
private fun DetailMetricRow(
    label: String,
    value: String,
    valueColor: Color
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            fontSize = 16.5.sp,
            color = ProductsTextMuted
        )
        Text(
            text = value,
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            color = valueColor
        )
    }
}

/**
 * "+ New product" / "Edit product" Bottom Sheet Modal matching Screenshot 2 (`Screenshot_20261110_233552_2e3c0c82.jpg`)
 */
@Composable
fun NewOrEditProductModal(
    isBn: Boolean = true,
    existingProduct: Product?,
    onDismiss: () -> Unit,
    onSave: (
        name: String,
        category: String,
        unit: String,
        buyPrice: Double,
        sellPrice: Double,
        stockVal: Double,
        lowStockLevel: Double,
        barcode: String
    ) -> Unit
) {
    var name by remember(existingProduct) { mutableStateOf(existingProduct?.name ?: "") }
    var category by remember(existingProduct) {
        mutableStateOf(
            existingProduct?.category?.takeIf { it != "General" } ?: ""
        )
    }
    var measurementGroup by remember(existingProduct) {
        mutableStateOf(
            existingProduct?.unit?.let { MeasurementGroup.forUnit(it) } ?: MeasurementGroup.WEIGHT
        )
    }
    var selectedUnit by remember(existingProduct) {
        mutableStateOf(existingProduct?.unit ?: "kg")
    }
    var buyPrice by remember(existingProduct) {
        mutableStateOf(
            existingProduct?.buyPrice?.let { formatCleanNumber(it) } ?: "0"
        )
    }
    var sellPrice by remember(existingProduct) {
        mutableStateOf(
            existingProduct?.sellPrice?.let { formatCleanNumber(it) } ?: "0"
        )
    }
    var openingStock by remember(existingProduct) {
        mutableStateOf(
            existingProduct?.stock?.let { formatCleanNumber(it) } ?: "0"
        )
    }
    var lowStockLevel by remember(existingProduct) {
        mutableStateOf(
            existingProduct?.lowStockThreshold?.let { formatCleanNumber(it) } ?: "0"
        )
    }
    var barcode by remember(existingProduct) {
        mutableStateOf(existingProduct?.barcode ?: "")
    }

    var showMeasuredByMenu by remember { mutableStateOf(false) }
    var showUnitMenu by remember { mutableStateOf(false) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.45f))
                .clickable(onClick = onDismiss),
            contentAlignment = Alignment.BottomCenter
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = false) {}
                    .heightIn(max = 760.dp),
                shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
                color = Color.White
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp, vertical = 22.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = if (existingProduct == null) {
                            if (isBn) "+ নতুন পণ্য" else "+ New product"
                        } else {
                            if (isBn) "পণ্য এডিট করুন" else "Edit product"
                        },
                        fontSize = 21.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = ProductsTextDark
                    )

                    // 1. Product name *
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = if (isBn) "পণ্যের নাম *" else "Product name *",
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = ProductsTerracotta
                        )
                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("add_product_name_input"),
                            shape = RoundedCornerShape(14.dp),
                            colors = modalTextFieldColors()
                        )
                    }

                    // 2. Category (e.g. Rice, Oil)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = if (isBn) "ক্যাটাগরি (যেমন: চাল, তেল)" else "Category (e.g. Rice, Oil)",
                            fontSize = 14.5.sp,
                            color = ProductsTextMuted
                        )
                        OutlinedTextField(
                            value = category,
                            onValueChange = { category = it },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("add_product_category_input"),
                            shape = RoundedCornerShape(14.dp),
                            colors = modalTextFieldColors()
                        )
                    }

                    // 3. Measured by & Unit Dropdowns
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = if (isBn) "পরিমাপের ধরন" else "Measured by",
                                fontSize = 14.5.sp,
                                color = ProductsTextMuted
                            )
                            Box {
                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(14.dp))
                                        .clickable { showMeasuredByMenu = true },
                                    shape = RoundedCornerShape(14.dp),
                                    color = ProductsInputBg,
                                    border = BorderStroke(1.dp, ProductsFieldBorder)
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 14.dp, vertical = 15.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = if (isBn) measurementGroup.bnLabel else measurementGroup.displayLabel,
                                            fontSize = 15.5.sp,
                                            color = ProductsTextDark,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Icon(
                                            imageVector = Icons.Default.KeyboardArrowDown,
                                            contentDescription = null,
                                            tint = ProductsTextDark,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }

                                DropdownMenu(
                                    expanded = showMeasuredByMenu,
                                    onDismissRequest = { showMeasuredByMenu = false },
                                    modifier = Modifier.background(Color.White)
                                ) {
                                    MeasurementGroup.entries.forEach { group ->
                                        DropdownMenuItem(
                                            text = { Text(if (isBn) group.bnLabel else group.displayLabel, color = ProductsTextDark) },
                                            onClick = {
                                                measurementGroup = group
                                                selectedUnit = group.units.first()
                                                showMeasuredByMenu = false
                                            }
                                        )
                                    }
                                }
                            }
                        }

                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = if (isBn) "একক (Unit)" else "Unit",
                                fontSize = 14.5.sp,
                                color = ProductsTextMuted
                            )
                            Box {
                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(14.dp))
                                        .clickable { showUnitMenu = true },
                                    shape = RoundedCornerShape(14.dp),
                                    color = ProductsInputBg,
                                    border = BorderStroke(1.dp, ProductsFieldBorder)
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 14.dp, vertical = 15.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = selectedUnit,
                                            fontSize = 15.5.sp,
                                            color = ProductsTextDark
                                        )
                                        Icon(
                                            imageVector = Icons.Default.KeyboardArrowDown,
                                            contentDescription = null,
                                            tint = ProductsTextDark,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }

                                DropdownMenu(
                                    expanded = showUnitMenu,
                                    onDismissRequest = { showUnitMenu = false },
                                    modifier = Modifier.background(Color.White)
                                ) {
                                    val availableUnits = listOf("kg", "gm", "pcs", "ltr", "box")
                                    availableUnits.forEach { u ->
                                        DropdownMenuItem(
                                            text = { Text(u, color = ProductsTextDark) },
                                            onClick = {
                                                selectedUnit = u
                                                measurementGroup = MeasurementGroup.forUnit(u)
                                                showUnitMenu = false
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // 4. Buying price & Selling price
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = if (isBn) "ক্রয়মূল্য (৳/$selectedUnit)" else "Buying price (৳/$selectedUnit)",
                                fontSize = 14.5.sp,
                                color = ProductsTextMuted
                            )
                            OutlinedTextField(
                                value = buyPrice,
                                onValueChange = { buyPrice = it },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("add_product_buy_price_input"),
                                shape = RoundedCornerShape(14.dp),
                                colors = modalTextFieldColors()
                            )
                        }

                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = if (isBn) "বিক্রয়মূল্য (৳/$selectedUnit)" else "Selling price (৳/$selectedUnit)",
                                fontSize = 14.5.sp,
                                color = ProductsTextMuted
                            )
                            OutlinedTextField(
                                value = sellPrice,
                                onValueChange = { sellPrice = it },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("add_product_sell_price_input"),
                                shape = RoundedCornerShape(14.dp),
                                colors = modalTextFieldColors()
                            )
                        }
                    }

                    // 5. Opening stock (kg)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = if (existingProduct == null) {
                                if (isBn) "শুরুর স্টক ($selectedUnit)" else "Opening stock ($selectedUnit)"
                            } else {
                                if (isBn) "বর্তমান স্টক ($selectedUnit)" else "Current stock ($selectedUnit)"
                            },
                            fontSize = 14.5.sp,
                            color = ProductsTextMuted
                        )
                        OutlinedTextField(
                            value = openingStock,
                            onValueChange = { openingStock = it },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("add_product_stock_input"),
                            shape = RoundedCornerShape(14.dp),
                            colors = modalTextFieldColors()
                        )
                    }

                    // 6. Low-stock level (kg)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = if (isBn) "লো-স্টক সীমা ($selectedUnit)" else "Low-stock level ($selectedUnit)",
                            fontSize = 14.5.sp,
                            color = ProductsTextMuted
                        )
                        OutlinedTextField(
                            value = lowStockLevel,
                            onValueChange = { lowStockLevel = it },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("add_product_low_stock_input"),
                            shape = RoundedCornerShape(14.dp),
                            colors = modalTextFieldColors()
                        )
                    }

                    // 7. Barcode (optional) + [📷] + [✨ Generate]
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = if (isBn) "বারকোড (ঐচ্ছিক)" else "Barcode (optional)",
                            fontSize = 14.5.sp,
                            color = ProductsTextMuted
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            OutlinedTextField(
                                value = barcode,
                                onValueChange = { barcode = it },
                                singleLine = true,
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("add_product_barcode_input"),
                                shape = RoundedCornerShape(14.dp),
                                colors = modalTextFieldColors()
                            )

                            Surface(
                                modifier = Modifier
                                    .height(54.dp)
                                    .width(56.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .clickable {
                                        if (barcode.isBlank()) {
                                            barcode = "890" + Random.nextInt(100000000, 999999999).toString()
                                        }
                                    },
                                shape = RoundedCornerShape(14.dp),
                                color = Color.White,
                                border = BorderStroke(1.dp, ProductsFieldBorder)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(text = "📷", fontSize = 18.sp)
                                }
                            }

                            Surface(
                                modifier = Modifier
                                    .height(54.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .clickable {
                                        barcode = "890" + Random.nextInt(100000000, 999999999).toString()
                                    },
                                shape = RoundedCornerShape(14.dp),
                                color = Color.White,
                                border = BorderStroke(1.dp, ProductsFieldBorder)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(text = "✨", fontSize = 15.sp)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = if (isBn) "তৈরি করুন" else "Generate",
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = ProductsTextDark
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    // 8. Save & Cancel Buttons
                    Button(
                        onClick = {
                            val cleanName = name.trim()
                            if (cleanName.isNotEmpty()) {
                                val buy = buyPrice.toDoubleOrNull() ?: 0.0
                                val sell = sellPrice.toDoubleOrNull() ?: 0.0
                                val stockVal = openingStock.toDoubleOrNull() ?: 0.0
                                val lowVal = lowStockLevel.toDoubleOrNull() ?: 0.0
                                onSave(
                                    cleanName,
                                    category.trim().ifBlank { "General" },
                                    selectedUnit,
                                    buy,
                                    sell,
                                    stockVal,
                                    lowVal,
                                    barcode.trim()
                                )
                            }
                        },
                        enabled = name.trim().isNotEmpty(),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .testTag("confirm_save_product_button"),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = ProductsTerracotta,
                            contentColor = Color.White
                        )
                    ) {
                        Text(
                            text = if (isBn) "সংরক্ষণ করুন" else "Save",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .clickable(onClick = onDismiss),
                        shape = RoundedCornerShape(14.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, ProductsFieldBorder)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = if (isBn) "বাতিল" else "Cancel",
                                fontSize = 16.5.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = ProductsTextDark
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * "Add stock — <Product>" & "Remove stock — <Product>" Bottom Sheet Modals
 * matching Screenshot 4 (`Screenshot_20261110_233716_a48eda8f.jpg`) & Screenshot 5 (`Screenshot_20261110_233728_76f62e1f.jpg`)
 */
@Composable
private fun AddOrRemoveStockModal(
    isBn: Boolean,
    product: Product,
    isAddStock: Boolean,
    onDismiss: () -> Unit,
    onSave: (deltaInProductUnit: Double, encodedReason: String) -> Unit
) {
    val context = LocalContext.current
    var quantityText by remember { mutableStateOf("0") }
    var selectedUnit by remember(product) { mutableStateOf(product.unit) }
    var showUnitMenu by remember { mutableStateOf(false) }

    var removeReasonType by remember { mutableStateOf("Removed") } // "Removed" or "Damaged / lost"
    var forWhatNote by remember { mutableStateOf("") }

    val calendar = remember { Calendar.getInstance() }
    val slashDateFormat = remember { SimpleDateFormat("MM/dd/yyyy", Locale.getDefault()) }
    val displayHistoryDateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.ENGLISH) }

    var selectedDateMillis by remember { mutableStateOf(calendar.timeInMillis) }
    val formattedSlashDate = remember(selectedDateMillis) {
        slashDateFormat.format(Date(selectedDateMillis))
    }

    val compatibleUnits = remember(product.unit) {
        when (product.unit.lowercase()) {
            "kg", "gm" -> listOf("kg", "gm")
            "ltr" -> listOf("ltr")
            "pcs", "box" -> listOf("pcs", "box")
            else -> listOf(product.unit)
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.45f))
                .clickable(onClick = onDismiss),
            contentAlignment = Alignment.BottomCenter
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = false) {},
                shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
                color = Color.White
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp, vertical = 22.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = if (isAddStock) {
                            if (isBn) "স্টক যোগ করুন — ${product.name}" else "Add stock — ${product.name}"
                        } else {
                            if (isBn) "স্টক কমান — ${product.name}" else "Remove stock — ${product.name}"
                        },
                        fontSize = 21.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = ProductsTextDark
                    )

                    Text(
                        text = buildAnnotatedString {
                            withStyle(SpanStyle(color = ProductsTextMuted)) {
                                append(if (isBn) "বর্তমান স্টক: " else "Stock now: ")
                            }
                            withStyle(SpanStyle(color = ProductsTextDark, fontWeight = FontWeight.Bold)) {
                                append("${formatCleanNumber(product.stock)} ${product.unit}")
                            }
                        },
                        fontSize = 15.5.sp
                    )

                    // Quantity & Unit Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = if (isBn) "পরিমাণ" else "Quantity",
                                fontSize = 14.5.sp,
                                color = ProductsTextMuted
                            )
                            OutlinedTextField(
                                value = quantityText,
                                onValueChange = { quantityText = it },
                                singleLine = true,
                                textStyle = TextStyle(
                                    fontSize = 24.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = ProductsTextDark
                                ),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("stock_modal_quantity_input"),
                                shape = RoundedCornerShape(14.dp),
                                colors = modalTextFieldColors()
                            )
                        }

                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = if (isBn) "একক (Unit)" else "Unit",
                                fontSize = 14.5.sp,
                                color = ProductsTextMuted
                            )
                            Box {
                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(58.dp)
                                        .clip(RoundedCornerShape(14.dp))
                                        .clickable { showUnitMenu = true },
                                    shape = RoundedCornerShape(14.dp),
                                    color = ProductsInputBg,
                                    border = BorderStroke(1.dp, ProductsFieldBorder)
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 16.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = selectedUnit,
                                            fontSize = 16.5.sp,
                                            color = ProductsTextDark
                                        )
                                        Icon(
                                            imageVector = Icons.Default.KeyboardArrowDown,
                                            contentDescription = null,
                                            tint = ProductsTextDark
                                        )
                                    }
                                }

                                DropdownMenu(
                                    expanded = showUnitMenu,
                                    onDismissRequest = { showUnitMenu = false },
                                    modifier = Modifier.background(Color.White)
                                ) {
                                    compatibleUnits.forEach { u ->
                                        DropdownMenuItem(
                                            text = { Text(u, color = ProductsTextDark) },
                                            onClick = {
                                                selectedUnit = u
                                                showUnitMenu = false
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Remove Stock Segmented Toggle ("Removed" | "Damaged / lost")
                    if (!isAddStock) {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, ProductsFieldBorder)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                StockFilterTab(
                                    label = if (isBn) "কমানো হয়েছে" else "Removed",
                                    selected = removeReasonType == "Removed",
                                    onClick = { removeReasonType = "Removed" }
                                )
                                StockFilterTab(
                                    label = if (isBn) "নষ্ট / হারানো" else "Damaged / lost",
                                    selected = removeReasonType == "Damaged / lost",
                                    onClick = { removeReasonType = "Damaged / lost" }
                                )
                            }
                        }
                    }

                    // For what (optional)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = if (isBn) "কিসের জন্য / নোট (ঐচ্ছিক)" else "For what (optional)",
                            fontSize = 14.5.sp,
                            color = ProductsTextMuted
                        )
                        OutlinedTextField(
                            value = forWhatNote,
                            onValueChange = { forWhatNote = it },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("stock_modal_note_input"),
                            shape = RoundedCornerShape(14.dp),
                            colors = modalTextFieldColors()
                        )
                    }

                    // Date selector field (MM/dd/yyyy)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = if (isBn) "তারিখ" else "Date",
                            fontSize = 14.5.sp,
                            color = ProductsTextMuted
                        )
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .clickable {
                                    val cal = Calendar.getInstance().apply { timeInMillis = selectedDateMillis }
                                    DatePickerDialog(
                                        context,
                                        { _, year, month, dayOfMonth ->
                                            val picked = Calendar.getInstance().apply {
                                                set(Calendar.YEAR, year)
                                                set(Calendar.MONTH, month)
                                                set(Calendar.DAY_OF_MONTH, dayOfMonth)
                                            }
                                            selectedDateMillis = picked.timeInMillis
                                        },
                                        cal.get(Calendar.YEAR),
                                        cal.get(Calendar.MONTH),
                                        cal.get(Calendar.DAY_OF_MONTH)
                                    ).show()
                                },
                            shape = RoundedCornerShape(14.dp),
                            color = ProductsInputBg,
                            border = BorderStroke(1.dp, ProductsFieldBorder)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 15.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = formattedSlashDate,
                                    fontSize = 16.sp,
                                    color = ProductsTextDark
                                )
                                Icon(
                                    imageVector = Icons.Default.KeyboardArrowDown,
                                    contentDescription = "Pick date",
                                    tint = ProductsTextDark,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    // Save Button (Green for Add Stock, Terracotta for Remove Stock)
                    Button(
                        onClick = {
                            val rawQty = quantityText.toDoubleOrNull() ?: 0.0
                            if (rawQty > 0.0) {
                                val convertedQty = convertUnitQuantity(
                                    quantity = rawQty,
                                    fromUnit = selectedUnit,
                                    toProductUnit = product.unit
                                )
                                val historyDateLabel = displayHistoryDateFormat.format(Date(selectedDateMillis))
                                val reasonTag = if (isAddStock) "Added stock" else removeReasonType
                                val signedPrefix = if (isAddStock) "+" else "-"
                                val encoded = "DELTA:$signedPrefix${formatCleanNumber(convertedQty)}|DATE:$historyDateLabel|REASON:$reasonTag|NOTE:${forWhatNote.trim()}"
                                onSave(convertedQty, encoded)
                            }
                        },
                        enabled = (quantityText.toDoubleOrNull() ?: 0.0) > 0.0,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .testTag("stock_modal_save_button"),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isAddStock) ProductsGreen else ProductsTerracotta,
                            contentColor = Color.White
                        )
                    ) {
                        Text(
                            text = if (isBn) "সংরক্ষণ করুন" else "Save",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .clickable(onClick = onDismiss),
                        shape = RoundedCornerShape(14.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, ProductsFieldBorder)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = if (isBn) "বাতিল" else "Cancel",
                                fontSize = 16.5.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = ProductsTextDark
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BarcodesOverviewModal(
    isBn: Boolean,
    products: List<Product>,
    onDismiss: () -> Unit,
    onGenerateBarcodeFor: (Product) -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.45f))
                .clickable(onClick = onDismiss),
            contentAlignment = Alignment.BottomCenter
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = false) {}
                    .heightIn(max = 680.dp),
                shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
                color = Color.White
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp, vertical = 22.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = if (isBn) "🏷️ পণ্যের বারকোডসমূহ" else "🏷️ Product Barcodes",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = ProductsTextDark
                    )

                    if (products.isEmpty()) {
                        Text(
                            text = if (isBn) "এখনো কোনো পণ্য নেই।" else "No products available yet.",
                            fontSize = 15.sp,
                            color = ProductsTextMuted
                        )
                    } else {
                        products.forEach { prod ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = ProductsInputBg),
                                border = BorderStroke(1.dp, ProductsFieldBorder)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp, vertical = 12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = prod.name,
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = ProductsTextDark
                                        )
                                        Text(
                                            text = if (prod.barcode.isNotBlank()) {
                                                if (isBn) "বারকোড: ${prod.barcode}" else "Barcode: ${prod.barcode}"
                                            } else {
                                                if (isBn) "কোনো বারকোড নেই" else "No barcode assigned"
                                            },
                                            fontSize = 13.5.sp,
                                            color = ProductsTextMuted
                                        )
                                    }

                                    Surface(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(10.dp))
                                            .clickable { onGenerateBarcodeFor(prod) },
                                        shape = RoundedCornerShape(10.dp),
                                        color = Color.White,
                                        border = BorderStroke(1.dp, ProductsFieldBorder)
                                    ) {
                                        Text(
                                            text = if (prod.barcode.isBlank()) {
                                                if (isBn) "✨ তৈরি করুন" else "✨ Generate"
                                            } else {
                                                if (isBn) "✨ নতুন" else "✨ New"
                                            },
                                            fontSize = 13.5.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = ProductsTextDark,
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .clickable(onClick = onDismiss),
                        shape = RoundedCornerShape(14.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, ProductsFieldBorder)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = if (isBn) "বন্ধ করুন" else "Close",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = ProductsTextDark
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BarcodeBarsPreview(code: String) {
    Canvas(
        modifier = Modifier
            .width(180.dp)
            .height(36.dp)
    ) {
        val barCount = 34
        val unitWidth = size.width / (barCount * 1.6f)
        var currentX = 0f
        for (i in 0 until barCount) {
            val charCode = code.getOrNull(i % code.length)?.code ?: (i * 7)
            val barMultiplier = if ((charCode + i) % 3 == 0) 2.1f else 1.0f
            val w = unitWidth * barMultiplier
            if (currentX + w <= size.width) {
                drawRect(
                    color = ProductsTextDark,
                    topLeft = Offset(currentX, 0f),
                    size = Size(w, size.height)
                )
            }
            currentX += w + unitWidth * 0.7f
        }
    }
}

@Composable
private fun modalTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedContainerColor = ProductsInputBg,
    unfocusedContainerColor = ProductsInputBg,
    focusedBorderColor = ProductsTerracotta,
    unfocusedBorderColor = ProductsFieldBorder,
    focusedTextColor = ProductsTextDark,
    unfocusedTextColor = ProductsTextDark
)

private fun convertUnitQuantity(
    quantity: Double,
    fromUnit: String,
    toProductUnit: String
): Double {
    val from = fromUnit.lowercase()
    val to = toProductUnit.lowercase()
    return when {
        from == to -> quantity
        from in listOf("gm", "g") && to == "kg" -> quantity / 1000.0
        from == "kg" && to in listOf("gm", "g") -> quantity * 1000.0
        else -> quantity
    }
}

private fun buildStockMovementsForProduct(
    product: Product,
    transactions: List<StoreTransaction>,
    isBn: Boolean = true
): List<ParsedStockMovement> {
    val dateFormat = SimpleDateFormat("dd MMM yyyy", Locale.ENGLISH)

    val matchingTxs = transactions.filter { tx ->
        tx.type == "STOCK_ADJUST" &&
            (tx.productId == product.id || tx.title.startsWith("${product.name}:", ignoreCase = true))
    }

    if (matchingTxs.isEmpty()) {
        return if (product.stock > 0.0) {
            val createdDate = product.createdAt?.toDate()?.let { dateFormat.format(it) }
                ?: dateFormat.format(Date())
            listOf(
                ParsedStockMovement(
                    transaction = null,
                    title = if (isBn) "শুরুর স্টক" else "Opening stock",
                    signedDelta = product.stock,
                    dateLabel = createdDate,
                    noteLabel = ""
                )
            )
        } else {
            emptyList()
        }
    }

    return matchingTxs.map { tx ->
        val rawNotes = tx.notes
        var parsedDelta: Double? = null
        var parsedDate: String? = null
        var parsedReason: String? = null
        var parsedNote: String? = null

        if (rawNotes.startsWith("DELTA:")) {
            val segments = rawNotes.split("|")
            segments.forEach { seg ->
                when {
                    seg.startsWith("DELTA:") -> {
                        parsedDelta = seg.removePrefix("DELTA:").toDoubleOrNull()
                    }
                    seg.startsWith("DATE:") -> {
                        parsedDate = seg.removePrefix("DATE:").trim()
                    }
                    seg.startsWith("REASON:") -> {
                        parsedReason = seg.removePrefix("REASON:").trim()
                    }
                    seg.startsWith("NOTE:") -> {
                        parsedNote = seg.removePrefix("NOTE:").trim()
                    }
                }
            }
        }

        val isNegative = when {
            parsedDelta != null -> parsedDelta!! < 0.0
            tx.category.equals("Stock Out", ignoreCase = true) -> true
            tx.title.contains("Out", ignoreCase = true) ||
                tx.title.contains("Remove", ignoreCase = true) ||
                tx.title.contains("Damaged", ignoreCase = true) ||
                tx.title.contains("-", ignoreCase = true) -> true
            else -> false
        }

        val absAmount = abs(parsedDelta ?: tx.amount)
        val signedDelta = if (isNegative) -absAmount else absAmount

        val displayTitle = when {
            !parsedReason.isNullOrBlank() -> when {
                parsedReason!!.equals("Removed", ignoreCase = true) -> if (isBn) "স্টক কমানো হয়েছে" else "Removed stock"
                parsedReason!!.equals("Damaged / lost", ignoreCase = true) -> if (isBn) "নষ্ট / হারানো" else "Damaged / lost"
                parsedReason!!.equals("Opening stock", ignoreCase = true) -> if (isBn) "শুরুর স্টক" else "Opening stock"
                parsedReason!!.equals("Added stock", ignoreCase = true) -> if (isBn) "স্টক যোগ করা হয়েছে" else "Added stock"
                else -> parsedReason!!
            }
            tx.title.contains(":") -> tx.title.substringAfter(":").trim()
            else -> tx.title.ifBlank { if (isNegative) (if (isBn) "স্টক কমানো হয়েছে" else "Removed stock") else (if (isBn) "স্টক যোগ করা হয়েছে" else "Added stock") }
        }

        val dateLabel = parsedDate?.takeIf { it.isNotBlank() }
            ?: tx.createdAt?.toDate()?.let { dateFormat.format(it) }
            ?: dateFormat.format(Date())

        val noteLabel = parsedNote ?: if (!rawNotes.startsWith("DELTA:")) rawNotes else ""

        ParsedStockMovement(
            transaction = tx,
            title = displayTitle,
            signedDelta = signedDelta,
            dateLabel = dateLabel,
            noteLabel = noteLabel
        )
    }
}

private fun formatCleanNumber(value: Double): String {
    return if (value % 1.0 == 0.0) {
        value.toLong().toString()
    } else {
        String.format(Locale.US, "%.2f", value).trimEnd('0').trimEnd('.')
    }
}
