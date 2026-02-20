// "Normal" does not mean unstyled, it just means that the line is not one of the below types of lines
export type Normal = {
  kind: 'normal';
};
// First line of paragraph
export type Indented = {
  kind: 'indented';
};
// First line of chapter
export type BigLetter = {
  kind: 'big letter';
};
export type Chapter = {
  kind: 'chapter';
  chapter: number; // 1 indexed
};
export type Title = {
  kind: 'title';
  title: string;
};
export type PageNumber = {
  kind: 'page number';
  page: number;
};
export type FootnoteReference = {
  kind: 'footnote link';
  indicatorSymbol: string;
};
export type Footnote = {
  kind: 'footnote';
  indicatorSymbol: string;
  note: string;
};
