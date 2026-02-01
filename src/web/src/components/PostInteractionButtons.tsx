import { HeartIcon, RefreshCw, MessageSquare } from "lucide-react";
import { trpc } from "../util/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";

export function InteractionButtons() {
  const postId = "019c0fcc-c23a-7aaa-a2cf-af25fd3f301b";

  const userInteractionsQuery = useQuery({
    ...trpc.post.interactions.byUser.queryOptions(postId),
    initialData: { postId, liked: false, reposted: false },
  });
  const interactionStatsQuery = useQuery(
    trpc.post.interactions.getStats.queryOptions(postId)
  );

  const { liked, reposted } = userInteractionsQuery.data;

  const likeMutation = useMutation(
    trpc.post.setLikeOnPost.mutationOptions({ postId, likeState: liked })
  );
  const likePost = () => {
    likeMutation.mutate({ postId, likeState: !liked });
  };
  const repostMutation = useMutation(
    trpc.post.setRepost.mutationOptions({ postId, likeState: liked })
  );
  const repost = () => {
    repostMutation.mutate({ postId, repostState: !reposted });
  };

  if (
    userInteractionsQuery.error ||
    interactionStatsQuery.error ||
    !interactionStatsQuery
  )
    return "Error...";

  const replyCount = interactionStatsQuery.data?.replies;

  return (
    <div className="flex flex-row justify-evenly">
      <LikeButton
        likePost={likePost}
        liked={
          likeMutation.isPending ? likeMutation.variables.likeState : liked
        }
      />
      <RepostButton
        repost={repost}
        reposted={
          repostMutation.isPending
            ? repostMutation.variables.repostState
            : reposted
        }
      />
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
  replyCount?: number;
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
