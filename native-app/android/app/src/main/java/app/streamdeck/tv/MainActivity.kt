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
 * Hosts the Jolzplay website full screen. When the site asks to play
 * something, playback is handed to [PlayerActivity], which fetches the stream
 * over this device's own connection (VPN included) — like TiviMate does.
 */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var appUpdater: AppUpdater
    private var lastPlayerClosedAt = 0L
    private var lastPlayRequestAt = 0L

    // Watchdog: if the page stops answering (stuck script or memory thrash),
    // reload it; if a reload doesn't bring it back, restart the app — nobody
    // should have to force stop it.
    private val watchdog = Handler(Looper.getMainLooper())
    private var isResumed = false
    private var lastPong = 0L
    private var lastRecovery = 0L
    private var pingInFlight = false
    private var slowPongs = 0
    private var reloadedAt = 0L
    // Page heartbeat (once a second) and the last step it reported.
    @Volatile private var lastBeatAt = 0L
    @Volatile private var lastBeatStep = ""
    private var beatGapLogged = false

    private fun beatInfo(): String {
        if (lastBeatAt == 0L) return "no heartbeat from page"
        return "last heartbeat ${SystemClock.elapsedRealtime() - lastBeatAt} ms ago, last step: $lastBeatStep"
    }

    /** Notes when the page's heartbeat stops and starts again — also while the player covers it. */
    private fun checkBeat() {
        if (lastBeatAt == 0L) return
        val gap = SystemClock.elapsedRealtime() - lastBeatAt
        if (gap > 8_000 && !beatGapLogged) {
            beatGapLogged = true
            NativeLog.add("Page heartbeat stopped (player open=${PlayerActivity.isOpen}, ${beatInfo()})")
        }
    }
    private val ping = object : Runnable {
        override fun run() {
            checkBeat()
            if (isResumed && ::webView.isInitialized && !PlayerActivity.isOpen && !MultiViewActivity.isOpen) {
                val now = SystemClock.elapsedRealtime()
                val stuck = now - lastPong > STUCK_MS || slowPongs >= SLOW_PONGS_LIMIT
                if (offlineView != null) {
                    // Waiting on the connection: come back by ourselves once it returns.
                    lastPong = now
                    slowPongs = 0
                    if (NetworkStatus.isOnline(this@MainActivity)) {
                        NativeLog.add("Connection is back, reloading page")
                        hideOffline()
                        reloadedAt = 0L
                        webView.reload()
                    }
                } else if (stuck && !NetworkStatus.isOnline(this@MainActivity)) {
                    // No internet: reloading or restarting can't help and loops. Say so instead.
                    NativeLog.add("Watchdog: page not answering and device is offline, showing No connection (${beatInfo()})")
                    lastPong = now
                    slowPongs = 0
                    pingInFlight = false
                    reloadedAt = 0L
                    showOffline()
                } else if (stuck && ((reloadedAt > 0 && now - reloadedAt > STUCK_MS) || now - lastRecovery < RECOVERY_COOLDOWN_MS)) {
                    // A reload didn't help (or it froze again soon after): restart the app.
                    NativeLog.add("Watchdog: page still stuck after reload, restarting app (${beatInfo()})")
                    restartApp()
                    return
                } else if (stuck) {
                    NativeLog.add("Watchdog: page not answering for ${now - lastPong} ms (slow answers: $slowPongs, ${beatInfo()}), reloading")
                    lastRecovery = now
                    reloadedAt = now
                    lastPong = now
                    slowPongs = 0
                    pingInFlight = false
                    webView.reload()
                } else if (!pingInFlight) {
                    pingInFlight = true
                    val sentAt = now
                    webView.evaluateJavascript("1") {
                        pingInFlight = false
                        val answered = SystemClock.elapsedRealtime()
                        lastPong = answered
                        slowPongs = if (answered - sentAt > SLOW_PONG_MS) slowPongs + 1 else 0
                        if (slowPongs > 0) NativeLog.add("Watchdog: page answered after ${answered - sentAt} ms")
                        if (slowPongs == 0) reloadedAt = 0L
                    }
                }
            } else {
                lastPong = SystemClock.elapsedRealtime()
                slowPongs = 0
            }
            // While the player covers the page, keep running so a page that
            // stops mid-playback is noticed (no recovery here, just a note).
            watchdog.postDelayed(this, 3_000)
        }
    }

    private var offlineView: android.view.View? = null

    /** Full-screen "No connection" message drawn natively, so it works even when the page is stuck. */
    private fun showOffline() {
        if (offlineView != null || isFinishing) return
        val dp = resources.displayMetrics.density
        fun button(label: String, onClick: () -> Unit) = android.widget.Button(this).apply {
            text = label
            textSize = 18f
            isFocusable = true
            setPadding((24 * dp).toInt(), (12 * dp).toInt(), (24 * dp).toInt(), (12 * dp).toInt())
            setOnClickListener { onClick() }
        }
        val retry = button("Try again") {
            if (NetworkStatus.isOnline(this)) {
                hideOffline(); reloadedAt = 0L; lastPong = SystemClock.elapsedRealtime(); webView.reload()
            } else android.widget.Toast.makeText(this, "Still no connection.", android.widget.Toast.LENGTH_SHORT).show()
        }
        val settings = button("Network settings") {
            try { startActivity(Intent(android.provider.Settings.ACTION_WIFI_SETTINGS)) }
            catch (_: Exception) { try { startActivity(Intent(android.provider.Settings.ACTION_SETTINGS)) } catch (_: Exception) {} }
        }
        val buttons = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER
            addView(retry)
            addView(android.widget.Space(this@MainActivity), android.widget.LinearLayout.LayoutParams((16 * dp).toInt(), 1))
            addView(settings)
        }
        val box = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            setBackgroundColor(0xFF121826.toInt())
            isClickable = true
            addView(android.widget.TextView(this@MainActivity).apply {
                text = "No connection"
                textSize = 32f
                setTextColor(0xFF79DA8D.toInt())
                gravity = android.view.Gravity.CENTER
            })
            addView(android.widget.TextView(this@MainActivity).apply {
                text = "Jolzplay can't reach the internet or your provider.\nCheck your connection. This screen closes by itself when it's back."
                textSize = 18f
                setTextColor(0xFFE6EAF0.toInt())
                gravity = android.view.Gravity.CENTER
                setPadding(0, (12 * dp).toInt(), 0, (24 * dp).toInt())
            })
            addView(buttons)
        }
        addContentView(box, android.view.ViewGroup.LayoutParams(android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.MATCH_PARENT))
        offlineView = box
        retry.requestFocus()
    }

    private fun hideOffline() {
        val v = offlineView ?: return
        offlineView = null
        (v.parent as? android.view.ViewGroup)?.removeView(v)
        webView.requestFocus()
    }

    /** Relaunch the app in a fresh process (the page's stuck process goes with it). */
    private fun restartApp() {
        if (RecordingManager.isRunning()) {
            // Killing the process would stop a recording: rebuild the page instead.
            reloadedAt = 0L
            lastPong = SystemClock.elapsedRealtime()
            rebuildWebView()
            watchdog.postDelayed(ping, 3_000)
            return
        }
        val intent = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        val pending = android.app.PendingIntent.getActivity(
            this, 4242, intent,
            android.app.PendingIntent.FLAG_CANCEL_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE,
        )
        val alarms = getSystemService(ALARM_SERVICE) as android.app.AlarmManager
        alarms.set(android.app.AlarmManager.RTC, System.currentTimeMillis() + 800, pending)
        NativeLog.flush()
        finishAffinity()
        android.os.Process.killProcess(android.os.Process.myPid())
    }

    companion object {
        private const val STUCK_MS = 12_000L
        private const val SLOW_PONG_MS = 4_000L
        private const val SLOW_PONGS_LIMIT = 4
        private const val RECOVERY_COOLDOWN_MS = 120_000L
        private const val BODY_PATH = "/__native-body/"
        private const val BODY_MAX_AGE_MS = 180_000L
    }

    /** Provider responses waiting for the page to download them from /__native-body/<id>. */
    private val bodies = java.util.concurrent.ConcurrentHashMap<String, Pair<Long, ByteArray>>()

    private inner class Client : WebViewClient() {
        override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
            NativeLog.add("Page loading: ${android.net.Uri.parse(url ?: "").path}")
        }

        override fun onPageFinished(view: WebView, url: String?) {
            NativeLog.add("Page finished loading: ${android.net.Uri.parse(url ?: "").path}")
        }

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
            val why = if (android.os.Build.VERSION.SDK_INT >= 26) "crashed=${detail.didCrash()}, priority=${detail.rendererPriorityAtExit()}" else "unknown"
            NativeLog.add("Page process ended ($why, playerOpen=${PlayerActivity.isOpen}), rebuilding")
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
        // Keep the page's process important while the full-screen player covers
        // it, so Android doesn't kill it first when memory runs low.
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            view.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
        }
        view.addJavascriptInterface(Bridge(), "StreamDeckNative")
        return view
    }

    private fun rebuildWebView() {
        if (isFinishing) return
        val old = webView
        bodies.clear()
        webView = createWebView()
        offlineView = null
        setContentView(webView)
        try { old.destroy() } catch (_: Exception) {}
        lastPong = SystemClock.elapsedRealtime()
        webView.loadUrl(BuildConfig.START_URL)
        webView.requestFocus()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NativeLog.init(applicationContext)
        NativeLog.add("App started (${BuildConfig.VERSION_NAME})${if (savedInstanceState != null) " — restored" else ""}")
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
                NativeLog.add("Player closed (${beatInfo()})")
                runOnUiThread {
                    val sentAt = SystemClock.elapsedRealtime()
                    webView.evaluateJavascript("window.__streamDeckClosed && window.__streamDeckClosed(), 1") {
                        NativeLog.add("Page handled the close message after ${SystemClock.elapsedRealtime() - sentAt} ms")
                    }
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
        NativeLog.add("App paused (playerOpen=${PlayerActivity.isOpen})")
        isResumed = false
        watchdog.removeCallbacks(ping)
        // Keep checking the page's heartbeat while the player covers it.
        watchdog.postDelayed(ping, 3_000)
        pausedAt = android.os.SystemClock.elapsedRealtime()
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        NativeLog.add("Android asked to free memory (level $level, playerOpen=${PlayerActivity.isOpen})")
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
            val hadFocus = webView.hasFocus()
            webView.requestFocus()
            NativeLog.add("App resumed (page had focus=$hadFocus, has focus=${webView.hasFocus()})")
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

    private var keysLoggedAfterClose = 0

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (offlineView != null) {
            if (event.keyCode == KeyEvent.KEYCODE_BACK) return true
            return super.dispatchKeyEvent(event)
        }
        if (event.keyCode == KeyEvent.KEYCODE_SEARCH || event.keyCode == KeyEvent.KEYCODE_VOICE_ASSIST) {
            if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('streamdeck-app-search'))", null)
            }
            return true
        }
        val sinceClose = android.os.SystemClock.elapsedRealtime() - lastPlayerClosedAt
        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            if (sinceClose > 30_000) keysLoggedAfterClose = 0
            else if (keysLoggedAfterClose < 12) {
                keysLoggedAfterClose += 1
                NativeLog.add("Key ${KeyEvent.keyCodeToString(event.keyCode)} ${sinceClose} ms after player closed (page focus=${webView.hasFocus()}, focused view=${currentFocus?.javaClass?.simpleName})")
            }
        }
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP && !event.isCanceled &&
                sinceClose > 600) {
                webView.evaluateJavascript(
                    "(() => { const e = new CustomEvent('streamdeck-back', {cancelable:true}); if (window.dispatchEvent(e)) { const close = document.querySelector('[data-dialog-back]'); if (close) close.click(); else if (location.pathname !== '/tv' && location.pathname !== '/tv/') location.assign('/tv'); } })()",
                    null,
                )
            }
            return true
        }
        // The page lost Android focus (e.g. after the player): give it back and
        // hand it this press directly, so the remote never goes dead.
        if (::webView.isInitialized && !webView.hasFocus()) {
            NativeLog.add("Page didn't have focus for ${KeyEvent.keyCodeToString(event.keyCode)}, handing it over")
            webView.requestFocus()
            if (webView.dispatchKeyEvent(event)) return true
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

        /** Private backup of the sign-in so a lost web view session doesn't need a new code. */
        @JavascriptInterface
        fun saveAuthBackup(value: String) {
            getSharedPreferences("streamdeck.auth", MODE_PRIVATE).edit().putString("session", value.take(20000)).apply()
        }

        @JavascriptInterface
        fun readAuthBackup(): String =
            getSharedPreferences("streamdeck.auth", MODE_PRIVATE).getString("session", "") ?: ""

        @JavascriptInterface
        fun clearAuthBackup() {
            getSharedPreferences("streamdeck.auth", MODE_PRIVATE).edit().remove("session").apply()
            NativeLog.add("Sign-in backup cleared")
        }

        @JavascriptInterface
        fun nativeLog(): String = NativeLog.json()

        /** A step from the page's trail, kept even if the page freezes right after. */
        @JavascriptInterface
        fun trace(message: String) {
            lastBeatStep = message.take(200)
            NativeLog.add("page: ${message.take(300)}")
        }

        /** Page heartbeat, once a second. */
        @JavascriptInterface
        fun beat(step: String) {
            val now = SystemClock.elapsedRealtime()
            if (beatGapLogged && lastBeatAt > 0) {
                NativeLog.add("Page heartbeat back after ${now - lastBeatAt} ms (last step: $step)")
            }
            beatGapLogged = false
            lastBeatAt = now
            lastBeatStep = step.take(200)
        }

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
            if (PlayerActivity.isOpen || now - lastPlayRequestAt < 3000 || now - lastPlayerClosedAt < 1500) {
                NativeLog.add("Play request ignored (player open=${PlayerActivity.isOpen})")
                return
            }
            lastPlayRequestAt = now
            NativeLog.add("Opening player (live=${request.optBoolean("live")})")
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
                for (key in bodies.keys.toList()) { val entry = bodies[key]; if (entry != null && now - entry.first > BODY_MAX_AGE_MS) bodies.remove(key) }
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
