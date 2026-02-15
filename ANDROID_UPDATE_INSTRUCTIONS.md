# How to see updates on your Android device (development build)

You only changed **JavaScript/TypeScript** (no native code). The existing `.apk` dev client can load the new bundle without reinstalling.

## Option A: App already connected to dev server (e.g. via tunnel)

1. **Start the dev server** (from project root):
   ```bash
   cd womenreset-mobile
   npx expo start
   ```
   Or with tunnel (if device is not on same Wi‑Fi):
   ```bash
   npx expo start --tunnel
   ```

2. **Open the WomenReset dev app** on your Android device.

3. **Reload the bundle** so it picks up the shadow fixes:
   - **Shake the device** → tap **“Reload”** in the dev menu, or  
   - In the terminal where Expo is running, press **`r`** to reload.

With Fast Refresh, saving files sometimes reloads automatically; if not, use the reload step above.

---

## Option B: Fresh start (server was closed or app wasn’t connected)

1. **Start the dev server**:
   ```bash
   cd womenreset-mobile
   npx expo start --tunnel
   ```
   (Use `--tunnel` if the phone and PC are on different networks.)

2. **Scan the QR code** with the dev build (or enter the URL it shows).

3. When the app loads, you’re on the latest bundle. Shake → **Reload** anytime you want to refresh after more changes.

---

## When you must reinstall the `.apk`

Reinstall the dev client **only** if you change native code, `app.json`/`app.config.*`, or add/remove native modules. For the current shadow-only changes, **reloading the bundle is enough**; no need to build or install a new APK.
