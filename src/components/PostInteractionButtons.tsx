import { HeartIcon, RefreshCw, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchPostInteractionsByUser,
  fetchReplyCountOfPost,
  setPostLikedByUser,
  setPostRepostedByUser,
} from "../util/apiCalls";

export function InteractionButtons() {
  const { liked: initiallyLiked, reposted: initiallyReposted } =
    fetchPostInteractionsByUser("placeholder", "placeholder");
  const replyCount = fetchReplyCountOfPost("placeholder"); // later I'll make the reply count increase when a comment is written

  const [liked, setLiked] = useState(initiallyLiked);
  const [reposted, setReposted] = useState(initiallyReposted);

  // client
  const likePostWithLocalState = () => {
    setLiked((l) => !l);
  };
  // server
  useEffect(() => {
    setPostLikedByUser("placeholder", "placeholder", liked);
  }, [liked]);

  // client
  const repostWithLocalState = () => {
    setReposted((l) => !l);
  };
  // server
  useEffect(() => {
    setPostRepostedByUser("placeholder", "placeholder", reposted);
  }, [reposted]);

  return (
    <div className="flex flex-row justify-evenly">
      <LikeButton likePost={likePostWithLocalState} liked={liked} />
      <RepostButton repost={repostWithLocalState} reposted={reposted} />
      <CommentButton replyCount={replyCount} />
    </div>
  );
}

function LikeButton({
  likePost,
  liked,
}: {
  likePost?: () => void;
  liked: boolean;
}) {
  const fill = liked ? "#ff0d5d" : undefined;
  const color = fill;
  return (
    <button className="cursor-pointer" onClick={likePost}>
      <HeartIcon
        className="size-6 stroke-[1.75]"
        stroke={color || "currentColor"}
        fill={fill}
        color={color}
      />
    </button>
  );
}

function RepostButton({
  repost,
  reposted,
}: {
  repost?: () => void;
  reposted: boolean;
}) {
  const color = reposted ? "#66d973" : undefined;
  return (
    <button className="cursor-pointer" onClick={repost}>
      <RefreshCw color={color} size="22px" />
    </button>
  );
}

function CommentButton({
  draftReply,
  replyCount,
}: {
  draftReply?: () => void;
  replyCount: number;
}) {
  return (
    <div className="flex flex-row">
      <button className="cursor-pointer" onClick={draftReply}>
        <MessageSquare size="22px" />
      </button>
      <button className="cursor-pointer">
        <span className="pl-2 dark:text-gray-400">{replyCount}</span>
      </button>
    </div>
  );
}
