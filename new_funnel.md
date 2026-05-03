# New Mobile Funnel — Sign-in Only, Web-Driven Subscription

## Context
The mobile app currently has its own registration flow, password auth, and Apple IAP path. The web app has moved to a unified funnel: OTP-based auth, mandatory-card 3-day Stripe trial, and `user_trials.account_status` as the single source of truth. We are realigning mobile to that funnel for **both iOS and Android (identical flow)**:

- Mobile is **sign-in only**. New accounts are created on the web (`menolisa.com`).
- **No dashboard access without a valid card** — the gate is server-side via `checkTrialStatus`.
- **Apple IAP is removed entirely.** Stripe (web) is the only payment path on both platforms.
- **Old users are treated as if they don't exist.** No password→OTP migration, no legacy account handling. Anyone who can't log in via OTP is told to sign up on web.

End result: ~2.5 days of dev work, simpler code, one funnel to reason about, and the app store risk surface drops to "reader-style sign-in app" (Spotify/Netflix pattern).

---

## Files to remove

Pure deletion, no replacement:

- `src/lib/iap.ts`
- `src/lib/iap.ios.ts`
- `src/lib/billingCompliance.ts` (IAP-specific compliance helpers — verify nothing else imports it before deleting)
- `src/screens/RegisterScreen.tsx` (will be replaced by a tiny "Create account on web" CTA — see below)
- Any IAP-related dependencies in `package.json`: `react-native-iap`, `react-native-nitro-modules` (only if it was added solely for IAP — check)

Also strip:
- The `temp_password` / `needsPassword` branching in `src/navigation/AppNavigator.tsx:249-250` (legacy gate-signup flow, no longer needed).

---

## Files to modify

### 1. `src/lib/supabase.ts`
Confirm it reads from `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`. **These must match the web `.env` values verbatim** (web team confirmed: same project ref `amvx…`, same anon key starting `eyJhbGciOiJI…`). Pull from web `.env` when configuring `app.config.js` extras. Mismatched keys = OTP minted on web won't verify on mobile.

### 2. `src/screens/LoginScreen.tsx` — rebuild as OTP form
Two-step UI, mirrors `web/components/auth/OtpForm.tsx`:

**Step A — email entry**
```ts
await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: false },  // critical: no signup from mobile
});
```
On error `"Signups not allowed for otp"` (Supabase's response when the email isn't in `auth.users` and `shouldCreateUser` is false), show:
> "No account found for this email. Sign up at menolisa.com" + button → `Linking.openURL('https://menolisa.com/register')`.

**Step B — 6-digit code entry**
```ts
await supabase.auth.verifyOtp({ email, token, type: 'email' });
```
Resend cooldown: 60s timer (Supabase enforces server-side at 1/60s).

UI: single screen, two states (`mode: 'email' | 'code'`). Reuse `typography.presets`, `colors.primary` from `tokens.ts`.

### 3. `src/screens/LandingScreen.tsx`
Replace any "Create Account" / "Sign Up" CTA with:
- **Primary**: "Sign in" → `LoginScreen`
- **Secondary text link**: "New to Menolisa? Create your account at menolisa.com" → opens system browser to `https://menolisa.com/register`.

**Important for App Store review:** do not mention pricing, "subscribe", "free trial", or Stripe inside the app. The link goes to the homepage/register page only.

### 4. `src/navigation/AppNavigator.tsx`
- Remove `Register` from auth stack.
- Remove `needsPassword` / `temp_password` logic (lines ~249-250, ~258).
- Auth stack becomes: `Landing` → `Login` only.
- Keep deep-link handler for `menolisa://settings` (returns from web billing portal — triggers trial refetch).
- Remove the `/auth/callback` deep-link branch and the `menolisa://checkout/...` handling (no in-app Stripe webview anymore).

### 5. New: `src/lib/accountStatus.ts`
Centralized post-login gate check. Web team recommended option 1: hit a tiny new endpoint rather than reimplementing `checkTrialStatus.ts` rules on the client.

```ts
export type AccountStatus = {
  expired: boolean;
  account_status: 'trial' | 'paid' | 'pending_payment' | 'expired';
  subscription_ends_at: string | null;
  trial_end: string | null;
};

export async function fetchAccountStatus(): Promise<AccountStatus> {
  // GET /api/account/status with Bearer <supabase_access_token>
}
```

**Action item for web team:** add `GET /api/account/status` that returns the shape above, using the same `checkTrialExpired(user.id)` logic. Until that endpoint exists, fall back to: call any gated endpoint (e.g. `/api/chat`) and treat 403 `{ error: "Trial expired" }` as `expired: true`.

### 6. New: `src/screens/SubscriptionRequiredScreen.tsx`
Shown after login when `expired === true` or `account_status === 'pending_payment'`. Three message variants based on status:

| `account_status`   | Headline                              | CTA                                   |
|--------------------|---------------------------------------|---------------------------------------|
| `pending_payment`  | "Finish setting up your subscription" | "Continue on menolisa.com"            |
| `expired`          | "Your subscription has ended"         | "Manage at menolisa.com"              |
| `paid` + past end  | (same as expired)                     | (same)                                |

Button uses `openAccountBillingEntry()` from `src/lib/api.ts` (already wired, opens web billing entry; verify it points to the right URL post-funnel-change). Provides a "Sign out" secondary button.

### 7. `src/context/AuthContext.tsx`
After session establishes, fetch account status and store on context:
```ts
{ user, session, accountStatus, refetchAccountStatus, loading }
```
This drives the navigator: only show `MainTabs` if `accountStatus && !accountStatus.expired`. Otherwise show `SubscriptionRequiredScreen`.

### 8. `app.config.js` / `app.json`
- Remove iOS IAP entitlement / capability if listed.
- Bump version (Apple resubmission).
- Confirm deep link scheme `menolisa://` and associated domain `menolisa.com` for return-from-web flow.

---

## Navigation flow (final state)

```
LoadingScreen
    │
    ├── no session ──► Landing ──► Login (OTP)
    │                                │
    │                                ▼ (verifyOtp success)
    │                          fetchAccountStatus()
    │                                │
    │                  ┌─────────────┴─────────────┐
    │                  ▼                           ▼
    │           expired === false          expired === true
    │                  │                  /pending_payment
    │                  ▼                           ▼
    │              MainTabs            SubscriptionRequiredScreen
    │           (Dashboard etc.)        ("Manage on menolisa.com")
    │
    └── existing session ──► same status check ──► MainTabs or SubscriptionRequired
```

No path inside the app reaches the dashboard without a server-confirmed paying/trialing card.

---

## Web team coordination (asks)

1. **Confirm `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` values** match `.env` (project ref `amvx…`, anon key `eyJhbGciOiJI…`).
2. **Add `GET /api/account/status`** returning `{ expired, account_status, subscription_ends_at, trial_end }` from `checkTrialExpired(user.id)`. Single source of truth — avoids mobile reimplementing the rules table.
3. **Confirm `account_status: 'pending_payment'` UX on web** — when mobile sends users to `menolisa.com` to finish checkout, that user must land on a page that resumes their Stripe Checkout session, not start from scratch.

---

## Verification (end-to-end)

1. **Fresh install (no account)**
   - Tap "Sign in" → enter unknown email → expect *"No account found"* with web link.
2. **Web signup, mobile login**
   - Register on `menolisa.com`, complete quiz, **skip Stripe checkout** (close tab) → on mobile, log in with same email/OTP → expect `SubscriptionRequiredScreen` ("Finish setting up").
3. **Web signup + completed checkout**
   - Same as above but complete Stripe → wait for webhook → mobile login → expect `MainTabs` with full dashboard access.
4. **Existing trialing user**
   - Log in, dashboard loads, kill app, reopen → still in dashboard (session persisted, status cached + refetched).
5. **Subscription expires mid-session**
   - Manually flip `user_trials.account_status` to `'expired'` in Supabase → trigger `refetchAccountStatus` (or pull-to-refresh) → expect navigation to `SubscriptionRequiredScreen`.
6. **Resend code cooldown**
   - On code entry screen, tap resend twice quickly → expect 60s timer + Supabase rate-limit error suppressed/retried.
7. **iOS + Android parity**
   - Run all 6 cases on both platforms — UI, copy, and behavior must match exactly.
8. **App Store / Play Store review readiness**
   - Verify zero strings in app contain: "subscribe", "free trial", price values, "$", "Stripe". Audit copy with grep before submission.

---

## Out of scope (explicit non-goals)
- Migrating existing password users — per direction, treat as if no old users exist.
- Apple IAP support — fully removed, will not be re-added.
- In-app Stripe checkout / webview — all payment happens on web.
- Quiz flow on mobile — only on web; mobile reads quiz answers via `user_profiles` if needed for personalization (separate ticket).
