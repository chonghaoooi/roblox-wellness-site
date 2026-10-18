/** Shrinks a photo to a JPEG in the browser so uploads stay small. */
export async function shrink(file: File, maxSide: number, quality = 0.8): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", quality));
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

/** Local calendar date, YYYY-MM-DD (the user's "today", not the server's). */
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Centre-crops to a square and scales to size x size as a JPEG (profile pictures and the app icon). */
export async function shrinkSquare(file: File, size: number, quality = 0.88): Promise<File> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", quality));
  return new File([blob], "square.jpg", { type: "image/jpeg" });
}
