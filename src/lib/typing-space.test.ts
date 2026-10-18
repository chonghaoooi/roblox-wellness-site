import assert from "node:assert/strict";
import { test } from "node:test";
import { blurText, focusText, idleTyping, isTextEntry, isTyping, viewportChanged } from "./typing-space.ts";

test("only fields that open a keyboard count", () => {
  assert.equal(isTextEntry("TEXTAREA", null), true);
  assert.equal(isTextEntry("INPUT", null), true); // no type means text
  for (const type of ["text", "number", "email", "search", "tel", "url", "password"]) assert.equal(isTextEntry("input", type), true, type);
  for (const type of ["checkbox", "radio", "file", "date", "range", "submit", "button", "hidden"]) assert.equal(isTextEntry("input", type), false, type);
  assert.equal(isTextEntry("select", null), false);
  assert.equal(isTextEntry("button", null), false);
  assert.equal(isTextEntry("div", null, true), true); // contenteditable
  assert.equal(isTextEntry("div", null), false);
});

test("bars hide on focus and come back on blur", () => {
  assert.equal(isTyping(idleTyping), false);
  const typing = focusText();
  assert.equal(isTyping(typing), true);
  assert.equal(isTyping(blurText()), false);
});

test("keyboard opening keeps the bars hidden", () => {
  let s = focusText();
  s = viewportChanged(s, 420, 800); // keyboard up: viewport is about half height
  assert.equal(isTyping(s), true);
  assert.equal(s.shrunk, true);
});

test("closing the keyboard while the field stays focused brings the bars back, until the next tap into a field", () => {
  let s = focusText();
  s = viewportChanged(s, 420, 800);
  s = viewportChanged(s, 800, 800); // keyboard closed, input still focused
  assert.equal(isTyping(s), false);
  assert.equal(isTyping(focusText()), true); // tapping into a field hides them again
});

test("viewport changes without a focused field, or without a shrink, change nothing", () => {
  assert.deepEqual(viewportChanged(idleTyping, 400, 800), idleTyping);
  const s = focusText();
  assert.deepEqual(viewportChanged(s, 790, 800), s); // tiny change (e.g. browser toolbar), not a keyboard
  assert.equal(isTyping(viewportChanged(s, 790, 800)), true);
});
