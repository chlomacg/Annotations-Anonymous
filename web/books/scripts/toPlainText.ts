import { readdir } from 'node:fs/promises';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import convert from 'convert';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';

import isWord from 'is-word';
const englishWords = isWord('american-english');

async function main() {
  const mode: string = process.argv[2];
  const dir = 'big-book-pdfs';

  switch (mode) {
    case 'plain-text':
      return makeAllPlainText(dir);
    case 'html':
      return makeAllHTML(dir);
    case 'debug-plaintext-no-print':
      if (process.argv.length < 4) {
        console.error('ERROR: Please pass the name of the file to debug with!');
        process.exit(1);
      }
      return debug(process.argv[3]);
    default:
      console.error(`invalid mode ${mode}`);
  }
}

async function makeAllPlainText(directory: string) {
  const plainText = await processDirectory(
    directory,
    (path) => getTextFromPDF(path).then((text) => convertToPlainText(text, path)),
    'Converted to plain text',
  );

  console.log(plainText.join('\n\n'));
}

async function makeAllHTML(directory: string) {
  const parsed: Parsed[] = await processDirectory(
    directory,
    async (path) => getTextFromPDF(path).then((text) => convertToHTML(text, path)),
    'Converted to html',
  ).then((arr) => arr.flat(1));

  console.dir(parsed, { depth: null });
}

async function debug(file: string) {
  const currentDir = import.meta.dirname;
  const parentDir = currentDir.slice(0, currentDir.lastIndexOf('/'));
  const fullPath = `${parentDir}/big-book-pdfs/${file}`;

  const out = await getTextFromPDF(fullPath).then((text) => convertToPlainText(text, fullPath));
  console.log(out);
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
  files.sort();

  const time1 = new Date();
  const out = await Promise.all(files.map((file) => process(`${dir}/${file}`)));
  const time2 = new Date();

  const elapsed2 = convert(time2.getTime() - time1.getTime(), 'ms').to('best');
  console.error(`${processName} in ${elapsed2.toString()}`);

  return out;
}

type BlockOf<T> = {
  item: T;
  file: string;
  position: Position;
  pageIndex: number;
  lineIndex: number;
};

// The origin is in the bottom-left of the page, so a lower y value means lower on the page.
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
  | LineKind.ListItem
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
function makeMarkedLines(content: TextContent[], path: string): BlockOf<MarkedLine>[] {
  const textItems: BlockOf<TextItem>[] = content.flatMap((c, pageIndex) =>
    c.items
      .filter((item) => 'str' in item)
      // .map((item) => ({ ...item, str: item.str.replaceAll('—', ' — ') }))
      .map((item, lineIndex) => ({ item, position: positionOf(item), file: path, pageIndex, lineIndex }))
      .sort((a, b) => {
        // there are many lines that are just barely different y values but on the same line, so
        // we use this heuristic.
        const closeEnough = Math.abs(a.position.y - b.position.y) < 0.5;
        // The origin is in the bottom-left of the page, so a lower y value means lower on the page.
        // We want to sort it top to bottom first.
        if (a.position.y < b.position.y) return 1;
        // but a lower x value means closer to the start of the line (left in English). Left-to-right second
        if (closeEnough) return a.position.x - b.position.x;
        // else y(a) > y(b)
        return -1;
      }),
  );

  const lines = getGraphicalLines(textItems);

  markLines(lines);
  markIndents(lines);
  markBrokenWords(lines);
  markFootnotes(lines);

  return lines;
}

import type { BodyText, Paragraph, ParagraphBody, ParagraphBodyItem, Parsed } from './lib/outputJSON.ts';
import { parseIntOrRomanOrSpelledNumber } from './lib/parseInt.ts';

function convertToHTML(content: TextContent[], path: string): Parsed[] {
  const lines = makeMarkedLines(content, path);

  const paragraphs: BlockOf<MarkedLine>[][] = [];
  // Non-paragraph elements that interrupt a paragraph go after it
  // (there's no reason to be tied down to the current layout!)
  let nonParagraphs: BlockOf<MarkedLine>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    switch (currentLine.item.kind) {
      case 'big letter':
        for (let i = 0; i < nonParagraphs.length; i++) paragraphs.push([nonParagraphs[i]]);
        nonParagraphs = [];
        paragraphs.push([currentLine]);
        break;
      case 'indented':
        const startOfLastParagraph = paragraphs.at(paragraphs.length - 1)?.at(0)?.item;
        const lastIndentLevel = startOfLastParagraph?.kind == 'indented' && startOfLastParagraph.indentLevel;
        const currentIndentLevel = currentLine.item.indentLevel;

        if (lastIndentLevel == currentIndentLevel) {
          paragraphs[paragraphs.length - 1].push(currentLine);
        } else {
          for (let i = 0; i < nonParagraphs.length; i++) paragraphs.push([nonParagraphs[i]]);
          paragraphs.push([currentLine]);
        }

        break;

      case 'normal':
        if (paragraphs.length == 0) {
          console.error("Warning: trying to push to a paragraph, but one hasn't been started.");
          console.error(currentLine.item.contents.map((item) => item.str));
        }
        paragraphs.at(-1)?.push(currentLine);
        break;
      case 'chapter':
      case 'footnote':
        nonParagraphs.push(currentLine);
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

function convertToPlainText(content: TextContent[], path: string): string {
  let str = '';
  const lines = makeMarkedLines(content, path);

  let isFirstPrintedLine = true;

  lines.forEach((line) => {
    // we dont like these guys very much.
    if (['title', 'chapter', 'page number'].includes(line.item.kind)) return;

    const indented = line.item.kind == 'indented';
    const continuation = line.item.continuationOfPreviousLine;
    const [_, firstWord, afterFirstWord] = line.item.contents[0].str.match(/^([\w\p{P}]+) *(.*)/u) ?? [
      null,
      null,
      null,
    ];
    const lineBreak = indented ? '\n    ' : '\n';

    if (isFirstPrintedLine) {
      isFirstPrintedLine = false;
    } else if (firstWord != null && afterFirstWord != null) {
      switch (continuation) {
        case true:
          // remove hyphen, if present
          str = str.replace(/-$/, '');
          str += firstWord + lineBreak;
          line.item.contents[0].str = afterFirstWord;
          break;
        case 'keep hyphen':
          str += '-' + firstWord + lineBreak;
          line.item.contents[0].str = afterFirstWord;
          break;
        case false:
          str += lineBreak;
          break;
      }
    }

    if (line.item.contents.at(0)?.str.length == 0) line.item.contents = line.item.contents.slice(1);
    if (line.item.contents.length == 0) return;

    switch (line.item.kind) {
      case 'big letter':
        // Join together the big letter and the next item even though they're separate blocks
        str += line.item.contents[0].str;
        // if (line.item.contents.slice(1).length == 0) {
        //   console.error(`pg ${line.pageIndex} big letter ${line.item.contents[0].str}`);
        // }

        const afterBig = line.item.contents.slice(1).map((item) => item.str);
        if (afterBig.length > 0) str += afterBig.reduce((p, n) => `${p} ${n}`);
        break;

      case 'list item':
        const [_, listNumber] = line.item.number;

        const listNumberStr = '' + listNumber;

        str += ' '.repeat(5 - listNumberStr.length) + listNumberStr + '. ';
        str += line.item.restOfLine;
        break;

      case 'footnote':
        str += `\n\n${line.item.symbol}: ${line.item.note}`;
        break;

      case 'indented':
      case 'title':
      case 'normal':
        str += line.item.contents.map((item) => item.str).reduce((p, n) => `${p} ${n}`);
        break;
    }
  });

  return fixSpacingInFlattenedString(str);
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
    const { pageIndex, item } = linesOfParagraph[0];

    switch (item.kind) {
      case 'chapter':
        return { kind: 'chapter', text: `Chapter ${item.chapter}` };
      case 'big letter':
        return {
          kind: 'paragraph',
          bigLetter: item.contents[0].str,
          indentLevel: 0,
          body: makeBody({ ...item, contents: item.contents.slice(1), pageIndex }, italicFontName),
        };
      case 'footnote':
        return { kind: 'footnote', symbol: item.symbol, text: item.note, pageIndex };
      case 'indented':
        return {
          kind: 'paragraph',
          indentLevel: item.indentLevel,
          body: makeBody({ ...item, pageIndex }, italicFontName),
        };
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
      indentLevel: 0,
      body: makeBody({ ...firstLine, pageIndex, contents: rest }, italicFontName),
    };
  } else if (firstLine.kind == 'indented') {
    const { pageIndex } = linesOfParagraph[0];
    const { indentLevel } = firstLine;

    parsedParagraph = { kind: 'paragraph', indentLevel, body: makeBody({ ...firstLine, pageIndex }, italicFontName) };
  } else {
    console.error(`ERROR: unsupported kind ${firstLine.kind} in start of paragraph`);
    return undefined;
  }

  for (let i = 1; i < linesOfParagraph.length; i++) {
    const line = linesOfParagraph[i];
    const { pageIndex } = linesOfParagraph[i];

    if (line.item.kind == 'normal' || line.item.kind == 'indented') {
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

    const currentBaseline = current.position.y + current.position.height;
    const nextBaseline = next && next.position.y + next.position.height;

    // if this is the last line, the end of a line, or the next item is after a line/page break
    if (
      !currentItemIsBigLetter &&
      // @ts-expect-error  nextBaseline cannot be undefined, we checked if next is undefined, tsc just doesn't see the correlation
      (next == undefined || Math.abs(currentBaseline - nextBaseline) > 1 || next.pageIndex > current.pageIndex)
    ) {
      lines.push(currentLine);
      currentLine = undefined;
    }
  }

  return lines;
}

const titles = [
  'Alcoholics Anonymous',
  'Title Page',
  'Copyright Information',
  'Preface',
  'Foreword to First Edition',
  'Foreword to Second Edition',
  'Foreword to Third Edition',
  'Foreword to Fourth Edition',
  'The Doctors Opinion',
  'Bill’s Story',
  'There is a Solution',
  'More About Alcoholism',
  'We Agnostics',
  'How It Works',
  'Into Action',
  'Working With Others',
  'To Wives',
  'The Family Afterward',
  'To Employers',
  'A Vision For You',
  'Personal Stories',
  'How Forty-Two Alcoholics Recovered From Their Malady',

  'PART I',
  'PIONEERS OF AA',
  'ALCOHOLIC ANONYMOUS',
  'NUMBER THREE',
  'ALCOHOLIC ANONYMOUS NUMBER THREE',
  'GRATITUDE IN ACTION',
  'WOMEN SUFFER TOO',
  'OUR SOUTHERN FRIEND',
  'THE VICIOUS CYCLE',
  'THE MAN WHO MASTERED FEAR',
  'HE SOLD HIMSELF SHORT',
  'THE KEYS OF THE KINGDOM',

  'PART II',
  'THEY STOPPED IN TIME',
  'THE MISSING LINK',
  'FEAR OF FEAR',
  'THE HOUSEWIFE WHO DRANK',
  'AT HOME',
  'THE HOUSEWIFE WHO DRANK AT HOME',
  'MY CHANCE TO LIVE',
  'STUDENT OF LIFE',
  'CROSSING THE RIVER OF DENIAL',
  'IT MIGHT HAVE BEEN WORSE',
  'TIGHTROPE',
  'FLOODED WITH FEELING',
  'WINNER TAKES ALL',
  'THE PERPETUAL QUEST',
  'ACCEPTANCE WAS THE ANSWER',
  'WINDOW OF OPPORTUNITY',

  'PART III',
  'THEY LOST NEARLY ALL',
  'AND ME',
  'HE LIVED ONLY TO DRINK',
  'SAFE HAVEN',
  'LISTENING TO THE WIND',
  'TWICE GIFTED',
  'BUILDING A NEW LIFE',
  'ON THE MOVE',
  'A VISION OF RECOVERY',
  'GUTTER BRAVADO',
  'EMPTY ON THE INSIDE',
  'GROUNDED',
  'ANOTHER CHANCE',
  'A LATE START',
  'LATE START',
  'FREEDOM FROM BONDAGE',
  'AA TAUGHT HIM TO HANDLE',
  'SOBRIETY',
  'TO HANDLE SOBRIETY',

  'The A.A. Tradition',
  'Spiritual Experience',
  'The Medical View On A.A.',
  'The Lasker Award',
  'The Religious View on A.A.',
  'How to Get in Touch With A.A.',
  'Twelve Concepts (Short Form)',
].map((x) => x.toUpperCase());

// Marks lines that continue a word from
function markBrokenWords(lines: BlockOf<MarkedLine>[]) {
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
    const firstWordInCurrentItem: string | undefined = firstItemOfCurrent.str.match(/^([\w\-’]+)/u)?.at(1);
    const firstWordInCurrentItemIsWord: boolean =
      firstWordInCurrentItem != undefined && englishWords.check(firstWordInCurrentItem);

    const lastWordInLastItem: string | undefined = lastItemOfLast.str.match(/\b([\w’]+)[^\w’]*$/)?.at(1);
    const lastWordInLastItemIsWord: boolean = lastWordInLastItem != undefined && englishWords.check(lastWordInLastItem);
    const hyphenBetween: boolean = last != undefined && /-$/.test(lastItemOfLast.str);
    // Remove hyphen if it exists, we will replace it later
    if (hyphenBetween)
      last.item.contents[last.item.contents.length - 1].str = last.item.contents[
        last.item.contents.length - 1
      ].str.slice(0, -1);

    const wordSpanningAcrossLines: string | undefined =
      lastWordInLastItem && lastWordInLastItem + firstWordInCurrentItem;
    const wordSpanningAcrossLinesIsWord: boolean =
      wordSpanningAcrossLines != undefined && englishWords.check(wordSpanningAcrossLines.toLowerCase());

    const wordSpanningAcrossLinesWithApostrophe: string | undefined =
      lastWordInLastItem && (lastWordInLastItem + firstWordInCurrentItem).replace('’', "'");
    const wordSpanningAcrossLinesWithApostropheIsWord: boolean =
      wordSpanningAcrossLinesWithApostrophe != undefined &&
      englishWords.check(wordSpanningAcrossLinesWithApostrophe.toLowerCase());

    const bothAreWords = lastWordInLastItemIsWord && firstWordInCurrentItemIsWord;

    const lineBrokeAHyphenatedWord = bothAreWords && hyphenBetween;
    const lineBrokeANonHyphenatedWord =
      /* !bothAreWords && */ wordSpanningAcrossLinesIsWord || wordSpanningAcrossLinesWithApostropheIsWord;
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
  return symbolList.find((symbol) => s.at(0) == symbol) !== undefined;
}

// Marks lines that contain or reference footnotes in place
function markFootnotes(lines: BlockOf<MarkedLine>[]) {
  // We keep the original indices so we can modify the array in place
  const linesMarkedWithIndices = lines.map((line, lineIndexOverall) => ({ lineIndexOverall, ...line }));

  const pages = Map.groupBy(linesMarkedWithIndices, (line) => line.pageIndex);
  pages.forEach((linesInPage) => {
    const footnoteSymbols = [];

    for (let i = linesInPage.length - 1; i >= 0; i--) {
      if (linesInPage[i].item.kind == 'page number') continue;

      if (!isFootnoteSymbol(linesInPage[i].item.contents[0].str)) continue;

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

// Marks indented lines in place
function markIndents(lines: BlockOf<MarkedLine>[]) {
  // We keep the original indices so we can modify the array in place
  const linesMarkedWithIndices = lines.map((line, lineIndexOverall) => ({ lineIndexOverall, ...line }));

  const pages = Map.groupBy(linesMarkedWithIndices, (line) => line.pageIndex);
  pages.forEach((pageLines) => {
    const linesMinusSkipped = pageLines.filter(({ item }) => item.kind == 'normal');
    if (linesMinusSkipped.length == 0) return;

    // Coalesce lines on a page by the nearest quarter of an x value
    const linesGroupedByPosition = Map.groupBy(
      linesMinusSkipped.map(({ position, lineIndexOverall }, indexOnPage) => ({
        x: Math.round(position.x * 4) / 4,
        lineIndexOverall,
        indexOnPage,
      })),
      ({ x }) => x,
    );

    const linesSortedByAscendingXValue = Array.from(linesGroupedByPosition).sort((a, b) => a[0] - b[0]);
    const baselineXValue = linesSortedByAscendingXValue[0][0];

    // skip the first entry with slice(1) because that's (likely) the baseline
    linesSortedByAscendingXValue.slice(1).forEach(([xValue, linesOnPage]) =>
      linesOnPage.forEach(({ lineIndexOverall }) => {
        // There is often a "ghost indent" the line after a big letter, and big letters are never a singlet paragraph
        if (lines.at(lineIndexOverall - 1)?.item.kind != 'big letter')
          lines[lineIndexOverall].item = {
            ...lines[lineIndexOverall].item,
            kind: 'indented',
            indentLevel: (xValue - baselineXValue) / 12,
          };
      }),
    );
  });
}

// Marks big letters, titles, chapters, and page numbers, but not paragraphs or footnotes.
// Marks in place.
function markLines(lines: BlockOf<MarkedLine>[]) {
  let context: MarkingContext = {
    mostRecentListNumbers: [],
    mostRecentListId: 0,
  };

  for (let i = 0; i < lines.length; i++) {
    const [marked, newContext] = markLine(lines[i].item, context);

    lines[i].item = marked;
    context = newContext;
  }
}

type MarkingContext = {
  mostRecentListNumbers: number[];
  mostRecentListId: number;
};

// Marks big letters, titles, chapters, and page numbers, but not paragraphs
function markLine(line: MarkedLine, context: MarkingContext): [MarkedLine, MarkingContext] {
  const firstItem = line.contents.at(0);
  const lineInPlainText = line.contents
    .map((item) => item.str)
    .reduce((p, n) => `${p} ${n}`)
    .trim();

  const titleMatches = lineInPlainText.match(/^[0-9]* *(?<title>(?:[A-Za-z’]+ +)*[A-Za-z’]+) *[0-9]*$/);
  const title = titleMatches?.groups?.title;

  const chapterMatches = lineInPlainText.match(/^Chapter +(?<chapter>[0-9]*)$/);
  const chapter = chapterMatches?.groups?.chapter;

  const pageNumberMatches = lineInPlainText.match(/^(?<page>[ivx0-9]*)$/);
  const page = pageNumberMatches?.groups?.page;

  const listMatches = lineInPlainText.match(
    /^(?<listNumber>(?:^[ivxlc0-9]+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b)[).—]+ *(?<afterListNumber>.*)$/iu,
  );
  const listNumberStr = listMatches?.groups?.listNumber;
  const listNumber = parseIntOrRomanOrSpelledNumber(listNumberStr);
  const restOfLine = listMatches?.groups?.afterListNumber;

  const lastListNumber = context.mostRecentListNumbers.at(-1);
  const lastListId = context.mostRecentListId;
  let listId: number | undefined = undefined;

  if (listNumber != undefined && page == undefined) {
    if (lastListNumber == undefined || lastListNumber < listNumber) {
      listId = context.mostRecentListId;
      context.mostRecentListNumbers.push(listNumber);
    } else {
      listId = lastListId + 1;
      context = { mostRecentListNumbers: [listNumber], mostRecentListId: listId };
    }
  }

  let output: MarkedLine | null = null;

  if (firstItem != undefined && firstItem.height > 20)
    output = {
      ...line,
      kind: 'big letter',
    };
  else if (title && titles.includes(title.toUpperCase()))
    output = {
      ...line,
      kind: 'title',
      title,
    };
  else if (chapter)
    output = {
      ...line,
      kind: 'chapter',
      chapter: Number(chapter),
    };
  else if (page)
    output = {
      ...line,
      kind: 'page number',
      page: Number(page),
    };
  else if (listNumber !== undefined && listNumberStr !== undefined && restOfLine !== undefined && listId !== undefined)
    output = {
      ...line,
      kind: 'list item',
      number: [listNumberStr, listNumber],
      listId,
      restOfLine,
    };
  else
    // TODO: Rest
    output = line;

  return [output, context];
}

function fixSpacingInFlattenedString(toFix: string): string {
  const rightSpacePunctuation = '*)”’;:';
  const leftSpacePunctuation = '“‘(';
  const bothSpacePunctuation = '—';
  const noSpacePunctuation = `'-`;

  const allPunctuation = bothSpacePunctuation + rightSpacePunctuation + leftSpacePunctuation + noSpacePunctuation;

  // why did they do this
  toFix = toFix.replaceAll(/’’/g, '”');

  // I do not care for the dots personally. style choice
  toFix = toFix.replaceAll(/A\. *A\./g, 'AA');

  // periods are handled separately because of acronyms and ellipses
  toFix = toFix.replaceAll(/ *([^A-Z .]) *(\.) *(\p{P}?) *(\p{P}?) */gu, '$1$2$3$4 ');

  // commas are handled separately because of comma-delimited numbers
  // not comma-separated numbers:
  toFix = toFix.replaceAll(
    / *(?:(?<first>[^0-9 ]) *, *(?<second>[^0-9 ]))|(?:(?<first>[0-9]) *, *(?<second>[^0-9 ]))|(?:(?<first>[^0-9 ]) *, *(?<second>[0-9])) */g,
    '$<first>, $<second>',
  );
  // TODO: there is a bug for any two numbers that are listed with a comma between them, like a date.
  //    See the output for the footnote on the last page of Bill's story.
  //
  //    Really this is a sign that the way I'm doing this sucks, we have x positions and can and should
  //    use them to determine spacing choices instead of doing this hacky bullshit
  //
  // comma-separated numbers:
  toFix = toFix.replaceAll(/ *(?<first>[0-9]) *, *(?<second>[0-9]) */g, '$<first>,$<second>');

  for (const punct of allPunctuation) {
    const leftPad = (leftSpacePunctuation + bothSpacePunctuation).includes(punct) ? ' ' : '';
    const rightPad = (rightSpacePunctuation + bothSpacePunctuation).includes(punct) ? ' ' : '';

    const escape = '(*)'.includes(punct) ? '\\' : '';

    // const regex = new RegExp(` *\\${punct} *(\\p{P}*) *`, 'gu');
    const regex = new RegExp(` *${escape}${punct} *(?<morePunct>\\p{P}*) *`, 'gu');

    toFix = toFix.replaceAll(regex, leftPad + punct + '$<morePunct>' + rightPad);
  }

  const spaceThenPunctStartingLine = new RegExp(`^ ([${allPunctuation}])`, 'gum');
  toFix = toFix.replaceAll(spaceThenPunctStartingLine, '$1');
  const punctThenSpaceEndingLine = new RegExp(`([${allPunctuation},.]) $`, 'gum');
  toFix = toFix.replaceAll(punctThenSpaceEndingLine, '$1');

  // right single quotes are handled again because they might be an apostrophe in the middle of a word. STUPID
  toFix = toFix.replaceAll(/(\w+)’ (\w+)/gu, (match, firstWord, secondWord) => {
    // const firstWord = match.groups?.firstWord;
    // const secondWord = match.groups?.secondWord;
    if (typeof firstWord !== 'string' || typeof secondWord !== 'string') {
      console.error('Dafuq');
      return match;
    }

    const isPossessive = englishWords.check(firstWord.toLowerCase()) && secondWord.toLowerCase() == 's';
    const isContraction =
      englishWords.check(`${firstWord.toLowerCase()}'${secondWord.toLowerCase()}`) ||
      englishWords.check(`${firstWord}'${secondWord.toLowerCase()}`);

    if (isPossessive || isContraction) {
      return `${firstWord}'${secondWord}`;
    } else {
      return `${firstWord}’ ${secondWord}`;
    }
  });

  return toFix;
}

main();
