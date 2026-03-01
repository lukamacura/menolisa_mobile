# Backend Lead Memory — Menolisa

## Architecture Status (Feb 2025)
- NO Supabase Edge Functions exist yet (`supabase/` directory is absent)
- All API calls in `src/lib/api.ts` target a Node.js/Express-style REST server (localhost:3000 / menolisa.com)
- The backend migration to Supabase Edge Functions has NOT been done — this is the primary build task
- `EXPO_PUBLIC_SUPABASE_URL` points to `amvxsrhstfgvmbgblgsp.supabase.co`

## Established Patterns
- All authenticated calls use `apiFetchWithAuth` from `src/lib/api.ts` — adds `Authorization: Bearer <jwt>`
- Supabase client: `src/lib/supabase.ts` — AsyncStorage session persistence, autoRefreshToken enabled
- User identity in app: always from `supabase.auth.getUser()` or `getSession()`, never hardcoded
- Trial/subscription state: `src/hooks/useTrialStatus.ts` reads from `user_trials` table directly via Supabase JS client

## Known Schema Tables (inferred from client queries)
- `user_profiles` — columns: `user_id`, `name`
- `user_trials` — columns: `user_id`, `trial_start`, `trial_end`, `trial_days`, `account_status`, `subscription_ends_at`, `subscription_canceled`

## Critical Security Notes
- `.env` contains `SUPABASE_SERVICE_ROLE_KEY` — MUST NEVER be in mobile project; belongs only in Edge Function secrets
- `.env` contains `OPENAI_API_KEY` — belongs only in Edge Function secrets, never client-side
- Both keys were present in plaintext as of health check; rotate if concerned about exposure
- `.env` is gitignored (confirmed), but the placement is still wrong

## Known Bugs / Tech Debt
- `useTrialStatus.ts` hits `/api/stripe/sync-subscription` as a hardcoded string (not in API_CONFIG.endpoints)
- `useTrialStatus.ts` double-fires Stripe sync when DashboardScreen and SettingsScreen both mount
- `useTrialStatus.ts`: paid users with null `subscription_ends_at` get a fake expiry of `now + 365 days` — misleading
- `ChatThreadScreen.tsx` sends `user_id` in request body alongside JWT — server must validate JWT is authoritative
- `Notifications.getExpoPushTokenAsync()` missing `projectId` option — will fail in EAS standalone builds
- `apiFetch` (unauthenticated) in `api.ts` is dead code — nothing calls it
- No `eas.json` present — EAS Build env var pipeline is not configured

## API Endpoint Registry (src/lib/api.ts)
All 18 endpoints use `/api/` prefix style (Express REST convention, not Edge Function URLs).
Key ones: `chat` → `/api/langchain-rag`, `symptomLogs` → `/api/symptom-logs`, `symptoms` → `/api/symptoms`
When migrating to Edge Functions, update base URL to `SUPABASE_URL/functions/v1` and rename paths.

## Files — Key Paths
- Supabase client: `src/lib/supabase.ts`
- API layer: `src/lib/api.ts`
- Auth context: `src/context/AuthContext.tsx`
- Trial hook: `src/hooks/useTrialStatus.ts`
- Push token hook: `src/hooks/useRegisterPushToken.ts`
- Symptom constants: `src/lib/symptomTrackerConstants.ts`
- Design tokens: `src/theme/tokens.ts`
