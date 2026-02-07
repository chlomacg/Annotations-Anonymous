import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authClient } from '@/lib/backend';

export function LoginDialog({
  loginPrompted,
  setLoginPrompted,
  prompt,
}: {
  loginPrompted: boolean;
  setLoginPrompted: (_: boolean) => void;
  prompt: { message: string; description: string };
}) {
  const signIn = async () => {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: 'http://localhost:5173/',
    });
  };

  return (
    <Dialog open={loginPrompted} onOpenChange={setLoginPrompted}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>{prompt.message}</DialogTitle>
          <DialogDescription>{prompt.description}</DialogDescription>
        </DialogHeader>
        <Button onClick={signIn}>Sign in with Google</Button>
      </DialogContent>
    </Dialog>
  );
}
