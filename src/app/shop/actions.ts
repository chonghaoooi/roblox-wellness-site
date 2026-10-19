"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { requireDb } from "@/db";
import { moderateImage, moderateText } from "@/lib/ai";
import { getUser } from "@/lib/auth";
import { SHOP_ITEMS, isShopItem, sgd, validateAppName, validateTickerText, type ShopItem } from "@/lib/shop";
import { getBalance, purchasesLast24h, readJpeg } from "@/lib/shop-server";
import { purchaseSql } from "@/lib/shop-mutations";
import type { FormState } from "@/lib/validation";

async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

async function preflight(userId: number, item: ShopItem): Promise<FormState | null> {
  if ((await purchasesLast24h(userId)) >= 15) return { error: "That's the limit of 15 purchases a day. Try again tomorrow." };
  const balance = await getBalance(userId);
  return balance < SHOP_ITEMS[item].cents ? { error: `Not enough credit: this costs ${sgd(SHOP_ITEMS[item].cents)} and you have ${sgd(balance)}. Top up first.` } : null;
}

function refreshEverywhere() {
  revalidatePath("/", "layout");
}

async function purchase(userId: number, item: ShopItem, note: string | null, apply: SQL, target?: SQL): Promise<FormState | null> {
  try {
    const result = await requireDb().execute(purchaseSql(userId, item, note, apply, target));
    if (!result.rows.length) return { error: "Nothing was charged. Your balance, daily purchase limit or the selected item changed. Refresh and try again." };
  } catch {
    return { error: "The purchase couldn't be saved. Nothing was charged. Please try again." };
  }
  refreshEverywhere();
  return null;
}

export async function buyTicker(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const text = validateTickerText(fd.get("text"));
  if (!text.ok) return { error: text.error };
  const gate = await preflight(user.id, "ticker"); if (gate) return gate;
  const mod = await moderateText(text.text);
  if (!mod.ok) return { error: `That message was blocked: ${mod.reason}. You were not charged.` };
  const error = await purchase(user.id, "ticker", text.text, sql`
    insert into site_config (key, value)
    select v.key, v.value from (values ('ticker', ${text.text}), ('ticker_by', ${user.username})) v(key, value)
    where exists (select 1 from spent) on conflict (key) do update set value = excluded.value returning key`);
  return error ?? { ok: true, message: `Ticker changed. You paid ${sgd(SHOP_ITEMS.ticker.cents)}.` };
}

export async function buyAvatarSwap(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const targetId = Number(fd.get("target"));
  if (!Number.isSafeInteger(targetId) || targetId <= 0 || targetId === user.id) return { error: "Pick someone else. Your own picture is free in Settings below." };
  const gate = await preflight(user.id, "avatar"); if (gate) return gate;
  const photo = await readJpeg(fd); if ("error" in photo) return photo;
  const mod = await moderateImage(photo.buf);
  if (!mod.ok) return { error: `That picture was blocked: ${mod.reason}. You were not charged.` };
  const error = await purchase(user.id, "avatar", `user ${targetId}`, sql`
    insert into avatars (user_id, override_b64, override_by, override_at)
    select ${targetId}, ${photo.buf.toString("base64")}, id, now() from spent
    on conflict (user_id) do update set override_b64 = excluded.override_b64,
      override_by = excluded.override_by, override_at = now(), updated_at = now() returning user_id`,
    sql`select id from users where id = ${targetId} for update`);
  return error ?? { ok: true, message: `Picture swapped for ${sgd(SHOP_ITEMS.avatar.cents)}. They can restore it any time.` };
}

export async function buyMealSwap(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const mealId = Number(fd.get("meal"));
  if (!Number.isSafeInteger(mealId) || mealId <= 0) return { error: "Pick a meal photo." };
  const gate = await preflight(user.id, "meal"); if (gate) return gate;
  const photo = await readJpeg(fd); if ("error" in photo) return photo;
  const mod = await moderateImage(photo.buf);
  if (!mod.ok) return { error: `That photo was blocked: ${mod.reason}. You were not charged.` };
  const error = await purchase(user.id, "meal", `meal ${mealId}`, sql`
    update meals set original_b64 = coalesce(original_b64, data_b64), data_b64 = ${photo.buf.toString("base64")},
      edited_by = ${user.id}, edited_at = now()
    where id = ${mealId} and exists (select 1 from spent) returning id`,
    sql`select m.id from meals m join users u on u.id = m.user_id
      where m.id = ${mealId} and m.user_id <> ${user.id} and m.data_b64 is not null for update of m, u`);
  return error ?? { ok: true, message: `Meal photo swapped for ${sgd(SHOP_ITEMS.meal.cents)}. The uploader can restore their original.` };
}

export async function buyMakeover(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const rawName = String(fd.get("name") ?? "").trim();
  const file = fd.get("photo");
  const hasIcon = file instanceof File && file.size > 0;
  if (!rawName && !hasIcon) return { error: "Change the name, the icon, or both." };
  let name: string | null = null;
  if (rawName) { const v = validateAppName(rawName); if (!v.ok) return { error: v.error }; name = v.name; }
  const gate = await preflight(user.id, "makeover"); if (gate) return gate;
  let icon: Buffer | null = null;
  if (hasIcon) { const photo = await readJpeg(fd); if ("error" in photo) return photo; icon = photo.buf; }
  if (name) { const mod = await moderateText(name); if (!mod.ok) return { error: `That name was blocked: ${mod.reason}. You were not charged.` }; }
  if (icon) { const mod = await moderateImage(icon); if (!mod.ok) return { error: `That icon was blocked: ${mod.reason}. You were not charged.` }; }
  const values = [sql`('app_brand_by', ${user.username})`];
  if (name) values.push(sql`('app_name', ${name})`);
  if (icon) values.push(sql`('app_icon_b64', ${icon.toString("base64")})`, sql`('app_icon_v', ${randomUUID()})`);
  const error = await purchase(user.id, "makeover", [name, icon ? "new icon" : null].filter(Boolean).join(" + "), sql`
    insert into site_config (key, value) select v.key, v.value from (values ${sql.join(values, sql`, `)}) v(key, value)
    where exists (select 1 from spent) on conflict (key) do update set value = excluded.value returning key`);
  return error ?? { ok: true, message: `App updated for everybody for ${sgd(SHOP_ITEMS.makeover.cents)}. Existing phone icons may need removing and adding again.` };
}

export async function orderSpecial(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const item = fd.get("item");
  if (!isShopItem(item) || SHOP_ITEMS[item].instant) return { error: "Pick an item." };
  const note = String(fd.get("note") ?? "").trim();
  if ((item === "revamp" && note.length < 10) || note.length > 500) return { error: "Describe what you want, in 10 to 500 characters." };
  const gate = await preflight(user.id, item); if (gate) return gate;
  const error = await purchase(user.id, item, note || null, sql`
    insert into shop_orders (user_id, item, price_cents, note)
    select id, ${item}, ${SHOP_ITEMS[item].cents}, ${note || null} from spent returning id`);
  return error ?? { ok: true, message: `Order placed for ${sgd(SHOP_ITEMS[item].cents)}. The owner can fulfil it or refund the credit.` };
}

// ---------- Restore your original pictures ----------

export async function restoreMyAvatar() {
  const user = await requireUser();
  await requireDb().execute(sql`update avatars set override_b64 = null, override_by = null, override_at = null, updated_at = now() where user_id = ${user.id}`);
  refreshEverywhere();
}

export async function restoreMealPhoto(mealId: number) {
  const user = await requireUser();
  await requireDb().execute(sql`
    update meals set data_b64 = original_b64, original_b64 = null, edited_by = null, edited_at = null
    where id = ${mealId} and user_id = ${user.id} and original_b64 is not null`);
  refreshEverywhere();
}

// ---------- Your own profile picture (free) ----------

export async function setMyAvatar(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const photo = await readJpeg(fd);
  if ("error" in photo) return photo;
  const mod = await moderateImage(photo.buf);
  if (!mod.ok) return { error: `That picture was blocked: ${mod.reason}.` };
  await requireDb().execute(sql`
    insert into avatars (user_id, data_b64) values (${user.id}, ${photo.buf.toString("base64")})
    on conflict (user_id) do update set data_b64 = excluded.data_b64, updated_at = now()`);
  refreshEverywhere();
  return { ok: true, message: "Profile picture saved." };
}

export async function removeMyAvatar() {
  const user = await requireUser();
  await requireDb().execute(sql`update avatars set data_b64 = null, updated_at = now() where user_id = ${user.id}`);
  refreshEverywhere();
}
