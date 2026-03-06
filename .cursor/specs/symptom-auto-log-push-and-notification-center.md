# Symptom auto-log from chat: push notification + notification center

**Audience:** idea-review (done below), backend-specialist, ui-designer  
**Context:** Web app already auto-logs symptoms when the user mentions them in chat (e.g. “I had a headache yesterday”) via the `log_symptom` tool in `/api/langchain-rag`. The mobile app already shows an in-app alert when it receives `tool_result` for `log_symptom`. This spec adds: (1) persisting that event in the notifications table and sending a push notification, and (2) ensuring the notification center shows these as “latest logs” so the user can see recent auto-logged symptoms.

---

## Part 1 — Idea-review (consultation)

**Verdict:** **Green light.** The feature aligns with Menolisa’s product vision (symptom clarity, supportive companion) and reuses existing patterns (chat tool, notifications API, notification center).

**Summary:** Automatically detected symptom logs from chat are already stored in Supabase (`symptom_logs`). Adding a corresponding row in `notifications` and sending a push gives mobile users clear feedback even when the app is in the background, and the notification center becomes a single place to see “latest logs” (including auto-logged ones). Scope is well bounded: backend creates the notification + push when `log_symptom` succeeds; mobile already shows in-app feedback and already has a notification center that lists notifications from the API.

**Risks or open questions:**
- **Duplicate noise:** If the user is in the chat screen they get both an in-app alert and (if we send push) a push. Consider: send push only when the request did not originate from the same device, or always send push and soften in-app to a non-blocking toast so it’s not double “alert + push.” Optional: backend could accept a header like `X-Request-From: mobile` and only skip push when that’s present and we have a same-device heuristic (complex). Simpler: always create the notification (so it appears in the center) and always send push; in-app can stay as-is or be changed to a toast (see UI instructions).
- **Notification type:** Add a dedicated type (e.g. `symptom_logged`) so the notification center can display these with a distinct icon and copy; backend and UI must both support it.

**Recommendation:** Implement as below. Backend: on `log_symptom` success, insert into `notifications` (type `symptom_logged`) and call `sendPushNotification`. Mobile: ensure notification center shows these and consider replacing the in-app Alert with a non-blocking toast so the flow feels consistent with “logged + notified.”

---

## Part 2 — Instructions for backend-specialist

**Goal:** When the chat backend runs the `log_symptom` tool successfully, persist a notification and send a push so the user is notified and the event appears in the notification center.

**Current behavior (web app):**
- `app/api/langchain-rag/route.ts`: tool `log_symptom` finds/creates a symptom definition, inserts into `symptom_logs`, and returns a success string. It does **not** insert into `notifications` and does **not** call `sendPushNotification`.

**Required changes:**

1. **Extend `log_symptom` tool (langchain-rag route)**  
   After a successful insert into `symptom_logs`:
   - Insert one row into `notifications` with:
     - `user_id`
     - `type`: **`symptom_logged`** (new type; see below)
     - `title`: e.g. `"Symptom logged"`
     - `message`: short, readable summary (e.g. symptom name + severity + optional triggers), same style as the current tool return string
     - `priority`: `"medium"` (or `"high"` if you prefer)
     - Other columns as required by your schema (e.g. `seen: false`, `dismissed: false`).
   - Call `sendPushNotification({ userId: user_id, title, body: message, data: { screen: 'Notifications' } })`. Use the same `title` and `message`/body as the notification row so in-app and push match. Respect user preference (do not pass `skipPreferenceCheck: true` unless you have a product reason).

2. **Allow `symptom_logged` in notifications API**  
   In `app/api/notifications/route.ts` (or wherever POST validates `type`), add **`symptom_logged`** to the allowed `validTypes` so that server-created notifications of this type are valid. The langchain-rag route will insert directly into the table (admin client); the POST route only needs to accept the type if you ever create this notification via POST. If you only create it server-side via Supabase admin, ensure the table and any constraints accept `type = 'symptom_logged'`.

3. **No new mobile API contract**  
   Mobile already uses `GET /api/notifications` for the notification center and already has push token registration. No new endpoints are required; only ensure new rows are returned by the existing GET (they will be if you insert into the same `notifications` table).

4. **Idempotency / duplicates**  
   Optional: if the same user sends multiple messages in a short window and the model calls `log_symptom` twice for the same symptom, you may get two notifications. You can either leave this as-is (each log is a real event) or add simple deduplication (e.g. one “symptom_logged” per user per symptom_id per hour). Prefer leaving as-is unless product asks for deduplication.

**Files to touch (web app):**
- `app/api/langchain-rag/route.ts`: inside the `log_symptom` tool’s `func`, after successful `symptom_logs` insert, insert into `notifications` and call `sendPushNotification`.
- `app/api/notifications/route.ts`: add `symptom_logged` to the allowed notification types if POST is used to create them; otherwise ensure DB allows the type.

**Reference:**  
- `sendPushNotification` and push token loading: `lib/sendPushNotification.ts`.  
- Notifications table shape: same as used by POST in `app/api/notifications/route.ts` (e.g. `user_id`, `type`, `title`, `message`, `priority`, etc.).

---

## Part 3 — Instructions for ui-designer

**Goal:** (1) Ensure the notification center shows auto-logged symptom notifications with clear, consistent UX. (2) Optionally improve in-app feedback in the chat thread when a symptom is auto-logged (e.g. non-blocking toast instead of Alert).

**Current behavior (mobile):**
- **Chat:** When the stream receives `tool_result` with `tool_name === 'log_symptom'`, the app calls `showToolToast(title, message)`, which is implemented as `Alert.alert(title, message)` in `ChatThreadScreen.tsx`. So the user already sees “Symptom Logged” and details in a modal.
- **Notification center:** `NotificationsScreen` uses `GET /api/notifications` and displays items; it has `getNotificationStyle(type)` and `getDisplayTitle(type)` keyed by `type`. It does not yet handle `symptom_logged`.

**Required changes:**

1. **Notification center — support `symptom_logged`**
   - In `NotificationsScreen.tsx`, extend `getNotificationStyle(type)` with a case for `symptom_logged`. Use an icon and colors that fit “symptom logged” (e.g. checkmark or clipboard; keep consistent with `success` or use a distinct color from `src/theme/tokens.ts`). Prefer tokens for colors (e.g. `colors.primary`, `colors.success`).
   - In `getDisplayTitle(type)`, add a case for `symptom_logged` that returns a short label such as `"Symptom logged"` so that if `title` is missing the list still shows a clear heading.
   - The list already renders `item.body ?? item.message` and `item.created_at`; no change needed for that. Ensure new notifications from the backend (with `type: 'symptom_logged'`, `title`, `message`) appear in the list. If the API returns snake_cased fields, the screen already uses `item.body ?? item.message`; confirm the backend stores the summary in the same field the API returns (e.g. `message`).

2. **Refresh when returning to the tab (optional but recommended)**  
   When the user navigates back to the Notifications tab, the list should reflect the latest data. If the app uses a tab focus listener or `useFocusEffect`, trigger a refresh of the notifications list when the Notifications screen gains focus so that a notification created after an auto-log (e.g. from Chat) appears without requiring a manual pull-to-refresh.

3. **Chat in-app feedback (optional improvement)**  
   Currently `showToolToast` uses `Alert.alert`, which is blocking. Consider replacing it with a non-blocking toast (e.g. a small banner or snackbar that auto-dismisses) so the user can keep reading the stream without tapping “OK.” Implementation: use a toast component or library already in the project, or a simple absolute-positioned View that shows the same `title` and `message` and fades out after a few seconds. Keep the same copy: “Symptom Logged” and the symptom name/severity/triggers line. If no toast component exists, leaving `Alert.alert` is acceptable; document the optional improvement for a follow-up.

**Design system:**  
- Use only `src/theme/tokens.ts` for colors, spacing, radii, typography.  
- Use existing `typography.presets` and `minTouchTarget` where relevant.  
- Buttons: sentence case; no `textTransform: 'uppercase'`.

**Files to touch (mobile app):**
- `src/screens/notifications/NotificationsScreen.tsx`: add `symptom_logged` to `getNotificationStyle` and `getDisplayTitle`; optionally add focus-based refresh.
- `src/screens/chat/ChatThreadScreen.tsx`: optional replacement of `Alert.alert` with a non-blocking toast for `log_symptom` (and optionally other tool toasts).

---

## Summary

| Area | Action |
|------|--------|
| **Backend (web)** | On `log_symptom` success: insert `notifications` row (`type: symptom_logged`) and call `sendPushNotification`. Allow `symptom_logged` in notifications API/DB. |
| **Mobile notification center** | Handle `symptom_logged` in style and title; optional focus refresh. |
| **Mobile chat** | Optional: replace Alert with non-blocking toast for tool success. |

No new API endpoints; no change to the chat stream contract. The backend remains the single source of truth for “symptom logged”; the notification is a side effect so the user sees it in the center and, when applicable, via push.
