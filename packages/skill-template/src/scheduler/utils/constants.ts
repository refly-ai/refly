const _MAX_NEED_RECALL_TOKEN = 4096; // > 2000 need use recall for similar chunks other than use whole content
const _MAX_NEED_RECALL_CONTENT_TOKEN = 4096; // > 10000 need use recall for similar chunks other than use whole content
const _SHORT_CONTENT_THRESHOLD = 500; // Minimum relevance score, used to filter out unrelated Chunks

const _MAX_RAG_RELEVANT_CONTENT_RATIO = 0.7;
const _MAX_SHORT_CONTENT_RATIO = 0.3;

const _MAX_RAG_RELEVANT_DOCUMENTS_RATIO = 0.7;
const _MAX_SHORT_DOCUMENTS_RATIO = 0.3;

const _MAX_RAG_RELEVANT_RESOURCES_RATIO = 0.7;
const _MAX_SHORT_RESOURCES_RATIO = 0.3;

export const DEFAULT_MODEL_CONTEXT_LIMIT = 128 * 1024;

// chat history params
const _MAX_MESSAGES = 20;
const _MAX_MESSAGE_TOKENS = 4000;
const _MAX_MESSAGES_TOTAL_TOKENS = 30000;
const MAX_OUTPUT_TOKENS_LEVEL3 = 16384;

// max tokens for url sources
const _MAX_URL_SOURCES_TOKENS = MAX_OUTPUT_TOKENS_LEVEL3 * 2;
