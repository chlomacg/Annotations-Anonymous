"use server";

import { db } from "@/database";
import { json } from "@/database";
import { User } from "@/types";
import { PortableTextBlock } from "@portabletext/editor";
import { Selectable } from "kysely";
import { Draft } from "@/db/types";

export async function saveDraft(
  portableText: PortableTextBlock[],
  user: User,
  saveCallBack?: (_: Selectable<Draft>) => void
) {
  "use server";

  const content = json(portableText);
  const times_edited = [new Date()];
  const { author_handle, author_id } = user;

  const draft = await db
    .insertInto("draft")
    .values({
      author_handle,
      author_id,
      times_edited,
      content,
    })
    .returningAll()
    .executeTakeFirst();

  if (saveCallBack) saveCallBack(draft!);
}
