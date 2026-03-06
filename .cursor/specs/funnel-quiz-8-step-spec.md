# Funnel Arbitrage Quiz — Full 8-Step Implementation Spec (Mobile)

**Audience:** ui-designer, backend-specialist  
**Stack:** Expo/React Native, `src/theme/tokens.ts`, `src/lib/api.ts`, Supabase auth  
**Scope:** RegisterScreen expansion to full 8-step quiz + dedicated loading screen; name remains last (Q8).

---

## 1. User flow (high level)

1. **Quiz** — 8 steps + 1 breather (no input). Order: Q1 → Q2 → Q3 → Q4 → **Breather** → Q5 → Q6 → Q7 → **Q8 (Name)**.
2. **Loading** — Dedicated screen, 10–15 seconds, rotating messages + optional testimonial.
3. **Results** — Score + personalized copy (existing pattern); single "Next" CTA.
4. **Social proof** — One screen, one "Continue" CTA.
5. **Email** — Signup (email + password + terms); on success, call save-quiz then auth listener navigates.

**Back:** From first quiz step → Landing; from any other step → previous step. No removal of name; it is always Q8.

---

## 2. Quiz steps (8 total, name last)

| Step ID       | Type        | Question / intent | Options / behavior |
|---------------|-------------|-------------------|---------------------|
| **q1_age**    | single      | Age/life stage (low friction) | e.g. "Under 40", "40–45", "46–50", "51+", "Prefer not to say" — single-select. |
| **q2_here_for** | single    | "I'm here for…" (self-identification) | e.g. "Perimenopause", "Menopause", "Supporting someone", "Just curious" — single-select. |
| **q3_goals**  | multi       | Goals (aspirational) | Reuse/extend existing GOAL_OPTIONS (sleep, think clearly, feel like myself, understand patterns, data for doctor, get body back, etc.) — multi-select. |
| **q4_symptoms** | multi    | "What's making life hardest?" (pain/symptoms) | Reuse existing PROBLEM_OPTIONS (hot_flashes, sleep_issues, brain_fog, mood_swings, weight_changes, low_energy, anxiety, joint_pain) — multi-select. |
| **breather**  | —           | Social proof only | No input. One short testimonial or stat + single "Continue" button. |
| **q5_what_tried** | multi  | "What have you tried?" (objection pre-handling) | Reuse existing TRIED_OPTIONS (nothing, supplements, diet, exercise, hrt, doctor_talk, apps) — multi-select. |
| **q6_how_long** | single   | "How long have symptoms been affecting you?" | Reuse existing TIMING_OPTIONS (just_started, been_while, over_year, several_years) — single-select. |
| **q7_qualifier** | single  | Qualifier: "How ready are you?" or "Biggest hope with MenoLisa?" | e.g. "Ready to take action", "Exploring options", "Want to understand first" (or hope-based variants) — single-select. |
| **q8_name**   | text        | "What should Lisa call you?" | Single text input, placeholder "First name". **Must be last.** |

**Step array for UI:**  
`['q1_age', 'q2_here_for', 'q3_goals', 'q4_symptoms', 'breather', 'q5_what_tried', 'q6_how_long', 'q7_qualifier', 'q8_name']`  
— 9 "steps" in the flow (8 questions + 1 breather); step indicators can show 8 dots (excluding breather) or 9; product preference: show 9 so breather is visible.

---

## 3. Lisa chat context — fields to persist

Every quiz answer must be stored and exposed to **Lisa chat orchestration** (backend) for personalized replies. Persist at least:

| Field (API/key)   | Type     | Source step   | Notes |
|-------------------|----------|---------------|--------|
| `age_band`        | string   | q1_age        | e.g. "under_40", "40_45", "46_50", "51_plus", "prefer_not" |
| `here_for`        | string   | q2_here_for   | e.g. "perimenopause", "menopause", "supporting", "curious" |
| `goals`           | string[] | q3_goals      | Multi-select IDs |
| `symptoms`        | string[] | q4_symptoms   | Same as current top_problems (symptom IDs) |
| `what_tried`      | string[] | q5_what_tried | Multi-select IDs |
| `how_long`        | string   | q6_how_long  | e.g. "just_started", "been_while", "over_year", "several_years" |
| `qualifier`       | string   | q7_qualifier | e.g. "ready_to_act", "exploring", "understand_first" (or hope-based IDs) |
| `name`            | string   | q8_name      | First name; null if empty |

**Optional for backward compatibility / scoring:**  
- `severity` — If results still use a severity-like dimension, it can be derived from symptoms + how_long + qualifier, or a separate hidden/optional field; otherwise omit.  
- **Score:** Results screen may continue to use a formula based on symptoms, duration, what_tried; backend can store `quality_score` or compute server-side from the above.

Backend must make these available to the chat/LLM context (e.g. user_profiles or intake table keyed by user id).

---

## 4. Illustration placeholders

For each screen/phase that should have a custom illustration, use the following. **Asset root:** `assets/quiz/` (create if missing). Use i18n-friendly keys for alt/accessibility; image files are referenced by path.

| Screen / Phase     | Suggested asset path              | Placement | Dimensions / ratio |
|--------------------|-----------------------------------|-----------|---------------------|
| Q1 (Age)           | `assets/quiz/illustration_q1_age.png`     | Above question title, centered, max height 160px | 320×160 or 4:2; optional 2x. |
| Q2 (Here for)      | `assets/quiz/illustration_q2_here_for.png`| Above question title, centered, max height 160px | Same. |
| Q3 (Goals)         | `assets/quiz/illustration_q3_goals.png`    | Above question title, centered, max height 160px | Same. |
| Q4 (Symptoms)      | `assets/quiz/illustration_q4_symptoms.png`| Above question title, centered, max height 160px | Same. |
| Breather           | `assets/quiz/illustration_breather.png`   | Above testimonial/stat, centered, max height 140px | e.g. 280×140. |
| Q5 (What tried)    | `assets/quiz/illustration_q5_what_tried.png` | Above question title, centered, max height 160px | Same as Q1–Q4. |
| Q6 (How long)      | `assets/quiz/illustration_q6_how_long.png`| Above question title, centered, max height 160px | Same. |
| Q7 (Qualifier)     | `assets/quiz/illustration_q7_qualifier.png`| Above question title, centered, max height 160px | Same. |
| Q8 (Name)          | `assets/quiz/illustration_q8_name.png`    | Above "What should Lisa call you?", centered, max height 140px | Softer, personal; same ratio. |
| Loading            | (existing logo or) `assets/quiz/illustration_loading.png` | Centered; current logo_transparent.png can remain default. | Optional replacement; keep 64×64 area. |
| Results            | `assets/quiz/illustration_results.png`    | Above headline, centered, max height 180px | Slightly larger for impact. |
| Social proof       | Existing `assets/social.png` or `assets/quiz/illustration_social_proof.png` | Same as current social proof screen (top, full width, max height ~200). | Keep current if no change. |
| Email (signup)     | Existing `assets/register.png` or `assets/quiz/illustration_email.png` | Same as current register screen. | Keep current if no change. |

**Implementation note:**  
- Use `<Image source={require('../../../assets/quiz/illustration_q1_age.png')} />` (or equivalent relative path from screen) with `resizeMode="contain"` and a wrapper with `maxHeight: 160`.  
- If file is missing, hide the image or show a placeholder so layout doesn’t break; document in AC.

---

## 5. Backend: save-quiz payload and storage

### 5.1 Payload shape (POST save-quiz or intake)

Call after successful signup (user exists). Optionally support **unauthenticated** save with a session/token if signup happens after the quiz (current flow: quiz → loading → results → social proof → email → signup → save).

**Endpoint:** Either existing `POST /api/auth/save-quiz` or `POST /api/intake` (see `API_CONFIG.endpoints.intake`). Prefer one canonical endpoint for "save funnel quiz".

**Request body (JSON):**

```json
{
  "userId": "<uuid-from-auth-after-signup>",
  "referralCode": "<optional-string>",
  "quiz": {
    "age_band": "46_50",
    "here_for": "perimenopause",
    "goals": ["sleep_through_night", "think_clearly"],
    "symptoms": ["hot_flashes", "sleep_issues", "brain_fog"],
    "what_tried": ["supplements", "diet"],
    "how_long": "over_year",
    "qualifier": "ready_to_act",
    "name": "Jane"
  }
}
```

**If unauthenticated save (e.g. pre-signup):**  
- Send the same `quiz` object; backend may store by `sessionId` or anonymous id and merge under `userId` on signup. TBD: product decision; for MVP, sending only after signup is acceptable.

### 5.2 Backend storage and chat exposure

- **Store** all fields in a table that is keyed by user (e.g. `user_profiles` or `intake` / `funnel_quiz`). Prefer one row per user (upsert by user id).
- **Expose to Lisa chat:** Backend that builds the context for the LLM must read: `age_band`, `here_for`, `goals[]`, `symptoms[]`, `what_tried[]`, `how_long`, `qualifier`, `name`, and optionally a computed `quality_score` if used.
- **RLS / auth:** Only the owning user (or service role for backend orchestration) can read/write their row.

---

## 6. Acceptance criteria

**Quiz flow**  
- [ ] User can complete all 8 questions in order: q1_age → q2_here_for → q3_goals → q4_symptoms → breather → q5_what_tried → q6_how_long → q7_qualifier → q8_name.  
- [ ] Name is always last (Q8); no step is removed or reordered that would move name earlier.  
- [ ] Breather has no form input; only copy + one "Continue" button.  
- [ ] Back from first question goes to Landing; Back on any other step goes to previous step.  
- [ ] Next/Continue is disabled until the current step is answered (breather has no answer, so always enabled).

**Loading**  
- [ ] After Q8 "Continue", user sees a dedicated loading screen for 10–15 seconds.  
- [ ] Loading screen shows rotating messages (and optionally one testimonial).  
- [ ] No way to skip; after 10–15 s, transition to Results.

**Results**  
- [ ] Results screen shows score and personalized copy (existing pattern).  
- [ ] One "Next" CTA advances to Social proof.

**Social proof & email**  
- [ ] Social proof screen has one "Continue" → Email (signup).  
- [ ] Email step unchanged in behavior (email, password, terms); on success, save-quiz is called with full payload, then auth listener navigates.

**Lisa context**  
- [ ] Every field in §3 is sent in the save-quiz payload and is stored.  
- [ ] Backend exposes these fields to chat orchestration (documented or implemented).

**Illustrations**  
- [ ] For each screen in §4, a placeholder area exists at the specified placement; if the asset file is present, it is shown; if missing, layout still works (no crash, optional placeholder).

**Copy**  
- [ ] All user-facing strings are i18n-ready (keys or placeholders); no hardcoded English in the UI where avoidable.

---

## 7. Summary for implementers

| Role                | Focus |
|---------------------|--------|
| **ui-designer**     | Implement 9-step quiz (8 questions + breather) in RegisterScreen; add loading screen (10–15 s); keep results → social proof → email. Add illustration placeholders per §4; use `tokens.ts` and existing patterns. |
| **backend-specialist** | Accept save-quiz payload (§5.1); store in user_profiles or intake table; expose age_band, here_for, goals, symptoms, what_tried, how_long, qualifier, name to Lisa chat. |

**File to extend:** `src/screens/RegisterScreen.tsx` (and optionally a small `QuizSteps` or constants module for step IDs and option lists).  
**New assets directory:** `assets/quiz/` — place illustration files as in §4.
