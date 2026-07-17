-- Liveness heartbeat for the Gmail collector. The collector POSTs here at the end
-- of every run (even when it sends 0 messages), so we can tell "collector is dead"
-- (no recent heartbeat) apart from "no new invoices today" (heartbeat fresh, sent=0).
CREATE TABLE IF NOT EXISTS fdw_health (
  id         int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_seen  timestamptz,
  last_sent  int,
  last_fails int,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO fdw_health (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
