import { readdir, writeFile } from 'node:fs/promises';
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
      if (process.argv.length < 4) {
        console.error('ERROR: Please pass the name of the file to output to!');
        process.exit(1);
      }
      return makeAllHTML(dir, process.argv[3]);
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

async function makeAllHTML(directory: string, outfile: string) {
  const converted: string = await processDirectory(
    directory,
    async (path) => getTextFromPDF(path).then((text) => convertToHTML(text, path)),
    'Converted to html',
  ).then((arr) => arr.join('\n\n\n\n'));

  const output = `<!doctype html>\n
    <html lang="en">\n
    <head>\n
      <meta charset="UTF-8" />\n
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>\n
      <style>
        ol.list-alpha-parentheses li::marker {
          content: "(" counter(list-item, lower-alpha) ")";
        }
      </style>
    </head>\n
    <body class="flex flex-col subpixel-antialiased font-serif bg-taupe-200">\n
      <div class="flex h-[85vh] w-full">
        <h1 class="my-auto md:text-6xl text-5xl font-black font-serif text-center">ALCOHOLICS ANONYMOUS</h1>
      </div>
      <div class="lg:max-w-2xl max-w-full md:px-10 px-4 mx-auto mb-12 lg:wrap-normal wrap-anywhere hyphens-auto">
        ${converted}\n
      </div>
    </body>\n
  </html>\n`;

  console.log('Writing to: ', path.resolve(outfile));
  try {
    await writeFile(`${path.resolve(outfile)}`, output, 'utf8');
  } catch (err) {
    console.error('Error writing to file', err);
  }
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
  files.sort((a, b) => {
    if (a.startsWith('_') && !b.startsWith('_')) return -1;
    if (!a.startsWith('_') && b.startsWith('_')) return 1;
    return a.localeCompare(b);
  });

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

  markLines(lines);
  markBrokenWords(lines);
  markIndents(lines);
  markFootnotes(lines);

  return lines;
}

import {
  type BodyText,
  type Footnote,
  type ParagraphBody,
  type ParagraphBodyItem,
  type Parsed,
  type Title,
} from './lib/parsedText.ts';
import { parseListNumberOrLetter } from './lib/parseInt.ts';
import path from 'node:path';

function convertToHTML(content: TextContent[], path: string): string {
  const lines = makeMarkedLines(content, path);
  const parsed = parseMarkedLines(lines);
  const merged = mergeParsedLines(parsed);

  function styled(element: BodyText): string {
    if (element.style.italicized) return `<i class="font-italic">${element.text}</i>`;
    else return element.text;
  }

  const htmlBody = merged
    .map((p) => {
      switch (p.kind) {
        case 'chapter':
          return `<h1 class="mt-6 mb-2 font-bold text-xl mx-auto">${p.text}</h1>`;
        case 'title':
          return `<h1 class="py-2 mb-8 mt-4 font-bold font-sans text-center text-2xl sticky top-0 z-10 bg-taupe-200 border-b-2 border-taupe-600">${p.text}</h1>`;
        case 'footnote':
          return `<p class="mb-2 indent-4 text-lg">${p.symbol}: ${p.body.map((ps) => {
            switch (ps.kind) {
              case 'text':
                return ps.spaceBefore + styled(ps);
              case 'footnote reference':
                return ps.symbol;
            }
          })}</p>`;
        case 'resentments table':
          return `<table class="divide-y-2 divide-taupe-600 my-4">
                    <thead>
                      <th class="min-w-1/4 py-4"><i class="font-normal font-italic text-base">I’m resentful at:</i></th>
                      <th class="max-w-2xs py-4"><i class="font-normal font-italic text-base">The Cause</i></th>
                      <th class="py-4"><i class="font-normal font-italic text-base">Affects my:</i></th>
                    </thead>
                    <tbody class="table-auto divide-y-2 divide-taupe-600">
                      <tr>
                        <td rowspan="6">Mr. Brown</td>
                        <td rowspan="2" class="max-w-2xs px-4 py-2">His attention to my wife.</td>
                        <td class="py-2">Sex relations.</td>
                      </tr>
                      <tr>
                        <td class="py-2">Self-esteem (fear)</td>
                      </tr>
                      <tr>
                        <td rowspan="2" class="max-w-2xs px-4 py-2">Told my wife of my mistress.</td>
                        <td class="py-2">Sex relations.</td>
                      </tr>
                      <tr>
                        <td class="py-2">Self-esteem (fear)</td>
                      </tr>
                      <tr>
                        <td rowspan="2" class="max-w-2xs px-4 py-2">Brown may get my job at the office.</td>
                        <td class="py-2">Security.</td>
                      </tr>
                      <tr>
                        <td class="py-2">Self-esteem (fear)</td>
                      </tr>

                      <tr>
                        <td rowspan="2">Mrs. Jones</td>
                        <td rowspan="2" class="max-w-2xs px-4 py-4">She's a nut — she snubbed me. She committed her husband for drinking. He's my friend. She's a gossip.</td>
                        <td class="py-2">Personal relationship.</td>
                      </tr>
                      <tr>
                        <td class="py-2">Self-esteem (fear)</td>
                      </tr>


                      <tr>
                        <td rowspan="2">My employer</td>
                        <td rowspan="2" class="max-w-2xs px-4 py-2">Unreasonable — Unjust — Overbearing — Threatens to fire me for drinking and padding my expense account.</td>
                        <td class="py-2">Self-esteem (fear)</td>
                      </tr>
                      <tr>
                        <td class="py-2">Security.</td>
                      </tr>


                      <tr>
                        <td rowspan="2">My wife</td>
                        <td class="max-w-2xs px-4 py-2">Misunderstands and nags. Likes Brown. </td>
                        <td class="py-2">Pride — Personal sex relations</td>
                      </tr>
                      <tr>
                        <td class="max-w-2xs px-4 py-2">Wants house put in her name.</td>
                        <td class="py-2">Security (fear)</td>
                      </tr>
                    </tbody>
                  </table>`;
        case 'paragraph':
          const bigLetter = p.bigLetter ?? '';
          const body = p.body
            .map((ps) => {
              switch (ps.kind) {
                case 'text':
                  return ps.spaceBefore + styled(ps);
                case 'footnote reference':
                  return ps.symbol;
                case 'linebreak':
                  return ' <br class="hidden md:inline" />';
              }
            })
            .join('');
          const [, firstWord] = body.match(/^(\w+)/u) ?? ['', ''];
          const firstTotal = bigLetter + firstWord;
          const space =
            !bigLetter || !firstWord || englishWords.check(firstTotal.toLowerCase()) || englishWords.check(firstTotal)
              ? ''
              : ' ';
          return `<p class="my-${p.singleLine ? 0 : 4} lg:${p.indentLevel < 0 ? '-' : ''}indent-${Math.abs(p.indentLevel) * 3} ${p.indentLevel < 0 ? '-' : ''}indent-${Math.abs(p.indentLevel * 1.5)} lg:mx-${(p.baseline ?? 0) * 3} mx-${Math.round((p.baseline ?? 0) * 1.5)} text-lg">${bigLetter}${space}${body}</p>`;
        case 'list':
          return `<ol class="list-${p.listStyle} text-lg py-4 lg:pl-12 pl-8">${p.items
            .map((listItem) => {
              const body = listItem
                .map((bodyItem) => {
                  switch (bodyItem.kind) {
                    case 'text':
                      return bodyItem.spaceBefore + styled(bodyItem);
                    case 'footnote reference':
                      return bodyItem.symbol;
                  }
                })
                .join('');
              return `<li class="pl-4 pb-4">${body}</li>`;
            })
            .join('\n\n')}</ol>`;
      }
    })
    .join('\n\n');

  return `<div>${htmlBody}</div>`;
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
                    return ps.spaceBefore + ps.text;
                  case 'footnote reference':
                    return ps.symbol;
                }
              })
              .join('') +
            '\n\n\n\n'
          );
        case 'paragraph':
          const bigLetter = p.bigLetter ?? '';
          const body = p.body
            .map((ps) => {
              switch (ps.kind) {
                case 'text':
                  return ps.spaceBefore + ps.text;
                case 'footnote reference':
                  return ps.symbol;
                case 'linebreak':
                  return '\n';
              }
            })
            .join('');
          const [, firstWord] = body.match(/^(\w+) /u) ?? [, ''];
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
                        return ps.spaceBefore + ps.text;
                      case 'footnote reference':
                        return ps.symbol;
                    }
                  })
                  .join(''),
            )
            .join(' ');
      }
    })
    .join('\n');
}

function mergeParsedLines(parsed: Parsed[]): Parsed[] {
  const merged: Parsed[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const current = parsed[i];
    const lastPushed = merged.at(-1);
    if (
      current.kind == 'paragraph' &&
      lastPushed?.kind == 'paragraph' &&
      current.singleLine &&
      ((lastPushed.singleLine && lastPushed.indentLevel > current.indentLevel) ||
        lastPushed.baseline === current.indentLevel)
    ) {
      if (lastPushed.singleLine) {
        lastPushed.body.push({ kind: 'linebreak' }, ...current.body);
        lastPushed.baseline = current.indentLevel;
        lastPushed.indentLevel = lastPushed.indentLevel - lastPushed.baseline;
        lastPushed.singleLine = false;
      } else if (lastPushed.baseline === current.indentLevel) {
        lastPushed.body.push({ kind: 'linebreak' }, ...current.body);
      }
    } else {
      merged.push(current);
    }
  }

  return merged;
}

// lets not print the title of the book randomly
// 'To wives' in the title has an asterisk, so print that one but not the subsequent page headers
const printedTitles: string[] = [
  'ALCOHOLICS ANONYMOUS',
  'TO HANDLE SOBRIETY',
  'ALCOHOLIC ANONYMOUS NUMBER THREE',
  'THE HOUSEWIFE WHO DRANK AT HOME',
];

const titlesAlwaysPrinted: string[] = [
  'PART I',
  'PIONEERS OF A.A.',
  'PART II',
  'THEY STOPPED IN TIME',
  'PART III',
  'THEY LOST NEARLY ALL',
];

function parseMarkedLines(lines: BlockOf<MarkedLine>[]): Parsed[] {
  const fontNames = Map.groupBy(
    lines.flatMap(({ item }) => item.contents.map(({ str, fontName }) => ({ str, fontName }))),
    ({ fontName }) => fontName,
  );

  const italicFontNames: string[] = new Array(0);
  const italicPhrases = [
    'Chapter',
    'Dr. Bob and the nine men and women who here tell',
    'The fifteen stories in this group tell of alcoholism at its',
    'Among',
    'This is the Foreword as it appeared in the first',
    'recovery',
    'Figures given in this foreword describe the',
    'Alcoholics Anonymous',
    'American',
    'Willingness, honesty and open',
    'need',
    'How Forty-Two Alcoholics',
    'los Doce Pasos',
  ];

  fontNames.forEach(([{ str, fontName }]) => {
    if (italicPhrases.some((x) => str.startsWith(x))) italicFontNames.push(fontName);
  });

  type Context = {
    lineLastSeen?: BlockOf<MarkedLine>;
    blockCurrentlyIn?: Exclude<Parsed, Footnote>; // Usually gonna be a paragraph, could be a list
    footnoteCurrentlyIn?: Footnote; // footnotes often interrupt paragraphs
    titleToPush?: { title: Title; page: number };
  };
  const context: Context = {};

  const parsed: Parsed[] = [];

  function pushContext(currentPage: number) {
    if (context.titleToPush?.page === 0) {
      parsed.push(context.titleToPush.title);
      context.titleToPush = undefined;
    }
    if (context.blockCurrentlyIn !== undefined) {
      parsed.push(context.blockCurrentlyIn);
      context.blockCurrentlyIn = undefined;
    }
    if (context.titleToPush !== undefined && context.titleToPush.page !== 0) {
      parsed.push(context.titleToPush.title);
      context.titleToPush = undefined;
    }
    if (context.footnoteCurrentlyIn && context.footnoteCurrentlyIn.pageIndex !== currentPage) {
      parsed.push(context.footnoteCurrentlyIn);
      context.footnoteCurrentlyIn = undefined;
    }
  }

  let skippingTable = false;

  lines.forEach((line) => {
    // we dont like these guys very much.
    if (['page number'].includes(line.item.kind)) return;

    while (line.item.contents.at(0)?.str.length == 0) line.item.contents = line.item.contents.slice(1);
    if (line.item.contents.length == 0) return;

    let currBlock = context.blockCurrentlyIn;

    const enteringList = line.item.kind === 'list item' && currBlock?.kind !== 'list';
    const leavingList =
      currBlock?.kind === 'list' &&
      line.item.kind !== 'list item' &&
      line.item.kind !== 'normal' &&
      (line.item.kind !== 'indented' || line.item.indentLevel <= 2);
    const enteringBlockQuote = currBlock?.kind !== 'list' && line.item.kind === 'indented' && line.item.indentLevel > 2;
    const isFootnoteSymbol =
      ['indented', 'normal'].includes(line.item.kind) && line.item.contents.map((i) => i.str).join('') === '*';

    const pushLastBlock: boolean =
      line.item.kind !== 'title' &&
      !isFootnoteSymbol &&
      (['big letter', 'chapter'].includes(line.item.kind) ||
        enteringList ||
        leavingList ||
        enteringBlockQuote ||
        (line.item.kind === 'normal' &&
          currBlock?.kind !== 'paragraph' &&
          currBlock?.kind !== 'list' &&
          !context.footnoteCurrentlyIn));

    if (pushLastBlock) pushContext(line.pageIndex);
    currBlock = context.blockCurrentlyIn;

    const enteringResentmentsTable = context.lineLastSeen?.item.contents
      .map((i) => i.str)
      .join(' ')
      .startsWith('We were usually as definite as this example');
    const leavingResentmentsTable = line.item.contents
      .map((i) => i.str)
      .join(' ')
      .startsWith('We went back through our lives');

    if (enteringResentmentsTable) {
      skippingTable = true;
      pushContext(context.lineLastSeen!.pageIndex);
    }

    if (skippingTable) {
      if (leavingResentmentsTable) {
        skippingTable = false;
        parsed.push({ kind: 'resentments table' });
      } else return;
    }

    switch (line.item.kind) {
      case 'big letter':
        const afterBig = line.item.contents.slice(1);
        const body = flattenLine(afterBig, line.pageIndex, italicFontNames);
        // TODO: add indent level detection
        context.blockCurrentlyIn = {
          kind: 'paragraph',
          bigLetter: line.item.contents[0].str,
          indentLevel: 1,
          singleLine: false,
          body,
        };

        break;

      case 'list item':
        function detectListStyle(marker: string) {
          if (marker.charAt(0) == '(') marker = marker.slice(1);
          switch (marker.charAt(0)) {
            case 'a':
              return 'alpha-parentheses';
            case 'i':
              return '[lower-roman]';
            case 'I':
              return '[upper-roman]';
            case '1':
            default:
              return '[decimal]';
          }
        }

        if (context.blockCurrentlyIn?.kind !== 'list')
          context.blockCurrentlyIn = { kind: 'list', items: [], listStyle: detectListStyle(line.item.number[0]) };

        if (line.item.continuationOfPreviousLine && context.blockCurrentlyIn.items.length > 0) {
          const lastItem = context.blockCurrentlyIn.items.pop()!;
          const lastInLastItem = lastItem.pop()!;

          lastItem.push(...joinLines(lastInLastItem, line, italicFontNames));
          context.blockCurrentlyIn.items.push(lastItem);
        } else if (line.item.continuationOfPreviousLine && context.blockCurrentlyIn.items.length == 0) {
          console.error(
            `WARNING: Context empty in file ${line.file}, page ${line.pageIndex} but the following line is continuing a previous line:`,
          );
          console.error(
            `${flattenLine(line.item.contents, line.pageIndex, italicFontNames!).map((v) => (v.kind == 'text' ? v.text : v.kind == 'footnote reference' ? v.symbol : ''))}`,
          );
          console.error('Skipping this line during parsing.');
        } else {
          const [numberStr] = line.item.number;

          function skip() {
            while (line.item.contents[0].str.length == 0) line.item.contents = line.item.contents.slice(1);
            line.item.contents[0].str = line.item.contents[0].str.substring(1);
            while (line.item.contents[0].str.length == 0) line.item.contents = line.item.contents.slice(1);
          }

          for (let i = 0; i < numberStr.length; i++)
            if (line.item.contents[0].str.charAt(0) == numberStr.charAt(i)) {
              skip();
            } else {
              console.error('???????/: c=', line.item.contents[0].str.charAt(0), "| n='" + numberStr.charAt(i) + "'");
            }

          context.blockCurrentlyIn.items.push(flattenLine(line.item.contents, line.pageIndex, italicFontNames));
        }
        break;

      case 'footnote':
        context.footnoteCurrentlyIn = {
          kind: 'footnote',
          symbol: line.item.symbol,
          pageIndex: line.pageIndex,
          body: flattenLine(line.item.contents.slice(1), line.pageIndex, italicFontNames),
        };
        break;
      case 'chapter':
        parsed.push({ kind: 'chapter', text: `Chapter ${line.item.chapter}` });
        break;
      case 'title':
        const currentTitle = line.item.title;
        const alreadyPrinted = printedTitles.includes(currentTitle);
        if (!alreadyPrinted || titlesAlwaysPrinted.includes(currentTitle)) {
          if (context.titleToPush === undefined)
            context.titleToPush = {
              title: {
                kind: 'title',
                text: normalizeText(currentTitle),
              },
              page: line.pageIndex,
            };
          else context.titleToPush.title.text += ' ' + normalizeText(currentTitle);

          printedTitles.push(currentTitle);
        }
        break;

      case 'indented':
        if (currBlock?.kind == 'list') {
          const lastItemofLastItem = currBlock.items.at(-1)!.pop()!;

          currBlock.items.at(-1)!.push(...joinLines(lastItemofLastItem, line, italicFontNames));
        } else if (isFootnoteSymbol && currBlock?.kind === 'paragraph') {
          currBlock.body.push({ kind: 'footnote reference', symbol: '*', pageOfReferencedFootnote: line.pageIndex });
        } else if (line.item.continuationOfPreviousLine && currBlock?.kind == 'paragraph') {
          const lastItem = currBlock.body.pop()!;

          const [first, ...rest] = joinLines(lastItem, line, italicFontNames, true);

          currBlock.body.push(first);
          pushContext(line.pageIndex);

          context.blockCurrentlyIn = {
            kind: 'paragraph',
            indentLevel: line.item.indentLevel,
            singleLine: true,
            body: rest,
          };
        } else {
          pushContext(line.pageIndex);
          context.blockCurrentlyIn = {
            kind: 'paragraph',
            indentLevel: line.item.indentLevel,
            singleLine: true,
            body: [...flattenLine(line.item.contents, line.pageIndex, italicFontNames)],
          };
        }
        break;
      case 'normal':
        const currFootnote = context.footnoteCurrentlyIn;

        if (currFootnote?.pageIndex == line.pageIndex) {
          const lastItem = currFootnote.body.pop()!;

          currFootnote.body.push(...joinLines(lastItem, line, italicFontNames));
        } else if (currBlock?.kind == 'paragraph') {
          if (currBlock.body.at(-1)?.kind == 'text') {
            const lastItem = currBlock.body.pop()!;

            currBlock.singleLine = false;
            currBlock.body.push(...joinLines(lastItem, line, italicFontNames));
          } else {
            currBlock.singleLine = false;
            currBlock.body.push(...flattenLine(line.item.contents, line.pageIndex, italicFontNames));
          }
        } else if (currBlock?.kind == 'list' && currBlock.items.at(-1)?.at(-1)?.kind == 'text') {
          const lastItemofLastItem = currBlock.items.at(-1)!.pop()!;

          currBlock.items.at(-1)!.push(...joinLines(lastItemofLastItem, line, italicFontNames));
        } else if (currBlock === undefined) {
          context.blockCurrentlyIn = {
            kind: 'paragraph',
            indentLevel: 0,
            singleLine: true,
            body: [...flattenLine(line.item.contents, line.pageIndex, italicFontNames)],
          };
        } else {
          console.error(
            `ERROR during parsing: blockKind = ${currBlock?.kind} | line: ${line.item.contents.map(({ str }) => str).join(' ')}`,
          );
        }
        break;
    }
    context.lineLastSeen = line;
  });

  // + 1 so that the footnote gets pushed for sure
  pushContext(context.lineLastSeen!.pageIndex + 1);

  return parsed;
}

function joinLines(
  lastItem: ParagraphBodyItem,
  nextLine: BlockOf<MarkedLine>,
  italicFontNames: string[],
  preserveLineBreak = false,
): ParagraphBodyItem[] {
  const nextFlattened = flattenLine(nextLine.item.contents, nextLine.pageIndex, italicFontNames!);
  const firstOfNextItalicized = nextFlattened[0].kind == 'text' && nextFlattened[0].style.italicized;

  if (lastItem.kind !== 'text' || lastItem.style.italicized !== firstOfNextItalicized)
    return [lastItem, ...nextFlattened];

  let { text } = lastItem;

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
      text = text.replace(/ *$/, '');
      break;
    case 'keep hyphen':
      text += '-';
      break;
    case false:
      if (text.length > 0) text += ' ';
      break;
  }

  const space = firstWord && afterFirstWord ? ' ' : '';
  const style = lastItem.style;
  const { spaceBefore } = lastItem;

  if (preserveLineBreak) {
    if (continuation) {
      text += firstWord;
      return [
        { kind: 'text', text, style, spaceBefore },
        { kind: 'text', text: afterFirstWord, style, spaceBefore: ' ' },
        ...afterFirstElement,
      ];
    } else {
      const secondText = firstWord + space + afterFirstWord;
      return [
        { kind: 'text', text, style, spaceBefore },
        { kind: 'text', text: secondText, style, spaceBefore: ' ' },
        ...afterFirstElement,
      ];
    }
  } else {
    text += firstWord + space + afterFirstWord;
    return [{ kind: 'text', text, style, spaceBefore }, ...afterFirstElement];
  }
}

function flattenLine(line: TextItem[], pageNumber: number, italicFontNames: string[]): ParagraphBody {
  let last: TextItem | undefined = undefined;
  const flattened: ParagraphBodyItem[] = [];
  for (let i = 0; i < line.length; i++) {
    const { x } = positionOf(line[i]);
    const lastPosition = last && positionOf(last);

    const spaceBeforeCurrent = lastPosition ? x - lastPosition.x - lastPosition.width : 0;

    const spaceToAdd = spaceBeforeCurrent > 2 || line[i].str.startsWith('—') ? ' ' : '';

    if (isFootnoteSymbol(line[i].str)) {
      flattened.push({ kind: 'footnote reference', symbol: line[i].str, pageOfReferencedFootnote: pageNumber });
    } else {
      const currentIsItalic = italicFontNames.includes(line[i].fontName) && line[i].str !== 'W';

      const lastFlattened = flattened.at(-1);
      const addLastStr =
        lastFlattened !== undefined &&
        lastFlattened.kind === 'text' &&
        lastFlattened?.style.italicized === currentIsItalic;

      if (addLastStr) flattened.pop();
      const merged = addLastStr ? lastFlattened.text + spaceToAdd + line[i].str : line[i].str;

      // emdashes are often in the middle of TextItems, so we do this hacky nonsense
      const text = normalizeText(merged);

      const style = { italicized: currentIsItalic };

      flattened.push({
        kind: 'text',
        text,
        style,
        spaceBefore: addLastStr ? lastFlattened.spaceBefore : spaceToAdd,
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

// a generic helper function to convert an array of tuples to a record
function makeRecord<const T extends readonly (readonly [PropertyKey, unknown])[]>(tuples: T) {
  return Object.fromEntries(tuples) as {
    [K in T[number][0]]: Extract<T[number], readonly [K, unknown]>[1];
  };
}

const titles = makeRecord(
  [
    'Alcoholics Anonymous',
    'The Doctor’s Opinion',
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
    'To Wives *',
    'To Wives',
    'The Family Afterward',
    'To Employers',
    'A Vision For You',
    'Personal Stories',
    'How Forty-Two Alcoholics Recovered From Their Malady',

    'PART I',
    'PIONEERS OF A.A.',
    'DOCTOR BOB’S NIGHTMARE',
    'ALCOHOLIC ANONYMOUS',
    'NUMBER THREE',
    'ALCOHOLIC ANONYMOUS NUMBER THREE',
    'GRATITUDE IN ACTION',
    'WOMEN SUFFER TOO',
    'OUR SOUTHERN FRIEND',
    'THE VICIOUS CYCLE',
    'JIM’S STORY',
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
    'PHYSICIAN, HEAL THYSELF!',
    'MY CHANCE TO LIVE',
    'STUDENT OF LIFE',
    'CROSSING THE RIVER OF DENIAL',
    'BECAUSE I’M AN ALCOHOLIC',
    'IT MIGHT HAVE BEEN WORSE',
    'TIGHTROPE',
    'FLOODED WITH FEELING',
    'WINNER TAKES ALL',
    'ME AN ALCOHOLIC?',
    'THE PERPETUAL QUEST',
    'A DRUNK, LIKE YOU',
    'ACCEPTANCE WAS THE ANSWER',
    'WINDOW OF OPPORTUNITY',

    'PART III',
    'THEY LOST NEARLY ALL',
    'MY BOTTLE, MY RESENTMENTS,',
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
    'A.A. TAUGHT HIM TO HANDLE',
    'SOBRIETY',
    'TO HANDLE SOBRIETY',

    'The A.A. Tradition',
    'The Twelve Traditions',
    ['( THE LONG FORM )', 'Twelve Traditions, Long Form'],
    'Spiritual Experience',
    'The Medical View On A.A.',
    'The Lasker Award',
    'The Religious View on A.A.',
    'How to Get in Touch With A.A.',
    'The Twelve Concepts (Short Form)',
  ].map((x) => (typeof x == 'string' ? [x.toUpperCase(), x.toUpperCase()] : (x as [string, string]))),
);
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
    const firstWordInCurrentItem: string | undefined = firstItemOfCurrent.str.match(/^(-?[\w’]+)/u)?.at(1);
    const firstWordInCurrentItemIsWord: boolean =
      firstWordInCurrentItem != undefined && englishWords.check(firstWordInCurrentItem);

    const lastWordInLastItem: string | undefined = lastItemOfLast.str.match(/\b([\w’]+) ?-?$/)?.at(1);
    const lastWordInLastItemIsWord: boolean = lastWordInLastItem != undefined && englishWords.check(lastWordInLastItem);
    const hyphenBetween: boolean = last != undefined && /-$/.test(lastItemOfLast.str);

    // Remove hyphen if it exists, we will replace it later
    if (hyphenBetween)
      last.item.contents[last.item.contents.length - 1].str = last.item.contents[
        last.item.contents.length - 1
      ].str.slice(0, -1);

    const wordsNotInDictionary = ['Plattsburg', 'baffling'];

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
            indentLevel: Math.round((xValue - baselineXValue) / 6),
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

  const titleMatches = lineInPlainText.match(/^[0-9]* *(?<title>(?:[(A-Za-z’.,?!)]+ +)*[(A-Za-z’.,?!)]+) *\*?[0-9]*$/);
  const title = titleMatches?.groups?.title;

  const chapterMatches = lineInPlainText.match(/^Chapter +(?<chapter>[0-9]*)$/);
  const chapter = chapterMatches?.groups?.chapter;

  const pageNumberMatches = lineInPlainText.match(/^(?<page>[ivx0-9]*)$/);
  const page = pageNumberMatches?.groups?.page;

  const listMatches = lineInPlainText.match(
    /^(?<listNumberAndPunctuation>\((?<listNumber>[a-c])|(?<listNumber>^[ivxlcIVXLC]+||[0-9][0-9]?|Zero|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve))\b ?(?<post1>[).—]) ?(?<post2>[).—]?) *(?<afterListNumber>.*)$/u,
  );
  const post1 = listMatches?.groups?.post1 ?? '';
  const post2 = listMatches?.groups?.post2 ?? '';
  const wholeListNumber = (listMatches?.groups?.listNumberAndPunctuation ?? '') + post1 + post2;
  const listNumberStr = listMatches?.groups?.listNumber;
  const listNumber = parseListNumberOrLetter(listNumberStr);
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
  else if (title && titles[title.toUpperCase()])
    output = {
      ...line,
      kind: 'title',
      title: titles[title.toUpperCase()],
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
    wholeListNumber !== undefined &&
    listNumber !== undefined &&
    listNumberStr !== undefined &&
    restOfLine !== undefined &&
    listId !== undefined
  )
    output = {
      ...line,
      kind: 'list item',
      number: [wholeListNumber, listNumber],
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
    .replaceAll(/AA ([A-Z])/g, 'AA. $1')
    // spaces are nice
    .replaceAll(/([\w\p{P}])—/gu, '$1 —')
    .replaceAll(/—([\w\p{P}])/gu, '— $1')
    .replaceAll(/ \. \. \./g, '...');

  return toFix;
}

main();
