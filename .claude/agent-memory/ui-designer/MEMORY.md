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
- Symptom box pattern retired — replaced by two-card `actionCardsRow` layout (see below)
- Action cards (white bg, equal): `borderColor: colors.border`, `shadowColor: colors.navy`, `shadowOpacity: 0.08`, `minHeight: 160`
- Action card icon wells: coral (`colors.primary`) for Chat, navy (`colors.navy`) for Track — both 56×56, `borderRadius: radii.md`

## rgba → Opaque Fixes (Android rendering)
Low-opacity rgba backgrounds render inconsistently on Android. Always use opaque equivalents:
- `rgba(16,185,129,0.08)` → `'#EDF9F4'` (green tint — what's working box)
- `rgba(59,130,246,0.08)` → `'#EEF4FD'` (blue tint — doctor box bg)
- `rgba(59,130,246,0.25)` → `'#BDD1F5'` (blue tint — doctor box border)
- `rgba(16,185,129,0.2)` → `'#E1F7F1'` (green badge bg — Easy/improving)
- `rgba(245,158,11,0.2)` → `'#FEF3C7'` (amber badge bg — Medium/worsening)
- `rgba(255,141,161,0.2)` → `'#FDEAEE'` (primary badge bg — Advanced)
- `rgba(107,114,128,0.15)` → `'#F0F0F2'` (neutral badge bg — stable trend)
- Overlays on dark video/images are the only acceptable use of rgba (intentional translucency)

## WhatLisaNoticedCard conventions
- `src/components/WhatLisaNoticedCard.tsx` — no navigation import (HealthSummaryReport route removed)
- Action step badge labels: easy="Start here", medium="A bit more energy", advanced="Go deeper"
- Doctor section header: "For your next appointment" (not "For your healthcare provider")
- `doctorLabel` color: `colors.navy` (not hardcoded `#1D4ED8`)
- Freshness bar shown when `insight.dataPoints` present; opaque `colors.border` divider below
- Content order: headline → why → whatsWorking → freshness bar → action steps → doctor box → whyThisMatters

## DailyMoodModal
- `src/components/DailyMoodModal.tsx` — full-screen, once-per-day, 4 mood options (1–4)
- Uses `LinearGradient` with `landingGradient` from tokens; wraps in `SafeAreaView` (react-native-safe-area-context)
- Mood buttons: `MOOD_BTN_SIZE = max(80, (SCREEN_WIDTH - padding - gaps) / 4)`; `borderRadius: radii.xl`
- Selected: `colors.primary` bg, white label; unselected: `rgba(255,141,161,0.10)` bg (intentional — on light gradient)
- Entry animation: `FadeIn.duration(300)` from reanimated on the content `Animated.View`
- CTA disabled state: `colors.primaryLight` bg, semi-transparent text — never block submission visually with red
- Image placeholder: `assets/mood-checkin.png` 280×240 — watercolor illustration (see file comment for prompt)

## StaggeredZoomIn delay indices (Dashboard)
- 0: greeting, 1: streak pill, 4: error, 5: daily message line, 6: action cards row (Chat + Track), 7: history link, 8: wavy divider, 9: WhatLisaNoticedCard, 10: disclaimer
- LisaHeroCard component definition remains in file but is no longer rendered in JSX (safe to remove in a future cleanup pass)
- Hero overlay now contains ONLY greeting + streak pill — no action CTA inside the video
