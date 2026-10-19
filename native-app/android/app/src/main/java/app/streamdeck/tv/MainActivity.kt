package app.streamdeck.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

/**
 * Hosts the Stream Deck website full screen. When the site asks to play
 * something, playback is handed to [PlayerActivity], which fetches the stream
 * over this device's own connection (VPN included) — like TiviMate does.
 */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var appUpdater: AppUpdater
    private var lastPlayerClosedAt = 0L
    private var lastPlayRequestAt = 0L

    // Watchdog: if the page stops answering (stuck script), reload the same
    // screen so nobody has to force stop the app.
    private val watchdog = Handler(Looper.getMainLooper())
    private var isResumed = false
    private var lastPong = 0L
    private var lastRecovery = 0L
    private val ping = object : Runnable {
        override fun run() {
            if (isResumed && ::webView.isInitialized && !PlayerActivity.isOpen) {
                val now = SystemClock.elapsedRealtime()
                if (now - lastPong > STUCK_MS && now - lastRecovery > RECOVERY_COOLDOWN_MS) {
                    lastRecovery = now
                    lastPong = now
                    webView.reload()
                } else {
                    webView.evaluateJavascript("1") { lastPong = SystemClock.elapsedRealtime() }
                }
            } else {
                lastPong = SystemClock.elapsedRealtime()
            }
            watchdog.postDelayed(this, 3_000)
        }
    }

    companion object {
        private const val STUCK_MS = 12_000L
        private const val RECOVERY_COOLDOWN_MS = 120_000L
        private const val BODY_PATH = "/__native-body/"
        private const val BODY_MAX_AGE_MS = 180_000L
    }

    /** Provider responses waiting for the page to download them from /__native-body/<id>. */
    private val bodies = java.util.concurrent.ConcurrentHashMap<String, Pair<Long, ByteArray>>()

    private inner class Client : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val path = request.url?.path ?: return null
            if (!path.startsWith(BODY_PATH)) return null
            val bytes = bodies.remove(path.removePrefix(BODY_PATH))?.second ?: ByteArray(0)
            return WebResourceResponse(
                "text/plain", "utf-8", 200, "OK",
                mapOf("Cache-Control" to "no-store"),
                java.io.ByteArrayInputStream(bytes),
            )
        }

        // The page crashed or ran out of memory: start it again instead of
        // leaving a dead screen (or letting Android close the app).
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            runOnUiThread { rebuildWebView() }
            return true
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView {
        val view = WebView(this)
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            useWideViewPort = true
            loadWithOverviewMode = true
            textZoom = 100
            // Present as the same player the providers already accept, so the
            // in-page Live TV preview can fetch streams directly from this
            // device instead of being refused like a browser.
            userAgentString = "TiviMate/4.7.0 (Linux; Android 9) StreamDeckTV/${BuildConfig.VERSION_NAME}"
        }
        view.webViewClient = Client()
        view.webChromeClient = WebChromeClient()
        view.addJavascriptInterface(Bridge(), "StreamDeckNative")
        return view
    }

    private fun rebuildWebView() {
        if (isFinishing) return
        val old = webView
        bodies.clear()
        webView = createWebView()
        setContentView(webView)
        try { old.destroy() } catch (_: Exception) {}
        lastPong = SystemClock.elapsedRealtime()
        webView.loadUrl(BuildConfig.START_URL)
        webView.requestFocus()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = createWebView()
        setContentView(webView)
        appUpdater = AppUpdater(this)

        PlayerActivity.listener = object : PlayerActivity.Listener {
            override fun onProgress(positionSeconds: Double, durationSeconds: Double) {
                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.__streamDeckProgress && window.__streamDeckProgress($positionSeconds, $durationSeconds)",
                        null,
                    )
                }
            }

            override fun onEnded() {
                runOnUiThread {
                    webView.evaluateJavascript("window.__streamDeckEnded && window.__streamDeckEnded()", null)
                }
            }

            override fun onClosed() {
                lastPlayerClosedAt = android.os.SystemClock.elapsedRealtime()
                runOnUiThread {
                    webView.evaluateJavascript("window.__streamDeckClosed && window.__streamDeckClosed()", null)
                    webView.requestFocus()
                }
            }

            override fun onChannelSwitched(title: String) {
                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.__streamDeckChannelSwitched && window.__streamDeckChannelSwitched(" + JSONObject.quote(title) + ")",
                        null,
                    )
                }
            }
        }

        // Fresh site files on every launch; saved data (IndexedDB/localStorage) is kept.
        webView.clearCache(false)
        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        else webView.loadUrl(BuildConfig.START_URL)
        webView.requestFocus()
        appUpdater.checkAtLaunch()
        RecordingManager.onChange = {
            runOnUiThread {
                if (::webView.isInitialized) webView.evaluateJavascript("window.__streamDeckRecordingUpdate && window.__streamDeckRecordingUpdate()", null)
            }
        }
        Thread { RecordingManager.reschedule(applicationContext) }.start()
    }

    private var pausedAt = 0L

    override fun onPause() {
        super.onPause()
        isResumed = false
        watchdog.removeCallbacks(ping)
        pausedAt = android.os.SystemClock.elapsedRealtime()
    }

    override fun onResume() {
        super.onResume()
        isResumed = true
        lastPong = SystemClock.elapsedRealtime()
        watchdog.removeCallbacks(ping)
        watchdog.postDelayed(ping, 3_000)
        if (::appUpdater.isInitialized) appUpdater.onResume()
        if (::webView.isInitialized) {
            // Hand the remote back to the page: without Android focus the WebView gets no arrow/OK presses.
            webView.requestFocus()
            webView.evaluateJavascript("window.__streamDeckResumed && window.__streamDeckResumed()", null)
        }
        val now = android.os.SystemClock.elapsedRealtime()
        val sincePlayer = now - lastPlayerClosedAt
        // Returning after a long absence (not from our own player): load the newest site.
        if (pausedAt > 0 && now - pausedAt > 30 * 60 * 1000 && sincePlayer > 5000 && ::webView.isInitialized) {
            webView.clearCache(false)
            webView.reload()
        }
        pausedAt = 0L
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && ::webView.isInitialized && !webView.hasFocus()) webView.requestFocus()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_SEARCH || event.keyCode == KeyEvent.KEYCODE_VOICE_ASSIST) {
            if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('streamdeck-app-search'))", null)
            }
            return true
        }
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP && !event.isCanceled &&
                android.os.SystemClock.elapsedRealtime() - lastPlayerClosedAt > 600) {
                webView.evaluateJavascript(
                    "(() => { const e = new CustomEvent('streamdeck-back', {cancelable:true}); if (window.dispatchEvent(e)) { const close = document.querySelector('[data-dialog-back]'); if (close) close.click(); else if (location.pathname !== '/tv' && location.pathname !== '/tv/') location.assign('/tv'); } })()",
                    null,
                )
            }
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onDestroy() {
        PlayerActivity.listener = null
        RecordingManager.onChange = null
        if (::appUpdater.isInitialized) appUpdater.close()
        webView.destroy()
        super.onDestroy()
    }

    inner class Bridge {
        @JavascriptInterface
        fun isPlayerOpen(): Boolean = PlayerActivity.isOpen

        /** Open Multi-view with up to four live channels: JSON array of {url,title}. */
        @JavascriptInterface
        fun playMulti(json: String) {
            val now = android.os.SystemClock.elapsedRealtime()
            if (PlayerActivity.isOpen || MultiViewActivity.isOpen || now - lastPlayRequestAt < 3000) return
            lastPlayRequestAt = now
            val intent = Intent(this@MainActivity, MultiViewActivity::class.java).apply {
                putExtra(MultiViewActivity.EXTRA_SCREENS, json)
            }
            runOnUiThread { startActivity(intent) }
        }

        @JavascriptInterface
        fun play(json: String) {
            val request = try {
                JSONObject(json)
            } catch (_: Exception) {
                return
            }
            val url = request.optString("url")
            if (!url.startsWith("http")) return
            // Ignore repeat requests while a player is open or just closed, so a
            // misbehaving page can never stack players and freeze the device.
            val now = android.os.SystemClock.elapsedRealtime()
            if (PlayerActivity.isOpen || now - lastPlayRequestAt < 3000 || now - lastPlayerClosedAt < 1500) return
            lastPlayRequestAt = now
            // Recent channels are a live-TV shortcut; drop them so a movie or show
            // never inherits the previous Live TV session's list.
            if (!request.optBoolean("live")) PlayerActivity.recentChannels = emptyList()
            val intent = Intent(this@MainActivity, PlayerActivity::class.java).apply {
                putExtra(PlayerActivity.EXTRA_URL, url)
                putExtra(PlayerActivity.EXTRA_TITLE, request.optString("title"))
                putExtra(PlayerActivity.EXTRA_LIVE, request.optBoolean("live"))
                putExtra(PlayerActivity.EXTRA_START, request.optDouble("startPosition", 0.0))
            }
            runOnUiThread { startActivity(intent) }
        }

        /** Fetch provider data over this device's own connection (VPN included). */
        @JavascriptInterface
        fun fetchText(requestId: String, url: String, userAgent: String) {
            if (!url.startsWith("http")) return
            Thread {
                var status = 0
                var body = ""
                try {
                    val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                    conn.instanceFollowRedirects = true
                    conn.connectTimeout = 20_000
                    conn.readTimeout = 90_000
                    conn.setRequestProperty("User-Agent", userAgent)
                    conn.setRequestProperty("Accept", "*/*")
                    status = conn.responseCode
                    val stream = if (status >= 400) conn.errorStream else conn.inputStream
                    body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                    conn.disconnect()
                } catch (_: Exception) {
                    status = 0
                }
                val script = "window.__streamDeckFetchDone && window.__streamDeckFetchDone(" +
                    JSONObject.quote(requestId) + "," + status + "," + JSONObject.quote(body) + ")"
                runOnUiThread { webView.evaluateJavascript(script, null) }
            }.start()
        }

        /**
         * Same as [fetchText], but the body is kept as bytes and the page
         * downloads it from /__native-body/<id> — no multi-megabyte script
         * string for the page to compile, which froze Fire Sticks.
         */
        @JavascriptInterface
        fun fetchToUrl(requestId: String, url: String, userAgent: String) {
            if (!url.startsWith("http")) return
            Thread {
                var status = 0
                var bytes = ByteArray(0)
                try {
                    val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                    conn.instanceFollowRedirects = true
                    conn.connectTimeout = 20_000
                    conn.readTimeout = 90_000
                    conn.setRequestProperty("User-Agent", userAgent)
                    conn.setRequestProperty("Accept", "*/*")
                    status = conn.responseCode
                    val stream = if (status >= 400) conn.errorStream else conn.inputStream
                    bytes = stream?.use { it.readBytes() } ?: ByteArray(0)
                    conn.disconnect()
                } catch (_: Exception) {
                    status = 0
                } catch (_: OutOfMemoryError) {
                    status = 0
                    bytes = ByteArray(0)
                }
                val now = SystemClock.elapsedRealtime()
                bodies.entries.removeIf { now - it.value.first > BODY_MAX_AGE_MS }
                if (status > 0) bodies[requestId] = now to bytes
                val script = "window.__streamDeckFetchReady && window.__streamDeckFetchReady(" +
                    JSONObject.quote(requestId) + "," + status + ")"
                runOnUiThread { webView.evaluateJavascript(script, null) }
            }.start()
        }


        @JavascriptInterface
        fun version(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun checkForUpdates() {
            runOnUiThread { appUpdater.checkManually() }
        }

        /** Drops cached site files and reloads the newest published version. */
        @JavascriptInterface
        fun reloadApp(url: String) {
            runOnUiThread {
                webView.clearCache(false)
                webView.loadUrl(url)
            }
        }

        /** Hands the player's bottom bar the recent channels: JSON array of {title, url}. */
        @JavascriptInterface
        fun setRecentChannels(json: String) {
            try {
                val array = org.json.JSONArray(json)
                val list = mutableListOf<Pair<String, String>>()
                for (i in 0 until minOf(array.length(), 10)) {
                    val entry = array.getJSONObject(i)
                    val url = entry.optString("url")
                    if (url.startsWith("http")) list.add(entry.optString("title") to url)
                }
                PlayerActivity.recentChannels = list
            } catch (_: Exception) {
            }
        }

        /** Keeps the screen on during long background updates. */
        @JavascriptInterface
        fun setKeepAwake(enabled: Boolean) {
            runOnUiThread {
                if (enabled) webView.keepScreenOn = true else webView.keepScreenOn = false
            }
        }

        /** Records a live channel: JSON {title, programme, url, startAt, endAt} (ms). Returns the id, or "". */
        @JavascriptInterface
        fun startRecording(json: String): String = try {
            RecordingManager.add(applicationContext, json)
        } catch (_: Exception) {
            ""
        }

        @JavascriptInterface
        fun cancelRecording(id: String) = RecordingManager.cancel(applicationContext, id)

        @JavascriptInterface
        fun deleteRecording(id: String) = RecordingManager.delete(applicationContext, id)

        @JavascriptInterface
        fun listRecordings(): String = RecordingManager.listJson(applicationContext)

        @JavascriptInterface
        fun getStorageInfo(): String = RecordingManager.storageJson(applicationContext)

        /** Plays a saved recording in the built-in player. */
        @JavascriptInterface
        fun playRecording(id: String) {
            val file = RecordingManager.filePath(applicationContext, id) ?: return
            val entry = RecordingManager.find(applicationContext, id)
            if (PlayerActivity.isOpen) return
            PlayerActivity.recentChannels = emptyList()
            val intent = Intent(this@MainActivity, PlayerActivity::class.java).apply {
                putExtra(PlayerActivity.EXTRA_URL, android.net.Uri.fromFile(file).toString())
                putExtra(PlayerActivity.EXTRA_TITLE, entry?.optString("title") ?: "Recording")
                putExtra(PlayerActivity.EXTRA_LIVE, false)
                putExtra(PlayerActivity.EXTRA_START, 0.0)
            }
            runOnUiThread { startActivity(intent) }
        }

    }
}
