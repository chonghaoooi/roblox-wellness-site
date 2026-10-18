"use client";

import { useState, type ReactNode } from "react";

export const VISIBLE_ROWS = 6;

/**
 * On touch screens the leaderboard list does not scroll on its own (it would trap swipes meant for the page).
 * It shows the first rows and a button expands it to full height instead. On desktop the list still scrolls.
 */
export function BoardBody({ children, count, title }: { children: ReactNode; count: number; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="board-body" data-open={open}>
      {children}
      {count > VISIBLE_ROWS && (
        <button type="button" className="btn btn-yellow board-more mt-3 w-full" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? `Show top ${VISIBLE_ROWS}` : `Show all ${count} on ${title}`}
        </button>
      )}
    </div>
  );
}
