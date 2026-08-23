#!/usr/bin/env bash
#
# Capture an App Store Connect screenshot from the "AppStore 6.7" simulator.
#
# App Store Connect only accepts 1242x2688, 2688x1242, 1284x2778 or 2778x1284
# for the 6.5"/6.7" slot. No simulator in the default Xcode device list renders
# at any of those sizes any more (iPhone 17 Pro Max is 1320x2868, iPhone 16 Pro
# is 1206x2622), so we use an iPhone 14 Plus, which is natively 1284x2778.
#
# Create it once with:
#   ./scripts/appstore-shot.sh --setup
#
# Then navigate the simulator by hand and capture each screen:
#   ./scripts/appstore-shot.sh 01-daily-loop
#
# Screenshots land in appstore-screenshots/ and are verified to be exactly
# 1284x2778 before the script reports success — a wrong-sized file is rejected
# by App Store Connect at upload time, which is a slow way to find out.

set -euo pipefail

SIM_NAME="AppStore 6.7"
DEVICE_TYPE="com.apple.CoreSimulator.SimDeviceType.iPhone-14-Plus"
BUNDLE_ID="com.menolisa.app"
EXPECTED_W=1284
EXPECTED_H=2778

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
OUT_DIR="$REPO_ROOT/appstore-screenshots"

udid_of_sim() {
  xcrun simctl list devices -j \
    | /usr/bin/python3 -c "
import json,sys
name = sys.argv[1]
data = json.load(sys.stdin)
for runtime, devices in data['devices'].items():
    for d in devices:
        if d['name'] == name and d.get('isAvailable'):
            print(d['udid'])
            raise SystemExit
" "$SIM_NAME"
}

# Freeze the status bar so every screenshot shows the same time, full signal and
# a full battery instead of whatever the host clock and sim state happen to be.
apply_status_bar() {
  xcrun simctl status_bar "$1" override \
    --time "9:41" \
    --cellularMode active --cellularBars 4 \
    --wifiMode active --wifiBars 3 \
    --batteryState charged --batteryLevel 100 >/dev/null 2>&1 || true
}

setup() {
  local udid
  udid="$(udid_of_sim || true)"

  if [ -z "$udid" ]; then
    echo "Creating simulator \"$SIM_NAME\" (iPhone 14 Plus)..."
    local runtime
    runtime="$(xcrun simctl list runtimes -j \
      | /usr/bin/python3 -c "
import json,sys
rts = [r for r in json.load(sys.stdin)['runtimes']
       if r['isAvailable'] and r['identifier'].startswith('com.apple.CoreSimulator.SimRuntime.iOS')]
print(sorted(rts, key=lambda r: r['version'])[-1]['identifier'])
")"
    udid="$(xcrun simctl create "$SIM_NAME" "$DEVICE_TYPE" "$runtime")"
    echo "Created $udid"
  else
    echo "Simulator \"$SIM_NAME\" already exists ($udid)"
  fi

  xcrun simctl boot "$udid" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true
  open -a Simulator
  apply_status_bar "$udid"

  echo
  echo "Simulator ready. Install a Release build onto it with:"
  echo "  npx expo run:ios --configuration Release --device $udid"
  echo
  echo "Then capture screens with:"
  echo "  ./scripts/appstore-shot.sh 01-daily-loop"
}

capture() {
  local name="$1"
  local udid
  udid="$(udid_of_sim || true)"

  if [ -z "$udid" ]; then
    echo "Simulator \"$SIM_NAME\" not found. Run: ./scripts/appstore-shot.sh --setup" >&2
    exit 1
  fi

  mkdir -p "$OUT_DIR"
  local path="$OUT_DIR/$name.png"

  apply_status_bar "$udid"
  xcrun simctl io "$udid" screenshot "$path" >/dev/null 2>&1

  local w h
  w="$(sips -g pixelWidth "$path" | awk '/pixelWidth/{print $2}')"
  h="$(sips -g pixelHeight "$path" | awk '/pixelHeight/{print $2}')"

  if [ "$w" != "$EXPECTED_W" ] || [ "$h" != "$EXPECTED_H" ]; then
    echo "Wrong size: ${w}x${h}, expected ${EXPECTED_W}x${EXPECTED_H}" >&2
    echo "Is \"$SIM_NAME\" really an iPhone 14 Plus?" >&2
    exit 1
  fi

  echo "${w}x${h}  ->  appstore-screenshots/$name.png"
}

case "${1:-}" in
  --setup) setup ;;
  "")
    echo "Usage: ./scripts/appstore-shot.sh <name>     capture a screenshot"
    echo "       ./scripts/appstore-shot.sh --setup    create + boot the simulator"
    exit 1
    ;;
  *) capture "$1" ;;
esac
