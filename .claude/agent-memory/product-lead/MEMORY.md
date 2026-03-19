# Product Lead Memory — Menolisa

## Key Files
- Design tokens: `src/theme/tokens.ts` (single source of truth — never hardcode)
- Supabase client: `src/lib/supabase.ts`
- API abstraction: `src/lib/api.ts`
- Symptom constants: `src/lib/symptomTrackerConstants.ts`

## Locked Product Decisions
See `decisions/` folder for detailed specs.

- `decisions/dashboard-palette-video.md` — Video hero rejected; violet palette exploration approved with constraints; color weighting audit recommended before full rebrand.
- `decisions/symptom-list-period-removal.md` — "Period" removed from default symptom list. Rationale: demographic mismatch (postmenopausal users), trust/credibility risk, insight noise. Destructive log deletion confirmed. No user notification required. Greenlit 2026-03-18.

## Core Tone Rules
- Acknowledge before informing. Validate before advising.
- Banned phrases: "normal," "just," "you should," "don't worry"
- Approved phrases: "many women experience," "this is common," "you're not alone," "your body is telling you something important"
- Humor only in neutral/routine moments. Never when distress is detected.

## Dashboard Design Principles
- Dashboard is a habitual daily-use surface — every element must justify its presence against the 60-second check-in standard
- Hero element must feel calm, not kinetic — no autoplay video on persistent surfaces
- Color must read as warm and premium, not saturated or juvenile — use primary color as accent, not fill

## Target Demographic
- Primary: women 40-60+, perimenopause and menopause
- Sensitive to: patronizing design, clinical coldness, juvenile aesthetics, small fonts
- Respond well to: warmth, authority, directness, non-judgmental tone

## Illustration Strategy (Approved Direction)
See `decisions/illustration-strategy.md` for full spec.
- Style: soft realism, in-palette, loose line work — NOT flat/cartoon/photorealistic
- Phase 1 scope: empty states only (5-7 illustrations) — validate style before extending
- Hard rule: NO illustrations on distress-state screens (mood escalation, mental health resources)
- Representation must be in brief from day one: race, body type, age-appropriate (40-55 range)
- Format: SVG default; Lottie only for specific onboarding moments with justification
- Symptom illustration principle: dignified experience, not dramatized suffering
- Illustrations suppressed whenever distress state is detected — ui-designer constraint
- Do NOT commission full library upfront — phase and validate
