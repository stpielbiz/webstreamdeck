package app.streamdeck.tv

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Small event log kept by the app itself (lifecycle, recoveries, key
 * delivery, and the page's own step trail). It is saved to a file so it
 * survives a page crash or app restart, and the website merges it into the
 * diagnostics it uploads.
 */
object NativeLog {
    private const val MAX = 400
    private val lines = ArrayDeque<JSONObject>()
    private var file: File? = null
    private val writer = Executors.newSingleThreadScheduledExecutor()
    private var writePending = false

    @Synchronized
    fun init(context: Context) {
        if (file != null) return
        val target = File(context.filesDir, "native-log.json")
        file = target
        try {
            if (target.exists()) {
                val array = JSONArray(target.readText())
                for (i in 0 until array.length()) lines.addLast(array.getJSONObject(i))
            }
        } catch (_: Exception) {
            lines.clear()
        }
    }

    @Synchronized
    fun add(message: String) {
        lines.addLast(JSONObject().put("at", System.currentTimeMillis()).put("message", message))
        while (lines.size > MAX) lines.removeFirst()
        // Saved in the background shortly after, so a burst of page steps never
        // slows the page or the remote down.
        if (!writePending) {
            writePending = true
            writer.schedule(Runnable { flush() }, 300, TimeUnit.MILLISECONDS)
        }
    }

    /** Write the log to disk now (also used right before the app restarts itself). */
    @Synchronized
    fun flush() {
        writePending = false
        try {
            file?.writeText(JSONArray(lines.toList()).toString())
        } catch (_: Exception) {
        }
    }

    @Synchronized
    fun json(): String = JSONArray(lines.toList()).toString()
}
