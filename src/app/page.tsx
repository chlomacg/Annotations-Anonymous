import { Editor } from "@/components/editor/postEditor";
import Post from "@/components/post";
import { db } from "@/database";
import Image from "next/image";


export default async function Home() {
  const posts = await db.selectFrom('post')
    .selectAll()
    .orderBy('post.time_created', 'desc')
    .limit(30)
    .execute();
  
  const userProfilePic = 'https://pbs.twimg.com/profile_images/1988665005928009728/X8Idm6KE_400x400.jpg';

  const newPostCount = 12;

  return (
    <div className="min-h-[100vh] flex flex-row justify-center bg-amber-50 text-black dark:bg-slate-900 dark:text-white">
      <div className="py-4 divide-y-2 dark:divide-gray-400 w-90 md:w-130 flex flex-col">
        <div className="flex flex-row gap-2">
          <Image src={userProfilePic} alt="Profile Picture of [CURRENT USER]" className="w-9 h-9 rounded-full" width={36} height={36}/>
          <Editor userProfilePic />
        </div>
        {ShowNewPostsButton(newPostCount)}
        {
          posts.map((post) => 
            <Post post={post} showInteractionButtons={true} key={post.id} />
          )
        }
      </div>
    </div>
  );
}


function ShowNewPostsButton(newPostCount: number) {
  if(newPostCount > 0){
    return <button className="cursor-pointer dark:text-amber-100 flex flex-row justify-center py-4">Show {newPostCount} new posts</button>;
  } else {
    return <></>;
  }
}