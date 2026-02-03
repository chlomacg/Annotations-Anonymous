import { Editor } from "./components/Editor";
import { Feed } from "./components/Feed";

function App() {
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
        <Feed />
      </div>
    </div>
  );
}

export default App;
