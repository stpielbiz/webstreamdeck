package app.streamdeck.tv

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.TextUtils
import android.util.TypedValue
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
import androidx.media3.datasource.DefaultDataSource
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
        /** The bottom bar switched to another recent channel without closing. */
        fun onChannelSwitched(title: String) {}
    }

    companion object {
        const val EXTRA_URL = "url"
        const val EXTRA_TITLE = "title"
        const val EXTRA_LIVE = "live"
        const val EXTRA_START = "start"
        private const val USER_AGENT = "TiviMate/4.7.0 (Linux; Android 9)"
        private const val STALL_MS = 12_000L
        private const val GIVE_UP_MS = 180_000L
        private const val OFFLINE_GIVE_UP_MS = 15_000L
        private const val STEADY_MS = 60_000L
        /** Side of a recent-channel tile, in dp. */
        private const val TILE_DP = 160
        /** Accent ring colour for a focused recent-channel tile. */
        private val ACCENT = Color.rgb(121, 218, 141)

        @Volatile
        var listener: Listener? = null

        @Volatile
        var isOpen = false

        /** Recent channels for the bottom bar, set by the website via the bridge. */
        @Volatile
        var recentChannels: List<Pair<String, String>> = emptyList()
    }

    private lateinit var player: ExoPlayer
    private lateinit var playerView: PlayerView
    private lateinit var reconnectLabel: TextView
    private lateinit var recentBar: android.widget.HorizontalScrollView
    private lateinit var recentRow: android.widget.LinearLayout
    private var currentTitle = ""
    private val hideRecentBar = Runnable { recentBar.visibility = View.GONE }
    private val handler = Handler(Looper.getMainLooper())
    private var live = false
    private var ended = false
    private var closing = false
    private var closedNotified = false

    /** Tell the website right away; Android may destroy this activity seconds later. */
    private fun notifyClosed() {
        if (closedNotified || ended) return
        closedNotified = true
        isOpen = false
        listener?.onClosed()
    }
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
        currentTitle = intent.getStringExtra(EXTRA_TITLE) ?: ""
        live = intent.getBooleanExtra(EXTRA_LIVE, false)
        val startSeconds = intent.getDoubleExtra(EXTRA_START, 0.0)
        android.util.Log.i("JolzplayPlayer", "Resume requested at ${startSeconds}s")
        candidates = alternates(url)

        val httpFactory = DefaultHttpDataSource.Factory()
            .setUserAgent(USER_AGENT)
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(20_000)

        player = ExoPlayer.Builder(this)
            .setMediaSourceFactory(DefaultMediaSourceFactory(this).setDataSourceFactory(DefaultDataSource.Factory(this, httpFactory)))
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
        // TiviMate-style bottom bar: recent channels, shown with Down.
        recentRow = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.HORIZONTAL
            setPadding(dp(24), dp(18), dp(24), dp(18))
            // Focused tiles grow, so nothing in the chain may clip them.
            clipChildren = false
            clipToPadding = false
        }
        recentBar = android.widget.HorizontalScrollView(this).apply {
            addView(recentRow)
            setBackgroundColor(Color.argb(190, 0, 0, 0))
            visibility = View.GONE
            isHorizontalScrollBarEnabled = false
            clipChildren = false
            clipToPadding = false
        }
        val root = FrameLayout(this)
        root.clipChildren = false
        root.clipToPadding = false
        root.addView(playerView, FrameLayout.LayoutParams(-1, -1))
        root.addView(
            reconnectLabel,
            FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.END).apply { setMargins(0, 48, 48, 0) },
        )
        root.addView(recentBar, FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM))
        setContentView(root)

        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    Player.STATE_BUFFERING -> if (bufferingSince == 0L) bufferingSince = SystemClock.elapsedRealtime()
                    Player.STATE_READY -> {
                        bufferingSince = 0L
                        // Some provider streams ignore the start position given with the
                        // media item; jump there once ready, retrying once.
                        if (pendingStartMs > 0) {
                            if (player.currentPosition < pendingStartMs - 5_000 && seekRetries < 2 && player.isCurrentMediaItemSeekable) {
                                seekRetries += 1
                                player.seekTo(pendingStartMs)
                            } else {
                                pendingStartMs = 0L
                            }
                        }
                    }
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
        pendingStartMs = startMs
        seekRetries = 0
        player.setMediaItem(builder.build(), startMs)
        player.prepare()
        player.playWhenReady = true
    }

    private fun scheduleReconnect(reason: String? = null) {
        if (closing || reconnectPending) return
        val now = SystemClock.elapsedRealtime()
        if (!live && player.currentPosition > 0) lastKnownPositionMs = player.currentPosition
        if (failingSince == 0L) failingSince = now
        val offline = !NetworkStatus.isOnline(this)
        if (now - failingSince > GIVE_UP_MS || (offline && now - failingSince > OFFLINE_GIVE_UP_MS)) {
            NativeLog.add("Player giving up (offline=$offline, reason=$reason)")
            Toast.makeText(
                this,
                if (offline) "No connection. Check your internet and try again."
                else "No data from your provider" + (reason?.let { " ($it)" } ?: "") + ". Try again in a moment.",
                Toast.LENGTH_LONG,
            ).show()
            closing = true
            notifyClosed()
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

    private var pendingStartMs = 0L
    private var seekRetries = 0

    private fun reportProgress() {
        if (live || !::player.isInitialized) return
        // Don't overwrite the saved spot while the resume jump is still pending.
        if (pendingStartMs > 0) return
        val position = player.currentPosition / 1000.0
        val duration = if (player.duration > 0) player.duration / 1000.0 else 0.0
        if (position > 0) listener?.onProgress(position, duration)
    }

    private fun showRecentBar() {
        // Recent channels are a live-TV shortcut; movies and shows use Down for seeking.
        if (!live) return
        if (!::recentBar.isInitialized) return
        recentRow.removeAllViews()
        val channels = recentChannels
        if (channels.isEmpty()) return
        channels.forEachIndexed { index, (title, channelUrl) ->
            val button = android.widget.Button(this).apply {
                text = title
                maxLines = 2
                ellipsize = TextUtils.TruncateAt.END
                isAllCaps = false
                gravity = Gravity.CENTER
                textSize = 15f
                setTextColor(Color.WHITE)
                setPadding(dp(12), dp(10), dp(12), dp(10))
                minWidth = 0
                minHeight = 0
                stateListAnimator = null
                isFocusable = true
                background = tileBackground(false)
                setOnClickListener { switchChannel(title, channelUrl) }
                setOnFocusChangeListener { view, hasFocus ->
                    view.background = tileBackground(hasFocus)
                    view.elevation = if (hasFocus) dp(14).toFloat() else 0f
                    view.animate()
                        .scaleX(if (hasFocus) 1.08f else 1f)
                        .scaleY(if (hasFocus) 1.08f else 1f)
                        .setDuration(150)
                        .start()
                    if (hasFocus) scheduleHideRecentBar()
                }
            }
            recentRow.addView(
                button,
                android.widget.LinearLayout.LayoutParams(dp(TILE_DP), dp(TILE_DP)).apply { marginEnd = dp(16) },
            )
            if (index == 0) button.requestFocus()
        }
        recentBar.visibility = View.VISIBLE
        scheduleHideRecentBar()
    }

    private fun scheduleHideRecentBar() {
        handler.removeCallbacks(hideRecentBar)
        handler.postDelayed(hideRecentBar, 5_000)
    }

    private fun switchChannel(title: String, channelUrl: String) {
        currentTitle = title
        candidates = alternates(channelUrl)
        candidateIndex = 0
        attempts = 0
        failingSince = 0L
        load(candidates.first(), 0)
        recentBar.visibility = View.GONE
        listener?.onChannelSwitched(title)
    }

    /** Square recent-channel tile: muted fill with a hairline ring, accent ring when focused. */
    private fun tileBackground(focused: Boolean) = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(14).toFloat()
        setColor(if (focused) Color.argb(235, 33, 57, 59) else Color.argb(150, 26, 26, 26))
        setStroke(dp(3), if (focused) ACCENT else Color.argb(90, 255, 255, 255))
    }

    private fun dp(value: Int) = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP,
        value.toFloat(),
        resources.displayMetrics,
    ).toInt()

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) {
                if (::recentBar.isInitialized && recentBar.visibility == View.VISIBLE) {
                    recentBar.visibility = View.GONE
                    playerView.requestFocus()
                    return true
                }
                closing = true
                handler.removeCallbacks(reconnectRunnable)
                reportProgress()
                if (::player.isInitialized) player.pause()
                notifyClosed()
                finish()
            }
            return true
        }
        if (event.keyCode == KeyEvent.KEYCODE_DPAD_DOWN && event.action == KeyEvent.ACTION_DOWN) {
            if (::recentBar.isInitialized && recentBar.visibility == View.VISIBLE) {
                recentBar.visibility = View.GONE
                playerView.requestFocus()
            } else if (live) {
                // Only live channels get the recent-channels bar; VOD keeps Down for seeking.
                showRecentBar()
            } else {
                return super.dispatchKeyEvent(event)
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
        if (isFinishing) notifyClosed()
        super.onDestroy()
    }
}
