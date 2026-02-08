import { H1Icon } from '@heroicons/react/24/outline';
import { type PortableTextBlock } from '@portabletext/editor';
import { bold, italic, underline } from '@portabletext/keyboard-shortcuts';
import {
  useDecoratorButton,
  useStyleSelector,
  useToolbarSchema,
  type ExtendDecoratorSchemaType,
  type ExtendStyleSchemaType,
  type ToolbarDecoratorSchemaType,
  type ToolbarStyleSchemaType,
} from '@portabletext/toolbar';
import { toPlainText } from '@portabletext/toolkit';
import { BoldIcon, ItalicIcon, UnderlineIcon, QuoteIcon } from 'lucide-react';

export function Toolbar({
  content,
  sendPost,
}: {
  content?: PortableTextBlock[];
  sendPost: (() => void) | ((_: PortableTextBlock[]) => Promise<void>);
}) {
  // useToolbarSchema provides access to the PTE schema
  // optionally, pass in updated schemas to override the default
  const toolbarSchema = useToolbarSchema({
    extendDecorator, // see declarations below
    extendStyle, // see declarations below
  });
  const hasContent = content && toPlainText(content).trim().length != 0;

  return (
    <div className="w-full flex flex-row justify-between py-2">
      <div className="flex justify-between gap-1">
        {toolbarSchema.decorators?.map((decorator) => (
          <DecoratorButton key={decorator.name} schemaType={decorator} />
        ))}
        {toolbarSchema.styles?.map((style) => (
          <StyleButton key={style.name} schemaType={style} />
        ))}
      </div>
      <button
        onClick={async () => await sendPost(content!)}
        aria-disabled={!hasContent}
        disabled={!hasContent}
        className="cursor-pointer aria-disabled:cursor-default align-vertical px-4 py-1.5 rounded-full dark:text-gray-800 border-gray-300 border aria-disabled:border-orange-200 bg-orange-400/55 aria-disabled:bg-orange-200 aria-disabled:text-gray-500 dark:bg-gray-100 font-bold dark:aria-disabled:bg-slate-200/60 dark:aria-disabled:border-slate-200/60"
      >
        Post
      </button>
    </div>
  );
}
// Extend the schema with icons, titles, and keyboard shortcuts

const extendStyle: ExtendStyleSchemaType = (style) => {
  if (style.name === 'h1') {
    return {
      ...style,
      icon: () => (
        <div className="flex p-1 rounded-md border-2 group-aria-checked:bg-amber-200/60 dark:group-aria-checked:bg-gray-300 border-gray-300">
          <H1Icon className="size-3.75 [&>path]:stroke-[2px] dark:text-gray-300 dark:group-aria-checked:text-slate-900 dark:group-aria-checked:bg-gray-300" />
        </div>
      ),
      title: 'Title',
    };
  }
  if (style.name === 'blockquote') {
    return {
      ...style,
      icon: () => (
        <div className="p-1 rounded-md border-2 group-aria-checked:bg-amber-200/60 dark:group-aria-checked:text-slate-900 dark:group-aria-checked:bg-gray-300 border-gray-300">
          <QuoteIcon size="15px" strokeWidth="2px" />
        </div>
      ),
      title: 'Quote',
    };
  }

  return style;
};

const extendDecorator: ExtendDecoratorSchemaType = (decorator) => {
  if (decorator.name === 'strong') {
    return {
      ...decorator,
      // TODOO: maybe add color indication of half-bolded selected text (unsure if possible)
      icon: () => (
        <div className="p-0.75 rounded-md border-2 group-aria-checked:bg-amber-200/60 dark:group-aria-checked:bg-gray-300 border-gray-300">
          <BoldIcon className="size-4 dark:text-gray-300 dark:group-aria-checked:text-slate-900 dark:group-aria-checked:bg-gray-300" />
        </div>
      ),
      shortcut: bold,
      title: '',
    };
  }
  if (decorator.name === 'underline') {
    return {
      ...decorator,
      // TODOO: maybe add color indication of half-bolded selected text (unsure if possible)
      icon: () => (
        <div className="p-0.75 rounded-md border-2 group-aria-checked:bg-amber-200/60 dark:group-aria-checked:bg-gray-300 border-gray-300">
          <UnderlineIcon className="size-4.25 [&>path]:stroke-[2px] dark:text-gray-300 dark:group-aria-checked:text-slate-900 dark:group-aria-checked:bg-gray-300" />
        </div>
      ),
      // Optional: connect to a keyboard shortcut from the keyboard-shortcuts library
      shortcut: underline,
      title: '',
    };
  }
  if (decorator.name === 'italic') {
    return {
      ...decorator,
      // TODOO: maybe add color indication of half-bolded selected text (unsure if possible)
      icon: () => (
        <div className="p-0.75 rounded-md border-2  group-aria-checked:bg-amber-200/60  dark:group-aria-checked:bg-gray-300 border-gray-300">
          <ItalicIcon className="size-4 [&>path]:stroke-[2px] dark:text-gray-300 dark:group-aria-checked:text-slate-900 dark:group-aria-checked:bg-gray-300" />
        </div>
      ),
      shortcut: italic,
      title: '',
    };
  } else {
    console.log(decorator.name);
  }
  // ...repeat for each decorator type, or return the original decorator
  return decorator;
};

// Create a button for each decorator type
const DecoratorButton = (props: { schemaType: ToolbarDecoratorSchemaType }) => {
  const decoratorButton = useDecoratorButton(props);
  return (
    <button
      type="button"
      onClick={() => decoratorButton.send({ type: 'toggle' })}
      role="checkbox"
      aria-checked={decoratorButton.snapshot.matches({ enabled: 'active' })}
      className="group h-fit"
    >
      {props.schemaType.icon && <props.schemaType.icon />}
    </button>
  );
};
const StyleButton = (props: { schemaType: ToolbarStyleSchemaType }) => {
  const styleSelector = useStyleSelector({ schemaTypes: [props.schemaType] });
  return props.schemaType.icon ? (
    <button
      type="button"
      onClick={() => styleSelector.send({ type: 'toggle', style: props.schemaType.name })}
      role="checkbox"
      aria-checked={styleSelector.snapshot.context.activeStyle === props.schemaType.name}
      className="group h-fit"
    >
      {<props.schemaType.icon />}
    </button>
  ) : (
    <></>
  );
};
// ... and so on for each schema type, or create a generic button
