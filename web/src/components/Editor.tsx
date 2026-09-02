import { trpc, queryClient, type Session } from '@/lib/backend';
import {
  PortableTextEditable,
  type BlockRenderProps,
  type PortableTextBlock,
  type RenderDecoratorFunction,
} from '@portabletext/editor';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Toolbar } from './EditorToolbar';
import { EventListenerPlugin } from '@portabletext/editor/plugins';
import { useState } from 'react';

export function Editor({
  session,
  promptLogin,
  resetEditor,
}: {
  session: Session | null;
  promptLogin: () => void;
  resetEditor: () => void;
}) {
  const [content, setContent] = useState<PortableTextBlock[] | undefined>(undefined);

  const sendPostMutation = useMutation({
    ...trpc.post.send.mutationOptions(),
    onSuccess: async (postId?: string) => {
      // Refresh feed
      const queryKey = trpc.post.fetchMostRecent.queryKey();
      await queryClient.invalidateQueries({ queryKey });

      resetEditor();
      toast('Post sent!');
    },
    onError: async () => {
      toast('Post not sent, something went wrong :(', {
        position: 'top-center',
        style: { color: 'oklch(63.7% 0.237 25.331)' },
      });
    },
  });

  const sendPost =
    session == null
      ? promptLogin
      : async (post: PortableTextBlock[]) => {
          const result = await sendPostMutation.mutateAsync(post);
          if (result == undefined) toast('Failed to send post', { position: 'top-center' });
        };

  return (
    <>
      <EventListenerPlugin
        on={(event) => {
          if (event.type === 'mutation') {
            setContent(event.value);
          }
        }}
      />
      <PortableTextEditable
        className="text-lg focus:outline-none active:outline-none py-2"
        renderPlaceholder={() => <span className="text-gray-500">Blaze your glory...</span>}
        renderBlock={renderBlock}
        renderDecorator={renderDecorator}
        renderListItem={(props) => <>{props.children}</>}
      />
      <Toolbar content={content} sendPost={sendPost} />
    </>
  );
}

function renderBlock(props: BlockRenderProps) {
  if (props.style === 'h1') return <h1 className="text-2xl font-bold">{props.children}</h1>;
  if (props.style === 'blockquote')
    return <blockquote className="ml-2 pl-2 border-l-2 border-gray-500">{props.children}</blockquote>;
  else return <div>{props.children}</div>;
}

const renderDecorator: RenderDecoratorFunction = (props) => {
  switch (props.value) {
    case 'strong':
      return <strong className="font-bold">{props.children}</strong>;
    case 'italic':
      return <em>{props.children}</em>;
    case 'underline':
      return <u>{props.children}</u>;
    default:
      return <>{props.children}</>;
  }
};
