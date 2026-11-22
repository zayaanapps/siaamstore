package com.example.ui.util

import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object ExportHelper {

    /**
     * Shares a CSV file reliably with proper UTF-8 BOM for Bengali language support,
     * attaching both the physical CSV file via FileProvider and text summary so all Android apps
     * (WhatsApp, Drive, Gmail, Sheets, Telegram, Notes, etc.) accept the export properly.
     */
    fun shareCsv(
        context: Context,
        filenamePrefix: String,
        title: String,
        csvContent: String
    ) {
        try {
            val exportDir = File(context.cacheDir, "exports").apply { mkdirs() }
            val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val cleanPrefix = filenamePrefix.replace("[^a-zA-Z0-9_\\-]".toRegex(), "_")
            val file = File(exportDir, "${cleanPrefix}_$timeStamp.csv")

            FileOutputStream(file).use { fos ->
                // Write UTF-8 BOM so spreadsheet viewers render Bengali letters properly
                fos.write(byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()))
                fos.write(csvContent.toByteArray(Charsets.UTF_8))
            }

            val authority = "${context.packageName}.fileprovider"
            val uri = FileProvider.getUriForFile(context, authority, file)

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/csv"
                putExtra(Intent.EXTRA_SUBJECT, title)
                putExtra(Intent.EXTRA_TEXT, "$title\n\n$csvContent")
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, title).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(chooser)
        } catch (e: Exception) {
            Toast.makeText(context, "Export error: ${e.localizedMessage ?: "Failed"}", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Shares a complete store JSON backup file.
     */
    fun shareJsonBackup(
        context: Context,
        storeName: String,
        jsonContent: String
    ) {
        try {
            val exportDir = File(context.cacheDir, "exports").apply { mkdirs() }
            val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val cleanPrefix = storeName.replace("[^a-zA-Z0-9_\\-]".toRegex(), "_").ifBlank { "store_backup" }
            val file = File(exportDir, "${cleanPrefix}_backup_$timeStamp.json")

            FileOutputStream(file).use { fos ->
                fos.write(jsonContent.toByteArray(Charsets.UTF_8))
            }

            val authority = "${context.packageName}.fileprovider"
            val uri = FileProvider.getUriForFile(context, authority, file)

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/json"
                putExtra(Intent.EXTRA_SUBJECT, "Store Backup - $storeName")
                putExtra(Intent.EXTRA_TEXT, "Store Data Backup ($storeName) - $timeStamp\n\n$jsonContent")
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, "Save or Share Store Backup").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(chooser)
        } catch (e: Exception) {
            Toast.makeText(context, "Backup export failed: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Shares plain text message (e.g. App share, transaction summary).
     */
    fun shareText(
        context: Context,
        subject: String,
        bodyText: String
    ) {
        try {
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, subject)
                putExtra(Intent.EXTRA_TEXT, bodyText)
            }
            val chooser = Intent.createChooser(shareIntent, subject).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(chooser)
        } catch (e: Exception) {
            Toast.makeText(context, "Share error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
        }
    }
}
