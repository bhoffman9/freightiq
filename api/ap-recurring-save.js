// POST /api/ap-recurring-save — add or update a Budget Calendar recurring row
// (w_custom_recurring) from a bank-feed candidate. Writes directly to the same
// table the Budget Calendar tab uses; safe against its diff-based sync (it only
// deletes ids it previously synced and only upserts rows it changed, so an
// external insert/update is preserved and shows up on the calendar's next load).
//
// Body:
//   { action:'add', name, amount, account, recur_type, recur_day }
//   { action:'update', id, amount, account? }
// Gated by the app password (x-ap-key), same as other /api/ap-* routes.
import { getSupabase } from './_qbo-helpers.js';
import { requireApAuth } from './_ap-auth.js';

const VALID_RECUR = new Set(['monthly-date', 'weekly-day']);

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }); }
  if (!requireApAuth(req, res)) return;

  const b = req.body || {};
  const amount = Number(b.amount);
  const needsAmount = ['add', 'update', 'onetime'].includes(b.action);
  if (needsAmount && (!isFinite(amount) || amount <= 0)) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  try {
    const sb = getSupabase();

    if (b.action === 'update') {
      if (!b.id) return res.status(400).json({ error: 'id required for update' });
      const patch = { amount };
      if (typeof b.account === 'string' && b.account) patch.account = b.account;
      const { data, error } = await sb.from('w_custom_recurring').update(patch).eq('id', b.id).select().single();
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true, action: 'update', row: data });
    }

    if (b.action === 'add') {
      const name = String(b.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name required' });
      const recur_type = VALID_RECUR.has(b.recur_type) ? b.recur_type : 'monthly-date';
      let recur_day = parseInt(b.recur_day, 10);
      if (!Number.isFinite(recur_day)) recur_day = 1;
      recur_day = recur_type === 'weekly-day'
        ? Math.min(7, Math.max(1, recur_day))
        : Math.min(31, Math.max(1, recur_day));
      const account = String(b.account || 'SF').trim();

      // id convention matches the Budget Calendar app: cr-<ms>-<rand>
      const id = `cr-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

      // guard against an obvious dup (same name+amount already present)
      const { data: dup } = await sb.from('w_custom_recurring')
        .select('id').ilike('name', name).eq('amount', amount).limit(1);
      if (dup && dup.length) return res.status(200).json({ ok: true, action: 'skipped-duplicate', id: dup[0].id });

      const row = { id, name, amount, account, recur_type, recur_day };
      const { error } = await sb.from('w_custom_recurring').insert(row);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true, action: 'add', row });
    }

    // Write a dated one-time expense (e.g. a payroll transfer) into the calendar.
    if (b.action === 'onetime') {
      const name = String(b.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name required' });
      const day = parseInt(b.day, 10), month = parseInt(b.month, 10), year = parseInt(b.year, 10);
      if (!(day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020)) {
        return res.status(400).json({ error: 'valid day/month/year required' });
      }
      // The calendar stores w_one_time_expenses.month 0-INDEXED (0=Jan). Callers
      // pass 1-indexed (getMonth()+1), so convert here — otherwise the expense
      // lands a month late in the calendar.
      const month0 = month - 1;
      const account = String(b.account || '').trim();
      // idempotent per (name, month, year): update if it already exists, else insert
      const { data: dup } = await sb.from('w_one_time_expenses')
        .select('id').ilike('name', name).eq('month', month0).eq('year', year).limit(1);
      if (dup && dup.length) {
        const { error } = await sb.from('w_one_time_expenses').update({ amount, day, account }).eq('id', dup[0].id);
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true, action: 'onetime-updated', id: dup[0].id });
      }
      const id = `exp-oneoff-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const row = { id, name, amount, day, month: month0, year, account };
      const { error } = await sb.from('w_one_time_expenses').insert(row);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true, action: 'onetime', row });
    }

    // Remove a user-added recurring bill (w_custom_recurring) — used when a
    // tracked bill never clears the bank. Hardcoded calendar bills can't be
    // removed this way (they're not table rows).
    if (b.action === 'remove-recurring') {
      if (!b.id) return res.status(400).json({ error: 'id required for remove-recurring' });
      const { error } = await sb.from('w_custom_recurring').delete().eq('id', b.id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true, action: 'remove-recurring', id: b.id });
    }

    return res.status(400).json({ error: "action must be 'add', 'update', 'onetime', or 'remove-recurring'" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
