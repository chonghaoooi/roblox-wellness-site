import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export const hasDb = Boolean(process.env.DATABASE_URL);

// Without DATABASE_URL the site still renders (all empty states) so the UI can be previewed.
export const db = hasDb ? drizzle(neon(process.env.DATABASE_URL!), { schema }) : null;

export function requireDb() {
  if (!db) throw new Error("DATABASE_URL is not set");
  return db;
}
