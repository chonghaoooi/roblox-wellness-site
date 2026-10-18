import { adminShopData } from "@/lib/admin-shop";
import { SHOP_ITEMS, isShopItem, sgd } from "@/lib/shop";
import { CreditForm, MatchPaymentForm, OrderButtons, ResetShopForm } from "./AdminShopForms";

export async function AdminShop() {
  const { people, orders, swaps, meals, payments } = await adminShopData();
  return <div className="space-y-6">
    <CreditForm people={people} />
    <section className="panel space-y-4 p-5"><h2 className="rb-text text-2xl">SPECIAL ORDERS</h2>
      <p className="text-sm">Fulfil requests manually, or return the full price to their wallet. The ownership item never grants admin access.</p>
      {orders.length === 0 && <p>No orders yet.</p>}
      {orders.map((o) => <article key={o.id} className="space-y-3 rounded-lg bg-black/40 p-4">
        <h3 className="font-display text-xl">#{o.id} · {o.username} · {isShopItem(o.item) ? SHOP_ITEMS[o.item].name : o.item}</h3>
        <p className="sun">{sgd(o.cents)} · {o.status}</p><p className="whitespace-pre-wrap break-words">{o.note || "No note"}</p>
        {o.status === "pending" && <OrderButtons id={o.id} />}
      </article>)}
    </section>
    <section className="panel space-y-4 p-5"><h2 className="rb-text text-2xl">UNMATCHED KO-FI PAYMENTS</h2>
      {payments.length === 0 && <p>No unmatched payments.</p>}
      {payments.map((p) => <article key={p.key} className="space-y-3 rounded-lg bg-black/40 p-4">
        <p className="break-all font-semibold">{p.key.replace("kofi_unmatched:", "")}</p>
        <p>{p.currency} {(p.cents / 100).toFixed(2)} · {p.reason}{p.code ? ` · ${p.code}` : ""}</p>
        {p.currency === "SGD" ? <MatchPaymentForm paymentKey={p.key} people={people} /> : <p className="text-sm">Handle this payment with the payer; automatic credit only accepts SGD.</p>}
      </article>)}
    </section>
    <section className="panel space-y-4 p-5"><h2 className="rb-text text-2xl">RESTORE ORIGINALS</h2>
      <ResetShopForm mode="brand" label="Restore +1lean name and icon" />
      {swaps.map((p) => <ResetShopForm key={p.id} mode="avatar" id={p.id} label={`Restore ${p.username}'s profile picture`} />)}
      {meals.map((m) => <ResetShopForm key={m.id} mode="meal" id={m.id} label={`Restore ${m.username}'s meal #${m.id}`} />)}
    </section>
  </div>;
}
