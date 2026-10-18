// Sends the "App updated!" notification for a production deployment, right after it goes live.
//   node --env-file=.env scripts/announce-update.mjs <deployment id, e.g. dpl_abc123>
// It records the id in app_state first, so the scheduled reminder runs (which also announce new versions) will not
// send it a second time. Safe to run twice: the second run does nothing.
import { neon } from "@neondatabase/serverless";
import webpush from "web-push";
import { updateMessage } from "../src/lib/reminders-shared.ts";

const id = process.argv[2];
if (!id || !/^dpl_[A-Za-z0-9]+$/.test(id)) {
  console.error("Usage: node --env-file=.env scripts/announce-update.mjs dpl_xxxxxxxx");
  process.exit(1);
}
const { DATABASE_URL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
if (!DATABASE_URL || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
  console.error("DATABASE_URL and the three VAPID_* variables must be set.");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const claimed = await sql`
  insert into app_state (key, value) values ('announced_deploy', ${id})
  on conflict (key) do update set value = excluded.value, updated_at = now() where app_state.value <> excluded.value
  returning value`;
if (!claimed.length) {
  console.log("Already announced this deployment. Nothing sent.");
  process.exit(0);
}

const devices = await sql`select id, endpoint, p256dh, auth from push_subscriptions where updates and public_key = ${VAPID_PUBLIC_KEY}`;
const [nameRow] = await sql`select value from site_config where key = 'app_name'`;
const payload = JSON.stringify(updateMessage(id, nameRow?.value ?? undefined));
const result = { devices: devices.length, sent: 0, expired: 0, failed: 0 };
for (const d of devices) {
  try {
    await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, {
      TTL: 24 * 60 * 60,
      timeout: 8000,
      vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY },
    });
    result.sent++;
  } catch (e) {
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      await sql`delete from push_subscriptions where id = ${d.id}`;
      result.expired++;
    } else result.failed++;
  }
}
console.log("App updated announcement:", result);
