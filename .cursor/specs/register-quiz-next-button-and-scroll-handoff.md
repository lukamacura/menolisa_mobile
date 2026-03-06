# RegisterScreen quiz: Next button always reachable + scrolling

**For:** ui-designer  
**File:** `src/screens/RegisterScreen.tsx`  
**Context:** User could not tap the Next button on step 4 ("What's making life hardest right now?") when options were selected, because content exceeded the screen and the footer was off-screen. Request: ensure Next is always clickable; if content cannot fit, enable scrolling.

---

## What was implemented (fix in place)

1. **Quiz phase uses exact device height**  
   The quiz container uses `height: windowHeight` (from `useWindowDimensions()`) so the layout never exceeds one screen height.

2. **Quiz content is scrollable**  
   The question card (illustration + title + options) is inside a **ScrollView** that:
   - Has `flex: 1` and `minHeight: 0` so it takes only the space above the footer.
   - Uses `contentContainerStyle` with `flexGrow: 1` and bottom padding so content can grow and scroll.

3. **Footer is fixed**  
   The footer (step indicators + Back/Next) is a **sibling** of the ScrollView, not inside it, so it stays at the bottom of the screen and is always visible and tappable.

4. **Options list**  
   Each step’s options remain in their own inner ScrollView (optionsScrollWrap) so long lists scroll within the card. The **outer** ScrollView now scrolls the whole card (including illustration, title, and options) when needed, so the user can scroll down to reach the Next button.

---

## Acceptance criteria (for ui-designer verification)

- [ ] On step 4 ("What's making life hardest right now?") and any step with many options, the user can select options and then **scroll down** to see and tap the Next button.
- [ ] The Next and Back buttons are **always visible** at the bottom of the screen (never scrolled away).
- [ ] Total quiz layout height does not exceed device height; overflow is handled by scrolling the quiz content.
- [ ] All styles use `src/theme/tokens.ts`; no hardcoded values.

---

## If issues remain

- If the footer is still cut off on very small devices: ensure the root quiz container uses `height: windowHeight` (or equivalent) and the footer has no `flex` so it keeps its natural height.
- If scrolling feels wrong: ensure only the **quiz content** (question card) scrolls, not the footer, and that `keyboardShouldPersistTaps="handled"` is set so taps on options/buttons work while the keyboard is open.
