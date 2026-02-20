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
    (path) => GetTextFromPDF(path).then(convertFileToPlainText),
    'Converted to plain text',
  );

  console.log(plainText.join('\n\n'));
}

async function makeAllHTML(directory: string) {
  const html = await processDirectory(
    directory,
    async (path) => console.log(path), // todo
    'Converted to html',
  );
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

async function GetTextFromPDF(path: string): Promise<TextContent[]> {
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

function convertFileToPlainText(content: TextContent[]): string {
  let str = '';
  const textItems: BlockOf<TextItem>[] = content
    .map((c, pageIndex) =>
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
    )
    .flat(1);
  console.log(textItems.map(({ item }) => item.str).reduce((p, c) => p + ',' + c));

  // let currPage = 0;

  const lines = getGraphicalLines(textItems);

  markLines(lines);
  markParagraphs(lines);
  markWordBreaks(lines);
  markFootnotes(lines);

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

  // console.log(
  //   lines.map(({ item }) => ({
  //     str: item.contents.map(({ str }) => str).reduce((p, n) => `${p}|${n}`),
  //     kind: item.kind,
  //     continuation: item.continuationOfPreviousLine,
  //   })),
  // );
  console.log(str);

  return str;
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

// Marks lines that contain or reference footnotes in place
function markFootnotes(lines: BlockOf<MarkedLine>[]) {
  function isSymbol(s: string) {
    const symbolList = ['*'];
    return symbolList.includes(s);
  }

  // We keep the original indices so we can modify the array in place
  const linesMarkedWithIndices = lines.map((line, lineIndexOverall) => ({ lineIndexOverall, ...line }));

  const pages = Map.groupBy(linesMarkedWithIndices, (line) => line.pageIndex);
  pages.forEach((linesInPage) => {
    const footnoteSymbols = [];

    // Iterate backwards until we hit a line that doesn't start with a symbol
    for (let i = linesInPage.length - 1; i >= 0 && isSymbol(linesInPage[i].item.contents[0].str); i--) {
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
    const linesSortedByAcendingXValue = Array.from(linesGroupedByPosition).sort((a, b) => a[0] - b[0]);
    const linesSortedByDescendingXFrequency = Array.from(linesGroupedByPosition).sort(
      (a, b) => b[1].length - a[1].length,
    );

    // sanity check
    if (linesSortedByAcendingXValue[0][0] != linesSortedByDescendingXFrequency[0][0]) {
      console.log('ERROR: The lowest X value was not the most frequent');
      return [];
    }

    // skip the first entry with slice(1) because that's (likely) the baseline
    linesSortedByAcendingXValue.slice(1).forEach(([, linesOnPage]) =>
      linesOnPage.forEach(({ lineIndexOverall }) => {
        lines[lineIndexOverall].item.kind = 'indented';
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
