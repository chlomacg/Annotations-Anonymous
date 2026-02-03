import { useQuery } from "@tanstack/react-query";
import { trpc } from "../util/backend";
import { Post } from "./Post";
import { InteractionButtons } from "./PostInteractionButtons";

export function Feed() {
  const {
    isPending,
    error,
    data: posts,
  } = useQuery(trpc.post.fetchMostRecent.queryOptions(50));

  return isPending
    ? "Loading..."
    : error
      ? "Error!"
      : posts.map((postData) => (
          <div className="flex flex-col gap-6 py-4" key={postData.id}>
            <Post postData={postData} />
            <InteractionButtons postId={postData.id} />
          </div>
        ));
}
