#!/usr/bin/env python3
"""BiteCast: φτιάχνει το index.ts της Supabase Edge Function «quick-processor»
από τα forecast.js + safety-job.mjs του repo, ώστε η συνάρτηση να τρέχει ακριβώς τον ίδιο κώδικα με την εφαρμογή.
Χρήση: python3 build_edge.py  -> γράφει quick-processor-index.ts
Μετά: Supabase → Edge Functions → quick-processor → Code → αντικατάσταση όλου του index.ts → Deploy."""
import re

fc = open("forecast.js", encoding="utf-8").read()
sj = open("safety-job.mjs", encoding="utf-8").read()

# safety-job: χωρίς τα κομμάτια του Node (import και εκτέλεση από τη γραμμή εντολών)
sj = re.sub(r"^import \{ pathToFileURL \} from 'node:url';\n", "", sj, flags=re.M)
cut = sj.find("if (import.meta.url === pathToFileURL(")
if cut < 0:
    raise SystemExit("safety-job.mjs: δεν βρέθηκε το τμήμα CLI")
sj = sj[:cut].rstrip() + "\n"

HANDLER = r"""
// ---- handler ----
let vapidSet = false;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const secret = Deno.env.get('CRON_SECRET');
  const E = k => Deno.env.get(k) || '';
  const env = {
    SUPABASE_URL: E('SUPABASE_URL'),
    SUPABASE_SERVICE_KEY: E('SERVICE_KEY') || E('SUPABASE_SERVICE_ROLE_KEY'),
    TELEGRAM_BOT_TOKEN: E('TELEGRAM_BOT_TOKEN'),
  };
  const isCron = !!secret && req.headers.get('x-cron-secret') === secret;
  if (!isCron) {
    // Διαδρομή εφαρμογής: άμεσο «ξεκίνησε/γύρισε» για μία έξοδο του συνδεδεμένου χρήστη (έλεγχος με το token του χρήστη).
    const auth = req.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+/.test(auth)) return J({ ok: false, error: 'forbidden' }, 403);
    let body = {}; try { body = await req.json(); } catch (e) { /* κενό */ }
    if (!body || body.action !== 'trip' || !/^[\w.-]{3,80}$/.test(String(body.id || '')) || !['start', 'end'].includes(body.phase)) return J({ ok: false, error: 'bad request' }, 400);
    try {
      const u = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: auth } });
      if (!u.ok) return J({ ok: false, error: 'unauthorized' }, 401);
      const uid = (await u.json()).id; if (!uid) return J({ ok: false, error: 'unauthorized' }, 401);
      const r = await run({ env, sendMail: null, log: m => console.log(String(m)), only: { uid, id: body.id, phase: body.phase } });
      return J(r);
    } catch (e) { console.log('trip error: ' + e.message); return J({ ok: false, error: e.message }, 500); }
  }
  let wp = null;
  if (E('VAPID_PUBLIC') && E('VAPID_PRIVATE')) {
    try {
      if (!vapidSet) { webpush.setVapidDetails('https://dinospapani.github.io/Pasrovarka/', E('VAPID_PUBLIC'), E('VAPID_PRIVATE')); vapidSet = true; }
      wp = webpush;
    } catch (e) { console.log('VAPID: ' + e.message); }
  }
  const logs = [];
  try {
    const r = await run({ env, PF, webpush: wp, sendMail: null, log: m => { logs.push(String(m)); console.log(m); } });
    return new Response(JSON.stringify({ ok: r.ok, stats: r.stats, logs }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.log('cron error: ' + e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message, logs }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
"""

out = (
    "// @ts-nocheck\n"
    "// BiteCast cron: forecast push, ασφάλεια εξόδων (Telegram), πτώση πίεσης. Παράγεται από build_edge.py. Μην το επεξεργάζεσαι στο χέρι.\n"
    "import webpush from 'npm:web-push@3.6.7';\n\n"
    "globalThis.self = globalThis.self || globalThis;\n"
    "// ---- forecast.js ----\n" + fc.rstrip() + "\n\nconst PF = self.PF;\n\n"
    "// ---- safety-job.mjs ----\n" + sj + "\n" + HANDLER
)
open("quick-processor-index.ts", "w", encoding="utf-8").write(out)
print("quick-processor-index.ts:", len(out), "bytes")
