// Shop rules: items and prices (Singapore dollars, stored as cents), ticker text rules, payment codes and Ko-fi payment
// parsing. Pure functions only (no database or UI imports) so they can be unit-tested.

export type ShopItem = "ticker" | "avatar" | "meal" | "makeover" | "revamp" | "owner";

export const SHOP_ITEMS: Record<ShopItem, { cents: number; originalCents?: number; name: string; blurb: string; badge: string; instant: boolean }> = {
  ticker: { cents: 10, name: "Ticker takeover", blurb: "Change the scrolling ticker at the top, once.", badge: "CHEAP!", instant: true },
  avatar: { cents: 30, name: "Profile picture swap", blurb: "Change someone else's profile picture, once.", badge: "BEST DEAL!", instant: true },
  meal: { cents: 50, name: "Meal photo swap", blurb: "Replace a photo someone uploaded in the meal gallery, once.", badge: "SUPER DEAL!", instant: true },
  makeover: { cents: 200, name: "App makeover", blurb: "Change the app's icon and its name for everybody.", badge: "POWER!", instant: true },
  revamp: { cents: 2500, originalCents: 5000, name: "Huge revamp or troll", blurb: "Tell the owner what you want changed or pranked. The owner decides and does it by hand.", badge: "DISCOUNT! NOW", instant: false },
  owner: { cents: 10000, name: "Ownership of everything", blurb: "A crown and bragging rights, arranged with the owner. It never gives admin access.", badge: "BEST ONE!", instant: false },
};
export const SHOP_ITEM_KEYS = Object.keys(SHOP_ITEMS) as ShopItem[];
export const isShopItem = (v: unknown): v is ShopItem => typeof v === "string" && Object.hasOwn(SHOP_ITEMS, v);

/** 10 -> "S$0.10", 5000 -> "S$50.00". */
export const sgd = (cents: number) => `${cents < 0 ? "-" : ""}S$${(Math.abs(cents) / 100).toFixed(2)}`;

export const DEFAULT_APP_NAME = "+1lean";
export const MAX_APP_NAME_CHARS = 20;

/** App names are short and plain: one line, no links. Returns the cleaned name or an error message. */
export function validateAppName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Type a name for the app." };
  // eslint-disable-next-line no-control-regex
  const name = raw.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim();
  if ([...name].length < 2) return { ok: false, error: "The app name needs at least 2 characters." };
  if ([...name].length > MAX_APP_NAME_CHARS) return { ok: false, error: `Keep the app name to ${MAX_APP_NAME_CHARS} characters or fewer.` };
  if (/https?:\/\/|www\./i.test(name)) return { ok: false, error: "No links in the app name." };
  return { ok: true, name };
}

export const MAX_TICKER_CHARS = 100;

/** Returns the cleaned ticker text, or an error message. Content rules beyond this are checked by the AI moderator. */
export function validateTickerText(raw: unknown): { ok: true; text: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Type the ticker message." };
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 2) return { ok: false, error: "The ticker message needs at least 2 characters." };
  if ([...text].length > MAX_TICKER_CHARS) return { ok: false, error: `Keep it to ${MAX_TICKER_CHARS} characters or fewer.` };
  if (/https?:\/\/|www\./i.test(text)) return { ok: false, error: "No links in the ticker." };
  return { ok: true, text };
}

// ---------- Payment codes (typed into the Ko-fi message so a payment can be matched to an account) ----------
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O or 1/I to avoid typos
export const PAY_CODE_PATTERN = /\bLEAN-([23456789A-HJ-NP-Z]{6})\b/i;

export function makePayCode(randomBytes: ArrayLike<number>): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[randomBytes[i] % CODE_ALPHABET.length];
  return `LEAN-${out}`;
}
