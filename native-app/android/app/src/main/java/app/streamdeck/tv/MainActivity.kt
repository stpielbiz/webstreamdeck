package app.streamdeck.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
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

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        appUpdater = AppUpdater(this)

        webView.settings.apply {
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
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(Bridge(), "StreamDeckNative")

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
        }

        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        else webView.loadUrl(BuildConfig.START_URL)
        webView.requestFocus()
        appUpdater.checkAtLaunch()
    }

    override fun onResume() {
        super.onResume()
        if (::appUpdater.isInitialized) appUpdater.onResume()
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
        if (::appUpdater.isInitialized) appUpdater.close()
        webView.destroy()
        super.onDestroy()
    }

    inner class Bridge {
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

        @JavascriptInterface
        fun version(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun checkForUpdates() {
            runOnUiThread { appUpdater.checkManually() }
        }

        /** Keeps the screen on during long background updates. */
        @JavascriptInterface
        fun setKeepAwake(enabled: Boolean) {
            runOnUiThread {
                if (enabled) webView.keepScreenOn = true else webView.keepScreenOn = false
            }
        }

    }
}
