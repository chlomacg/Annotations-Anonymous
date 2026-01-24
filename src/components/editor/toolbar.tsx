'use client'

import {bold} from '@portabletext/keyboard-shortcuts'
import {
  useDecoratorButton,
  useStyleSelector,
  useToolbarSchema,
  type ExtendDecoratorSchemaType,
  type ExtendStyleSchemaType,
  type ToolbarDecoratorSchemaType,
  type ToolbarStyleSchemaType,
} from '@portabletext/toolbar'

export function Toolbar({ hasContent }: { hasContent: boolean }) {
  // useToolbarSchema provides access to the PTE schema
  // optionally, pass in updated schemas to override the default
  const toolbarSchema = useToolbarSchema({
    extendDecorator, // see declarations below
    extendStyle, // see declarations below
  })

  return (
    <div className="w-full flex flex-row justify-between">
      <div>
        {toolbarSchema.decorators?.map((decorator) => (
          <DecoratorButton key={decorator.name} schemaType={decorator} />
        ))}
        {toolbarSchema.styles?.map((style) => (
          <StyleButton key={style.name} schemaType={style} />
        ))}
      </div>
      <button aria-disabled={!hasContent} className="px-4 py-2 rounded-full dark:text-gray-800 font-bold dark:aria-disabled:bg-gray-500">Post</button>
    </div>
  )
}
// Extend the schema with icons, titles, and keyboard shortcuts

const extendStyle: ExtendStyleSchemaType = (style) => {
  // Apply updates to the schema, if needed
  if (style.name === 'h1') {
    return {
      ...style,
      title: 'Title',
    }
  }
  // ...repeat for each style type, or return the original style
  return style
}
const extendDecorator: ExtendDecoratorSchemaType = (decorator) => {
  if (decorator.name === 'strong') {
    return {
      ...decorator,
      // Optional: add a react component as an icon and unset the title
      icon: () => <strong>B</strong>,
      // Optional: connect to a keyboard shortcut from the keyboard-shortcuts library
      shortcut: bold,
      title: '',
    }
  }
  // ...repeat for each decorator type, or return the original decorator
  return decorator
}

// Create a button for each decorator type
const DecoratorButton = (props: {schemaType: ToolbarDecoratorSchemaType}) => {
  const decoratorButton = useDecoratorButton(props)
  return (
    <button
      type="button"
      onClick={() => decoratorButton.send({type: 'toggle'})}
      className={
        decoratorButton.snapshot.matches({enabled: 'active'}) ? 'active' : ''
      }
    >
      {props.schemaType.icon && <props.schemaType.icon />}
      {props.schemaType.title}
    </button>
  )
}
function StyleButton(props: {schemaType: ToolbarStyleSchemaType}) {
  const styleSelector = useStyleSelector({schemaTypes: [props.schemaType]})
  return (
    <button
      type="button"
      onClick={() =>
        styleSelector.send({type: 'toggle', style: props.schemaType.name})
      }
      className={styleSelector.snapshot.matches('enabled') ? 'active' : ''}
    >
      {props.schemaType.icon && <props.schemaType.icon />}
      {props.schemaType.title}
    </button>
  )
}
// ... and so on for each schema type, or create a generic button