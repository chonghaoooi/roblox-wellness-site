import Image from "next/image";
import type { BoardRow } from "@/lib/queries";
import { BoardBody } from "./BoardBody";
import { CurvedTitle } from "./CurvedTitle";
import { Avatar } from "./ui";

type Props = {
  id: string;
  title: string;
  icon: "taco" | "protein" | "sneaker" | "scale" | "dumbbell" | "flame" | "trophy" | "ruler" | "kettlebell";
  rows: BoardRow[];
  format: (n: number) => string;
  rule: string;
  emptyText?: string;
  me?: string;
  /** Pushes the column down, leaving buffer under the header. */
  offset?: boolean;
  /** Compact variant for the weekly/monthly boards. */
  compact?: boolean;
  /** The daily selector already supplies the icon and title. */
  hideHeading?: boolean;
};

export function Leaderboard({ id, title, icon, rows, format, rule, emptyText = "Nobody has logged today. Be first!", me, offset, compact, hideHeading }: Props) {
  const ghosts = Math.max(0, 6 - rows.length);
  return (
    <section aria-labelledby={`h-${id}`} className={`flex w-full min-w-0 flex-col ${offset ? "lg:mt-16" : ""}`}>
      {hideHeading ? <h2 id={`h-${id}`} className="sr-only">{title}</h2> : <div className="relative mb-1 flex flex-col items-center">
        <div className="icon-tile z-10 -mb-3">
          <Image src={`/assets/${icon}.svg`} alt="" width={80} height={80} className="absolute inset-2 z-10 h-[calc(100%-1rem)] w-[calc(100%-1rem)] drop-shadow-[0_3px_0_rgba(0,0,0,0.45)]" priority />
        </div>
        <h2 id={`h-${id}`} className="sr-only">{title}</h2>
        <CurvedTitle id={id} text={title} />
      </div>}
      <div className="board">
        <BoardBody count={rows.length} title={title}>
        <ol className="board-list m-0 list-none p-0" tabIndex={0} aria-label={`${title} leaderboard`}>
          {rows.map((r, i) => (
            <li key={r.username} className="lb-row" data-rank={i + 1} aria-current={r.username === me ? "true" : undefined}>
              <span className="rb-text text-center text-xl sm:text-2xl">{i + 1}</span>
              <Avatar name={r.username} size={compact ? 36 : 40} />
              <span className="min-w-0">
                <span className="block truncate font-display text-base text-white sm:text-xl [-webkit-text-stroke:0.18em_#000] [paint-order:stroke_fill]">
                  {r.username}
                  {r.username === me && <span className="ml-2 rounded bg-black px-1.5 py-0.5 text-xs text-neon [-webkit-text-stroke:0]">YOU</span>}
                </span>
                {r.sub && (
                  <span className={`mt-0.5 inline-block max-w-full truncate rounded-md border-2 border-black bg-black px-1.5 text-xs font-bold leading-5 sm:text-sm ${r.tone === "good" ? "text-neon" : r.tone === "bad" ? "text-[#ff8a80]" : "text-sun"}`}>{r.sub}</span>
                )}
              </span>
              <span className="lb-value">{format(r.value)}</span>
            </li>
          ))}
          {Array.from({ length: ghosts }, (_, g) => (
            <li key={`g${g}`} className="lb-row" data-ghost="true">
              <span className="text-center font-display text-2xl text-white/70">{rows.length + g + 1}</span>
              <span aria-hidden className="h-9 w-9 rounded-lg border-[3px] border-dashed sm:h-11 sm:w-11 border-white/40" />
              <span className="font-display text-sm text-white/90 sm:text-lg">{rows.length === 0 && g === 0 ? emptyText : "Open spot"}</span>
              <span />
            </li>
          ))}
        </ol>
        </BoardBody>
      </div>
      <p className="panel mt-4 px-3 py-2 text-center text-sm font-semibold">{rule}</p>
    </section>
  );
}
