import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteConfig } from "@/db/schema";

export const DEFAULT_TICKER = "Welcome to +1lean • Log a meal, take a walk, share a workout.";

export async function getTickerMessage() {
  if (!db) return DEFAULT_TICKER;
  try {
    const [row] = await db.select({ value: siteConfig.value }).from(siteConfig).where(eq(siteConfig.key, "ticker")).limit(1);
    return row?.value ?? DEFAULT_TICKER;
  } catch {
    console.error("[ticker] Could not load site settings");
    return DEFAULT_TICKER;
  }
}

// ---------- App name and icon (changeable for everybody through the shop's "App makeover") ----------
import { cache } from "react";
import { inArray } from "drizzle-orm";
import { DEFAULT_APP_NAME } from "./shop";

export type AppBrand = {
  name: string;
  /** True once someone has bought a makeover (so the icon is served from the database, not the built-in files). */
  customIcon: boolean;
  iconV: string | null;
  by: string | null;
  icon32: string;
  icon192: string;
  icon512: string;
  iconApple: string;
  /** Only the built-in artwork has a padded Android "maskable" version. */
  iconMaskable: string | null;
};

const BUILT_IN = { icon32: "/icons/lean-32.png", icon192: "/icons/lean-192.png", icon512: "/icons/lean-512.png", iconApple: "/icons/lean-apple.png", iconMaskable: "/icons/lean-maskable-512.png" };

/** Reads the current name and icon version in one small query; cached per request. Falls back to the built-in brand on any error. */
export const getAppBrand = cache(async (): Promise<AppBrand> => {
  const fallback: AppBrand = { name: DEFAULT_APP_NAME, customIcon: false, iconV: null, by: null, ...BUILT_IN };
  if (!db) return fallback;
  try {
    const rows = await db.select().from(siteConfig).where(inArray(siteConfig.key, ["app_name", "app_icon_v", "app_brand_by"]));
    const v = (k: string) => rows.find((r) => r.key === k)?.value ?? null;
    const iconV = v("app_icon_v");
    const url = iconV ? `/api/app-icon?v=${encodeURIComponent(iconV)}` : null;
    return {
      name: v("app_name") ?? DEFAULT_APP_NAME,
      customIcon: Boolean(url),
      iconV,
      by: v("app_brand_by"),
      icon32: url ? `${url}&size=32` : BUILT_IN.icon32,
      icon192: url ? `${url}&size=192` : BUILT_IN.icon192,
      icon512: url ? `${url}&size=512` : BUILT_IN.icon512,
      iconApple: url ? `${url}&size=180` : BUILT_IN.iconApple,
      iconMaskable: url ? null : BUILT_IN.iconMaskable,
    };
  } catch {
    console.error("[brand] Could not load the app name and icon");
    return fallback;
  }
});

/** For code that is not rendering a page (push notifications): just the current app name. */
export async function getAppName(): Promise<string> {
  return (await getAppBrand()).name;
}
