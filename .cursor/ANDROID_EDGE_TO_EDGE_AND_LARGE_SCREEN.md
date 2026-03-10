# Android edge-to-edge and large screen compliance

This document summarizes changes made for Google Play requirements: **edge-to-edge (Android 15+)** and **large screen / resizability / orientation**.

## Edge-to-edge (Issue 1)

### Config

- **app.json**
  - `android.edgeToEdgeEnabled`: already `true`.
  - `android.androidStatusBar`: `translucent: true`, `backgroundColor: "#00000000"`.
  - `android.androidNavigationBar`: `translucent: true`, `backgroundColor: "#00000000"`.
  - Ensures system bars are transparent and app draws edge-to-edge; content uses insets so it does not sit under bars.

### Safe area usage

- **SafeAreaProvider** wraps the app in `App.tsx` so `react-native-safe-area-context` works everywhere.
- All screens use **SafeAreaView** from `react-native-safe-area-context` (not from `react-native`) with explicit **edges** (e.g. `edges={['top', 'bottom']}` or `edges={['top']}`) so content stays within safe areas on notched devices and Android 15+.
- **LoginScreen** and **RegisterScreen** were updated from RN’s SafeAreaView to `react-native-safe-area-context` with `edges={['top', 'bottom']}`.

### Deprecated APIs

- No use of `window.setDecorFitsSystemWindows(false)`, `android:fitsSystemWindows`, deprecated `WindowInsetsCompat` / `SystemBarsBehavior`, or hardcoded status/nav bar heights in this repo (Expo managed workflow; no custom native theme edits for contrast flags).

### Status bar / navigation bar

- **expo-status-bar** is used via the Expo stack; no deprecated parameters were required.
- No **expo-navigation-bar** in the project.
- React Navigation screens use the safe area context; tab bar in `MainTabs.tsx` uses `useSafeAreaInsets()` for bottom padding.

---

## Large screen / resizability / orientation (Issue 2)

### Config

- **app.json**
  - `orientation`: changed from `"portrait"` to **`"default"`** so the app can rotate (portrait and landscape).
- **plugins/android-large-screen.js** (Expo config plugin)
  - Sets **`android:resizeableActivity="true"`** for multi-window and resizing on tablets, foldables, ChromeOS.
  - Sets **`android:screenOrientation="fullUser"`** so the activity respects user rotation (aligned with `orientation: "default"`).
  - Registered in **app.config.js** as `'./plugins/android-large-screen.js'`.
  - Apply with: `npx expo prebuild` (or EAS build).

### Orientation and resizability

- No **expo-screen-orientation** or **Orientation.lockAsync** in the codebase.
- No `android:screenOrientation="portrait"` or `android:resizeableActivity="false"` in source; the plugin ensures resizability and fullUser orientation on the main activity.

### Layout and keyboard

- **app.json** has **`softwareKeyboardLayoutMode: "pan"`** so the window pans when the keyboard is open (helps with landscape).
- Screens use **ScrollView** or **FlatList** where content can overflow; forms and chat use **KeyboardAvoidingView** where relevant.

---

## Screens to manually test in landscape

These are good candidates for a quick pass in **landscape** and on **tablet / foldable**:

1. **LandingScreen** – CTA and layout in landscape.
2. **LoginScreen** – Form and keyboard in landscape.
3. **RegisterScreen** – Quiz steps, gate, email/results; scroll and footer in landscape.
4. **DashboardScreen** – Cards and list in landscape.
5. **ChatThreadScreen** – Input and keyboard in landscape.
6. **SettingsScreen** – Long list and forms in landscape.
7. **MainTabs** – Tab bar and insets when rotating.

Recommend testing with **keyboard open** in landscape to confirm inputs are not obscured.

---

## File change summary

| File | Change |
|------|--------|
| **app.json** | `orientation`: `"portrait"` → `"default"`. Added `android.androidStatusBar`, `android.androidNavigationBar` (translucent, transparent). Added `android.softwareKeyboardLayoutMode: "pan"`. |
| **app.config.js** | Registered plugin `'./plugins/android-large-screen.js'`. |
| **plugins/android-large-screen.js** | **New.** Expo config plugin: sets `android:resizeableActivity="true"` and `android:screenOrientation="fullUser"` on the main activity. |
| **App.tsx** | Wrapped root with **SafeAreaProvider**. |
| **src/screens/LoginScreen.tsx** | Switched to **SafeAreaView** from `react-native-safe-area-context` with **edges={['top', 'bottom']}**. |
| **src/screens/RegisterScreen.tsx** | Switched to **SafeAreaView** from `react-native-safe-area-context`; added **edges={['top', 'bottom']}** to all SafeAreaView usages (quiz, gate, email, results). |
| **.cursor/ANDROID_EDGE_TO_EDGE_AND_LARGE_SCREEN.md** | **New.** This doc. |

No other screens required SafeAreaView source changes; they already used `react-native-safe-area-context` with appropriate edges.
