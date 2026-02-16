import { readdir } from 'node:fs/promises';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import convert from 'convert';
import { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';

import isWord from 'is-word';
const englishWords = isWord('american-english');

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

function positionOf(item: TextItem) {
  // if we don't add the height the giant letter that starts the chapter goes later than it should
  const y: number = item.transform[5] + item.height;
  const x: number = item.transform[4];

  return { x, y };
}

function parseFile(content: TextContent[]): string {
  let str = '';
  const textItems = content
    .map((c, pageIndex) =>
      c.items
        .filter((item) => 'str' in item)
        .map((item) => ({ item, position: positionOf(item), pageIndex }))
        .sort((a, b) => {
          // A lower y value means lower on the page. Top to bottom first
          if (a.position.y < b.position.y) return 1;
          // but a lower x value means closer to the start of the line (left in English). Left-to-right second
          if (a.position.y == b.position.y) return a.position.x - b.position.x;
          // else a.position.y > b.position.y
          return -1;
        }),
    )
    .flat(1);
  console.log(textItems.map(({ item }) => item.str).reduce((p, c) => p + ',' + c));

  // let currPage = 0;

  const lineInfo = [];
  let last: BlockOf<TextItem> | undefined = undefined;
  for (let i = 0; i < textItems.length; i++) {
    // const {
    //   item,
    //   position: { x, y },
    //   pageIndex,
    // } = textItems[i];

    // if (pageIndex != currPage) {
    //   console.log(`there are ${textItems.length} text items in page ${pageIndex}`);
    //   currPage = pageIndex;
    // }
    // console.log(`[${x}, ${y}] = ${item.str}`);
    const current = textItems[i];

    const result = joinTextItems(current, lineInfo, last);
    if (result == undefined) continue;

    str += result;
    last = current;
  }

  return str;
}

type BlockOf<T> = {
  item: T;
  position: Position;
};

type Position = {
  x: number;
  y: number;
};

// type LineInfo = {
//   position: Position;
//   lineType: 'normal' | 'chapter' | 'title' | 'footnote' | 'paragraphStart' | 'firstLetterBig';
// };

function joinTextItems(
  current: BlockOf<TextItem>,
  lineStartPositions: Position[],
  last?: BlockOf<TextItem>,
): string | undefined {
  const isFirstItemOverall = last == undefined;

  // Keep in mind (0, 0) is at the bottom left corner of the page
  const isFirstBlockOnLine = isFirstItemOverall || current.position.y < last.position.y;
  if (isFirstBlockOnLine) lineStartPositions.push(current.position);

  // Skip empty or title blocks
  if (
    current.item.str.trim().length == 0 ||
    (isFirstBlockOnLine && /^ALCOHOLICS ANONYMOUS|THERE IS A SOLUTION|[0-9]+$/.test(current.item.str.trim()))
  ) {
    // console.log(`SKIPPING ${current.item.str}`);
    return undefined;
  }

  // trim hyphen, we'll add it back if necessary
  // we only use currentStr to print results
  const endsWithHyphen = /-$/.test(current.item.str);
  const currentStr = endsWithHyphen ? current.item.str.slice(0, current.item.str.length - 1) : current.item.str;

  // Find the candidates for a word broken across lines
  const firstWordInCurrentItem: string | undefined = current.item.str.match(/^([\w\-]+)/)?.at(1);
  const firstWordInCurrentItemIsWord: boolean = firstWordInCurrentItem && englishWords.check(firstWordInCurrentItem);

  const lastWordInLastItem: string | undefined = last?.item.str.match(/\b(\w+)\W*$/)?.at(1);
  const lastWordInLastItemIsWord: boolean | undefined = lastWordInLastItem && englishWords.check(lastWordInLastItem);
  const hyphenBetween: boolean = last != undefined && /\b\w+-$/.test(last.item.str);

  // If the last index of a space is -1, there is only one word, so the index is 0
  const wordSpanningAcrossLines: string | undefined = lastWordInLastItem && lastWordInLastItem + firstWordInCurrentItem;
  const wordSpanningAcrossLinesIsWord: boolean | undefined =
    wordSpanningAcrossLines && englishWords.check(wordSpanningAcrossLines.toLowerCase());

  if (isFirstItemOverall) {
    return currentStr;
  } else if (isFirstBlockOnLine) {
    // console.log(`[${current.position.y}] = { x: ${current.position.x}, itemIndex: ${i} }`);
    // if (current.item.str == '')
    // console.log(
    //   `lastWord: ${lastWordInLastItem}, firstWord: ${firstWordInCurrentItem}, wordSpanning: ${wordSpanningAcrossLines}, lastWordInLastItemIsWord: ${lastWordInLastItemIsWord} && firstWordInCurrentItemIsWord: ${firstWordInCurrentItemIsWord} && wordSpanningAcrossLinesIsWord: ${wordSpanningAcrossLinesIsWord}`,
    // );

    const bothAreWords = lastWordInLastItemIsWord && firstWordInCurrentItemIsWord;

    const lineBrokeAHyphenatedWord = bothAreWords && hyphenBetween;
    const lineBrokeANonHyphenatedWord = /* !bothAreWords && */ wordSpanningAcrossLinesIsWord;
    // commented out because it caused trouble with 'We' ('W' and 'e' are words i guess???)

    if (lineBrokeANonHyphenatedWord) {
      return currentStr;
    } else if (lineBrokeAHyphenatedWord) {
      return `-${currentStr}`;
    } else {
      return `\n${currentStr}`;
    }
  } else {
    return ` ${currentStr}`;
  }
}

async function makeAllPlainText(inDirectory: string) {
  const currentDir = import.meta.dirname;
  const parentDir = currentDir.slice(0, currentDir.lastIndexOf('/'));

  const dir = `${parentDir}/${inDirectory}`;

  const files = await readdir(dir);

  const time1 = new Date();
  const out = await Promise.all(files.map((file) => GetTextFromPDF(`${dir}/${file}`).then(parseFile)));
  const time2 = new Date();

  const elapsed2 = convert(time2.getTime() - time1.getTime(), 'ms').to('best');
  console.log(`Made plaintext in ${elapsed2.toString()}`);

  console.log(out);
}

makeAllPlainText('AA-test');
