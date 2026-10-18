import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { db } from "@/db";
import { settings, users } from "@/db/schema";
import { DEFAULTS } from "./calc";

const COOKIE = "session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me-please");

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getUser() {
  if (!db) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const [u] = await db.select().from(users).where(eq(users.id, Number(payload.uid))).limit(1);
    return u ? { id: u.id, username: u.username, email: u.email } : null;
  } catch {
    return null;
  }
}

export async function getSettings(userId: number) {
  if (!db) return { ...DEFAULTS, userId };
  const [s] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  return s ?? { ...DEFAULTS, userId };
}
