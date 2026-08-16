#!/usr/bin/env node
/**
 * Repoint the booted iOS simulator's dev build at a known-good dev server URL.
 *
 * The dev launcher caches the last dev server URL it used. When the Mac's LAN IP
 * changes (new DHCP lease), that cached URL points at an address that no longer
 * exists and the app dies on launch with:
 *
 *   Could not connect to development server. / RCTFatal
 *
 * The simulator shares the host's network stack, so localhost always works and is
 * immune to IP changes. This clears the stale URL without a rebuild.
 *
 * Usage: npm run ios:reset [-- --port 8081]
 */

const { execFileSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const appJson = require(path.join(projectRoot, 'app.json'));

const scheme = appJson?.expo?.scheme;
const bundleId = appJson?.expo?.ios?.bundleIdentifier;

if (!scheme || !bundleId) {
  console.error(
    'Missing expo.scheme or expo.ios.bundleIdentifier in app.json — cannot build the dev-client deep link.'
  );
  process.exit(1);
}

const portFlagIndex = process.argv.indexOf('--port');
const port = portFlagIndex !== -1 ? process.argv[portFlagIndex + 1] : '8081';

const devServerUrl = `http://localhost:${port}`;
const deepLink = `${scheme}://expo-development-client/?url=${encodeURIComponent(devServerUrl)}`;

function simctl(args, { allowFailure = false } = {}) {
  try {
    // Capture stderr rather than inherit it: `terminate` on an app that is not
    // running is an expected no-op here, but it writes a scary NSPOSIXErrorDomain
    // block to stderr that would otherwise look like a real failure.
    return execFileSync('xcrun', ['simctl', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    if (allowFailure) return null;
    throw err;
  }
}

// Fail early with a useful message rather than a raw simctl stack.
const booted = simctl(['list', 'devices', 'booted'], { allowFailure: true });
if (!booted || !/\(Booted\)/.test(booted)) {
  console.error('No booted iOS simulator found. Open one first, then re-run this.');
  process.exit(1);
}

if (!simctl(['get_app_container', 'booted', bundleId], { allowFailure: true })) {
  console.error(
    `${bundleId} is not installed on the booted simulator. Run "npm run ios" to build and install it.`
  );
  process.exit(1);
}

simctl(['terminate', 'booted', bundleId], { allowFailure: true });

// `openurl` records the dev server URL but does NOT cold-launch a terminated app
// (it still exits 0), so the explicit launch below is required, not belt-and-braces.
simctl(['openurl', 'booted', deepLink]);
const launchOutput = simctl(['launch', 'booted', bundleId], { allowFailure: true });

const pid = launchOutput && launchOutput.match(/:\s*(\d+)\s*$/)?.[1];
if (!pid) {
  console.error(`Pointed ${bundleId} at ${devServerUrl}, but the app failed to launch.`);
  process.exit(1);
}

// A stale-URL failure kills the app within a second or two, so a short wait is
// enough to tell "loaded the bundle" from "died on RCTFatal".
setTimeout(() => {
  let alive = true;
  try {
    process.kill(Number(pid), 0);
  } catch {
    alive = false;
  }

  if (!alive) {
    console.error(`App launched (pid ${pid}) but exited — it did not reach ${devServerUrl}.`);
    console.error('Is the dev server running? Start it with: npm start');
    process.exit(1);
  }

  console.log(`Pointed ${bundleId} at ${devServerUrl} — running (pid ${pid}).`);
}, 6000);
