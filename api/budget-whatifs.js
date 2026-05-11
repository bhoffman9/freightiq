// Budget what-if scenarios — shared via Supabase.
// GET    /api/budget-whatifs            -> list active scenarios (newest first)
// POST   /api/budget-whatifs            -> body { label, amount, frequency: 'weekly'|'monthly' }
// PATCH  /api/budget-whatifs?id=...     -> body { active?, label?, amount?, frequency? }
// DELETE /api/budget-whatifs?id=...     -> remove

import { getSupabase } from './_qbo-helpers.js';

const TABLE = 'freightiq_budget_whatifs';

function badReq(res, msg) {
  return res.status(400).json({ error: msg });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        // Likely the table doesn't exist yet — surface a clear setup message
        if (/relation .* does not exist/i.test(error.message || '')) {
          return res.status(503).json({
            error: 'table-not-found',
            message: 'Run supabase/migrations/freightiq_budget_whatifs.sql in the Supabase SQL editor (project bhdaiddrfeqtwjlsfifx) to create the freightiq_budget_whatifs table.',
          });
        }
        throw error;
      }
      return res.json({ scenarios: data || [] });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const label = String(body.label || '').trim();
      const amount = Number(body.amount);
      const frequency = String(body.frequency || '').trim();
      if (!label) return badReq(res, 'label required');
      if (!isFinite(amount) || amount < 0) return badReq(res, 'amount must be a non-negative number');
      if (!['weekly', 'monthly'].includes(frequency)) return badReq(res, "frequency must be 'weekly' or 'monthly'");

      const { data, error } = await supabase
        .from(TABLE)
        .insert({ label, amount, frequency, active: true })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json({ scenario: data });
    }

    if (req.method === 'PATCH') {
      const id = String(req.query.id || '').trim();
      if (!id) return badReq(res, 'id query param required');
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const patch = {};
      if ('active' in body) patch.active = Boolean(body.active);
      if ('label' in body && body.label != null) patch.label = String(body.label).trim();
      if ('amount' in body && body.amount != null) {
        const n = Number(body.amount);
        if (!isFinite(n) || n < 0) return badReq(res, 'amount must be a non-negative number');
        patch.amount = n;
      }
      if ('frequency' in body && body.frequency != null) {
        if (!['weekly', 'monthly'].includes(body.frequency)) return badReq(res, "frequency must be 'weekly' or 'monthly'");
        patch.frequency = body.frequency;
      }
      if (Object.keys(patch).length === 0) return badReq(res, 'no valid fields to update');
      patch.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from(TABLE)
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ scenario: data });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '').trim();
      if (!id) return badReq(res, 'id query param required');
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
      return res.status(204).end();
    }

    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (e) {
    console.error('budget-whatifs error:', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
