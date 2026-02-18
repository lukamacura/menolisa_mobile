#!/usr/bin/env node
/**
 * Re-export assets/logo.png as an Android AAPT–compatible PNG (8-bit RGBA).
 * Run from project root: node scripts/normalize-logo.js
 * Requires: npm install --save-dev sharp
 */
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const inputPath = path.join(projectRoot, 'assets', 'logo.png');
const assetsDir = path.join(projectRoot, 'assets');
const tempPath = path.join(assetsDir, 'logo-normalized-temp.png');

if (!fs.existsSync(inputPath)) {
  console.error('Not found:', inputPath);
  process.exit(1);
}

let sharp;
try {
  sharp = require('sharp');
} catch (_) {
  console.error('This script requires "sharp". Install it with:');
  console.error('  npm install --save-dev sharp');
  console.error('Then run: node scripts/normalize-logo.js');
  process.exit(1);
}

sharp(inputPath)
  .ensureAlpha()
  .png({ compressionLevel: 6, palette: false })
  .toFile(tempPath)
  .then(() => {
    fs.renameSync(tempPath, inputPath);
    console.log('Written Android-compatible PNG:', inputPath);
  })
  .catch((err) => {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    console.error('Error:', err.message);
    process.exit(1);
  });
