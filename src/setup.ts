import {
  AzureKeyCredential,
  SearchClient,
  SearchIndexClient,
} from "@azure/search-documents";
import { createIndexIfNotExists, delay, upsertDocuments } from "./utils.js";
import { extract, MyDocument } from "./extract.js";

const searchApiKey = process.env.SECRET_AZURE_SEARCH_KEY;

/**
 *  Main function that creates the index and upserts the documents.
 */
export async function main() {
  const index = process.env.AI_SEARCH_DOC;

  if (
    !process.env.AZURE_SEARCH_ENDPOINT ||
    !process.env.SECRET_AZURE_SEARCH_KEY ||
    !process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME
  ) {
    throw new Error(
      "Missing environment variables - please check that AZURE_SEARCH_ENDPOINT, AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME are set.",
    );
  }

  const searchApiEndpoint = process.env.AZURE_SEARCH_ENDPOINT!;
  const credentials = new AzureKeyCredential(searchApiKey);

  const searchIndexClient = new SearchIndexClient(
    searchApiEndpoint,
    credentials,
  );
  createIndexIfNotExists(searchIndexClient, index);
  // Wait 5 seconds for the index to be created
  await delay(5000);

  const searchClient = new SearchClient<MyDocument>(
    searchApiEndpoint,
    index,
    credentials,
  );

  let data: MyDocument[] = [];

  data = await extract();

  await upsertDocuments(searchClient, data);
}

main();
