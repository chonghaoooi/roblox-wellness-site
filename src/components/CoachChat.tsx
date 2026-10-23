"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { askCoach, clearCoach } from "@/app/actions";
import { IconSend, IconTrash } from "./icons";
import { PERSONA_IDS, PERSONAS, type Persona } from "@/lib/personas";

type Msg = { role: "user" | "assistant"; content: string };

/** One chat bubble per line of the reply; "-" bullet lines stay attached to the bubble above them. */
function toBubbles(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("-") && out.length) out[out.length - 1] += "\n" + t;
    else out.push(t);
  }
  return out.length ? out : [text];
}

const SUGGESTIONS = [
  "How am I doing this week?",
  "What should I eat today?",
  "Plan my next gym session",
  "Why might my weight be stuck?",
  "How do I hit my step goal?",
];

function BotTile({ size = 36, persona = "adil" }: { size?: number; persona?: Persona }) {
  if (persona === "bitebro") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/api/avatar/bitebro" alt="" width={size} height={size} className="shrink-0 rounded-lg border-[3px] border-black object-cover" style={{ width: size, height: size }} aria-hidden />;
  }
  return (
    <span className="icon-tile shrink-0 !rounded-lg !border-[3px]" style={{ width: size, height: size }} aria-hidden>
      <Image src="/assets/dumbbell.svg" alt="" width={size} height={size} className="absolute inset-1 z-10 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)]" />
    </span>
  );
}

export function CoachChat({ initial, aiOn }: { initial: Msg[]; aiOn: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [persona, setPersona] = useState<Persona>("adil");
  const bot = PERSONAS[persona];
  useEffect(() => {
    const saved = localStorage.getItem("coach-persona");
    if (saved === "bitebro") setPersona("bitebro");
  }, []);
  const pick = (p: Persona) => {
    setPersona(p);
    localStorage.setItem("coach-persona", p);
  };

  // Scroll the message list itself (not the page) to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, pending]);

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || pending) return;
    setError(null);
    setPending(true);
    setMsgs((m) => [...m, { role: "user", content }]);
    setText("");
    try {
      const r = await askCoach(content, persona);
      if (r.reply) setMsgs((m) => [...m, { role: "assistant", content: r.reply! }]);
      else {
        setError(r.error ?? "Something went wrong.");
        setMsgs((m) => m.slice(0, -1)); // the question wasn't saved, so take it back out
        setText(content);
      }
    } catch {
      setError("Couldn't reach the coach. Check your connection and try again.");
      setMsgs((m) => m.slice(0, -1));
      setText(content);
    } finally {
      setPending(false);
    }
  }

  async function clear() {
    if (pending) return;
    setMsgs([]);
    setError(null);
    await clearCoach();
  }

  return (
    <div className="coach-chat panel flex min-h-0 flex-col overflow-hidden !p-0">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b-4 border-black bg-black/50 px-3 py-2">
        <BotTile size={40} persona={persona} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-tight">{bot.name}</p>
          <p className="truncate text-xs font-semibold text-neon">AI coach · not the real {bot.real}</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Choose who to chat with">
          {PERSONA_IDS.map((id) => (
            <button key={id} type="button" onClick={() => pick(id)} aria-pressed={persona === id} title={`Chat with ${PERSONAS[id].name}`} className={`rounded-lg border-[3px] ${persona === id ? "border-neon" : "border-black opacity-60"}`}>
              <BotTile size={32} persona={id} />
            </button>
          ))}
        </div>
        {msgs.length > 0 && (
          <button type="button" onClick={clear} disabled={pending} className="btn btn-red !min-h-10 !px-3 !py-1 !text-sm" aria-label="Clear chat">
            <IconTrash />
            <span className="max-sm:sr-only">Clear</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={listRef} className="coach-list min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4" role="log" aria-live="polite" aria-label={`Conversation with ${bot.name}`}>
        {msgs.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <BotTile size={72} persona={persona} />
            <p className="max-w-xs text-lg font-semibold">yo im {bot.name}. i can see ur logs: weight, meals, steps, gym and lifts. ask me anything or tap one</p>
            <div className="grid w-full max-w-sm gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" disabled={pending || !aiOn} onClick={() => send(s)} className="btn btn-blue !justify-start !text-left !text-base">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm border-[3px] border-black bg-[#1f64e0] px-3.5 py-2 text-[1.02rem] font-semibold">
              {m.content}
            </div>
          ) : (
            <div key={i} className="flex max-w-[94%] items-start gap-2">
              <BotTile size={32} persona={persona} />
              <div className="min-w-0 space-y-1.5">
                {toBubbles(m.content).map((b, j) => (
                  <div key={j} className="w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm border-[3px] border-black bg-[#0b0b12] px-3.5 py-2 text-[1.02rem]">
                    {b}
                  </div>
                ))}
              </div>
            </div>
          ),
        )}
        {pending && (
          <div className="flex items-start gap-2" role="status" aria-label={`${bot.name} is typing`}>
            <BotTile size={32} persona={persona} />
            <div className="flex gap-1.5 rounded-2xl rounded-tl-sm border-[3px] border-black bg-[#0b0b12] px-4 py-3.5">
              {[0, 1, 2].map((d) => (
                <span key={d} className="typing-dot h-2.5 w-2.5 rounded-full bg-neon" style={{ animationDelay: `${d * 160}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="coach-composer space-y-2 border-t-4 border-black bg-[#0b0b12] p-2.5 sm:p-4">
        {msgs.length > 0 && (
          <div className="hbar -mx-1 flex gap-2 overflow-x-auto px-1" aria-label="Suggested questions">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={pending || !aiOn} onClick={() => send(s)} className="btn btn-blue shrink-0 !min-h-10 !px-3 !py-1 !text-sm">
                {s}
              </button>
            ))}
          </div>
        )}
        {error && (
          <p className="err rounded-lg border-2 border-red-400 bg-red-950 p-2 text-sm" role="alert">
            {error}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
          className="flex gap-2"
        >
          <label htmlFor="coach-input" className="sr-only">
            Message {bot.name}
          </label>
          <input
            id="coach-input"
            className="field flex-1 !rounded-full !px-4"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder={aiOn ? `message ${bot.name}…` : "coach is not switched on yet"}
            disabled={!aiOn}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button className="btn btn-green !min-w-12 !rounded-full !px-3" disabled={pending || !aiOn || !text.trim()} aria-label="Send">
            <IconSend />
            <span className="max-sm:sr-only">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
