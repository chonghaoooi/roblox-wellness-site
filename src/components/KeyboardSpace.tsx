"use client";

import { useEffect } from "react";
import { blurText, focusText, idleTyping, isTextEntry, isTyping, viewportChanged, type TypingState } from "@/lib/typing-space";

/**
 * Touch devices only. While a text field is focused (so the on-screen keyboard is up) it sets data-typing on <html>;
 * globals.css uses that to slide the pinned top and bottom bars out of the way on the Log page.
 */
export function KeyboardSpace() {
  useEffect(() => {
    if (!matchMedia("(pointer: coarse)").matches) return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    let state: TypingState = idleTyping;
    let tallest = vv?.height ?? innerHeight;
    let blurTimer: ReturnType<typeof setTimeout> | undefined;

    const apply = () => { if (isTyping(state)) root.dataset.typing = "true"; else delete root.dataset.typing; };
    const isText = (el: Element | null) => el instanceof HTMLElement && isTextEntry(el.tagName, el.getAttribute("type"), el.isContentEditable);

    const onFocusIn = (e: FocusEvent) => {
      clearTimeout(blurTimer);
      if (!isText(e.target as Element | null)) return;
      tallest = Math.max(tallest, vv?.height ?? innerHeight);
      state = focusText();
      apply();
    };
    const onFocusOut = () => {
      clearTimeout(blurTimer);
      // Moving from one field to the next fires focusout then focusin; only act if focus really left the text fields.
      blurTimer = setTimeout(() => { if (!isText(document.activeElement)) { state = blurText(); apply(); } }, 150);
    };
    const onViewport = () => {
      const height = vv?.height ?? innerHeight;
      if (!state.focused) tallest = height; // rotation or browser toolbar changes while idle
      state = viewportChanged(state, height, tallest);
      apply();
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    (vv ?? window).addEventListener("resize", onViewport);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      (vv ?? window).removeEventListener("resize", onViewport);
      clearTimeout(blurTimer);
      delete root.dataset.typing;
    };
  }, []);
  return null;
}
