# Menolisa — Claude Code Project Context

## What This Project Is
MenoLisa is an AI health companion app for women navigating perimenopause and menopause. It combines a conversational chat interface (AI-powered by the Menolisa persona) with symptom tracking and personalized insights.

## Tech Stack
- **Framework**: Expo ~54 (React Native, New Architecture enabled)
- **Language**: TypeScript (strict)
- **Navigation**: React Navigation v7 — bottom tabs + native stacks
- **Backend/DB**: Supabase (auth + PostgreSQL + Edge Functions) — **no separate Node.js server**
- **Fonts**: Poppins (body/UI) + Nunito (display/headings)
- **Package manager**: npm

## Project Structure
```
src/
  screens/         # All screens organized by tab
    home/          # Dashboard, Symptoms, SymptomLogs
    chat/          # ChatList, ChatThread
    settings/      # Settings, NotificationPrefs
    notifications/ # NotificationsScreen
    LoginScreen, RegisterScreen, LandingScreen
  components/      # Shared UI components
  navigation/      # AppNavigator, MainTabs, types.ts
  theme/           # tokens.ts — single source of truth for colors, spacing, radii, typography
  lib/             # supabase.ts, api.ts, logger.ts, symptomTrackerConstants.ts
  hooks/           # Custom React hooks
  context/         # AuthContext, RefetchTrialContext
```

## Navigation Structure
```
RootStack
├── Auth Stack: Landing → Login → Register
└── Main Stack → MainTabs (bottom tabs)
    ├── HomeTab: Dashboard → Symptoms → SymptomLogs
    ├── ChatTab: ChatList → ChatThread (sessionId)
    ├── NotificationsTab: Notifications
    └── SettingsTab: Settings → NotificationPrefs
```

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
- **Client-side data**: `src/lib/supabase.ts` — Supabase JS client for auth + direct DB queries
- **API calls**: `src/lib/api.ts` — abstraction layer for backend calls
- **Server-side logic**: Supabase Edge Functions (Deno/TypeScript) — NOT Express/Node.js
- **Auth**: Supabase Auth with JWT; all user data scoped by `user_id`
- **AI**: OpenAI API calls made from Supabase Edge Functions, not the mobile client directly

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

## Running the App
```bash
npm start          # Expo dev server
npm run android    # Android
npm run ios        # iOS
```
