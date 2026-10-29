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
  contents: TextItem[];
  continuationOfPreviousLine: boolean | 'keep hyphen';
} & LineType;

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

  markBrokenWords(lines);
  markLines(lines);
  markIndents(lines);
  markFootnotes(lines);

  return lines;
}

import {
  plainStyle,
  type Footnote,
  type ParagraphBody,
  type ParagraphBodyItem,
  type Parsed,
} from './lib/parsedText.ts';
import { parseIntOrRomanOrSpelledNumber } from './lib/parseInt.ts';

function convertToHTML(content: TextContent[], path: string): Parsed[] {
  return []; // TODO: rewrite
}

function convertToPlainText(content: TextContent[], path: string): string {
  const lines = makeMarkedLines(content, path);

  const parsed = parseMarkedLines(lines);

  return parsed
    .map((p) => {
      switch (p.kind) {
        case 'chapter':
          return '\n\n\n' + p.text;
        case 'title':
          return '\n\n' + p.text + '\n\n';
        case 'footnote':
          return (
            `\n\n\n${p.symbol}: ` +
            p.body
              .map((ps) => {
                switch (ps.kind) {
                  case 'text':
                    return ps.text;
                  case 'footnote reference':
                    return ps.symbol;
                }
              })
              .join(' ') +
            '\n\n\n\n'
          );
        case 'paragraph':
          const bigLetter = p.bigLetter ?? '';
          const body = p.body
            .map((ps) => {
              switch (ps.kind) {
                case 'text':
                  return ps.text;
                case 'footnote reference':
                  return ps.symbol;
              }
            })
            .join(' ');
          const [, firstWord] = body.match(/^([\w\p{P}]+) /u) ?? [, ''];
          const firstTotal = bigLetter + firstWord;
          const space =
            !bigLetter || !firstWord || englishWords.check(firstTotal.toLowerCase()) || englishWords.check(firstTotal)
              ? ''
              : ' ';

          return '\t' + bigLetter + space + body;
        case 'list':
          return p.items
            .map(
              (item, i) =>
                `${i + 1}. ` +
                item
                  .map((ps) => {
                    switch (ps.kind) {
                      case 'text':
                        return ps.text;
                      case 'footnote reference':
                        return ps.symbol;
                    }
                  })
                  .join(' '),
            )
            .join(' ');
      }
    })
    .join('\n');
}

// lets not print the title of the book randomly
// 'To wives' in the title has an asterisk, so print that one but not the subsequent page headers
const printedTitles: string[] = ['ALCOHOLICS ANONYMOUS', 'TO WIVES'];

function parseMarkedLines(lines: BlockOf<MarkedLine>[]): Parsed[] {
  const fontNames = Map.groupBy(
    lines.flatMap(({ item }) => item.contents.map(({ str, fontName }) => ({ str, fontName }))),
    ({ fontName }) => fontName,
  );

  let italicFontName: string | undefined;
  fontNames.forEach(([{ str, fontName }]) => {
    if (str.startsWith('Chapter')) italicFontName = fontName;
  });

  type Context = {
    lineLastSeen?: BlockOf<MarkedLine>;
    blockCurrentlyIn?: Exclude<Parsed, Footnote>; // Usually gonna be a paragraph, could be a list
    footnoteCurrentlyIn?: Footnote; // footnotes often interrupt paragraphs
  };
  const context: Context = {};

  const parsed: Parsed[] = [];

  lines.forEach((line) => {
    // we dont like these guys very much.
    if (['page number'].includes(line.item.kind)) return;

    while (line.item.contents.at(0)?.str.length == 0) line.item.contents = line.item.contents.slice(1);
    if (line.item.contents.length == 0) return;

    const currentKind = context.blockCurrentlyIn?.kind;

    const pushLastBlock: boolean =
      ['big letter', 'indented', 'chapter'].includes(line.item.kind) ||
      (line.item.kind === 'list item' && currentKind !== 'list') ||
      (currentKind === 'list' && line.item.kind !== 'list item' && line.item.kind !== 'normal') ||
      (line.item.kind === 'normal' &&
        currentKind !== 'paragraph' &&
        currentKind !== 'list' &&
        !context.footnoteCurrentlyIn);

    if (pushLastBlock && context.blockCurrentlyIn !== undefined) {
      parsed.push(context.blockCurrentlyIn);
      if (context.footnoteCurrentlyIn && context.footnoteCurrentlyIn.pageIndex !== line.pageIndex) {
        parsed.push(context.footnoteCurrentlyIn);
        context.footnoteCurrentlyIn = undefined;
      }
    }

    switch (line.item.kind) {
      case 'big letter':
        const afterBig = line.item.contents.slice(1);
        const body = flattenLine(afterBig, line.pageIndex, italicFontName!);
        // TODO: add indent level detection
        context.blockCurrentlyIn = {
          kind: 'paragraph',
          bigLetter: line.item.contents[0].str,
          indentLevel: 1,
          body,
        };

        break;

      case 'list item':
        if (context.blockCurrentlyIn?.kind !== 'list') context.blockCurrentlyIn = { kind: 'list', items: [] };

        if (line.item.continuationOfPreviousLine && context.blockCurrentlyIn.items.length > 0) {
          const lastItem = context.blockCurrentlyIn.items.pop()!;
          const lastInLastItem = lastItem.pop()!;

          lastItem.push(...joinLines(lastInLastItem, line, italicFontName!));
          context.blockCurrentlyIn.items.push(lastItem);
        } else if (line.item.continuationOfPreviousLine && context.blockCurrentlyIn.items.length == 0) {
          console.error(
            `WARNING: Context empty in file ${line.file}, page ${line.pageIndex} but the following line is continuing a previous line:`,
          );
          console.error(
            `${flattenLine(line.item.contents, line.pageIndex, italicFontName!).map((v) => (v.kind == 'text' ? v.text : v.symbol))}`,
          );
          console.error('Skipping this line during parsing.');
        } else {
          context.blockCurrentlyIn.items.push([
            {
              kind: 'text',
              text: line.item.restOfLine,
              style: { italicized: false },
            },
          ]);
        }
        break;

      // If a footnote interrupts a paragraph, it cuts it off curently, TODO: fix
      case 'footnote':
        context.footnoteCurrentlyIn = {
          kind: 'footnote',
          symbol: line.item.symbol,
          pageIndex: line.pageIndex,
          body: flattenLine(line.item.contents.slice(1), line.pageIndex, italicFontName!),
        };
        break;
      case 'chapter':
        parsed.push({ kind: 'chapter', text: `Chapter ${line.item.chapter}` });
        break;
      case 'title':
        const currentTitle = line.item.contents.map(({ str }) => str).reduce((p, n) => `${p} ${n}`);
        const alreadyPrinted = printedTitles.includes(currentTitle);
        if (!alreadyPrinted) {
          parsed.push({
            kind: 'title',
            text: normalizeText(currentTitle),
          });
          printedTitles.push(currentTitle);
        }
        break;

      case 'indented':
        context.blockCurrentlyIn = {
          kind: 'paragraph',
          indentLevel: 1,
          body: [...flattenLine(line.item.contents, line.pageIndex, italicFontName!)],
        };
        break;
      case 'normal':
        const currBlock = context.blockCurrentlyIn;
        const currFootnote = context.footnoteCurrentlyIn;

        if (currFootnote !== undefined && currFootnote.pageIndex == line.pageIndex) {
          const lastItem = currFootnote.body.pop()!;

          currFootnote.body.push(...joinLines(lastItem, line, italicFontName!));
        } else if (currBlock?.kind == 'paragraph') {
          if (currBlock.body.at(-1)?.kind == 'text') {
            const lastItem = currBlock.body.pop()!;

            currBlock.body.push(...joinLines(lastItem, line, italicFontName!));
          } else {
            currBlock.body.push(...flattenLine(line.item.contents, line.pageIndex, italicFontName!));
          }
        } else if (currBlock?.kind == 'list' && currBlock.items.at(-1)?.at(-1)?.kind == 'text') {
          const lastItemofLastItem = currBlock.items.at(-1)!.pop()!;

          currBlock.items.at(-1)!.push(...joinLines(lastItemofLastItem, line, italicFontName!));
        } else {
          console.error(
            `ERROR during parsing: blockKind = ${context.blockCurrentlyIn?.kind}, line: ${JSON.stringify(line, null, 2)}`,
          );
        }
        break;
    }
    context.lineLastSeen = line;
  });

  if (context.blockCurrentlyIn) parsed.push(context.blockCurrentlyIn);
  if (context.footnoteCurrentlyIn) parsed.push(context.footnoteCurrentlyIn);

  return parsed;
}

function joinLines(
  lastItem: ParagraphBodyItem,
  nextLine: BlockOf<MarkedLine>,
  italicFontName: string,
): ParagraphBodyItem[] {
  const nextFlattened = flattenLine(nextLine.item.contents, nextLine.pageIndex, italicFontName!);
  const firstOfNextItalicized = nextFlattened[0].kind == 'text' && nextFlattened[0].style.italicized;

  if (lastItem.kind !== 'text' || lastItem.style.italicized !== firstOfNextItalicized)
    return [lastItem, ...nextFlattened];

  let { text } = lastItem;

  const indented = nextLine.item.kind == 'indented';
  if (indented) console.error('WARNING: Joining a line with a line that begins a new paragraph?');
  const continuation = nextLine.item.continuationOfPreviousLine;

  const firstElement = nextFlattened.at(0);
  const afterFirstElement = nextFlattened.slice(1);

  const [, firstWord, afterFirstWord] = firstElement?.['text' as keyof ParagraphBodyItem].match(
    /^([\w\p{P}]+) *(.*)/u,
  ) ?? ['', '', ''];

  switch (continuation) {
    case true:
      // remove hyphen, if present
      text = text.replace(/-$/, '');
      break;
    case 'keep hyphen':
      text += '-';
      break;
    case false:
      if (text.length > 0) text += ' ';
      break;
  }

  const space = firstWord && afterFirstWord ? ' ' : '';
  text += firstWord + space + afterFirstWord;

  const style = { italicized: firstOfNextItalicized };
  return [{ kind: 'text', text, style }, ...afterFirstElement];
}

function flattenLine(line: TextItem[], pageNumber: number, italicFontName: string): ParagraphBody {
  let last: TextItem | undefined = undefined;
  const flattened: ParagraphBodyItem[] = [];
  for (let i = 0; i < line.length; i++) {
    const { x } = positionOf(line[i]);
    const lastPosition = last && positionOf(last);

    const spaceBeforeCurrent = lastPosition ? x - lastPosition.x - lastPosition.width : 0;

    const spaceToAdd = spaceBeforeCurrent > 2 ? ' ' : '';

    if (isFootnoteSymbol(line[i].str)) {
      flattened.push({ kind: 'footnote reference', symbol: line[i].str, pageOfReferencedFootnote: pageNumber });
    } else {
      const lastFlattened = flattened.at(-1);
      const addLastStr = lastFlattened !== undefined && lastFlattened.kind === 'text';

      if (addLastStr) flattened.pop();
      const merged = addLastStr ? lastFlattened.text + spaceToAdd + line[i].str : line[i].str;

      // emdashes are often in the middle of TextItems, so we do this hacky nonsense
      const text = normalizeText(merged);

      const style = line[i].fontName == italicFontName ? { italicized: true } : plainStyle;

      flattened.push({
        kind: 'text',
        text,
        style,
      });
    }

    last = line[i];
  }

  return flattened;
}

const footnoteSymbols = ['*'];

function isFootnoteSymbol(s: string): boolean {
  return footnoteSymbols.includes(s);
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
  'DOCTOR BOB’S NIGHTMARE',
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

// Marks lines that continue a word from a previous line
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

    const wordsNotInDictionary = ['Plattsburg'];

    const wordSpanningAcrossLines: string | undefined =
      lastWordInLastItem && lastWordInLastItem + firstWordInCurrentItem;
    const wordSpanningAcrossLinesIsWord: boolean =
      wordSpanningAcrossLines != undefined &&
      (wordsNotInDictionary.includes(wordSpanningAcrossLines) ||
        englishWords.check(wordSpanningAcrossLines) ||
        englishWords.check(wordSpanningAcrossLines.toLowerCase()));

    const wordSpanningAcrossLinesWithApostrophe: string | undefined =
      lastWordInLastItem && (lastWordInLastItem + firstWordInCurrentItem).replace('’', "'");
    const wordSpanningAcrossLinesWithoutPossessive: string | undefined =
      wordSpanningAcrossLinesWithApostrophe?.endsWith("'s")
        ? wordSpanningAcrossLinesWithApostrophe.slice(0, -2)
        : undefined;
    const wordSpanningAcrossLinesWithApostropheIsWord: boolean =
      (wordSpanningAcrossLinesWithApostrophe != undefined &&
        englishWords.check(wordSpanningAcrossLinesWithApostrophe.toLowerCase())) ||
      (wordSpanningAcrossLinesWithoutPossessive != undefined &&
        englishWords.check(wordSpanningAcrossLinesWithoutPossessive));

    const bothAreWords = lastWordInLastItemIsWord && firstWordInCurrentItemIsWord;

    const lineBrokeAHyphenatedWord = bothAreWords && hyphenBetween;
    const lineBrokeANonHyphenatedWord = wordSpanningAcrossLinesIsWord || wordSpanningAcrossLinesWithApostropheIsWord;

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

function findFootnoteSymbol(s: string): string | undefined {
  const symbolList = ['*'];
  return symbolList.find((symbol) => s.at(0) == symbol);
}

// Marks lines that contain or reference footnotes in place
function markFootnotes(lines: BlockOf<MarkedLine>[]) {
  // We keep the original indices so we can modify the array in place
  const linesMarkedWithIndices = lines.map((line, lineIndexOverall) => ({ lineIndexOverall, ...line }));

  const pages = Map.groupBy(linesMarkedWithIndices, (line) => line.pageIndex);
  pages.forEach((linesInPage) => {
    const footnotes: { footnote: LineKind.Footnote; lineIndex: number }[] = [];

    for (let i = linesInPage.length - 1; i >= 0; i--) {
      if (linesInPage[i].item.kind == 'page number') continue;

      const firstItemInLine = linesInPage[i].item.contents[0];
      const foundSymbol = findFootnoteSymbol(firstItemInLine.str);
      if (foundSymbol == undefined || footnotes.some(({ footnote }) => foundSymbol == footnote.symbol)) continue;

      const indexOverall = linesInPage[i].lineIndexOverall;

      const footnote: LineKind.Footnote = {
        kind: 'footnote',
        symbol: foundSymbol,
      };

      footnotes.push({ footnote, lineIndex: indexOverall });
      // Mark the line as a footnote
      lines[indexOverall].item = {
        ...lines[indexOverall].item,
        ...footnote,
      };
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
    /^(?<listNumber>(?:^[ivxlcIVXLC0-9]+|Zero|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve)\b)[).—]+ *(?<afterListNumber>.*)$/u,
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

  let output: MarkedLine;

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
  else if (
    !line.continuationOfPreviousLine &&
    listNumber !== undefined &&
    listNumberStr !== undefined &&
    restOfLine !== undefined &&
    listId !== undefined
  )
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

function normalizeText(toFix: string): string {
  toFix = toFix
    // why did they do this
    .replaceAll(/’’/g, '”')
    // I do not care for the dots personally. style choice
    .replaceAll(/A\. *A\./g, 'AA')
    // spaces are nice
    .replaceAll(/([\w\p{P}])—/gu, '$1 —')
    .replaceAll(/—([\w\p{P}])/gu, '— $1');

  return toFix;
}

main();
