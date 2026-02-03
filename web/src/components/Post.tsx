import type { PortableTextBlock } from "@portabletext/editor";
import { PortableText, type PortableTextComponents } from "@portabletext/react";

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
      <div>
        <PortableText value={postData.content} components={components} />
      </div>
    </div>
  );
}

const components: PortableTextComponents = {
  marks: {},
  block: {
    blockquote: ({ children }) => {
      return (
        <blockquote className="border-l-3 border-l-gray-400 p-2 my-2">
          {children}
        </blockquote>
      );
    },
  },
};

export type PostData = {
  id: string;
  author_id: string;
  author_handle: string;
  author_display_name: string;
  created_at: Date;
  content: PortableTextBlock[];
};
