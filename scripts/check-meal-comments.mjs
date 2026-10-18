// API/database integration with short-lived QA fixtures; finally removes them and their comments.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { SignJWT } from "jose";
import { readFile } from "node:fs/promises";

const db = neon(process.env.DATABASE_URL);
const base = "http://localhost:3002";
const marker = `qa-comments-${randomUUID()}`;
const ids = [];
try {
  for (const n of [1, 2]) {
    const [user] = await db`insert into users(username,email,password_hash) values (${marker + n}, ${marker + n + "@example.invalid"}, 'not-a-login-hash') returning id`;
    ids.push(user.id);
  }
  const image = (await readFile("public/icons/lean-192.png")).toString("base64");
  const [meal] = await db`insert into meals(user_id,caption,data_b64) values (${ids[0]}, 'Temporary QA meal', ${image}) returning id`;
  const endpoint = `${base}/api/meals/${meal.id}/comments`;
  const cookie = async (id) => "session=" + await new SignJWT({ uid: id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("5m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  const cookies = await Promise.all(ids.map(cookie));
  const request = (method, who, body, suffix = "", origin = base) => fetch(endpoint + suffix, { method,
    headers: { Origin: origin, "Content-Type": "application/json", ...(who === null ? {} : { Cookie: cookies[who] }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  let r = await request("POST", null, { text: "hello" }); assert.equal(r.status, 401);
  r = await request("POST", 0, { text: "hello" }, "", "https://elsewhere.invalid"); assert.equal(r.status, 403);
  for (const text of ["   ", "x".repeat(241)]) { r = await request("POST", 0, { text }); assert.equal(r.status, 400); }
  r = await request("POST", 0, { text: "  First\ncomment  " }); assert.equal(r.status, 201);
  const first = (await r.json()).comment; assert.equal(first.text, "First comment");
  r = await request("POST", 1, { text: "Second comment" }); assert.equal(r.status, 201);
  const second = (await r.json()).comment;
  const gallery = await (await fetch(`${base}/meals`)).text();
  assert.ok(gallery.includes("Second comment"), "gallery renders the newest stored comment preview");
  r = await request("GET", 0); const list = await r.json();
  assert.deepEqual(list.comments.map((c) => [c.id, c.mine]), [[second.id, false], [first.id, true]]);
  r = await request("DELETE", 1, undefined, `?comment=${first.id}`); assert.equal(r.status, 403);
  r = await request("DELETE", 0, undefined, `?comment=${first.id}`); assert.equal(r.status, 200);
  await db`insert into meal_comments(meal_id,user_id,text) select ${meal.id}, ${ids[0]}, 'QA page ' || n from generate_series(1,30) n`;
  r = await request("POST", 0, { text: "Rate limit check" }); assert.equal(r.status, 409);
  r = await request("GET", null); const page1 = await r.json(); assert.equal(page1.comments.length, 20); assert.ok(page1.next);
  r = await request("GET", null, undefined, `?before=${page1.next}`); const page2 = await r.json(); assert.equal(page2.comments.length, 11);
  assert.ok(page2.comments.every((c) => c.id < page1.next));
  await db`delete from meals where id=${meal.id}`;
  const [remaining] = await db`select count(*)::int as n from meal_comments where meal_id=${meal.id}`; assert.equal(remaining.n, 0);
  console.log("Meal comments passed: auth, origin, bounds, normalization, newest first, ownership, pagination, rate limit and meal cascade.");
} finally {
  for (const id of ids) await db`delete from users where id=${id} and username like ${marker + '%'}`;
  console.log("QA meals, users and comments removed.");
}
