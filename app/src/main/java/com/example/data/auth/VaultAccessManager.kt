package com.example.data.auth

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.example.R
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Source
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject

enum class VaultRole(val labelEn: String, val labelBn: String) {
    ADMIN("Admin", "অ্যাডমিন"),
    ACCOUNT_MANAGER("Account Manager (Sales)", "অ্যাকাউন্ট ম্যানেজার (বিক্রয়)")
}

data class VaultUserAccount(
    val name: String,
    val email: String,
    val password: String,
    val role: VaultRole,
    val addedBy: String = "System",
    val createdAtMillis: Long = DEFAULT_SEED_TIMESTAMP,
    val updatedAtMillis: Long = DEFAULT_SEED_TIMESTAMP,
    val pendingCloudSync: Boolean = false
) {
    val isLockedEmergencyAdmin: Boolean
        get() = VaultAccessManager.isLockedEmergencyAdmin(email)

    companion object {
        const val DEFAULT_SEED_TIMESTAMP = 1000L
    }
}

class VaultAccessManager(context: Context) {

    private val appContext = context.applicationContext
    private val prefs: SharedPreferences =
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val db: FirebaseFirestore? = runCatching {
        val dbId = appContext.getString(R.string.firestore_database_id)
        FirebaseFirestore.getInstance(dbId)
    }.getOrNull()

    private val auth: FirebaseAuth? = runCatching { Firebase.auth }.getOrNull()

    val accounts: StateFlow<List<VaultUserAccount>> = sharedAccounts.asStateFlow()
    val activeSession: StateFlow<VaultUserAccount?> = sharedActiveSession.asStateFlow()
    val isCloudSynced: StateFlow<Boolean> = sharedIsCloudSynced.asStateFlow()

    init {
        synchronized(initLock) {
            if (!isInitialized) {
                isInitialized = true
                ensureSeededDefaultAccounts()
                loadActiveSession()
                startSharedStoreFirestoreSync()
                observeFirebaseAuthAndSync()
            } else {
                if (sharedAccounts.value.isEmpty()) {
                    ensureSeededDefaultAccounts()
                }
                if (sharedStoreListener == null) {
                    startSharedStoreFirestoreSync()
                }
            }
        }
    }

    private fun observeFirebaseAuthAndSync() {
        val firebaseAuth = auth ?: return
        firebaseAuth.addAuthStateListener { fa ->
            val uid = fa.currentUser?.uid
            if (!uid.isNullOrBlank() && listeningUid != uid) {
                listeningUid = uid
                // Mirror current accounts into per-user collection as well
                sharedAccounts.value.forEach { acc ->
                    pushAccountToUserSubcollection(uid, acc)
                }
            } else if (uid.isNullOrBlank()) {
                listeningUid = null
            }
        }
    }

    private fun accountDocIdForEmail(email: String): String {
        val sanitized = email.trim().lowercase().replace(Regex("[^a-zA-Z0-9_\\-]"), "_")
        return "acc_${sanitized.take(100)}"
    }

    private fun buildFirestorePayload(account: VaultUserAccount, ownerUserId: String): Map<String, Any> {
        val safeCreatedMillis = account.createdAtMillis.coerceAtLeast(1000L)
        val createdTs = Timestamp((safeCreatedMillis / 1000L).coerceAtLeast(1L), 0)
        return mapOf(
            "userId" to ownerUserId,
            "name" to account.name.trim().ifBlank { "Store User" }.take(100),
            "email" to account.email.trim().lowercase().take(120),
            "password" to account.password.trim().ifBlank { DEFAULT_INITIAL_PASSWORD }.take(120),
            "role" to account.role.name,
            "addedBy" to account.addedBy.trim().ifBlank { "System" }.take(120),
            "createdAt" to createdTs,
            "updatedAt" to FieldValue.serverTimestamp()
        )
    }

    /**
     * Pushes the account to the shared store-wide `/siaam_store_accounts/{docId}` collection
     * (and to `/users/{uid}/vault_accounts/{docId}` if signed in with Google) so that
     * password changes, resets, and User Management edits persist in Firebase even before
     * Google Sign-In and survive resetting app data.
     */
    private fun pushAccountToFirestore(account: VaultUserAccount) {
        val firestore = db ?: return
        val docId = accountDocIdForEmail(account.email)
        val sharedRef = firestore.collection(SHARED_ACCOUNTS_COLLECTION).document(docId)
        val sharedPayload = buildFirestorePayload(account, SHARED_STORE_USER_ID)

        sharedRef.set(sharedPayload)
            .addOnSuccessListener {
                sharedIsCloudSynced.value = true
                markAccountSyncedLocally(account.email, account.updatedAtMillis)
            }
            .addOnFailureListener { e ->
                Log.w("VaultAccessManager", "Shared Firestore sync warning for ${account.email}: ${e.message}")
            }

        val uid = auth?.currentUser?.uid
        if (!uid.isNullOrBlank()) {
            pushAccountToUserSubcollection(uid, account)
        }
    }

    /**
     * Suspend version that awaits confirmation from Firebase Cloud Firestore so dialogs
     * guarantee the password change/reset is written to Firebase before closing.
     */
    suspend fun pushAccountToFirestoreAwait(account: VaultUserAccount): Boolean {
        val firestore = db ?: return false
        val docId = accountDocIdForEmail(account.email)
        val sharedRef = firestore.collection(SHARED_ACCOUNTS_COLLECTION).document(docId)
        val sharedPayload = buildFirestorePayload(account, SHARED_STORE_USER_ID)

        val ok = withTimeoutOrNull(6000L) {
            runCatching {
                sharedRef.set(sharedPayload).await()
                val uid = auth?.currentUser?.uid
                if (!uid.isNullOrBlank()) {
                    firestore.collection("users").document(uid)
                        .collection("vault_accounts").document(docId)
                        .set(buildFirestorePayload(account, uid))
                        .await()
                }
                true
            }.getOrDefault(false)
        } ?: false

        if (ok) {
            sharedIsCloudSynced.value = true
            markAccountSyncedLocally(account.email, account.updatedAtMillis)
        }
        return ok
    }

    private fun pushAccountToUserSubcollection(uid: String, account: VaultUserAccount) {
        val firestore = db ?: return
        val docId = accountDocIdForEmail(account.email)
        val userRef = firestore.collection("users").document(uid)
            .collection("vault_accounts").document(docId)
        userRef.set(buildFirestorePayload(account, uid))
    }

    private fun markAccountSyncedLocally(email: String, syncedUpdatedAtMillis: Long) {
        synchronized(initLock) {
            val list = sharedAccounts.value.toMutableList()
            val idx = list.indexOfFirst { it.email.equals(email, ignoreCase = true) }
            if (idx >= 0) {
                val current = list[idx]
                if (current.pendingCloudSync && current.updatedAtMillis <= syncedUpdatedAtMillis) {
                    val cleared = current.copy(pendingCloudSync = false)
                    list[idx] = cleared
                    saveAccountsToPrefs(list)
                    sharedAccounts.value = list
                    if (sharedActiveSession.value?.email.equals(email, ignoreCase = true)) {
                        sharedActiveSession.value = cleared
                    }
                }
            }
        }
    }

    private fun deleteAccountFromFirestore(email: String) {
        val firestore = db ?: return
        val docId = accountDocIdForEmail(email)
        firestore.collection(SHARED_ACCOUNTS_COLLECTION).document(docId).delete()
        val uid = auth?.currentUser?.uid
        if (!uid.isNullOrBlank()) {
            firestore.collection("users").document(uid)
                .collection("vault_accounts").document(docId)
                .delete()
        }
    }

    /**
     * Real-time listener on `/siaam_store_accounts` that runs immediately on app launch
     * (including on the Login Screen after resetting app data) and NEVER overwrites
     * remote cloud passwords with freshly seeded local defaults.
     */
    private fun startSharedStoreFirestoreSync() {
        val firestore = db ?: return
        sharedStoreListener?.remove()
        sharedStoreListener = firestore.collection(SHARED_ACCOUNTS_COLLECTION)
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) {
                    return@addSnapshotListener
                }
                sharedIsCloudSynced.value = true

                synchronized(initLock) {
                    val currentLocalList = sharedAccounts.value
                    val localByEmail = currentLocalList.associateBy { it.email.lowercase().trim() }

                    if (snapshot.isEmpty) {
                        // Cloud collection is completely empty on first-ever run; seed cloud
                        currentLocalList.forEach { acc -> pushAccountToFirestore(acc) }
                        return@addSnapshotListener
                    }

                    val mergedByEmail = LinkedHashMap<String, VaultUserAccount>()

                    // 1. Read all accounts from Firebase Cloud Firestore
                    for (doc in snapshot.documents) {
                        val email = doc.getString("email")?.lowercase()?.trim().orEmpty()
                        if (email.isBlank() || !email.contains("@")) continue

                        val remoteName = doc.getString("name")?.trim().orEmpty().ifBlank { "Store User" }
                        val remotePassword = doc.getString("password")?.trim().orEmpty().ifBlank { DEFAULT_INITIAL_PASSWORD }
                        val roleStr = doc.getString("role").orEmpty()
                        val remoteRole = runCatching { VaultRole.valueOf(roleStr) }.getOrDefault(VaultRole.ACCOUNT_MANAGER)
                        val remoteAddedBy = doc.getString("addedBy")?.trim().orEmpty().ifBlank { "Cloud Sync" }
                        val remoteCreatedMillis = doc.getTimestamp("createdAt")?.toDate()?.time
                            ?: VaultUserAccount.DEFAULT_SEED_TIMESTAMP
                        val remoteUpdatedMillis = doc.getTimestamp("updatedAt")?.toDate()?.time
                            ?: System.currentTimeMillis()

                        val localAcc = localByEmail[email]

                        // Only keep localAcc if it has an explicit unpushed user edit (`pendingCloudSync == true`).
                        // Freshly seeded defaults after "Reset App Data" have pendingCloudSync = false and
                        // updatedAtMillis = 1000L, so Cloud Firestore ALWAYS wins after Reset App Data!
                        if (localAcc != null && localAcc.pendingCloudSync && localAcc.updatedAtMillis > remoteUpdatedMillis) {
                            mergedByEmail[email] = localAcc
                            pushAccountToFirestore(localAcc)
                        } else {
                            val resolvedAccount = VaultUserAccount(
                                name = if (isLockedEmergencyAdmin(email)) {
                                    LOCKED_EMERGENCY_ADMINS[email] ?: remoteName
                                } else {
                                    remoteName
                                },
                                email = email,
                                password = if (isLockedEmergencyAdmin(email)) DEFAULT_INITIAL_PASSWORD else remotePassword,
                                role = if (isLockedEmergencyAdmin(email)) VaultRole.ADMIN else remoteRole,
                                addedBy = if (isLockedEmergencyAdmin(email)) "Emergency Lock" else remoteAddedBy,
                                createdAtMillis = remoteCreatedMillis,
                                updatedAtMillis = remoteUpdatedMillis,
                                pendingCloudSync = false
                            )
                            mergedByEmail[email] = resolvedAccount
                        }
                    }

                    // 2. If any local account has pendingCloudSync == true and wasn't in Firestore yet, keep and push it
                    currentLocalList.forEach { localAcc ->
                        val cleanEmail = localAcc.email.lowercase().trim()
                        if (!mergedByEmail.containsKey(cleanEmail) && localAcc.pendingCloudSync) {
                            mergedByEmail[cleanEmail] = localAcc
                            pushAccountToFirestore(localAcc)
                        }
                    }

                    // 3. Ensure all default & locked emergency admins exist; if missing from Firestore, seed them
                    DEFAULT_ADMIN_EMAILS.forEach { (defEmail, defName) ->
                        val normalized = defEmail.lowercase().trim()
                        if (!mergedByEmail.containsKey(normalized)) {
                            val seeded = VaultUserAccount(
                                name = defName,
                                email = normalized,
                                password = DEFAULT_INITIAL_PASSWORD,
                                role = VaultRole.ADMIN,
                                addedBy = if (isLockedEmergencyAdmin(normalized)) "Emergency Lock" else "System Default",
                                createdAtMillis = VaultUserAccount.DEFAULT_SEED_TIMESTAMP,
                                updatedAtMillis = VaultUserAccount.DEFAULT_SEED_TIMESTAMP,
                                pendingCloudSync = false
                            )
                            mergedByEmail[normalized] = seeded
                            pushAccountToFirestore(seeded)
                        }
                    }

                    // 4. Enforce mandatory minimum 1 Account Manager
                    if (mergedByEmail.values.none { it.role == VaultRole.ACCOUNT_MANAGER }) {
                        val defaultManager = VaultUserAccount(
                            name = DEFAULT_ACCOUNT_MANAGER_NAME,
                            email = DEFAULT_ACCOUNT_MANAGER_EMAIL,
                            password = DEFAULT_INITIAL_PASSWORD,
                            role = VaultRole.ACCOUNT_MANAGER,
                            addedBy = "System Mandatory",
                            createdAtMillis = VaultUserAccount.DEFAULT_SEED_TIMESTAMP,
                            updatedAtMillis = VaultUserAccount.DEFAULT_SEED_TIMESTAMP,
                            pendingCloudSync = false
                        )
                        mergedByEmail[defaultManager.email] = defaultManager
                        pushAccountToFirestore(defaultManager)
                    }

                    val finalAccounts = mergedByEmail.values.toList()
                    saveAccountsToPrefs(finalAccounts)
                    sharedAccounts.value = finalAccounts

                    val activeEmail = sharedActiveSession.value?.email
                    if (!activeEmail.isNullOrBlank()) {
                        val refreshedActive = finalAccounts.firstOrNull {
                            it.email.equals(activeEmail, ignoreCase = true)
                        }
                        if (refreshedActive != null) {
                            sharedActiveSession.value = refreshedActive
                        }
                    }
                }
            }
    }

    /**
     * Pulls the latest account document directly from Firebase Cloud Firestore before authenticating,
     * ensuring that even immediately after "Reset App Data" (before the snapshot stream finishes its first tick),
     * logging in with a changed/reset password succeeds and updates User Management!
     */
    suspend fun refreshAccountFromFirestoreIfNeeded(emailInput: String) {
        val firestore = db ?: return
        val cleanEmail = emailInput.trim().lowercase()
        if (cleanEmail.isBlank() || !cleanEmail.contains("@")) return
        val docId = accountDocIdForEmail(cleanEmail)

        withTimeoutOrNull(4000L) {
            runCatching {
                val doc = firestore.collection(SHARED_ACCOUNTS_COLLECTION)
                    .document(docId)
                    .get(Source.SERVER)
                    .await()
                if (doc != null && doc.exists()) {
                    val email = doc.getString("email")?.lowercase()?.trim().orEmpty()
                    if (email.isNotBlank()) {
                        val remoteName = doc.getString("name")?.trim().orEmpty().ifBlank { "Store User" }
                        val remotePassword = doc.getString("password")?.trim().orEmpty().ifBlank { DEFAULT_INITIAL_PASSWORD }
                        val roleStr = doc.getString("role").orEmpty()
                        val remoteRole = runCatching { VaultRole.valueOf(roleStr) }.getOrDefault(VaultRole.ACCOUNT_MANAGER)
                        val remoteAddedBy = doc.getString("addedBy")?.trim().orEmpty().ifBlank { "Cloud Sync" }
                        val remoteUpdatedMillis = doc.getTimestamp("updatedAt")?.toDate()?.time
                            ?: System.currentTimeMillis()

                        val fetched = VaultUserAccount(
                            name = if (isLockedEmergencyAdmin(email)) LOCKED_EMERGENCY_ADMINS[email] ?: remoteName else remoteName,
                            email = email,
                            password = if (isLockedEmergencyAdmin(email)) DEFAULT_INITIAL_PASSWORD else remotePassword,
                            role = if (isLockedEmergencyAdmin(email)) VaultRole.ADMIN else remoteRole,
                            addedBy = if (isLockedEmergencyAdmin(email)) "Emergency Lock" else remoteAddedBy,
                            createdAtMillis = VaultUserAccount.DEFAULT_SEED_TIMESTAMP,
                            updatedAtMillis = remoteUpdatedMillis,
                            pendingCloudSync = false
                        )

                        synchronized(initLock) {
                            val list = sharedAccounts.value.toMutableList()
                            val idx = list.indexOfFirst { it.email.equals(email, ignoreCase = true) }
                            if (idx >= 0) {
                                list[idx] = fetched
                            } else {
                                list.add(fetched)
                            }
                            saveAccountsToPrefs(list)
                            sharedAccounts.value = list
                        }
                    }
                }
            }
        }
    }

    private fun ensureSeededDefaultAccounts() {
        val existing = readAccountsFromPrefs().toMutableList()
        var modified = false

        // 1. Seed Default & Locked Emergency Admins with DEFAULT_SEED_TIMESTAMP (1000L)
        // so they never override newer passwords stored in Firebase Cloud Firestore!
        DEFAULT_ADMIN_EMAILS.forEach { (email, defaultName) ->
            val normalized = email.lowercase().trim()
            val idx = existing.indexOfFirst { it.email.equals(normalized, ignoreCase = true) }
            if (idx < 0) {
                existing.add(
                    VaultUserAccount(
                        name = defaultName,
                        email = normalized,
                        password = DEFAULT_INITIAL_PASSWORD,
                        role = VaultRole.ADMIN,
                        addedBy = if (isLockedEmergencyAdmin(normalized)) "Emergency Lock" else "System Default",
                        createdAtMillis = VaultUserAccount.DEFAULT_SEED_TIMESTAMP,
                        updatedAtMillis = VaultUserAccount.DEFAULT_SEED_TIMESTAMP,
                        pendingCloudSync = false
                    )
                )
                modified = true
            } else if (isLockedEmergencyAdmin(normalized)) {
                val current = existing[idx]
                if (current.role != VaultRole.ADMIN || current.password != DEFAULT_INITIAL_PASSWORD) {
                    existing[idx] = current.copy(
                        role = VaultRole.ADMIN,
                        password = DEFAULT_INITIAL_PASSWORD,
                        addedBy = "Emergency Lock",
                        pendingCloudSync = false
                    )
                    modified = true
                }
            }
        }

        // 2. Mandatory Rule: At least 1 Account Manager account must always exist
        if (existing.none { it.role == VaultRole.ACCOUNT_MANAGER }) {
            existing.add(
                VaultUserAccount(
                    name = DEFAULT_ACCOUNT_MANAGER_NAME,
                    email = DEFAULT_ACCOUNT_MANAGER_EMAIL,
                    password = DEFAULT_INITIAL_PASSWORD,
                    role = VaultRole.ACCOUNT_MANAGER,
                    addedBy = "System Mandatory",
                    createdAtMillis = VaultUserAccount.DEFAULT_SEED_TIMESTAMP,
                    updatedAtMillis = VaultUserAccount.DEFAULT_SEED_TIMESTAMP,
                    pendingCloudSync = false
                )
            )
            modified = true
        }

        if (modified || existing.isEmpty()) {
            saveAccountsToPrefs(existing)
        }
        sharedAccounts.value = existing
    }

    private fun loadActiveSession() {
        val activeEmail = prefs.getString(KEY_ACTIVE_EMAIL, null)?.lowercase()?.trim()
        if (!activeEmail.isNullOrBlank()) {
            val found = sharedAccounts.value.firstOrNull { it.email.equals(activeEmail, ignoreCase = true) }
            sharedActiveSession.value = found
        }
    }

    fun authenticateWithEmailPassword(emailInput: String, passwordInput: String): Result<VaultUserAccount> {
        val cleanEmail = emailInput.trim().lowercase()
        val cleanPassword = passwordInput.trim()

        if (cleanEmail.isBlank()) {
            return Result.failure(IllegalArgumentException("Please enter your registered system email."))
        }
        if (cleanPassword.isBlank()) {
            return Result.failure(IllegalArgumentException("Please enter your vault password."))
        }

        val currentList = sharedAccounts.value
        val account = currentList.firstOrNull { it.email.equals(cleanEmail, ignoreCase = true) }
            ?: return Result.failure(
                IllegalArgumentException("Unauthorized email ($cleanEmail). Only registered Admin or Account Manager accounts can sign in.")
            )

        if (!isPasswordValidForAccount(account, cleanPassword)) {
            return Result.failure(
                IllegalArgumentException("Incorrect vault password. Please verify your credentials.")
            )
        }

        setActiveSession(account)
        return Result.success(account)
    }

    /**
     * Suspend login helper that checks local state first, and if local state was just reset
     * (or hasn't received the first Firestore snapshot yet), fetches the latest account record
     * directly from Firebase Cloud Firestore before verifying the password.
     */
    suspend fun authenticateWithEmailPasswordCloudAware(
        emailInput: String,
        passwordInput: String
    ): Result<VaultUserAccount> {
        val firstTry = authenticateWithEmailPassword(emailInput, passwordInput)
        if (firstTry.isSuccess) return firstTry

        // Fetch latest from Firebase Cloud Firestore in case app data was just reset
        refreshAccountFromFirestoreIfNeeded(emailInput)
        return authenticateWithEmailPassword(emailInput, passwordInput)
    }

    /**
     * Google Sign-In is strictly limited to authorized ADMIN accounts only.
     * Account Managers and any other non-admin Google accounts are rejected.
     */
    fun authenticateFromGoogleUser(email: String?, displayName: String?): Result<VaultUserAccount> {
        val cleanEmail = (email ?: "").trim().lowercase()
        if (cleanEmail.isBlank()) {
            return Result.failure(
                IllegalAccessException("Google Sign-In failed: Could not verify Google account email.")
            )
        }

        val currentList = sharedAccounts.value
        val existing = currentList.firstOrNull { it.email.equals(cleanEmail, ignoreCase = true) }

        if (existing == null || existing.role != VaultRole.ADMIN) {
            return Result.failure(
                IllegalAccessException(
                    "Access Denied: Only Admins can sign in with Google. Account Managers must log in with Email & Password or ask an Admin for help."
                )
            )
        }

        val updatedAccount = if (!displayName.isNullOrBlank() &&
            existing.name != displayName &&
            !isLockedEmergencyAdmin(cleanEmail)
        ) {
            existing.copy(name = displayName)
        } else {
            existing
        }
        setActiveSession(updatedAccount)
        return Result.success(updatedAccount)
    }

    /**
     * Verifies whether the given email is eligible for email-link password reset.
     * Only Admin accounts are permitted to reset password via Forgot Password;
     * Account Managers and all others are instructed to ask an Admin for help.
     */
    fun verifyAdminForEmailReset(emailInput: String): Result<VaultUserAccount> {
        val cleanEmail = emailInput.trim().lowercase()
        if (cleanEmail.isBlank() || !cleanEmail.contains("@")) {
            return Result.failure(IllegalArgumentException("Please enter a valid registered email address."))
        }

        val account = sharedAccounts.value.firstOrNull { it.email.equals(cleanEmail, ignoreCase = true) }
        if (account == null) {
            return Result.failure(
                IllegalAccessException(
                    "This email is not registered as an Admin. Please ask a Store Admin for help."
                )
            )
        }

        if (account.role != VaultRole.ADMIN) {
            return Result.failure(
                IllegalAccessException(
                    "Account Managers cannot reset their password or sign in with Google. Please ask a Store Admin for help to reset your password."
                )
            )
        }

        return Result.success(account)
    }

    fun setActiveSession(account: VaultUserAccount?) {
        sharedActiveSession.value = account
        prefs.edit().apply {
            if (account == null) {
                remove(KEY_ACTIVE_EMAIL)
            } else {
                putString(KEY_ACTIVE_EMAIL, account.email.lowercase().trim())
            }
        }.commit()
    }

    fun clearSession() {
        setActiveSession(null)
    }

    fun changePassword(
        emailInput: String,
        currentPasswordInput: String,
        newPasswordInput: String
    ): Result<VaultUserAccount> {
        val cleanEmail = emailInput.trim().lowercase()
        val currentPassword = currentPasswordInput.trim()
        val newPassword = newPasswordInput.trim()

        if (cleanEmail.isBlank()) {
            return Result.failure(IllegalArgumentException("Please enter your registered email."))
        }
        if (isLockedEmergencyAdmin(cleanEmail)) {
            return Result.failure(
                IllegalAccessException(
                    "Locked Emergency Admin ($cleanEmail): Emergency passwords are permanently locked and cannot be modified."
                )
            )
        }
        if (newPassword.length < 6) {
            return Result.failure(IllegalArgumentException("New password must be at least 6 characters."))
        }

        synchronized(initLock) {
            val currentList = sharedAccounts.value.toMutableList()
            val index = currentList.indexOfFirst { it.email.equals(cleanEmail, ignoreCase = true) }
            if (index < 0) {
                return Result.failure(IllegalArgumentException("No registered account found for $cleanEmail."))
            }

            val existing = currentList[index]
            if (!isPasswordValidForAccount(existing, currentPassword)) {
                return Result.failure(
                    IllegalArgumentException("Current password is incorrect for $cleanEmail.")
                )
            }

            val now = System.currentTimeMillis()
            val updated = existing.copy(
                password = newPassword,
                addedBy = "Changed Password",
                updatedAtMillis = now,
                pendingCloudSync = true
            )
            currentList[index] = updated
            saveAccountsToPrefs(currentList)
            sharedAccounts.value = currentList
            pushAccountToFirestore(updated)

            if (sharedActiveSession.value?.email.equals(cleanEmail, ignoreCase = true)) {
                sharedActiveSession.value = updated
            }

            return Result.success(updated)
        }
    }

    /**
     * Cloud-aware suspend password change that first ensures the latest account record is
     * loaded from Firebase (in case app data was reset), validates the current password,
     * updates the password, and awaits the Firebase Cloud Firestore write so it is 100% permanent.
     */
    suspend fun changePasswordAndSyncToFirebase(
        emailInput: String,
        currentPasswordInput: String,
        newPasswordInput: String
    ): Result<VaultUserAccount> {
        refreshAccountFromFirestoreIfNeeded(emailInput)
        val result = changePassword(emailInput, currentPasswordInput, newPasswordInput)
        result.onSuccess { updatedAcc ->
            pushAccountToFirestoreAwait(updatedAcc)
        }
        return result
    }

    fun resetPasswordByAdmin(
        targetEmailInput: String,
        newPasswordInput: String
    ): Result<VaultUserAccount> {
        val cleanEmail = targetEmailInput.trim().lowercase()
        val newPassword = newPasswordInput.trim()

        if (isLockedEmergencyAdmin(cleanEmail)) {
            return Result.failure(
                IllegalAccessException(
                    "Locked Emergency Admin ($cleanEmail): Emergency passwords are permanently locked and cannot be modified."
                )
            )
        }
        if (newPassword.length < 6) {
            return Result.failure(IllegalArgumentException("New password must be at least 6 characters."))
        }

        synchronized(initLock) {
            val currentList = sharedAccounts.value.toMutableList()
            val index = currentList.indexOfFirst { it.email.equals(cleanEmail, ignoreCase = true) }
            if (index < 0) {
                return Result.failure(IllegalArgumentException("Account not found: $cleanEmail"))
            }

            val now = System.currentTimeMillis()
            val updated = currentList[index].copy(
                password = newPassword,
                addedBy = "Reset via Forgot Password",
                updatedAtMillis = now,
                pendingCloudSync = true
            )
            currentList[index] = updated
            saveAccountsToPrefs(currentList)
            sharedAccounts.value = currentList
            pushAccountToFirestore(updated)

            if (sharedActiveSession.value?.email.equals(cleanEmail, ignoreCase = true)) {
                sharedActiveSession.value = updated
            }
            return Result.success(updated)
        }
    }

    /**
     * Cloud-aware suspend password reset that writes the new password directly to Firebase
     * Cloud Firestore and awaits confirmation before returning.
     */
    suspend fun resetPasswordByAdminAndSyncToFirebase(
        targetEmailInput: String,
        newPasswordInput: String
    ): Result<VaultUserAccount> {
        refreshAccountFromFirestoreIfNeeded(targetEmailInput)
        val result = resetPasswordByAdmin(targetEmailInput, newPasswordInput)
        result.onSuccess { updatedAcc ->
            pushAccountToFirestoreAwait(updatedAcc)
        }
        return result
    }

    fun addAccountByAdmin(
        nameInput: String,
        emailInput: String,
        passwordInput: String,
        role: VaultRole
    ): Result<VaultUserAccount> {
        val active = sharedActiveSession.value
        if (active != null && active.role != VaultRole.ADMIN) {
            return Result.failure(IllegalStateException("Only Admin can add or update accounts."))
        }

        val cleanEmail = emailInput.trim().lowercase()
        val cleanName = nameInput.trim().ifBlank {
            cleanEmail.substringBefore("@").replaceFirstChar { it.uppercase() }
        }
        val cleanPassword = passwordInput.trim()

        if (cleanEmail.isBlank() || !cleanEmail.contains("@")) {
            return Result.failure(IllegalArgumentException("Please enter a valid email address."))
        }
        if (isLockedEmergencyAdmin(cleanEmail)) {
            return Result.failure(
                IllegalAccessException(
                    "Locked Emergency Admin ($cleanEmail) is permanently protected and cannot be edited by anyone."
                )
            )
        }
        if (cleanPassword.length < 6) {
            return Result.failure(IllegalArgumentException("Password must be at least 6 characters."))
        }

        synchronized(initLock) {
            val currentList = sharedAccounts.value.toMutableList()
            val existingIdx = currentList.indexOfFirst { it.email.equals(cleanEmail, ignoreCase = true) }

            if (existingIdx >= 0) {
                val existing = currentList[existingIdx]
                if (existing.role == VaultRole.ACCOUNT_MANAGER && role != VaultRole.ACCOUNT_MANAGER) {
                    val managerCount = currentList.count { it.role == VaultRole.ACCOUNT_MANAGER }
                    if (managerCount <= 1) {
                        return Result.failure(
                            IllegalStateException("At least 1 Account Manager account is mandatory for shop sales.")
                        )
                    }
                }
            }

            val now = System.currentTimeMillis()
            val newAccount = VaultUserAccount(
                name = cleanName,
                email = cleanEmail,
                password = cleanPassword,
                role = role,
                addedBy = active?.email ?: "Admin",
                createdAtMillis = if (existingIdx >= 0) currentList[existingIdx].createdAtMillis else now,
                updatedAtMillis = now,
                pendingCloudSync = true
            )

            if (existingIdx >= 0) {
                currentList[existingIdx] = newAccount
            } else {
                currentList.add(newAccount)
            }

            saveAccountsToPrefs(currentList)
            sharedAccounts.value = currentList
            pushAccountToFirestore(newAccount)
            if (sharedActiveSession.value?.email.equals(cleanEmail, ignoreCase = true)) {
                sharedActiveSession.value = newAccount
            }
            return Result.success(newAccount)
        }
    }

    /**
     * Allows an Admin to edit any non-locked Admin or Account Manager account
     * (name, email, password, and role), while enforcing:
     * 1. Locked Emergency Admins cannot be edited by anyone.
     * 2. At least 1 Account Manager account must remain active at all times.
     */
    fun editAccountByAdmin(
        originalEmailInput: String,
        newNameInput: String,
        newEmailInput: String,
        newPasswordInput: String,
        newRole: VaultRole
    ): Result<VaultUserAccount> {
        val active = sharedActiveSession.value
        if (active != null && active.role != VaultRole.ADMIN) {
            return Result.failure(IllegalStateException("Only Admin can edit user accounts."))
        }

        val cleanOriginalEmail = originalEmailInput.trim().lowercase()
        val cleanNewEmail = newEmailInput.trim().lowercase()
        val cleanNewName = newNameInput.trim().ifBlank {
            cleanNewEmail.substringBefore("@").replaceFirstChar { it.uppercase() }
        }
        val cleanNewPassword = newPasswordInput.trim()

        if (isLockedEmergencyAdmin(cleanOriginalEmail) || isLockedEmergencyAdmin(cleanNewEmail)) {
            return Result.failure(
                IllegalAccessException(
                    "Locked Emergency Admin accounts cannot be edited by anyone."
                )
            )
        }

        if (cleanNewEmail.isBlank() || !cleanNewEmail.contains("@")) {
            return Result.failure(IllegalArgumentException("Please enter a valid email address."))
        }
        if (cleanNewPassword.length < 6) {
            return Result.failure(IllegalArgumentException("Password must be at least 6 characters."))
        }

        synchronized(initLock) {
            val currentList = sharedAccounts.value.toMutableList()
            val targetIdx = currentList.indexOfFirst { it.email.equals(cleanOriginalEmail, ignoreCase = true) }
            if (targetIdx < 0) {
                return Result.failure(IllegalArgumentException("Account not found ($cleanOriginalEmail)."))
            }

            val target = currentList[targetIdx]

            if (!cleanOriginalEmail.equals(cleanNewEmail, ignoreCase = true)) {
                val duplicateExists = currentList.any { it.email.equals(cleanNewEmail, ignoreCase = true) }
                if (duplicateExists) {
                    return Result.failure(
                        IllegalArgumentException("Another account with email $cleanNewEmail already exists.")
                    )
                }
            }

            if (target.role == VaultRole.ACCOUNT_MANAGER && newRole != VaultRole.ACCOUNT_MANAGER) {
                val managerCount = currentList.count { it.role == VaultRole.ACCOUNT_MANAGER }
                if (managerCount <= 1) {
                    return Result.failure(
                        IllegalStateException("At least 1 Account Manager account is mandatory! Cannot change role of the last Account Manager.")
                    )
                }
            }

            val now = System.currentTimeMillis()
            val updatedAccount = target.copy(
                name = cleanNewName,
                email = cleanNewEmail,
                password = cleanNewPassword,
                role = newRole,
                addedBy = "Edited by Admin",
                updatedAtMillis = now,
                pendingCloudSync = true
            )

            currentList[targetIdx] = updatedAccount
            saveAccountsToPrefs(currentList)
            sharedAccounts.value = currentList

            if (!cleanOriginalEmail.equals(cleanNewEmail, ignoreCase = true)) {
                deleteAccountFromFirestore(cleanOriginalEmail)
            }
            pushAccountToFirestore(updatedAccount)

            if (active != null && active.email.equals(cleanOriginalEmail, ignoreCase = true)) {
                setActiveSession(updatedAccount)
            }

            return Result.success(updatedAccount)
        }
    }

    fun removeAccountByAdmin(targetEmailInput: String): Result<Unit> {
        val active = sharedActiveSession.value
        if (active != null && active.role != VaultRole.ADMIN) {
            return Result.failure(IllegalStateException("Only Admin can remove accounts."))
        }

        val cleanTarget = targetEmailInput.trim().lowercase()
        if (isLockedEmergencyAdmin(cleanTarget)) {
            return Result.failure(
                IllegalAccessException(
                    "Locked Emergency Admin ($cleanTarget) is permanently locked and cannot be removed by anyone."
                )
            )
        }

        synchronized(initLock) {
            val currentList = sharedAccounts.value.toMutableList()
            val target = currentList.firstOrNull { it.email.equals(cleanTarget, ignoreCase = true) }
                ?: return Result.failure(IllegalArgumentException("Account not found ($cleanTarget)."))

            if (target.role == VaultRole.ACCOUNT_MANAGER) {
                val managerCount = currentList.count { it.role == VaultRole.ACCOUNT_MANAGER }
                if (managerCount <= 1) {
                    return Result.failure(
                        IllegalStateException(
                            "At least 1 Account Manager account is mandatory and cannot be removed."
                        )
                    )
                }
            }

            if (target.role == VaultRole.ADMIN) {
                val adminCount = currentList.count { it.role == VaultRole.ADMIN }
                if (adminCount <= 1) {
                    return Result.failure(IllegalStateException("Cannot remove the last remaining Admin."))
                }
                if (active != null && active.email.equals(cleanTarget, ignoreCase = true)) {
                    return Result.failure(IllegalStateException("Cannot remove your own currently logged-in Admin account."))
                }
            }

            currentList.removeAll { it.email.equals(cleanTarget, ignoreCase = true) }
            saveAccountsToPrefs(currentList)
            sharedAccounts.value = currentList
            deleteAccountFromFirestore(cleanTarget)
            return Result.success(Unit)
        }
    }

    private fun readAccountsFromPrefs(): List<VaultUserAccount> {
        val raw = prefs.getString(KEY_ACCOUNTS_JSON, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            buildList {
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    val roleStr = obj.optString("role", VaultRole.ACCOUNT_MANAGER.name)
                    val role = runCatching { VaultRole.valueOf(roleStr) }.getOrDefault(VaultRole.ACCOUNT_MANAGER)
                    val created = obj.optLong("createdAtMillis", VaultUserAccount.DEFAULT_SEED_TIMESTAMP)
                    val updated = obj.optLong("updatedAtMillis", created)
                    val pending = obj.optBoolean("pendingCloudSync", false)
                    add(
                        VaultUserAccount(
                            name = obj.optString("name", "Store User"),
                            email = obj.optString("email", "").lowercase().trim(),
                            password = obj.optString("password", DEFAULT_INITIAL_PASSWORD),
                            role = role,
                            addedBy = obj.optString("addedBy", "System"),
                            createdAtMillis = created,
                            updatedAtMillis = updated,
                            pendingCloudSync = pending
                        )
                    )
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveAccountsToPrefs(list: List<VaultUserAccount>) {
        val arr = JSONArray()
        list.forEach { acc ->
            val obj = JSONObject().apply {
                put("name", acc.name)
                put("email", acc.email.lowercase().trim())
                put("password", acc.password)
                put("role", acc.role.name)
                put("addedBy", acc.addedBy)
                put("createdAtMillis", acc.createdAtMillis)
                put("updatedAtMillis", acc.updatedAtMillis)
                put("pendingCloudSync", acc.pendingCloudSync)
            }
            arr.put(obj)
        }
        prefs.edit().putString(KEY_ACCOUNTS_JSON, arr.toString()).commit()
    }

    companion object {
        private const val PREFS_NAME = "siaam_store_vault_access_prefs"
        private const val KEY_ACCOUNTS_JSON = "vault_accounts_json_v1"
        private const val KEY_ACTIVE_EMAIL = "vault_active_email_v1"

        const val SHARED_ACCOUNTS_COLLECTION = "siaam_store_accounts"
        const val SHARED_STORE_USER_ID = "siaam_store_shared"

        private val initLock = Any()
        private var isInitialized = false
        private val sharedAccounts = MutableStateFlow<List<VaultUserAccount>>(emptyList())
        private val sharedActiveSession = MutableStateFlow<VaultUserAccount?>(null)
        private val sharedIsCloudSynced = MutableStateFlow(false)
        private var sharedStoreListener: ListenerRegistration? = null
        private var listeningUid: String? = null

        const val DEFAULT_INITIAL_PASSWORD = ""
        const val DEFAULT_ACCOUNT_MANAGER_EMAIL = "sales@siaamstore.com"
        const val DEFAULT_ACCOUNT_MANAGER_NAME = "Sales Manager (Siaam Store)"
        const val STORE_NAME_BN = "সিয়াম স্টোর"
        const val STORE_NAME_EN = "Siaam Store"
        const val STORE_BRANCH_LOCATION = "Ramchandrapur Haat, Chapainawabganj"
        const val STORE_BRANCH_LOCATION_EN = "Ramchandrapur Haat, Chapainawabganj"
        const val STORE_BRANCH_LOCATION_BN = "রামচন্দ্রপুর হাট, চাঁপাইনবাবগঞ্জ"
        const val STORE_PHONE_NUMBERS = "01740999627 & 01303033353"
        const val STORE_PHONE_NUMBERS_EN = "01740999627 & 01303033353"
        const val STORE_PHONE_NUMBERS_BN = "০১৭৪০৯৯৯৬২৭ ও ০১৩০৩০৩৩৩৫৩"

        /**
         * Emergency admin accounts are managed securely in Firestore (addedBy = "Emergency Lock")
         * rather than hardcoded in source control.
         */
        val LOCKED_EMERGENCY_ADMINS: LinkedHashMap<String, String> = linkedMapOf()

        val EMERGENCY_ADMIN_PASSWORDS: List<String> = emptyList()

        val DEFAULT_ADMIN_EMAILS: LinkedHashMap<String, String> = linkedMapOf()

        fun isLockedEmergencyAdmin(email: String): Boolean {
            val clean = email.trim().lowercase()
            return LOCKED_EMERGENCY_ADMINS.keys.any { it.equals(clean, ignoreCase = true) }
        }

        fun isPasswordValidForAccount(account: VaultUserAccount, inputPassword: String): Boolean {
            val cleanInput = inputPassword.trim()
            return if (isLockedEmergencyAdmin(account.email)) {
                EMERGENCY_ADMIN_PASSWORDS.any { it == cleanInput }
            } else {
                account.password == cleanInput
            }
        }
    }
}
