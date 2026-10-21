// Private usage dashboard. Run: node --env-file=.env scripts/monitor.mjs
// Serves only on this PC's Tailscale address, so only devices on your tailnet can open it.
// Shows counts and sizes only, never user content.
import http from "node:http";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const PORT = Number(process.env.MONITOR_PORT ?? 4310);
const HISTORY = "design/monitor-history.json";
const SAMPLE_MS = 5 * 60 * 1000;
const sql = neon(process.env.DATABASE_URL);

// Limits are the free-plan figures as I understand them. Edit if your plan differs.
const NEON_STORAGE_LIMIT = 512 * 1024 * 1024;
// Last read by hand from the Vercel Usage page (Sep 20 - Oct 20). Vercel has no API for Hobby usage.
const VERCEL = [
  ["Active CPU", 50.4, 240, "min"], ["Origin transfer", 1.1, 10, "GB"], ["Blob storage", 110.76, 1024, "MB"],
  ["CDN requests", 61, 1000, "K"], ["Function invocations", 41, 1000, "K"], ["Memory", 5.2, 360, "GB-hrs"], ["Data transfer", 1.31, 100, "GB"],
];

const history = existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, "utf8")) : [];
let latest = null;

async function sample() {
  try {
    const [db] = await sql`select pg_database_size(current_database())::float8 as bytes, current_setting('neon.project_id', true) as project`;
    const tables = await sql`select c.relname as name, pg_total_relation_size(c.oid)::float8 as bytes, coalesce(s.n_live_tup, 0)::float8 as rows
      from pg_class c left join pg_stat_user_tables s on s.relid = c.oid where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace order by 2 desc`;
    const [counts] = await sql`select (select count(*) from users)::int as users, (select count(*) from meals)::int as meals, (select count(*) from logs)::int as logs`;
    latest = { at: Date.now(), bytes: db.bytes, project: db.project, tables, counts };
    history.push({ at: latest.at, bytes: db.bytes, ...counts });
    writeFileSync(HISTORY, JSON.stringify(history.slice(-2000)));
  } catch (e) {
    latest = { ...(latest ?? {}), error: String(e.message).replace(/postgres\S+/g, "[conn]"), at: Date.now() };
  }
}

const mb = (b) => (b / 1048576).toFixed(1);
const bar = (pct) => `<div class="t"><i style="width:${Math.min(100, pct).toFixed(1)}%;background:${pct > 80 ? "#e5484d" : pct > 50 ? "#f5a524" : "#30a46c"}"></i></div>`;

function page() {
  const d = latest;
  if (!d?.bytes) return `<p>Loading... ${d?.error ?? ""}</p><meta http-equiv=refresh content=3>`;
  const pct = (d.bytes / NEON_STORAGE_LIMIT) * 100;
  const first = history[0], days = Math.max((d.at - first.at) / 864e5, 1 / 24);
  const perDay = (d.bytes - first.bytes) / days;
  const eta = perDay > 0 ? Math.round((NEON_STORAGE_LIMIT - d.bytes) / perDay) : null;
  const spark = history.slice(-120).map((h) => h.bytes), lo = Math.min(...spark), hi = Math.max(...spark, lo + 1);
  const pts = spark.map((v, i) => `${(i / Math.max(spark.length - 1, 1)) * 600},${60 - ((v - lo) / (hi - lo)) * 56}`).join(" ");
  return `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta http-equiv=refresh content=30><title>+1lean usage</title>
<style>body{font:14px system-ui;background:#0e1116;color:#e6e8eb;max-width:760px;margin:0 auto;padding:16px}h1{font-size:20px}h2{font-size:15px;margin:26px 0 8px;color:#9aa4b2}
.r{display:flex;gap:10px;align-items:center;margin:7px 0}.r b{width:150px;font-weight:500}.t{flex:1;height:10px;background:#222a35;border-radius:5px;overflow:hidden}.t i{display:block;height:100%}.r span{width:170px;text-align:right;color:#9aa4b2;font-size:12px}
.k{display:flex;gap:12px;flex-wrap:wrap}.k div{background:#161b22;border-radius:8px;padding:10px 14px}.k b{font-size:22px;display:block}small,.n{color:#9aa4b2;font-size:12px}svg{width:100%;height:64px;background:#161b22;border-radius:8px}</style>
<h1>+1lean usage <small>updated ${new Date(d.at).toLocaleTimeString("en-SG", { timeZone: "Asia/Singapore" })} SGT, refreshes every 30s</small></h1>
${d.error ? `<p style="color:#e5484d">Last check failed: ${d.error}</p>` : ""}
<div class=k><div><b>${mb(d.bytes)} MB</b>database size</div><div><b>${d.counts.users}</b>users</div><div><b>${d.counts.meals}</b>meals</div><div><b>${d.counts.logs}</b>logs</div></div>
<h2>Neon database storage (${d.project})</h2>
<div class=r><b>Storage</b>${bar(pct)}<span>${mb(d.bytes)} of ${mb(NEON_STORAGE_LIMIT)} MB · ${pct.toFixed(1)}%</span></div>
<p class=n>Growth since tracking began (${new Date(first.at).toLocaleDateString("en-SG")}): ${(perDay / 1048576).toFixed(2)} MB/day${eta ? ` → about ${eta} days until full at this rate` : ""}. Samples every 5 min while this runs.</p>
<svg viewBox="0 0 600 64" preserveAspectRatio=none><polyline fill=none stroke="#30a46c" stroke-width=2 points="${pts}"/></svg>
<h2>Tables</h2>
${d.tables.slice(0, 12).map((t) => `<div class=r><b>${t.name}</b>${bar((t.bytes / d.bytes) * 100)}<span>${mb(t.bytes)} MB · ~${Math.round(t.rows)} rows</span></div>`).join("")}
<h2>Vercel Hobby (manual snapshot, Sep 20 - Oct 20)</h2>
${VERCEL.map(([n, u, l, unit]) => `<div class=r><b>${n}</b>${bar((u / l) * 100)}<span>${u} of ${l} ${unit} · ${((u / l) * 100).toFixed(0)}%</span></div>`).join("")}
<p class=n>Not measurable from here: Neon compute hours (limit about 100/month) and data transfer (about 5 GB/month). Check the Neon console. Vercel figures are typed in and go stale; update VERCEL in scripts/monitor.mjs.</p>`;
}

const ip = execFileSync("tailscale", ["ip", "-4"]).toString().trim().split(/\s+/)[0];
await sample();
setInterval(sample, SAMPLE_MS);
http.createServer((req, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); res.end(page()); })
  .listen(PORT, ip, () => console.log(`Dashboard: http://${ip}:${PORT}`));
