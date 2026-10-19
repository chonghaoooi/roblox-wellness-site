import assert from "node:assert/strict";
import test from "node:test";
import { editPhotoSet } from "./post-photos.ts";

test("removing the main, middle or last photo preserves order and closes gaps", () => {
  assert.deepEqual(editPhotoSet(["a", "b", "c"], [0], [], []), { photos: ["b", "c"], changed: true });
  assert.deepEqual(editPhotoSet(["a", "b", "c"], [1], [], []), { photos: ["a", "c"], changed: true });
  assert.deepEqual(editPhotoSet(["a", "b", "c"], [2], [], []), { photos: ["a", "b"], changed: true });
});
test("all photos can be removed, and photos can be added to an empty post", () => {
  assert.deepEqual(editPhotoSet(["a", "b"], [0, 1], [], []), { photos: [], changed: true });
  assert.deepEqual(editPhotoSet([], [], [], ["a"]), { photos: ["a"], changed: true });
});
test("removals, replacements and additions use original positions", () => {
  assert.deepEqual(editPhotoSet(["a", "b", "c"], [0], [{ slot: 2, photo: "new-c" }], ["d"]), { photos: ["b", "new-c", "d"], changed: true });
  assert.deepEqual(editPhotoSet(["a"], [], [], []), { photos: ["a"], changed: false });
});
test("invalid positions, editing removed photos and more than three photos are rejected", () => {
  for (const n of [-1, 1, 0.5, NaN]) assert.ok("error" in editPhotoSet(["a"], [n], [], []));
  assert.ok("error" in editPhotoSet(["a"], [0], [{ slot: 0, photo: "b" }], []));
  assert.ok("error" in editPhotoSet(["a"], [], [{ slot: 2, photo: "b" }], []));
  assert.ok("error" in editPhotoSet(["a", "b", "c"], [], [], ["d"]));
});
