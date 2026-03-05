import { readdir } from 'node:fs/promises';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import convert from 'convert';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';

import isWord from 'is-word';
const englishWords = isWord('american-english');

async function main() {
  const mode: string = process.argv[2];
  const dir = 'AA-test';

  switch (mode) {
    case 'plain-text':
      return makeAllPlainText(dir);
    case 'html':
      return makeAllHTML(dir);
    default:
      console.log(`invalid mode ${mode}`);
  }
}

async function makeAllPlainText(directory: string) {
  const plainText = await processDirectory(
    directory,
    (path) => getTextFromPDF(path).then(convertFileToPlainText),
    'Converted to plain text',
  );

  console.log(plainText.join('\n\n'));
}

async function makeAllHTML(directory: string) {
  const parsed: Parsed[] = await processDirectory(
    directory,
    async (path) => getTextFromPDF(path).then(convertFileToHTML),
    'Converted to html',
  ).then((arr) => arr.flat(1));

  console.dir(parsed, { depth: null });
}

async function processDirectory<T>(
  directory: string,
  process: (path: string) => Promise<T>,
  processName: string,
): Promise<T[]> {
  const currentDir = import.meta.dirname;
  const parentDir = currentDir.slice(0, currentDir.lastIndexOf('/'));

  const dir = `${parentDir}/${directory}`;
  const files = await readdir(dir);

  const time1 = new Date();
  const out = await Promise.all(files.map((file) => process(`${dir}/${file}`)));
  const time2 = new Date();

  const elapsed2 = convert(time2.getTime() - time1.getTime(), 'ms').to('best');
  console.log(`${processName} in ${elapsed2.toString()}`);

  return out;
}

type BlockOf<T> = {
  item: T;
  position: Position;
  pageIndex: number;
};

type Position = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MarkedLine = {
  contents: (TextItem & FootnoteInfo)[];
  continuationOfPreviousLine: boolean | 'keep hyphen';
} & LineType;

// Marks the symbol in the body that alerts the reader to read the footnote
type FootnoteInfo = {
  symbol?: string;
};

import type * as LineKind from './lib/lineKind.ts';

type LineType =
  | LineKind.Normal
  | LineKind.Chapter
  | LineKind.Title
  | LineKind.Indented
  | LineKind.BigLetter
  | LineKind.PageNumber
  | LineKind.Footnote;

async function getTextFromPDF(path: string): Promise<TextContent[]> {
  const doc = await pdfjsLib.getDocument(path).promise;
  const docLength = doc.numPages;
  const pageIndices = [...Array(docLength).keys()].map((i) => i + 1);

  return Promise.all(
    pageIndices.map((i) => {
      return doc.getPage(i).then((page) => page.getTextContent());
    }),
  ).then(async (docTexts) => {
    await doc.destroy();
    return docTexts;
  });
}

function positionOf(item: TextItem): Position {
  const { width, height } = item;

  // If we don't add the height the giant letter that starts the chapter goes later than it should
  const y: number = item.transform[5] + height;
  const x: number = item.transform[4];

  return { x, y, width, height };
}

// Fully marks all line and item info
function processText(content: TextContent[]): BlockOf<MarkedLine>[] {
  const textItems: BlockOf<TextItem>[] = content.flatMap((c, pageIndex) =>
    c.items
      .filter((item) => 'str' in item)
      .map((item) => ({ item, position: positionOf(item), pageIndex }))
      .sort((a, b) => {
        // The origin is in the bottom-left of the page, so a lower y value means lower on the page.
        // We want to sort it top to bottom first.
        if (a.position.y < b.position.y) return 1;
        // but a lower x value means closer to the start of the line (left in English). Left-to-right second
        if (a.position.y == b.position.y) return a.position.x - b.position.x;
        // else y(a) > y(b)
        return -1;
      }),
  );

  const lines = getGraphicalLines(textItems);

  markLines(lines);
  markParagraphs(lines);
  markWordBreaks(lines);
  markFootnotes(lines);

  return lines;
}

import type { BodyText, Paragraph, ParagraphBody, ParagraphBodyItem, Parsed } from './lib/outputJSON.ts';

function convertFileToHTML(content: TextContent[]): Parsed[] {
  const lines = processText(content);

  const paragraphs: BlockOf<MarkedLine>[][] = [];
  // Non-paragraph elements that interrupt a paragraph go after it
  // (there's no reason to be tied down to the layout Bill W picked!)
  let nonParagraphs: BlockOf<MarkedLine>[] = [];

  for (let i = 0; i < lines.length; i++) {
    switch (lines[i].item.kind) {
      case 'big letter':
      case 'indented':
        for (let i = 0; i < nonParagraphs.length; i++) paragraphs.push([nonParagraphs[i]]);
        nonParagraphs = [];
        paragraphs.push([lines[i]]);
        break;
      case 'normal':
        paragraphs[paragraphs.length - 1].push(lines[i]);
        break;
      case 'chapter':
      case 'footnote':
        nonParagraphs.push(lines[i]);
        break;
      // We Don't Like These Very Much.
      case 'title':
      case 'page number':
    }
  }

  const fontNames = Map.groupBy(
    paragraphs.flatMap((p) => p.flatMap(({ item }) => item.contents.map(({ str, fontName }) => ({ str, fontName })))),
    ({ fontName }) => fontName,
  );

  let italicFontName: string | undefined;
  fontNames.forEach((strs) => {
    if (strs[0].str.startsWith('Chapter')) italicFontName = strs[0].fontName;
  });

  const elements: Parsed[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const element = processParagraph(paragraphs[i], italicFontName!);
    if (element != undefined) elements.push(element);
  }

  return elements;
}

function convertFileToPlainText(content: TextContent[]): string {
  let str = '';
  const lines = processText(content);

  let isFirstPrintedLine = true;
  lines.forEach((line) => {
    if (['title', 'chapter', 'page number'].includes(line.item.kind)) return;

    if (isFirstPrintedLine) isFirstPrintedLine = false;
    else if (line.item.kind == 'indented') str += '\n    ';
    else if (line.item.continuationOfPreviousLine == false) str += ' ';
    else if (line.item.continuationOfPreviousLine == 'keep hyphen') str += '-';

    if (line.item.kind == 'big letter') {
      // Join together the big letter and the next item even though they're separate blocks
      str += line.item.contents[0].str;
      str += line.item.contents
        .slice(1)
        .map((item) => item.str)
        .reduce((p, n) => `${p} ${n}`);
    } else if (line.item.kind == 'footnote') {
      str += `\n${line.item.symbol}: ${line.item.note}`;
    } else {
      str += line.item.contents.map((item) => item.str).reduce((p, n) => `${p} ${n}`);
    }
  });

  console.log(str);

  return str;
}

function makeBody(source: MarkedLine & { pageIndex: number }, italicFontName: string): ParagraphBody {
  const body: ParagraphBody = [];

  for (let i = 0; i < source.contents.length; i++) {
    const currentItem = source.contents[i];
    const lastItemAppended = body.at(body.length - 1);

    const currentStyle = { italicized: currentItem.fontName == italicFontName };
    const currentIsFootnoteReference = isFootnoteSymbol(currentItem.str);

    if (
      lastItemAppended == undefined ||
      (lastItemAppended?.kind == 'text' && lastItemAppended.style.italicized != currentStyle.italicized)
    ) {
      body.push({
        kind: 'text',
        text: currentItem.str,
        continuationOfPreviousItem: source.continuationOfPreviousLine,
        style: currentStyle,
      });
    } else if (lastItemAppended.kind == 'text' && !currentIsFootnoteReference) {
      body[body.length - 1] = { ...lastItemAppended, text: lastItemAppended.text + ' ' + currentItem.str };
    } else if (currentIsFootnoteReference) {
      body.push({ kind: 'footnote reference', symbol: currentItem.str, pageOfReferencedFootnote: source.pageIndex });
    }
  }

  return body;
}

function processParagraph(linesOfParagraph: BlockOf<MarkedLine>[], italicFontName: string): Parsed | undefined {
  if (linesOfParagraph.length == 1) {
    const item = linesOfParagraph[0].item;
    const { pageIndex } = linesOfParagraph[0];

    switch (item.kind) {
      case 'chapter':
        return { kind: 'chapter', text: `Chapter ${item.chapter}` };
      case 'big letter':
        return {
          kind: 'paragraph',
          bigLetter: item.contents[0].str,
          body: makeBody({ ...item, contents: item.contents.slice(1), pageIndex }, italicFontName),
        };
      case 'footnote':
        return { kind: 'footnote', symbol: item.symbol, text: item.note, pageIndex };
      case 'indented':
        return { kind: 'paragraph', body: makeBody({ ...item, pageIndex }, italicFontName) };
      case 'page number':
      case 'title':
      case 'normal':
        console.error(`ERROR: unsupported kind ${item.kind} in singlet paragraph`);
        return undefined;
    }
  }

  let parsedParagraph: Paragraph;

  // Take care of the first line separately since it's the only one that might be a big letter
  const firstLine = linesOfParagraph[0].item;
  if (firstLine.kind == 'big letter') {
    const [firstItem, ...rest] = firstLine.contents;
    const { pageIndex } = linesOfParagraph[0];

    parsedParagraph = {
      kind: 'paragraph',
      bigLetter: firstItem.str,
      body: makeBody({ ...firstLine, pageIndex, contents: rest }, italicFontName),
    };
  } else if (firstLine.kind == 'indented') {
    const { pageIndex } = linesOfParagraph[0];

    parsedParagraph = { kind: 'paragraph', body: makeBody({ ...firstLine, pageIndex }, italicFontName) };
  } else {
    console.error(`ERROR: unsupported kind ${firstLine.kind} in start of paragraph`);
    return undefined;
  }

  for (let i = 1; i < linesOfParagraph.length; i++) {
    const line = linesOfParagraph[i];
    const { pageIndex } = linesOfParagraph[i];

    if (line.item.kind == 'normal') {
      parsedParagraph.body = parsedParagraph.body.concat(makeBody({ ...line.item, pageIndex }, italicFontName));
    } else {
      console.error(`ERROR: unsupported kind ${line.item.kind} in non-start of paragraph`);
      return undefined;
    }
  }

  return mergeTextItems(parsedParagraph);
}

function mergeTextItems(paragraph: Paragraph): Paragraph {
  const body: ParagraphBody = [];

  for (let i = 0; i < paragraph.body.length; i++) {
    const curr: ParagraphBodyItem = paragraph.body[i];
    const prev: ParagraphBodyItem | undefined = body.at(body.length - 1);

    if (!prev || prev.kind != 'text' || curr.kind != 'text' || prev.style.italicized != curr.style.italicized) {
      body.push(curr);
    } else {
      body[body.length - 1] = { ...prev, text: mergeWords(prev, curr) };
    }
  }

  return {
    ...paragraph,
    body,
  };
}

function mergeWords(before: BodyText, after: BodyText): string {
  const continued = after.continuationOfPreviousItem;
  let deliminator;
  switch (continued) {
    case 'keep hyphen':
      deliminator = '-';
      break;
    case true:
      deliminator = '';
      break;
    case false:
      deliminator = ' ';
      break;
  }

  return `${before.text}${deliminator}${after.text}`;
}

// Returns an array of the lines that are graphically represented. The lines do not
// merge the words split across line breaks, and the lines do not contain empty TextItems.
function getGraphicalLines(document: BlockOf<TextItem>[]): BlockOf<MarkedLine>[] {
  const lines: BlockOf<MarkedLine>[] = [];
  let currentLine: BlockOf<MarkedLine> | undefined = undefined;

  for (let i = 0; i < document.length; i++) {
    const current = document[i];
    const next = document.at(i + 1);

    // Skip empty blocks always
    if (current.item.str.trim().length == 0) continue;

    if (currentLine == undefined) {
      currentLine = {
        ...current,
        item: { contents: [], kind: 'normal', continuationOfPreviousLine: false },
      };
    }

    currentLine.item.contents.push(current.item);

    // Big letters (The type that start a chapter) always begin a line, but have a lower y value than the line they begin
    const currentItemIsBigLetter = current.item.str.length == 1 && current.position.height > 20;

    // if this is the last line, or the next item is after a line/page break
    if (
      !currentItemIsBigLetter &&
      (next == undefined || next.position.y < current.position.y || next.pageIndex > current.pageIndex)
    ) {
      currentLine.item = markLine(currentLine.item);
      lines.push(currentLine);
      currentLine = undefined;
    }
  }

  return lines;
}

const titles = ['ALCOHOLICS ANONYMOUS', 'THERE IS A SOLUTION'];

// Marks lines that continue a word from
function markWordBreaks(lines: BlockOf<MarkedLine>[]) {
  // We manually manage the "last" element instead of using lines.at(i - 1) so we can skip the
  // title and page numbers while preserving the last body line
  let last: BlockOf<MarkedLine> | undefined = undefined;

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];

    // Skip title lines, etc.
    if (['title', 'chapter', 'page number'].includes(current.item.kind)) continue;

    // Skip the first body line
    if (!last) {
      last = current;
      continue;
    }

    const firstItemOfCurrent = current.item.contents[0];
    const lastItemOfLast = last.item.contents[last.item.contents.length - 1];

    // Find the candidates for a word broken across lines
    const firstWordInCurrentItem: string | undefined = firstItemOfCurrent.str.match(/^([\w\-]+)/)?.at(1);
    const firstWordInCurrentItemIsWord: boolean =
      firstWordInCurrentItem != undefined && englishWords.check(firstWordInCurrentItem);

    const lastWordInLastItem: string | undefined = lastItemOfLast.str.match(/\b(\w+)\W*$/)?.at(1);
    const lastWordInLastItemIsWord: boolean = lastWordInLastItem != undefined && englishWords.check(lastWordInLastItem);
    const hyphenBetween: boolean = last != undefined && /\b\w+-$/.test(lastItemOfLast.str);
    // Remove hyphen if it exists, we will replace it later
    if (hyphenBetween)
      last.item.contents[last.item.contents.length - 1].str = last.item.contents[
        last.item.contents.length - 1
      ].str.slice(0, -1);

    // If the last index of a space is -1, there is only one word, so the index is 0
    const wordSpanningAcrossLines: string | undefined =
      lastWordInLastItem && lastWordInLastItem + firstWordInCurrentItem;
    const wordSpanningAcrossLinesIsWord: boolean =
      wordSpanningAcrossLines != undefined && englishWords.check(wordSpanningAcrossLines.toLowerCase());

    const bothAreWords = lastWordInLastItemIsWord && firstWordInCurrentItemIsWord;

    const lineBrokeAHyphenatedWord = bothAreWords && hyphenBetween;
    const lineBrokeANonHyphenatedWord = /* !bothAreWords && */ wordSpanningAcrossLinesIsWord;
    // commented out because it caused trouble with 'We' ('W' and 'e' are words i guess???)

    if (lineBrokeANonHyphenatedWord) {
      lines[i].item.continuationOfPreviousLine = true;
    } else if (lineBrokeAHyphenatedWord) {
      lines[i].item.continuationOfPreviousLine = 'keep hyphen';
    } else {
      lines[i].item.continuationOfPreviousLine = false;
    }

    last = current;
  }
}

function isFootnoteSymbol(s: string) {
  const symbolList = ['*'];
  return symbolList.includes(s);
}

// Marks lines that contain or reference footnotes in place
function markFootnotes(lines: BlockOf<MarkedLine>[]) {
  // We keep the original indices so we can modify the array in place
  const linesMarkedWithIndices = lines.map((line, lineIndexOverall) => ({ lineIndexOverall, ...line }));

  const pages = Map.groupBy(linesMarkedWithIndices, (line) => line.pageIndex);
  pages.forEach((linesInPage) => {
    const footnoteSymbols = [];

    // Iterate backwards until we hit a line that doesn't start with a symbol
    for (let i = linesInPage.length - 1; i >= 0 && isFootnoteSymbol(linesInPage[i].item.contents[0].str); i--) {
      const symbol = linesInPage[i].item.contents[0].str;
      const indexOverall = linesInPage[i].lineIndexOverall;

      footnoteSymbols.push(symbol);
      // Mark the line as a footnote
      lines[indexOverall].item = {
        ...lines[indexOverall].item,
        kind: 'footnote',
        symbol,
        note: linesInPage[i].item.contents
          .slice(1)
          .map((item) => item.str)
          .join(' '),
      };
    }

    // Mark the references
    for (const symbol in footnoteSymbols) {
      const foundSymbols = linesInPage
        .flatMap(({ item, lineIndexOverall }) =>
          item.contents.map((textItem, indexInLine) => ({ lineIndexOverall, indexInLine, ...textItem })),
        )
        .filter(({ str }) => str == symbol);

      // Mark every reference to each footnote (could be > 1)
      for (let i = 0; i < foundSymbols.length; i++) {
        const symbol = foundSymbols[i];
        lines[symbol.lineIndexOverall].item.contents[symbol.indexInLine].symbol = symbol.str;
      }
    }
  });
}

// Marks lines that begin paragraphs in place
function markParagraphs(lines: BlockOf<MarkedLine>[]) {
  // We keep the original indices so we can modify the array in place
  const linesMarkedWithIndices = lines.map((line, lineIndexOverall) => ({ lineIndexOverall, ...line }));

  const pages = Map.groupBy(linesMarkedWithIndices, (line) => line.pageIndex);
  pages.forEach((pageLines) => {
    const linesMinusSkipped = pageLines.filter(({ item }) => item.kind == 'normal');

    // Coalesce lines on a page by the nearest quarter of an x value
    const linesGroupedByPosition = Map.groupBy(
      linesMinusSkipped.map(({ position, lineIndexOverall }) => ({
        x: Math.round(position.x * 4) / 4,
        lineIndexOverall,
      })),
      ({ x }) => x,
    );
    const linesSortedByAscendingXValue = Array.from(linesGroupedByPosition).sort((a, b) => a[0] - b[0]);
    const linesSortedByDescendingXFrequency = Array.from(linesGroupedByPosition).sort(
      (a, b) => b[1].length - a[1].length,
    );

    // sanity check
    if (linesSortedByAscendingXValue[0][0] != linesSortedByDescendingXFrequency[0][0]) {
      console.log('ERROR: The leftmost X value was not the most frequent');
      return [];
    }

    // skip the first entry with slice(1) because that's (likely) the baseline
    linesSortedByAscendingXValue.slice(1).forEach(([, linesOnPage]) =>
      linesOnPage.forEach(({ lineIndexOverall }) => {
        // There is often a "ghost indent" the line after a big letter, and big letters are never a singlet paragraph
        if (lines.at(lineIndexOverall - 1)?.item.kind != 'big letter') lines[lineIndexOverall].item.kind = 'indented';
      }),
    );
  });
}

// Marks big letters, titles, chapters, and page numbers, but not paragraphs or footnotes.
// Marks in place.
function markLines(lines: BlockOf<MarkedLine>[]) {
  for (let i = 0; i < lines.length; i++) lines[i].item = markLine(lines[i].item);
}

// Marks big letters, titles, chapters, and page numbers, but not paragraphs
function markLine(line: MarkedLine): MarkedLine {
  const firstItem = line.contents.at(0);
  const lineInPlainText = line.contents
    .map((item) => item.str)
    .reduce((p, n) => `${p} ${n}`)
    .trim();

  const titleMatches = lineInPlainText.match(/^[0-9]* *(?<title>(?:[A-Z]+ +)*[A-Z]+) *[0-9]*$/);
  const title = titleMatches?.groups?.title;

  const chapterMatches = lineInPlainText.match(/^Chapter +(?<chapter>[0-9]*)$/);
  const chapter = chapterMatches?.groups?.chapter;

  const pageNumberMatches = lineInPlainText.match(/^(?<page>[0-9]*)$/);
  const page = pageNumberMatches?.groups?.page;

  if (firstItem != undefined && firstItem.height > 20)
    return {
      ...line,
      kind: 'big letter',
    };
  if (title && titles.includes(title))
    return {
      ...line,
      kind: 'title',
      title,
    };
  if (chapter)
    return {
      ...line,
      kind: 'chapter',
      chapter: Number(chapter),
    };
  if (page)
    return {
      ...line,
      kind: 'page number',
      page: Number(page),
    };
  // TODO: Rest
  return line;
}

main();
