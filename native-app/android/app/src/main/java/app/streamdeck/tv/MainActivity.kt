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

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            useWideViewPort = true
            loadWithOverviewMode = true
            textZoom = 100
            userAgentString = "$userAgentString StreamDeckTV/${BuildConfig.VERSION_NAME}"
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
        }

        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        else webView.loadUrl(BuildConfig.START_URL)
        webView.requestFocus()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        PlayerActivity.listener = null
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
            val intent = Intent(this@MainActivity, PlayerActivity::class.java).apply {
                putExtra(PlayerActivity.EXTRA_URL, url)
                putExtra(PlayerActivity.EXTRA_TITLE, request.optString("title"))
                putExtra(PlayerActivity.EXTRA_LIVE, request.optBoolean("live"))
                putExtra(PlayerActivity.EXTRA_START, request.optDouble("startPosition", 0.0))
            }
            runOnUiThread { startActivity(intent) }
        }

        @JavascriptInterface
        fun version(): String = BuildConfig.VERSION_NAME
    }
}
