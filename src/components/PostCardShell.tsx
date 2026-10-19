"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { PhotoCarousel } from "./PhotoCarousel";

/**
 * Post card frame (meals and workouts). Tapping the card opens the full post (photo reset to the first, plus the details in `expanded`);
 * tapping the photo there opens it full-screen. Buttons, forms and links inside the card keep their own behaviour.
 */
export function PostCardShell({ kind = "meals", domId, id, count, v, alt, top, expanded, children }: { kind?: "meals" | "gym"; domId: string; id: number; count: number; v: number; alt: string; top?: ReactNode; expanded: ReactNode; children: ReactNode }) {
  const post = useRef<HTMLDialogElement>(null);
  const big = useRef<HTMLDialogElement>(null);
  const at = useRef(0);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [zoomStart, setZoomStart] = useState(0);
  const track = useCallback((n: number) => { at.current = n; }, []);

  function openPost() { setOpen(true); requestAnimationFrame(() => post.current?.showModal()); }
  function openZoom() { setZoomStart(at.current); setZoom(true); requestAnimationFrame(() => big.current?.showModal()); }
  const backdropClose = (e: React.MouseEvent<HTMLDialogElement>) => { if (e.target === e.currentTarget) e.currentTarget.close(); };

  return (
    <li
      id={domId}
      className="meal-card panel scroll-mt-36 cursor-pointer overflow-hidden !rounded-xl"
      onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a, form, input, textarea, dialog")) openPost(); }}
    >
      {kind === "meals" && count > 1 ? (
        <button
          type="button"
          onClick={openPost}
          aria-label={`Open post: ${alt} (${count} photos)`}
          className={`grid aspect-square w-full grid-cols-2 gap-1 overflow-hidden border-b-4 border-black bg-black/40 p-0 focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-white ${count === 3 ? "grid-rows-2" : "grid-rows-1"}`}
        >
          {Array.from({ length: count }, (_, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={n}
              src={`/api/meals/${id}?${n ? `i=${n}&` : ""}w=480&v=${v}`}
              alt={`${alt} (photo ${n + 1} of ${count})`}
              loading={n === 0 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              className={`h-full min-h-0 w-full min-w-0 object-cover ${count === 3 && n === 0 ? "row-span-2" : ""}`}
            />
          ))}
        </button>
      ) : count > 0 ? <PhotoCarousel kind={kind} id={id} count={count} v={v} alt={alt} w={480} auto onOpen={openPost} className="aspect-square w-full border-b-4 border-black bg-black/40" /> : top}
      {children}
      {open && (
        <dialog ref={post} className="meal-post-dialog" aria-label="Post" onClose={() => setOpen(false)} onClick={backdropClose}>
          <button type="button" onClick={() => post.current?.close()} className="absolute right-2 top-2 z-10 flex size-10 items-center justify-center rounded-lg bg-black/60 text-xl text-white" aria-label="Close post">×</button>
          {count > 0 && <PhotoCarousel kind={kind} id={id} count={count} v={v} alt={alt} onIndex={track} onOpen={openZoom} className="aspect-square w-full bg-black" />}
          <div className="space-y-2 p-4">{expanded}</div>
        </dialog>
      )}
      {zoom && (
        <dialog ref={big} className="meal-zoom-dialog" aria-label="Photo" onClose={() => setZoom(false)} onClick={backdropClose}>
          <button type="button" onClick={() => big.current?.close()} className="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-lg bg-white/20 text-2xl text-white" aria-label="Close photo">×</button>
          <PhotoCarousel kind={kind} id={id} count={count} v={v} alt={alt} contain start={zoomStart} className="h-full w-full" />
        </dialog>
      )}
    </li>
  );
}
