import type { MetadataRoute } from "next";
import { getAppBrand } from "@/lib/site-config";

export const dynamic = "force-dynamic";

// The installed app's name and icon follow whatever was last set in the shop (default: +1lean and the built-in artwork).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await getAppBrand();
  const type = brand.customIcon ? "image/jpeg" : "image/png";
  return {
    id: "/",
    name: brand.name,
    short_name: brand.name,
    description: "Your daily stats, meal gallery and gym blog with friends.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#101316",
    theme_color: "#000000",
    prefer_related_applications: false,
    icons: [
      { src: brand.icon192, sizes: "192x192", type, purpose: "any" },
      { src: brand.icon512, sizes: "512x512", type, purpose: "any" },
      ...(brand.iconMaskable ? [{ src: brand.iconMaskable, sizes: "512x512", type, purpose: "maskable" as const }] : []),
    ],
  };
}
