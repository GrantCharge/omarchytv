package com.omarchytv.home;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.InputStream;

/**
 * The plane radar: a full-screen map centred on the TV's place (Settings > Weather) with the planes around it, live
 * (assets/radar, an original page). The planes come from the same services as the Pulse screensaver's panel
 * (adsb.lol, adsbdb, and OpenSky when screensaver.opensky is on), read through the launcher (PulseSaver.proxy), so
 * the OpenSky token never reaches the page. The map pictures are Esri's public tiles; without them the page draws
 * its own map from the land outlines in the APK. The remote: left/right pick a plane, up/down change the range, OK
 * changes the map, Back drops the pick and then leaves. If the WebView renderer dies the page is reloaded once on a
 * fresh WebView; a second death closes the radar with a toast, it never takes the launcher down.
 */
public final class RadarActivity extends Activity {
    private static final String TAG = "OmarchyTV";
    private static final String HOST = "appassets.androidplatform.net";
    /** The map pictures and the aircraft photos: plain images the WebView reads itself. */
    private static final String TILES = "server.arcgisonline.com";
    private static final String PHOTOS = "airport-data.com";
    private static final String URL = "https://" + HOST + "/assets/radar/index.html";
    private WebView web;
    private FrameLayout root;
    private int rendererCrashes;

    static void open(Context c) {
        c.startActivity(new Intent(c, RadarActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }

    /** The APK assets the radar page may load: its own folder and the two Pulse files it shares the plane data with. */
    static boolean asset(String path) {
        return path != null && !path.contains("..") && (path.startsWith("/assets/radar/")
                || path.equals("/assets/pulse/pulse-tv-data.js") || path.equals("/assets/pulse/pulse-tv-hub.js"));
    }

    /** An image the WebView may fetch on its own: a map tile or an aircraft photo, https only. */
    static boolean picture(String scheme, String host) {
        return "https".equals(scheme) && host != null
                && (host.equals(TILES) || host.equals(PHOTOS) || host.endsWith("." + PHOTOS));
    }

    /** {lat, lon, city, range, opensky, openskyAuth}: what radar.js reads at start. */
    static String config(Context c) {
        try {
            LauncherConfig cfg = LauncherConfig.get(c);
            JSONObject o = new JSONObject().put("city", cfg.weatherPlace).put("range", cfg.pulsePlanesNm)
                    .put("opensky", cfg.pulseOpensky)
                    .put("openskyAuth", cfg.pulseOpensky && PulseSaver.openskyCreds(c) != null);
            if (!Double.isNaN(cfg.weatherLat) && !Double.isNaN(cfg.weatherLon)) o.put("lat", cfg.weatherLat).put("lon", cfg.weatherLon);
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(LauncherConfig.wrap(base));
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        setContentView(root);
        if (!attachWeb()) finish();   // no WebView on this TV
    }

    /** A new WebView on the radar page: once from onCreate, and once more after the renderer dies. */
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private boolean attachWeb() {
        WebView w;
        try {
            w = new WebView(this);
        } catch (Throwable e) {
            return false;
        }
        w.setBackgroundColor(Color.BLACK);
        w.setFocusable(false);
        w.setVerticalScrollBarEnabled(false);
        w.setHorizontalScrollBarEnabled(false);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // the range and the map style, kept between visits
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        final Context app = getApplicationContext();
        final android.content.res.AssetManager assets = getAssets();
        w.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (picture(u.getScheme(), u.getHost())) return null;   // the WebView fetches the image
                if (PulseSaver.proxied(u)) return PulseSaver.proxy(app, u, "https://" + HOST);   // the plane data
                String p = u.getPath();
                if (!HOST.equals(u.getHost()) || !asset(p)) return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
                try {
                    InputStream in = assets.open(p.substring("/assets/".length()));
                    String mime = p.endsWith(".js") ? "text/javascript" : p.endsWith(".html") ? "text/html" : "application/octet-stream";
                    return new WebResourceResponse(mime, "utf-8", in);
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return true;   // never navigate anywhere
            }

            @android.annotation.TargetApi(26)
            @Override
            public boolean onRenderProcessGone(WebView v, android.webkit.RenderProcessGoneDetail d) {
                rendererGone(v);
                return true;
            }
        });
        w.addJavascriptInterface(new Bridge(), "OmarchyRadar");
        web = w;
        root.addView(w, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        w.loadUrl(URL);
        return true;
    }

    /** The renderer crashed or the TV killed it for memory: free the dead WebView, reload once, then give up politely. */
    private void rendererGone(WebView v) {
        if (web == v) web = null;
        if (v.getParent() instanceof android.view.ViewGroup) ((android.view.ViewGroup) v.getParent()).removeView(v);
        try {
            v.removeJavascriptInterface("OmarchyRadar");
            v.destroy();
        } catch (Throwable ignored) {
        }
        if (rendererCrashes++ > 0) {
            Toast.makeText(this, R.string.radar_crashed, Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        root.post(() -> {
            if (isFinishing() || isDestroyed()) return;
            if (!attachWeb()) {
                Toast.makeText(RadarActivity.this, R.string.radar_crashed, Toast.LENGTH_LONG).show();
                finish();
            }
        });
    }

    static String keyName(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_UP: return "up";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "down";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "left";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "right";
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
            case KeyEvent.KEYCODE_BUTTON_A: return "ok";
            case KeyEvent.KEYCODE_BACK:
            case KeyEvent.KEYCODE_ESCAPE:
            case KeyEvent.KEYCODE_BUTTON_B: return "back";
            default: return null;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        String k = keyName(e.getKeyCode());
        if (k == null || web == null) return super.dispatchKeyEvent(e);   // Home, volume, power: as always
        if (e.getAction() == KeyEvent.ACTION_DOWN) {
            web.evaluateJavascript("window.OmarchyRadarHost?OmarchyRadarHost.key('" + k + "'):'false'", v -> {
                // Back with no plane picked (or a page that never loaded) leaves the radar
                if ("back".equals(k) && (v == null || !v.contains("true"))) finish();
            });
        }
        return true;
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) {
            web.evaluateJavascript("window.OmarchyRadarHost&&OmarchyRadarHost.pause()", null);
            web.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.evaluateJavascript("window.OmarchyRadarHost&&OmarchyRadarHost.resume()", null);
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("OmarchyRadar");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Called from assets/radar/radar.js. */
    private final class Bridge {
        @JavascriptInterface
        public String config() {
            return RadarActivity.config(getApplicationContext());
        }

        @JavascriptInterface
        public void log(String m) {
            Log.i(TAG, String.valueOf(m));
        }
    }
}
