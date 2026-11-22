package com.example.ui.screens

import android.app.Activity
import android.content.Context
import android.util.Log
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudQueue
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MarkEmailRead
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import com.example.R
import com.example.data.auth.VaultAccessManager
import com.example.data.auth.VaultUserAccount
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential.Companion.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
import com.google.firebase.Firebase
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.auth
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

// Exact Typography matching the screenshot
private val VaultDisplayFont = FontFamily(
    Font(R.font.plus_jakarta_sans, FontWeight.Bold),
    Font(R.font.plus_jakarta_sans, FontWeight.ExtraBold)
)

private val VaultSansFont = FontFamily(
    Font(R.font.inter, FontWeight.Normal),
    Font(R.font.inter, FontWeight.Medium),
    Font(R.font.inter, FontWeight.SemiBold),
    Font(R.font.inter, FontWeight.Bold)
)

// Exact Color Palette sampled from Screenshot_20261109_192130
private val VaultMintBgTop = Color(0xFFE9F7F3)
private val VaultMintBgMid = Color(0xFFF3FAF8)
private val VaultMintBgBottom = Color(0xFFFFFFFF)
private val VaultPrimaryGreen = Color(0xFF00A86B)
private val VaultAccentTeal = Color(0xFF009B8A)
private val VaultBadgeBg = Color(0xFFE6F8F0)
private val VaultBadgeBorder = Color(0xFFB5F1D6)
private val VaultBadgeText = Color(0xFF059669)
private val VaultTitleNavy = Color(0xFF0B1528)
private val VaultSubtitleSlate = Color(0xFF64748B)
private val VaultLabelSlate = Color(0xFF475569)
private val VaultInputBg = Color(0xFFF8FAFC)
private val VaultInputBorder = Color(0xFFDCE4EC)
private val VaultPlaceholderGray = Color(0xFF8C9BAE)
private val VaultIconSlate = Color(0xFF4E5D73)
private val VaultChangePassBlue = Color(0xFF0088E8)

@Composable
fun AuthScreen(
    vaultAccessManager: VaultAccessManager,
    onVaultUnlocked: (VaultUserAccount) -> Unit,
    onGoogleAuthSuccess: () -> Unit,
    onOpenBlueprintGuide: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember(context) { CredentialManager.create(context) }

    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var infoMessage by remember { mutableStateOf<String?>(null) }

    var showChangePasswordDialog by rememberSaveable { mutableStateOf(false) }
    var showForgotPasswordDialog by rememberSaveable { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        VaultMintBgTop,
                        VaultMintBgMid,
                        VaultMintBgBottom
                    )
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 440.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(28.dp))

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(
                        elevation = 18.dp,
                        shape = RoundedCornerShape(28.dp),
                        ambientColor = Color(0xFF059669).copy(alpha = 0.12f),
                        spotColor = Color(0xFF0F172A).copy(alpha = 0.14f)
                    )
                    .testTag("encrypted_cloud_vault_card"),
                shape = RoundedCornerShape(28.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Top Emerald-Teal Accent Bar matching screenshot
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .background(
                                Brush.horizontalGradient(
                                    colors = listOf(
                                        VaultPrimaryGreen,
                                        VaultAccentTeal,
                                        VaultPrimaryGreen
                                    )
                                )
                            )
                    )

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp, vertical = 28.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // Attached Siaam Store Logo inside the White Rounded Tile
                        Surface(
                            modifier = Modifier
                                .size(86.dp)
                                .shadow(
                                    elevation = 10.dp,
                                    shape = RoundedCornerShape(22.dp),
                                    ambientColor = Color(0xFF059669).copy(alpha = 0.15f),
                                    spotColor = Color(0xFF0F172A).copy(alpha = 0.15f)
                                ),
                            shape = RoundedCornerShape(22.dp),
                            color = Color.White,
                            border = BorderStroke(1.5.dp, Color(0xFFE6F2EE))
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(6.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Image(
                                    painter = painterResource(id = R.drawable.ic_siaam_store_logo),
                                    contentDescription = "Siaam Store Logo",
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .clip(RoundedCornerShape(16.dp))
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(22.dp))

                        // "● ENCRYPTED CLOUD VAULT" Pill Badge matching screenshot
                        Surface(
                            shape = CircleShape,
                            color = VaultBadgeBg,
                            border = BorderStroke(1.dp, VaultBadgeBorder)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(7.dp)
                                        .clip(CircleShape)
                                        .background(VaultPrimaryGreen)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "ENCRYPTED CLOUD VAULT",
                                    style = TextStyle(
                                        fontFamily = VaultDisplayFont,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 11.sp,
                                        letterSpacing = 0.85.sp,
                                        color = VaultBadgeText
                                    )
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Main Store Title matching screenshot text style
                        Text(
                            text = "সিয়াম স্টোর | Siaam Store",
                            style = TextStyle(
                                fontFamily = VaultDisplayFont,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 22.sp,
                                letterSpacing = (-0.3).sp,
                                color = VaultTitleNavy
                            ),
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        // Subtitle matching screenshot text style
                        Text(
                            text = "Sign in with your authorized store credentials to continue to Siaam Store",
                            style = TextStyle(
                                fontFamily = VaultSansFont,
                                fontWeight = FontWeight.Normal,
                                fontSize = 13.5.sp,
                                color = VaultSubtitleSlate
                            ),
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(26.dp))

                        // SYSTEM EMAIL Label & Input Field
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.Start
                        ) {
                            Text(
                                text = "SYSTEM EMAIL",
                                style = TextStyle(
                                    fontFamily = VaultSansFont,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.5.sp,
                                    letterSpacing = 0.8.sp,
                                    color = VaultLabelSlate
                                ),
                                modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
                            )
                            OutlinedTextField(
                                value = email,
                                onValueChange = {
                                    email = it
                                    errorMessage = null
                                },
                                textStyle = TextStyle(
                                    fontFamily = VaultSansFont,
                                    fontWeight = FontWeight.Medium,
                                    fontSize = 15.sp,
                                    color = VaultTitleNavy
                                ),
                                placeholder = {
                                    Text(
                                        text = "Enter registered email",
                                        style = TextStyle(
                                            fontFamily = VaultSansFont,
                                            fontWeight = FontWeight.Normal,
                                            fontSize = 15.sp,
                                            color = VaultPlaceholderGray
                                        )
                                    )
                                },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.Email,
                                        contentDescription = "System Email",
                                        tint = VaultIconSlate,
                                        modifier = Modifier.size(20.dp)
                                    )
                                },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Email,
                                    imeAction = ImeAction.Next
                                ),
                                shape = RoundedCornerShape(14.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = VaultInputBg,
                                    unfocusedContainerColor = VaultInputBg,
                                    focusedBorderColor = VaultPrimaryGreen,
                                    unfocusedBorderColor = VaultInputBorder,
                                    focusedTextColor = VaultTitleNavy,
                                    unfocusedTextColor = VaultTitleNavy
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("vault_email_input")
                            )
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        // VAULT PASSWORD Label & Input Field
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.Start
                        ) {
                            Text(
                                text = "VAULT PASSWORD",
                                style = TextStyle(
                                    fontFamily = VaultSansFont,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.5.sp,
                                    letterSpacing = 0.8.sp,
                                    color = VaultLabelSlate
                                ),
                                modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
                            )
                            OutlinedTextField(
                                value = password,
                                onValueChange = {
                                    password = it
                                    errorMessage = null
                                },
                                textStyle = TextStyle(
                                    fontFamily = VaultSansFont,
                                    fontWeight = FontWeight.Medium,
                                    fontSize = 15.sp,
                                    color = VaultTitleNavy
                                ),
                                placeholder = {
                                    Text(
                                        text = "Enter vault password",
                                        style = TextStyle(
                                            fontFamily = VaultSansFont,
                                            fontWeight = FontWeight.Normal,
                                            fontSize = 15.sp,
                                            color = VaultPlaceholderGray
                                        )
                                    )
                                },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.Lock,
                                        contentDescription = "Vault Password",
                                        tint = VaultIconSlate,
                                        modifier = Modifier.size(20.dp)
                                    )
                                },
                                trailingIcon = {
                                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                        Icon(
                                            imageVector = if (passwordVisible) {
                                                Icons.Default.VisibilityOff
                                            } else {
                                                Icons.Default.Visibility
                                            },
                                            contentDescription = if (passwordVisible) "Hide password" else "Show password",
                                            tint = VaultIconSlate,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                },
                                visualTransformation = if (passwordVisible) {
                                    VisualTransformation.None
                                } else {
                                    PasswordVisualTransformation()
                                },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Password,
                                    imeAction = ImeAction.Done
                                ),
                                shape = RoundedCornerShape(14.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = VaultInputBg,
                                    unfocusedContainerColor = VaultInputBg,
                                    focusedBorderColor = VaultPrimaryGreen,
                                    unfocusedBorderColor = VaultInputBorder,
                                    focusedTextColor = VaultTitleNavy,
                                    unfocusedTextColor = VaultTitleNavy
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("vault_password_input")
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Forgot Password? & Change Password Row matching screenshot
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { showForgotPasswordDialog = true }
                                    .padding(vertical = 4.dp, horizontal = 2.dp)
                                    .testTag("forgot_password_button")
                            ) {
                                Icon(
                                    imageVector = Icons.Default.MarkEmailRead,
                                    contentDescription = null,
                                    tint = VaultPrimaryGreen,
                                    modifier = Modifier.size(17.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "Forgot Password?",
                                    style = TextStyle(
                                        fontFamily = VaultSansFont,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.5.sp,
                                        color = VaultPrimaryGreen
                                    )
                                )
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { showChangePasswordDialog = true }
                                    .padding(vertical = 4.dp, horizontal = 2.dp)
                                    .testTag("change_password_button")
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Key,
                                    contentDescription = null,
                                    tint = VaultChangePassBlue,
                                    modifier = Modifier.size(17.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "Change Password",
                                    style = TextStyle(
                                        fontFamily = VaultSansFont,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.5.sp,
                                        color = VaultChangePassBlue
                                    )
                                )
                            }
                        }

                        if (errorMessage != null) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Surface(
                                color = Color(0xFFFEE2E2),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = errorMessage!!,
                                    style = TextStyle(
                                        fontFamily = VaultSansFont,
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 12.5.sp,
                                        color = Color(0xFF991B1B)
                                    ),
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                        }

                        if (infoMessage != null) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Surface(
                                color = VaultBadgeBg,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = infoMessage!!,
                                    style = TextStyle(
                                        fontFamily = VaultSansFont,
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 12.5.sp,
                                        color = VaultBadgeText
                                    ),
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        // Primary CTA: "🛡️ Unlock Vault" Button matching screenshot
                        Button(
                            onClick = {
                                errorMessage = null
                                infoMessage = null
                                isLoading = true
                                scope.launch {
                                    val authResult = vaultAccessManager.authenticateWithEmailPasswordCloudAware(
                                        emailInput = email,
                                        passwordInput = password
                                    )
                                    isLoading = false
                                    authResult.onSuccess { account ->
                                        onVaultUnlocked(account)
                                    }.onFailure { err ->
                                        errorMessage = err.localizedMessage ?: "Invalid credentials"
                                    }
                                }
                            },
                            enabled = !isLoading,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(54.dp)
                                .shadow(
                                    elevation = 8.dp,
                                    shape = RoundedCornerShape(14.dp),
                                    ambientColor = VaultPrimaryGreen.copy(alpha = 0.35f),
                                    spotColor = VaultPrimaryGreen.copy(alpha = 0.35f)
                                )
                                .testTag("unlock_vault_button"),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = VaultPrimaryGreen,
                                contentColor = Color.White
                            ),
                            elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Shield,
                                contentDescription = null,
                                modifier = Modifier.size(19.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "Unlock Vault",
                                style = TextStyle(
                                    fontFamily = VaultDisplayFont,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    color = Color.White
                                )
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Admin-Only Google Sign-In via CredentialManager
                        OutlinedButton(
                            onClick = {
                                isLoading = true
                                errorMessage = null
                                infoMessage = null
                                onGoogleSignInClicked(
                                    context = context,
                                    credentialManager = credentialManager,
                                    onAuthSuccess = {
                                        isLoading = false
                                        val fbUser = Firebase.auth.currentUser
                                        val result = vaultAccessManager.authenticateFromGoogleUser(
                                            email = fbUser?.email,
                                            displayName = fbUser?.displayName
                                        )
                                        result.onSuccess { adminAccount ->
                                            onGoogleAuthSuccess()
                                            onVaultUnlocked(adminAccount)
                                        }.onFailure { err ->
                                            // Sign out unauthorized Google account immediately
                                            signOut(
                                                credentialManager = credentialManager,
                                                scope = scope
                                            )
                                            errorMessage = err.localizedMessage
                                                ?: "Google Sign-In is restricted to Admin accounts only."
                                        }
                                    },
                                    onAuthError = { msg ->
                                        isLoading = false
                                        errorMessage = msg
                                    },
                                    scope = scope,
                                    onAuthCancelled = {
                                        isLoading = false
                                    }
                                )
                            },
                            enabled = !isLoading,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                                .testTag("google_sign_in_button"),
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, VaultInputBorder),
                            contentPadding = PaddingValues(horizontal = 14.dp)
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    color = VaultPrimaryGreen,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text(
                                    text = "Admin Sign in with Google",
                                    style = TextStyle(
                                        fontFamily = VaultSansFont,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 13.sp,
                                        color = VaultLabelSlate
                                    )
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(22.dp))
                        HorizontalDivider(color = Color(0xFFEDF2F7), thickness = 1.dp)
                        Spacer(modifier = Modifier.height(16.dp))

                        // Bottom Status Footer Row matching screenshot
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.CloudQueue,
                                    contentDescription = null,
                                    tint = VaultPrimaryGreen,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "Firebase",
                                    style = TextStyle(
                                        fontFamily = VaultSansFont,
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 12.sp,
                                        color = VaultSubtitleSlate
                                    )
                                )
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f, fill = false)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.LocationOn,
                                    contentDescription = null,
                                    tint = VaultChangePassBlue,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "Ramchandrapur Haat",
                                    style = TextStyle(
                                        fontFamily = VaultSansFont,
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 12.sp,
                                        color = VaultSubtitleSlate
                                    ),
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

    if (showChangePasswordDialog) {
        ChangeVaultPasswordDialog(
            initialEmail = email,
            onDismiss = { showChangePasswordDialog = false },
            onSubmit = { targetEmail, currentPass, newPass ->
                val result = vaultAccessManager.changePasswordAndSyncToFirebase(
                    emailInput = targetEmail,
                    currentPasswordInput = currentPass,
                    newPasswordInput = newPass
                )
                result.onSuccess { updatedAcc ->
                    email = updatedAcc.email
                    password = updatedAcc.password
                    infoMessage =
                        "Password permanently updated & synced to Firebase for ${updatedAcc.email}! Visible in Admin Mode (User Management)."
                    errorMessage = null
                    showChangePasswordDialog = false
                }
                result
            }
        )
    }

    if (showForgotPasswordDialog) {
        ForgotVaultPasswordDialog(
            initialEmail = email,
            vaultAccessManager = vaultAccessManager,
            onResetCompleted = { resetEmail, updatedPass, message ->
                email = resetEmail
                if (updatedPass != null) {
                    password = updatedPass
                }
                infoMessage = message
                errorMessage = null
                showForgotPasswordDialog = false
            },
            onDismiss = { showForgotPasswordDialog = false }
        )
    }
}

@Composable
fun ChangeVaultPasswordDialog(
    initialEmail: String,
    onDismiss: () -> Unit,
    onSubmit: suspend (email: String, currentPassword: String, newPassword: String) -> Result<VaultUserAccount>
) {
    val scope = rememberCoroutineScope()
    var emailInput by rememberSaveable { mutableStateOf(initialEmail) }
    var currentPass by rememberSaveable { mutableStateOf("") }
    var newPass by rememberSaveable { mutableStateOf("") }
    var confirmPass by rememberSaveable { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }
    var isSyncing by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!isSyncing) onDismiss() },
        title = {
            Text(
                text = "Change Vault Password",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "Enter your registered email, current password, and new password. Changes are permanently saved, synced to Firebase Cloud Firestore, and reflected in Admin User Management.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                OutlinedTextField(
                    value = emailInput,
                    onValueChange = {
                        emailInput = it
                        localError = null
                    },
                    label = { Text("Registered Email *") },
                    singleLine = true,
                    enabled = !isSyncing,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = currentPass,
                    onValueChange = {
                        currentPass = it
                        localError = null
                    },
                    label = { Text("Current Password *") },
                    singleLine = true,
                    enabled = !isSyncing,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = newPass,
                    onValueChange = {
                        newPass = it
                        localError = null
                    },
                    label = { Text("New Password (min 6 chars) *") },
                    singleLine = true,
                    enabled = !isSyncing,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = confirmPass,
                    onValueChange = {
                        confirmPass = it
                        localError = null
                    },
                    label = { Text("Confirm New Password *") },
                    singleLine = true,
                    enabled = !isSyncing,
                    modifier = Modifier.fillMaxWidth()
                )
                if (localError != null) {
                    Surface(
                        color = Color(0xFFFEE2E2),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = localError!!,
                            color = Color(0xFF991B1B),
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (emailInput.isBlank() || !emailInput.contains("@")) {
                        localError = "Please enter a valid registered email."
                    } else if (currentPass.isBlank()) {
                        localError = "Please enter your current password."
                    } else if (newPass.trim().length < 6) {
                        localError = "New password must be at least 6 characters."
                    } else if (newPass.trim() != confirmPass.trim()) {
                        localError = "New passwords do not match."
                    } else {
                        isSyncing = true
                        localError = null
                        scope.launch {
                            val res = onSubmit(emailInput.trim(), currentPass.trim(), newPass.trim())
                            isSyncing = false
                            res.onFailure { err ->
                                localError = err.localizedMessage ?: "Failed to update password."
                            }
                        }
                    }
                },
                enabled = !isSyncing,
                colors = ButtonDefaults.buttonColors(containerColor = VaultPrimaryGreen)
            ) {
                Text(if (isSyncing) "Syncing to Firebase..." else "Update & Sync Password")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isSyncing) {
                Text("Cancel")
            }
        }
    )
}

/**
 * Forgot Password Dialog:
 * - Admin accounts: Allowed to reset their password in one step (permanently saved, synced to Firebase Firestore,
 *   and immediately reflected in Admin Mode User Management) + dispatches Firebase reset email link.
 * - Account Managers & non-admin accounts: Blocked from resetting via Forgot Password and instructed to ask an Admin for help.
 */
@Composable
private fun ForgotVaultPasswordDialog(
    initialEmail: String,
    vaultAccessManager: VaultAccessManager,
    onResetCompleted: (email: String, updatedPassword: String?, message: String) -> Unit,
    onDismiss: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var emailInput by rememberSaveable { mutableStateOf(initialEmail) }
    var newPasswordInput by rememberSaveable { mutableStateOf("") }
    var confirmPasswordInput by rememberSaveable { mutableStateOf("") }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var isError by remember { mutableStateOf(false) }
    var isSending by remember { mutableStateOf(false) }

    val isEmergencyEmail = remember(emailInput) {
        VaultAccessManager.isLockedEmergencyAdmin(emailInput)
    }

    AlertDialog(
        onDismissRequest = { if (!isSending) onDismiss() },
        title = {
            Text(
                text = "Forgot Vault Password? (Admin Reset)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "• All Admins can reset their password here and receive a Firebase reset email link. The new password is permanently saved, synced to Firebase, and immediately shown in Admin Mode (User Management).\n• Account Managers cannot reset password or sign in with Google — please ask an Admin for help.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                OutlinedTextField(
                    value = emailInput,
                    onValueChange = {
                        emailInput = it
                        statusMessage = null
                    },
                    label = { Text("Admin System Email *") },
                    singleLine = true,
                    enabled = !isSending,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("forgot_password_email_input")
                )

                if (!isEmergencyEmail) {
                    OutlinedTextField(
                        value = newPasswordInput,
                        onValueChange = {
                            newPasswordInput = it
                            statusMessage = null
                        },
                        label = { Text("New Admin Password (min 6 chars) *") },
                        singleLine = true,
                        enabled = !isSending,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("forgot_password_new_password_input")
                    )

                    OutlinedTextField(
                        value = confirmPasswordInput,
                        onValueChange = {
                            confirmPasswordInput = it
                            statusMessage = null
                        },
                        label = { Text("Confirm New Admin Password *") },
                        singleLine = true,
                        enabled = !isSending,
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    Surface(
                        color = VaultBadgeBg,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "🔒 Locked Emergency Admin (${emailInput.trim()}): Managed securely via Firebase Vault.",
                            color = VaultBadgeText,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }

                if (statusMessage != null) {
                    Surface(
                        color = if (isError) Color(0xFFFEE2E2) else VaultBadgeBg,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = statusMessage!!,
                            color = if (isError) Color(0xFF991B1B) else VaultBadgeText,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    isSending = true
                    statusMessage = null
                    scope.launch {
                        vaultAccessManager.refreshAccountFromFirestoreIfNeeded(emailInput)
                        val check = vaultAccessManager.verifyAdminForEmailReset(emailInput)
                        check.onSuccess { adminAcc ->
                            if (adminAcc.isLockedEmergencyAdmin) {
                                try {
                                    Firebase.auth.sendPasswordResetEmail(adminAcc.email).await()
                                } catch (e: Exception) {
                                    Log.i("VaultReset", "Reset link dispatched for ${adminAcc.email}: ${e.message}")
                                }
                                isSending = false
                                onResetCompleted(
                                    adminAcc.email,
                                    null,
                                    "Emergency Admin (${adminAcc.email}) verified. All 5 emergency passwords remain permanently active."
                                )
                            } else {
                                val cleanNew = newPasswordInput.trim()
                                val cleanConfirm = confirmPasswordInput.trim()
                                if (cleanNew.length < 6) {
                                    isSending = false
                                    isError = true
                                    statusMessage = "Please enter a new Admin password of at least 6 characters."
                                    return@onSuccess
                                }
                                if (cleanNew != cleanConfirm) {
                                    isSending = false
                                    isError = true
                                    statusMessage = "New passwords do not match."
                                    return@onSuccess
                                }

                                val resetRes = vaultAccessManager.resetPasswordByAdminAndSyncToFirebase(
                                    adminAcc.email,
                                    cleanNew
                                )
                                resetRes.onSuccess { updatedAcc ->
                                    try {
                                        Firebase.auth.sendPasswordResetEmail(adminAcc.email).await()
                                    } catch (e: Exception) {
                                        Log.i("VaultReset", "Reset link dispatched for ${adminAcc.email}: ${e.message}")
                                    }
                                    isSending = false
                                    onResetCompleted(
                                        updatedAcc.email,
                                        updatedAcc.password,
                                        "Password reset & permanently synced to Firebase for ${updatedAcc.email}! New password (${updatedAcc.password}) is now visible in Admin Mode (User Management)."
                                    )
                                }.onFailure { err ->
                                    isSending = false
                                    isError = true
                                    statusMessage = err.localizedMessage ?: "Failed to reset password."
                                }
                            }
                        }.onFailure { err ->
                            isSending = false
                            isError = true
                            statusMessage = err.localizedMessage
                                ?: "Account Managers cannot reset password or sign in with Google. Please ask an Admin for help."
                        }
                    }
                },
                enabled = !isSending && emailInput.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = VaultPrimaryGreen)
            ) {
                Text(
                    if (isSending) "Syncing to Firebase..."
                    else if (isEmergencyEmail) "Send Emergency Reset Link"
                    else "Reset & Sync to Firebase"
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isSending) {
                Text("Close")
            }
        }
    )
}

fun attemptAutoSignIn(
    context: Context,
    credentialManager: CredentialManager,
    onAuthSuccess: () -> Unit,
    onUnauthenticated: () -> Unit,
    scope: CoroutineScope
) {
    if (Firebase.auth.currentUser != null) {
        onAuthSuccess()
        return
    }
    val clientId = try {
        context.getString(R.string.default_web_client_id)
    } catch (e: Exception) {
        onUnauthenticated()
        return
    }

    val googleIdOption = GetGoogleIdOption.Builder()
        .setFilterByAuthorizedAccounts(true)
        .setServerClientId(clientId)
        .setAutoSelectEnabled(true)
        .build()

    val request = GetCredentialRequest.Builder().addCredentialOption(googleIdOption).build()

    scope.launch {
        try {
            val result = credentialManager.getCredential(context, request)
            val credential = result.credential
            if (credential is CustomCredential && credential.type == TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                val googleIdToken = GoogleIdTokenCredential.createFrom(credential.data).idToken
                val authCredential = GoogleAuthProvider.getCredential(googleIdToken, null)
                Firebase.auth.signInWithCredential(authCredential).await()
                onAuthSuccess()
            } else {
                onUnauthenticated()
            }
        } catch (e: Exception) {
            onUnauthenticated()
        }
    }
}

fun onGoogleSignInClicked(
    context: Context,
    credentialManager: CredentialManager,
    onAuthSuccess: () -> Unit,
    onAuthError: (String) -> Unit,
    scope: CoroutineScope,
    onAuthCancelled: () -> Unit = {}
) {
    val clientId = try {
        context.getString(R.string.default_web_client_id)
    } catch (e: Exception) {
        onAuthError("Google Sign-In configuration missing: default_web_client_id not found")
        return
    }

    val signInOption = GetSignInWithGoogleOption.Builder(serverClientId = clientId).build()
    val request = GetCredentialRequest.Builder().addCredentialOption(signInOption).build()

    scope.launch {
        try {
            val result = credentialManager.getCredential(context as Activity, request)
            val credential = result.credential
            if (credential is CustomCredential && credential.type == TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                val googleIdToken = GoogleIdTokenCredential.createFrom(credential.data).idToken
                val authCredential = GoogleAuthProvider.getCredential(googleIdToken, null)
                Firebase.auth.signInWithCredential(authCredential).await()
                onAuthSuccess()
            } else {
                onAuthError("Unexpected credential type")
            }
        } catch (e: GetCredentialCancellationException) {
            Log.w("Auth", "Google Sign-In flow cancelled or dismissed: ${e.message}", e)
            onAuthCancelled()
        } catch (e: Exception) {
            Log.e("Auth", "Google Sign-In failed", e)
            onAuthError(e.localizedMessage ?: "Sign in failed")
        }
    }
}

fun signOut(
    credentialManager: CredentialManager,
    scope: CoroutineScope,
    onSignOutComplete: () -> Unit = {}
) {
    scope.launch {
        withContext(NonCancellable) {
            try {
                credentialManager.clearCredentialState(ClearCredentialStateRequest())
            } catch (e: Exception) {
                Log.w("Auth", "Failed to clear credential state: ${e.message}")
            } finally {
                Firebase.auth.signOut()
                onSignOutComplete()
            }
        }
    }
}
