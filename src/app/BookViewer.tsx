export type BookSelection = "AA" | "NA";

export default function BookViewer({ book }: { book: BookSelection }) {
  const pages: Page[] = fetchBook(book);
  return (
    <div className="flex flex-col items-center">
      <div className="max-w-[500px] min-w-[200px]">
        <Title book={book} page={1} />
        <p className="font-[libre-baskerville] text-lg/10 break">
          <BigLetter>W</BigLetter>e OF Alcoholics Anonymous believe that the
          reader will be interested in the medical estimate of the plan of
          recovery described in this book. Convincing testimony must surely come
          from medical men who have had experience with the sufferings of our
          members and have witnessed our return to health. A well known doctor,
          chief physician at a nationally prominent hospital specializing in
          alcoholic and drug addiction, gave Alcoholics Anonymous this letter:
        </p>
        <div className="ml-4 border-l-3 p-2">
          <p className="">To Whom It May Concern:</p>
        </div>
      </div>
    </div>
  );
}

function Title({ book, page }: { book: BookSelection; page: number }) {
  return (
    <div className="min-w-full flex flex-row justify-center border-y-2 py-2 mb-4">
      <div className="flex-1"></div>
      <span className="font-[libre-baskerville] font-[800] text-3xl">
        {titleOf(book)}
      </span>
      <div className="flex-1 flex flex-row-reverse items-end">
        <span className="text-2xl px-3 font-[libre-baskerville] font-[800]">
          {page}
        </span>
      </div>
    </div>
  );
}

function BigLetter({ children }: { children: string }) {
  return <span className="text-3xl">{children}</span>;
}

function titleOf(book: BookSelection): string {
  switch (book) {
    case "AA":
      return "Alcoholics Anonymous";
    case "NA":
      return "Narcotics Anonymous";
  }
}

type Chapter = {
  pages: Page[];
};
type Page = {
  elements: PageElement;
};
type PageElement = {
  element: Paragraph | Heading;
  textEffects: {
    bold?: void;
    underline?: void;
    italic?: void;
    quoteDepth?: number;
    justify?: "left" | "right" | "center";
  };
};
type Paragraph = {
  type: "paragraph";
  continued: boolean; // whether this paragraph was broken between pages
  body: string;
};
type Heading = {
  type: "heading";
  body: string;
};

function fetchBook(book: BookSelection): Page[] {
  switch (book) {
    case "AA":
      return [];
  }
  return [];
}
