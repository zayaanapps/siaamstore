package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.auth.VaultAccessManager
import com.example.data.auth.VaultRole
import com.example.data.auth.VaultUserAccount

private val VaultEmerald = Color(0xFF059669)
private val VaultEmeraldSoft = Color(0xFFECFDF5)
private val VaultEmeraldBorder = Color(0xFF34D399)

private val VaultIndigo = Color(0xFF2563EB)
private val VaultIndigoSoft = Color(0xFFEFF6FF)
private val VaultIndigoBorder = Color(0xFF60A5FA)

private val VaultAmberGold = Color(0xFFD97706)
private val VaultAmberSoft = Color(0xFFFFFBEB)
private val VaultAmberBorder = Color(0xFFF59E0B)

private val VaultDarkNavy = Color(0xFF0F172A)
private val VaultDeepBlue = Color(0xFF1E293B)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AdminAccessControlPanel(
    currentAccount: VaultUserAccount,
    allAccounts: List<VaultUserAccount>,
    isBengali: Boolean,
    onAddAccount: (name: String, email: String, password: String, role: VaultRole) -> Result<VaultUserAccount>,
    onEditAccount: (
        originalEmail: String,
        newName: String,
        newEmail: String,
        newPassword: String,
        newRole: VaultRole
    ) -> Result<VaultUserAccount> = { _, name, email, pass, role ->
        onAddAccount(name, email, pass, role)
    },
    onRemoveAccount: (email: String) -> Result<Unit>,
    onOpenChangeOwnPassword: () -> Unit
) {
    val isAdmin = currentAccount.role == VaultRole.ADMIN
    val lockedEmergencyAdmins = remember(allAccounts) {
        allAccounts.filter { it.role == VaultRole.ADMIN && it.isLockedEmergencyAdmin }
    }
    val editableAdmins = remember(allAccounts) {
        allAccounts.filter { it.role == VaultRole.ADMIN && !it.isLockedEmergencyAdmin }
    }
    val managers = remember(allAccounts) {
        allAccounts.filter { it.role == VaultRole.ACCOUNT_MANAGER }
    }

    // Expand / Collapse states for compact accordion layout
    var isAnnouncementExpanded by rememberSaveable { mutableStateOf(true) }
    var isManagersExpanded by rememberSaveable { mutableStateOf(true) }
    var isAdminsExpanded by rememberSaveable { mutableStateOf(true) }
    var isLockedAdminsExpanded by rememberSaveable { mutableStateOf(false) }

    var showAddDialogRole by rememberSaveable { mutableStateOf<VaultRole?>(null) }
    var accountBeingEdited by remember { mutableStateOf<VaultUserAccount?>(null) }
    var feedbackBanner by remember { mutableStateOf<String?>(null) }
    var isErrorBanner by remember { mutableStateOf(false) }

    val allExpanded = isManagersExpanded && isAdminsExpanded && isLockedAdminsExpanded

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("admin_access_control_panel"),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // 1. Compact Hero & Quick-Action Header Card
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .border(
                    width = 1.6.dp,
                    brush = Brush.linearGradient(
                        listOf(Color(0xFF10B981), Color(0xFF3B82F6), Color(0xFFF59E0B))
                    ),
                    shape = RoundedCornerShape(18.dp)
                ),
            shape = RoundedCornerShape(18.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.linearGradient(
                            colors = listOf(VaultDarkNavy, VaultDeepBlue, Color(0xFF064E3B))
                        )
                    )
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                // Top Row: Title + Change Password + Expand/Collapse All
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
                            shape = RoundedCornerShape(10.dp),
                            color = Color(0xFF10B981).copy(alpha = 0.2f),
                            border = BorderStroke(1.dp, Color(0xFF34D399)),
                            modifier = Modifier.size(34.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.AdminPanelSettings,
                                    contentDescription = null,
                                    tint = Color(0xFF34D399),
                                    modifier = Modifier.size(19.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(
                                text = if (isBengali) "সিয়াম স্টোর • ইউজার ম্যানেজমেন্ট" else "Siaam Store • User Management",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                            Text(
                                text = "${currentAccount.email} • ${
                                    when {
                                        currentAccount.isLockedEmergencyAdmin -> "🔒 Emergency Admin"
                                        isAdmin -> "👑 Admin"
                                        else -> "💼 Sales Manager"
                                    }
                                }",
                                color = Color(0xFFA7F3D0),
                                fontSize = 11.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (isAdmin) {
                            Surface(
                                onClick = {
                                    val target = !allExpanded
                                    isManagersExpanded = target
                                    isAdminsExpanded = target
                                    isLockedAdminsExpanded = target
                                },
                                shape = RoundedCornerShape(8.dp),
                                color = Color.White.copy(alpha = 0.09f),
                                border = BorderStroke(1.dp, Color(0xFF93C5FD))
                            ) {
                                Text(
                                    text = if (allExpanded) {
                                        if (isBengali) "সব গুটিয়ে নিন" else "Collapse All"
                                    } else {
                                        if (isBengali) "সব খুলুন" else "Expand All"
                                    },
                                    color = Color(0xFFBFDBFE),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 7.dp, vertical = 4.dp)
                                )
                            }
                        }

                        if (!currentAccount.isLockedEmergencyAdmin) {
                            Surface(
                                onClick = onOpenChangeOwnPassword,
                                shape = RoundedCornerShape(8.dp),
                                color = Color.White.copy(alpha = 0.1f),
                                border = BorderStroke(1.dp, Color(0xFF34D399))
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 7.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        Icons.Default.Key,
                                        contentDescription = null,
                                        tint = Color(0xFFA7F3D0),
                                        modifier = Modifier.size(12.dp)
                                    )
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text(
                                        text = if (isBengali) "পাসওয়ার্ড" else "Password",
                                        color = Color.White,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }

                if (isAdmin) {
                    // Compact 3-Metric Strip (Clicking a metric toggles its section!)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CompactStatChip(
                            modifier = Modifier.weight(1f),
                            title = if (isBengali) "ম্যানেজার (Min 1)" else "Managers (Min 1)",
                            count = managers.size.toString(),
                            accent = Color(0xFF34D399),
                            onClick = { isManagersExpanded = !isManagersExpanded }
                        )
                        CompactStatChip(
                            modifier = Modifier.weight(1f),
                            title = if (isBengali) "অ্যাডমিন" else "Admins",
                            count = editableAdmins.size.toString(),
                            accent = Color(0xFF60A5FA),
                            onClick = { isAdminsExpanded = !isAdminsExpanded }
                        )
                        CompactStatChip(
                            modifier = Modifier.weight(1f),
                            title = if (isBengali) "লকড ভল্ট" else "Locked",
                            count = lockedEmergencyAdmins.size.toString(),
                            accent = Color(0xFFFBBF24),
                            onClick = { isLockedAdminsExpanded = !isLockedAdminsExpanded }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { showAddDialogRole = VaultRole.ACCOUNT_MANAGER },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = VaultEmerald),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 5.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(34.dp)
                                .border(1.dp, VaultEmeraldBorder, RoundedCornerShape(10.dp))
                                .testTag("add_account_manager_button")
                        ) {
                            Icon(Icons.Default.PointOfSale, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(5.dp))
                            Text(
                                text = if (isBengali) "+ অ্যাকাউন্ট ম্যানেজার" else "+ Account Manager",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1
                            )
                        }

                        OutlinedButton(
                            onClick = { showAddDialogRole = VaultRole.ADMIN },
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.2.dp, Color(0xFF93C5FD)),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 5.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(34.dp)
                                .testTag("add_admin_account_button")
                        ) {
                            Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(5.dp))
                            Text(
                                text = if (isBengali) "+ নতুন অ্যাডমিন" else "+ New Admin",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1
                            )
                        }
                    }
                }
            }
        }

        // 2. Compact Collapsible Official Login & Password Reset Announcement Banner
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .testTag("user_management_policy_announcement"),
            shape = RoundedCornerShape(14.dp),
            color = VaultIndigoSoft.copy(alpha = 0.65f),
            border = BorderStroke(1.4.dp, VaultIndigoBorder)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { isAnnouncementExpanded = !isAnnouncementExpanded }
                    .padding(horizontal = 12.dp, vertical = 9.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Campaign,
                            contentDescription = null,
                            tint = VaultIndigo,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isBengali) {
                                "📢 লগইন ও পাসওয়ার্ড রিসেট ঘোষণা (Official Access Notice)"
                            } else {
                                "📢 Official Admin & Account Manager Login Notice"
                            },
                            fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFF1E3A8A)
                        )
                    }
                    Icon(
                        imageVector = if (isAnnouncementExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = "Toggle Announcement",
                        tint = VaultIndigo,
                        modifier = Modifier.size(18.dp)
                    )
                }

                AnimatedVisibility(visible = isAnnouncementExpanded) {
                    Column(
                        modifier = Modifier.padding(top = 6.dp),
                        verticalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Text(
                            text = if (isBengali) {
                                "• সকল অ্যাডমিন (Admins): Google দিয়ে সাইন-ইন করতে পারবেন, Forgot Password দিয়ে পাসওয়ার্ড রিসেট করতে পারবেন এবং একইসাথে ইমেইল ও পাসওয়ার্ড দিয়েও লগইন করতে পারবেন। কোনো অ্যাডমিন পাসওয়ার্ড রিসেট করলে নতুন পাসওয়ার্ড সাথে সাথে নিচের অ্যাডমিন তালিকায় আপডেট হয়ে দেখা যাবে।\n• অ্যাকাউন্ট ম্যানেজার (Account Managers): Google সাইন-ইন বা নিজে পাসওয়ার্ড রিসেট করতে পারবেন না — প্রয়োজনে অ্যাডমিনের সাহায্য নিবেন।"
                            } else {
                                "• All Admins: Can sign in with Google, reset their password via Forgot Password, and simultaneously log in using Email & Password. If any Admin resets their password, the updated password immediately appears in Admin Mode below.\n• Account Managers: Cannot reset password or sign in with Google — they must ask an Admin for help."
                            },
                            fontSize = 11.sp,
                            lineHeight = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF1E40AF)
                        )
                    }
                }
            }
        }

        // Compact Feedback Banner
        if (feedbackBanner != null) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = if (isErrorBanner) MaterialTheme.colorScheme.errorContainer else VaultEmeraldSoft,
                border = BorderStroke(
                    1.2.dp,
                    if (isErrorBanner) MaterialTheme.colorScheme.error else VaultEmeraldBorder
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = feedbackBanner!!,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isErrorBanner) MaterialTheme.colorScheme.onErrorContainer else Color(0xFF065F46),
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                )
            }
        }

        if (!isAdmin) {
            // Compact Non-Admin Card (Account Manager View)
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.5.dp, VaultIndigoBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.PointOfSale,
                            contentDescription = null,
                            tint = VaultIndigo,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isBengali) "অ্যাকাউন্ট ম্যানেজার (বিক্রয়)" else "Account Manager (Sales)",
                            fontWeight = FontWeight.ExtraBold,
                            style = MaterialTheme.typography.titleSmall
                        )
                    }
                    Text(
                        text = if (isBengali) {
                            "অ্যাকাউন্ট ম্যানেজার Google দিয়ে লগইন বা নিজে পাসওয়ার্ড রিসেট করতে পারবেন না। পাসওয়ার্ড বা লগইন সহায়তার জন্য স্টোর অ্যাডমিনের সাথে যোগাযোগ করুন।"
                        } else {
                            "Account Managers cannot reset their password or sign in with Google. Please ask a Store Admin for help with your credentials."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            // 3. Expandable Section: Account Managers (Shop Sales) — Mandatory Min 1
            ExpandableCompactSectionContainer(
                title = if (isBengali) "অ্যাকাউন্ট ম্যানেজার (দোকানে বিক্রয়)" else "Account Managers (Shop Sales)",
                subtitle = if (isBengali) "কমপক্ষে ১টি বাধ্যতামূলক • পাসওয়ার্ড সহায়তায় অ্যাডমিন" else "Min 1 mandatory • Ask Admin for password help",
                badgeText = "MIN 1 • ${managers.size}",
                icon = Icons.Default.PointOfSale,
                accentColor = VaultEmerald,
                borderColor = VaultEmeraldBorder,
                softBgColor = VaultEmeraldSoft,
                expanded = isManagersExpanded,
                onToggleExpand = { isManagersExpanded = !isManagersExpanded }
            ) {
                val isLastMandatoryManager = managers.size <= 1
                managers.forEachIndexed { index, manager ->
                    if (index > 0) {
                        Spacer(modifier = Modifier.height(6.dp))
                    }
                    CompactEditableAccountRow(
                        account = manager,
                        isCurrentUser = manager.email.equals(currentAccount.email, ignoreCase = true),
                        accentColor = VaultEmerald,
                        borderColor = VaultEmeraldBorder,
                        softBgColor = VaultEmeraldSoft,
                        canRemove = !isLastMandatoryManager,
                        statusNoteBadge = if (isLastMandatoryManager) {
                            if (isBengali) "১টি বাধ্যতামূলক" else "Min 1 Req."
                        } else null,
                        onEdit = { accountBeingEdited = manager },
                        onRemove = {
                            onRemoveAccount(manager.email).onSuccess {
                                isErrorBanner = false
                                feedbackBanner = "Removed Account Manager ${manager.email}"
                            }.onFailure { err ->
                                isErrorBanner = true
                                feedbackBanner = err.localizedMessage
                            }
                        }
                    )
                }
            }

            // 4. Expandable Section: Editable Admin Accounts (Live Synced Passwords)
            ExpandableCompactSectionContainer(
                title = if (isBengali) "অ্যাডমিন অ্যাকাউন্ট (এডিটযোগ্য)" else "Editable Admin Accounts",
                subtitle = if (isBengali) "Google + ইমেইল/পাসওয়ার্ড + Forgot Reset এখানে লাইভ দেখায়" else "Google + Email/Pass + Forgot Reset synced live here",
                badgeText = "ADMINS • ${editableAdmins.size}",
                icon = Icons.Default.VerifiedUser,
                accentColor = VaultIndigo,
                borderColor = VaultIndigoBorder,
                softBgColor = VaultIndigoSoft,
                expanded = isAdminsExpanded,
                onToggleExpand = { isAdminsExpanded = !isAdminsExpanded }
            ) {
                editableAdmins.forEachIndexed { index, admin ->
                    if (index > 0) {
                        Spacer(modifier = Modifier.height(6.dp))
                    }
                    val isSelf = admin.email.equals(currentAccount.email, ignoreCase = true)
                    val wasResetOrChanged = admin.addedBy.contains("Reset", ignoreCase = true) ||
                        admin.addedBy.contains("Changed", ignoreCase = true)
                    CompactEditableAccountRow(
                        account = admin,
                        isCurrentUser = isSelf,
                        accentColor = VaultIndigo,
                        borderColor = VaultIndigoBorder,
                        softBgColor = VaultIndigoSoft,
                        canRemove = !isSelf,
                        statusNoteBadge = if (wasResetOrChanged) "SYNCED RESET" else "GOOGLE + PASS",
                        onEdit = { accountBeingEdited = admin },
                        onRemove = {
                            onRemoveAccount(admin.email).onSuccess {
                                isErrorBanner = false
                                feedbackBanner = "Removed Admin ${admin.email}"
                            }.onFailure { err ->
                                isErrorBanner = true
                                feedbackBanner = err.localizedMessage
                            }
                        }
                    )
                }
            }

            // 5. Expandable Section: Locked Emergency Admin Vault
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        width = 1.7.dp,
                        brush = Brush.linearGradient(
                            listOf(VaultAmberBorder, Color(0xFFEF4444), VaultAmberBorder)
                        ),
                        shape = RoundedCornerShape(16.dp)
                    ),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { isLockedAdminsExpanded = !isLockedAdminsExpanded },
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = VaultAmberSoft,
                                border = BorderStroke(1.dp, VaultAmberBorder),
                                modifier = Modifier.size(28.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Default.Security,
                                        contentDescription = null,
                                        tint = VaultAmberGold,
                                        modifier = Modifier.size(15.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = if (isBengali) "🔒 লকড ইমার্জেন্সি অ্যাডমিন" else "🔒 Locked Emergency Admins",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = VaultAmberGold
                                )
                                Text(
                                    text = if (isBengali) {
                                        "শুধুমাত্র অ্যাডমিনদের কাছে দৃশ্যমান • ট্যাপ করে বিস্তারিত দেখুন"
                                    } else {
                                        "Admin-only visibility • Tap to expand/collapse"
                                    },
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Surface(
                                shape = RoundedCornerShape(50),
                                color = VaultAmberSoft,
                                border = BorderStroke(1.dp, VaultAmberGold)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Lock,
                                        contentDescription = null,
                                        tint = VaultAmberGold,
                                        modifier = Modifier.size(11.dp)
                                    )
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text(
                                        text = "LOCKED • ${lockedEmergencyAdmins.size}",
                                        color = VaultAmberGold,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.ExtraBold
                                    )
                                }
                            }
                            Icon(
                                imageVector = if (isLockedAdminsExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                contentDescription = "Toggle Locked Emergency Admins",
                                tint = VaultAmberGold,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    AnimatedVisibility(visible = isLockedAdminsExpanded) {
                        Column(
                            modifier = Modifier.padding(top = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            HorizontalDivider(color = VaultAmberBorder.copy(alpha = 0.35f))

                            lockedEmergencyAdmins.forEach { emergencyAdmin ->
                                CompactLockedEmergencyRow(
                                    account = emergencyAdmin,
                                    isCurrentUser = emergencyAdmin.email.equals(currentAccount.email, ignoreCase = true)
                                )
                            }

                            // Compact Shared Emergency Passwords Strip (All 5 valid passwords for both accounts)
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = VaultAmberSoft.copy(alpha = 0.7f),
                                border = BorderStroke(1.dp, VaultAmberBorder),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Text(
                                        text = if (isBengali) {
                                            "🔑 উভয় ইমার্জেন্সি অ্যাকাউন্টের ৫টি সক্রিয় পাসওয়ার্ড:"
                                        } else {
                                            "🔑 5 Valid Emergency Passwords (Active for Both Accounts):"
                                        },
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color(0xFF92400E)
                                    )
                                    FlowRow(
                                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                                        verticalArrangement = Arrangement.spacedBy(5.dp)
                                    ) {
                                        VaultAccessManager.EMERGENCY_ADMIN_PASSWORDS.forEach { emergencyPass ->
                                            Surface(
                                                shape = RoundedCornerShape(6.dp),
                                                color = Color.White,
                                                border = BorderStroke(1.dp, VaultAmberGold)
                                            ) {
                                                Text(
                                                    text = emergencyPass,
                                                    fontFamily = FontFamily.Monospace,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.ExtraBold,
                                                    color = Color(0xFF78350F),
                                                    modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
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
        }
    }

    // Add New Account Dialog
    showAddDialogRole?.let { targetRole ->
        AddVaultAccountDialog(
            role = targetRole,
            isBengali = isBengali,
            onDismiss = { showAddDialogRole = null },
            onConfirm = { name, email, pass, chosenRole ->
                val res = onAddAccount(name, email, pass, chosenRole)
                res.onSuccess { created ->
                    isErrorBanner = false
                    feedbackBanner = if (isBengali) {
                        "${created.role.labelBn} যোগ হয়েছে: ${created.email}"
                    } else {
                        "Saved ${created.role.labelEn}: ${created.email}"
                    }
                    showAddDialogRole = null
                }.onFailure { err ->
                    isErrorBanner = true
                    feedbackBanner = err.localizedMessage ?: "Error"
                }
            }
        )
    }

    // Edit Existing Account Dialog
    accountBeingEdited?.let { targetAccount ->
        val canChangeRoleToAdmin = !(targetAccount.role == VaultRole.ACCOUNT_MANAGER && managers.size <= 1)
        EditVaultAccountDialog(
            account = targetAccount,
            canSwitchRoleAwayFromManager = canChangeRoleToAdmin,
            isBengali = isBengali,
            onDismiss = { accountBeingEdited = null },
            onConfirm = { newName, newEmail, newPass, newRole ->
                val res = onEditAccount(
                    targetAccount.email,
                    newName,
                    newEmail,
                    newPass,
                    newRole
                )
                res.onSuccess { updated ->
                    isErrorBanner = false
                    feedbackBanner = if (isBengali) {
                        "আপডেট হয়েছে: ${updated.email}"
                    } else {
                        "Updated credentials for ${updated.email}"
                    }
                    accountBeingEdited = null
                }.onFailure { err ->
                    isErrorBanner = true
                    feedbackBanner = err.localizedMessage ?: "Error"
                }
            }
        )
    }
}

@Composable
private fun CompactStatChip(
    modifier: Modifier = Modifier,
    title: String,
    count: String,
    accent: Color,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(9.dp),
        color = Color.White.copy(alpha = 0.07f),
        border = BorderStroke(1.dp, accent.copy(alpha = 0.75f))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                color = Color(0xFFCBD5E1),
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = count,
                color = accent,
                fontSize = 12.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }
    }
}

@Composable
private fun ExpandableCompactSectionContainer(
    title: String,
    subtitle: String,
    badgeText: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accentColor: Color,
    borderColor: Color,
    softBgColor: Color,
    expanded: Boolean,
    onToggleExpand: () -> Unit,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.6.dp, borderColor, RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggleExpand),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = softBgColor,
                        border = BorderStroke(1.dp, borderColor),
                        modifier = Modifier.size(28.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = icon,
                                contentDescription = null,
                                tint = accentColor,
                                modifier = Modifier.size(15.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = title,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = subtitle,
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = softBgColor,
                        border = BorderStroke(1.dp, accentColor)
                    ) {
                        Text(
                            text = badgeText,
                            color = accentColor,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                    Icon(
                        imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = "Toggle $title",
                        tint = accentColor,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            AnimatedVisibility(visible = expanded) {
                Column(modifier = Modifier.padding(top = 8.dp)) {
                    HorizontalDivider(color = borderColor.copy(alpha = 0.3f))
                    Spacer(modifier = Modifier.height(8.dp))
                    content()
                }
            }
        }
    }
}

@Composable
private fun CompactEditableAccountRow(
    account: VaultUserAccount,
    isCurrentUser: Boolean,
    accentColor: Color,
    borderColor: Color,
    softBgColor: Color,
    canRemove: Boolean,
    statusNoteBadge: String?,
    onEdit: () -> Unit,
    onRemove: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f),
        border = BorderStroke(1.2.dp, borderColor.copy(alpha = 0.75f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 7.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = account.name,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.ExtraBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (isCurrentUser) {
                        Spacer(modifier = Modifier.width(5.dp))
                        Surface(
                            shape = CircleShape,
                            color = Color(0xFFDCFCE7),
                            border = BorderStroke(1.dp, Color(0xFF16A34A))
                        ) {
                            Text(
                                text = "YOU",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFF15803D),
                                modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                            )
                        }
                    }
                    if (statusNoteBadge != null) {
                        Spacer(modifier = Modifier.width(5.dp))
                        Surface(
                            shape = CircleShape,
                            color = softBgColor,
                            border = BorderStroke(1.dp, borderColor)
                        ) {
                            Text(
                                text = statusNoteBadge,
                                fontSize = 8.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = accentColor,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp)
                            )
                        }
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = account.email,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = softBgColor,
                        border = BorderStroke(1.dp, borderColor.copy(alpha = 0.8f))
                    ) {
                        Text(
                            text = "🔑 ${account.password}",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = accentColor,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp)
                        )
                    }
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Surface(
                    onClick = onEdit,
                    shape = RoundedCornerShape(8.dp),
                    color = softBgColor,
                    border = BorderStroke(1.dp, accentColor),
                    modifier = Modifier.testTag("edit_account_${account.email}")
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Edit ${account.email}",
                            tint = accentColor,
                            modifier = Modifier.size(12.dp)
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Text(
                            text = "Edit",
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = accentColor
                        )
                    }
                }

                if (canRemove) {
                    IconButton(
                        onClick = onRemove,
                        modifier = Modifier
                            .size(28.dp)
                            .testTag("remove_account_${account.email}")
                    ) {
                        Icon(
                            imageVector = Icons.Default.DeleteOutline,
                            contentDescription = "Remove ${account.email}",
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(15.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CompactLockedEmergencyRow(
    account: VaultUserAccount,
    isCurrentUser: Boolean
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("locked_emergency_admin_${account.email}"),
        shape = RoundedCornerShape(10.dp),
        color = VaultAmberSoft.copy(alpha = 0.55f),
        border = BorderStroke(1.2.dp, VaultAmberBorder)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = "Locked Emergency Admin",
                    tint = VaultAmberGold,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = account.name,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFF92400E)
                        )
                        if (isCurrentUser) {
                            Spacer(modifier = Modifier.width(5.dp))
                            Surface(
                                shape = CircleShape,
                                color = Color(0xFFFEF3C7),
                                border = BorderStroke(1.dp, VaultAmberGold)
                            ) {
                                Text(
                                    text = "YOU",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = VaultAmberGold,
                                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                                )
                            }
                        }
                    }
                    Text(
                        text = account.email,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF78350F)
                    )
                }
            }

            Surface(
                shape = RoundedCornerShape(7.dp),
                color = Color(0xFFFEF3C7),
                border = BorderStroke(1.dp, VaultAmberGold)
            ) {
                Text(
                    text = "🔒 LOCKED",
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color(0xFF92400E),
                    modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AddVaultAccountDialog(
    role: VaultRole,
    isBengali: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (name: String, email: String, password: String, role: VaultRole) -> Unit
) {
    var selectedRole by remember { mutableStateOf(role) }
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (selectedRole == VaultRole.ADMIN) {
                    if (isBengali) "নতুন অ্যাডমিন যোগ করুন" else "Add Admin Account"
                } else {
                    if (isBengali) "অ্যাকাউন্ট ম্যানেজার যোগ করুন" else "Add Account Manager (Sales)"
                },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    VaultRole.entries.forEach { r ->
                        FilterChip(
                            selected = selectedRole == r,
                            onClick = { selectedRole = r },
                            label = { Text(if (isBengali) r.labelBn else r.labelEn, fontSize = 12.sp) }
                        )
                    }
                }
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(if (isBengali) "নাম (Name)" else "Full Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text(if (isBengali) "ইমেইল (System Email) *" else "System Email *") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text(if (isBengali) "ভল্ট পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *" else "Vault Password (min 6 chars) *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(name, email, password, selectedRole) },
                enabled = email.contains("@") && password.trim().length >= 6,
                colors = ButtonDefaults.buttonColors(containerColor = VaultEmerald)
            ) {
                Text(if (isBengali) "সেভ করুন" else "Save Account")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(if (isBengali) "বাতিল" else "Cancel")
            }
        }
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EditVaultAccountDialog(
    account: VaultUserAccount,
    canSwitchRoleAwayFromManager: Boolean,
    isBengali: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (newName: String, newEmail: String, newPassword: String, newRole: VaultRole) -> Unit
) {
    var name by rememberSaveable(account.email) { mutableStateOf(account.name) }
    var email by rememberSaveable(account.email) { mutableStateOf(account.email) }
    var password by rememberSaveable(account.email) { mutableStateOf(account.password) }
    var selectedRole by rememberSaveable(account.email) { mutableStateOf(account.role) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (isBengali) "ইউজার অ্যাকাউন্ট এডিট করুন" else "Edit User Credentials",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    VaultRole.entries.forEach { roleOption ->
                        val enabled = if (account.role == VaultRole.ACCOUNT_MANAGER && roleOption != VaultRole.ACCOUNT_MANAGER) {
                            canSwitchRoleAwayFromManager
                        } else {
                            true
                        }
                        FilterChip(
                            selected = selectedRole == roleOption,
                            onClick = { if (enabled) selectedRole = roleOption },
                            enabled = enabled,
                            label = { Text(if (isBengali) roleOption.labelBn else roleOption.labelEn, fontSize = 12.sp) }
                        )
                    }
                }
                if (!canSwitchRoleAwayFromManager) {
                    Text(
                        text = if (isBengali) {
                            "কমপক্ষে ১টি অ্যাকাউন্ট ম্যানেজার থাকা বাধ্যতামূলক।"
                        } else {
                            "At least 1 Account Manager is mandatory."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = VaultEmerald
                    )
                }

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(if (isBengali) "নাম (Full Name)" else "Full Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text(if (isBengali) "ইমেইল (System Email) *" else "System Email *") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text(if (isBengali) "ভল্ট পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *" else "Vault Password (min 6 chars) *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(name, email, password, selectedRole) },
                enabled = email.contains("@") && password.trim().length >= 6,
                colors = ButtonDefaults.buttonColors(containerColor = VaultIndigo)
            ) {
                Text(if (isBengali) "আপডেট সেভ করুন" else "Save Changes")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(if (isBengali) "বাতিল" else "Cancel")
            }
        }
    )
}
