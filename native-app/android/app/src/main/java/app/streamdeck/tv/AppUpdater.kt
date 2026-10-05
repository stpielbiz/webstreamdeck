package app.streamdeck.tv

import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.widget.Toast
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** Checks the latest GitHub release and hands an approved APK to Fire TV's installer. */
class AppUpdater(private val activity: Activity) {
    companion object {
        private const val UPDATE_METADATA_URL =
            "https://github.com/stpielbiz/webstreamdeck/releases/latest/download/update.json"
        private const val UPDATE_FILE_NAME = "stream-deck-tv-update.apk"
    }

    private val executor = Executors.newSingleThreadExecutor()
    private var pendingApk: File? = null
    private var permissionRequested = false

    fun checkAtLaunch() {
        executor.execute {
            val release = fetchRelease() ?: return@execute
            if (release.versionCode <= BuildConfig.VERSION_CODE) return@execute
            activity.runOnUiThread { showUpdatePrompt(release) }
        }
    }

    fun onResume() {
        val apk = pendingApk ?: return
        if (!permissionRequested || !canInstallPackages()) return
        permissionRequested = false
        openInstaller(apk)
    }

    fun close() {
        executor.shutdownNow()
    }

    private fun fetchRelease(): Release? = try {
        val connection = URL(UPDATE_METADATA_URL).openConnection() as HttpURLConnection
        connection.connectTimeout = 8_000
        connection.readTimeout = 8_000
        connection.instanceFollowRedirects = true
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("User-Agent", "StreamDeckTV/${BuildConfig.VERSION_NAME}")
        connection.inputStream.bufferedReader().use { reader ->
            val json = JSONObject(reader.readText())
            Release(
                versionCode = json.getInt("versionCode"),
                versionName = json.getString("versionName"),
                apkUrl = json.getString("apkUrl"),
            )
        }.also { connection.disconnect() }
    } catch (_: Exception) {
        null
    }

    private fun showUpdatePrompt(release: Release) {
        if (activity.isFinishing || activity.isDestroyed) return
        val dialog = AlertDialog.Builder(activity)
            .setTitle("Stream Deck update available")
            .setMessage(
                "Installed: ${BuildConfig.VERSION_NAME}\n" +
                    "Available: ${release.versionName}\n\n" +
                    "Download the update now? Fire TV will ask you to approve installation.",
            )
            .setNegativeButton("Not now", null)
            .setPositiveButton("Update") { _, _ -> download(release.apkUrl) }
            .create()
        dialog.setOnShowListener { dialog.getButton(AlertDialog.BUTTON_POSITIVE)?.requestFocus() }
        dialog.show()
    }

    private fun download(apkUrl: String) {
        val destination = File(activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), UPDATE_FILE_NAME)
        if (destination.exists()) destination.delete()

        val request = DownloadManager.Request(Uri.parse(apkUrl))
            .setTitle("Stream Deck update")
            .setDescription("Downloading the latest Fire TV app")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(
                activity,
                Environment.DIRECTORY_DOWNLOADS,
                UPDATE_FILE_NAME,
            )
            .setMimeType("application/vnd.android.package-archive")

        val manager = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val downloadId = try {
            manager.enqueue(request)
        } catch (_: Exception) {
            Toast.makeText(activity, "The update could not be downloaded.", Toast.LENGTH_LONG).show()
            return
        }
        Toast.makeText(activity, "Downloading update…", Toast.LENGTH_SHORT).show()
        executor.execute { waitForDownload(manager, downloadId, destination) }
    }

    private fun waitForDownload(manager: DownloadManager, downloadId: Long, destination: File) {
        while (!Thread.currentThread().isInterrupted) {
            val cursor = manager.query(DownloadManager.Query().setFilterById(downloadId))
            val status = cursor.use {
                if (!it.moveToFirst()) return
                it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            }
            when (status) {
                DownloadManager.STATUS_SUCCESSFUL -> {
                    activity.runOnUiThread {
                        if (destination.exists() && destination.length() > 0) requestInstall(destination)
                        else Toast.makeText(activity, "The downloaded update is incomplete.", Toast.LENGTH_LONG).show()
                    }
                    return
                }
                DownloadManager.STATUS_FAILED -> {
                    activity.runOnUiThread {
                        Toast.makeText(activity, "The update download failed.", Toast.LENGTH_LONG).show()
                    }
                    return
                }
            }
            try {
                Thread.sleep(1_000)
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
            }
        }
    }

    private fun requestInstall(apk: File) {
        pendingApk = apk
        if (canInstallPackages()) {
            openInstaller(apk)
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            permissionRequested = true
            Toast.makeText(activity, "Allow Stream Deck to install updates, then return.", Toast.LENGTH_LONG).show()
            activity.startActivity(
                Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${activity.packageName}"),
                ),
            )
        }
    }

    private fun canInstallPackages(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity.packageManager.canRequestPackageInstalls()

    private fun openInstaller(apk: File) {
        pendingApk = null
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.updates", apk)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            activity.startActivity(intent)
        } catch (_: Exception) {
            Toast.makeText(activity, "Fire TV could not open the update installer.", Toast.LENGTH_LONG).show()
        }
    }

    private data class Release(
        val versionCode: Int,
        val versionName: String,
        val apkUrl: String,
    )
}