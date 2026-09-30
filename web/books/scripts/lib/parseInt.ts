function parseRoman(toParse: string) {
  const numeralMap: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  let total = 0;

  for (let i = 0; i < toParse.length; i++) {
    const currentVal = numeralMap[toParse[i]];
    const nextVal = numeralMap[toParse[i + 1]];

    // If current value is smaller than the next value, subtract it (e.g., IV, IX)
    if (nextVal && currentVal < nextVal) {
      total -= currentVal;
    } else {
      total += currentVal;
    }
  }

  return total;
}

function isRoman(input: string): boolean {
  const regex = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
  return regex.test(input);
}

export function parseIntOrRomanOrSpelledNumber(input?: string): number | undefined {
  // normal int
  if (input == undefined) return undefined;

  input = input.toLowerCase();

  const wordMap: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
  };

  const parsedFromWord = wordMap[input];

  if (parsedFromWord !== undefined) return parsedFromWord;

  if (/^-?\d+$/.test(input)) return parseInt(input);

  if (isRoman(input)) return parseRoman(input);

  return undefined;
}
