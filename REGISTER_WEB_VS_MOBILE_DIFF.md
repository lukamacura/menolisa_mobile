# Register flow: Web vs Mobile — differences (before alignment)

Mobile `RegisterScreen.tsx` is being aligned with web `app/register/page.tsx`. Below is what was different and what was changed.

---

## 1. Phase / flow

| Aspect | Web | Mobile (before) |
|--------|-----|------------------|
| **Phases** | `quiz` → `gate` → `results` → `email` | `quiz` → `loading` → `results` → `social_proof` → `email` |
| **Gate** | Yes. After last quiz step: email-only screen → create account (temp password) + save quiz → then results. | No. Quiz went straight to loading, then results. |
| **Email capture** | At **gate** (before results). Account created here. | At **email** phase (after results + social_proof). Account created here. |
| **Account creation** | At gate: `signUp` with generated temp password; then `/api/auth/save-quiz` (creates profile + user_trials). | At email: `signUp` with user-chosen password; then `/api/intake` (profile only; no user_trials in intake). |
| **After results** | Single CTA: “Set my password & continue” → **email** (set-password-only screen). | “Next” → **social_proof** screen → “Continue” → **email** (full signup: email + password + terms). |
| **social_proof** | No separate phase. Social proof is a line inside results; then one CTA. | Separate **social_proof** phase with its own screen. |

**Alignment:** Add **gate** phase; remove **social_proof** as a phase; after results go straight to **email**; when coming from gate, email phase is **set-password-only** (like web).

---

## 2. Loading duration

| Aspect | Web | Mobile (before) |
|--------|-----|------------------|
| **Duration** | ~3 s | 12 s (`LOADING_PHASE_DURATION_MS = 12000`) |
| **Skip button** | Removed (no “Show my results”). | N/A (no skip). |

**Alignment:** Mobile loading ~3 s to match web.

---

## 3. Results screen

| Aspect | Web | Mobile (before) |
|--------|-----|------------------|
| **“What happens next”** | Fixed to bottom (not in scroll). One paragraph + one CTA. | Not present; results had “Next” → social_proof. |
| **Primary CTA** | “Set my password & continue” → email (set password). | “Next” → social_proof. |
| **Social proof** | Inline in results (“8,382 women joined this month”). | Inline in results + separate social_proof screen. |

**Alignment:** “What happens next” block fixed at bottom of results; single CTA “Set my password & continue” → email. Remove navigation to social_proof.

---

## 4. Email phase

| Aspect | Web | Mobile (before) |
|--------|-----|------------------|
| **When from gate** | Set-password-only: email read-only, one password field, “Continue to my account”. | Always full form: email + password + terms + “Start my free trial”. |
| **When from gate (account)** | Already created at gate; only `updateUser({ password })` then redirect. | N/A (no gate). |

**Alignment:** If user signed up at gate (`signedUpAtGate`), show only set-password form (email read-only, one button). Otherwise keep full signup form for other entry paths.

---

## 5. Quiz UX (minor)

| Aspect | Web | Mobile (before) |
|--------|-----|------------------|
| **Progress text** | “Question X of 9” / “Quick pause” / “Almost there” above step dots. | Step dots only, no text. |
| **Multi-select hint** | Q3, Q4, Q5: “X selected. You can choose more than one.” | No hint. |

**Alignment:** Add progress text above step indicators; add multi-select hint for Q3, Q4, Q5.

---

## 6. Save-quiz API and payload

| Aspect | Web | Mobile (before) |
|--------|-----|------------------|
| **Endpoint** | `POST /api/auth/save-quiz` (creates profile + **user_trials**). | `POST /api/intake` (profile only; no user_trials). |
| **Body** | `{ userId, quizAnswers: { top_problems, severity, timing, tried_options, goal, name }, referralCode }`. | `{ userId, referralCode, quiz: { age_band, here_for, goals, symptoms, what_tried, how_long, qualifier, name } }` (intake expects flat: user_id, name, top_problems, severity, timing, tried_options, goal). |

**Alignment:** For gate flow, mobile calls **`/api/auth/save-quiz`** with same body as web (`userId`, `quizAnswers`, `referralCode`) so profile and **user_trials** are created. Add `saveQuizAuth` (or use same endpoint) in `api.ts` for this.

---

## 7. Severity / copy

| Aspect | Web | Mobile (before) |
|--------|-----|------------------|
| **getSeverityPainText** | Uses “symptom”/“symptoms”, “this”/“these”, “it”/“them” by count. | Simpler copy; did not match web’s grammar. |

**Alignment:** Use same getSeverityPainText logic/copy as web (symptomWord, theseThis, themIt, theyIt) for consistency.

---

## 8. Summary of code changes (mobile)

1. **Phase type:** `'gate'` added; `'social_proof'` removed.
2. **State:** `signedUpAtGate` added; after gate signup set it true.
3. **goNext (last step):** From last quiz step → `setPhase('gate')` (not `'loading'`).
4. **Gate UI:** New screen: “Your personalized Menopause Score is ready” → email input → “Show my results” → `signUp` (temp password) → `POST /api/auth/save-quiz` → `setSignedUpAtGate(true)` → `setPhase('loading')`.
5. **Loading:** Duration 3000 ms; remove 12000.
6. **Results:** “What happens next” fixed at bottom; CTA “Set my password & continue” → `setPhase('email')` (remove navigation to social_proof).
7. **Remove:** Entire `social_proof` phase (screen + illustration reference).
8. **Email:** If `signedUpAtGate`, show set-password-only (email read-only, one password field, “Continue to my account”, call `updateUser({ password })` then navigate). Else show full signup form.
9. **Progress text:** Above step indicators, “Question X of 9” / “Quick pause” / “Almost there”.
10. **Multi-select:** Q3, Q4, Q5 show “X selected. You can choose more than one.”
11. **API:** Add `saveQuizAuth: '/api/auth/save-quiz'` and use it in gate submit with web-shaped payload.
