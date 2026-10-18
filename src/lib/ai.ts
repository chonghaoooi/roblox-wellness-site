import "server-only";

// Two interchangeable backends, picked by env vars:
//  1. OpenAI-compatible (e.g. a ChatGPT model behind a proxy CLI): AI_BASE_URL (+ AI_API_KEY, AI_MODEL)
//  2. Anthropic: ANTHROPIC_API_KEY (+ ANTHROPIC_MODEL)
// With neither set, AI is off and calories/steps are typed.

const OPENAI_BASE = process.env.AI_BASE_URL?.replace(/\/+$/, "");
const OPENAI_MODEL = process.env.AI_MODEL || "gpt-5";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

export const aiEnabled = Boolean(OPENAI_BASE || process.env.ANTHROPIC_API_KEY);

async function viaOpenAICompatible(jpeg: Buffer, prompt: string): Promise<string> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.AI_API_KEY || "not-needed"}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const data = (await res.json()) as { choices?: { message?: { content?: string | { type: string; text?: string }[] } }[] };
  const c = data.choices?.[0]?.message?.content;
  return typeof c === "string" ? c : (c ?? []).map((p) => p.text ?? "").join("");
}

async function viaAnthropic(jpeg: Buffer, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return data.content?.find((c) => c.type === "text")?.text ?? "";
}

async function askAboutImage(jpeg: Buffer, prompt: string): Promise<unknown> {
  const full = `${prompt}\nReply with ONLY a JSON object, no other text.`;
  const text = OPENAI_BASE ? await viaOpenAICompatible(jpeg, full) : await viaAnthropic(jpeg, full);
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI gave no JSON");
  return JSON.parse(m[0]);
}

export type MealGuess = { calories: number; description: string };

/** Estimate the calories of the food in a photo. Throws a user-readable Error when it isn't food. */
export async function estimateMeal(jpeg: Buffer): Promise<MealGuess> {
  const r = (await askAboutImage(
    jpeg,
    'Estimate the total calories (kcal) of the food in this photo for the portion shown. JSON: {"is_food": boolean, "calories": integer, "description": "max 6 words"}.',
  )) as { is_food?: boolean; calories?: number; description?: string };
  if (!r.is_food) throw new Error("That doesn't look like food.");
  const cal = Math.round(Number(r.calories));
  if (!Number.isFinite(cal) || cal < 0 || cal > 5000) throw new Error("Couldn't estimate calories from that photo.");
  return { calories: cal, description: String(r.description ?? "").slice(0, 80) };
}

/** Read today's step total off a screenshot of a phone step counter / health app. */
export async function readSteps(jpeg: Buffer): Promise<number> {
  const r = (await askAboutImage(
    jpeg,
    'This should be a screenshot of a phone step counter or health app. Read the total steps shown for the current day. JSON: {"is_step_counter": boolean, "steps": integer or null}.',
  )) as { is_step_counter?: boolean; steps?: number | null };
  const steps = Math.round(Number(r.steps));
  if (!r.is_step_counter || !Number.isFinite(steps) || steps < 0 || steps > 100000) throw new Error("Couldn't read a step count from that screenshot.");
  return steps;
}

export type ChatMsg = { role: "user" | "assistant"; content: string };

/** Plain text chat. `history` must end with the user's latest message. */
export async function chat(system: string, history: ChatMsg[]): Promise<string> {
  const turns = history.slice(Math.max(0, history.findIndex((m) => m.role === "user"))); // providers want the first turn to be the user's
  if (OPENAI_BASE) {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.AI_API_KEY || "not-needed"}` },
      body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: "system", content: system }, ...turns] }),
      signal: AbortSignal.timeout(50_000),
    });
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);
    const data = (await res.json()) as { choices?: { message?: { content?: string | { text?: string }[] } }[] };
    const c = data.choices?.[0]?.message?.content;
    return (typeof c === "string" ? c : (c ?? []).map((p) => p.text ?? "").join("")).trim();
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 700, system, messages: turns }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content?.find((c) => c.type === "text")?.text ?? "").trim();
}

// ---------- Moderation of things strangers can buy the right to show everyone (ticker text, swapped photos) ----------

export type Moderation = { ok: true } | { ok: false; reason: string };

const BLOCK_RULES =
  "Block it ONLY if it contains: sexual or nude content; slurs or hateful content; threats or encouragement of violence or self-harm; " +
  "personal information such as phone numbers, email addresses, home addresses or ID documents; or cruel, degrading bullying of a real person. " +
  "Friendly teasing between friends, jokes, memes and silly pranks are fine.";

function verdict(raw: unknown): Moderation {
  const r = raw as { ok?: unknown; reason?: unknown };
  if (r?.ok === true) return { ok: true };
  const reason = typeof r?.reason === "string" && r.reason.trim() ? r.reason.trim().slice(0, 80) : "it breaks the site rules";
  return { ok: false, reason };
}

/** Fails closed: if the AI is off or errors, nothing gets through. */
export async function moderateText(text: string): Promise<Moderation> {
  if (!aiEnabled) return { ok: false, reason: "moderation is unavailable right now" };
  try {
    const reply = await chat(
      `You moderate short messages for a friendly fitness app for friends. ${BLOCK_RULES} Reply with ONLY a JSON object: {"ok": boolean, "reason": "max 8 words, only when ok is false"}.`,
      [{ role: "user", content: `Message to check:\n"""${text.slice(0, 300)}"""` }],
    );
    const m = reply.match(/\{[\s\S]*\}/);
    return m ? verdict(JSON.parse(m[0])) : { ok: false, reason: "couldn't check it" };
  } catch {
    return { ok: false, reason: "couldn't check it, try again" };
  }
}

export async function moderateImage(jpeg: Buffer): Promise<Moderation> {
  if (!aiEnabled) return { ok: false, reason: "moderation is unavailable right now" };
  try {
    return verdict(await askAboutImage(jpeg, `This image will replace someone's photo on a friendly fitness app for friends. ${BLOCK_RULES} JSON: {"ok": boolean, "reason": "max 8 words, only when ok is false"}.`));
  } catch {
    return { ok: false, reason: "couldn't check it, try again" };
  }
}
