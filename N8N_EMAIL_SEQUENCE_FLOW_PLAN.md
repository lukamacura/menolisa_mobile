# n8n Email Sequences — Implementation (Single Table)

**One table:** `email_sequence_recipients`.  
**Supabase:** Use **service_role** key only (RLS blocks anon/authenticated).  
**Sending:** Resend, SendGrid, etc. in n8n. Copy: [EMAIL_SEQUENCES_SEGMENT_2_AND_3.md](EMAIL_SEQUENCES_SEGMENT_2_AND_3.md).

---

## Table: `email_sequence_recipients`

| Column | Use |
|--------|-----|
| user_id | PK |
| email | To address |
| name, top_problems, severity, goal | Personalization ({{name}}, etc.) |
| trial_start, trial_end | Track A timing (2A1–2A4) |
| account_status | `trial` = Track A, `expired` = Track B, `paid` = Segment 3 |
| subscription_ends_at | 3-5 renewal window |
| paid_at | Segment 3 timing (3-1 to 3-4) |
| **sent_steps** | jsonb: `{"2A1":"2025-03-01T12:00:00Z", "2A2":"..."}` — which step was sent and when. **Only n8n writes this.** |

**Logic:** Triggers sync profile/trial data into this table; they never touch `sent_steps`. n8n (1) SELECTs “due” rows (step not in `sent_steps` + timing), (2) sends email, (3) UPDATEs `sent_steps = sent_steps || jsonb_build_object('STEP', now())` for that user.

---

## Schedule and flow

- **Trigger:** Cron every 30–60 min (e.g. `0 * * * *` = hourly).
- **Per run:** Loop over steps below. For each step: run the “Due” query → for each row send email → run the “After send” UPDATE.

---

## Step 1: Due query (who gets this email)

Use **Supabase** or **Postgres** node with **service_role**. Run the SQL for the step; pass step id as parameter if you use one parameterized query.

**Segment 2 Track A (trial)**

| Step | Due SQL |
|------|--------|
| **2A1** | `account_status = 'trial'` AND `trial_start` between (now() - 1 hour) and (now() - 15 min) AND NOT (sent_steps ? '2A1') |
| **2A2** | `account_status = 'trial'` AND `trial_start` between (now() - 25h) and (now() - 23h) AND NOT (sent_steps ? '2A2') |
| **2A3** | `account_status = 'trial'` AND `trial_start` between (now() - 50h) and (now() - 46h) AND NOT (sent_steps ? '2A3') |
| **2A4** | `account_status = 'trial'` AND (trial_end between now() and now() + 12h OR trial_start between (now() - 75h) and (now() - 69h)) AND NOT (sent_steps ? '2A4') |

**Segment 2 Track B (expired win-back)**

| Step | Due SQL |
|------|--------|
| **2B1** | `account_status = 'expired'` AND `trial_end` between (now() - 24h) and now() AND NOT (sent_steps ? '2B1') |
| **2B2** | `account_status != 'paid'` AND sent_steps ? '2B1' AND (sent_steps->>'2B1')::timestamptz between (now() - 7d) and (now() - 5d) AND NOT (sent_steps ? '2B2') |
| **2B3** | `account_status != 'paid'` AND sent_steps ? '2B2' AND (sent_steps->>'2B2')::timestamptz between (now() - 10d) and (now() - 7d) AND NOT (sent_steps ? '2B3') |

**Segment 3 (paid)**

| Step | Due SQL |
|------|--------|
| **3-1** | `account_status = 'paid'` AND `paid_at` between (now() - 24h) and (now() - 15 min) AND NOT (sent_steps ? '3-1') |
| **3-2** | `account_status = 'paid'` AND `paid_at` between (now() - 7d) and (now() - 5d) AND NOT (sent_steps ? '3-2') |
| **3-3** | `account_status = 'paid'` AND `paid_at` between (now() - 21d) and (now() - 14d) AND NOT (sent_steps ? '3-3') |
| **3-4** | `account_status = 'paid'` AND `paid_at` between (now() - 31d) and (now() - 29d) AND NOT (sent_steps ? '3-4') |
| **3-5** | `account_status = 'paid'` AND `subscription_ends_at` between (now() + 3d) and (now() + 5d) AND NOT (sent_steps ? '3-5') |

**Common filter:** `email IS NOT NULL AND email != ''`.

---

## Ready-to-use SQL (paste per step in n8n)

Replace `'STEP'` with the step id (e.g. `'2A1'`, `'3-2'`). For 2B2/2B3 use the previous step id in the date check.

**2A1**
```sql
SELECT * FROM email_sequence_recipients
WHERE account_status = 'trial' AND trial_start IS NOT NULL
  AND trial_start >= (now() - interval '1 hour') AND trial_start <= (now() - interval '15 minutes')
  AND (sent_steps IS NULL OR NOT (sent_steps ? '2A1'))
  AND email IS NOT NULL AND email != '';
```

**2A2**
```sql
SELECT * FROM email_sequence_recipients
WHERE account_status = 'trial' AND trial_start IS NOT NULL
  AND trial_start >= (now() - interval '25 hours') AND trial_start <= (now() - interval '23 hours')
  AND (sent_steps IS NULL OR NOT (sent_steps ? '2A2'))
  AND email IS NOT NULL AND email != '';
```

**2A3**
```sql
SELECT * FROM email_sequence_recipients
WHERE account_status = 'trial' AND trial_start IS NOT NULL
  AND trial_start >= (now() - interval '50 hours') AND trial_start <= (now() - interval '46 hours')
  AND (sent_steps IS NULL OR NOT (sent_steps ? '2A3'))
  AND email IS NOT NULL AND email != '';
```

**2A4**
```sql
SELECT * FROM email_sequence_recipients
WHERE account_status = 'trial'
  AND ( (trial_end IS NOT NULL AND trial_end >= now() AND trial_end <= (now() + interval '12 hours'))
     OR (trial_start >= (now() - interval '75 hours') AND trial_start <= (now() - interval '69 hours')) )
  AND (sent_steps IS NULL OR NOT (sent_steps ? '2A4'))
  AND email IS NOT NULL AND email != '';
```

**2B1**
```sql
SELECT * FROM email_sequence_recipients
WHERE account_status = 'expired' AND trial_end IS NOT NULL
  AND trial_end >= (now() - interval '24 hours') AND trial_end <= now()
  AND (sent_steps IS NULL OR NOT (sent_steps ? '2B1'))
  AND email IS NOT NULL AND email != '';
```

**2B2**
```sql
SELECT * FROM email_sequence_recipients
WHERE account_status != 'paid' AND account_status IS NOT NULL
  AND sent_steps ? '2B1'
  AND (sent_steps->>'2B1')::timestamptz >= (now() - interval '7 days')
  AND (sent_steps->>'2B1')::timestamptz <= (now() - interval '5 days')
  AND (sent_steps IS NULL OR NOT (sent_steps ? '2B2'))
  AND email IS NOT NULL AND email != '';
```

**2B3**
```sql
SELECT * FROM email_sequence_recipients
WHERE account_status != 'paid' AND account_status IS NOT NULL
  AND sent_steps ? '2B2'
  AND (sent_steps->>'2B2')::timestamptz >= (now() - interval '10 days')
  AND (sent_steps->>'2B2')::timestamptz <= (now() - interval '7 days')
  AND (sent_steps IS NULL OR NOT (sent_steps ? '2B3'))
  AND email IS NOT NULL AND email != '';
```

**3-1**
```sql
SELECT * FROM email_sequence_recipients
WHERE account_status = 'paid' AND paid_at IS NOT NULL
  AND paid_at >= (now() - interval '24 hours') AND paid_at <= (now() - interval '15 minutes')
  AND (sent_steps IS NULL OR NOT (sent_steps ? '3-1'))
  AND email IS NOT NULL AND email != '';
```

**3-2**
```sql
SELECT * FROM email_sequence_recipients
WHERE account_status = 'paid' AND paid_at IS NOT NULL
  AND paid_at >= (now() - interval '7 days') AND paid_at <= (now() - interval '5 days')
  AND (sent_steps IS NULL OR NOT (sent_steps ? '3-2'))
  AND email IS NOT NULL AND email != '';
```

**3-3**
```sql
SELECT * FROM email_sequence_recipients
WHERE account_status = 'paid' AND paid_at IS NOT NULL
  AND paid_at >= (now() - interval '21 days') AND paid_at <= (now() - interval '14 days')
  AND (sent_steps IS NULL OR NOT (sent_steps ? '3-3'))
  AND email IS NOT NULL AND email != '';
```

**3-4**
```sql
SELECT * FROM email_sequence_recipients
WHERE account_status = 'paid' AND paid_at IS NOT NULL
  AND paid_at >= (now() - interval '31 days') AND paid_at <= (now() - interval '29 days')
  AND (sent_steps IS NULL OR NOT (sent_steps ? '3-4'))
  AND email IS NOT NULL AND email != '';
```

**3-5**
```sql
SELECT * FROM email_sequence_recipients
WHERE account_status = 'paid' AND subscription_ends_at IS NOT NULL
  AND subscription_ends_at >= (now() + interval '3 days') AND subscription_ends_at <= (now() + interval '5 days')
  AND (sent_steps IS NULL OR NOT (sent_steps ? '3-5'))
  AND email IS NOT NULL AND email != '';
```

---

## Step 2: After send — record the step

For **each** recipient you just emailed, run one UPDATE so the step is not sent again. In n8n: after “Send email” node, loop over items and run this (with `user_id` and step id from the item).

**SQL (use Supabase “Execute SQL” or Postgres node):**
```sql
UPDATE email_sequence_recipients
SET sent_steps = COALESCE(sent_steps, '{}') || jsonb_build_object('STEP', (now() at time zone 'utc')::text)
WHERE user_id = 'USER_ID';
```

- Replace `USER_ID` with the current row’s `user_id` (e.g. from n8n expression `{{ $json.user_id }}`).

- Replace `STEP` with the step id (e.g. `2A1`). Replace `USER_ID` with the row's `user_id` (e.g. in n8n: `{{ $json.user_id }}`). Timestamp as text lets 2B2/2B3 use `(sent_steps->>'2B1')::timestamptz`.

---

## n8n workflow structure (minimal)

1. **Schedule** (Cron, hourly).
2. **Loop** over steps: `['2A1','2A2','2A3','2A4','2B1','2B2','2B3','3-1','3-2','3-3','3-4','3-5']`.
3. **Per step:**  
   - **Supabase** (service_role): run the “Due” SQL for this step → returns 0 or more rows.  
   - **If items:** for each item → **Send email** (Resend/SendGrid; use `email`, `name`, `top_problems` from item) → **Supabase** run “After send” UPDATE with this item’s `user_id` and current step id.  
   - If no items, do nothing for this step.
4. No webhooks; no second table. One table, one schedule.
