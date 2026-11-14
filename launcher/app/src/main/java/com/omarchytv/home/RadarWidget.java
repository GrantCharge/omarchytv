package com.omarchytv.home;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.InputStream;

/**
 * The "radar" home widget (homeWidgets.radar, off unless asked): the plane radar's page (assets/radar, the same as
 * RadarActivity's) in its box mode, in a large box at the top left of Home, where the term box sits. A small WebView
 * only while Home is on screen and the widget is on (added by sync, removed on pause), with no focus and no keys:
 * the full radar is one menu away. The box reads the planes less often than the full screen. If the WebView renderer
 * dies the box stays empty; after two deaths it stays off until the launcher restarts, it never takes Home down.
 */
final class RadarWidget {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int MAX_DEATHS = 2;
    private static WebView web;
    private static int deaths;
    private static boolean resumed;

    private RadarWidget() {
    }

    /** RadarActivity's config plus "widget": the page then draws the box, not the full screen. */
    static String config(Context c) {
        try {
            return new JSONObject(RadarActivity.config(c)).put("widget", true).toString();
        } catch (Exception e) {
            return "{\"widget\":true}";
        }
    }

    static void onResume(Activity a, ViewGroup hold, boolean on) {
        resumed = true;
        sync(a, hold, on);
    }

    /** From onPause / onDestroy: nothing keeps running (or reading planes) behind other apps. */
    static void onPause() {
        resumed = false;
        drop(web, false);
    }

    /** Show the box's page when Home is in front and the widget is on (hold = the box's inside), else take it away. */
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    static void sync(Activity a, ViewGroup hold, boolean on) {
        if (!resumed || !on || hold == null) {
            drop(web, false);
            return;
        }
        if (web != null && web.getParent() == hold) return;
        drop(web, false);
        if (deaths >= MAX_DEATHS) return;
        WebView w;
        try {
            w = new WebView(a);
        } catch (Throwable e) {   // no WebView on this TV: the box stays empty
            return;
        }
        w.setBackgroundColor(Color.BLACK);
        w.setFocusable(false);
        w.setClickable(false);
        w.setVerticalScrollBarEnabled(false);
        w.setHorizontalScrollBarEnabled(false);
        w.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // the map style picked in the full radar, and the types already looked up
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        final Context app = a.getApplicationContext();
        final android.content.res.AssetManager assets = a.getAssets();
        w.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (RadarActivity.picture(u.getScheme(), u.getHost())) return null;
                if (PulseSaver.proxied(u)) return PulseSaver.proxy(app, u, "https://" + HOST);
                String p = u.getPath();
                if (!HOST.equals(u.getHost()) || !RadarActivity.asset(p)) return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
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
                return true;
            }

            @android.annotation.TargetApi(26)
            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail d) {
                drop(view, true);   // not rebuilt here: one more try at the next onResume, then off
                return true;
            }
        });
        w.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public String config() {
                return RadarWidget.config(app);
            }

            @JavascriptInterface
            public void log(String m) {
                android.util.Log.i("OmarchyTV", String.valueOf(m));
            }
        }, "OmarchyRadar");
        hold.addView(w, new ViewGroup.LayoutParams(-1, -1));
        w.loadUrl("https://" + HOST + "/assets/radar/index.html");
        web = w;
    }

    private static void drop(WebView w, boolean died) {
        if (w == null) return;
        if (died) {
            deaths++;
            android.util.Log.w("OmarchyTV", "radar widget: renderer WebView morto (" + deaths + "/" + MAX_DEATHS + ")");
        }
        if (web == w) web = null;
        try {
            if (w.getParent() instanceof ViewGroup) ((ViewGroup) w.getParent()).removeView(w);
            w.removeJavascriptInterface("OmarchyRadar");
            w.destroy();
        } catch (Throwable ignored) {
        }
    }
}
