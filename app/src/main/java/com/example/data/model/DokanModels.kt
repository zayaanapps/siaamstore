package com.example.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp

@IgnoreExtraProperties
data class Product(
    @DocumentId val id: String = "",
    val userId: String = "",
    val name: String = "",
    val category: String = "General",
    val unit: String = "pcs",
    val buyPrice: Double = 0.0,
    val sellPrice: Double = 0.0,
    val stock: Double = 0.0,
    val lowStockThreshold: Double = 5.0,
    val barcode: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    val profitMarginPerUnit: Double
        get() = (sellPrice - buyPrice).coerceAtLeast(0.0)

    val profitMarginPercent: Double
        get() = if (buyPrice > 0.0) ((sellPrice - buyPrice) / buyPrice) * 100.0 else 0.0

    val isLowStock: Boolean
        get() = stock <= lowStockThreshold
}

@IgnoreExtraProperties
data class Customer(
    @DocumentId val id: String = "",
    val userId: String = "",
    val name: String = "",
    val phone: String = "",
    val address: String = "",
    val totalDue: Double = 0.0,
    val totalPurchased: Double = 0.0,
    val totalPaid: Double = 0.0,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@IgnoreExtraProperties
data class StoreTransaction(
    @DocumentId val id: String = "",
    val userId: String = "",
    val type: String = "SALE", // SALE, GIVE_DUE, RECEIVE_PAYMENT, PURCHASE, SUPPLIER_PAYMENT, EXPENSE, STOCK_ADJUST
    val title: String = "",
    val amount: Double = 0.0,
    val paidAmount: Double = 0.0,
    val dueAmount: Double = 0.0,
    val profitAmount: Double = 0.0,
    val customerId: String = "",
    val customerName: String = "",
    val supplierId: String = "",
    val supplierName: String = "",
    val productId: String = "",
    val category: String = "",
    val notes: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@IgnoreExtraProperties
data class Supplier(
    @DocumentId val id: String = "",
    val userId: String = "",
    val name: String = "",
    val phone: String = "",
    val company: String = "",
    val payableBalance: Double = 0.0,
    val totalPurchased: Double = 0.0,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@IgnoreExtraProperties
data class StaffMember(
    @DocumentId val id: String = "",
    val userId: String = "",
    val name: String = "",
    val role: String = "Cashier", // Owner, Manager, Cashier, Inventory Clerk
    val phone: String = "",
    val salary: Double = 0.0,
    val active: Boolean = true,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@IgnoreExtraProperties
data class AuditLog(
    @DocumentId val id: String = "",
    val userId: String = "",
    val actorName: String = "",
    val action: String = "",
    val module: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null
)

@IgnoreExtraProperties
data class RecycleBinItem(
    @DocumentId val id: String = "",
    val userId: String = "",
    val itemType: String = "", // PRODUCT, CUSTOMER, SUPPLIER, EXPENSE, TRANSACTION
    val itemId: String = "",
    val name: String = "",
    val details: String = "",
    val payloadJson: String = "",
    val deletedBy: String = "",
    @ServerTimestamp val deletedAt: Timestamp? = null
)

data class CartItem(
    val product: Product,
    val quantity: Double = 1.0,
    val customUnit: String = product.unit,
    val customUnitPrice: Double = product.sellPrice
) {
    val lineTotal: Double
        get() = customUnitPrice * quantity

    val lineProfit: Double
        get() = (customUnitPrice - product.buyPrice) * quantity
}

data class CustomerReceiptDetails(
    val isWalkIn: Boolean,
    val name: String,
    val address: String,
    val phone: String
)

data class SaleLineItem(
    val productId: String,
    val productName: String,
    val quantity: Double,
    val unit: String,
    val unitPrice: Double,
    val lineTotal: Double
) {
    companion object {
        fun encodeItemsAndNote(
            cartItems: List<CartItem>,
            userNote: String,
            customerPhone: String = "",
            customerAddress: String = ""
        ): String {
            val encodedItems = cartItems.joinToString(";") { item ->
                val cleanName = item.product.name.replace("|", " ").replace(";", " ").take(36)
                val qtyStr = if (item.quantity % 1.0 == 0.0) item.quantity.toLong().toString() else String.format("%.2f", item.quantity)
                val priceStr = if (item.customUnitPrice % 1.0 == 0.0) item.customUnitPrice.toLong().toString() else String.format("%.2f", item.customUnitPrice)
                val totalStr = if (item.lineTotal % 1.0 == 0.0) item.lineTotal.toLong().toString() else String.format("%.2f", item.lineTotal)
                "${item.product.id}|$cleanName|$qtyStr|${item.customUnit}|$priceStr|$totalStr"
            }
            val cleanNote = userNote.trim().replace("||", " ")
            val cleanPhone = customerPhone.trim().replace("|", " ").replace(";", " ").take(24)
            val cleanAddress = customerAddress.trim().replace("|", " ").replace(";", " ").take(60)
            val custSuffix = if (cleanPhone.isNotEmpty() || cleanAddress.isNotEmpty()) {
                "||CUST:$cleanPhone|$cleanAddress"
            } else {
                ""
            }
            val noteSuffix = if (cleanNote.isNotEmpty()) {
                "||NOTE:$cleanNote"
            } else {
                ""
            }
            val full = "ITEMS:$encodedItems$custSuffix$noteSuffix"
            return full.take(300)
        }

        fun parseLineItems(tx: StoreTransaction): List<SaleLineItem> {
            val raw = tx.notes
            if (raw.startsWith("ITEMS:")) {
                val itemsPart = raw
                    .removePrefix("ITEMS:")
                    .substringBefore("||CUST:")
                    .substringBefore("||NOTE:")
                val parsed = itemsPart.split(";").mapNotNull { entry ->
                    val parts = entry.split("|")
                    if (parts.size >= 6) {
                        SaleLineItem(
                            productId = parts[0],
                            productName = parts[1],
                            quantity = parts[2].toDoubleOrNull() ?: 1.0,
                            unit = parts[3].ifBlank { "kg" },
                            unitPrice = parts[4].toDoubleOrNull() ?: tx.amount,
                            lineTotal = parts[5].toDoubleOrNull() ?: tx.amount
                        )
                    } else null
                }
                if (parsed.isNotEmpty()) return parsed
            }
            // Fallback for older or single-line transactions
            val fallbackName = tx.title.substringBefore(" x").ifBlank { "Item" }
            return listOf(
                SaleLineItem(
                    productId = tx.productId,
                    productName = fallbackName,
                    quantity = 1.0,
                    unit = "kg",
                    unitPrice = tx.amount,
                    lineTotal = tx.amount
                )
            )
        }

        fun parseUserNote(tx: StoreTransaction): String {
            val raw = tx.notes
            return if (raw.contains("||NOTE:")) {
                raw.substringAfter("||NOTE:").trim()
            } else if (raw.startsWith("ITEMS:")) {
                ""
            } else {
                raw
            }
        }

        fun resolveCustomerDetails(
            tx: StoreTransaction,
            customers: List<Customer>
        ): CustomerReceiptDetails {
            val rawName = tx.customerName.trim()
            val isWalkInName = rawName.isBlank() ||
                rawName.equals("Walk-in (no name)", ignoreCase = true) ||
                rawName.equals("Walk-in Customer", ignoreCase = true) ||
                rawName.equals("Walk-in customer", ignoreCase = true) ||
                rawName == "সাধারণ ক্রেতা"

            if (isWalkInName && tx.customerId.isBlank()) {
                return CustomerReceiptDetails(
                    isWalkIn = true,
                    name = "Walk-in customer",
                    address = "",
                    phone = ""
                )
            }

            val matchedCustomer = customers.firstOrNull { cust ->
                (tx.customerId.isNotBlank() && cust.id == tx.customerId) ||
                    (!isWalkInName && cust.name.equals(rawName, ignoreCase = true))
            }

            var encodedPhone = ""
            var encodedAddress = ""
            if (tx.notes.contains("||CUST:")) {
                val custSegment = tx.notes
                    .substringAfter("||CUST:")
                    .substringBefore("||NOTE:")
                val parts = custSegment.split("|")
                encodedPhone = parts.getOrNull(0)?.trim().orEmpty()
                encodedAddress = parts.getOrNull(1)?.trim().orEmpty()
            }

            val resolvedName = matchedCustomer?.name?.takeIf { it.isNotBlank() }
                ?: rawName.takeIf { !isWalkInName }.orEmpty().ifBlank { "Walk-in customer" }
            val resolvedAddress = matchedCustomer?.address?.takeIf { it.isNotBlank() }
                ?: encodedAddress
            val resolvedPhone = matchedCustomer?.phone?.takeIf { it.isNotBlank() }
                ?: encodedPhone

            return CustomerReceiptDetails(
                isWalkIn = false,
                name = resolvedName,
                address = resolvedAddress,
                phone = resolvedPhone
            )
        }
    }
}

