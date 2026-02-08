import { useState } from 'react';
import { EditorContext } from './components/EditorContext';
import { Feed } from './components/Feed';
import { authClient } from './lib/backend';
import { Button } from './components/ui/button';
import { LoginDialog } from './components/LoginDialog';
import { toast } from 'sonner';

function App() {
  const {
    data: session,
    isPending, //loading state
    error, //error object
    refetch, //refetch the session
  } = authClient.useSession();

  const [loginPrompted, setLoginPrompted] = useState(false);
  const [prompt, setPrompt] = useState({ message: '', description: '' });

  return (
    <div className="min-h-screen antialiased flex flex-row justify-center bg-amber-50 text-black dark:bg-slate-900 dark:text-white relative z-0">
      <LoginDialog prompt={prompt} loginPrompted={loginPrompted} setLoginPrompted={setLoginPrompted} />
      {session ? (
        <Button
          className="absolute top-0 right-0 m-4"
          onClick={() => {
            authClient.signOut();
            toast('Signed out', { position: 'top-right' });
          }}
        >
          Log out
        </Button>
      ) : (
        <Button
          className="absolute top-0 right-0 m-4"
          onClick={() => {
            setPrompt({
              message: 'Hello 👋',
              description: 'Come on in!',
            });
            setLoginPrompted(true);
          }}
        >
          Log in
        </Button>
      )}
      <div className="py-4 divide-y-2 dark:divide-gray-400 w-90 md:w-130 flex flex-col">
        <div className="flex flex-row gap-2">
          {session && <img src="/chloe.jpg" alt="A profile picture" className="w-9 h-9 rounded-full" />}
          <EditorContext
            session={session}
            promptLogin={() => {
              setPrompt({
                message: 'Please sign in to post',
                description: 'Your post will be waiting for you',
              });

              setLoginPrompted(true);
            }}
          />
        </div>
        <Feed />
      </div>
    </div>
  );
}

export default App;
