package app.streamdeck.tv

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import org.json.JSONArray

/**
 * TiviMate-style Multi-view: up to four live channels side by side, each with
 * its own player and automatic reconnect. Only the selected screen has sound.
 * OK enlarges the selected screen; Back returns to the grid, then closes.
 */
@OptIn(UnstableApi::class)
class MultiViewActivity : Activity() {
    companion object {
        const val EXTRA_SCREENS = "screens"
        private const val USER_AGENT = "TiviMate/4.7.0 (Linux; Android 9)"
        private const val GIVE_UP_MS = 180_000L

        @Volatile
        var isOpen = false
    }

    private inner class Screen(val title: String, val url: String) {
        val frame = FrameLayout(this@MultiViewActivity)
        val view = PlayerView(this@MultiViewActivity)
        val label = TextView(this@MultiViewActivity)
        val player: ExoPlayer
        var attempts = 0
        var failingSince = 0L

        init {
            val http = DefaultHttpDataSource.Factory().setUserAgent(USER_AGENT)
                .setAllowCrossProtocolRedirects(true).setConnectTimeoutMs(15_000).setReadTimeoutMs(20_000)
            player = ExoPlayer.Builder(this@MultiViewActivity)
                .setMediaSourceFactory(DefaultMediaSourceFactory(http)).build()
            player.trackSelectionParameters = player.trackSelectionParameters.buildUpon()
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true).build()
            view.useController = false
            view.player = player
            view.setShutterBackgroundColor(Color.BLACK)
            frame.addView(view, FrameLayout.LayoutParams(-1, -1))
            label.text = title
            label.setTextColor(Color.WHITE)
            label.setBackgroundColor(0x99000000.toInt())
            label.setPadding(16, 8, 16, 8)
            label.textSize = 14f
            frame.addView(label, FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM or Gravity.START))
            player.addListener(object : Player.Listener {
                override fun onPlayerError(error: PlaybackException) = reconnect()
                override fun onPlaybackStateChanged(state: Int) {
                    if (state == Player.STATE_READY) { attempts = 0; failingSince = 0L; label.text = title }
                    if (state == Player.STATE_ENDED) reconnect()
                }
            })
            start()
        }

        fun start() {
            val builder = MediaItem.Builder().setUri(Uri.parse(url))
            if (url.contains(".m3u8", ignoreCase = true)) builder.setMimeType(MimeTypes.APPLICATION_M3U8)
            player.setMediaItem(builder.build())
            player.prepare()
            player.playWhenReady = true
        }

        fun reconnect() {
            val now = android.os.SystemClock.elapsedRealtime()
            if (failingSince == 0L) failingSince = now
            if (now - failingSince > GIVE_UP_MS) { label.text = "$title · couldn't connect (connection limit?)"; return }
            label.text = "$title · Reconnecting…"
            val delay = minOf(1000L * (1 shl minOf(attempts, 4)), 15_000L)
            attempts++
            handler.postDelayed({ if (!isFinishing) start() }, delay)
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private val screens = mutableListOf<Screen>()
    private var selected = 0
    private var enlarged = false
    private lateinit var root: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        isOpen = true
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.BLACK) }
        setContentView(root)
        val list = try { JSONArray(intent.getStringExtra(EXTRA_SCREENS) ?: "[]") } catch (_: Exception) { JSONArray() }
        for (i in 0 until minOf(list.length(), 4)) {
            val item = list.optJSONObject(i) ?: continue
            val url = item.optString("url")
            if (url.startsWith("http")) screens.add(Screen(item.optString("title"), url))
        }
        if (screens.isEmpty()) { finish(); return }
        layout()
    }

    private fun layout() {
        root.removeAllViews()
        screens.forEach { (it.frame.parent as? LinearLayout)?.removeView(it.frame) }
        if (enlarged) {
            root.addView(screens[selected].frame, LinearLayout.LayoutParams(-1, -1))
        } else {
            val rows = if (screens.size > 2) 2 else 1
            for (r in 0 until rows) {
                val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                root.addView(row, LinearLayout.LayoutParams(-1, 0, 1f))
                for (c in 0 until 2) {
                    val index = r * 2 + c
                    if (index < screens.size) row.addView(screens[index].frame, LinearLayout.LayoutParams(0, -1, 1f).apply { setMargins(4, 4, 4, 4) })
                    else if (screens.size > 1 || rows > 1) row.addView(View(this), LinearLayout.LayoutParams(0, -1, 1f))
                }
            }
        }
        highlight()
    }

    private fun highlight() {
        screens.forEachIndexed { index, screen ->
            val active = index == selected
            screen.player.volume = if (active) 1f else 0f
            screen.frame.foreground = if (active && !enlarged) GradientDrawable().apply {
                setStroke(8, 0xFF79DA8D.toInt()); setColor(Color.TRANSPARENT)
            } else null
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (!enlarged) {
            val next = when (keyCode) {
                KeyEvent.KEYCODE_DPAD_LEFT -> if (selected % 2 == 1) selected - 1 else selected
                KeyEvent.KEYCODE_DPAD_RIGHT -> if (selected % 2 == 0 && selected + 1 < screens.size) selected + 1 else selected
                KeyEvent.KEYCODE_DPAD_UP -> if (selected >= 2) selected - 2 else selected
                KeyEvent.KEYCODE_DPAD_DOWN -> if (selected + 2 < screens.size) selected + 2 else selected
                else -> -1
            }
            if (next >= 0) { selected = next; highlight(); return true }
        }
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
            if (!enlarged) { enlarged = true; layout() }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (enlarged) { enlarged = false; layout() } else finish()
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    @Deprecated("Back is handled on key release")
    override fun onBackPressed() { /* handled in onKeyUp */ }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        screens.forEach { it.player.release() }
        isOpen = false
        PlayerActivity.listener?.onClosed()
        super.onDestroy()
    }
}
