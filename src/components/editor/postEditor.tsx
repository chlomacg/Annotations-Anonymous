'use client';

import {
    EditorProvider,
    PortableTextEditable,
    defineSchema
} from "@portabletext/editor";
import type {
    BlockRenderProps,
    PortableTextBlock,
    RenderDecoratorFunction,
} from '@portabletext/editor';
import { EventListenerPlugin } from '@portabletext/editor/plugins'
import { useEffect, useState } from 'react'
import { Toolbar } from "./toolbar";


export function Editor({ saveDraft, sendPost }: { saveDraft: (_: PortableTextBlock[]) => void, sendPost: (_: PortableTextBlock[]) => void }) {
    // Set up the initial state getter and setter. Leave the starting value as undefined for now.
    const [content, setContent] = useState<Array<PortableTextBlock> | undefined>(
        undefined,
    )

    // For preventing hydration mismatches
    const [isClient, setIsClient] = useState<boolean>(false);
    useEffect(() => {
        setIsClient(true);
    }, []);

    if(!isClient)
        return

    return (
        <div className="w-full flex flex-col divide-y-2 dark:divide-gray-400 pb-2">
            <EditorProvider
                initialConfig={{
                    schemaDefinition,
                    initialValue: content,
                }}
            >
                <EventListenerPlugin
                    on={(event) => {
                        if(event.type === 'mutation') {
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
                <Toolbar content={content} sendPost={sendPost} saveDraft={saveDraft} />
                <pre className="py-2">
                    {JSON.stringify(content, null, 2)}
                </pre>
            </EditorProvider>
        </div>
    )
}

function renderBlock(props: BlockRenderProps) {
    if(props.style === "h1")
        return <h1 className="text-2xl font-bold">{props.children}</h1>;
    if(props.style === "blockquote")
        return <blockquote className="ml-2 pl-2 border-l-2 border-gray-500">{props.children}</blockquote>
    else
        return <div>{props.children}</div>
}

const renderDecorator: RenderDecoratorFunction = (props) => {
    if(props.value === 'strong')
        return <strong className="font-bold">{props.children}</strong>
    if(props.value === 'italic')
        return <em>{props.children}</em>
    if(props.value === 'underline')
        return <u>{props.children}</u>
    return <>{props.children}</>
}

const schemaDefinition = defineSchema({
    // Decorators are simple marks that don't hold any data
    decorators: [{name: 'strong'}, {name: 'italic'}, {name: 'underline'}],
    // Styles apply to entire text blocks
    // There's always a 'normal' style that can be considered the paragraph style
    styles: [
      {name: 'normal'},
      {name: 'h1'},
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