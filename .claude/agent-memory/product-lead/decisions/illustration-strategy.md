# Illustration Strategy — Menolisa

**Decision date**: 2026-03-01
**Status**: Approved direction, Phase 1 scoped

---

## Decision

Proceed with custom brand illustrations. Phase 1 is empty states only. Do not commission a full library upfront.

---

## Style Specification

- Soft realism with illustrative warmth — NOT flat design, NOT cartoon, NOT photorealistic
- In-palette strictly: coral #ff8da1, navy #1D3557, warm backgrounds from landing gradient (#FDF8F9 → #F5EDF0)
- Supporting tones allowed: warm peaches, dusty mauves, muted teals — must anchor to existing token palette
- Line quality: soft, slightly loose (hand-influenced), not tight vector perfection
- Figures: age-ambiguous 40-55 range, everyday contexts (bedroom, office, bathroom, kitchen)
- Faces: expressive but not cartoonish. Avoid "empowered wellness woman" stock archetype.

---

## Symptom Illustration Principles

Governing rule: dignified experience, not dramatized suffering.
Images should make users feel seen, not pitied.

- Hot flashes / night sweats: warmth and light, not distress. Managing, not suffering. Subtle humor acceptable.
- Brain fog: gentle visual haziness, thoughtful expression. Not confusion or distress.
- Sleep disruption: quiet bedroom at unusual hour, warm lamplight.
- Mood changes: abstract emotional color fields may serve better than figurative. Highest care required here.
- Joint pain / fatigue: show resting/pausing/adapting — not grimacing.

---

## Placement Priority (by ROI)

1. **Empty states** — Phase 1. Highest impact, lowest risk. 5-7 illustrations.
   - Symptom Logs (no logs yet)
   - Insights/Patterns (insufficient data)
   - Chat list (no conversations started)
   - Notifications (nothing yet)

2. **Onboarding** — Phase 2. High priority; helps users recognize and name symptoms.

3. **Symptom category headers in logging** — Phase 2. Small, fast-loading, 48-64dp only. No fine detail.

4. **Insight cards** — Phase 3. Test against clean card first; readability > embellishment.

5. **Logging confirmations** — Lower priority; requires contextual logic, distress risk high.

---

## Hard Constraints (Non-Negotiable)

- NO illustrations on distress-state screens (mood escalation protocol, mental health resources, crisis moments)
- Illustrations must be suppressed whenever distress state is detected — this is a ui-designer hard constraint
- Representation must be in illustrator brief from day one: race, body type, age range. Not retrofitted.
- Style guide deliverable alongside Phase 1 set — not after — so a different illustrator can continue coherently

---

## Format

- SVG default (scales cleanly, no bundle weight penalty)
- Lottie only for specific onboarding moments with explicit justification — not the default
- Rasterized formats require technical scope with ui-designer and backend before commissioning

---

## Risks Logged

1. Representation failure if diversity not in brief upfront
2. Tone mismatch on distress screens — suppression rule addresses this
3. Asset maintenance overhead — style guide deliverable is the mitigation
4. Performance — SVG default is the mitigation
5. Illustration overshadowing content — strategic placement over coverage. 5 exceptional > 20 mediocre.

---

## Priority Context

This is medium-high priority. Prerequisites before scaling illustration investment:
- Core logging flow hitting 60-second standard
- Insight delivery working and language framing landing
- Mood escalation protocol tested and reliable
- Onboarding completion rates confirmed healthy

Phase 1 (empty states) can proceed independently of these. Full library expansion should wait for validation.
