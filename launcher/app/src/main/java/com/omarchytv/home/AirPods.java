package com.omarchytv.home;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import android.widget.Toast;

import java.lang.reflect.Method;
import java.util.Set;

/**
 * One-press connect for AirPods Pro that are ALREADY paired with this TV. It never pairs anything new.
 * It finds the bonded device whose name has "AirPods Pro" and asks the A2DP (and headset) profile to connect.
 */
final class AirPods {
    static final int REQ_BT_CONNECT = 8;
    private static final String TAG = "AirPods";

    private AirPods() {}

    /** Returns true if it started; false if it is waiting for the Bluetooth permission. */
    static boolean connect(Activity a) {
        if (Build.VERSION.SDK_INT >= 31 && a.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            a.requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, REQ_BT_CONNECT);
            return false;
        }
        BluetoothManager bm = (BluetoothManager) a.getSystemService(Activity.BLUETOOTH_SERVICE);
        BluetoothAdapter ad = bm != null ? bm.getAdapter() : null;
        if (ad == null) {
            toast(a, R.string.airpods_no_bt);
            return true;
        }
        if (!ad.isEnabled()) {
            toast(a, R.string.airpods_bt_off);
            return true;
        }
        BluetoothDevice dev = null;
        Set<BluetoothDevice> bonded = ad.getBondedDevices();
        if (bonded != null) {
            for (BluetoothDevice d : bonded) {
                String n = d.getName();
                if (n != null && n.toLowerCase(java.util.Locale.ROOT).contains("airpods pro")) {
                    dev = d;
                    break;
                }
            }
        }
        if (dev == null) {
            toast(a, R.string.airpods_not_paired);
            return true;
        }
        final BluetoothDevice target = dev;
        final String name = clean(target.getName());
        Toast.makeText(a, a.getString(R.string.airpods_connecting, name), Toast.LENGTH_SHORT).show();
        final boolean[] any = {false};
        final int[] pending = {2};
        for (int profile : new int[]{BluetoothProfile.A2DP, BluetoothProfile.HEADSET}) {
            boolean ok = ad.getProfileProxy(a, new BluetoothProfile.ServiceListener() {
                @Override
                public void onServiceConnected(int p, BluetoothProfile proxy) {
                    try {
                        if (proxy.getConnectionState(target) == BluetoothProfile.STATE_CONNECTED) {
                            any[0] = true;
                        } else {
                            Method m = proxy.getClass().getMethod("connect", BluetoothDevice.class);
                            Object r = m.invoke(proxy, target);
                            if (Boolean.TRUE.equals(r)) any[0] = true;
                        }
                    } catch (Throwable t) {
                        Log.w(TAG, "connect failed for profile " + p, t);
                    } finally {
                        ad.closeProfileProxy(p, proxy);
                        done(a, any, pending, name);
                    }
                }

                @Override
                public void onServiceDisconnected(int p) {}
            }, profile);
            if (!ok) done(a, any, pending, name);
        }
        return true;
    }

    private static void done(Activity a, boolean[] any, int[] pending, String name) {
        a.runOnUiThread(() -> {
            if (--pending[0] > 0) return;
            if (any[0]) Toast.makeText(a, a.getString(R.string.airpods_ok, name), Toast.LENGTH_LONG).show();
            else toast(a, R.string.airpods_failed);
        });
    }

    /**
     * Name for the bar label: the paired AirPods Pro's own Bluetooth name, or null when none is paired
     * (or the Bluetooth permission is not granted yet).
     */
    static String pairedName(Activity a) {
        try {
            if (Build.VERSION.SDK_INT >= 31 && a.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) return null;
            BluetoothManager bm = (BluetoothManager) a.getSystemService(Activity.BLUETOOTH_SERVICE);
            BluetoothAdapter ad = bm != null ? bm.getAdapter() : null;
            Set<BluetoothDevice> bonded = ad != null ? ad.getBondedDevices() : null;
            if (bonded == null) return null;
            for (BluetoothDevice d : bonded) {
                String n = d.getName();
                if (n != null && n.toLowerCase(java.util.Locale.ROOT).contains("airpods pro")) return clean(n);
            }
        } catch (Throwable t) {
            Log.w(TAG, "pairedName", t);
        }
        return null;
    }

    /** Drops a trailing " - suffix" the phone added to the name ("I Am Focused AirPods Pro  - Fin" -> "I Am Focused AirPods Pro"). */
    static String clean(String n) {
        if (n == null) return null;
        String s = n.replaceAll("\\s+-\\s+[^-]*$", "").replaceAll("\\s+", " ").trim();
        return s.isEmpty() ? n.trim() : s;
    }

    private static void toast(Activity a, int res) {
        a.runOnUiThread(() -> Toast.makeText(a, res, Toast.LENGTH_LONG).show());
    }
}
