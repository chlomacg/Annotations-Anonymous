"use server";
import { db } from "@/database";

export async function p() {
  return await db
    .selectFrom("post")
    .selectAll()
    .orderBy("post.time_created", "desc")
    .limit(30)
    .execute();
}
