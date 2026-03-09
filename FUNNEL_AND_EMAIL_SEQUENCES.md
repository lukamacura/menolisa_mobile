# Menolisa: Current Funnel Logic & Email Sequences

## 1. Current funnel logic (web app)

The main acquisition flow lives on the **web app** at `/register` (or equivalent register route). It’s a single-page flow with four phases.

### Phases

| Phase   | What happens |
|--------|----------------|
| **Quiz** | User answers 9 steps: age, here for, goals, symptoms, breather, what tried, how long, qualifier, name. Progress text shows “Question X of 9” (or “Quick pause” / “Almost there”). Options use 48px min touch targets; multi-select steps show “X selected. You can choose more than one.” |
| **Gate** | After the last quiz step, user hits **Gate**: “Your personalized Menopause Score is ready” → enter **email only** → “Show my results.” On submit, the app **creates an account** (Supabase signUp with a generated temp password), saves quiz answers via `POST /api/auth/save-quiz`, then moves to **Results**. |
| **Results** | Short loading (~3s, skippable after 2s), then: score card (Menopause Score X/100, target 80+), severity headline and copy, symptom pills, social proof. **What happens next:** one CTA — **“Set my password & continue”** → goes to **Email** phase. |
| **Email** | User already has an account (from gate). This step is **set password**: one field, then “Continue to my account” → redirect to **dashboard**. No “Notify me when the app is ready” anymore. |

### Flow summary

```
Quiz (9 steps) → Gate (email → create account + save quiz) → Results (score + one CTA) → Email (set password) → Dashboard
```

- **Account creation** happens at the **gate** (before results). The “lead magnet” is the score on the page; there is no email-only path that skips account creation.
- **Trial:** After save-quiz, the backend creates a `user_trials` row (e.g. 3-day trial, `account_status: 'trial'`). That drives Segment 2 Track A emails.

---

## 2. All email sequences

There are two kinds of email: **transactional** (one-off, triggered by an action) and **scheduled sequences** (Segment 2 & 3, driven by n8n from `email_sequence_recipients`).

### 2.1 Transactional emails

| Email            | When it’s sent | Where / how |
|------------------|-----------------|-------------|
| **Magic link**   | User requests a magic link to sign in (e.g. from login or another flow). | `POST /api/auth/send-magic-link`. Can create account and save quiz if `isRegistration` + `quizAnswers` are sent. Sends Supabase magic link email. |
| (Others)         | Any other one-off emails (password reset, etc.) would be via Supabase Auth or your own sending; not defined in `emailSequences.ts`. | — |

These are **not** part of the multi-step sequences below.

---

### 2.2 Scheduled sequences (Segment 2 & 3)

Defined in **`web app/lib/emailSequences.ts`**. Used by **n8n** (or another scheduler) that reads **`email_sequence_recipients`** and (in the current setup) updates **`sent_steps`** after each send. Placeholders: `{{name}}`, `{{top_problems}}`, `{{subscription_ends_at}}`.

Recipients are synced from `user_profiles` + `user_trials` (and auth for email); timing is based on `trial_start`, `trial_end`, `account_status`, `paid_at`, `subscription_ends_at`.

---

#### Segment 2 — Trial and win-back

**Track A: Trial (first 3 days)**  
Audience: `account_status = 'trial'`, `trial_start` within last 3 days.

| Step | Typical timing | Subject | Purpose |
|------|----------------|---------|---------|
| **2A1** | 0–1 h after trial_start | {{name}}, Lisa's ready for you | Welcome; open app, say hi, log one symptom. |
| **2A2** | 24 h | How was your day? Lisa can use it. | Remind to log; “here’s what I’m noticing” by day 2. |
| **2A3** | 48 h | Lisa noticed something about your symptoms | Point to “What Lisa Noticed” and doctor summary. |
| **2A4** | 72 h (trial ending) | Your free access ends tonight—here's what happens next | Soft conversion: $12/mo or $79/yr, link to dashboard/settings. |

**Track B: Trial expired (win-back)**  
Audience: trial ended, not paid (e.g. `account_status = 'expired'`).

| Step | Typical timing | Subject | Purpose |
|------|----------------|---------|---------|
| **2B1** | Day 0 after expiry | We miss you, {{name}} | Re-engage; “finally, someone gets it.” |
| **2B2** | 5–7 days after expiry | What to tell your doctor—and how Lisa helps | Doctor summary angle; link to continue. |
| **2B3** | 7–10 days after expiry | Whenever you're ready, Lisa's here | Last touch; $12/mo, cancel anytime. |

---

#### Segment 3 — Paid subscribers

Audience: `account_status = 'paid'`. Timing uses **`paid_at`** and **`subscription_ends_at`**.

| Step | Typical timing | Subject | Purpose |
|------|----------------|---------|---------|
| **3-1** | Within 24 h of paid_at | You're in—thank you, {{name}} | Thank you; “What Lisa Noticed,” doctor note. |
| **3-2** | 5–7 days after paid | 3 ways to get more from Lisa | Tips: log shifts, check insights, build summary before doctor. |
| **3-3** | 14–21 days | Give a friend 7 days with Lisa—get 50% off your next month | Referral: 7-day trial for friend, 50% off for user. |
| **3-4** | ~30 days | {{name}}, how's it going with Lisa? | Check-in; reply welcome. |
| **3-5** | Before renewal (subscription_ends_at) | Your subscription renews soon—here's what you have with Lisa | Renewal reminder; manage subscription link. |

---

### 2.3 How sequences are sent

- **Data:** n8n (or similar) reads **`email_sequence_recipients`** (and possibly **`email_sequence_sends`** if re-introduced). Synced from `user_profiles` and `user_trials` via DB triggers; includes email, name, top_problems, trial/subscription dates, account_status, paid_at.
- **Who gets which step:** Logic is based on `trial_start`, `trial_end`, `account_status`, `paid_at`, and which steps are already in `sent_steps` (or in `email_sequence_sends`). See backend handoff: `mobile app/.cursor/agents/BACKEND_HANDOFF_EMAIL_SEQUENCES.md`.
- **Templates:** Rendered with `renderTemplate(template, { name, top_problems, subscription_ends_at })` from `emailSequences.ts`; links use `NEXT_PUBLIC_APP_URL` (e.g. dashboard, dashboard/settings).

---

### 2.4 What’s *not* in the codebase (as of this doc)

- **Quiz-only / lead-magnet sequence:** No separate 3–5 email sequence for “took quiz but didn’t create account.” Current flow creates an account at the gate, so everyone who completes the gate is in the trial (Segment 2 Track A) once they set a password and use the app.
- **“Your Menopause Score” one-time email:** No automated email that sends the score + interpretation to the user’s inbox right after the quiz. The score is shown on the results page only.
- **Notify-at-launch:** The “Notify me when the app is ready” CTA and `/api/auth/notify-app-launch` have been **removed from the UI**. The `notify_on_app_launch` column and API can stay for future use but are not part of the current funnel.

---

## 3. One-page reference

| Item | Location / note |
|------|------------------|
| Funnel (quiz → gate → results → set password → dashboard) | Web app: `app/register/page.tsx` (phases: quiz, gate, results, email). |
| Account creation | At **gate** (Supabase signUp + save-quiz). |
| Trial creation | After save-quiz: `user_trials` row (e.g. 3 days, trial). |
| Segment 2 & 3 templates | `web app/lib/emailSequences.ts`. |
| Segment timing & sync | `BACKEND_HANDOFF_EMAIL_SEQUENCES.md`; table `email_sequence_recipients`; n8n uses it (and `sent_steps`) to send steps. |
| Transactional (e.g. magic link) | `POST /api/auth/send-magic-link` (and Supabase Auth emails). |
