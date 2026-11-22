package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.data.auth.VaultAccessManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

    @Test
    fun `read string from context`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val appName = context.getString(R.string.app_name)
        assertEquals("Siaam Store", appName)
    }

    @Test
    fun `password change and admin reset update account list for user management`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val manager = VaultAccessManager(context)
        val testEmail = "test-admin@example.com"
        val initialPass = "TestPass123!"
        manager.addAccountByAdmin(
            nameInput = "Test Admin",
            emailInput = testEmail,
            passwordInput = initialPass,
            role = com.example.data.auth.VaultRole.ADMIN
        )

        val changeRes = manager.changePassword(
            emailInput = testEmail,
            currentPasswordInput = initialPass,
            newPasswordInput = "UpdatedPass99!"
        )
        assertTrue(changeRes.isSuccess)

        // Old password must fail, new password must succeed and reflect in User Management list
        assertTrue(manager.authenticateWithEmailPassword(testEmail, initialPass).isFailure)
        assertTrue(manager.authenticateWithEmailPassword(testEmail, "UpdatedPass99!").isSuccess)

        val reflectedInAdminList = manager.accounts.value.first { it.email == testEmail }
        assertEquals("UpdatedPass99!", reflectedInAdminList.password)

        // Reset via Forgot Password
        val resetRes = manager.resetPasswordByAdmin(testEmail, "ResetPass777!")
        assertTrue(resetRes.isSuccess)
        assertEquals(
            "ResetPass777!",
            manager.accounts.value.first { it.email == testEmail }.password
        )
    }

    @Test
    fun `sell module cart items encode and decode for receipt and stock return`() {
        val wheat = com.example.data.model.Product(
            id = "prod_wheat",
            name = "গম",
            unit = "kg",
            sellPrice = 50.0,
            stock = 48.0
        )
        val cartItem = com.example.data.model.CartItem(
            product = wheat,
            quantity = 2.0,
            customUnit = "kg",
            customUnitPrice = 50.0
        )
        val encoded = com.example.data.model.SaleLineItem.encodeItemsAndNote(listOf(cartItem), "Walk-in sale")
        val tx = com.example.data.model.StoreTransaction(
            notes = encoded,
            amount = 100.0
        )
        val parsedItems = com.example.data.model.SaleLineItem.parseLineItems(tx)
        val parsedNote = com.example.data.model.SaleLineItem.parseUserNote(tx)

        assertEquals(1, parsedItems.size)
        assertEquals("prod_wheat", parsedItems[0].productId)
        assertEquals("গম", parsedItems[0].productName)
        assertEquals(2.0, parsedItems[0].quantity, 0.001)
        assertEquals(50.0, parsedItems[0].unitPrice, 0.001)
        assertEquals("Walk-in sale", parsedNote)
    }
}

