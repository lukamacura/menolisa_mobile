# Menolisa — Claude Code Project Context

## What This Project Is
MenoLisa is an AI health companion app for women navigating perimenopause and menopause. It combines a conversational chat interface (AI-powered by the Menolisa persona) with symptom tracking and personalized insights.

## Tech Stack
- **Framework**: Expo ~54 (React Native, New Architecture enabled)
- **Language**: TypeScript (strict)
- **Navigation**: React Navigation v7 — bottom tabs + native stacks
- **Auth/DB**: Supabase (auth + PostgreSQL)
- **Backend**: the **Next.js app in `../menolisa_web`** serves every `/api/*` route this
  app calls, authenticated with a `Bearer` token. There are no Supabase Edge Functions.
- **Fonts**: Poppins (body/UI) + Nunito (display/headings)
- **Package manager**: npm

## Project Structure
```
src/
  screens/         # All screens organized by tab
    today/         # DailyLoop hub + Movement, Nutrition, Relaxation, Habits
    symptoms/      # Symptoms (log), SymptomLogs (history)
    rewards/       # RewardsScreen
    chat/          # ChatList, ChatThread
    settings/      # Settings, NotificationPrefs
    notifications/ # NotificationsScreen
    LandingScreen, LoginScreen, AccountNotFoundScreen, SubscriptionRequiredScreen
  components/      # Shared UI components
  navigation/      # AppNavigator, MainTabs, types.ts
  theme/           # tokens.ts — single source of truth for colors, spacing, radii, typography
  lib/             # supabase.ts, api.ts, accountStatus.ts, logger.ts, symptomTrackerConstants.ts
  hooks/           # Custom React hooks
  context/         # AuthContext, RefetchTrialContext
```

## Navigation Structure
```
RootStack  (AppNavigator picks one branch — see Access control below)
├── Auth Stack: Landing → Login → AccountNotFound     (no session)
├── SubscriptionRequired                              (session, no access)
└── MainTabs                                          (session + access)
    ├── TodayTab: DailyLoop → Movement | Nutrition | Relaxation | Habits
    │                       → Rewards
    │                       → Symptoms → SymptomLogs
    ├── ChatTab: ChatList → ChatThread (sessionId)
    ├── NotificationsTab: Notifications
    └── SettingsTab: Settings → NotificationPrefs
```

There is no Home tab. `DailyLoopScreen` is the app's front door: the four plan
pillars, then symptom tracking below them under its own "Tracking" rule. The
separation is deliberate — the plan is what she was asked to do today, tracking
is what her body did to her, and a bad day must never render as a missed task.
`DailyLoopScreen` also carries the access paywall (`AccessEndedView` for
`expired` and `canceling`-ending-soon), which used to live on the Dashboard.

Registration happens **on the web** (`/register` on menolisa.com), not in the app —
the funnel collects the card before an account is worth anything. `LandingScreen`
and `AccountNotFoundScreen` both open it in the browser.

## Design Tokens
All design values live in `src/theme/tokens.ts`. Always import from there — never hardcode.

- **Primary color**: `#ff8da1` (soft coral/salmon)
- **Navy**: `#1D3557`
- **Background**: `#FFFFFF`
- **Text**: `#1F2937`, muted: `#6B7280`
- **Landing gradient**: `['#FDF8F9', '#F9F2F4', '#F5EDF0']`
- **Fonts**: Poppins (body/UI), Nunito (display). Use `typography.presets` in `tokens.ts` for use-case-based styling:
  - **Paragraphs**: `presets.body`, `presets.bodySmall`, `presets.bodyMedium`
  - **Headings**: `presets.heading1` (hero), `presets.heading2` (screen/section), `presets.heading3` (card title)
  - **Buttons**: `presets.button`, `presets.buttonSmall` (sentence case; no uppercase)
  - **Labels/captions**: `presets.label`, `presets.caption`

## Backend Architecture
- **Server-side logic**: the Next.js app in `../menolisa_web` (`app/api/*`). Its
  `docs/mobile-app-changes.md` is the API contract — read it before touching anything
  that talks to the backend.
- **API calls**: `src/lib/api.ts` — `apiFetchWithAuth` attaches the Supabase access
  token as a Bearer header and throws `ApiError` carrying the HTTP status.
- **Auth**: Supabase Auth with JWT; all user data scoped by `user_id`
- **AI**: `/api/langchain-rag` on the web app, never from the client directly

### Plans renew — there is no week 9
The plan is an 8-week **cycle**, not a one-off. 56 days after `startedAt`, the
first `GET /api/plan` of that day scores what she actually did, hands those
percentages to the LLM, and writes her the next cycle. `cycle` arrives on both
the `ready` and `generating` states and is carried by `PlanContext`.

- **Old cycles are never deleted.** `GET /api/plan/history?cycle=<n>` reads any
  of them; `history.cycles` lists them for the switcher on `ProgressScreen`.
- **Never render a reset to week 1 without `PlanRecapScreen` in front of it.**
  A plan that silently starts over reads as a bug; the recap is what makes it
  read as earned. `usePlanCycleRecap()` owns the show-once marker.
- The adherence numbers are for sizing the next plan only — **they are banned
  from every title, focus and `why`.** She is not shown a report card.

Three days before the card is charged, `PlanContinueScreen` shows her what she
did and why not to stop — once per renewal, never to someone who has cancelled.
It names the renewal date and links to billing on purpose: a "don't stop" screen
that hides the charge is a dark pattern. `usePlanRenewalPrompt()` owns the
marker; `useSeenMarker` is the shared store both once-only screens sit on.

Her first name comes from `first_name` on `GET /api/account/status` and is
often null — never write a sentence that breaks without it.

See `docs/mobile-app-changes.md` §12-13 in `../menolisa_web` for the contract.

### Access control — read this before adding a paid feature
`GET /api/account/status` is the **single source of truth** for whether the user has
access. `AuthContext` fetches it, `AppNavigator` gates on its `has_access`, and
`useTrialStatus()` is a thin adapter over it for UI.

- **Never re-derive access from a direct `user_trials` query.** The client cannot see
  disputes, dunning, or the fail-closed rules. It was done once, for the long-dropped
  `trial_start`/`trial_end`/`trial_days` columns, and after they were dropped the whole
  select failed (Postgres 42703) — every paying subscriber was told her trial ended today.
- **There is no free trial.** One plan, $59 / 8 weeks, charged at checkout. `state` is
  `active | canceling | past_due | ended | disputed`; the first three keep access, and
  `canceling` keeps it until `ends_at`. Never write trial copy into the UI.
- **A `403` from any `/api/*` route means "no subscription" — route to the paywall,
  never an error toast.** Match on the status via `isSubscriptionRequiredError(err)`;
  the message text is not stable.

## Agents
Use specialized agents for domain-specific work:
- **product-lead** — Feature specs, Menolisa's personality, response patterns, UX decisions
- **ui-designer** — React Native components, screens, Figma designs → code
- **backend-lead** — Supabase schemas, Edge Functions, OpenAI integration, API contracts

**Correct order**: product-lead → ui-designer → backend-lead

## Code Conventions
- Functional components with hooks only (no class components)
- Named exports for components; default exports for screens
- StyleSheet.create for all styles — no inline style objects
- All colors/spacing/radii/typography from `src/theme/tokens.ts`; prefer `typography.presets` for text (body, heading1, button, etc.)
- Buttons: sentence case only (no uppercase)
- Screen files named `[Name]Screen.tsx`; component files named `[Name].tsx`
- No hardcoded strings — prepare for i18n
- **Never use 8-digit hex colors** (e.g. `#RRGGBBAA` or `colors.primary + '33'`) — Android does not support them and renders them gray/transparent. Always use `rgba(r, g, b, a)` for semi-transparent colors.

## Platform Gotchas — Read Before Every Edit

### Android
- **No 8-digit hex** (`#RRGGBBAA` or `colors.primary + '33'`) — renders gray/transparent. Always use `rgba(r, g, b, a)`.
- Shadows use `elevation`, not `shadowColor/shadowOffset`. Use both for cross-platform.
- `KeyboardAvoidingView behavior="height"` on Android.
- Edge-to-edge is enabled in app.json — handle `StatusBar` and bottom insets explicitly.

### iOS
- Always wrap root content in `SafeAreaView` or use `useSafeAreaInsets()`.
- `KeyboardAvoidingView behavior="padding"` on iOS.
- `overflow: 'hidden'` required for `borderRadius` to clip children.

### Cross-Platform
- Use `Platform.OS === 'ios'` / `'android'` when behavior diverges — never assume.
- `lineHeight` in React Native is absolute (px), not relative like CSS.
- Reanimated: use `useNativeDriver: true` whenever possible.
- Never leave `console.log` in committed code.

## Running the App
```bash
npm start          # Expo dev server
npm run android    # Android
npm run ios        # iOS
```
