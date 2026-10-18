"use client";

import { PhotoInput } from "./PhotoInput";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { buyAvatarSwap, buyMakeover, buyMealSwap, buyTicker, orderSpecial, removeMyAvatar, restoreMyAvatar, setMyAvatar } from "@/app/shop/actions";
import { shrink, shrinkSquare } from "@/lib/shrink";
import { SHOP_ITEMS, type ShopItem, sgd } from "@/lib/shop";
import type { ShopMeal, ShopTarget } from "@/lib/queries";
import type { FormState } from "@/lib/validation";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
const idle: FormState = {};

/** Runs a shop action; if the form has a photo it is shrunk first. The form clears itself after a successful purchase. */
function useShopAction(action: Action, resize?: (f: File) => Promise<File>) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, run, pending] = useActionState(async (prev: FormState, fd: FormData): Promise<FormState> => {
    const f = fd.get("photo");
    if (resize && f instanceof File && f.size > 0) {
      try { fd.set("photo", await resize(f)); } catch { return { error: "Couldn't read that image. Try a JPEG or PNG." }; }
    }
    const r = await action(prev, fd);
    if (r.ok) formRef.current?.reset();
    return r;
  }, idle);
  return { formRef, state, run, pending };
}

function Result({ state }: { state: FormState }) {
  if (state.error) return <p className="err rounded-lg border-2 border-red-400 bg-red-950 p-2 text-sm" role="alert">{state.error}</p>;
  if (state.ok) return <p className="neon rounded-lg border-2 border-neon bg-black p-2 text-sm" role="status">{state.message ?? "Done!"}</p>;
  return null;
}

const COLORS: Record<ShopItem, string> = { ticker: "green", avatar: "blue", meal: "orange", makeover: "purple", revamp: "pink", owner: "gold" };
const EMOJI: Record<ShopItem, string> = { ticker: "📢", avatar: "🖼️", meal: "🍽️", makeover: "✨", revamp: "💥", owner: "👑" };

/** One shop tile in the style of a game shop: coloured studded card, badge, name, blurb, then the buy form. */
export function ShopCard({ item, children, note }: { item: ShopItem; children: ReactNode; note?: string }) {
  const info = SHOP_ITEMS[item];
  return (
    <section id={`shop-${item}`} className={`shop-card shop-card--${COLORS[item]} scroll-mt-36`} aria-label={info.name}>
      <p className="shop-badge rb-text" aria-hidden>{info.badge}</p>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="rb-text text-2xl leading-tight">{info.name}</h3>
          <p className="mt-1 text-sm font-semibold">{info.blurb}</p>
        </div>
        <span className="text-5xl drop-shadow-[0_3px_0_rgba(0,0,0,0.45)]" aria-hidden>{EMOJI[item]}</span>
      </div>
      {info.originalCents !== undefined && <p className="mt-3 flex items-baseline gap-3">
        <span className="sr-only">Was </span><del className="text-lg font-bold text-white/80 decoration-2">{sgd(info.originalCents)}</del>
        <span className="sr-only">, now </span><span className="neon text-3xl">{sgd(info.cents)}</span>
      </p>}
      {note && <p className="mt-2 text-xs font-semibold">{note}</p>}
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function PriceButton({ item, pending, disabled, label }: { item: ShopItem; pending: boolean; disabled?: boolean; label?: string }) {
  return (
    <button className="btn btn-green w-full" disabled={pending || disabled}>
      {pending ? "Working…" : `${label ?? "Buy"} · ${sgd(SHOP_ITEMS[item].cents)}`}
    </button>
  );
}

const fieldCls = "field !min-h-11 !text-base";

export function TickerBuy({ current, by, disabled }: { current: string; by: string | null; disabled: boolean }) {
  const { formRef, state, run, pending } = useShopAction(buyTicker);
  return (
    <form ref={formRef} action={run} className="space-y-2">
      <p className="rounded-lg bg-black/40 p-2 text-xs">Now showing{by ? ` (set by ${by})` : ""}: <span className="text-sun">{current}</span></p>
      <label htmlFor="ticker-text" className="label !text-base">Your ticker message</label>
      <input id="ticker-text" name="text" className={fieldCls} maxLength={100} placeholder="What should everyone see?" required disabled={disabled} autoComplete="off" />
      <PriceButton item="ticker" pending={pending} disabled={disabled} label="Change ticker" />
      <Result state={state} />
    </form>
  );
}

export function AvatarSwapBuy({ people, disabled }: { people: ShopTarget[]; disabled: boolean }) {
  const { formRef, state, run, pending } = useShopAction(buyAvatarSwap, (f) => shrinkSquare(f, 256));
  return (
    <form ref={formRef} action={run} className="space-y-2">
      <label htmlFor="swap-target" className="label !text-base">Whose picture?</label>
      <select id="swap-target" name="target" className={fieldCls} required disabled={disabled || people.length === 0} defaultValue="">
        <option value="" disabled>{people.length ? "Pick someone…" : "Nobody to pick yet"}</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.username}</option>)}
      </select>
      <label htmlFor="swap-photo" className="label !text-base">New picture</label>
      <PhotoInput id="swap-photo" className={`${fieldCls} !text-sm`} required disabled={disabled} />
      <PriceButton item="avatar" pending={pending} disabled={disabled || people.length === 0} label="Swap picture" />
      <Result state={state} />
    </form>
  );
}

export function MealSwapBuy({ meals, disabled }: { meals: ShopMeal[]; disabled: boolean }) {
  const { formRef, state, run, pending } = useShopAction(buyMealSwap, (f) => shrink(f, 1000, 0.8));
  const when = (iso: string) => new Date(iso).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });
  return (
    <form ref={formRef} action={run} className="space-y-2">
      <label htmlFor="swap-meal" className="label !text-base">Which meal photo?</label>
      <select id="swap-meal" name="meal" className={fieldCls} required disabled={disabled || meals.length === 0} defaultValue="">
        <option value="" disabled>{meals.length ? "Pick a meal…" : "No meals to pick yet"}</option>
        {meals.map((m) => <option key={m.id} value={m.id}>{m.username} · {m.caption ? m.caption.slice(0, 28) : "meal"} · {when(m.createdAt)}</option>)}
      </select>
      <label htmlFor="meal-photo" className="label !text-base">New photo</label>
      <PhotoInput id="meal-photo" className={`${fieldCls} !text-sm`} required disabled={disabled} />
      <PriceButton item="meal" pending={pending} disabled={disabled || meals.length === 0} label="Swap photo" />
      <Result state={state} />
    </form>
  );
}

export function MakeoverBuy({ currentName, by, disabled }: { currentName: string; by: string | null; disabled: boolean }) {
  const { formRef, state, run, pending } = useShopAction(buyMakeover, (f) => shrinkSquare(f, 512));
  return (
    <form ref={formRef} action={run} className="space-y-2">
      <p className="rounded-lg bg-black/40 p-2 text-xs">The app is called <span className="text-sun">{currentName}</span>{by ? ` (changed by ${by})` : ""}.</p>
      <label htmlFor="makeover-name" className="label !text-base">New app name (optional)</label>
      <input id="makeover-name" name="name" className={fieldCls} maxLength={20} placeholder="Up to 20 characters" disabled={disabled} autoComplete="off" />
      <label htmlFor="makeover-icon" className="label !text-base">New app icon (optional)</label>
      <input id="makeover-icon" name="photo" type="file" accept="image/*" className={`${fieldCls} !text-sm`} disabled={disabled} />
      <p className="text-xs">Pick a name, an icon, or both. The site changes for everybody. Existing phone icons may need removing and adding again, especially on iPhone.</p>
      <PriceButton item="makeover" pending={pending} disabled={disabled} label="Change the app" />
      <Result state={state} />
    </form>
  );
}

export function SpecialBuy({ item, disabled }: { item: "revamp" | "owner"; disabled: boolean }) {
  const { formRef, state, run, pending } = useShopAction(orderSpecial);
  return (
    <form ref={formRef} action={run} className="space-y-2">
      <input type="hidden" name="item" value={item} />
      <label htmlFor={`note-${item}`} className="label !text-base">{item === "revamp" ? "What do you want done?" : "Anything to tell the owner? (optional)"}</label>
      <textarea id={`note-${item}`} name="note" className={fieldCls} rows={3} maxLength={500} required={item === "revamp"} disabled={disabled} placeholder={item === "revamp" ? "Describe the revamp or the troll…" : "e.g. what you'd like on your crown"} />
      <PriceButton item={item} pending={pending} disabled={disabled} label="Place order" />
      <Result state={state} />
    </form>
  );
}

// ---------- Settings: your own picture (free) ----------

export function AvatarSettings({ hasOwn, swappedBy }: { hasOwn: boolean; swappedBy: string | null }) {
  const { formRef, state, run, pending } = useShopAction(setMyAvatar, (f) => shrinkSquare(f, 256));
  const [busy, setBusy] = useState(false);
  return (
    <div className="panel space-y-3 p-5">
      <h3 className="rb-text text-2xl">Profile picture</h3>
      {swappedBy && (
        <div className="rounded-lg border-2 border-sun bg-black/50 p-3">
          <p className="text-sm"><b className="text-sun">{swappedBy}</b> swapped your picture with a shop item.</p>
          <button type="button" className="btn btn-yellow mt-2 !min-h-10 !text-base" disabled={busy} onClick={async () => { setBusy(true); await restoreMyAvatar(); setBusy(false); }}>Restore mine</button>
        </div>
      )}
      <form ref={formRef} action={run} className="space-y-2">
        <label htmlFor="my-avatar" className="label !text-base">{hasOwn ? "Replace your picture" : "Add a picture"} (free)</label>
        <PhotoInput id="my-avatar" className={`${fieldCls} !text-sm`} required front />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-green !min-h-11" disabled={pending}>{pending ? "Checking…" : "Save picture"}</button>
          {hasOwn && <button type="button" className="btn btn-red !min-h-11" disabled={busy} onClick={async () => { setBusy(true); await removeMyAvatar(); setBusy(false); }}>Remove</button>}
        </div>
        <Result state={state} />
      </form>
    </div>
  );
}
