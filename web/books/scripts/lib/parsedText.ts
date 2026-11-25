export type Parsed =
  | Chapter
  | Title
  | Footnote
  | Paragraph
  | CenteredText
  | List
  | ResentmentsTable
  | TombstoneDoggerel;

export type Chapter = {
  kind: 'chapter';
  text: string;
};
export type Title = {
  kind: 'title';
  text: string;
};
export type Footnote = {
  kind: 'footnote';
  symbol: string;
  pageIndex: number;
  body: ParagraphBody;
};
export type Paragraph = {
  kind: 'paragraph';
  bigLetter?: string;
  indentLevel: number;
  baseline?: number;
  singleLine: boolean;
  body: ParagraphBody;
};
export type CenteredText = {
  kind: 'centered';
  lines: CenteredParagraph[];
};
export type List = {
  kind: 'list';
  listStyle: 'decimal' | 'alpha-parentheses' | '[upper-roman]' | '[lower-roman]';
  items: ParagraphBody[];
};
export type ResentmentsTable = {
  kind: 'resentments table';
};
export type TombstoneDoggerel = {
  kind: 'tombstone doggerel';
};

export type ParagraphBody = ParagraphBodyItem[];
export type ParagraphBodyItem = BodyText | FootnoteReference | LineBreak;
export type LineBreak = { kind: 'linebreak' };
export type BodyText = {
  kind: 'text';
  text: string;
  style: Styles;
  spaceBefore: ' ' | '';
};
export type FootnoteReference = {
  kind: 'footnote reference';
  symbol: string;
  pageOfReferencedFootnote: number;
};

export type CenteredParagraph = {
  indent: number;
  baseline?: number;
  body: ParagraphBody;
};

export type Styles = {
  italicized: boolean;
};
export const plainStyle: Styles = { italicized: false };
