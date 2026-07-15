-- Bank-flow views over fdw_bank_feed_txn (live Plaid Chase feed).
-- Plaid sign convention: amount > 0 = money OUT (debit), amount < 0 = money IN (credit).
-- So inflow = -sum(amount<0), outflow = sum(amount>0), net change = -sum(amount).
-- Settled only (pending = false) so weekly actuals don't wobble.

-- 1) Weekly combined flow across all accounts (Monday-anchored weeks).
CREATE OR REPLACE VIEW fdw_v_bank_weekly AS
SELECT date_trunc('week', posted_date)::date                                   AS week_start,
       coalesce(-sum(amount) FILTER (WHERE amount < 0), 0)::numeric(14,2)      AS inflow,
       coalesce( sum(amount) FILTER (WHERE amount > 0), 0)::numeric(14,2)      AS outflow,
       coalesce(-sum(amount), 0)::numeric(14,2)                                AS net,
       count(*)                                                                AS txns
FROM fdw_bank_feed_txn
WHERE pending = false
GROUP BY 1;

-- 2) Per-account totals over the loaded window (~90d).
CREATE OR REPLACE VIEW fdw_v_bank_account AS
SELECT account_last4,
       max(account_name)                                                       AS account_name,
       coalesce(-sum(amount) FILTER (WHERE amount < 0), 0)::numeric(14,2)      AS inflow,
       coalesce( sum(amount) FILTER (WHERE amount > 0), 0)::numeric(14,2)      AS outflow,
       coalesce(-sum(amount), 0)::numeric(14,2)                                AS net,
       count(*)                                                                AS txns,
       max(posted_date)                                                        AS last_txn
FROM fdw_bank_feed_txn
WHERE pending = false
GROUP BY account_last4;

-- 3) Recurring-outflow candidates: same normalized payee + same amount, >=3 times,
--    spanning >=20 days. Cadence is computed in the API from span/count.
CREATE OR REPLACE VIEW fdw_v_bank_recurring AS
WITH normed AS (
  SELECT
    CASE
      WHEN raw_desc ILIKE 'ORIG CO NAME:%'
        THEN upper(btrim(regexp_replace(regexp_replace(raw_desc, '^ORIG CO NAME:', '', 'i'), '\s*ORIG ID.*$', '', 'i')))
      WHEN raw_desc ILIKE 'Zelle payment to %'
        THEN 'ZELLE: ' || upper(btrim(regexp_replace(regexp_replace(raw_desc, '^Zelle payment to ', '', 'i'), '\s*[0-9].*$', '', 'i')))
      ELSE upper(btrim(regexp_replace(substring(raw_desc from 1 for 30), '\s*[0-9#*/].*$', '', 'g')))
    END                              AS merchant,
    round(amount::numeric, 2)        AS amount,   -- amount > 0 = outflow
    posted_date,
    account_last4,
    account_name,
    category
  FROM fdw_bank_feed_txn
  WHERE amount > 0 AND pending = false
    -- drop internal account-to-account sweeps (not bills)
    AND raw_desc NOT ILIKE 'ONLINE TRANSFER TO %'
    AND raw_desc NOT ILIKE 'ONLINE TRANSFER FROM %'
)
SELECT merchant,
       amount,
       count(*)                          AS n,
       min(posted_date)                  AS first_seen,
       max(posted_date)                  AS last_seen,
       (max(posted_date) - min(posted_date)) AS span_days,
       max(account_last4)                AS acct_last4,
       max(account_name)                 AS acct_name,
       mode() WITHIN GROUP (ORDER BY category) AS category
FROM normed
WHERE merchant <> '' AND length(merchant) >= 3
GROUP BY merchant, amount
HAVING count(*) >= 3 AND (max(posted_date) - min(posted_date)) >= 20;
