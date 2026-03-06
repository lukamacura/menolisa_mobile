# RegisterScreen: Illustrations + Full-Height No-Scroll Quiz

**For:** ui-designer  
**File:** `src/screens/RegisterScreen.tsx`  
**Goal:** Use generated quiz illustrations, keep UI simple and conversion-focused (CR), and make each quiz screen fill device height with **no scrolling** in the quiz flow.

---

## 1. Use real illustration assets

Images are in **`assets/quiz/`**. Replace every `IllustrationSlot` (placeholder View) with an **`Image`** that uses `require()` for the corresponding asset.

| Step / Phase | Asset path (require) |
|--------------|----------------------|
| q1_age | `../../assets/quiz/illustration_q1_age.png` |
| q2_here_for | `../../assets/quiz/illustration_q2_here_for.png` |
| q3_goals | `../../assets/quiz/illustration_q3_goals.png` |
| q4_symptoms | `../../assets/quiz/illustration_q4_symptoms.png` |
| breather | `../../assets/quiz/illustration_breather.png` |
| q5_what_tried | `../../assets/quiz/illustration_q5_what_tried.png` |
| q6_how_long | `../../assets/quiz/illustration_q6_how_long.png` |
| q7_qualifier | `../../assets/quiz/illustration_q7_qualifier.png` |
| q8_name | `../../assets/quiz/illustration_q8_name.png` |
| loading | `../../assets/quiz/illustration_loading.png` |
| results | `../../assets/quiz/illustration_results.png` |
| social_proof | `../../assets/quiz/illustration_social_proof.png` (or keep existing `assets/social.png` if preferred) |
| email | `../../assets/quiz/illustration_email.png` (or keep existing `assets/register.png` if preferred) |

- Use **`resizeMode="contain"`** and a wrapper with the same max heights as today (160 for Q1–Q7, 140 for breather and Q8, 180 for results). Use tokens for spacing.
- **Loading phase:** Replace or supplement the logo with `illustration_loading.png` (centered, same area ~64pt or slightly larger).
- **Results:** Replace the results illustration placeholder with `illustration_results.png`.
- **Social proof / Email:** Use the new assets if present; otherwise keep current `social.png` / `register.png`.

Implement a small **`QuizIllustration`** (or inline Image) that takes a `source` (require result) and `height`; use it everywhere instead of `IllustrationSlot`.

---

## 2. Quiz phase: device height, no scroll

**Requirement:** The **quiz phase** (all 9 steps: q1_age … q8_name + breather) must have **height equal to device height**. The user must **not scroll** during the quiz flow.

- Use **`Dimensions.get('window')`** (or `useWindowDimensions`) so the quiz root has **`height: window.height`** (or `flex: 1` with a parent that has fixed height).
- **Remove** the outer **`ScrollView`** in the quiz phase. The quiz content (illustration + question + options + footer) must fit in one viewport.
- Layout approach:
  - **Quiz container:** `SafeAreaView` with `style={{ flex: 1 }}` or explicit `minHeight: window.height` so the screen is always full height.
  - **Content:** Use **flex** so: (1) illustration at top (fixed or flexible height, e.g. max 160–140), (2) title + subtitle, (3) **options list** with **`flex: 1`** and **`flexWrap`** / **`flexGrow`** so options fill remaining space without overflowing the screen. If an option set is large (e.g. goals, symptoms), use a **constrained** options area (e.g. `flex: 1` with `maxHeight` or a fixed number of rows) and **no scroll**; reduce padding or font size only if needed to keep everything on one screen.
  - **Footer:** Step indicators + Back/Next fixed at bottom (same as now).
- **Do not** use `ScrollView` in the quiz phase. If content cannot fit on very small devices, prefer slightly smaller illustration or tighter spacing (tokens) so it still fits.

---

## 3. Keep UI simple and conversion-focused

- **Minimal layout:** No extra cards or decorative elements; illustration + one question + options + one primary CTA (Next/Continue). Preserve existing step indicators and Back/Next.
- **Clear hierarchy:** One question per screen; title prominent (tokens); options tappable with clear selected state (existing styles). Single primary button.
- **Consistency:** Same gradient background (`landingGradient`), same tokens (`colors`, `spacing`, `radii`, `typography`, `minTouchTarget`). Keep existing copy; no new marketing copy unless it’s a tiny tweak for clarity.
- **Loading / Results / Social proof / Email:** Keep these phases as they are in structure; only swap in the new illustrations where specified. Results and social proof screens may keep their existing ScrollView if content is long; the strict “no scroll” rule applies to the **quiz steps only**.

---

## 4. Acceptance criteria

- [ ] Every quiz step and the loading/results/social proof/email phases use **real images** from `assets/quiz/` (or existing assets where noted).
- [ ] Quiz phase has **no ScrollView**; each step fits within **device height** (window height).
- [ ] Illustration heights: 160px for Q1–Q7, 140 for breather and Q8, 180 for results; loading and social/email as per current or new asset.
- [ ] Layout uses only `src/theme/tokens.ts`; no hardcoded colors or spacing.
- [ ] Back/Next and step indicators remain at bottom; flow and behavior unchanged.
