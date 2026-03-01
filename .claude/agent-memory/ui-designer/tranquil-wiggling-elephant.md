# Dashboard Redesign: Ambient Video Hero + Color Consolidation

## Context
The current dashboard uses three loud accent colors simultaneously — blue (Lisa bubble), gold (symptom box), and pink (primary) — which reads as juvenile for the 40–60+ menopausal audience. Separately, adding a short ambient looping video as a hero background will create atmosphere without friction. The product decision is to: (1) retire gold and neutralize blue → single accent (coral/primary) + navy, and (2) add a 3–4s ambient loop video that occupies 59–60% of screen height with existing content overlaid on top.

**Video asset**: User will place `dashboard_lisa.mp4` in `/assets/` before implementation.
**Layout**: Video fills 59-60% of screen height, Lisa card + greeting sit on top with a gradient overlay for readability. Symptom box, wavy divider, and pink section continue below in normal flow.

---

## Critical Files
- `src/screens/home/DashboardScreen.tsx` — primary file to modify
- `src/theme/tokens.ts` — read-only reference (do not change tokens)
- `assets/dashboard_lisa.mp4` — video asset (user will provide)
- `assets/dashboard_lisa.png` — static fallback for reduceMotion users (already exists)

---

## Step 1: Install expo-video

```bash
npx expo install expo-video
```

`expo-video` is the recommended video package for Expo SDK 54. No app.json plugin config needed for local asset playback.

---

## Step 2: Color Fixes in `DashboardScreen.tsx`

### Lisa card (`lisaCardStyles`)
| Property | Current | New |
|---|---|---|
| `bubble.backgroundColor` | `rgba(101, 219, 255, 0.14)` | `rgba(255, 255, 255, 0.18)` (white glass) |
| `bubble.borderColor` | `rgba(101, 219, 255, 0.45)` | `rgba(255, 255, 255, 0.40)` |
| `bubble.shadowColor` | `colors.blue` | `colors.primary` |
| `talkButton.backgroundColor` | `colors.blue` | `colors.primary` |
| `talkButton.shadowColor` | `colors.blue` | `colors.primary` |

### Symptom box (`styles`)
| Property | Current | New |
|---|---|---|
| `symptomCategoryBox.backgroundColor` | `rgba(255, 235, 118, 0.22)` | `rgba(255, 255, 255, 0.95)` |
| `symptomCategoryBox.borderColor` | `rgba(255, 200, 50, 0.6)` | `colors.border` |
| `symptomCategoryBox.shadowColor` | `colors.gold` | `colors.primary` |
| `symptomCategoryButton.backgroundColor` | `colors.gold` | `colors.primary` |
| `symptomCategoryButton.shadowColor` | `colors.gold` | `colors.primary` |

> `primaryButtonText` color stays `colors.navy` — good contrast on coral.

---

## Step 3: Video Hero Restructure in `DashboardScreen.tsx`

### New imports to add
```ts
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
// Add height to existing Dimensions destructure:
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VIDEO_HEIGHT = SCREEN_HEIGHT * 0.60;
```

### New `AmbientVideoHero` component (add above `DashboardScreen`)
- Uses `useVideoPlayer(require('../../../assets/dashboard_lisa.mp4'), player => { player.loop = true; player.muted = true; player.play(); })`
- Renders `<VideoView player={player} contentFit="cover" nativeControls={false} style={StyleSheet.absoluteFillObject} />`
- If `reduceMotion === true`: renders `<Image source={require('../../../assets/dashboard_lisa.png')} style={StyleSheet.absoluteFillObject} resizeMode="cover" />` instead of VideoView

### New layout structure (replaces current `<View style={styles.heroSection}>` and everything inside it up to and not including the wavy divider)

```
<View style={styles.videoHero}>            ← height: VIDEO_HEIGHT, overflow: hidden, position: relative
  <AmbientVideoHero reduceMotion={...} />  ← absolute fill, video or static image
  <LinearGradient                          ← absolute fill overlay for readability
    colors={['rgba(0,0,0,0.05)', 'rgba(29,53,87,0.65)']}
    style={StyleSheet.absoluteFillObject}
  />
  <View style={styles.videoOverlayContent}> ← flex:1, justifyContent:'flex-end', padding
    {/* greeting */}
    {/* streak pill */}
    {/* trial expired banner */}
    {/* trial near banner */}
    {/* error banner */}
    {/* LisaHeroCard */}
  </View>
</View>

{/* Below video, white background */}
<View style={styles.belowVideoSection}>
  {!trialStatus.expired && <symptomCategoryBox />}
</View>

{/* Wavy divider + pink section unchanged */}
```

### New/updated styles
```ts
videoHero: {
  height: VIDEO_HEIGHT,
  overflow: 'hidden',
  position: 'relative',
},
videoOverlayContent: {
  flex: 1,
  justifyContent: 'flex-end',
  paddingHorizontal: spacing.lg,
  paddingBottom: spacing.lg,
},
belowVideoSection: {
  backgroundColor: colors.background,
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.lg,
  paddingBottom: spacing.lg,
},
```

> `styles.heroSection` and `styles.scrollContent` can be removed or kept for other uses. `styles.greeting` color changes to `colors.background` (white) for readability on dark video overlay.
> `styles.streakPillText` and `streakPill` border/bg may need lightening for readability over dark overlay.

### StaggeredZoomIn delay indices stay the same — no changes to animation orchestration.

---

## Step 4: Greeting text color update
- `styles.greeting` color: `colors.text` (`#1F2937`) → `colors.background` (`#FFFFFF`) — text must be legible over video
- `styles.streakPill`: background → `rgba(255,255,255,0.20)`, border → `rgba(255,255,255,0.35)`, text color → `#FFFFFF`

---

## Verification
1. Run `npm start` and open on Android (iOS needs MP4 which user will provide)
2. Confirm video loops seamlessly at ~60% screen height
3. Confirm greeting, streak pill, and Lisa card are visible and readable over the overlay
4. Confirm symptom box below has white background with coral button (no gold)
5. Confirm Lisa card "Talk to Lisa" button is coral (no blue)
6. Enable Accessibility → Reduce Motion → confirm static image fallback renders correctly
7. Confirm trial expired / trial near banners still render correctly within overlay area
8. Pull-to-refresh should still work (ScrollView refreshControl unchanged)
