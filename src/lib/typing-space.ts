// Decides when the on-screen keyboard is "in use", so pinned bars can get out of the way. Pure logic, unit-tested.

/** Inputs that open a keyboard. (Dates, checkboxes, file pickers and buttons do not.) */
const NON_KEYBOARD_INPUT_TYPES = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "date", "time", "datetime-local", "month", "week", "image", "hidden"]);

export function isTextEntry(tagName: string, type: string | null, editable = false): boolean {
  const tag = tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (editable) return true;
  if (tag !== "input") return false;
  return !NON_KEYBOARD_INPUT_TYPES.has((type ?? "text").toLowerCase());
}

export type TypingState = { focused: boolean; shrunk: boolean; dismissed: boolean };
export const idleTyping: TypingState = { focused: false, shrunk: false, dismissed: false };

/** Bars hide while a text field is focused, unless the keyboard was closed (back button) while the field kept focus. */
export const isTyping = (s: TypingState) => s.focused && !s.dismissed;

export const focusText = (): TypingState => ({ focused: true, shrunk: false, dismissed: false });
export const blurText = (): TypingState => idleTyping;

/**
 * The visual viewport shrinks when a keyboard opens and grows back when it closes. If it grows back while the field is
 * still focused, the person closed the keyboard, so show the bars again until they tap into a field again.
 */
export function viewportChanged(s: TypingState, height: number, tallestSeen: number): TypingState {
  if (!s.focused) return s;
  if (height < tallestSeen * 0.85) return { ...s, shrunk: true };
  if (s.shrunk) return { focused: true, shrunk: false, dismissed: true };
  return s;
}
