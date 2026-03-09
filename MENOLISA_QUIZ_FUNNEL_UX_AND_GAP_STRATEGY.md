# Menolisa Quiz Funnel: UX/UI Audit, Marketing Critique & Post-Quiz Gap Strategy

**Role:** Lead UX Researcher + Conversion Rate Optimizer  
**Context:** Audit of web menopause quiz → email capture (Menopause Score) → 3-segment nurture. Audience: women 40+, low technical literacy, brain fog / high stress. Constraint: no live mobile app links yet.

**Consulted:** [marketing-expert](.cursor/agents/marketing-expert.md) — direct response, awareness levels, offer-first, full-funnel thinking.

---

## 1. UX/UI Audit — Quiz Friction for Non–Tech-Savvy & Brain-Fog Users

### 1.1 What’s Working

- **Single-question-per-screen:** Reduces cognitive load; one decision at a time.
- **Clear “Choose one” vs “Select all that apply”:** Reduces ambiguity.
- **Breather step:** Mid-quiz pause (“You’re in good company”) lowers anxiety and abandonment.
- **Illustrations per step:** Visual anchors aid recognition and reduce reliance on text.
- **“2-minute quiz” framing:** Sets expectation and reduces perceived effort.
- **Back button:** Allows correction without feeling trapped.

### 1.2 Friction Points & Recommendations

| Issue | Risk (40+, brain fog, low tech) | Recommendation |
|--------|----------------------------------|----------------|
| **Small tap targets** | Option buttons use `py-2 px-2.5`; on mobile this can be below 44px. Small “Back”/“Next” (e.g. `py-2`) are easy to mis-tap. | Use minimum **48px height** for all primary option and nav buttons; increase padding to `py-3 sm:py-4` and ensure touch target ≥44px. |
| **9 dots as progress** | Dots are abstract (“which question is this?”). No “Step 3 of 9” or “2 more questions.” | Add **explicit progress**: “Question 3 of 9” or “2 minutes left” so users know how much is left and don’t abandon. |
| **“Select all that apply” without clear feedback** | Q3 (goals), Q4 (symptoms), Q5 (what tried) allow multiple selections. Users with brain fog may forget they can select more or worry they did it wrong. | After first selection, show **inline hint**: “You can choose more than one” and/or **counter**: “3 selected.” Consider a soft “Done with this question?” before Next. |
| **Dense option lists (e.g. 6 goals, 8 symptoms, 7 tried)** | Long scroll + many choices increase cognitive load and decision fatigue. | Keep single column but **increase spacing** between options (`gap-2` → `gap-3`). Optionally **chunk** (e.g. “Sleep & energy” vs “Mood & mind”) with subheadings. |
| **Small body text** | `text-xs sm:text-sm` for labels and hints can be hard for 40+ and under stress. | Use **base font size** for instructions (e.g. `text-sm sm:text-base`) and ensure **minimum 16px** on mobile to avoid zoom. |
| **No “Save and continue later”** | If they leave (phone call, interruption), progress is lost. | Offer **“Email my progress”** or save state in `localStorage` + one-time “Pick up where you left off” on return (with clear copy). |
| **Gate: email only, then “Show my results”** | Creating account (temp password) happens in the same flow; no “email-only” path for users who only want the score. | For **lead-magnet-first** positioning: consider a path that only captures email, sends score by email, and nurtures; account creation can follow in email CTA. |
| **Results loading (5s)** | Fixed 5-second wait with rotating messages may feel long or gimmicky to stressed users. | Shorten to **~3s** or make it **skippable** after 2s (“Your results are ready” with a “Show my results” button). |
| **Results CTA: “Set my password & continue”** | Implies account creation immediately after score; no app link. If goal is “bridge to future app,” this creates a **dead end** after dashboard. | See **Section 3** for a Thank You / Results page that bridges without an app link. |

### 1.3 Cognitive Load Summary

- **Reduce:** One question per screen (already done). Add progress text, larger touch targets, clearer “multi-select” feedback.
- **Chunk:** Group long lists with subtle headings or sections.
- **Reassure:** Keep breather; add optional “This usually takes 2 minutes” or “Almost there” on last 2 steps.
- **Recover:** Save progress or “email my progress” to reduce loss and re-entry.

---

## 2. Marketing Insight — “Menopause Score” as Hook & 3-Part Email Sequence

*Aligned with marketing-expert: market first, offer before copy, full funnel.*

### 2.1 Is “Menopause Score” Enough to Drive 40+ to Open a 3-Part Sequence?

**Short answer:** It’s a **strong hook** for awareness and curiosity, but it’s **not sufficient by itself** to sustain opens and clicks across three emails. You need a clear **mechanism** and **next step** in each email.

**Why the score works as hook:**

- **Personal and specific:** “Your score” is about them, not generic advice — fits Schwartz “problem-aware” / “solution-aware” framing.
- **Low commitment:** “See your score” feels like a small, safe step (no purchase, no app download yet).
- **Curiosity + validation:** This demographic often feels dismissed (“it’s just menopause”); a score can feel like “someone is finally measuring what I feel.”
- **Name (“Menopause Score”)** is simple and memorable; “Quality of Life Score” (internal) is less emotionally resonant — “Menopause Score” is the right external hook.

**Where it’s weak for a 3-email nurture:**

1. **One-time payoff:** If Email 1 delivers “your score was 42/100” and a short interpretation, the **reason to open Email 2 and 3** must be something beyond the score — e.g. “how to improve it,” “what other women did,” “what to tell your doctor.”
2. **No clear mechanism:** “Lisa” and “Pattern Intelligence” appear in the current Segment 2/3 templates but the **lead-magnet sequence** (quiz → score by email → 3 emails) may not yet spell out *how* the score improves (tracking, patterns, doctor note). Without that, “Menopause Score” stays a label, not a mechanism.
3. **Weak CTA when there’s no app:** If the only CTA is “Open the app” or “Download” and the app isn’t live, opens don’t convert. You need a **bridge** CTA (e.g. “Save this for when the app launches,” “Get your full breakdown on web,” “Join the waitlist”).

**Recommendations:**

- **Email 1 (immediate):** Subject line that includes their **score number** and one short insight (e.g. “Your Menopause Score: 42 — and what it means”). Body: recap score, 2–3 bullet insights from their answers, **soft CTA**: “We’re building the app that uses this to track your patterns — want to be first to know when it’s ready?” (waitlist or “notify me”).
- **Email 2:** Don’t repeat the score. Offer **one pattern or tip** (e.g. “The sleep–brain fog connection most women miss”) so the value is new. CTA: same bridge (waitlist / notify / or “see your full breakdown on web”).
- **Email 3:** **Social proof** (“What women like you did next”) or **doctor angle** (“What to tell your doctor — and how to prepare”). CTA: again bridge to waitlist or web, not app download until links exist.

So: **“Menopause Score” is enough to get Email 1 opened** if the subject line is personalized (score + name). To get Email 2 and 3 opened, the **subject and preview need to promise new value** (pattern, story, doctor tip), not “your score” again.

### 2.2 Critique of Current Flow vs “Lead Magnet + Nurture”

- **Current implementation:** Quiz → **gate (email + sign-up)** → results on-page → set password → dashboard. The “lead magnet” is effectively **account creation** and **on-page score**, not “score delivered via email” only.
- **For a true lead-magnet funnel** (capture email → send score by email → 3-part nurture without requiring account): you’d want an optional path: “Just email my score” (no account) vs “Create account and see results now.” That would align with “quiz as top of funnel” and “nurture for those who don’t convert yet.”
- **Segment 2/3 in code** (e.g. `emailSequences.ts`) are built for **post-signup** (trial, expired, paid). The **quiz-only** 3-email sequence (no account) needs its own templates and triggers, with **bridge CTAs** until the app is live.

---

## 3. Gap Strategy — Post-Quiz “Results” / Thank You Page (No App Link)

**Goal:** Keep users engaged and reduce drop-off after they see their score, when there is **no direct App Store / Play Store link** yet.

### 3.1 Principles

- **Deliver on the promise:** They came for the score; show it clearly and explain it in plain language.
- **Give a next step that exists today:** Every CTA should work (e.g. email signup, waitlist, web dashboard, or “save/share”).
- **Reduce dead-end feeling:** Avoid “Come back when we have an app.” Use “You’re in — here’s what happens next.”
- **One primary CTA:** One clear action so 40+ and brain-fog users aren’t overwhelmed.

### 3.2 Wireframe Concept: Post-Quiz “Results” / Thank You Page

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] MenoLisa                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│     [Illustration: calm, “results” visual — same as now]      │
│                                                              │
│     [Headline - personal, severity-based]                     │
│     e.g. "Sarah, let's talk about what's really going on."   │
│                                                              │
│     [Short empathy line - 1–2 sentences from current copy]   │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  YOUR MENOPAUSE SCORE                                  │  │
│  │                                                        │  │  ← Score card (keep current design:
│  │    42  /100          [=====>    |    ]  Target: 80+   │  │     number, bar, target, 1-line label)
│  │                                                        │  │
│  │  "Below average — symptoms are significantly           │  │
│  │   impacting daily life."                               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│     [Symptom pills - your top issues, same as now]           │
│                                                              │
│  ─────────────────────────────────────────────────────────   │
│  WHAT HAPPENS NEXT (no app link)                              │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  • We've sent your full results and a short guide to         │
│    [email]. Check your inbox (and spam).                     │
│                                                              │
│  • Want to be first to try the app when it's ready?          │
│    [  Notify me when the app is ready  ]  ← primary CTA      │
│    (Stores email + "waitlist" flag; no app link)              │
│                                                              │
│  • In the meantime: create a free account to save this         │
│    result and see it on any device.                          │
│    [  Save my results to an account  ]  ← secondary CTA       │
│    (Current flow: set password → dashboard)                   │
│                                                              │
│  [Optional] "8,382 women joined this month" (social proof)   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Component Breakdown

| Block | Purpose |
|-------|--------|
| **Score card** | Same as current: number, /100, bar, target 80+, one-line label. No change to calculation or copy. |
| **Symptom pills** | Reinforce “we heard you”; builds validity of the score. |
| **“We’ve sent your full results to [email]”** | Confirms email delivery and sets expectation (check inbox). Reduces “did it work?” anxiety. |
| **Primary CTA: “Notify me when the app is ready”** | Works without any app link. Collects email + waitlist; you can use it for launch email and for segmenting “quiz + waitlist” in nurture. |
| **Secondary CTA: “Save my results to an account”** | For users ready to create account now; links into existing “set password → dashboard” flow. |
| **No “Download the app”** | Until you have store links, do not show a broken or “coming soon” app button. One primary (waitlist) + one secondary (account) is enough. |

### 3.4 Copy and UX Details

- **Headline:** Keep severity-based personal headline (e.g. “Sarah, I need to be honest with you” for moderate).
- **“What happens next”** section: Use a **numbered or bullet list** and **one primary button** (notify me). Secondary as text link or outline button so the hierarchy is clear.
- **Accessibility:** Same as quiz — minimum 48px tap height for “Notify me” and “Save my results,” and 16px+ body text where possible.
- **Mobile:** Stack vertically; primary CTA full-width, secondary below. No side-by-side buttons for small screens.

### 3.5 Backend / Data Needs (for “Notify me”)

- **Option A:** Same table as signups, with a `waitlist_only` or `notify_on_app_launch` flag when they click “Notify me” and already have an email (from gate).
- **Option B:** Separate `quiz_waitlist` table: email, name (if captured), quiz_answers (or score + top_problems), created_at. Use for launch email and for segmenting “did quiz, didn’t create account, wants app.”
- **Email:** Send “Your full results” email (with score + 2–3 bullets) from the same flow so the Thank You page claim (“We’ve sent your full results”) is true.

### 3.6 Summary: Friction Reduction

- **No dead end:** Two clear paths (waitlist, or account).
- **Promise kept:** Score on page + “full results in your email.”
- **One primary CTA:** “Notify me when the app is ready” fits the constraint and keeps users in the funnel for launch.
- **Optional account path:** “Save my results to an account” reuses current flow and prepares them for future app (same account can later log in on app).

---

## 4. Summary Table

| Deliverable | Finding |
|-------------|--------|
| **UX/UI audit** | Fix small touch targets (48px min), add explicit progress (e.g. “Question 3 of 9”), clarify multi-select, slightly larger type. Keep one-question-per-screen and breather. |
| **Marketing** | “Menopause Score” is a strong hook for Email 1 if subject includes score + name. For Email 2–3, subject lines must promise **new value** (pattern, story, doctor tip). Add bridge CTAs (waitlist / notify) until app is live. |
| **Gap strategy** | Post-quiz Results/Thank You: show score + “We’ve sent full results to [email].” Primary CTA: “Notify me when the app is ready.” Secondary: “Save my results to an account.” No App Store link until ready. |

If you want, next step can be: (1) concrete copy for the Thank You page and “Notify me” CTA, (2) schema/API for waitlist, or (3) subject-line variants for the 3-email nurture sequence.
