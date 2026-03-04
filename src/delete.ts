import { AzureKeyCredential, SearchIndexClient } from "@azure/search-documents";
import { deleteIndex } from "./utils.js";

const index = process.env.AI_SEARCH_DOC;
const searchApiKey = process.env.SECRET_AZURE_SEARCH_KEY;

const searchApiEndpoint = process.env.AZURE_SEARCH_ENDPOINT!;
const credentials = new AzureKeyCredential(searchApiKey);

const searchIndexClient = new SearchIndexClient(searchApiEndpoint, credentials);

await deleteIndex(searchIndexClient, index);

console.log(`Done deletion of ${index}`);
