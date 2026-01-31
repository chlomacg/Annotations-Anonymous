export function Post({ postData }: { postData: PostData }) {
  return (
    <div className="grid grid-cols-[max-content_auto] gap-x-4 gap-y-2">
      <a href="TODOO">
        <div className="rounded-full w-9 h-9 bg-sky-300"></div>
      </a>
      <div className="flex flex-row justify-between">
        <div className="flex flex-col justify-center gap-1">
          <span className="text-sm font-bold">
            {postData.author_display_name}
          </span>
          <span className="text-xs text-gray-500">
            @{postData.author_handle}
          </span>
        </div>
        <div className="text-sm text-gray-500">10hr ago</div>
      </div>
      <div></div>
      <p>{postData.content}</p>
    </div>
  );
}

export type PostData = {
  id: string;
  author_id: string;
  author_handle: string;
  author_display_name: string;
  time_created: Date;
  content: string;
};
