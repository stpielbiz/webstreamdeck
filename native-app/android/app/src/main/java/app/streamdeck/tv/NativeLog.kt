package app.streamdeck.tv

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Small event log kept by the app itself (lifecycle, recoveries, key
 * delivery). It is saved to a file so it survives a page crash or app restart,
 * and the website merges it into the diagnostics it uploads.
 */
object NativeLog {
    private const val MAX = 150
    private val lines = ArrayDeque<JSONObject>()
    private var file: File? = null

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
        try {
            file?.writeText(JSONArray(lines.toList()).toString())
        } catch (_: Exception) {
        }
    }

    @Synchronized
    fun json(): String = JSONArray(lines.toList()).toString()
}
