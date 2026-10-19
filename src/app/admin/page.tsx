import Link from "next/link";
import { AdminShop } from "@/components/AdminShop";
import { AdminMealComments } from "@/components/AdminMealComments";
import { AdminDeleteButton, AdminLogEditor, AdminMealEditor, AdminPasswordForm, AdminPostEditor, TickerEditor } from "@/components/AdminForms";
import { EmptyState, fmt } from "@/components/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { ADMIN_PAGE_SIZE, moderationData, type AdminLog } from "@/lib/admin-data";
import { EXERCISES } from "@/lib/lifts";
import { getTickerMessage } from "@/lib/site-config";
import { adminLogout } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin panel", robots: { index: false, follow: false } };
const tabs = { ticker: "Ticker", shop: "Shop", gym: "Gym posts", meals: "Meals", comments: "Comments", logs: "All logs", audit: "Action history", account: "Password" } as const;
const kinds = { meal: "Meals", steps: "Steps", weight: "Weigh-ins", gym: "Gym check-ins", lift: "Gym lifts" } as const;

function describe(log: AdminLog) {
  if (log.kind === "meal") return `${fmt(log.calories ?? 0)} kcal`;
  if (log.kind === "steps") return `${fmt(log.steps ?? 0)} steps`;
  if (log.kind === "weight") return [log.weightKg !== null && `${fmt(log.weightKg, 1)} kg`, log.heightCm !== null && `${fmt(log.heightCm, 1)} cm`].filter(Boolean).join(" · ");
  if (log.kind === "lift") return `${EXERCISES[log.exercise as keyof typeof EXERCISES] ?? "Lift"} · ${fmt(log.liftKg ?? 0, 1)} kg × ${log.reps} reps`;
  return "Gym check-in";
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const string = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const requested = string("view");
  const view = Object.hasOwn(tabs, requested) ? requested as keyof typeof tabs : "ticker";
  const query = string("q").trim().slice(0, 80);
  const requestedKind = string("kind");
  const kind = Object.hasOwn(kinds, requestedKind) ? requestedKind : "";
  const page = Math.min(10000, Math.max(1, Math.floor(Number(string("page")) || 1)));
  const [data, message] = await Promise.all([moderationData(view, query, kind, page), view === "ticker" ? getTickerMessage() : Promise.resolve("")]);
  const hasMore = Object.values(data).some((rows) => rows.length > ADMIN_PAGE_SIZE);
  const href = (number: number) => `/admin?${new URLSearchParams({ view, q: query, kind, page: String(number) })}`;
  const paginated = ["gym", "meals", "logs", "audit"].includes(view);
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-8 sm:px-5">
      <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div><h1 className="rb-text text-3xl sm:text-4xl">ADMIN CONTROL ROOM</h1><p className="mt-2">Signed in as <span className="neon">{admin.username}</span></p></div>
        <div className="flex flex-wrap gap-3"><Link href="/" className="btn btn-blue">View site</Link><form action={adminLogout}><button className="btn btn-yellow">Admin log out</button></form></div>
      </section>
      <nav aria-label="Admin sections" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(tabs).map(([key, label]) => <Link key={key} href={`/admin?view=${key}`} aria-current={view === key ? "page" : undefined} className={`btn ${view === key ? "btn-yellow" : "btn-purple"}`}>{label}</Link>)}
      </nav>
      {view === "ticker" && <TickerEditor message={message} />}
      {view === "account" && <AdminPasswordForm />}
      {view === "shop" && <AdminShop />}
      {view === "comments" && <AdminMealComments />}
      {["gym", "meals", "logs"].includes(view) && <form action="/admin" method="get" className="panel flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="view" value={view} />
        <label className="min-w-0 flex-1"><span className="label">Find by username</span><input className="field mt-1" name="q" defaultValue={query} maxLength={80} placeholder="All users" /></label>
        {view === "logs" && <label className="w-full sm:w-48"><span className="label">Log type</span><select className="field mt-1" name="kind" defaultValue={kind}><option value="">All types</option>{Object.entries(kinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
        <button className="btn btn-green">Search</button><Link className="btn btn-blue" href={`/admin?view=${view}`}>Clear</Link>
      </form>}
      {view === "gym" && <>
        <p className="panel p-4 text-sm">Deleting a post removes its attached lifts. Its gym check-in stays; remove that separately in All logs if needed.</p>
        {data.posts.length === 0 ? <EmptyState>No matching gym posts.</EmptyState> : <div className="grid items-start gap-5 md:grid-cols-2">
          {data.posts.slice(0, ADMIN_PAGE_SIZE).map((post) => <article key={post.id} className="panel min-w-0 space-y-4 overflow-hidden p-4">
            <h2 className="font-display text-xl">{post.username} <span className="text-sm text-sun">· {post.date} · #{post.id}</span></h2>
            {post.hasPhoto && <img src={`/admin/photo/gym/${post.id}`} alt={`Gym photo by ${post.username}`} className="max-h-72 w-full rounded-lg bg-black object-contain" loading="lazy" />}
            {post.notes && <p className="whitespace-pre-wrap break-words">{post.notes}</p>}<p className="text-sm text-sun">{post.liftCount} attached lifts</p>
            <details><summary className="cursor-pointer font-display text-lg text-neon">Edit notes</summary><AdminPostEditor id={post.id} notes={post.notes} /></details>
            <div className="flex flex-wrap gap-3">
              {post.hasPhoto && <AdminDeleteButton id={post.id} mode="gym-photo" label="Remove photo only" confirmation={`Remove ${post.username}'s gym photo? Notes, lifts and the check-in stay.`} />}
              <AdminDeleteButton id={post.id} mode="gym-post" label="Delete post" confirmation={`Delete ${post.username}'s gym post #${post.id} and its ${post.liftCount} lifts? This cannot be undone. The check-in stays.`} />
            </div>
          </article>)}
        </div>}
      </>}
      {view === "meals" && <>
        <p className="panel p-4 text-sm">Remove photo only keeps the calories in the user&apos;s daily stats. Delete meal removes both the photo and the calorie entry. Meals without photos are still in All logs.</p>
        {data.meals.length === 0 ? <EmptyState>No matching meal photos.</EmptyState> : <div className="grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
          {data.meals.slice(0, ADMIN_PAGE_SIZE).map((meal) => <article key={meal.id} className="panel min-w-0 space-y-4 overflow-hidden p-4">
            <h2 className="font-display text-xl">{meal.username} <span className="text-sm text-sun">· meal #{meal.id}</span></h2>
            {meal.hasPhoto && <img src={`/admin/photo/meal/${meal.id}`} alt={`Meal photo by ${meal.username}`} className="aspect-square w-full rounded-lg bg-black object-contain" loading="lazy" />}
            <p className="break-words">{meal.caption || "No caption"}</p>{meal.calories !== null && <p className="neon">{fmt(meal.calories)} kcal</p>}
            <details><summary className="cursor-pointer font-display text-lg text-neon">Edit meal</summary><AdminMealEditor meal={meal} /></details>
            <div className="flex flex-wrap gap-3"><AdminDeleteButton id={meal.id} mode="meal-photo" label="Remove photo only" confirmation={`Remove ${meal.username}'s meal photo? The calorie log stays.`} /><AdminDeleteButton id={meal.id} mode="meal" label="Delete meal" confirmation={`Delete ${meal.username}'s meal #${meal.id} and its calories? This cannot be undone.`} /></div>
          </article>)}
        </div>}
      </>}
      {view === "logs" && <>
        <p className="panel p-4 text-sm">Weights are shown and edited in kg, heights in cm. Deleting a meal log also removes its photo. Changes update totals and leaderboards.</p>
        {data.logs.length === 0 ? <EmptyState>No matching logs.</EmptyState> : <div className="space-y-4">
          {data.logs.slice(0, ADMIN_PAGE_SIZE).map((log) => <article key={log.id} className="panel min-w-0 space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl">{log.username} · {kinds[log.kind as keyof typeof kinds] ?? log.kind}</h2><p className="text-sm text-sun">{log.date} · log #{log.id}</p></div><span className="neon">{describe(log)}</span></div>
            {log.note && <p className="whitespace-pre-wrap break-words">{log.note}</p>}
            <details><summary className="cursor-pointer font-display text-lg text-neon">Edit log</summary><AdminLogEditor log={log} /></details>
            <AdminDeleteButton id={log.id} mode="log" label="Delete log" confirmation={`Delete ${log.username}'s ${log.kind} log #${log.id} from ${log.date}? This cannot be undone${log.kind === "meal" ? " and also removes the meal photo" : ""}.`} />
          </article>)}
        </div>}
      </>}
      {view === "audit" && (data.audit.length === 0 ? <EmptyState>No admin actions yet.</EmptyState> : <ol className="space-y-3">{data.audit.slice(0, ADMIN_PAGE_SIZE).map((row) => <li key={row.id} className="panel space-y-1 p-4"><p className="font-display text-lg">{row.details}</p><p className="text-sm text-sun">{row.username} · {row.target} · {new Date(row.createdAt).toLocaleString("en-SG", { timeZone: process.env.APP_TIMEZONE || "Asia/Singapore" })}</p></li>)}</ol>)}
      {paginated && <nav aria-label="Moderation pages" className="flex items-center justify-between gap-3">{page > 1 ? <Link href={href(page - 1)} className="btn btn-blue">Previous</Link> : <span />}<span className="panel px-4 py-2">Page {page}</span>{hasMore ? <Link href={href(page + 1)} className="btn btn-blue">Next</Link> : <span />}</nav>}
    </div>
  );
}
