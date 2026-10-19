/** Apply edits against the original positions, then close any gaps before storing the set. */
export function editPhotoSet<T>(current: T[], removals: number[], replacements: { slot: number; photo: T }[], additions: T[]): { photos: T[]; changed: boolean } | { error: string } {
  const removed = new Set(removals);
  if (removals.some(n => !Number.isInteger(n) || n < 0 || n >= current.length)) return { error: "That photo no longer exists. Reopen the post and try again." };
  if (replacements.some(p => !Number.isInteger(p.slot) || p.slot < 0 || p.slot >= current.length || removed.has(p.slot))) return { error: "You can't change a photo marked for removal. Undo its removal first." };
  const changed = removed.size > 0 || replacements.length > 0 || additions.length > 0;
  const photos = current.flatMap((photo, slot) => removed.has(slot) ? [] : [replacements.find(p => p.slot === slot)?.photo ?? photo]).concat(additions);
  if (photos.length > 3) return { error: "A post can have at most 3 photos. Remove a photo before adding another." };
  return { photos, changed };
}
