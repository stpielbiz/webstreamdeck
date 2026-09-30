package app.streamdeck.tv

import android.app.Activity
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.WindowManager
import android.widget.Toast
import androidx.annotation.OptIn
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
 * MKV straight from the provider, and reports progress back to the website.
 */
@OptIn(UnstableApi::class)
class PlayerActivity : Activity() {
    interface Listener {
        fun onProgress(positionSeconds: Double, durationSeconds: Double)
        fun onEnded()
    }

    companion object {
        const val EXTRA_URL = "url"
        const val EXTRA_TITLE = "title"
        const val EXTRA_LIVE = "live"
        const val EXTRA_START = "start"
        private const val USER_AGENT = "TiviMate/4.7.0 (Linux; Android 9)"

        @Volatile
        var listener: Listener? = null
    }

    private lateinit var player: ExoPlayer
    private lateinit var playerView: PlayerView
    private val handler = Handler(Looper.getMainLooper())
    private var live = false
    private var candidates: MutableList<String> = mutableListOf()

    private val progressTick = object : Runnable {
        override fun run() {
            reportProgress()
            handler.postDelayed(this, 10_000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

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

        playerView = PlayerView(this).apply {
            player = this@PlayerActivity.player
            useController = true
            controllerShowTimeoutMs = 3_000
            keepScreenOn = true
        }
        setContentView(playerView)

        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_ENDED && !live) {
                    reportProgress()
                    listener?.onEnded()
                    finish()
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (!isPlaying) reportProgress()
            }

            override fun onPlayerError(error: PlaybackException) {
                if (candidates.size > 1) {
                    candidates.removeAt(0)
                    load(candidates.first(), 0)
                } else {
                    Toast.makeText(
                        this@PlayerActivity,
                        "Your provider refused this stream (${error.errorCodeName}).",
                        Toast.LENGTH_LONG,
                    ).show()
                    finish()
                }
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
        player.setMediaItem(builder.build(), startMs)
        player.prepare()
        player.playWhenReady = true
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
    }

    override fun onStop() {
        handler.removeCallbacks(progressTick)
        reportProgress()
        if (::player.isInitialized) player.pause()
        super.onStop()
    }

    override fun onDestroy() {
        if (::player.isInitialized) player.release()
        super.onDestroy()
    }
}
