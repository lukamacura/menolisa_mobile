# Email sequence data: optimal solution for n8n (schedule-based)

## Problem

- n8n cannot read `auth.users` (Supabase auth schema is not exposed to typical API keys / RLS).
- All segments in [EMAIL_SEQUENCES_SEGMENT_2_AND_3.md](EMAIL_SEQUENCES_SEGMENT_2_AND_3.md) need: **email**, **name**, **top_problems**, **severity**, **goal**, **trial_start**, **trial_end**, **account_status**, **subscription_ends_at**, and for Segment 3 a **first-paid date** for “X days after paid” timing.
- We use **schedule-based** logic in n8n (no Supabase “new row” trigger), so n8n must **query one place** to get “who is due for which email” and **record** “which step was already sent” to avoid double-send.

## Optimal solution: two tables, one read path

### 1. `email_sequence_recipients` (read-only for n8n)

**Purpose:** Single table n8n can SELECT from to get every user it needs for Segment 2 and Segment 3, with all personalization and timing fields. No join to `auth.users` in n8n.

**Populated by:** Database triggers on `user_profiles` and `user_trials`. A trigger calls a **SECURITY DEFINER** function that can read `auth.users.email` and upserts into `email_sequence_recipients`. So whenever a profile or trial row is created/updated, the recipient row is updated (including email pulled from auth).

**Columns:**

| Column | Type | Source | Use in sequences |
|--------|------|--------|-------------------|
| user_id | uuid PK | user_profiles.user_id | Identity |
| email | text | auth.users.email | Recipient; required |
| name | text | user_profiles.name | {{name}} |
| top_problems | text[] | user_profiles.top_problems | Personalization |
| severity | text | user_profiles.severity | Optional |
| goal | text | user_profiles.goal | Optional |
| trial_start | timestamptz | user_trials.trial_start | Track A timing (2A1–2A4) |
| trial_end | timestamptz | user_trials.trial_end | Track B start; trial end |
| account_status | text | user_trials.account_status | Segment: trial/expired vs paid |
| subscription_ends_at | timestamptz | user_trials.subscription_ends_at | 3-5 renewal email |
| paid_at | timestamptz | Set when account_status becomes 'paid' | Segment 3 timing (3-2, 3-3, 3-4) |
| updated_at | timestamptz | now() on upsert | Freshness |

**Segments n8n can derive:**

- **Segment 2 Track A:** `account_status = 'trial'` and `trial_start` within desired window (0–3 days).
- **Segment 2 Track B:** `account_status = 'expired'` (or `trial_end < now()` and `account_status != 'paid'`).
- **Segment 3:** `account_status = 'paid'`; use `paid_at` for “X days after paid” (3-2, 3-3, 3-4, 3-5).

n8n never touches `auth.users` or joins multiple tables; one SELECT from `email_sequence_recipients` plus one SELECT from `email_sequence_sends` (see below) is enough.

### 2. `email_sequence_sends` (n8n reads + writes)

**Purpose:** Record which sequence step was sent to which user so we don’t resend. n8n **SELECTs** to check “has this user already received 2A1?” and **INSERTs** after sending.

**Columns:**

| Column | Type | Purpose |
|--------|------|--------|
| id | bigint / uuid | Primary key (auto) |
| user_id | uuid | FK to email_sequence_recipients / auth.users |
| step | text | Step id: '2A1', '2A2', '2A3', '2A4', '2B1', '2B2', '2B3', '3-1', '3-2', '3-3', '3-4', '3-5' |
| sent_at | timestamptz | When the email was sent (default now()) |

**Unique constraint:** `(user_id, step)` so the same step is never sent twice.

**n8n flow (per run):**

1. Schedule triggers (e.g. every 30 min or hourly).
2. Query `email_sequence_recipients` for rows that are “due” for a given step (e.g. trial_start between 23h and 25h ago for 2A2; not yet in `email_sequence_sends` for 2A2).
3. For each due recipient, send the email (Resend/SendGrid/etc.).
4. INSERT into `email_sequence_sends` (user_id, step, sent_at).

No webhooks are required for schedule-based logic. The only requirement is that `email_sequence_recipients` stays in sync with profiles and trials; that’s done by DB triggers.

## Why not a view?

A database view that JOINs `auth.users`, `user_profiles`, and `user_trials` would need to run with privileges that can read `auth.users`. In Supabase, the anon key cannot read `auth.users`. A view in `public` runs with the invoker’s permissions, so n8n (using anon or a key that can’t read auth) still couldn’t use it. A **SECURITY DEFINER** view or function could expose the join, but then we’d have to maintain a view and possibly a function; keeping a **table** updated via triggers is simpler and gives n8n one clear, indexable table to query. So: **table + triggers** is the most straightforward and easiest for n8n to use.

## Access control

- **email_sequence_recipients:** Contains PII (email, name). n8n should use a key with elevated access (e.g. Supabase **service_role**) so it can SELECT. Do not grant SELECT to anon/authenticated unless you have a strong reason; prefer “n8n only” via service_role.
- **email_sequence_sends:** n8n needs SELECT (to check “already sent”) and INSERT (after send). Same: use service_role for the n8n Supabase credentials so no RLS policy is required for the workflow. If you prefer RLS, add a policy that allows only the service role.

## Summary

| Item | Responsibility |
|------|----------------|
| **email_sequence_recipients** table | Backend/Supabase: create table, triggers on user_profiles and user_trials, SECURITY DEFINER function to copy email from auth.users and upsert. |
| **email_sequence_sends** table | Backend/Supabase: create table, unique (user_id, step). |
| **n8n** | Schedule trigger; query recipients + sends; send email; insert into sends. No webhooks needed for schedule logic. |

This gives you the simplest and most robust way for n8n to access all segments (2A, 2B, 3) and all required fields without ever touching `auth.users`.
