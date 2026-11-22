package com.example.ui.screens

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.PrintManager
import android.provider.MediaStore
import android.widget.Toast
import androidx.core.content.FileProvider
import com.example.R
import com.example.data.model.CustomerReceiptDetails
import com.example.data.model.SaleLineItem
import java.io.File
import java.io.FileOutputStream

object ReceiptDocumentExporter {

    private const val COLOR_TERRACOTTA = 0xFFC8370D.toInt()
    private const val COLOR_DARK_TEXT = 0xFF1A1D21.toInt()
    private const val COLOR_MUTED_SLATE = 0xFF5F6773.toInt()
    private const val COLOR_GREEN = 0xFF087F2E.toInt()
    private const val COLOR_RED = 0xFFB91C1C.toInt()
    private const val COLOR_DIVIDER = 0xFFEBE6DF.toInt()
    private const val COLOR_LIGHT_DIVIDER = 0xFFF0ECE5.toInt()
    private const val COLOR_CUST_BG = 0xFFFAF7F2.toInt()
    private const val COLOR_CUST_BORDER = 0xFFEBE6DF.toInt()
    private const val COLOR_CARD_BG = 0xFFFFFFFF.toInt()
    private const val COLOR_OUTER_BG = 0xFFF7F3EE.toInt()

    /**
     * Renders a crisp, high-resolution visual Bitmap of the exact Receipt Slip Card
     * so Print, Download PDF, and Share (WhatsApp etc.) output a graphical PDF / PNG image
     * rather than plain text.
     */
    fun renderReceiptBitmap(
        context: Context,
        isBn: Boolean,
        storeNameText: String,
        storeAddressText: String,
        storePhoneText: String,
        receiptNumberTitle: String,
        dateFormatted: String,
        servedByLabel: String,
        servedByValue: String,
        customerHeaderLabel: String,
        customerDetails: CustomerReceiptDetails,
        customerPhoneFormatted: String,
        lineItems: List<SaleLineItem>,
        formatQtyWithUnit: (SaleLineItem) -> String,
        formatPricePerUnit: (SaleLineItem) -> String,
        formatLineTotal: (SaleLineItem) -> String,
        subtotalFormatted: String,
        discountFormatted: String?,
        grandTotalFormatted: String,
        paidFormatted: String,
        dueFormatted: String?,
        thankYouText: String
    ): Bitmap {
        val width = 1080
        val outerPad = 32f
        val cardLeft = outerPad
        val cardRight = width - outerPad
        val innerPadH = 52f
        val contentLeft = cardLeft + innerPadH
        val contentRight = cardRight - innerPadH
        val contentWidth = contentRight - contentLeft

        // Calculate dynamic height based on customer rows, line items, and totals
        val customerBoxHeight = if (customerDetails.isWalkIn) 142f else 238f
        val lineItemRowHeight = 64f
        val lineItemsTotalHeight = (lineItems.size.coerceAtLeast(1)) * lineItemRowHeight
        val discountExtraHeight = if (discountFormatted != null) 52f else 0f
        val dueExtraHeight = if (dueFormatted != null) 52f else 0f

        val totalHeight = (
            outerPad * 2 +
                48f + // top card padding
                148f + // logo + store name + address + phone
                46f + // divider
                54f + // receipt # + date
                48f + // served by row
                24f +
                customerBoxHeight + // customer details box
                38f + // divider
                52f + // table headers
                24f + // light divider
                lineItemsTotalHeight +
                36f + // divider
                54f + // subtotal
                discountExtraHeight +
                32f + // divider
                68f + // grand total
                54f + // paid
                dueExtraHeight +
                56f + // footer spacing
                110f + // thank you + store name
                44f // bottom card padding
            ).toInt()

        val bitmap = Bitmap.createBitmap(width, totalHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(COLOR_OUTER_BG)

        val cardPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_CARD_BG
            style = Paint.Style.FILL
        }
        val cardBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_DIVIDER
            style = Paint.Style.STROKE
            strokeWidth = 3f
        }
        val cardRect = RectF(cardLeft, outerPad, cardRight, totalHeight - outerPad)
        canvas.drawRoundRect(cardRect, 42f, 42f, cardPaint)
        canvas.drawRoundRect(cardRect, 42f, 42f, cardBorderPaint)

        var y = outerPad + 48f

        // 1. Siaam Store Logo + Store Name + Store Address + Store Phone Numbers
        val logoSize = 136f
        val logoRect = RectF(contentLeft, y, contentLeft + logoSize, y + logoSize)
        val logoBitmap = try {
            BitmapFactory.decodeResource(context.resources, R.drawable.ic_siaam_store_logo)
        } catch (_: Exception) {
            null
        }
        if (logoBitmap != null) {
            val saveCount = canvas.save()
            val clipPath = Path().apply {
                addRoundRect(logoRect, 26f, 26f, Path.Direction.CW)
            }
            canvas.clipPath(clipPath)
            canvas.drawBitmap(logoBitmap, null, logoRect, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
            canvas.restoreToCount(saveCount)
        }

        val headerTextLeft = contentLeft + logoSize + 34f
        val storeNamePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_TERRACOTTA
            textSize = 50f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val subHeaderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED_SLATE
            textSize = 31f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }
        val phoneHeaderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED_SLATE
            textSize = 31f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }

        canvas.drawText(storeNameText, headerTextLeft, y + 48f, storeNamePaint)
        canvas.drawText(storeAddressText, headerTextLeft, y + 90f, subHeaderPaint)
        canvas.drawText(storePhoneText, headerTextLeft, y + 130f, phoneHeaderPaint)

        y += logoSize + 34f

        val dividerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_DIVIDER
            strokeWidth = 2.5f
        }
        val lightDividerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_LIGHT_DIVIDER
            strokeWidth = 2f
        }

        canvas.drawLine(contentLeft, y, contentRight, y, dividerPaint)
        y += 48f

        // Receipt # and Date
        val boldDarkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_DARK_TEXT
            textSize = 40f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val datePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED_SLATE
            textSize = 34f
            textAlign = Paint.Align.RIGHT
        }
        canvas.drawText(receiptNumberTitle, contentLeft, y, boldDarkPaint)
        canvas.drawText(dateFormatted, contentRight, y, datePaint)

        y += 48f

        // 2. Served By / বিক্রয় প্রতিনিধি
        val labelMutedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED_SLATE
            textSize = 32f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }
        val servedByValuePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_TERRACOTTA
            textSize = 33f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.RIGHT
        }
        canvas.drawText(servedByLabel, contentLeft, y, labelMutedPaint)
        canvas.drawText(servedByValue, contentRight, y, servedByValuePaint)

        y += 26f

        // 3. Customer Details Box with simple indicator header
        val custBoxTop = y
        val custBoxBottom = custBoxTop + customerBoxHeight
        val custRect = RectF(contentLeft, custBoxTop, contentRight, custBoxBottom)
        val custBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_CUST_BG
            style = Paint.Style.FILL
        }
        val custStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_CUST_BORDER
            style = Paint.Style.STROKE
            strokeWidth = 2.5f
        }
        canvas.drawRoundRect(custRect, 24f, 24f, custBgPaint)
        canvas.drawRoundRect(custRect, 24f, 24f, custStrokePaint)

        val custPadH = 28f
        val custLeft = contentLeft + custPadH
        val custRight = contentRight - custPadH

        var custY = custBoxTop + 40f
        val custHeaderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_TERRACOTTA
            textSize = 28f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText(customerHeaderLabel, custLeft, custY, custHeaderPaint)
        custY += 16f
        canvas.drawLine(custLeft, custY, custRight, custY, lightDividerPaint)

        val custLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED_SLATE
            textSize = 31f
        }
        val custValBoldPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_DARK_TEXT
            textSize = 33f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.RIGHT
        }
        val custValMedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_DARK_TEXT
            textSize = 31f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
            textAlign = Paint.Align.RIGHT
        }

        if (customerDetails.isWalkIn) {
            custY += 48f
            canvas.drawText(if (isBn) "ক্রেতা:" else "Customer:", custLeft, custY, custLabelPaint)
            canvas.drawText("Walk-in customer", custRight, custY, custValBoldPaint)
        } else {
            custY += 44f
            canvas.drawText(if (isBn) "নাম:" else "Name:", custLeft, custY, custLabelPaint)
            canvas.drawText(customerDetails.name, custRight, custY, custValBoldPaint)

            custY += 46f
            canvas.drawText(if (isBn) "ঠিকানা:" else "Address:", custLeft, custY, custLabelPaint)
            canvas.drawText(customerDetails.address.ifBlank { "—" }, custRight, custY, custValMedPaint)

            custY += 46f
            canvas.drawText(if (isBn) "ফোন:" else "Phone:", custLeft, custY, custLabelPaint)
            canvas.drawText(customerPhoneFormatted.ifBlank { "—" }, custRight, custY, custValMedPaint)
        }

        y = custBoxBottom + 28f
        canvas.drawLine(contentLeft, y, contentRight, y, dividerPaint)
        y += 42f

        // Table Column Headers: পণ্য (Item) | পরিমাণ (Qty) | দাম (Price) | টাকা (Total)
        val col1X = contentLeft
        val col2CenterX = contentLeft + contentWidth * 0.38f
        val col3CenterX = contentLeft + contentWidth * 0.66f
        val col4RightX = contentRight

        val thLeftPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED_SLATE
            textSize = 33f
        }
        val thCenterPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED_SLATE
            textSize = 33f
            textAlign = Paint.Align.CENTER
        }
        val thRightPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED_SLATE
            textSize = 33f
            textAlign = Paint.Align.RIGHT
        }

        canvas.drawText(if (isBn) "পণ্য" else "Item", col1X, y, thLeftPaint)
        canvas.drawText(if (isBn) "পরিমাণ" else "Qty", col2CenterX, y, thCenterPaint)
        canvas.drawText(if (isBn) "দাম" else "Price", col3CenterX, y, thCenterPaint)
        canvas.drawText(if (isBn) "টাকা" else "Total", col4RightX, y, thRightPaint)

        y += 20f
        canvas.drawLine(contentLeft, y, contentRight, y, lightDividerPaint)
        y += 46f

        // Line Items
        val itemLeftPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_DARK_TEXT
            textSize = 35f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val itemCenterPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_DARK_TEXT
            textSize = 33f
            textAlign = Paint.Align.CENTER
        }
        val itemRightPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_DARK_TEXT
            textSize = 35f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.RIGHT
        }

        lineItems.forEach { item ->
            canvas.drawText(item.productName, col1X, y, itemLeftPaint)
            canvas.drawText(formatQtyWithUnit(item), col2CenterX, y, itemCenterPaint)
            canvas.drawText(formatPricePerUnit(item), col3CenterX, y, itemCenterPaint)
            canvas.drawText(formatLineTotal(item), col4RightX, y, itemRightPaint)
            y += lineItemRowHeight
        }

        y -= 16f
        canvas.drawLine(contentLeft, y, contentRight, y, dividerPaint)
        y += 48f

        // মোট (Subtotal)
        val rowLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_DARK_TEXT
            textSize = 35f
        }
        val rowValueBoldPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_DARK_TEXT
            textSize = 37f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.RIGHT
        }
        canvas.drawText(if (isBn) "মোট" else "Subtotal", contentLeft, y, rowLabelPaint)
        canvas.drawText("৳ $subtotalFormatted", contentRight, y, rowValueBoldPaint)

        // ছাড় (Discount)
        if (discountFormatted != null) {
            y += 50f
            val greenValuePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = COLOR_GREEN
                textSize = 36f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.RIGHT
            }
            canvas.drawText(if (isBn) "ছাড়" else "Discount", contentLeft, y, labelMutedPaint)
            canvas.drawText("- ৳ $discountFormatted", contentRight, y, greenValuePaint)
        }

        y += 26f
        canvas.drawLine(contentLeft, y, contentRight, y, dividerPaint)
        y += 54f

        // সর্বমোট (Grand Total)
        val grandLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_DARK_TEXT
            textSize = 42f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val grandValPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_DARK_TEXT
            textSize = 46f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.RIGHT
        }
        canvas.drawText(if (isBn) "সর্বমোট" else "Total", contentLeft, y, grandLabelPaint)
        canvas.drawText("৳ $grandTotalFormatted", contentRight, y, grandValPaint)

        // পরিশোধিত / Paid
        y += 52f
        val paidValPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_GREEN
            textSize = 38f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.RIGHT
        }
        canvas.drawText(if (isBn) "পরিশোধিত" else "Paid", contentLeft, y, labelMutedPaint)
        canvas.drawText("৳ $paidFormatted", contentRight, y, paidValPaint)

        // বাকি / Due
        if (dueFormatted != null) {
            y += 50f
            val dueValPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = COLOR_RED
                textSize = 38f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.RIGHT
            }
            canvas.drawText(if (isBn) "বাকি" else "Due", contentLeft, y, labelMutedPaint)
            canvas.drawText("৳ $dueFormatted", contentRight, y, dueValPaint)
        }

        // Bottom Footer: Thank you + Store Name (No address at the bottom)
        y += 74f
        val centerThankYouPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED_SLATE
            textSize = 33f
            textAlign = Paint.Align.CENTER
        }
        val centerStorePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_TERRACOTTA
            textSize = 36f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        val centerX = width / 2f
        canvas.drawText(thankYouText, centerX, y, centerThankYouPaint)
        y += 46f
        canvas.drawText(storeNameText, centerX, y, centerStorePaint)

        return bitmap
    }

    /**
     * Writes the visual Receipt Bitmap into a single-page PDF file in `cacheDir/receipts/`.
     */
    fun saveReceiptPdfToCache(context: Context, saleNumber: Int, bitmap: Bitmap): File {
        val dir = File(context.cacheDir, "receipts").apply { mkdirs() }
        val pdfFile = File(dir, "Siaam_Store_Receipt_$saleNumber.pdf")
        val pdfDocument = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(bitmap.width, bitmap.height, 1).create()
        val page = pdfDocument.startPage(pageInfo)
        page.canvas.drawBitmap(bitmap, 0f, 0f, null)
        pdfDocument.finishPage(page)
        FileOutputStream(pdfFile).use { out ->
            pdfDocument.writeTo(out)
        }
        pdfDocument.close()
        return pdfFile
    }

    /**
     * Writes the visual Receipt Bitmap into a PNG image file in `cacheDir/receipts/`.
     */
    fun saveReceiptPngToCache(context: Context, saleNumber: Int, bitmap: Bitmap): File {
        val dir = File(context.cacheDir, "receipts").apply { mkdirs() }
        val pngFile = File(dir, "Siaam_Store_Receipt_$saleNumber.png")
        FileOutputStream(pngFile).use { out ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        }
        return pngFile
    }

    /**
     * Prints the visual Receipt Bitmap using Android's system PrintManager (supports 58mm, 80mm, A4, and Save as PDF).
     */
    fun printVisualReceipt(
        context: Context,
        saleNumber: Int,
        selectedPaperSize: String,
        bitmap: Bitmap
    ) {
        val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager
        if (printManager != null) {
            val printAdapter = object : PrintDocumentAdapter() {
                override fun onLayout(
                    oldAttributes: PrintAttributes?,
                    newAttributes: PrintAttributes?,
                    cancellationSignal: CancellationSignal?,
                    callback: LayoutResultCallback?,
                    extras: Bundle?
                ) {
                    val info = PrintDocumentInfo.Builder("Siaam_Store_Receipt_$saleNumber.pdf")
                        .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                        .setPageCount(1)
                        .build()
                    callback?.onLayoutFinished(info, true)
                }

                override fun onWrite(
                    pages: Array<out PageRange>?,
                    destination: ParcelFileDescriptor?,
                    cancellationSignal: CancellationSignal?,
                    callback: WriteResultCallback?
                ) {
                    try {
                        val pageWidthPt = when (selectedPaperSize) {
                            "58 mm" -> 380
                            "80 mm" -> 520
                            else -> 595 // A4 width in points
                        }
                        val scale = pageWidthPt.toFloat() / bitmap.width.toFloat()
                        val pageHeightPt = (bitmap.height * scale).toInt().coerceAtLeast(400)

                        val pdfDocument = PdfDocument()
                        val pageInfo = PdfDocument.PageInfo.Builder(pageWidthPt, pageHeightPt, 1).create()
                        val page = pdfDocument.startPage(pageInfo)
                        val destRect = RectF(0f, 0f, pageWidthPt.toFloat(), pageHeightPt.toFloat())
                        page.canvas.drawBitmap(
                            bitmap,
                            null,
                            destRect,
                            Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
                        )
                        pdfDocument.finishPage(page)

                        FileOutputStream(destination?.fileDescriptor).use { out ->
                            pdfDocument.writeTo(out)
                        }
                        pdfDocument.close()
                        callback?.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
                    } catch (e: Exception) {
                        callback?.onWriteFailed(e.message)
                    }
                }
            }
            printManager.print("Siaam Store Receipt #$saleNumber", printAdapter, null)
        } else {
            shareReceiptFile(context, saleNumber, bitmap, shareAsPdf = true)
        }
    }

    /**
     * Saves the visual Receipt PDF to the device's Downloads folder (on Android 10+)
     * AND opens the PDF share/viewer chooser so the user has immediate access to the PDF.
     */
    fun downloadVisualReceiptPdf(context: Context, saleNumber: Int, bitmap: Bitmap) {
        try {
            val pdfFile = saveReceiptPdfToCache(context, saleNumber, bitmap)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val fileName = "Siaam_Store_Receipt_$saleNumber.pdf"
                val contentValues = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                if (uri != null) {
                    resolver.openOutputStream(uri)?.use { out ->
                        pdfFile.inputStream().use { input ->
                            input.copyTo(out)
                        }
                    }
                    Toast.makeText(
                        context,
                        "PDF saved to Downloads: $fileName",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            // Also open chooser with the PDF URI so user can open/save in Drive, PDF Viewer, WhatsApp, etc.
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                pdfFile
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "Siaam Store Receipt #$saleNumber")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, "Download / Open Receipt PDF"))
        } catch (e: Exception) {
            Toast.makeText(context, "Could not generate PDF: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Shares the visual Receipt as a high-res PNG image (or PDF) via FileProvider (for WhatsApp, RawBT, etc.).
     */
    fun shareReceiptFile(
        context: Context,
        saleNumber: Int,
        bitmap: Bitmap,
        shareAsPdf: Boolean = false,
        targetPackage: String? = null
    ) {
        try {
            val file = if (shareAsPdf) {
                saveReceiptPdfToCache(context, saleNumber, bitmap)
            } else {
                saveReceiptPngToCache(context, saleNumber, bitmap)
            }
            val mimeType = if (shareAsPdf) "application/pdf" else "image/png"
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "Siaam Store Receipt #$saleNumber")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                if (targetPackage != null) {
                    setPackage(targetPackage)
                }
            }
            if (targetPackage != null) {
                try {
                    context.startActivity(sendIntent)
                    return
                } catch (_: Exception) {
                    sendIntent.setPackage(null)
                }
            }
            context.startActivity(Intent.createChooser(sendIntent, "Share Receipt"))
        } catch (e: Exception) {
            Toast.makeText(context, "Share failed: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
}
