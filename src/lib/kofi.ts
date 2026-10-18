import { timingSafeEqual } from "node:crypto";
import { PAY_CODE_PATTERN } from "./shop.ts";

// ---------- Ko-fi webhook ----------
export type KofiPayment = { transactionId: string; cents: number; currency: string; code: string | null; type: string };

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Parses the JSON that Ko-fi sends (form field "data"). Returns null when it is not a genuine payment event: wrong or
 * missing verification token, unknown event type, missing transaction id, or a non-positive amount.
 */
export function parseKofiPayment(data: unknown, expectedToken: string | undefined): KofiPayment | null {
  if (!expectedToken || !data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.verification_token !== "string" || !safeEqual(d.verification_token, expectedToken)) return null;
  if (d.type !== "Donation" && d.type !== "Tip" && d.type !== "Shop Order") return null;
  const transactionId = typeof d.kofi_transaction_id === "string" ? d.kofi_transaction_id.trim() : "";
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(transactionId)) return null;
  const amount = Number(typeof d.amount === "string" ? d.amount : NaN);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000 || !/^\d+(?:\.\d{1,2})?$/.test(String(d.amount))) return null;
  const currency = typeof d.currency === "string" ? d.currency.toUpperCase() : "";
  const message = typeof d.message === "string" ? d.message : "";
  const found = message.match(PAY_CODE_PATTERN);
  return { transactionId: `kofi:${transactionId}`, cents: Math.round(amount * 100), currency, code: found ? `LEAN-${found[1].toUpperCase()}` : null, type: d.type };
}
