import Link from "next/link";
import { Leaderboard } from "@/components/Leaderboard";
import { AvatarSettings, AvatarSwapBuy, MakeoverBuy, MealSwapBuy, ShopCard, SpecialBuy, TickerBuy } from "@/components/ShopForms";
import { SettingsForm } from "@/components/forms";
import { SectionTitle, fmt } from "@/components/ui";
import { getSettings, getUser } from "@/lib/auth";
import { prankableMeals, prankablePeople, recentLedger, myShopState, tickerInfo, topSpenders } from "@/lib/queries";
import { SHOP_ITEMS, sgd } from "@/lib/shop";
import { getBalance, getPayCode } from "@/lib/shop-server";
import { getAppBrand, getTickerMessage } from "@/lib/site-config";

export const metadata = { title: "Shop" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ShopPage() {
  const user = await getUser();
  const [spenders, ticker, tickerBy, brand] = await Promise.all([topSpenders(), getTickerMessage(), tickerInfo(), getAppBrand()]);
  const mine = user
    ? await Promise.all([getBalance(user.id), getPayCode(user.id), prankablePeople(user.id), prankableMeals(user.id), recentLedger(user.id), myShopState(user.id), getSettings(user.id)])
    : null;
  const [balance, payCode, people, meals, ledger, state, settings] = mine ?? [0, "", [], [], [], null, null];
  const kofi = process.env.KOFI_URL;
  const autoTopup = Boolean(kofi && process.env.KOFI_VERIFICATION_TOKEN);
  const disabled = !user;

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-3 py-6 sm:px-4 sm:py-10">
      <SectionTitle>SHOP</SectionTitle>

      {/* Wallet */}
      <section className="panel space-y-3 p-5" aria-label="Your credit">
        {user ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-wide">Your credit</p>
            <p className="neon text-5xl">{sgd(balance)}</p>
            <div className="rounded-lg bg-black/40 p-3 text-sm">
              <p><b>Top up:</b> {kofi ? <>pay a one-time tip on <a className="neon underline" href={kofi} target="_blank" rel="noreferrer">Ko-fi</a> in SGD and put your code below in the payment message.</> : "Ask the owner to add credit after your payment, and give them your code below."}</p>
              <p className="mt-2">Your code: <span className="sun select-all rounded bg-black px-2 py-1 text-lg">{payCode}</span></p>
              <p className="mt-2 text-xs text-white/80">{autoTopup ? "Your SGD payment becomes shop credit automatically. Keep the LEAN code in the message; if you forget it, ask the owner to match your payment. Refresh after paying to see your balance." : "The owner adds your credit after confirming the payment. You can spend it in small amounts here."}</p>
            </div>
            {ledger.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-display text-base">Recent activity</summary>
                <ul className="mt-2 space-y-1">
                  {ledger.map((l) => (
                    <li key={l.id} className="flex justify-between gap-3 rounded bg-black/30 px-2 py-1">
                      <span className="min-w-0 truncate">{l.kind === "credit" ? "Top-up" : l.kind === "refund" ? "Refund" : (SHOP_ITEMS[l.item as keyof typeof SHOP_ITEMS]?.name ?? l.item)}{l.note ? ` · ${l.note}` : ""}</span>
                      <span className={l.amountCents >= 0 ? "neon" : "text-[#ff8a80]"}>{l.amountCents >= 0 ? "+" : ""}{sgd(l.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="font-display text-xl">
            <Link className="neon underline" href="/login">Log in</Link> or <Link className="neon underline" href="/signup">sign up</Link> to buy things.
          </p>
        )}
      </section>

      {/* Items */}
      <div className="grid gap-5 md:grid-cols-2">
        <ShopCard item="ticker"><TickerBuy current={ticker} by={tickerBy.by} disabled={disabled} /></ShopCard>
        <ShopCard item="avatar" note="They can restore their own picture any time."><AvatarSwapBuy people={people} disabled={disabled} /></ShopCard>
        <ShopCard item="meal" note="Swapped photos are labelled, and the uploader can restore their original."><MealSwapBuy meals={meals} disabled={disabled} /></ShopCard>
        <ShopCard item="makeover"><MakeoverBuy currentName={brand.name} by={brand.by} disabled={disabled} /></ShopCard>
        <ShopCard item="revamp"><SpecialBuy item="revamp" disabled={disabled} /></ShopCard>
        <ShopCard item="owner"><SpecialBuy item="owner" disabled={disabled} /></ShopCard>
      </div>
      <p className="panel px-4 py-3 text-sm">Everything here is a one-time use. Anything that would show something to the whole group is checked first and blocked if it breaks the site rules, and you are not charged when that happens.</p>

      {/* Spending leaderboard, below the shop */}
      <section aria-label="Spending leaderboard" className="mx-auto max-w-xl" style={{ ["--row" as string]: "4rem" }}>
        <Leaderboard
          id="spenders"
          title="TOP SPENDERS"
          icon="trophy"
          rows={spenders}
          format={(cents) => sgd(cents)}
          me={user?.username}
          compact
          emptyText="Nobody has bought anything yet. Be first!"
          rule="Total spent in the shop, in Singapore dollars (refunds taken off)."
        />
      </section>

      {/* Settings, pushed to the bottom */}
      <section id="settings" className="scroll-mt-32 space-y-5" aria-label="Settings">
        <SectionTitle>SETTINGS</SectionTitle>
        {user && settings && state ? (
          <>
            <AvatarSettings hasOwn={state.hasOwnAvatar} swappedBy={state.swappedBy} />
            <SettingsForm initial={settings} />
            <p className="text-center text-sm">Total in the shop so far: {fmt(spenders.length)} {spenders.length === 1 ? "person has" : "people have"} spent credit.</p>
          </>
        ) : (
          <p className="panel p-5">
            <Link className="neon underline" href="/login">Log in</Link> to change your settings and profile picture.
          </p>
        )}
      </section>
    </div>
  );
}
