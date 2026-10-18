import { parseKofiPayment } from "./kofi.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_APP_NAME, MAX_APP_NAME_CHARS, MAX_TICKER_CHARS, SHOP_ITEMS, SHOP_ITEM_KEYS, isShopItem, makePayCode, sgd, validateAppName, validateTickerText } from "./shop.ts";

test("prices are exactly what was asked for, in Singapore cents", () => {
  assert.equal(SHOP_ITEMS.ticker.cents, 10);
  assert.equal(SHOP_ITEMS.avatar.cents, 30);
  assert.equal(SHOP_ITEMS.meal.cents, 50);
  assert.equal(SHOP_ITEMS.makeover.cents, 200);
  assert.equal(SHOP_ITEMS.revamp.cents, 2500);
  assert.equal(SHOP_ITEMS.revamp.originalCents, 5000);
  assert.equal(SHOP_ITEMS.revamp.badge, "DISCOUNT! NOW");
  assert.equal(SHOP_ITEMS.owner.cents, 10000);
  assert.deepEqual(SHOP_ITEM_KEYS.filter((k) => SHOP_ITEMS[k].instant), ["ticker", "avatar", "meal", "makeover"]);
});

test("money formats as Singapore dollars", () => {
  assert.equal(sgd(10), "S$0.10");
  assert.equal(sgd(30), "S$0.30");
  assert.equal(sgd(5), "S$0.05");
  assert.equal(sgd(5000), "S$50.00");
  assert.equal(sgd(10000), "S$100.00");
  assert.equal(sgd(0), "S$0.00");
  assert.equal(sgd(-30), "-S$0.30");
});

test("item keys are validated", () => {
  assert.ok(isShopItem("ticker"));
  for (const bad of ["constructor", "__proto__", "", null, 1, "Ticker"]) assert.equal(isShopItem(bad), false);
});

test("ticker text is cleaned and limited", () => {
  assert.deepEqual(validateTickerText("  hello   world \n"), { ok: true, text: "hello world" });
  assert.deepEqual(validateTickerText("a\u0007b\u0000c"), { ok: true, text: "a b c" });
  assert.equal(validateTickerText("x").ok, false);
  assert.equal(validateTickerText("").ok, false);
  assert.equal(validateTickerText(42).ok, false);
  assert.equal(validateTickerText("a".repeat(MAX_TICKER_CHARS)).ok, true);
  assert.equal(validateTickerText("a".repeat(MAX_TICKER_CHARS + 1)).ok, false);
  assert.equal(validateTickerText("visit https://spam.example now").ok, false);
  assert.equal(validateTickerText("go to www.spam.example").ok, false);
  assert.equal(validateTickerText("🗿".repeat(MAX_TICKER_CHARS)).ok, true); // counted as characters, not UTF-16 units
});

test("payment codes use an unambiguous alphabet and are stable for given bytes", () => {
  const code = makePayCode([0, 1, 2, 3, 4, 5]);
  assert.match(code, /^LEAN-[23456789A-HJ-NP-Z]{6}$/);
  assert.equal(code, makePayCode([0, 1, 2, 3, 4, 5]));
  for (let i = 0; i < 200; i++) assert.match(makePayCode(Array.from({ length: 6 }, () => Math.floor(Math.random() * 256))), /^LEAN-[23456789A-HJ-NP-Z]{6}$/);
});

const good = { verification_token: "tok", type: "Donation", kofi_transaction_id: "abc-123-XYZ", amount: "5.00", currency: "SGD", message: "top up please LEAN-ABC234 thanks" };

test("a genuine Ko-fi payment is parsed", () => {
  assert.deepEqual(parseKofiPayment(good, "tok"), { transactionId: "kofi:abc-123-XYZ", cents: 500, currency: "SGD", code: "LEAN-ABC234", type: "Donation" });
  assert.equal(parseKofiPayment({ ...good, type: "Shop Order", amount: "0.10" }, "tok")?.cents, 10);
  assert.equal(parseKofiPayment({ ...good, type: "Tip" }, "tok")?.cents, 500);
  assert.equal(parseKofiPayment({ ...good, message: "lean-abc234" }, "tok")?.code, "LEAN-ABC234"); // typed in lower case
  assert.equal(parseKofiPayment({ ...good, message: "no code here" }, "tok")?.code, null);
});

test("forged, malformed or unsupported Ko-fi calls are rejected", () => {
  assert.equal(parseKofiPayment(good, "other"), null); // wrong token
  assert.equal(parseKofiPayment(good, undefined), null); // not configured
  assert.equal(parseKofiPayment(good, ""), null);
  assert.equal(parseKofiPayment({ ...good, verification_token: undefined }, "tok"), null);
  assert.equal(parseKofiPayment({ ...good, type: "Subscription" }, "tok"), null);
  assert.equal(parseKofiPayment({ ...good, kofi_transaction_id: "" }, "tok"), null);
  assert.equal(parseKofiPayment({ ...good, kofi_transaction_id: "has spaces!" }, "tok"), null);
  for (const amount of ["0", "-5", "abc", "", "1e9", "1e2", "0.001", "10000.01", undefined]) assert.equal(parseKofiPayment({ ...good, amount }, "tok"), null, String(amount));
  assert.equal(parseKofiPayment(null, "tok"), null);
  assert.equal(parseKofiPayment("string", "tok"), null);
});

test("the app makeover costs S$2.00 and app names are short, plain and single line", () => {
  assert.equal(sgd(SHOP_ITEMS.makeover.cents), "S$2.00");
  assert.equal(DEFAULT_APP_NAME, "+1lean");
  assert.deepEqual(validateAppName("  Big   Gains "), { ok: true, name: "Big Gains" });
  assert.deepEqual(validateAppName("ab"), { ok: true, name: "ab" });
  assert.equal(validateAppName("a").ok, false);
  assert.equal(validateAppName("").ok, false);
  assert.equal(validateAppName(7).ok, false);
  assert.equal(validateAppName("x".repeat(MAX_APP_NAME_CHARS)).ok, true);
  assert.equal(validateAppName("x".repeat(MAX_APP_NAME_CHARS + 1)).ok, false);
  assert.equal(validateAppName("🗿".repeat(MAX_APP_NAME_CHARS)).ok, true);
  assert.equal(validateAppName("go to www.spam.example").ok, false);
  assert.deepEqual(validateAppName("line" + String.fromCharCode(10) + "break"), { ok: true, name: "line break" });
});
