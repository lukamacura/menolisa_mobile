# Register Page & Paywall Recommendations

Based on the **marketing-expert** lens (direct response, funnel architecture, offer-first) and your **marketing_strategy.md**, here are focused recommendations for the web register page (top of funnel) and for mobile paywalls / trial timing.

---

## Part 1: Web Register Page (`/register`) — Top of Funnel

Your strategy says the quiz is the **#1 marketing asset** and that "every marketing channel drives here." The register page already implements quiz → email gate → results → account. Below are changes that align it with the strategy and maximize quiz completion and email capture.

### 1. **Add a Quiz Entry Headline (Above the First Question)**

**Strategy:** "Headline: What's Your Menopause Score? Take the Free 2-Minute Assessment."

**Current state:** The page jumps straight into "What's your age or life stage?" with only step dots above.

**Recommendation:** When `phase === "quiz"` and `stepIndex === 0`, show a short hero section above the step indicators:

- **Headline:** "What's Your Menopause Score?"
- **Subline:** "Take the free 2-minute assessment. No download required."
- Then the progress dots and Q1.

This matches the strategy’s curiosity-driven, low-commitment positioning and sets the "free assessment" frame before any questions.

### 2. **Gate Phase — Sharpen the Copy**

**Strategy:** "Your personalized Menopause Quality of Life Score is ready. Enter your email to see your results."

**Current:** "Your results are ready" + "We've prepared your personalized score and plan…"

**Recommendation:** Use the strategy’s exact line for the headline and keep the rest concise:

- **Headline:** "Your personalized Menopause Quality of Life Score is ready."
- **Subline:** "Enter your email to see your results—we’ll save them so you can come back anytime."
- Keep the CTA: "Show my results" (or "See my results").

This increases perceived value and clarity at the single highest-friction step (email gate).

### 3. **Breather Step — Add Validation**

**Strategy:** After the breather step, add: "You're not imagining this. Let's see what your experience tells us."

**Recommendation:** Add that sentence to the breather step (e.g. after "Take a breath, then we'll ask a couple more quick questions."). It reinforces the "finally, someone gets it" feeling and supports completion.

### 4. **Results Page — Messaging Hierarchy & CTA**

**Strategy:**  
- Primary message: "Lisa is the menopause companion who understands what you're going through—available 24/7, never dismisses you."  
- Results CTA: "Want Lisa to track your patterns and help you make sense of what's happening? Download the app—your profile is already started."

**Current:** Results show score, severity copy, symptom pills, social proof ("8,382 women joined this month"), then "Set my password & continue."

**Recommendations:**

- **Add one line of primary messaging** above or below the score card: e.g. "Lisa is the menopause companion who gets what you're going through—available 24/7, never dismisses you."
- **Results CTA:** Your flow goes to web dashboard, not "download the app." Choose one:
  - **If web is primary:** Keep "Set my password & continue" but add a line like: "Lisa will use your answers to personalize your experience and start spotting patterns."
  - **If app is primary:** Add a secondary CTA or link: "Prefer the app? Your profile is already started—download MenoLisa on iOS/Android."
- **Social proof:** Keep "X women joined this month" but consider A/B testing "X women took the assessment this month" for quiz-specific relevance. Replace with a real testimonial as soon as you have one (strategy: "Testimonials as soon as you have them").

### 5. **Email Phase (Create Account) — Already Strong**

- "No credit card required" and "Start my free trial" are good.  
- Optional: Add one short line under the CTA: "Lisa is ready to listen—and start connecting the dots in your symptoms."

### 6. **Optional: Dedicated `/quiz` Route**

**Strategy:** "A dedicated landing page at menolisa.com/quiz (or similar). All social content, group posts, and eventually paid ads drive here."

**Current:** All traffic goes to `/register`, which is the full quiz + gate + results + signup.

**Recommendation:** Either:

- **Redirect:** `/quiz` → `/register` (same experience, cleaner URL for ads and posts), or  
- **Same page, two URLs:** Serve the same `RegisterPage` component for both `/quiz` and `/register` so "Take the quiz" links can use `/quiz` and "Sign up" can use `/register`.

No change to logic—just routing and which URL you use in marketing.

### 7. **Metrics to Watch (From Strategy)**

- **Quiz completion rate:** Target >60%. If it drops, shorten or simplify steps; improve step copy and progress indicator (you already have dots).  
- **Email capture rate (at gate):** Target >40% of completers. Test the new gate headline and a single, clear CTA.  
- **Quiz → next step (results view then account):** Strategy says "Quiz → App download >15%"; for you, define "next step" as either "saw results" or "created account" and track that.

---

## Part 2: Paywalls in Mobile App & Timing (Trial → Paid)

**Short answer:** Yes, you should build a **single, clear paywall in the mobile app** at **the end of the 3-day trial**. Use **soft reminders** (push + in-app) on Day 3 so the paywall isn’t a surprise. Do **not** add mid-trial feature walls; keep full access during the trial so Lisa can deliver the "wow" moment by Day 2.

### Why One Paywall at Trial End

Your strategy is explicit:

- "Web-only billing maintained; **trial experience engineered to maximize conversion before paywall**."
- "The 3-day trial is short… every hour of the trial must be engineered. There is **zero room for a passive onboarding**. **Lisa must deliver her 'wow' moment by Day 2 at the latest**."

So:

- **During trial:** Full app access (Lisa chat, symptom tracking, Pattern Intelligence, doctor notes). No message limits or feature locks. Goal: activation + first "What Lisa Noticed" by Day 2.
- **After trial:** One paywall. When the user hits it, show the warm, benefit-focused paywall copy from the strategy (see below).

### Perfect Timing by Trial Day

| Trial day | Goal | Paywall / walls |
|-----------|------|------------------|
| **Day 1 (0–6h)** | Immediate activation; first symptom log; Lisa references quiz + one quick observation. | No paywall. Optional: soft in-app tip like "Your 3-day trial has started—explore everything." |
| **Day 2** | **Conversion event:** First "What Lisa Noticed" insight; intro to doctor note. | No paywall. Push: "Lisa noticed something about your symptoms. Open the app to see." |
| **Day 3 (Conversion day)** | Remind that access ends; show paywall when they open the app after trial end. | **Morning push:** "Your free access ends tonight. Lisa has started learning your patterns—keep the insights coming." **When trial has ended:** Show paywall on next app open (or when they try to send a message / view an insight). |

### Paywall Copy (From Strategy)

Use this tone (warm, not aggressive):

- **Headline (concept):** "I'm just getting to know your body's patterns. Stay with me and I'll keep connecting the dots."
- **Preview of value:** "By Week 2, Lisa typically identifies 3–5 patterns most women miss."
- **CTA:** Clear subscribe button (e.g. "Continue with Lisa — $12/month or $79/year"). Optional: "No thanks" or "Remind me later" (with a gentle reminder flow).

### Should You Add Other "Walls" During Trial?

- **No** to: Limiting Lisa messages per day, locking "What Lisa Noticed" after the first one, or gating doctor notes during trial. That would undercut the Day 2 conversion event and the value equation.
- **Yes** to:  
  - **One hard paywall** at trial expiry (block or limit core actions until they subscribe or extend).  
  - **Soft reminders** on Day 3 (push + in-app banner) so the paywall feels expected, not abrupt.

### Summary: What to Build in Mobile

1. **Trial state and expiry:** Store trial start (or end) per user; compute "trial ended" reliably (including web-signup → app first open).
2. **Paywall screen:** Shown when a post-trial user tries to use a core feature (e.g. open chat, view "What Lisa Noticed", or open app after expiry). Use the warm copy above; link to web billing if you keep billing web-only.
3. **Day 3 push:** "Your free access ends tonight. Lisa has started learning your patterns—keep the insights coming."
4. **Day 3 in-app:** Optional banner: "Your free access ends tonight" with "Subscribe" and "Dismiss."
5. **No** mid-trial feature gates or message caps.

This keeps the trial focused on value and conversion, and uses one well-timed paywall to maximize trial → paid without hurting activation or the Day 2 moment.
