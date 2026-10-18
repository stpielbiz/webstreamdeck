package app.streamdeck.tv

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Live TV recordings saved on this device. The index lives in recordings.json
 * next to the .ts files; recording runs in [RecordingService] so it survives
 * leaving the app, and future recordings are woken by AlarmManager.
 */
object RecordingManager {
    private const val USER_AGENT = "TiviMate/4.7.0 (Linux; Android 9)"
    private const val MIN_FREE_BYTES = 300L * 1024 * 1024
    private val active = ConcurrentHashMap<String, Thread>()
    private val stopRequested = ConcurrentHashMap.newKeySet<String>()

    /** Notifies the website when anything changes. */
    @Volatile var onChange: (() -> Unit)? = null

    fun dir(context: Context): File = (context.getExternalFilesDir("recordings") ?: File(context.filesDir, "recordings")).apply { mkdirs() }
    private fun indexFile(context: Context) = File(dir(context), "recordings.json")

    @Synchronized
    fun all(context: Context): JSONArray = try {
        JSONArray(indexFile(context).readText())
    } catch (_: Exception) {
        JSONArray()
    }

    @Synchronized
    private fun save(context: Context, list: JSONArray) {
        indexFile(context).writeText(list.toString())
        onChange?.invoke()
    }

    @Synchronized
    fun update(context: Context, id: String, change: (JSONObject) -> Unit) {
        val list = all(context)
        for (i in 0 until list.length()) {
            val entry = list.getJSONObject(i)
            if (entry.optString("id") == id) change(entry)
        }
        save(context, list)
    }

    fun find(context: Context, id: String): JSONObject? {
        val list = all(context)
        for (i in 0 until list.length()) if (list.getJSONObject(i).optString("id") == id) return list.getJSONObject(i)
        return null
    }

    /** Lists recordings with current file sizes. */
    fun listJson(context: Context): String {
        val list = all(context)
        for (i in 0 until list.length()) {
            val entry = list.getJSONObject(i)
            val file = File(dir(context), "${entry.optString("id")}.ts")
            entry.put("sizeBytes", if (file.exists()) file.length() else 0L)
        }
        return list.toString()
    }

    fun storageJson(context: Context): String {
        val d = dir(context)
        return JSONObject().put("freeBytes", d.usableSpace).put("totalBytes", d.totalSpace).toString()
    }

    /** Adds a recording; starts now if its start time has passed, otherwise sets an alarm. */
    fun add(context: Context, json: String): String {
        val request = JSONObject(json)
        val url = request.optString("url")
        if (!url.startsWith("http")) return ""
        val id = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()
        val startAt = request.optLong("startAt", now)
        val endAt = request.optLong("endAt", now + 60 * 60_000)
        if (endAt <= maxOf(now, startAt)) return ""
        val entry = JSONObject()
            .put("id", id)
            .put("title", request.optString("title"))
            .put("programme", request.optString("programme"))
            .put("url", url)
            .put("startAt", startAt)
            .put("endAt", endAt)
            .put("status", "scheduled")
            .put("createdAt", now)
        synchronized(this) {
            val list = all(context)
            list.put(entry)
            save(context, list)
        }
        if (startAt <= now + 5_000) startService(context, id) else setAlarm(context, id, startAt)
        return id
    }

    fun cancel(context: Context, id: String) {
        val entry = find(context, id) ?: return
        when (entry.optString("status")) {
            "recording" -> stopRequested.add(id)
            "scheduled" -> {
                clearAlarm(context, id)
                update(context, id) { it.put("status", "cancelled") }
            }
        }
    }

    fun delete(context: Context, id: String) {
        stopRequested.add(id)
        clearAlarm(context, id)
        File(dir(context), "$id.ts").delete()
        synchronized(this) {
            val list = all(context)
            val kept = JSONArray()
            for (i in 0 until list.length()) if (list.getJSONObject(i).optString("id") != id) kept.put(list.getJSONObject(i))
            save(context, kept)
        }
    }

    fun filePath(context: Context, id: String): File? = File(dir(context), "$id.ts").takeIf { it.exists() && it.length() > 0 }

    /** After a reboot or app update: re-arm future alarms, resume ones that should be running. */
    fun reschedule(context: Context) {
        val list = all(context)
        val now = System.currentTimeMillis()
        for (i in 0 until list.length()) {
            val entry = list.getJSONObject(i)
            val id = entry.optString("id")
            val status = entry.optString("status")
            val endAt = entry.optLong("endAt")
            if (status != "scheduled" && status != "recording") continue
            if (endAt <= now) {
                update(context, id) { it.put("status", if (status == "recording") "done" else "missed") }
            } else if (entry.optLong("startAt") <= now) {
                if (!active.containsKey(id)) startService(context, id)
            } else {
                setAlarm(context, id, entry.optLong("startAt"))
            }
        }
    }

    private fun alarmIntent(context: Context, id: String): PendingIntent {
        val intent = Intent(context, RecordingAlarmReceiver::class.java).putExtra("id", id)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        return PendingIntent.getBroadcast(context, id.hashCode(), intent, flags)
    }

    private fun setAlarm(context: Context, id: String, at: Long) {
        val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pending = alarmIntent(context, id)
        try {
            if (Build.VERSION.SDK_INT >= 31 && !alarms.canScheduleExactAlarms()) {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
            } else if (Build.VERSION.SDK_INT >= 23) {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
            } else {
                alarms.setExact(AlarmManager.RTC_WAKEUP, at, pending)
            }
        } catch (_: SecurityException) {
            alarms.set(AlarmManager.RTC_WAKEUP, at, pending)
        }
    }

    private fun clearAlarm(context: Context, id: String) {
        (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(alarmIntent(context, id))
    }

    fun startService(context: Context, id: String) {
        val intent = Intent(context, RecordingService::class.java).putExtra("id", id)
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
    }

    fun isRunning() = active.isNotEmpty()

    /** Runs one recording on its own thread; calls [done] when it ends. */
    fun run(context: Context, id: String, done: () -> Unit) {
        if (active.containsKey(id)) return
        val entry = find(context, id) ?: return done()
        val thread = Thread {
            val file = File(dir(context), "$id.ts")
            val endAt = entry.optLong("endAt")
            var status = "done"
            var error = ""
            update(context, id) { it.put("status", "recording") }
            try {
                FileOutputStream(file, true).use { out ->
                    val stop = {
                        when {
                            stopRequested.contains(id) -> true
                            System.currentTimeMillis() >= endAt -> true
                            dir(context).usableSpace < MIN_FREE_BYTES -> { status = "storage_full"; true }
                            else -> false
                        }
                    }
                    val url = entry.optString("url")
                    while (!stop()) {
                        try {
                            if (url.substringBefore('?').endsWith(".m3u8", true)) recordHls(url, out, stop)
                            else recordRaw(url, out, stop)
                        } catch (e: Exception) {
                            error = e.message ?: "Connection lost"
                        }
                        if (!stop()) Thread.sleep(2_000) // reconnect
                    }
                }
            } catch (e: Exception) {
                status = "failed"
                error = e.message ?: "Could not save"
            }
            if (stopRequested.remove(id) && status == "done") status = "stopped"
            if (status == "done" && file.length() == 0L) { status = "failed"; if (error.isEmpty()) error = "Nothing was received" }
            update(context, id) {
                it.put("status", status)
                it.put("finishedAt", System.currentTimeMillis())
                if (error.isNotEmpty() && status == "failed") it.put("error", error)
            }
            active.remove(id)
            done()
        }
        active[id] = thread
        thread.start()
    }

    private fun open(url: String): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.instanceFollowRedirects = true
        conn.connectTimeout = 15_000
        conn.readTimeout = 20_000
        conn.setRequestProperty("User-Agent", USER_AGENT)
        return conn
    }

    private fun recordRaw(url: String, out: FileOutputStream, stop: () -> Boolean) {
        val conn = open(url)
        try {
            if (conn.responseCode >= 400) throw Exception("Provider refused (${conn.responseCode})")
            conn.inputStream.use { input ->
                val buffer = ByteArray(64 * 1024)
                var checked = System.currentTimeMillis()
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    out.write(buffer, 0, read)
                    val now = System.currentTimeMillis()
                    if (now - checked > 2_000) {
                        checked = now
                        if (stop()) break
                    }
                }
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun fetchText(url: String): Pair<String, String> {
        val conn = open(url)
        try {
            if (conn.responseCode >= 400) throw Exception("Provider refused (${conn.responseCode})")
            return conn.url.toString() to conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    private fun recordHls(start: String, out: FileOutputStream, stop: () -> Boolean) {
        var (base, text) = fetchText(start)
        if (text.contains("#EXT-X-STREAM-INF")) {
            val variant = text.lines().map { it.trim() }.firstOrNull { it.isNotEmpty() && !it.startsWith("#") } ?: return
            val next = URL(URL(base), variant).toString()
            val fetched = fetchText(next)
            base = fetched.first
            text = fetched.second
        }
        val playlistUrl = base
        val seen = LinkedHashSet<String>()
        while (!stop()) {
            var wait = 3_000L
            for (line in text.lines()) {
                val trimmed = line.trim()
                if (trimmed.startsWith("#EXT-X-TARGETDURATION:")) {
                    wait = (trimmed.substringAfter(':').toLongOrNull() ?: 6) * 500
                }
                if (trimmed.isEmpty() || trimmed.startsWith("#")) continue
                val segment = URL(URL(base), trimmed).toString()
                if (!seen.add(segment)) continue
                val conn = open(segment)
                try {
                    conn.inputStream.use { it.copyTo(out, 64 * 1024) }
                } finally {
                    conn.disconnect()
                }
                if (stop()) return
            }
            while (seen.size > 200) seen.remove(seen.first())
            if (text.contains("#EXT-X-ENDLIST")) return
            Thread.sleep(wait.coerceIn(1_000, 6_000))
            val fetched = fetchText(playlistUrl)
            base = fetched.first
            text = fetched.second
        }
    }
}

/** Keeps recordings alive while the app is in the background. */
class RecordingService : Service() {
    private var running = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(1001, notification())
        val id = intent?.getStringExtra("id")
        if (id != null) {
            running++
            RecordingManager.run(applicationContext, id) {
                running--
                if (running <= 0 && !RecordingManager.isRunning()) stopSelf()
            }
        } else if (!RecordingManager.isRunning()) {
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun notification(): Notification {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(NotificationChannel("recordings", "Recordings", NotificationManager.IMPORTANCE_LOW))
        }
        @Suppress("DEPRECATION")
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "recordings") else Notification.Builder(this)
        return builder
            .setContentTitle("Stream Deck")
            .setContentText("Recording live TV")
            .setSmallIcon(android.R.drawable.presence_video_online)
            .setOngoing(true)
            .build()
    }
}

class RecordingAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra("id") ?: return
        RecordingManager.startService(context, id)
    }
}

class RecordingBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        RecordingManager.reschedule(context)
    }
}
