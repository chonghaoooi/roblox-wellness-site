"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { PhotoCarousel } from "./PhotoCarousel";

/**
 * Meal card frame. Tapping the card opens the full post (photo reset to the first, plus the details in `expanded`);
 * tapping the photo there opens it full-screen. Buttons, forms and links inside the card keep their own behaviour.
 */
export function MealCardShell({ id, count, v, alt, expanded, children }: { id: number; count: number; v: number; alt: string; expanded: ReactNode; children: ReactNode }) {
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
      id={`meal-${id}`}
      className="meal-card panel scroll-mt-36 cursor-pointer overflow-hidden !rounded-xl"
      onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a, form, input, textarea, dialog")) openPost(); }}
    >
      <PhotoCarousel id={id} count={count} v={v} alt={alt} w={480} auto onOpen={openPost} className="aspect-square w-full border-b-4 border-black bg-black/40" />
      {children}
      {open && (
        <dialog ref={post} className="meal-post-dialog" aria-label="Meal post" onClose={() => setOpen(false)} onClick={backdropClose}>
          <button type="button" onClick={() => post.current?.close()} className="absolute right-2 top-2 z-10 flex size-10 items-center justify-center rounded-lg bg-black/60 text-xl text-white" aria-label="Close post">×</button>
          <PhotoCarousel id={id} count={count} v={v} alt={alt} onIndex={track} onOpen={openZoom} className="aspect-square w-full bg-black" />
          <div className="space-y-2 p-4">{expanded}</div>
        </dialog>
      )}
      {zoom && (
        <dialog ref={big} className="meal-zoom-dialog" aria-label="Meal photo" onClose={() => setZoom(false)} onClick={backdropClose}>
          <button type="button" onClick={() => big.current?.close()} className="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-lg bg-white/20 text-2xl text-white" aria-label="Close photo">×</button>
          <PhotoCarousel id={id} count={count} v={v} alt={alt} contain start={zoomStart} className="h-full w-full" />
        </dialog>
      )}
    </li>
  );
}
