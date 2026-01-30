import { saveDraft } from "@/actions/saveDraft";
import { sendPost } from "@/actions/sendPost";
import { User } from "@/types";
import { PortableTextBlock } from "@portabletext/editor";
import { Selectable } from "kysely";
import { Draft, Post } from "kysely-codegen";

export function saveDraftForUser(
  user: User,
  saveCallBack?: (_: Selectable<Draft>) => void
) {
  return async function (text: PortableTextBlock[]) {
    saveDraft(text, user, saveCallBack);
  };
}

export function sendPostForUser(
  user: User,
  postCallBack?: (_: Selectable<Post>) => void
) {
  return async function (text: PortableTextBlock[]) {
    sendPost(text, user, postCallBack);
  };
}
