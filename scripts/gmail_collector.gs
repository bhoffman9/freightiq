/**
 * FreightIQ Gmail Collector  (Google Apps Script — runs AS you, no admin needed)
 * -----------------------------------------------------------------------------
 * Watches allow-listed Gmail LABELS, forwards new messages' attachments (and,
 * for flagged labels, body text) to the FreightIQ ingestion endpoint. It is a
 * dumb pickup truck: no parsing here — extraction/validation happens server-side.
 *
 * SETUP (one time):
 *   1. script.google.com → New project → paste this file.
 *   2. Fill CONFIG below (ENDPOINT + SECRET). Generate SECRET yourself (any long
 *      random string) and put the SAME value in Vercel env FDW_INGEST_SECRET.
 *   3. Run `installTrigger` once (authorize when prompted — it runs as you).
 *   4. Optional: run `testOnce` to push the last few labeled emails immediately.
 *
 * Dedup is server-side by Gmail message id, so re-sends are harmless. A per-label
 * watermark (Script Properties) avoids re-sending old mail every run.
 */

const CONFIG = {
  ENDPOINT: 'https://freightiq-nine-two.vercel.app/api/fdw-ingest',
  SECRET:   'PASTE_A_LONG_RANDOM_SECRET_HERE',   // must match Vercel FDW_INGEST_SECRET
  LOOKBACK_DAYS: 14,          // safety window on first run / after gaps
  MAX_MSGS_PER_RUN: 40,       // throttle so we stay under the 6-min limit
  MAX_ATTACHMENTS_PER_MSG: 6, // must match server MAX_ATTACHMENTS
  MAX_ATTACHMENT_BYTES: 8 * 1024 * 1024,    // must match server
  MAX_TOTAL_BYTES: 18 * 1024 * 1024,        // must match server

  // Only these labels are ingested. body:true also forwards the email body text
  // (server marks those 'pending_review'). Add labels here as you create them.
  LABELS: [
    { name: 'EFS',             source: 'efs_fuel',        body: false },
    { name: 'PENSKE',          source: 'truck_penske',    body: false },
    { name: 'RYDER',           source: 'truck_ryder',     body: false },
    { name: 'TCI',             source: 'truck_tci',       body: false },
    { name: 'TEC',             source: 'truck_tec',        body: false },
    { name: 'IDEALEASE',       source: 'truck_idealease', body: false },
    { name: 'MCKINNEY',        source: 'trailer_mckinney',body: false },
    { name: 'PREMIER',         source: 'trailer_premier', body: false },
    { name: 'Ten Trailers',    source: 'trailer_ten',     body: false },
    { name: 'UTILITY TRAILER', source: 'trailer_utility', body: false },
    // { name: 'CE FINANCE',    source: 'finance',         body: true  },
  ],

  ALLOWED_TYPES: ['pdf', 'xls', 'xlsx', 'csv'],   // attachment extensions to send
};

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('collect').timeBased().everyMinutes(10).create();
  Logger.log('Trigger installed: collect() every 10 min.');
}

function testOnce() { collect(); }

function collect() {
  const props = PropertiesService.getScriptProperties();
  let sent = 0;

  for (const cfg of CONFIG.LABELS) {
    if (sent >= CONFIG.MAX_MSGS_PER_RUN) break;
    const label = GmailApp.getUserLabelByName(cfg.name);
    if (!label) { Logger.log('Label not found (skipping): ' + cfg.name); continue; }

    const wmKey = 'wm_' + cfg.name;
    const wm = Number(props.getProperty(wmKey) || 0);
    const floor = Math.max(wm, Date.now() - CONFIG.LOOKBACK_DAYS * 864e5);
    let newest = wm;

    // Flatten label's recent threads → messages newer than the watermark.
    const msgs = [];
    label.getThreads(0, 60).forEach(th =>
      th.getMessages().forEach(m => {
        const t = m.getDate().getTime();
        if (t > floor) msgs.push(m);
      })
    );
    msgs.sort((a, b) => a.getDate() - b.getDate());

    for (const m of msgs) {
      if (sent >= CONFIG.MAX_MSGS_PER_RUN) break;
      try {
        if (forward(m, cfg)) sent++;
        newest = Math.max(newest, m.getDate().getTime());
      } catch (e) {
        Logger.log('forward error [' + cfg.name + ']: ' + e);
        // leave watermark below this msg so it retries next run
        break;
      }
    }
    if (newest > wm) props.setProperty(wmKey, String(newest));
  }
  Logger.log('collect() sent ' + sent + ' message(s).');
}

function forward(msg, cfg) {
  let totalBytes = 0;
  const atts = msg.getAttachments({ includeInlineImages: false, includeAttachments: true })
    .filter(a => {
      const ext = (a.getName().split('.').pop() || '').toLowerCase();
      const size = a.getSize();
      if (CONFIG.ALLOWED_TYPES.indexOf(ext) < 0) return false;
      if (size > CONFIG.MAX_ATTACHMENT_BYTES) return false;
      if (totalBytes + size > CONFIG.MAX_TOTAL_BYTES) return false;
      totalBytes += size;
      return true;
    })
    .slice(0, CONFIG.MAX_ATTACHMENTS_PER_MSG)
    .map(a => ({
      filename: a.getName(),
      mimeType: a.getContentType(),
      dataB64:  Utilities.base64Encode(a.getBytes()),
    }));

  if (atts.length === 0 && !cfg.body) return false;   // nothing to send

  const payload = {
    messageId: msg.getId(),
    label:     cfg.name,
    source:    cfg.source,
    from:      msg.getFrom(),
    subject:   msg.getSubject(),
    date:      msg.getDate().toISOString(),
    body:      cfg.body ? msg.getPlainBody().slice(0, 20000) : null,
    attachments: atts,
  };

  const res = UrlFetchApp.fetch(CONFIG.ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-FDW-Secret': CONFIG.SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('HTTP ' + code + ': ' + res.getContentText().slice(0, 200));
  return true;
}
