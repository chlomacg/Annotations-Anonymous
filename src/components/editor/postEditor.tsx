'use client';

import {
    EditorProvider,
    PortableTextEditable,
    defineSchema
} from "@portabletext/editor";
import type {
    PortableTextBlock,
    RenderDecoratorFunction,
    RenderStyleFunction,
} from '@portabletext/editor';
import {EventListenerPlugin} from '@portabletext/editor/plugins'
import {useEffect, useState} from 'react'
import { Toolbar } from "./toolbar";

export function Editor({ userProfilePic }: { userProfilePic: boolean }) {
    // Set up the initial state getter and setter. Leave the starting value as undefined for now.
    const [value, setValue] = useState<Array<PortableTextBlock> | undefined>(
        undefined,
    )
    const [hasContent, setHasContent] = useState<boolean>(false);

    // For preventing hydration mismatches
    const [isClient, setIsClient] = useState<boolean>(false);
    useEffect(() => {
        setIsClient(true);
    }, []);

    return (isClient
    ? <div className="w-full flex flex-col gap-2 pb-2">
        <EditorProvider
            initialConfig={{
                schemaDefinition,
                initialValue: value,
            }}
        >
            <EventListenerPlugin
                on={(event) => {
                    if(event.type === 'mutation') {
                        setValue(event.value);
                        console.log(value);
                        setHasContent(value ? value.length != 0 : false);
                    }
                }}
            />
            <PortableTextEditable
                className="text-lg focus:outline-none active:outline-none"
                renderBlock={(props) => <div>{props.children}</div>}
                renderListItem={(props) => <>{props.children}</>}
            />
            <Toolbar hasContent={hasContent} />
        </EditorProvider>
    </div>
    : <></>)
}

const schemaDefinition = defineSchema({
    // Decorators are simple marks that don't hold any data
    decorators: [{name: 'strong'}, {name: 'em'}, {name: 'underline'}],
    // Styles apply to entire text blocks
    // There's always a 'normal' style that can be considered the paragraph style
    styles: [
      {name: 'normal'},
      {name: 'h1'},
      {name: 'h2'},
      {name: 'h3'},
      {name: 'blockquote'},
    ],
  
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