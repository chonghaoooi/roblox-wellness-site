import "server-only";

const SIZES = new Set([240, 480, 720]);

/**
 * Serves a stored JPEG. Photos never change under the same URL (swaps add ?v= to the link), so browsers and the CDN may
 * keep them for a year. `?w=` returns a smaller copy for grids, so phones don't download full-size images for thumbnails.
 */
export async function photoResponse(base64: string, url: URL): Promise<Response> {
  let body: Buffer = Buffer.from(base64, "base64");
  const w = Number(url.searchParams.get("w"));
  if (SIZES.has(w)) {
    try {
      const { default: sharp } = await import("sharp");
      body = await sharp(body).rotate().resize({ width: w, height: w, fit: "cover", withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    } catch {
      // Fall back to the original photo if resizing is unavailable.
    }
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}

export const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
