"use client";

import { useState } from "react";
import { Heart, MessageCircle, RefreshCw } from "lucide-react";

export function PostInteractionButtons({
  showInteractionButtons,
}: {
  showInteractionButtons: boolean;
}) {
  const [postLiked, setLike] = useState<boolean>(true);
  const [reposted, setRepost] = useState<boolean>(false);

  const likePost = () => setLike(!postLiked);
  const repost = () => setRepost(!reposted);

  if (!showInteractionButtons) return <></>;

  return (
    <div className="flex flex-row justify-evenly">
      <LikeButton likePost={likePost} postLiked={postLiked} />
      <RepostButton repost={repost} reposted={reposted} />
      <button className="cursor-pointer">
        <MessageCircle />
      </button>
    </div>
  );
}

function LikeButton({
  likePost,
  postLiked,
}: {
  likePost: () => void;
  postLiked: boolean;
}) {
  if (postLiked) {
    return (
      <button className="cursor-pointer" onClick={likePost}>
        <Heart fill="#ff0d5d" color="#ff0d5d" />
      </button>
    );
  } else {
    return (
      <button className="cursor-pointer" onClick={likePost}>
        <Heart />
      </button>
    );
  }
}
function RepostButton({
  repost,
  reposted,
}: {
  repost: () => void;
  reposted: boolean;
}) {
  if (reposted) {
    return (
      <button className="cursor-pointer" onClick={repost}>
        <RefreshCw color="#66d973" />
      </button>
    );
  } else {
    return (
      <button className="cursor-pointer" onClick={repost}>
        <RefreshCw />
      </button>
    );
  }
}
