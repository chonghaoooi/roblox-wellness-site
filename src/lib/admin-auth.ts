import "server-only";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { admins } from "@/db/schema";

const COOKIE = "admin_session";
const AUDIENCE = "roblox-site-admin";
const ISSUER = "roblox-site";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("Admin login requires AUTH_SECRET with at least 32 characters");
  return new TextEncoder().encode(value);
}

export async function createAdminSession(admin: { id: number; sessionVersion: number }) {
  const token = await new SignJWT({ aid: admin.id, version: admin.sessionVersion })
    .setProtectedHeader({ alg: "HS256" }).setIssuer(ISSUER).setAudience(AUDIENCE)
    .setIssuedAt().setExpirationTime("8h").sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: "/admin", maxAge: 8 * 60 * 60,
  });
}

export async function destroyAdminSession() {
  (await cookies()).set(COOKIE, "", { path: "/admin", maxAge: 0, httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
}

export async function getAdmin() {
  if (!db) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE });
    if (!Number.isSafeInteger(payload.aid) || !Number.isSafeInteger(payload.version)) return null;
    const [admin] = await db.select({ id: admins.id, username: admins.username, sessionVersion: admins.sessionVersion })
      .from(admins).where(eq(admins.id, Number(payload.aid))).limit(1);
    return admin && admin.sessionVersion === payload.version ? admin : null;
  } catch { return null; }
}

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
