"use client";

import { useActionState } from "react";
import { finishOrder, grantCredit, matchKofiPayment, resetShopContent } from "@/app/admin/shop-actions";
import type { ShopPerson } from "@/lib/admin-shop";
import type { FormState } from "@/lib/validation";
import { sgd } from "@/lib/shop";

const idle: FormState = {};
function Status({ state }: { state: FormState }) {
  return state.error ? <p role="alert" className="err rounded bg-red-950 p-3">{state.error}</p> : state.ok ? <p role="status" className="neon">{state.message}</p> : null;
}
function People({ people }: { people: ShopPerson[] }) {
  return <label className="block"><span className="label">User</span><select name="user" className="field" required defaultValue="">
    <option value="" disabled>Pick an account</option>
    {people.map((p) => <option key={p.id} value={p.id}>{p.username} · {sgd(p.balance)}{p.code ? ` · ${p.code}` : ""}</option>)}
  </select></label>;
}
export function CreditForm({ people }: { people: ShopPerson[] }) {
  const [state, action, pending] = useActionState(grantCredit, idle);
  return <form action={action} className="panel space-y-3 p-5">
    <h2 className="rb-text text-2xl">ADD PAID CREDIT</h2>
    <p className="text-sm">After confirming a PayNow or other payment, add the matching amount. Reusing a receipt cannot credit it twice.</p>
    <People people={people} />
    <label className="block"><span className="label">Amount (SGD)</span><input className="field" name="amount" inputMode="decimal" type="number" min="0.01" max="10000" step="0.01" required /></label>
    <label className="block"><span className="label">Unique receipt reference</span><input className="field" name="receipt" minLength={3} maxLength={100} pattern="[A-Za-z0-9_.:\-]+" required /></label>
    <label className="block"><span className="label">Payment note</span><input className="field" name="note" minLength={3} maxLength={200} placeholder="PayNow received" required /></label>
    <Status state={state} /><button className="btn btn-green" disabled={pending}>{pending ? "Adding…" : "Add credit"}</button>
  </form>;
}
export function OrderButtons({ id }: { id: number }) {
  const [state, action, pending] = useActionState(finishOrder, idle);
  return <form action={action} className="space-y-3">
    <input type="hidden" name="id" value={id} /><div className="flex flex-wrap gap-2">
      <button name="mode" value="done" className="btn btn-green !text-sm" disabled={pending}>Mark fulfilled</button>
      <button name="mode" value="refund" className="btn btn-yellow !text-sm" disabled={pending}>Decline + refund credit</button>
    </div><Status state={state} />
  </form>;
}
export function ResetShopForm({ mode, id, label }: { mode: "brand" | "avatar" | "meal"; id?: number; label: string }) {
  const [state, action, pending] = useActionState(resetShopContent, idle);
  return <form action={action} className="space-y-2"><input type="hidden" name="mode" value={mode} /><input type="hidden" name="id" value={id ?? ""} />
    <button className="btn btn-blue !text-sm" disabled={pending}>{pending ? "Restoring…" : label}</button><Status state={state} />
  </form>;
}
export function MatchPaymentForm({ paymentKey, people }: { paymentKey: string; people: ShopPerson[] }) {
  const [state, action, pending] = useActionState(matchKofiPayment, idle);
  return <form action={action} className="space-y-3"><input type="hidden" name="key" value={paymentKey} /><People people={people} />
    <button className="btn btn-green !text-sm" disabled={pending}>Match + add credit</button><Status state={state} />
  </form>;
}
