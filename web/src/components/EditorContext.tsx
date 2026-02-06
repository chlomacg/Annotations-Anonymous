import { defineSchema, EditorProvider } from '@portabletext/editor';
import { type Session } from '../lib/backend';
import { Editor } from './Editor';
import type { ReactNode } from 'react';

export function EditorContext({ children }: { children: ReactNode }) {
  return (
    <div className="w-full flex flex-col divide-y-2 dark:divide-gray-400 pb-2">
      <EditorProvider
        initialConfig={{
          schemaDefinition,
        }}
      >
        {children}
      </EditorProvider>
    </div>
  );
}

const schemaDefinition = defineSchema({
  // Decorators are simple marks that don't hold any data
  decorators: [{ name: 'strong' }, { name: 'italic' }, { name: 'underline' }],
  // Styles apply to entire text blocks
  // There's always a 'normal' style that can be considered the paragraph style
  styles: [{ name: 'normal' }, { name: 'h1' }, { name: 'blockquote' }],

  // The types below are left empty for this example.
  // See the rendering guide to learn more about each type.

  // Annotations are more complex marks that can hold data (for example, hyperlinks).
  annotations: [],
  // Lists apply to entire text blocks as well (for example, bullet, numbered).
  lists: [],
  // Inline objects hold arbitrary data that can be inserted into the text (for example, custom emoji).
  inlineObjects: [],
  // Block objects hold arbitrary data that live side-by-side with text blocks (for example, images, code blocks, and tables).
  blockObjects: [],
});
