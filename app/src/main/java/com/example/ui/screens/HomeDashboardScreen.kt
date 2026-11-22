package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.data.auth.VaultRole
import com.example.data.auth.VaultUserAccount
import com.example.data.model.Customer
import com.example.data.model.Product
import com.example.data.model.StoreTransaction
import com.example.ui.i18n.AppLanguage
import com.example.ui.i18n.DokanTranslations
import com.example.ui.i18n.toBengaliDigits
import com.example.ui.theme.AppThemeMode
import com.example.ui.viewmodel.DailyStats
import com.example.ui.viewmodel.DokanViewModel

// Emerald-Mint & Crisp White Palette (keeping Outstanding card as is)
private val HomeCreamBackground = Color(0xFFF0F9F5)
private val HomeCardBorder = Color(0xFFB6EADA)
private val ChecklistItemBorder = Color(0xFFD1FAE5)
private val ChecklistCheckedGreen = Color(0xFF00B368)
private val ChecklistUncheckedFill = Color(0xFFE2E8F0)
private val ChecklistUncheckedBorder = Color(0xFFCBD5E1)
private val ChecklistCompletedText = Color(0xFF64748B)
private val ChecklistActiveText = Color(0xFF0F172A)

private val OutstandingCardStart = Color(0xFFC8370D)
private val OutstandingCardEnd = Color(0xFF9C2306)
private val NewSaleTerracotta = Color(0xFF00B368)
private val GaveCreditTerracotta = Color(0xFF0EA5E9)
private val GotPaymentGreen = Color(0xFF059669)

private val StatGreenValue = Color(0xFF00A862)
private val StatRedValue = Color(0xFFE11D48)
private val StatLabelSlate = Color(0xFF64748B)
private val StatCornerMint = Color(0xFFDFF7EC)
private val StatCornerRose = Color(0xFFFFE4E6)

@Composable
fun HomeDashboardScreen(
    userDisplayName: String,
    currentVaultAccount: VaultUserAccount,
    allVaultAccounts: List<VaultUserAccount>,
    products: List<Product>,
    customers: List<Customer>,
    transactions: List<StoreTransaction>,
    dailyStats: DailyStats,
    strings: DokanTranslations,
    language: AppLanguage,
    themeMode: AppThemeMode,
    onToggleLanguage: () -> Unit,
    onCycleTheme: () -> Unit,
    onNavigateToSales: () -> Unit,
    onNavigateToAddProduct: () -> Unit,
    onNavigateToAddCustomer: () -> Unit,
    onOpenGiveDueDialog: () -> Unit,
    onOpenReceiveMoneyDialog: () -> Unit,
    onRestockProduct: (Product) -> Unit,
    onLoadSampleStore: () -> Unit,
    onOpenBlueprintGuide: () -> Unit,
    onAddVaultAccount: (name: String, email: String, password: String, role: VaultRole) -> Result<VaultUserAccount>,
    onRemoveVaultAccount: (email: String) -> Result<Unit>,
    onOpenChangeOwnPassword: () -> Unit
) {
    val totalPendingDues = customers.sumOf { it.totalDue.coerceAtLeast(0.0) }
    val customersWithDueCount = customers.count { it.totalDue > 0.0 }
    val lowStockProducts = products.filter { it.isLowStock }

    val isBn = language == AppLanguage.BENGALI

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(HomeCreamBackground)
            .testTag("home_dashboard_list"),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Total Outstanding Card ("Total outstanding" / "৳ 0" / "0 customers owe you")
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(216.dp)
                    .testTag("total_dues_card"),
                shape = RoundedCornerShape(18.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0xFF8C7274))
                ) {
                    // Separate Image 1 (Right/Center-Right): Green Tree Picture (Ficus plant on dusty-rose wall)
                    Image(
                        painter = painterResource(id = R.drawable.img_green_tree_card_1794331745073),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        alignment = BiasAlignment(horizontalBias = -0.15f, verticalBias = -0.55f),
                        modifier = Modifier
                            .fillMaxHeight()
                            .fillMaxWidth(0.66f)
                            .align(Alignment.CenterEnd)
                    )

                    // Separate Image 2 (Left): Baby Picture (IMG_20260426_004707.png) kept cleanly on the left side
                    Image(
                        painter = painterResource(id = R.drawable.img_outstanding_card_bg),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        alignment = BiasAlignment(horizontalBias = 0.05f, verticalBias = -0.35f),
                        modifier = Modifier
                            .fillMaxHeight()
                            .fillMaxWidth(0.50f)
                            .align(Alignment.CenterStart)
                            .graphicsLayer {
                                compositingStrategy = CompositingStrategy.Offscreen
                            }
                            .drawWithContent {
                                drawContent()
                                // Smooth transition only at the right boundary so baby pic & green tree pic stay separate
                                drawRect(
                                    brush = Brush.horizontalGradient(
                                        0.0f to Color.Black,
                                        0.72f to Color.Black,
                                        0.90f to Color.Black.copy(alpha = 0.45f),
                                        1.0f to Color.Transparent
                                    ),
                                    blendMode = BlendMode.DstIn
                                )
                            }
                    )

                    // Unified warm-mauve & dark-espresso contrast scrim so all foreground text is highly visible
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(
                                        Color(0xFF2B1E1D).copy(alpha = 0.34f),
                                        Color(0xFF332322).copy(alpha = 0.42f),
                                        Color(0xFF241817).copy(alpha = 0.55f)
                                    )
                                )
                            )
                    )

                    // Soft radial contrast halo behind the center balance text for maximum readability
                    Box(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .offset(y = (-16).dp)
                            .size(width = 240.dp, height = 105.dp)
                            .background(
                                Brush.radialGradient(
                                    colors = listOf(
                                        Color(0xFF1F1413).copy(alpha = 0.48f),
                                        Color(0xFF1F1413).copy(alpha = 0.22f),
                                        Color.Transparent
                                    )
                                )
                            )
                    )

                    // Centered Label + Amount in the main body of the card
                    Column(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .offset(y = (-16).dp)
                            .padding(horizontal = 20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = strings.totalDuesLabel.uppercase(),
                            fontSize = 14.sp,
                            letterSpacing = 1.8.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFFFFF8F6),
                            textAlign = TextAlign.Center,
                            style = TextStyle(
                                shadow = Shadow(
                                    color = Color.Black.copy(alpha = 0.85f),
                                    offset = Offset(0f, 2f),
                                    blurRadius = 8f
                                )
                            )
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "৳ ${DokanViewModel.formatMoney(totalPendingDues).toBengaliDigits(language)}",
                            fontSize = 40.sp,
                            color = Color.White,
                            fontWeight = FontWeight.ExtraBold,
                            textAlign = TextAlign.Center,
                            style = TextStyle(
                                shadow = Shadow(
                                    color = Color.Black.copy(alpha = 0.90f),
                                    offset = Offset(0f, 3f),
                                    blurRadius = 10f
                                )
                            )
                        )
                    }

                    // Bottom translucent dark-taupe footer strip with high-contrast text
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.BottomCenter)
                            .background(Color(0xFF2E2120).copy(alpha = 0.72f))
                            .border(
                                width = 0.5.dp,
                                color = Color.White.copy(alpha = 0.15f)
                            )
                            .padding(horizontal = 18.dp, vertical = 14.dp)
                    ) {
                        Text(
                            text = if (isBn) {
                                "${customersWithDueCount.toString().toBengaliDigits(language)} জন কাস্টমারের কাছে বাকি আছে"
                            } else {
                                "$customersWithDueCount customers owe you"
                            },
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFFFFF8F6),
                            style = TextStyle(
                                shadow = Shadow(
                                    color = Color.Black.copy(alpha = 0.75f),
                                    offset = Offset(0f, 2f),
                                    blurRadius = 6f
                                )
                            )
                        )
                    }
                }
            }
        }

        // 3. Action Buttons: Full-width "🛒 New sale" + Side-by-side "+ Gave credit" and "+ Got payment"
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(
                    onClick = onNavigateToSales,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp)
                        .testTag("quick_action_new_sale"),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NewSaleTerracotta,
                        contentColor = Color.White
                    ),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp)
                ) {
                    Text(text = "🛒", fontSize = 18.sp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = strings.quickNewSale,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Button(
                        onClick = onOpenGiveDueDialog,
                        modifier = Modifier
                            .weight(1f)
                            .height(50.dp)
                            .testTag("quick_action_give_due"),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = GaveCreditTerracotta,
                            contentColor = Color.White
                        ),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 1.dp)
                    ) {
                        Text(
                            text = strings.quickGiveDue,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }

                    Button(
                        onClick = onOpenReceiveMoneyDialog,
                        modifier = Modifier
                            .weight(1f)
                            .height(50.dp)
                            .testTag("quick_action_receive_money"),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = GotPaymentGreen,
                            contentColor = Color.White
                        ),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 1.dp)
                    ) {
                        Text(
                            text = strings.quickReceiveMoney,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        }

        // 4. 2x2 Today's Summary Cards (Today's sales (0), Today's profit, Credit given today, Received today)
        item {
            val salesCountFormatted = dailyStats.todaysSaleCount.toString().toBengaliDigits(language)
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    DailyStatCard(
                        modifier = Modifier.weight(1f),
                        title = "${strings.todaysSale} ($salesCountFormatted)",
                        amount = dailyStats.todaysSale,
                        language = language,
                        valueColor = StatGreenValue,
                        cornerAccentColor = StatCornerMint
                    )
                    DailyStatCard(
                        modifier = Modifier.weight(1f),
                        title = strings.todaysProfit,
                        amount = dailyStats.todaysProfit,
                        language = language,
                        valueColor = StatGreenValue,
                        cornerAccentColor = StatCornerMint
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    val dueCustomerCountFormatted = dailyStats.todaysGivenDueCustomerCount.toString().toBengaliDigits(language)
                    DailyStatCard(
                        modifier = Modifier.weight(1f),
                        title = "${strings.todaysGivenDue} ($dueCustomerCountFormatted)",
                        amount = dailyStats.todaysGivenDue,
                        language = language,
                        valueColor = StatRedValue,
                        cornerAccentColor = StatCornerRose
                    )
                    DailyStatCard(
                        modifier = Modifier.weight(1f),
                        title = strings.todaysReceived,
                        amount = dailyStats.todaysReceivedMoney,
                        language = language,
                        valueColor = StatGreenValue,
                        cornerAccentColor = StatCornerMint
                    )
                }
            }
        }

        // 5. Low Stock Card ("⚠️ Low stock" inside an Emerald-Mint styled white card)
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("low_stock_section_card"),
                shape = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, HomeCardBorder),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(5.dp)
                            .background(
                                Brush.horizontalGradient(
                                    colors = listOf(Color(0xFF00B87C), Color(0xFF06B6D4))
                                )
                            )
                    )
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp, vertical = 18.dp)
                    ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.WarningAmber,
                            contentDescription = null,
                            tint = ChecklistActiveText,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = strings.lowStockAlerts,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = ChecklistActiveText
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    if (lowStockProducts.isEmpty()) {
                        Text(
                            text = strings.allStockHealthy,
                            fontSize = 14.5.sp,
                            color = StatLabelSlate
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            lowStockProducts.forEach { item ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(8.dp))
                                        .clickable { onRestockProduct(item) }
                                        .padding(vertical = 2.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = item.name,
                                        fontSize = 16.5.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = ChecklistActiveText,
                                        modifier = Modifier.weight(1f)
                                    )
                                    Text(
                                        text = "${formatStockAmount(item.stock).toBengaliDigits(language)} ${item.unit}",
                                        fontSize = 16.5.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = StatRedValue
                                    )
                                }
                            }
                        }
                    }
                    }
                }
            }
        }

        item { Spacer(modifier = Modifier.height(12.dp)) }
    }
}

private fun formatStockAmount(stock: Double): String {
    return if (stock % 1.0 == 0.0) {
        stock.toLong().toString()
    } else {
        String.format("%.1f", stock)
    }
}

@Composable
private fun DailyStatCard(
    modifier: Modifier = Modifier,
    title: String,
    amount: Double,
    amountSuffix: String = "",
    language: AppLanguage,
    valueColor: Color,
    cornerAccentColor: Color
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, HomeCardBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            // Top horizontal emerald-cyan accent strip matching reference screenshots
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .align(Alignment.TopCenter)
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(Color(0xFF00B87C), Color(0xFF06B6D4))
                        )
                    )
            )
            // Subtle top-right quarter-circle decoration
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .align(Alignment.TopEnd)
                    .offset(x = 16.dp, y = (-16).dp)
                    .clip(CircleShape)
                    .background(cornerAccentColor)
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 16.dp)
            ) {
                Text(
                    text = "৳ ${DokanViewModel.formatMoney(amount).toBengaliDigits(language)}$amountSuffix",
                    fontSize = if (amountSuffix.isNotEmpty()) 18.sp else 22.sp,
                    color = valueColor,
                    fontWeight = FontWeight.ExtraBold
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = title,
                    fontSize = 13.5.sp,
                    color = StatLabelSlate,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
