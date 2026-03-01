# Decision: Dashboard Hero Video + Palette Change
Date: 2026-02-25
Status: Revised 2026-02-25 — ambient loop video conditionally approved; palette fix scoped to accent color discipline, not a rebrand

## Context
Developer proposed two dashboard changes:
1. MP4 video hero at 59-60% screen height
2. Replace coral/salmon (#ff8da1) with violet palette

Revised context (same session):
1. Video is a 3-4 second seamless ambient loop (cinemagraph style), not a long autoplay clip
2. The palette complaint is specifically about THREE accent colors on one screen (blue Lisa bubble + gold symptom box + coral primary) feeling unfocused and childish — not about coral alone

---

## Decision: Ambient Loop Video Hero — CONDITIONALLY APPROVED

### What Changed
Short seamless ambient loops do not violate the 60-second check-in standard because the user is not waiting for content to end. Motion is peripheral and backgrounded.

### Approval Conditions (all must hold)
- Motion plays behind content, never on top — Lisa text and CTAs must remain fully legible
- Silent — no audio track, no tap-to-unmute UI
- File size under 2MB on device — use Lottie fallback for low-memory devices
- Motion content must be purely ambient: natural light, soft botanicals, gentle water, abstract warmth — nothing kinetic or energetic
- Must pause/fallback to static frame when OS Reduce Motion is enabled
- Must be tested on mid-range Android for scroll jank when video component is mounted

### Pre-Build Requirement
Source or commission the video content BEFORE writing the component. Validate content tone before code.

---

## Decision: Palette — ACCENT DISCIPLINE FIX, NOT A REBRAND

### Root Cause Identified
Three accent colors operating at equal visual weight (blue Lisa bubble + gold symptom box + coral primary) reads as unfocused. Each color was defensible locally; together they are noisy. This is an accent color discipline problem, not a hue problem.

### Fix: Retire Gold, Desaturate Blue

Gold/yellow is the accent to retire from the dashboard. Its function (drawing attention to symptom CTA) can be absorbed by coral primary without losing meaning. Gold does not carry a semantic role that coral cannot cover.

Blue on the Lisa bubble must be desaturated and darkened so it reads as a surface tone, not a third accent. Use navy (#1D3557) as bubble background or a cool near-white tint with subtle navy border.

### Post-Fix Dashboard Palette Roles
```
Primary / Interactive:   #ff8da1  — coral, all CTAs, active tabs, primary buttons
Lisa Surface:            #1D3557  — navy as bubble background (dark, not bright accent)
                         OR #EEF1F5  — cool near-white tint with subtle navy border
Background:              #FFFFFF
Card Surface:            #FDF8F9  — warm near-white (existing landing gradient base)
Text Primary:            #1F2937
Text Muted:              #6B7280
Gold / Yellow:           RETIRED from dashboard — do not use as accent color
```

### Violet Rebrand Status
Remains a lower-priority open conversation. Fix accent discipline first, then evaluate whether palette still reads as immature. Rebrand only if perception problem persists after the scoped fix. Violet palette spec from initial evaluation remains valid if needed.

### Recommended Violet Palette (if discipline fix is insufficient)
```
Primary:          #8B7BB5  — dusty lavender-violet, warm undertone
Primary Light:    #C4B5D9  — soft lilac for backgrounds/cards
Primary Dark:     #5C4E8A  — deep plum for headers, active states
Accent:           #E8A87C  — warm terracotta (bridges warmth, replaces gold)
Background:       #FDFCFF  — near-white with violet undertone
Text Primary:     #2C2341  — deep violet-navy
Text Muted:       #7A7090  — muted violet-grey
Surface/Card:     #F4F0FA  — very light lavender for cards
```
Critical rule if violet adopted: primary (#8B7BB5) must not fill large surfaces. Use as accent only.

---

## Ordered Action Plan
1. Remove gold from dashboard — restyle symptom box with coral + neutral card surface
2. Darken/desaturate Lisa bubble — move to navy or cool near-white surface tone
3. Source ambient loop video content, validate tone before building component
4. Build ambient loop hero with Reduce Motion fallback + file size constraint + Android test
5. After steps 1-2 ship: evaluate whether palette still reads immature. If yes, proceed with violet rebrand. If no, close that conversation.

## Maturity Levers (if more work needed beyond accent fix)
1. Typography weight — Nunito Bold/ExtraBold for headings reads more premium
2. Card shadow/elevation — subtle depth signals premium
3. Whitespace — more breathing room reads as mature
4. Illustration style audit — check for juvenile iconography
