import { randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error("Set DATABASE_URL and a 32+ character AUTH_SECRET first.");
const sql = neon(process.env.DATABASE_URL);
const username = process.argv[2] || "admin";
if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) throw new Error("Use 3–30 letters, digits or underscores for the admin username.");
if ((await sql`select id from admins where username=${username}`).length) throw new Error("That admin already exists. Change its password in /admin instead.");
const password = randomBytes(24).toString("base64url");
const hash = await bcrypt.hash(password, 12);
const output = join(homedir(), "Downloads", "roblox-site-admin-login.txt");
await mkdir(join(homedir(), "Downloads"), { recursive: true });
// Create the credential file exclusively, so an existing credential note cannot be overwritten.
await writeFile(output, `THE ROBLOX SITE — admin login\n\nURL: https://2026-10-17-this-website-is-called-t.vercel.app/admin\nUsername: ${username}\nPassword: ${password}\n\nChange your password under Admin → Password. Keep these details private.\n`, { flag: "wx", mode: 0o600 });
try {
  await sql`insert into admins (username,password_hash) values (${username},${hash})`;
} catch (error) {
  console.error("Could not create the admin. The newly generated credential file is not valid.");
  throw error;
}
console.log(`Admin account created. Login details saved to ${output}. Password was not printed.`);
