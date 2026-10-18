import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteConfig } from "@/db/schema";
import sharp from "sharp";

export const runtime = "nodejs";

/** The app icon chosen in the shop (a 512x512 JPEG kept in site_config). Without one, send people to the built-in icon. */
export async function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get("size") || 512);
  const size = [32, 180, 192, 512].includes(requested) ? requested : 512;
  if (db) {
    try {
      const [row] = await db.select({ value: siteConfig.value }).from(siteConfig).where(eq(siteConfig.key, "app_icon_b64")).limit(1);
      if (row) {
        const image = await sharp(Buffer.from(row.value, "base64"), { limitInputPixels: 20_000_000 }).rotate().resize(size, size).jpeg({ quality: 90 }).toBuffer();
        return new Response(new Uint8Array(image), {
          headers: { "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
        });
      }
    } catch {
      console.error("[app-icon] lookup failed");
    }
  }
  return Response.redirect(new URL(`/icons/lean-${size === 180 ? "apple" : size}.png`, request.url), 302);
}
