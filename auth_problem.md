 UX/UI Audit — Register/Login Flow

  TL;DR

  The "password popup after signup" your users complain about is not Apple — it's your own "Set your password" screen, by design. The gate signs people up with a hidden
  random temp_password, then forces them into a set-password screen on every app open until they complete it. From the user's POV they signed up with email only, so being
  asked for a password feels like a bug. auth_problem.md chased the wrong issue (Apple nonce); that fix is fine but unrelated to what users are reporting.

  ---
  Root cause (the real one)

  RegisterScreen.tsx:467 handleGateSubmit
  - Generates tempPassword (line 474), calls supabase.auth.signUp with metadata { temp_password: true } (line 487).
  - Supabase auto-creates a session → user is now "signed in" with a password they never chose and don't know.

  RegisterScreen.tsx:269-276 auto-redirect effect
  if (!authUser?.user_metadata?.temp_password || !authUser?.email) return;
  setPhase((p) => (p === 'quiz' ? 'email' : p));
  - Every cold start, if temp_password: true, the app slams the user into the "Set your password" screen (renderEmail → signedUpAtGate branch, line 1383). This is the
  "popup".

  RegisterScreen.tsx:1404 copy
  - Title is literally "Set your password". Subtitle: "Choose a password to save your results and sign in anytime."
  - A user who entered email + saw a "Continue" button perceives this as: "I already signed up — why are you asking again?"

  LoginScreen.tsx:62 dead-end for these users
  - A returning user with temp_password: true who tries to Log in instead of resuming Register cannot — they don't know their password. signInWithPassword returns Invalid
  login credentials, they hit the user_not_found / invalid_credentials branch and bounce. No path to recovery except "Forgot password" which goes to a web URL (line 28).
  Major leak.

  ---
  High-priority fixes (P1)

  1. Stop calling it "Set your password" after signup. They didn't ask for a password — you invented one. Reframe as a one-step completion, not a second auth prompt.
    - Title: "One last step — secure your account"
    - Subtitle: "Create a password so you can sign back in next time."
    - Button: "Save & continue" (not "Set my password & continue")
    - Remove the second mention at RegisterScreen.tsx:1342 ("Set a password to save your results…") — it primes confusion before the screen even loads.
  2. Don't auto-jump returning users into the password screen on cold start. The effect at RegisterScreen.tsx:271 is the actual "popup" behavior. Instead:
    - Land them on Dashboard (they have a session — let them use the app).
    - Show a persistent non-blocking banner at the top: "Finish securing your account →". Tapping it opens the set-password sheet.
    - Rationale: they already paid the activation cost (quiz + email). Blocking the app on a screen they don't understand is the worst possible moment to re-friction them.
  3. Fix the Login dead-end for temp-password users. In LoginScreen.handleLogin, when Invalid login credentials comes back, also check (via a lightweight RPC or a silent
  OTP/magic-link fallback) whether the email exists with temp_password: true. If yes, show:
  ▎ "Looks like you started signing up but didn't finish. We'll email you a link to continue."
  ▎ …and trigger supabase.auth.signInWithOtp({ email }). This recovers a real, currently-lost user.
  4. Re-architect: stop using temp passwords entirely. This whole class of bug exists because of the gate flow. Two cleaner alternatives:
    - Magic-link gate: gate collects email → signInWithOtp → user clicks link → returns into quiz results. No password until they decide they want one. Removes the entire
  "popup" problem.
    - Anonymous auth → upgrade: supabase.auth.signInAnonymously() at gate, then updateUser({ email, password }) later when they actually choose to register. Also kills the
  temp-password concept.

  Recommended: magic link. Less invasive, matches user mental model.

  ---
  Medium (P2)

  5. LoginScreen.tsx:214 Forgot password opens an external web URL via Linking.openURL. Cold context switch out of the app → users don't come back. Build it in-app with
  resetPasswordForEmail + a deep link, or at minimum open in an in-app browser (expo-web-browser).
  6. LoginScreen.tsx:50 Email regex is too loose and runs on every keystroke without debounce — fine functionally, but the red border at inputError flashes mid-typing for
  valid emails (e.g., you@example shows error before .com). Validate on blur, not on change.
  7. LoginScreen.tsx:51 passwordValid = password.length >= 8 — but Supabase's default minimum is 6, and existing accounts may have 6-char passwords. A user with a valid
  6-char password literally cannot press "Sign in" because canSubmit is false. Either lower to 6 for login, or remove the length gate on the login screen entirely (length
  is a register-time constraint, not a login one).
  8. LoginScreen.tsx:283 Apple button uses BLACK style on a light gradient — fine on iOS HIG, but you have no WHITE_OUTLINE fallback if you ever ship a dark theme. Minor.
  9. RegisterScreen.tsx:456-465 generateTempPassword uses crypto.getRandomValues which isn't available in React Native by default — falls through to Math.random(). Not a
  security issue if you adopt fix #4 and remove temp passwords. If you keep it, use expo-crypto's getRandomBytesAsync (already installed).
  10. Error container colors (LoginScreen.tsx:495,499,503) — good, you're using rgba() per CLAUDE.md. ✓
  11. LoginScreen.tsx:251, 358, etc. activeOpacity={1} on every TouchableOpacity disables the press feedback. Intentional? Users need some tactile response. Use 0.7 or
  migrate to Pressable with a pressed style.
  12. RegisterScreen.tsx:483 Gate signup has no emailRedirectTo — if Supabase email confirmation is on, the user gets a session but also a confirmation email they don't
  expect. Either disable confirm for this flow or set the redirect to a deep link that completes the set-password step.

  ---
  Low (P3 — polish)

  13. LoginScreen heading: "Welcome back" + envelope illustration is warm. Good. ✓
  14. Loading state copy at line 261 — "Signing in..." is fine, but consider matching Menolisa's voice: "Just a moment…"
  15. LoginScreen.tsx:344 "Account Not Found" CTA → Register is good. Consider adding the inverse on Register (email exists → "Log in here").
  16. Apple button height uses minTouchTarget (good) but the divider above (dividerRow, line 567) has no vertical margin → visually cramped against the Sign in button.
  17. RegisterScreen.tsx:1342 "Set a password to save your results and use the dashboard" — strong loss-aversion framing, but it leaks the implementation detail. Users
  hear: "my results aren't saved yet?" Reword: "Create a password so you can come back anytime."

  ---
  What I'd actually ship first

  In order:
  1. Fix #1 (copy reframing) — 15 min, immediate confusion reduction.
  2. Fix #2 (non-blocking banner instead of forced redirect) — 1–2 hours, kills the "popup" complaint.
  3. Fix #3 (login OTP fallback for temp_password users) — 1 hour, recovers lost users today.
  4. Fix #7 (remove length gate on Login) — 2 min, unblocks existing accounts.
  5. Then plan Fix #4 (kill temp passwords) for the next release.

  Want me to implement #1, #2, #3, #7 now?

✻ Sautéed for 1m 18s

❯ I'm okay with suggestions except:                                                                                                                                         
1. Magic link: too complicated - easier with just password or apple sign in                                                                                                 
2. It was really apple popup. Maybe it is already fixed. It was appearing anytime user signs in / up into their account.                                                    
                                                                                                                                                                            
                                                                                                                                                                            
notes:                                                                                                                                                                      
- i don't want 10 changes at once. suggest 3 things we can implement by the priority in order for users to have normal and stable auth system.                              
- you have supabase mcp access                                                                                                                                              

● Got it. Here are the 3, in order:

  1. Verify the Apple fix is actually complete (P1)

  The nonce code is in place (LoginScreen.tsx:121-138, RegisterScreen.tsx:529-546) — that handles the client side. But the Apple popup also reappears if Supabase's Apple
  provider config is wrong (Services ID / Team ID / Key ID / private key). If any of those drift, Supabase rejects the token, the session silently fails, and Apple retries
  in password mode — exact symptom your users reported.

  Action: let me use the Supabase MCP to pull the current Apple provider config + recent auth logs and confirm there are no rejected Apple tokens. If clean → Apple is done.
   If not → we fix the dashboard, no code change needed.

  2. Remove the 8-char gate on the Login screen (P1, 2 min)

  LoginScreen.tsx:51 — passwordValid = password.length >= 8 blocks the Sign in button for any existing user whose password is shorter than 8 chars (Supabase default min is
  6). They literally cannot log in. Length is a register-time rule, not a login rule. Drop it on Login only.

  3. Recovery path for "I forgot I had a temp password" users (P2)

  Without magic links, the cleanest fix is the password reset email (still just email + password, nothing new for users to learn):

  - In LoginScreen.handleLogin, when Supabase returns Invalid login credentials, instead of just showing an error, offer a one-tap "Email me a reset link" button that calls
   supabase.auth.resetPasswordForEmail(email, { redirectTo: <deep link> }).
  - Same button replaces the current external Linking.openURL(FORGOT_PASSWORD_URL) at line 214 — keeps users in-app.
  - This recovers temp-password users and normal forgotten-password users with one mechanism.

  ---
  Want me to start with #1 (run the Supabase MCP checks on Apple provider + auth logs)?
                                                                                         