# Backend hand-off: Email sequence tables and sync for n8n

**Audience:** Backend-specialist agent (Supabase, API, server-side).  
**Context:** Schedule-based email sequences for Segment 2 (trial/expired) and Segment 3 (paid) per [EMAIL_SEQUENCES_SEGMENT_2_AND_3.md](../EMAIL_SEQUENCES_SEGMENT_2_AND_3.md). n8n cannot read `auth.users`; it needs one denormalized table with email and all segment/personalization fields. See [EMAIL_SEQUENCE_DATA_ANALYSIS.md](../EMAIL_SEQUENCE_DATA_ANALYSIS.md) for the chosen approach.

**You must:**

1. Create the two tables in Supabase (public schema).
2. Implement sync of `email_sequence_recipients` from `user_profiles`, `user_trials`, and `auth.users` via triggers and a SECURITY DEFINER function.
3. Ensure n8n can read `email_sequence_recipients` and read/insert `email_sequence_sends` (use service_role or equivalent; no anon SELECT on recipients).

No webhooks are required for the schedule-based n8n workflow. No changes to the web app are required if triggers keep the recipient table in sync.

---

## 1. Table: `email_sequence_recipients`

**Purpose:** Single table n8n SELECTs from to get every user for Segment 2 and 3 with email, name, quiz data, trial/subscription state, and `paid_at` for “X days after paid” timing.

**Columns:**

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| user_id | uuid | NOT NULL | PK; same as auth.users.id |
| email | text | NOT NULL | From auth.users; required for sending |
| name | text | YES | From user_profiles; first name for {{name}} |
| top_problems | text[] | YES | From user_profiles |
| severity | text | YES | From user_profiles |
| goal | text | YES | From user_profiles |
| trial_start | timestamptz | YES | From user_trials |
| trial_end | timestamptz | YES | From user_trials |
| account_status | text | YES | From user_trials: 'trial' \| 'expired' \| 'paid' etc. |
| subscription_ends_at | timestamptz | YES | From user_trials (for 3-5 renewal email) |
| paid_at | timestamptz | YES | Set when account_status first becomes 'paid'; used for Segment 3 timing |
| updated_at | timestamptz | NOT NULL | Last sync time (default now()) |

**Constraints:** PRIMARY KEY (user_id).

**Indexes:** Consider index on (account_status, trial_start) and (account_status, paid_at) for n8n “who is due” queries.

**RLS:** Enable RLS. Do **not** grant SELECT to anon/authenticated (PII). n8n will use service_role key which bypasses RLS.

---

## 2. Table: `email_sequence_sends`

**Purpose:** Record which sequence step was sent to which user. n8n SELECTs to avoid double-send and INSERTs after each send.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | bigint | NOT NULL | Identity / serial PK |
| user_id | uuid | NOT NULL | References user |
| step | text | NOT NULL | One of: 2A1, 2A2, 2A3, 2A4, 2B1, 2B2, 2B3, 3-1, 3-2, 3-3, 3-4, 3-5 |
| sent_at | timestamptz | NOT NULL | Default now() |

**Constraints:** PRIMARY KEY (id), UNIQUE (user_id, step).

**RLS:** Enable RLS; allow only service_role (or a dedicated role) to SELECT and INSERT. No anon access needed.

---

## 3. Sync logic: SECURITY DEFINER function + triggers

**Requirement:** Whenever `user_profiles` or `user_trials` is inserted or updated, upsert a row into `email_sequence_recipients` with email from `auth.users` and all profile/trial fields. When `account_status` becomes `'paid'`, set `paid_at = now()` if not already set.

**Implementation:**

1. **Function (e.g. `sync_email_sequence_recipient(p_user_id uuid)`):**
   - Declare as `SECURITY DEFINER` (so it runs with definer’s privileges and can read `auth.users`).
   - In the function:
     - SELECT email from `auth.users` where id = p_user_id.
     - SELECT name, top_problems, severity, goal from `public.user_profiles` where user_id = p_user_id.
     - SELECT trial_start, trial_end, account_status, subscription_ends_at from `public.user_trials` where user_id = p_user_id.
   - If no profile or no trial row, you may still upsert (e.g. with nulls) or skip; document the choice. For our sequences we need at least profile + trial for Segment 2, and trial for Segment 3; so if either is missing, you can still upsert so n8n sees the user and can filter by “has trial_start” / “has account_status”.
   - Upsert into `email_sequence_recipients`:
     - Set paid_at = now() only when account_status = 'paid' and (existing row’s paid_at is null or we’re inserting).
     - Set all other columns from the SELECTs above.
     - updated_at = now().
   - Handle “no email” (user deleted from auth?): either skip upsert or upsert with email = null and let n8n filter out null emails.

2. **Triggers:**
   - On `public.user_profiles`: AFTER INSERT OR UPDATE, FOR EACH ROW call `sync_email_sequence_recipient(NEW.user_id)`.
   - On `public.user_trials`: AFTER INSERT OR UPDATE, FOR EACH ROW call `sync_email_sequence_recipient(NEW.user_id)`.

This keeps `email_sequence_recipients` in sync without any app code changes. The only writer is the database.

**Edge case:** If a user is created in auth and `user_trials` is inserted before `user_profiles` exists, the first sync might have null name/top_problems; when `user_profiles` is inserted later, the trigger will run again and fill them in. So ordering is fine.

---

## 4. Backfill existing users

After creating the table and triggers, backfill so existing users appear in `email_sequence_recipients`:

- For each user_id that exists in `user_profiles` or `user_trials`, call `sync_email_sequence_recipient(user_id)`. You can do this in a one-off migration or script: e.g. `SELECT DISTINCT user_id FROM user_profiles UNION SELECT user_id FROM user_trials` and then for each id call the function. Or a single SQL statement that inserts/upserts into `email_sequence_recipients` from a SECURITY DEFINER function that selects from auth.users, user_profiles, user_trials (e.g. a loop in pl/pgsql or a single INSERT ... SELECT from a function that returns the joined row).

---

## 5. user_trials.trial_end

Ensure `user_trials.trial_end` is set when a trial is created (e.g. `trial_start + (trial_days || ' days')::interval`). If it is not set today, add a trigger or default or backfill so n8n can use it for “trial ended” and “Day 3” logic. Document in the migration.

---

## 6. n8n access

- n8n will connect to Supabase with a key that can read `email_sequence_recipients` and read/insert `email_sequence_sends`. Use the **service_role** key in n8n’s Supabase credentials for these workflows so RLS does not block. Do not expose service_role to the client; it is for server-side automation only.
- No webhooks are required: n8n runs on a schedule and queries “who is due for step X” from `email_sequence_recipients` and `email_sequence_sends`.

---

## 7. Segment reference (for your queries / tests)

- **Segment 2 Track A (trial 0–3 days):** account_status = 'trial', trial_start in last 3 days. Steps 2A1 (0–1h), 2A2 (24h), 2A3 (48h), 2A4 (72h) relative to trial_start.
- **Segment 2 Track B (expired, win-back):** account_status = 'expired' (or trial_end < now() and account_status != 'paid'). Steps 2B1, 2B2, 2B3 at day 0, 5–7, 7–10 after expiry.
- **Segment 3 (paid):** account_status = 'paid'. Steps 3-1 (within 24h of paid_at), 3-2 (5–7 days), 3-3 (14–21 days), 3-4 (30 days), 3-5 optional (before subscription_ends_at).

All personalization and timing fields for these segments are in `email_sequence_recipients`; n8n does not need to access `auth.users` or join multiple tables.

---

## 8. Checklist for backend-specialist

- [x] Create migration: table `email_sequence_recipients` with columns above.
- [x] Create migration: table `email_sequence_sends` with columns and UNIQUE(user_id, step).
- [x] Create SECURITY DEFINER function `sync_email_sequence_recipient(p_user_id uuid)` that reads auth.users + user_profiles + user_trials and upserts into email_sequence_recipients (including paid_at when account_status = 'paid').
- [x] Create trigger on user_profiles (AFTER INSERT OR UPDATE) calling sync function.
- [x] Create trigger on user_trials (AFTER INSERT OR UPDATE) calling sync function.
- [x] Ensure user_trials.trial_end is set (trigger or backfill).
- [x] Backfill email_sequence_recipients for existing users.
- [x] Enable RLS on both tables; no SELECT for anon on email_sequence_recipients (n8n uses service_role).
- [x] Document in migration or README that n8n should use service_role for these two tables.

**Implemented (Supabase project menolisa):** One table only: `email_sequence_recipients` (with `sent_steps` jsonb for which steps were sent; only n8n writes it). Table `email_sequence_sends` was dropped. Migrations: `create_email_sequence_recipients_and_sends`, `sync_email_sequence_recipient_function_and_triggers`, `ensure_user_trials_trial_end_and_backfill_recipients`, `email_sequences_one_table_add_sent_steps`, `email_sequences_drop_sends_table`. n8n uses **service_role** to read and to UPDATE `sent_steps` after each send.
