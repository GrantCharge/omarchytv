package com.omarchytv.home;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.view.KeyEvent;

import org.junit.Test;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/** The plane radar (RadarActivity): what its page may load, the remote's keys, and the WebView crash guard. */
public class RadarActivityTest {
    @Test
    public void onlyTheRadarsOwnAssetsLoad() {
        assertTrue(RadarActivity.asset("/assets/radar/index.html"));
        assertTrue(RadarActivity.asset("/assets/radar/radar-land.js"));
        assertTrue(RadarActivity.asset("/assets/pulse/pulse-tv-hub.js"));
        assertTrue(RadarActivity.asset("/assets/pulse/pulse-tv-data.js"));
        assertFalse(RadarActivity.asset("/assets/pulse/pulse.js"));
        assertFalse(RadarActivity.asset("/assets/games/index.html"));
        assertFalse(RadarActivity.asset("/assets/radar/../remotes.json"));
        assertFalse(RadarActivity.asset("/radar/index.html"));
        assertFalse(RadarActivity.asset(null));
    }

    @Test
    public void onlyMapTilesAndPhotosAreFetchedByTheWebView() {
        assertTrue(RadarActivity.picture("https", "server.arcgisonline.com"));
        assertTrue(RadarActivity.picture("https", "airport-data.com"));
        assertTrue(RadarActivity.picture("https", "image.airport-data.com"));
        assertFalse(RadarActivity.picture("http", "server.arcgisonline.com"));
        assertFalse(RadarActivity.picture("https", "evilairport-data.com"));
        assertFalse(RadarActivity.picture("https", "server.arcgisonline.com.evil.example"));
        assertFalse(RadarActivity.picture("https", "opensky-network.org"));   // data goes through the launcher
        assertFalse(RadarActivity.picture("https", null));
    }

    @Test
    public void theHomeBoxTakesTheTermBoxsPlace() throws Exception {
        assertTrue(HomeV29.termOn(true, false));
        assertFalse("one corner, one box", HomeV29.termOn(true, true));
        assertFalse(HomeV29.termOn(false, false));
        assertEquals(HomeV29.TERM_W, HomeV29.RADAR_W);
        // with the radar box on, the widgets row keeps clear of that corner as it does of the term box
        assertEquals(HomeV29.widgetsWidth(true, true), HomeV29.widgetsWidth(true, false || true));
        String src = new String(Files.readAllBytes(new File("src/main/java/com/omarchytv/home/RadarWidget.java").toPath()), StandardCharsets.UTF_8);
        assertTrue("never a crash loop", src.contains("deaths >= MAX_DEATHS"));
        assertTrue("nothing runs behind other apps", src.contains("static void onPause()"));
        assertTrue(src.contains("w.setFocusable(false)"));
        assertTrue(src.contains("PulseSaver.proxy("));
        String main = new String(Files.readAllBytes(new File("src/main/java/com/omarchytv/home/MainActivity.java").toPath()), StandardCharsets.UTF_8);
        assertEquals("onPause and onDestroy", 2, main.split("RadarWidget\\.onPause\\(\\)", -1).length - 1);
    }

    @Test
    public void theRemotesKeys() {
        assertEquals("left", RadarActivity.keyName(KeyEvent.KEYCODE_DPAD_LEFT));
        assertEquals("right", RadarActivity.keyName(KeyEvent.KEYCODE_DPAD_RIGHT));
        assertEquals("up", RadarActivity.keyName(KeyEvent.KEYCODE_DPAD_UP));
        assertEquals("down", RadarActivity.keyName(KeyEvent.KEYCODE_DPAD_DOWN));
        assertEquals("ok", RadarActivity.keyName(KeyEvent.KEYCODE_DPAD_CENTER));
        assertEquals("back", RadarActivity.keyName(KeyEvent.KEYCODE_BACK));
        assertNull(RadarActivity.keyName(KeyEvent.KEYCODE_VOLUME_UP));
        assertNull(RadarActivity.keyName(KeyEvent.KEYCODE_HOME));
    }

    @Test
    public void theRadarReloadsOnceThenLeavesAndIsAnAction() throws Exception {
        String src = new String(Files.readAllBytes(new File("src/main/java/com/omarchytv/home/RadarActivity.java").toPath()), StandardCharsets.UTF_8);
        assertTrue(src.contains("if (rendererCrashes++ > 0)"));
        assertTrue(src.contains("R.string.radar_crashed"));
        assertTrue("the reload must be posted, never done inside the callback", src.contains("root.post("));
        assertTrue("the plane data goes through the launcher", src.contains("PulseSaver.proxy("));
        assertTrue(java.util.Arrays.asList(LauncherConfig.KEY_ACTIONS).contains("radar"));
    }
}
