# Decision: Remove "Period" from Default Symptom List
Date: 2026-03-18
Status: APPROVED — greenlight for backend migration and frontend cleanup

---

## Context

The default symptom list shipped with a "Period" entry (`is_default: true`) that was likely included at an early stage before the product's target demographic was fully locked. This decision formalizes its removal.

---

## Decision Rationale

Menolisa is purpose-built for women in perimenopause and menopause. The defining clinical reality of this life stage is the cessation of regular menstrual cycles. Tracking "Period" as a default symptom is misaligned with our user in three concrete ways:

1. **Demographic mismatch.** Most users are in late perimenopause or postmenopause. For postmenopausal women, the presence of a "Period" tracker is either irrelevant or — more critically — potentially alarming (postmenopausal bleeding is a medical red flag that warrants immediate clinical attention, not symptom logging in a wellness app).

2. **Trust and credibility risk.** A woman in late perimenopause who opens the symptom grid and sees "Period" as a default will read this as the product not understanding her. That is a first-impression trust failure.

3. **Insight pollution.** Period data for a perimenopausal population is highly irregular and context-dependent. It does not generate clean patterns and creates noise in any correlation analysis (e.g., linking period logs to mood or sleep would surface spurious correlations). It adds data without insight value.

**Conclusion**: "Period" does not belong in the default Menolisa symptom list. This is not a minor cleanup — it is a product coherence fix.

---

## Scope of Removal

### What gets removed
- The `is_default: true` symptom row for "Period" in the Supabase `symptoms` table
- All `symptom_logs` rows associated with that default Period symptom row, across all users
- Frontend: `'Period': 'ellipse-outline'` entry in `src/lib/symptomIconMapping.ts`
- Frontend: `period: require('../../assets/symptoms/period.png')` entry in `src/lib/symptomIllustration.ts`
- Asset file: `assets/symptoms/period.png` (safe to delete — no other reference after mapping removal)

### What stays untouched
- Any user-created symptom named "Period" (user-defined rows where `is_default: false`). These are deliberate user choices and must not be touched. The migration must scope deletion explicitly to the default row only.
- The icon mapping fallback logic and `getSymptomIconName` function behavior — no structural changes needed, just the one entry removed.

---

## Destructive Log Deletion — Confirmed

The decision to delete associated symptom logs (not soft-delete or archive) is confirmed. Rationale:

- The affected data is for a symptom that should not have been default in the first place. It is not data the product meaningfully acted on.
- Preserving orphaned logs after removing the symptom creates a data integrity problem and complicates future insight queries.
- The user base is early enough that the volume of historical Period logs is low and the logs themselves are not part of any active insight or export feature.
- No export or "download your data" feature currently exists, so users have no expectation that this data is permanently held.

This decision would need to be revisited if: (a) a data export feature ships before the migration runs, or (b) the app reaches a scale where deletion volume triggers user complaints.

---

## User Communication — Decision: No In-App Notification Required

Proactive in-app messaging to affected users is not warranted. Reasons:

- The Period symptom generated no insights, no weekly summaries, and no patterns that were surfaced to users. There is nothing to retract.
- Announcing the removal draws attention to an error and creates confusion for users who never noticed the symptom.
- The symptom grid is browsed, not memorized. Most users will not notice a single tile disappearing.

**Exception**: If a user contacts support asking why Period is gone, the support response is: "We refined our default symptom list to better reflect the menopausal experience. You can always add a custom symptom if you'd like to track this yourself." This response must not be proactively surfaced — only reactive.

---

## Insight and Pattern Considerations

No active insight templates reference Period logs. The removal does not break any existing correlation logic. Backend-lead should confirm no Edge Function references Period as a named symptom in any prompt or aggregation query before running the migration.

---

## UX and Copy Changes

### Symptom grid
No empty state change needed. The grid reflows when a tile is removed — this is standard behavior. No gap will be visible because the grid is not a fixed layout.

### No toast, modal, or changelog entry required.

### If the symptom grid ever reaches a state where it is empty for a user (e.g. all defaults removed and no customs added), the existing empty state copy should read:
"Your tracker is ready when you are. Tap the + to add the symptoms that matter most to you right now."
This is forward-looking and empowering — not focused on what was removed.

---

## Implementation Checklist for Downstream Agents

### Backend-lead
- [ ] Write a Supabase migration that deletes the `symptoms` row where `name = 'Period'` AND `is_default = true`
- [ ] Cascade delete or explicitly delete all `symptom_logs` rows referencing that symptom's UUID — confirm foreign key constraint behavior before running
- [ ] Confirm no Edge Function references "Period" as a named symptom in prompts or aggregations
- [ ] Scope the migration to the default row only — user-created Period symptoms must not be affected
- [ ] Run on staging, verify row counts before promoting to production

### UI-designer
- [ ] Remove `'Period': 'ellipse-outline'` from `src/lib/symptomIconMapping.ts`
- [ ] Remove `period: require('../../assets/symptoms/period.png')` from `src/lib/symptomIllustration.ts`
- [ ] Delete `assets/symptoms/period.png`
- [ ] Confirm symptom grid reflows correctly after removal — test on both iOS and Android
- [ ] No new UI components, empty states, or messaging required

---

## Feature Prioritization Score

| Criterion | Score | Notes |
|---|---|---|
| User Burden | Positive | Reduces cognitive dissonance for the target user |
| Empathy Alignment | Positive | A Period tile reads as not knowing your user |
| Insight Value | Positive | Removes noise from pattern data |
| Safety | Pass | Removal reduces risk (postmenopausal bleeding is a clinical concern, not a logging moment) |
| Menopause Relevance | Positive | The removal IS the menopause relevance fix |

All five criteria pass. No blockers.

---

## Status: GREENLIT

Backend migration and frontend cleanup may proceed.
