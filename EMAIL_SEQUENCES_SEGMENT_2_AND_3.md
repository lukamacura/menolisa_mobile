# Detailed Email Sequences: Segment 2 (Trial / Not Paid) & Segment 3 (Paid)

Generated with the **marketing-expert** lens: direct response funnel, awareness-level copy, unique mechanism (Pattern Intelligence), warm companion voice, and yoru existing strategy (messaging hierarchy, trial day sequence, pricing, referral).

**Data source:** Supabase only. No new tables.  
- **Segment 2:** `auth.users` + `user_profiles` + `user_trials` where `account_status != 'paid'`.  
- **Segment 3:** `user_trials.account_status = 'paid'` + `auth.users` + `user_profiles`.

**Suppression:** Before every send, exclude anyone with `user_trials.account_status = 'paid'` from Segment 2 sequences. Never send trial/conversion emails to Segment 3.

---

# SEGMENT 2: Registered, Not Paid (Trial or Expired)

**Who:** User has an account, has quiz data in `user_profiles`, and is either on trial or trial has expired (not paid).  
**Goal:** Activate usage, deliver the “wow” (Pattern Intelligence by Day 2), convert to paid before or at paywall; if expired, win back with one strong offer.

**Personalization fields from Supabase:**  
`user_profiles.name` (first name), `user_profiles.top_problems` (symptoms), `user_profiles.severity`, `user_profiles.goal`, `user_trials.trial_start`, `user_trials.trial_end`, `user_trials.account_status`.

---

## Segment 2 – Track A: Welcome & Trial (0–3 days)

Trigger: User has `user_profiles` and `user_trials` with `account_status = 'trial'`.  
Send relative to `user_trials.trial_start` (or `auth.users.created_at` if trial_start is null).

---

### Email 2A1 – Welcome (Day 0, within 1 hour of trial_start)

**Goal:** Confirm they’re in the right place, reinforce “someone gets it,” and drive first session (open app, talk to Lisa, log one symptom).

**Subject (pick one or A/B test):**  
- “{{name}}, Lisa’s ready for you”  
- “Your 3 days with Lisa start now”

**Preview:** “Here’s how to get the most out of the next 3 days.”

**Opening (personalized):**  
“Hi {{name}}, you’re in. Lisa has what you shared from your quiz—including [reference 1–2 top_problems if available]. She’s not a bot and she’s not a textbook; she’s built to get what you’re going through.”

**Body angles:**  
- One line on why 3 days: “We kept the trial short so you get to the good part fast—Lisa spotting patterns in your symptoms.”  
- What to do in the first 24 hours: open the app, say hi to Lisa, log how you feel today (even one symptom).  
- “The more you share in the next couple of days, the sooner she can say ‘here’s what I’m noticing.’ That moment is what most women tell us changes how they see their symptoms.”

**CTA:**  
- Primary: “Open the app and say hi to Lisa” (link to app / dashboard).  
- Secondary: “Log one symptom today.”

**Tone:** Warm, direct, “finally someone gets it.” No jargon.

---

### Email 2A2 – Day 1 reminder (24 hours after trial_start)

**Goal:** Reinforce “log so Lisa can learn”; set expectation that an insight is coming.

**Subject:**  
- “How was your day? Lisa can use it.”  
- “One quick log today = smarter insights tomorrow”

**Opening:**  
“{{name}}, if you haven’t already—log how you felt today (even one symptom). Lisa uses that to start connecting the dots. By day 2 she often has a first ‘here’s what I’m noticing’ for you.”

**Body:**  
- Short: “We built Lisa to get smarter with every log. No long forms—just tell her what’s going on. She’ll start spotting patterns your doctor doesn’t have time to find.”

**CTA:** “Log today’s symptoms” (app / dashboard).

---

### Email 2A3 – Day 2 – Pattern Intelligence tease (48 hours after trial_start)

**Goal:** This is the conversion moment. Push them to open the app to see “What Lisa Noticed” and introduce the doctor note.

**Subject:**  
- “Lisa noticed something about your symptoms”  
- “{{name}}, check the app—Lisa has an update for you”

**Opening:**  
“{{name}}, if you’ve logged a few times, Lisa may already have a first insight for you. Open the app and look for ‘What Lisa Noticed’—that’s her starting to connect the dots in your data. She can also start a summary you can bring to your doctor.”

**Body:**  
- “That moment—when you see a pattern you didn’t know was there—is what we built MenoLisa for. It’s not just tracking; it’s Pattern Intelligence. And it gets better the longer you use it.”

**CTA:** “See what Lisa noticed” (app). No paywall push yet; value first.

---

### Email 2A4 – Day 3 – Trial ends today (morning of trial_end, or ~72 hours after trial_start)

**Goal:** Gentle urgency. Remind that access ends; reinforce value and next step (subscribe). Warm, not aggressive.

**Subject:**  
- “Your free access ends tonight—here’s what happens next”  
- “{{name}}, Lisa’s just getting started with your patterns”

**Opening:**  
“{{name}}, your 3-day free access ends tonight. Lisa’s only beginning to learn your patterns—by week 2 she usually finds 3–5 connections most women miss. If you’re finding this useful, you can keep going for less than a copay a month.”

**Body:**  
- One line on price: “$12/month or $79/year. No lock-in.”  
- “Staying with Lisa means she keeps connecting the dots and you keep a summary ready for your doctor when you need it.”

**CTA:** “Continue with Lisa” (link to web dashboard / subscription).  
**Secondary:** “Not now? You can resubscribe anytime from the app or menolisa.com.”

---

## Segment 2 – Track B: Trial Expired, Not Paid (Win-back)

Trigger: `user_trials.account_status = 'expired'` (or trial_end &lt; now and account_status != 'paid').  
Send only to users who have not converted to paid. Cap: e.g. 2–3 emails over 14 days, then stop unless you add a longer “drip later” sequence.

---

### Email 2B1 – Win-back 1 (Day 0 after expiry, or next run after you detect expired)

**Goal:** Acknowledge they left, remind one concrete benefit, offer a reason to come back (e.g. extended trial or discount if you support it).

**Subject:**  
- “We miss you, {{name}}”  
- “Your patterns are still here—Lisa can pick up where you left off”

**Opening:**  
“{{name}}, your trial ended and we get it—life gets busy. If you ever felt like ‘finally, someone gets it’ when you talked to Lisa, that doesn’t have to be a one-time thing. She’s the menopause companion who’s there 24/7 and never dismisses what you’re feeling.”

**Body:**  
- One benefit: “Pattern Intelligence only gets better with more data. Come back and she’ll keep connecting the dots and building a note for your doctor.”  
- Optional: “As someone who started with us, you can [extended trial / one-time discount] if you’d like to try again.” (Only if you implement that offer.)

**CTA:** “Open MenoLisa” or “Manage subscription” (dashboard).

---

### Email 2B2 – Win-back 2 (e.g. 5–7 days after 2B1, if still not paid)

**Goal:** One more emotional + practical nudge. Doctor note angle or “patterns your doctor doesn’t have time to find.”

**Subject:**  
- “What to tell your doctor—and how Lisa helps”  
- “{{name}}, one thing that might change your next appointment”

**Opening:**  
“{{name}}, if you’ve ever left a doctor’s office feeling unheard, you’re not alone. Lisa builds a summary from your symptoms and patterns so you can bring something concrete: ‘Here’s what’s been going on.’ It’s one way we help you feel prepared instead of dismissed.”

**Body:**  
- Short story angle (if your aunt is the face): “We built this because [Aunt] was tired of ‘it’s just part of aging.’ Lisa is the companion she wished she’d had from day one.”  
- One CTA thought: “You can pick up your trial anytime and keep building that summary.”

**CTA:** “Continue with Lisa” (dashboard).

---

### Email 2B3 – Win-back 3 (e.g. 7–10 days after 2B2, if still not paid)

**Goal:** Last clear CTA. No guilt; leave the door open.

**Subject:**  
- “Whenever you’re ready, Lisa’s here”  
- “{{name}}, one last note from us”

**Opening:**  
“{{name}}, we’re not going to fill your inbox. Just one more note: if you ever want to come back to tracking your patterns with Lisa, we’re here. $12/month, cancel anytime. Your data is still yours.”

**Body:**  
- One line: “Lisa is the menopause companion who gets what you’re going through—available 24/7. When you’re ready, we’d love to have you back.”

**CTA:** “Open MenoLisa” or “Manage subscription” (dashboard).  
Then suppress from this win-back track (or move to a very low-frequency “we’re here” drip if you ever add it).

---

# SEGMENT 3: Paid After Trial

**Who:** `user_trials.account_status = 'paid'`.  
**Goal:** Retain, deepen usage (Pattern Intelligence, doctor note), build habit, ask for referrals. No conversion ask.

**Personalization:** Same as above: `user_profiles.name`, `user_profiles.top_problems`, etc. Optional: `user_trials.subscription_ends_at` for renewal timing.

---

### Email 3-1 – Thank you / confirmation (within 24 hours of first paid status)

**Goal:** Confirm the value of their decision; reinforce identity (“you’re someone who takes this seriously”).

**Subject:**  
- “You’re in—thank you, {{name}}"  
- “Lisa’s got you for as long as you want”

**Opening:**  
“{{name}}, thank you for staying with Lisa. You’re not just tracking symptoms—you’re giving yourself a companion who actually learns your patterns and helps you show up prepared for your doctor. That matters.”

**Body:**  
- One line on what to expect: “Over the next weeks you’ll see more ‘What Lisa Noticed’ as she connects the dots. Use the doctor note whenever you have an appointment.”  
- Optional: “If you ever have a question, just ask Lisa or reply to this email.”

**CTA:** “Open the app” (optional). No payment CTA.

---

### Email 3-2 – Getting more from Lisa (e.g. 5–7 days after paid)

**Goal:** Increase perceived value; reduce early churn by surfacing underused features.

**Subject:**  
- “3 ways to get more from Lisa”  
- “{{name}}, are you using Lisa’s doctor note?”

**Opening:**  
“{{name}}, now that you’re a few days in, here are three things that make the biggest difference: (1) Log when something shifts—even briefly. (2) Check ‘What Lisa Noticed’ regularly. (3) Ask Lisa to build a summary before a doctor visit—bring it with you.”

**Body:**  
- One sentence on Pattern Intelligence: “The more you log, the more she spots—things like triggers and timing that are easy to miss on your own.”

**CTA:** “Open MenoLisa” (optional).

---

### Email 3-3 – Referral (e.g. 14–21 days after paid, or after 2nd successful charge if you bill monthly)

**Goal:** Ask for one referral. Clear offer: friend gets 7-day trial, referrer gets 50% off next month (per your strategy).

**Subject:**  
- “Give a friend 7 days with Lisa—get 50% off your next month”  
- “{{name}}, share Lisa with someone who gets it”

**Opening:**  
“{{name}}, if you know someone who’s going through menopause and could use a companion who actually gets it—share Lisa. They get a 7-day free trial. You get 50% off your next month when they sign up with your link.”

**Body:**  
- One line on why it matters: “So many women feel alone in this. You’re not. And neither does she have to be.”  
- Clear mechanics: “Send them your link from the app (Settings → Invite friends). When they start their trial, you’ll get your discount.”

**CTA:** “Get your invite link” (app or dashboard referral page).

---

### Email 3-4 – Check-in / value reinforcement (e.g. 30 days after paid, or monthly)

**Goal:** Light touch retention; remind them why they stayed. No ask except “we’re here.”

**Subject:**  
- “{{name}}, how’s it going with Lisa?”  
- “A quick check-in from MenoLisa”

**Opening:**  
“{{name}}, just checking in. We hope Lisa’s been helpful—spotting patterns, keeping your doctor summary up to date, and being there when you need to talk it through. If there’s anything we can do better, reply to this email.”

**Body:**  
- One line: “You’re part of a community of women who decided they deserved more than ‘it’s just menopause.’ Thank you for being here.”

**CTA:** Optional “Open the app.” No payment, no referral ask unless you want a soft reminder.

---

### Email 3-5 (Optional) – Before renewal (if you have subscription_ends_at)

**Goal:** Reduce surprise churn; remind them of value before card is charged. Only if you can trigger off `subscription_ends_at` (e.g. 3–5 days before).

**Subject:**  
- “Your subscription renews soon—here’s what you have with Lisa”  
- “{{name}}, a quick reminder before we renew”

**Opening:**  
“{{name}}, your MenoLisa subscription will renew on [date]. You’ll keep full access to Lisa, Pattern Intelligence, and your doctor note. If you want to change or cancel, you can do it anytime from the link in your dashboard.”

**Body:**  
- One line: “Thanks for staying with us. We’re glad you’re here.”

**CTA:** “Manage subscription” (dashboard). No guilt; just clarity.

---

# Implementation Checklist (n8n)

**Segment 2**  
- Query: users with `user_profiles` and `user_trials` where `account_status IN ('trial','expired')`.  
- Compute days since `trial_start` or since `trial_end` for expired.  
- Branch: trial (0–3 days) → Track A; expired → Track B.  
- Send 2A1–2A4 and 2B1–2B3 on schedule; suppress if `account_status` becomes `paid`.

**Segment 3**  
- Query: `user_trials` where `account_status = 'paid'`; join `auth.users` + `user_profiles`.  
- Trigger 3-1 when user first appears as paid (or on webhook from Stripe).  
- Schedule 3-2, 3-3, 3-4 (and optional 3-5) by days since first paid or by calendar.  
- Never send Segment 2 emails to these users.

**Personalization:**  
- Use `user_profiles.name` (or first word) for {{name}}.  
- Use `user_profiles.top_problems` for symptom references where it fits.  
- Use `user_trials.trial_end` / `subscription_ends_at` for time-based copy and triggers.

This gives you two segments, no new tables, and full detail for each email so you can implement the sequences in n8n and plug in your own sending tool (Resend, SendGrid, etc.).
