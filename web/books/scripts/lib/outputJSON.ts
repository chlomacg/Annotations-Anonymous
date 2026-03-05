export type Parsed = Chapter | Title | Footnote | Paragraph;

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
  text: string;
};
export type Paragraph = {
  kind: 'paragraph';
  bigLetter?: string;
  body: ParagraphBody;
};

export type ParagraphBody = ParagraphBodyItem[];
export type ParagraphBodyItem = BodyText | FootnoteReference;
export type BodyText = {
  kind: 'text';
  text: string;
  continuationOfPreviousItem: boolean | 'keep hyphen';
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
