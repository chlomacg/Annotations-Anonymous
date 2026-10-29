export type Parsed = Chapter | Title | Footnote | Paragraph | List;

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
  body: ParagraphBody;
};
export type List = {
  kind: 'list';
  items: ParagraphBodyItem[][];
};

export type ParagraphBody = ParagraphBodyItem[];
export type ParagraphBodyItem = BodyText | FootnoteReference;
export type BodyText = {
  kind: 'text';
  text: string;
  style: Styles;
};
export type FootnoteReference = {
  kind: 'footnote reference';
  symbol: string;
  pageOfReferencedFootnote: number;
};

export type Styles = {
  italicized: boolean;
};
export const plainStyle: Styles = { italicized: false };
