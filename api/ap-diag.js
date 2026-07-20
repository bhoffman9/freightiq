// TEMP diagnostic — pull Chase (Plaid) contractor payments for the missing
// grid weeks (3/27–6/18). Gated. Remove after use.
import { getSupabase } from './_qbo-helpers.js';
import { requireApAuth } from './_ap-auth.js';

// name -> match tokens in the bank description
const PEOPLE = {
  'Hilda Salman': ['salman', 'hilda'],
  'Mellody Abrego': ['mellody', 'abrego'],
  'Debra Adamson': ['debra', 'adamson'],
  'Elizabeth Delgado': ['delgado', 'elizabeth'],
  'Christopher Simpson': ['simpson'],
  'Jon Marcus': ['marcus'],
  'Biniyam Fissehaye / ENM': ['fissehaye', 'biniyam', 'enm'],
};

export default async function handler(req, res) {
  if (!requireApAuth(req, res)) return;
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('fdw_bank_feed_txn')
      .select('posted_date,amount,raw_desc,account_last4,pending')
      .gte('posted_date', '2026-03-20').lte('posted_date', '2026-06-25')
      .order('posted_date', { ascending: true });
    if (error) throw error;

    const rng = (data || []).reduce((a, t) => {
      if (!a.min || t.posted_date < a.min) a.min = t.posted_date;
      if (!a.max || t.posted_date > a.max) a.max = t.posted_date;
      return a;
    }, {});
    const totalRange = await sb.from('fdw_bank_feed_txn').select('posted_date').order('posted_date', { ascending: true }).limit(1);
    const totalRangeMax = await sb.from('fdw_bank_feed_txn').select('posted_date').order('posted_date', { ascending: false }).limit(1);

    const out = {};
    for (const [name, toks] of Object.entries(PEOPLE)) {
      const hits = (data || []).filter((t) => {
        if (t.pending) return false;
        const d = String(t.raw_desc || '').toLowerCase();
        return toks.some((tk) => d.includes(tk)) && Number(t.amount) > 0; // outflow
      }).map((t) => ({ date: t.posted_date, amt: Number(t.amount), desc: (t.raw_desc || '').slice(0, 60), acct: t.account_last4 }));
      out[name] = { count: hits.length, total: Math.round(hits.reduce((s, h) => s + h.amt, 0)), hits };
    }
    return res.json({
      feedWindow: { earliest: totalRange.data?.[0]?.posted_date, latest: totalRangeMax.data?.[0]?.posted_date },
      queriedRange: rng, txnsInRange: (data || []).length,
      people: out,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
