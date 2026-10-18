import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { pushPreferencesSchema } from "./push-validation.ts";
import { defaultPushPreferences, pushCategories } from "./push-shared.ts";
import { MEALS_NEEDED, REMINDER_KINDS, REMINDERS, isReminderKind, reminderMessage, reminderPath, updateMessage } from "./reminders-shared.ts";

const vercel = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as { crons: { path: string; schedule: string }[] };

test("every reminder has exactly one matching Vercel cron, and nothing else is scheduled", () => {
  for (const kind of REMINDER_KINDS) {
    const hits = vercel.crons.filter((c) => c.path === reminderPath(kind));
    assert.equal(hits.length, 1, kind);
    assert.equal(hits[0].schedule, REMINDERS[kind].cron, kind);
  }
  assert.equal(vercel.crons.length, REMINDER_KINDS.length);
});

test("UTC cron times equal the stated Singapore times (UTC+8)", () => {
  for (const kind of REMINDER_KINDS) {
    const [minute, hour, , , dow] = REMINDERS[kind].cron.split(" ");
    const sgtHour = (Number(hour) + 8) % 24;
    const [stated] = REMINDERS[kind].sgt.split(" ");
    assert.equal(`${String(sgtHour).padStart(2, "0")}:${minute.padStart(2, "0")}`, stated, kind);
    // The weekday only stays the same when the +8h shift does not cross midnight.
    if (dow !== "*") assert.ok(Number(hour) + 8 < 24, `${kind} would land on a different weekday in Singapore`);
  }
  assert.deepEqual(
    ["gym", "breakfast", "lunch", "dinner"].map((k) => REMINDERS[k as keyof typeof REMINDERS].sgt),
    ["08:00 daily", "10:00 daily", "14:00 daily", "20:00 daily"],
  );
});

test("meal reminders use 1, 2 and 3 meals as the thresholds", () => {
  assert.deepEqual(MEALS_NEEDED, { breakfast: 1, lunch: 2, dinner: 3 });
});

test("messages: the gym nudge uses the requested wording and alerts carry no health numbers", () => {
  assert.equal(reminderMessage("gym", "2026-10-18").body, "time to go to the gym?");
  for (const kind of REMINDER_KINDS.filter((k) => k !== "streak")) {
    const m = reminderMessage(kind, "2026-10-18");
    assert.ok(!/\d/.test((m.body + m.title).replaceAll("+1lean", "")), `${kind} should not contain digits (the app name +1lean aside)`);
    assert.equal(m.tag, `reminder-${kind}-2026-10-18`);
    assert.ok(m.url.startsWith("/log#"));
  }
  assert.equal(reminderMessage("streak", "2026-10-18").body, "Your gym streak resets tomorrow. Check in today to keep it going.");
  assert.equal(REMINDERS.streak.sgt, "18:00 daily");
  assert.notEqual(reminderMessage("lunch", "2026-10-18").tag, reminderMessage("lunch", "2026-10-19").tag);
});

test("update announcement says App updated and its tag changes per deployment", () => {
  assert.match(updateMessage("dpl_AAAA1111BBBB2222").body, /^App updated!/);
  assert.notEqual(updateMessage("dpl_AAAA1111BBBB2222").tag, updateMessage("dpl_CCCC3333DDDD4444").tag);
});

test("reminder kinds are validated", () => {
  assert.ok(isReminderKind("breakfast"));
  for (const bad of ["constructor", "__proto__", "", null, undefined, 1, "Breakfast"]) assert.equal(isReminderKind(bad), false);
});

test("new preferences exist, default on, and old clients that omit them still validate", () => {
  assert.equal(defaultPushPreferences.reminders, true);
  assert.equal(defaultPushPreferences.updates, true);
  assert.ok(pushCategories.some((c) => c.key === "reminders") && pushCategories.some((c) => c.key === "updates"));
  const parsed = pushPreferencesSchema.parse({ meals: true, gym: false, steps: true, weight: true });
  assert.equal(parsed.reminders, true);
  assert.equal(parsed.updates, true);
  assert.equal(pushPreferencesSchema.parse({ meals: true, gym: true, steps: true, weight: true, reminders: false, updates: false }).reminders, false);
});
