# Symptoms UX — Where to display and set (mobile)

**Audience:** Women 40+ in perimenopause and menopause.  
**Goals:** Easy to use, smooth, clear where to log and see symptoms.

---

## Where symptoms are DISPLAYED

| Place | What’s shown |
|-------|----------------|
| **Home (Dashboard)** | “Today’s symptoms” card: count of symptoms logged today (or “No symptoms logged yet”). Tapping the card goes to the Symptoms screen. |
| **Symptoms screen** | Banner: “You’ve logged X symptoms today” (or “Log how you’re feeling”). Full list of symptoms; tap one to log severity + notes. |
| **Chat** | AI can log symptoms via the `log_symptom` tool; user sees “Symptom logged” in the thread. |

Symptoms are **not** shown in Notifications or Settings; they stay in Home → Symptoms and on the Dashboard summary.

---

## Where symptoms are SET (logged) / configured

| Action | Where |
|--------|--------|
| **Log a symptom** (severity + notes) | **Symptoms screen** (tap a symptom → modal). Also from **Dashboard** via “Log symptom” or “View all & track” (both open Symptoms). **Chat**: user can say “I had a hot flash” and the AI logs it. |
| **Choose which symptoms to track** | **Onboarding (Register)** — user picks “top problems.” Optional future: “Manage my symptoms” in Settings or on Symptoms screen to add/remove from the list (would need API support). |
| **Symptom definitions** | Managed on the **web app**; mobile shows the list from the API. |

---

## Flow summary

1. **Quick check:** User opens app → Home shows “Today’s symptoms” and “Log symptom.”
2. **Log:** User taps “Log symptom” or the summary card → Symptoms → tap symptom → choose severity (Mild/Moderate/Severe) + optional notes → Save.
3. **Review:** Same Symptoms screen shows “You’ve logged X today” and the full list.

Touch targets use at least 44pt height where possible for 40+ usability.
