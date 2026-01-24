import { Post as PostTable, JsonValue } from "kysely-codegen";
import { PostInteractionButtons } from "./postInteractionButtons";
import { Selectable } from "kysely";

export default function Post({
    post,
    showInteractionButtons = false
}: {
    post: Selectable<PostTable>,
    showInteractionButtons?: boolean
}) {
    if(!post.content || typeof post.content != 'object' || !('content' in post.content) || typeof post.content.content != 'string')
        return <h1>No content yet folks!</h1>;
    if(!post.author_handle || !post.author_display_name || !post.time_created)
        return <h1>Bad data folks!</h1>;


    return (<div className="flex flex-col p-4 gap-6">
        <div className="grid grid-cols-[max-content_auto] gap-x-4 gap-y-2">
            <a href={post.content.content}><div className="rounded-full w-9 h-9 bg-sky-300"></div></a>
            <div className="flex flex-row justify-between">
                <div className="flex flex-col justify-center gap-1">
                    <span className="text-sm font-bold">{post.author_display_name}</span>
                    <span className="text-xs text-gray-500">@{post.author_handle}</span>
                </div>
                <div className="text-sm text-gray-500">10hr ago</div>
            </div>
            <div></div>
            <p>{post.content.content}</p>
        </div>

        <PostInteractionButtons showInteractionButtons={showInteractionButtons} />

    </div>);
}