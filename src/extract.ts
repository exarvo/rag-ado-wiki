import { writeFileSync } from "node:fs";
import { getEmbeddingVector } from "./utils.js";
import { chunkMarkdown } from "./embedder.js";

/**
 * Defines the Document Interface.
 */
export interface MyDocument {
  pageId?: string;
  chunk?: string;
  pageTitle?: string | null;
  pagePath?: string | null;
  content?: string | null;
  isParentPage?: boolean;
  lastModified?: string;
  contentVector?: number[] | null;
}

/**
 * Options for creating a `AzureAISearchDataSource`.
 */
const auth = Buffer.from(`:${process.env.AZ_PAT}`).toString("base64");

const headers = {
  Authorization: `Basic ${auth}`,
  Accept: "application/json",
};

async function fetchJSON(url: string, params = null) {
  let fullUrl = url;

  if (params) {
    const q = new URLSearchParams(params);
    fullUrl = `${url}?${q.toString()}`;
  }

  const res = await fetch(fullUrl, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

// -------------------------------------------------
// GET WIKI ID
// -------------------------------------------------
async function getWikiId(): Promise<string> {
  const url = `https://dev.azure.com/${process.env.AZ_ORG}/${process.env.AZ_PROJECT}/_apis/wiki/wikis`;

  const data = await fetchJSON(url, {
    "api-version": "7.1-preview.1",
  });

  for (const wiki of data.value || []) {
    if (wiki.name === process.env.AZ_WIKI || wiki.id === process.env.AZ_WIKI) {
      return wiki.id;
    }
  }

  throw new Error(`Wiki "${process.env.AZ_WIKI}" not found`);
}

// -------------------------------------------------
// GET WIKI TREE
// -------------------------------------------------
async function getWikiTree(wikiId: string) {
  const url = `https://dev.azure.com/${process.env.AZ_ORG}/${process.env.AZ_PROJECT}/_apis/wiki/wikis/${wikiId}/pages`;

  return fetchJSON(url, {
    recursionLevel: "full",
    "api-version": "7.1-preview.1",
  });
}

// -------------------------------------------------
// EXTRACT PATHS
// -------------------------------------------------
function extractPaths(node, list) {
  if (!node) return;

  if (node.path && node.path !== "/") {
    list.push(node.path);
  }

  if (Array.isArray(node.subPages)) {
    for (const sub of node.subPages) {
      extractPaths(sub, list);
    }
  }
}

// -------------------------------------------------
// FETCH PAGE CONTENT
// -------------------------------------------------
async function fetchPageContent(wikiId, pagePath) {
  const url = `https://dev.azure.com/${process.env.AZ_ORG}/${process.env.AZ_PROJECT}/_apis/wiki/wikis/${wikiId}/pages`;

  const data = await fetchJSON(url, {
    path: pagePath,
    recursionLevel: 0,
    includeContent: true,
    "versionDescriptor.version": "wikiMaster",
    "api-version": "7.1-preview.1",
  });

  console.log("\nFETCHED:", url);
  console.log("PATH   :", data.path);
  console.log("HAS HTML:", !!data.content);

  return data;
}

// -------------------------------------------------
// MAIN
// -------------------------------------------------
export async function extract(): Promise<MyDocument[]> {
  try {
    console.log("🔹 Resolving Wiki ID...");
    const wikiId = await getWikiId();
    console.log("✅ Using Wiki ID:", wikiId);

    console.log("\n🔹 Fetching wiki tree...");
    const tree = await getWikiTree(wikiId);

    const paths = [];
    extractPaths(tree, paths);

    console.log(`\n✅ Found ${paths.length} wiki pages`);

    const documents: MyDocument[] = [];

    for (const pagePath of paths) {
      try {
        console.log(`\n📄 Reading page:`, pagePath);

        const page = await fetchPageContent(wikiId, pagePath);

        const html = page.content || "";

        if (!html.trim()) {
          console.log("⚠️ Empty content — skipping");
          continue;
        }

        const chunked = await chunkMarkdown(html);

        const embeddings = await getEmbeddingVector(chunked);

        for (let i = 0; i < chunked.length; i++) {
          const record: MyDocument = {
            content: chunked[i],
            pageId: String(page.id),
            chunk: `${String(page.id)}-${i + 1}`,
            pagePath: page.path,
            pageTitle: page.path.split("/").pop(),
            lastModified: page.lastModified,
            isParentPage:
              String(page.isParentPage).toLowerCase() === "true"
                ? true
                : String(page.isParentPage).toLowerCase() === "false"
                  ? false
                  : undefined,
            contentVector: embeddings[i].embedding,
          };
          documents.push(record);
          console.log(chunked[i]);
        }
      } catch (err) {
        console.error(`❌ ERROR on page ${pagePath}:`, err.message);
        console.error("⏭️  Skipping and continuing...\n");
        continue; // 🔥 continue loop, do NOT terminate script
      }
    }

    writeFileSync("../out.json", JSON.stringify(documents, null, 2), "utf-8");
    console.log("\n✅ Saved the Data in the AI Search.");
    return documents;
  } catch (err) {
    console.error("\n❌ ERROR:", err.message);
    console.error(err);
  }
}
