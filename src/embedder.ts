import {
  MarkdownTextSplitter,
  TokenTextSplitter,
} from "@langchain/textsplitters";

const splitter = async (md: string) => {
  const split = new MarkdownTextSplitter({ chunkSize: 2000 });

  return split.splitText(md);
};

const chunker = async (mdText: string[]) => {
  const chunk = new TokenTextSplitter({
    chunkSize: 400,
    chunkOverlap: 60,
    encodingName: "cl100k_base",
  });

  const finalChunks: string[] = [];
  for (const chk of mdText) {
    const parts = await chunk.splitText(chk);
    finalChunks.push(...parts);
  }
  console.log(finalChunks);

  return finalChunks;
};

export const chunkMarkdown = async (markdown: string) => {
  const sections = await splitter(markdown);

  const chunks = await chunker(sections);

  return chunks;
};
