import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { todayStr } from "@/lib/dates";
import { gymPosts, recentMeals, todayRows, userEntries, userGymStreak, userLifts } from "@/lib/queries";

// Read-only MCP server (JSON-RPC over HTTP POST, stateless). Auth: `Authorization: Bearer $MCP_TOKEN`.
// Personal tools read MCP_USER_ID's own data; the feed and leaderboard are what any logged-in friend can already see.
export const dynamic = "force-dynamic";

const text = (v: unknown) => ({ content: [{ type: "text", text: JSON.stringify(v) }] });
const limit = (a: unknown, d: number, max: number) => Math.min(Math.max(Math.trunc(Number(a)) || d, 1), max);
const noArgs = { type: "object", properties: {} };
const limitArg = { type: "object", properties: { limit: { type: "integer", description: "How many to return" } } };

const TOOLS: { name: string; description: string; inputSchema: object; run: (args: Record<string, unknown>, uid: number) => Promise<unknown> }[] = [
  { name: "my_daily_stats", description: "The owner's daily weight, calories, protein and steps, one row per day, newest last 60.", inputSchema: noArgs, run: async (_, uid) => (await userEntries(uid)).slice(-60) },
  { name: "my_lifts", description: "The owner's logged lifts for the last 90 days, plus gym streak.", inputSchema: noArgs, run: async (_, uid) => ({ streak: await userGymStreak(uid, todayStr()), lifts: await userLifts(uid, todayStr()) }) },
  { name: "recent_meals", description: "Latest meal posts in the friends' feed with calories, votes and top comment (no photos).", inputSchema: limitArg, run: async (a, uid) => (await recentMeals(uid)).slice(0, limit(a.limit, 20, 60)) },
  { name: "gym_posts", description: "Latest gym blog posts with lifts, votes and top comment (no photos).", inputSchema: limitArg, run: async (a, uid) => gymPosts(limit(a.limit, 10, 60), uid) },
  { name: "leaderboard_today", description: "Today's BMI, steps and calories for everyone on the site.", inputSchema: noArgs, run: async () => todayRows(todayStr()) },
];

function authorized(req: NextRequest): boolean {
  const want = process.env.MCP_TOKEN;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!want || want.length < 24 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

async function handle(msg: { id?: number | string; method?: string; params?: Record<string, unknown> }) {
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id, error: { code, message } });
  switch (msg.method) {
    case "initialize":
      return ok({ protocolVersion: String(msg.params?.protocolVersion ?? "2025-03-26"), capabilities: { tools: {} }, serverInfo: { name: "plus1lean", version: "1.0.0" } });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS.map(({ run: _run, ...t }) => t) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return err(-32602, "Unknown tool");
      const uid = Number(process.env.MCP_USER_ID);
      try {
        return ok(text(await tool.run((msg.params?.arguments as Record<string, unknown>) ?? {}, uid)));
      } catch (e) {
        console.error("[mcp]", e instanceof Error ? e.message : e);
        return ok({ ...text("Tool failed"), isError: true });
      }
    }
    default:
      return err(-32601, "Method not found");
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 }); }
  const msgs = (Array.isArray(body) ? body : [body]) as Parameters<typeof handle>[0][];
  const out = (await Promise.all(msgs.filter((m) => m?.id !== undefined).map(handle)));
  if (!out.length) return new NextResponse(null, { status: 202 }); // notifications only
  return NextResponse.json(Array.isArray(body) ? out : out[0], { headers: { "Cache-Control": "no-store" } });
}

export const GET = () => new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
