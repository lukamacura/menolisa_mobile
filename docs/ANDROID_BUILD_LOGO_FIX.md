# Android build error: logo.png failed to compile (AAPT)

## What went wrong

The build fails with:

```text
ERROR: .../drawable-mdpi/assets_logo.png: AAPT: error: file failed to compile.
```

That means **`assets/logo.png`** is in a format Android’s AAPT resource compiler doesn’t accept. It’s used for:

- App icon and adaptive icon
- Splash screen
- In-app logo (Landing, Register, Chat loading)

So this one file must be a valid, Android‑friendly PNG.

## Fix: re-export `assets/logo.png` as a standard PNG

Use **one** of these approaches.

### Option A: Re-export from your design tool (recommended)

1. Open the logo in your editor (Figma, Sketch, Photoshop, etc.).
2. Export as PNG with:
   - **Color mode:** 8-bit or 32-bit (RGBA).
   - **No 16-bit per channel.**
   - **No interlacing** (or turn it off if you see the option).
3. Replace `womenreset-mobile/assets/logo.png` with this file.
4. Commit and run the Android build again.

### Option B: Normalize with the project script (recommended if you use Node)

From the **womenreset-mobile** folder, install dependencies and run:

```bash
npm install
npm run normalize-logo
```

This overwrites `assets/logo.png` with an AAPT-friendly PNG (uses the `sharp` dev dependency). Then run your Android build again.

### Option C: ImageMagick (if installed)

```bash
convert assets/logo.png -depth 8 -strip assets/logo-normalized.png
mv assets/logo-normalized.png assets/logo.png
```

### After replacing the file

- Run the Android build again (e.g. `eas build --platform android` or your usual command).
- If the error persists, try a different export (e.g. “Save for Web” in Photoshop, or export again with interlacing off and 8-bit depth).

## Why this happens

AAPT only accepts certain PNG formats. Files that often fail include:

- 16-bit per channel PNGs
- Some interlaced or oddly encoded PNGs
- Corrupted or truncated files

Re-exporting as a normal 8-bit or 32-bit RGBA PNG (and staying under Android’s max dimensions) fixes the “file failed to compile” error.
