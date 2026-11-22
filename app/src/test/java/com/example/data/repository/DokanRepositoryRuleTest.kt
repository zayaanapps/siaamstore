package com.example.data.repository

import com.example.base.FirestoreEmulatorTestBase
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DokanRepositoryRuleTest : FirestoreEmulatorTestBase() {

    @Test
    fun addAndObserveProduct_authenticatedOwner_succeeds() = runBlocking {
        signInTestUser(ALICE_EMAIL)
        val repository = DokanRepository(firestore)

        val addResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            repository.addProduct(
                name = "Miniket Rice 5kg",
                category = "Grains",
                unit = "kg",
                buyPrice = 320.0,
                sellPrice = 360.0,
                initialStock = 50.0,
                lowStockThreshold = 10.0,
                barcode = "890111"
            )
        }
        assertTrue("Expected addProduct to succeed: ${addResult.exceptionOrNull()}", addResult.isSuccess)
        val productId = addResult.getOrThrow()
        assertTrue(productId.isNotEmpty())

        val products = withTimeout(FLOW_TIMEOUT_MS) {
            repository.observeProducts().first { list -> list.any { it.id == productId } }
        }
        assertTrue(products.any { it.id == productId && it.name == "Miniket Rice 5kg" })
    }

    @Test
    fun crossUserAccess_readingAnotherUsersProduct_failsWithPermissionDenied() = runBlocking {
        val aliceUid = signInTestUser(ALICE_EMAIL)
        val aliceRepo = DokanRepository(firestore)
        val productId = withTimeout(DEFAULT_TIMEOUT_MS) {
            aliceRepo.addProduct(
                name = "Soybean Oil 1L",
                category = "Oil",
                unit = "ltr",
                buyPrice = 150.0,
                sellPrice = 170.0,
                initialStock = 20.0,
                lowStockThreshold = 5.0,
                barcode = "890222"
            ).getOrThrow()
        }

        signInTestUser(BOB_EMAIL)
        var caughtException: Throwable? = null
        try {
            withTimeout(DEFAULT_TIMEOUT_MS) {
                firestore.collection("users").document(aliceUid)
                    .collection("products").document(productId)
                    .get().await()
            }
        } catch (e: Throwable) {
            caughtException = e
        }
        assertNotNull("Expected cross-user read to fail", caughtException)
        val firestoreEx = caughtException?.unwrapFirestoreException()
        assertNotNull("Expected FirebaseFirestoreException", firestoreEx)
        assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, firestoreEx?.code)
    }

    @Test
    fun unauthenticatedAccess_queryingProducts_fails() = runBlocking {
        val aliceUid = signInTestUser(ALICE_EMAIL)
        auth.signOut()

        var caughtException: Throwable? = null
        try {
            withTimeout(FLOW_TIMEOUT_MS) {
                firestore.collection("users").document(aliceUid)
                    .collection("products")
                    .whereEqualTo("userId", aliceUid)
                    .get().await()
            }
        } catch (e: Throwable) {
            caughtException = e
        }
        assertNotNull("Expected unauthenticated query to fail", caughtException)
        val firestoreEx = caughtException?.unwrapFirestoreException()
        assertNotNull("Expected FirebaseFirestoreException", firestoreEx)
        assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, firestoreEx?.code)
    }

    private companion object {
        const val ALICE_EMAIL = "alice.dokan@test.com"
        const val BOB_EMAIL = "bob.dokan@test.com"
        const val DEFAULT_TIMEOUT_MS = 5000L
        const val FLOW_TIMEOUT_MS = 4000L
    }
}
