package app.streamdeck.tv

import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
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

/**
 * Built-in full-screen player (Media3 ExoPlayer). Plays HLS, MPEG-TS, MP4 and
 * MKV straight from the provider, reports progress back to the website, and
 * reconnects automatically when the provider drops or freezes the stream.
 */
@OptIn(UnstableApi::class)
class PlayerActivity : Activity() {
    interface Listener {
        fun onProgress(positionSeconds: Double, durationSeconds: Double)
        fun onEnded()
        fun onClosed()
    }

    companion object {
        const val EXTRA_URL = "url"
        const val EXTRA_TITLE = "title"
        const val EXTRA_LIVE = "live"
        const val EXTRA_START = "start"
        private const val USER_AGENT = "TiviMate/4.7.0 (Linux; Android 9)"
        private const val STALL_MS = 12_000L
        private const val GIVE_UP_MS = 180_000L
        private const val STEADY_MS = 60_000L

        @Volatile
        var listener: Listener? = null

        @Volatile
        var isOpen = false
    }

    private lateinit var player: ExoPlayer
    private lateinit var playerView: PlayerView
    private lateinit var reconnectLabel: TextView
    private val handler = Handler(Looper.getMainLooper())
    private var live = false
    private var ended = false
    private var closing = false
    private var candidates: MutableList<String> = mutableListOf()
    private var candidateIndex = 0

    // Recovery state
    private var attempts = 0
    private var failingSince = 0L
    private var playingSince = 0L
    private var lastPosition = -1L
    private var lastProgressAt = 0L
    private var bufferingSince = 0L
    private var lastKnownPositionMs = 0L
    private var reconnectPending = false

    private val progressTick = object : Runnable {
        override fun run() {
            reportProgress()
            handler.postDelayed(this, 10_000)
        }
    }

    private val reconnectRunnable = Runnable {
        reconnectPending = false
        if (closing) return@Runnable
        candidateIndex = (candidateIndex + 1) % candidates.size
        load(candidates[candidateIndex], if (live) 0 else lastKnownPositionMs)
    }

    private val watchdog = object : Runnable {
        override fun run() {
            checkStall()
            handler.postDelayed(this, 3_000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        isOpen = true

        val url = intent.getStringExtra(EXTRA_URL) ?: return finish()
        live = intent.getBooleanExtra(EXTRA_LIVE, false)
        val startSeconds = intent.getDoubleExtra(EXTRA_START, 0.0)
        candidates = alternates(url)

        val httpFactory = DefaultHttpDataSource.Factory()
            .setUserAgent(USER_AGENT)
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(20_000)

        player = ExoPlayer.Builder(this)
            .setMediaSourceFactory(DefaultMediaSourceFactory(this).setDataSourceFactory(httpFactory))
            .setSeekBackIncrementMs(10_000)
            .setSeekForwardIncrementMs(10_000)
            .build()

        // Providers ship subtitle tracks with many streams; never select one.
        player.trackSelectionParameters = player.trackSelectionParameters
            .buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            .build()

        playerView = PlayerView(this).apply {
            player = this@PlayerActivity.player
            useController = true
            controllerShowTimeoutMs = 3_000
            keepScreenOn = true
        }
        reconnectLabel = TextView(this).apply {
            text = "Reconnecting…"
            setTextColor(Color.WHITE)
            textSize = 18f
            setPadding(32, 16, 32, 16)
            setBackgroundColor(Color.argb(170, 0, 0, 0))
            visibility = View.GONE
        }
        val root = FrameLayout(this)
        root.addView(playerView, FrameLayout.LayoutParams(-1, -1))
        root.addView(
            reconnectLabel,
            FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.END).apply { setMargins(0, 48, 48, 0) },
        )
        setContentView(root)

        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    Player.STATE_BUFFERING -> if (bufferingSince == 0L) bufferingSince = SystemClock.elapsedRealtime()
                    Player.STATE_READY -> bufferingSince = 0L
                    Player.STATE_ENDED -> {
                        if (live) {
                            scheduleReconnect()
                        } else {
                            ended = true
                            reportProgress()
                            listener?.onEnded()
                            finish()
                        }
                    }
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) {
                    reconnectLabel.visibility = View.GONE
                    if (playingSince == 0L) playingSince = SystemClock.elapsedRealtime()
                } else {
                    playingSince = 0L
                    reportProgress()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                scheduleReconnect(error.errorCodeName)
            }
        })

        load(candidates.first(), if (!live && startSeconds > 5) (startSeconds * 1000).toLong() else 0)
        playerView.requestFocus()
    }

    private fun load(url: String, startMs: Long) {
        val builder = MediaItem.Builder().setUri(Uri.parse(url))
        if (url.substringBefore('?').endsWith(".m3u8", ignoreCase = true)) {
            builder.setMimeType(MimeTypes.APPLICATION_M3U8)
        }
        lastPosition = -1L
        lastProgressAt = SystemClock.elapsedRealtime()
        bufferingSince = 0L
        player.setMediaItem(builder.build(), startMs)
        player.prepare()
        player.playWhenReady = true
    }

    private fun scheduleReconnect(reason: String? = null) {
        if (closing || reconnectPending) return
        val now = SystemClock.elapsedRealtime()
        if (!live && player.currentPosition > 0) lastKnownPositionMs = player.currentPosition
        if (failingSince == 0L) failingSince = now
        if (now - failingSince > GIVE_UP_MS) {
            Toast.makeText(
                this,
                "Your provider stopped this channel" + (reason?.let { " ($it)" } ?: "") + ".",
                Toast.LENGTH_LONG,
            ).show()
            finish()
            return
        }
        val delay = if (attempts == 0) 0L else minOf(30_000L, 1_000L shl minOf(attempts, 5))
        attempts++
        reconnectPending = true
        reconnectLabel.visibility = View.VISIBLE
        handler.postDelayed(reconnectRunnable, delay)
    }

    private fun checkStall() {
        if (!::player.isInitialized || closing || reconnectPending) return
        val now = SystemClock.elapsedRealtime()
        if (player.isPlaying && playingSince > 0 && now - playingSince > STEADY_MS) {
            attempts = 0
            failingSince = 0L
        }
        if (!player.playWhenReady) {
            lastProgressAt = now
            return
        }
        if (bufferingSince > 0 && now - bufferingSince > STALL_MS) {
            scheduleReconnect()
            return
        }
        if (player.playbackState == Player.STATE_READY) {
            val pos = player.currentPosition
            if (pos != lastPosition) {
                lastPosition = pos
                lastProgressAt = now
                if (!live && pos > 0) lastKnownPositionMs = pos
            } else if (now - lastProgressAt > STALL_MS) {
                scheduleReconnect()
            }
        }
    }

    /** Providers often serve a line as only one of .m3u8 / .ts; try both. */
    private fun alternates(url: String): MutableList<String> {
        val list = mutableListOf(url)
        val path = url.substringBefore('?')
        val query = url.removePrefix(path)
        when {
            path.endsWith(".m3u8", true) -> list.add(path.dropLast(5) + ".ts" + query)
            path.endsWith(".ts", true) -> list.add(path.dropLast(3) + ".m3u8" + query)
        }
        return list
    }

    private fun reportProgress() {
        if (live || !::player.isInitialized) return
        val position = player.currentPosition / 1000.0
        val duration = if (player.duration > 0) player.duration / 1000.0 else 0.0
        if (position > 0) listener?.onProgress(position, duration)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) {
                closing = true
                handler.removeCallbacks(reconnectRunnable)
                reportProgress()
                if (::player.isInitialized) player.pause()
                finish()
            }
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                if (!playerView.isControllerFullyVisible) {
                    playerView.showController()
                    return true
                }
            }
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> if (!live) {
                player.seekForward(); return true
            }
            KeyEvent.KEYCODE_MEDIA_REWIND -> if (!live) {
                player.seekBack(); return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onStart() {
        super.onStart()
        handler.post(progressTick)
        handler.postDelayed(watchdog, 3_000)
        if (::player.isInitialized && !closing) player.playWhenReady = true
    }

    override fun onStop() {
        handler.removeCallbacks(progressTick)
        handler.removeCallbacks(watchdog)
        handler.removeCallbacks(reconnectRunnable)
        reconnectPending = false
        reportProgress()
        if (::player.isInitialized) player.pause()
        super.onStop()
    }

    override fun onDestroy() {
        isOpen = false
        closing = true
        handler.removeCallbacksAndMessages(null)
        if (::player.isInitialized) player.release()
        if (isFinishing && !ended) listener?.onClosed()
        super.onDestroy()
    }
}
