# UI Designer Agent Memory — Menolisa

## Color Palette (Post-Consolidation)
- Single accent: `colors.primary` (#ff8da1 coral) — gold and blue retired as primary actions
- `colors.blue` / `colors.gold` still exist in tokens but are no longer used for buttons or feature highlights
- Navy `colors.navy` (#1D3557) — used for text on coral buttons and dark overlays
- All text on dark/video overlays must use `colors.background` (#FFFFFF)

## Video Hero (Dashboard)
- Asset: `assets/dashboard_lisa.mp4` (user-supplied); static fallback `assets/dashboard_lisa.png`
- Package: `expo-video` (SDK 54 compatible) — plugin added to `app.config.js` plugins array
- `useVideoPlayer` + `VideoView` from `expo-video`; `contentFit="cover"`, `nativeControls={false}`
- `reduceMotion === true` → render `<Image>` fallback instead of `<VideoView>`
- Hero height: `SCREEN_HEIGHT * 0.60` (VIDEO_HEIGHT constant)
- Gradient overlay: `LinearGradient` from `expo-linear-gradient` (already in deps); colors `['rgba(0,0,0,0.05)', 'rgba(29,53,87,0.65)']`
- Content pinned to bottom via `videoOverlayContent`: `flex:1, justifyContent:'flex-end'`

## Easing Bug (Pre-existing, now fixed)
- `Easing.sine` does not exist in react-native-reanimated — use `Easing.sin`

## Key File Paths
- Dashboard screen: `src/screens/home/DashboardScreen.tsx`
- Design tokens: `src/theme/tokens.ts` (read-only source of truth)
- Expo config (plugins): `app.config.js`
- Medical disclaimer modal: `src/components/MedicalDisclaimerModal.tsx`
- App navigator (disclaimer wired here): `src/navigation/AppNavigator.tsx`

## Google Play Policy Compliance — Medical Disclaimers
- Full canonical disclaimer: "MenoLisa is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider."
- AsyncStorage key for one-time modal: `@menolisa:disclaimer_accepted`
- `MedicalDisclaimerModal` shown on first app launch from `AppNavigator`; uses `statusBarTranslucent`, no `onRequestClose` (user must tap "I understand")
- Quiz footer disclaimer (RegisterScreen) uses shorter form; styled `presets.caption` / `colors.textMuted`
- SymptomsScreen disclaimer (tracking-specific) added as `ListFooterComponent` on the symptom FlatList
- Chat disclaimer in `ChatThreadScreen` line ~681; Settings disclaimer line ~238

## Style Conventions
- Glass card on dark overlay: `backgroundColor: 'rgba(255,255,255,0.18)'`, `borderColor: 'rgba(255,255,255,0.40)'`
- Streak pill on dark overlay: `backgroundColor: 'rgba(255,255,255,0.20)'`, `borderColor: 'rgba(255,255,255,0.35)'`, text `colors.background`
- Symptom box (white bg section): `backgroundColor: 'rgba(255,255,255,0.95)'`, `borderColor: colors.border`, `shadowColor: colors.primary`

## StaggeredZoomIn delay indices (Dashboard)
- 0: greeting, 1: streak pill, 2: trial expired, 3: trial near, 4: error, 5: LisaHeroCard, 6: symptom box, 8: wavy divider, 9: disclaimer, 10: WhatLisaNoticedCard
