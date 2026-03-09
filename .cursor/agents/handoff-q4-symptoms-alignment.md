# Handoff: Question 4 (Symptoms) — Bad Option Alignment

**From:** Product / UX  
**To:** [ui-designer](ui-designer.md)  
**Context:** Web app quiz (Next.js), not mobile. Apply the same layout and accessibility principles; implementation is in the **web app** codebase.

---

## Problem

**Question 4** (“What’s making life hardest right now?”) shows 8 symptom options with **bad alignment**. Each option is: [symptom image or icon] + [label] + [check when selected]. Users (especially 40+, low tech, brain fog) need clear, consistent alignment so rows are easy to scan and tap.

---

## Where to fix

- **App:** Web app (Next.js, Tailwind CSS)
- **File:** `applications/web app/app/register/page.tsx`
- **Block:** Search for `{/* Q4: Symptoms */}` — the `currentStep === "q4_symptoms"` block (around lines 1640–1706).

---

## Current structure (simplified)

- Single-column grid: `grid grid-cols-1 gap-3`.
- Each option is a `<button>` with `min-h-[48px]`, inner `flex items-center gap-2`.
- Left: either a **symptom image** (`w-10 h-10 sm:w-12 sm:h-12` in a rounded box) or an **icon** (OptionIcon).
- Center: **label** (`span` with `flex-1`, `text-sm sm:text-base`).
- Right: **Check** icon when selected.

Alignment issues may come from:

- Icon/image container not having a fixed size or flex alignment, so baselines differ.
- Image `object-contain` leaving different effective heights per row.
- Label wrapping (long text) making row heights uneven and breaking vertical alignment.
- Check icon not aligned to the vertical center of the row.

---

## Requirements (from funnel audit)

- **Touch targets:** Keep minimum 48px height for each option (already present).
- **Clarity:** Icon/image and text must be consistently aligned (e.g. center-aligned on a single baseline).
- **Simplicity:** One clear, scannable list; no cramped or misaligned rows.
- **Consistency:** Match the alignment pattern used in other quiz steps (e.g. Q1, Q2, Q3) where only icons + text are used, so Q4 doesn’t feel like an exception.

---

## Suggested direction

1. Give the **left icon/image** a fixed-size container (e.g. same width and height for all options) and center the image/icon inside it so every row has the same visual anchor.
2. Use a single **flex row** per option with `items-center` and fixed or min dimensions for the icon column so the text and check align on one line (or wrap predictably).
3. If labels wrap, ensure **multi-line labels** don’t push the check icon or break vertical alignment; consider `items-center` and `min-h-[48px]` on the button so the check stays right-aligned and vertically centered.
4. Keep **spacing** consistent with other steps (e.g. `gap-3` between options, internal `gap-2` between icon and text).

---

## Out of scope for this handoff

- Changing copy or adding/removing options.
- Changing behavior (multi-select, validation).
- Mobile app (Expo) implementation — this fix is for the **web** register page only.

Once the layout is updated, please ensure the same file still works for small viewports (e.g. narrow mobile) and that touch targets remain at least 48px tall.
