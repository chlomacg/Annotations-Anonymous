declare module 'is-word' {
  export default function isWord(language: Language): Trie;

  export class Trie {
    check(word: string): boolean;
  }

  export type Language =
    | 'american-english'
    | 'brazilian'
    | 'british-english'
    | 'french'
    | 'italian'
    | 'ngerman'
    | 'ogerman'
    | 'portuguese'
    | 'spanish'
    | 'swiss';
}
