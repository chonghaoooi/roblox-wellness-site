"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function removeComment(id: number) {
  const admin = await requireAdmin();
  if (!Number.isSafeInteger(id) || id <= 0) return;
  await requireDb().execute(sql`
    with removed as (delete from meal_comments where id = ${id} returning id)
    insert into admin_audit (admin_id, action, target, details)
    select ${admin.id}, 'delete', 'meal-comment:' || id, 'Removed a meal comment' from removed`);
  revalidatePath("/meals"); revalidatePath("/admin");
}
