import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authClient } from '@/lib/backend';

export function LoginDialog({
  loginPrompted,
  setLoginPrompt,
}: {
  loginPrompted: boolean;
  setLoginPrompt: (_: boolean) => void;
}) {
  const signIn = async () => {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: 'http://localhost:5173/',
    });
  };

  return (
    <Dialog open={loginPrompted} onOpenChange={setLoginPrompt}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Please log in to post</DialogTitle>
          <DialogDescription>Your post will be waiting for you after logging in.</DialogDescription>
        </DialogHeader>
        <Button onClick={signIn}>Sign in with Google</Button>
      </DialogContent>
    </Dialog>
  );
}
