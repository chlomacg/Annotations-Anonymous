import { useState } from "react";
import { fetchRecentPosts } from "./util/apiCalls";
import { Post } from "./components/Post";
import { Editor } from "./components/Editor";
import { InteractionButtons } from "./components/PostInteractionButtons";

function App() {
  const [posts] = useState(fetchRecentPosts());

  return (
    <div className="min-h-screen flex flex-row justify-center bg-amber-50 text-black dark:bg-slate-900 dark:text-white">
      <div className="py-4 divide-y-2 dark:divide-gray-400 w-90 md:w-130 flex flex-col">
        <div className="flex flex-row gap-2">
          <img
            src="/chloe.jpg"
            alt="A profile picture"
            className="w-9 h-9 rounded-full"
          />
          <Editor />
        </div>
        {posts.map((postData) => (
          <div className="flex flex-col gap-6 py-4">
            <Post postData={postData} key={postData.id} />
            <InteractionButtons />
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
