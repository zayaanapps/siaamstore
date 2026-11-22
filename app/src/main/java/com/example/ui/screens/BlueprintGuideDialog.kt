package com.example.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BlueprintGuideDialog(
    onDismiss: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf(
        "1. Products Module (Flutter)",
        "2. Sales & POS (Flutter)",
        "3. Customers & More (Flutter)",
        "4. Schema & Offline Sync"
    )

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp)
                .testTag("blueprint_guide_dialog"),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.background
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "সিয়াম স্টোর (Siaam Store) • Architecture & Guide",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Product Management, Sales & POS, Customer Ledger & More Modules",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    tabs.forEachIndexed { index, label ->
                        FilterChip(
                            selected = selectedTab == index,
                            onClick = { selectedTab = index },
                            label = { Text(label) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f)
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .horizontalScroll(rememberScrollState())
                            .padding(16.dp)
                    ) {
                        Text(
                            text = when (selectedTab) {
                                0 -> FLUTTER_PRODUCTS_MODULE_DOC
                                1 -> FLUTTER_SALES_POS_MODULE_DOC
                                2 -> FLUTTER_CUSTOMERS_MORE_MODULE_DOC
                                else -> SCHEMA_AND_OFFLINE_DOC
                            },
                            fontFamily = FontFamily.Monospace,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        }
    }
}

private val FLUTTER_PRODUCTS_MODULE_DOC = """
// ============================================================================
// MODULE 1: PRODUCT MANAGEMENT (Domain + Repository + List/Add/Details UI)
// ============================================================================

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ProductModel {
  final String id;
  final String userId;
  final String name;
  final String category;
  final String unit; // kg, gm, pcs, ltr, box
  final double buyPrice;
  final double sellPrice;
  final double stock;
  final double lowStockThreshold;
  final String barcode;

  const ProductModel({
    required this.id,
    required this.userId,
    required this.name,
    required this.category,
    required this.unit,
    required this.buyPrice,
    required this.sellPrice,
    required this.stock,
    required this.lowStockThreshold,
    required this.barcode,
  });

  double get unitProfit => sellPrice - buyPrice;
  double get profitMarginPercent =>
      buyPrice > 0 ? ((sellPrice - buyPrice) / buyPrice) * 100 : 0;
  bool get isLowStock => stock <= lowStockThreshold;

  factory ProductModel.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data()!;
    return ProductModel(
      id: doc.id,
      userId: d['userId'] ?? '',
      name: d['name'] ?? '',
      category: d['category'] ?? 'মুদি পণ্য',
      unit: d['unit'] ?? 'pcs',
      buyPrice: (d['buyPrice'] as num?)?.toDouble() ?? 0,
      sellPrice: (d['sellPrice'] as num?)?.toDouble() ?? 0,
      stock: (d['stock'] as num?)?.toDouble() ?? 0,
      lowStockThreshold: (d['lowStockThreshold'] as num?)?.toDouble() ?? 5,
      barcode: d['barcode'] ?? '',
    );
  }
}

class ProductRepository {
  final FirebaseFirestore _db;
  final FirebaseAuth _auth;
  ProductRepository(this._db, this._auth);

  String get _uid => _auth.currentUser!.uid;

  CollectionReference<Map<String, dynamic>> get _productsRef =>
      _db.collection('users').doc(_uid).collection('products');

  CollectionReference<Map<String, dynamic>> get _txRef =>
      _db.collection('users').doc(_uid).collection('transactions');

  Stream<List<ProductModel>> watchProducts() {
    return _productsRef.orderBy('name').snapshots().map(
          (snap) => snap.docs.map(ProductModel.fromDoc).toList(),
        );
  }

  Future<void> addProduct({
    required String name,
    required String category,
    required String unit,
    required double buyPrice,
    required double sellPrice,
    required double initialStock,
    required double lowStockThreshold,
    required String barcode,
  }) async {
    final doc = _productsRef.doc();
    await doc.set({
      'userId': _uid,
      'name': name,
      'category': category,
      'unit': unit,
      'buyPrice': buyPrice,
      'sellPrice': sellPrice,
      'stock': initialStock,
      'lowStockThreshold': lowStockThreshold,
      'barcode': barcode,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> adjustStock({
    required ProductModel product,
    required double delta,
    required String reason,
  }) async {
    final newStock = (product.stock + delta).clamp(0.0, double.infinity);
    final batch = _db.batch();
    batch.update(_productsRef.doc(product.id), {
      'stock': newStock,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    batch.set(_txRef.doc(), {
      'userId': _uid,
      'type': 'STOCK_ADJUST',
      'title': '${'$'}{delta >= 0 ? "স্টক যোগ (+)" : "স্টক কমানো (-)"}: ${'$'}{product.name}',
      'amount': (delta.abs() * product.buyPrice),
      'paidAmount': 0.0,
      'dueAmount': 0.0,
      'profitAmount': 0.0,
      'customerId': '',
      'customerName': '',
      'supplierId': '',
      'supplierName': '',
      'productId': product.id,
      'category': 'Stock Adjustment',
      'notes': '${'$'}reason (${'$'}{product.stock} -> ${'$'}newStock ${'$'}{product.unit})',
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }
}
""".trimIndent()

private val FLUTTER_SALES_POS_MODULE_DOC = """
// ============================================================================
// MODULE 2: SALES & POS MODULE (Cart State + Atomic Offline Batch Checkout)
// ============================================================================

class CartItem {
  final ProductModel product;
  final double quantity;
  const CartItem({required this.product, required this.quantity});

  double get subtotal => product.sellPrice * quantity;
  double get profit => (product.sellPrice - product.buyPrice) * quantity;

  CartItem copyWith({double? quantity}) =>
      CartItem(product: product, quantity: quantity ?? this.quantity);
}

class PosCartNotifier extends StateNotifier<List<CartItem>> {
  final FirebaseFirestore _db;
  final FirebaseAuth _auth;
  PosCartNotifier(this._db, this._auth) : super(const []);

  void addProduct(ProductModel product) {
    final idx = state.indexWhere((c) => c.product.id == product.id);
    if (idx >= 0) {
      final existing = state[idx];
      state = [
        ...state.sublist(0, idx),
        existing.copyWith(quantity: existing.quantity + 1),
        ...state.sublist(idx + 1),
      ];
    } else {
      state = [...state, CartItem(product: product, quantity: 1)];
    }
  }

  void updateQty(String productId, double qty) {
    if (qty <= 0) {
      state = state.where((c) => c.product.id != productId).toList();
    } else {
      state = state
          .map((c) => c.product.id == productId ? c.copyWith(quantity: qty) : c)
          .toList();
    }
  }

  double get totalAmount => state.fold(0.0, (s, i) => s + i.subtotal);
  double get totalProfit => state.fold(0.0, (s, i) => s + i.profit);

  Future<void> checkoutSale({
    required double paidAmount,
    String? customerId,
    String? customerName,
    String notes = '',
  }) async {
    if (state.isEmpty) return;
    final uid = _auth.currentUser!.uid;
    final userDoc = _db.collection('users').doc(uid);
    final batch = _db.batch();

    final total = totalAmount;
    final paid = paidAmount.clamp(0.0, total);
    final due = (total - paid).clamp(0.0, double.infinity);
    final profit = totalProfit;

    for (final item in state) {
      final pRef = userDoc.collection('products').doc(item.product.id);
      final updatedStock =
          (item.product.stock - item.quantity).clamp(0.0, double.infinity);
      batch.update(pRef, {
        'stock': updatedStock,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    }

    if (customerId != null && customerId.isNotEmpty) {
      final cRef = userDoc.collection('customers').doc(customerId);
      batch.update(cRef, {
        'totalDue': FieldValue.increment(due),
        'totalPurchased': FieldValue.increment(total),
        'totalPaid': FieldValue.increment(paid),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    }

    final summary = state
        .map((i) => '${'$'}{i.product.name} x${'$'}{i.quantity}')
        .join(', ');
    batch.set(userDoc.collection('transactions').doc(), {
      'userId': uid,
      'type': 'SALE',
      'title': summary,
      'amount': total,
      'paidAmount': paid,
      'dueAmount': due,
      'profitAmount': profit,
      'customerId': customerId ?? '',
      'customerName': customerName ?? 'নগদ কাস্টমার',
      'supplierId': '',
      'supplierName': '',
      'productId': state.first.product.id,
      'category': 'POS Sale',
      'notes': notes,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });

    await batch.commit();
    state = const [];
  }
}
""".trimIndent()

private val FLUTTER_CUSTOMERS_MORE_MODULE_DOC = """
// ============================================================================
// MODULE 3: CUSTOMERS LEDGER & "আরও" (MORE / ACCOUNTS) SCREEN
// ============================================================================

class MoreMenuScreen extends StatelessWidget {
  const MoreMenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final items = [
      ('🧾', 'মাল কেনা', 'কেনা মাল, স্টক বাড়ে', '/purchases'),
      ('🚚', 'সাপ্লায়ার', 'কার কাছে কত দেনা', '/suppliers'),
      ('💸', 'খরচ', 'দোকান ভাড়া, বিল, বেতন...', '/expenses'),
      ('📒', 'ক্যাশ খাতা', 'দিনে কত ঢুকল, কত গেল', '/cashbook'),
      ('💹', 'ব্যবসার রিপোর্ট', 'বিক্রি, লাভ, কোন পণ্য চলছে', '/business-reports'),
      ('📈', 'রিপোর্ট', 'বাকির তালিকা, মাসের হিসাব', '/due-reports'),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF7F3EE),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'আরও',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE7DFD5)),
            ),
            child: Column(
              children: [
                for (int i = 0; i < items.length; i++) ...[
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 8,
                    ),
                    leading: Text(items[i].$1, style: const TextStyle(fontSize: 28)),
                    title: Text(
                      items[i].$2,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    subtitle: Text(items[i].$3),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.pushNamed(context, items[i].$4),
                  ),
                  if (i < items.length - 1)
                    const Divider(height: 1, color: Color(0xFFEDE6DD)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
""".trimIndent()

private val SCHEMA_AND_OFFLINE_DOC = """
# 4. Firestore Schema & Offline Sync Architecture

1. Multi-Tenant Store Isolation (`/users/{userId}`):
   - `/users/{userId}/products/{productId}`
   - `/users/{userId}/customers/{customerId}`
   - `/users/{userId}/transactions/{transactionId}`
   - `/users/{userId}/suppliers/{supplierId}`
   - `/users/{userId}/staff/{staffId}`
   - `/users/{userId}/audit_logs/{logId}`

2. Offline Persistence & Atomic WriteBatch:
   - Use `WriteBatch` (`_db.batch()`) for POS sales, stock adjustments, customer due/payment entries, and supplier purchases so all documents update atomically in the local IndexedDB/SQLite cache even with zero internet connection.
""".trimIndent()
