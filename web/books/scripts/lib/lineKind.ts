// "Normal" does not mean unstyled, it just means that the line is not one of the below types of lines
export type Normal = {
  kind: 'normal';
};
// First line of paragraph
export type Indented = {
  kind: 'indented';
};
// First body line of chapter begins with a large letter
export type BigLetter = {
  kind: 'big letter';
};
export type Chapter = {
  kind: 'chapter';
  chapter: number; // 1 indexed
};
// At the top of pages that do not start the chapter;
// either 'ALCOHOLICS ANONYMOUS' or the chapter name in all uppercase
export type Title = {
  kind: 'title';
  title: string;
};
export type PageNumber = {
  kind: 'page number';
  page: number;
};
export type Footnote = {
  kind: 'footnote';
  symbol: string;
  note: string;
};
