"use client";

import { Editor } from "@/components/editor/postEditor";
import Post from "@/components/post";
import { User } from "@/types";
import { p } from "@/util/blah";
import { sendPostForUser, saveDraftForUser } from "@/util/dbWrapperFunctions";
import { Selectable } from "kysely";
import { Post as PostTable } from "@/db/types";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function Home() {
  const [posts, setPosts] = useState<Selectable<PostTable>[]>([]);
  const fetchPosts = async () => {
    setPosts(await p()); // p() is bullshit im having to do to make sure the db calls run on the server
  };
  useEffect(() => {
    fetchPosts();
  });

  // Temporary constants
  const userProfilePic =
    "https://pbs.twimg.com/profile_images/1988665005928009728/X8Idm6KE_400x400.jpg";
  const current_user: User = {
    author_handle: "chlomacg",
    author_id: "019c0b92-1ded-7a59-b07b-0f297299b21d",
    author_display_name: "Chloe M.",
  };
  const newPostCount = 12;

  const sendPost = sendPostForUser(current_user, (post) =>
    setPosts((p) => [post, ...p])
  );
  const saveDraft = saveDraftForUser(current_user);

  return (
    <div className="min-h-screen flex flex-row justify-center bg-amber-50 text-black dark:bg-slate-900 dark:text-white">
      <div className="py-4 divide-y-2 dark:divide-gray-400 w-90 md:w-130 flex flex-col">
        <div className="flex flex-row gap-2">
          <Image
            src={userProfilePic}
            alt="Profile Picture of [CURRENT USER]"
            className="w-9 h-9 rounded-full"
            width={36}
            height={36}
          />
          <Editor sendPost={sendPost} saveDraft={saveDraft} />
        </div>
        {ShowNewPostsButton(newPostCount)}
        {posts.map((post) => (
          <Post post={post} showInteractionButtons={true} key={post.id} />
        ))}
      </div>
    </div>
  );
}

function ShowNewPostsButton(newPostCount: number) {
  if (newPostCount > 0) {
    return (
      <button className="cursor-pointer dark:text-amber-100 flex flex-row justify-center py-4">
        Show {newPostCount} new posts
      </button>
    );
  } else {
    return <></>;
  }
}
