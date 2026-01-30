"use server";

import { db } from "@/database";
import { json } from "@/database";
import { User } from "@/types";
import { PortableTextBlock } from "@portabletext/editor";
import { Selectable } from "kysely";
import { Post as PostTable } from "@/db/types";

export async function sendPost(
  portableText: PortableTextBlock[],
  user: User,
  postCallBack?: (_: Selectable<PostTable>) => void
) {
  "use server";

  const content = json(portableText);
  const time_created = new Date();
  const replies: string[] = [];
  const reposted_by: string[] = [];
  const liked_by: string[] = [];
  const { author_display_name, author_id, author_handle } = user;

  // this one is only empty until I add reply functionality
  const thread_replied_to: string[] = [];

  const post = await db
    .insertInto("post")
    .values({
      content,
      author_display_name,
      author_id,
      author_handle,
      time_created,
      replies,
      reposted_by,
      liked_by,
      thread_replied_to,
    })
    .returningAll()
    .executeTakeFirst();

  if (postCallBack) postCallBack(post!);
}
