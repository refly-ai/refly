import { SkillContext } from '@refly/openapi-schema';
import { BaseChatModel } from '@refly/providers';
import { encode, decode } from 'gpt-tokenizer';
import { SkillEngine } from '../../engine';

export type Summarizer = (query: string, content: string, maxTokens: number) => Promise<string>;

// Internal block representation for middle-out compression
type Block = {
  section: string;
  // Markdown before the variable body (e.g. headers and metadata)
  prefix: string;
  // The variable body part that can be summarized or trimmed
  body: string;
  // Markdown after the body (e.g. code block fences)
  suffix: string;
};

// Fallback summarizer trims text to budget using token-based middle-out truncation
const fallbackSummarize = async (
  _query: string,
  content: string,
  budget: number,
): Promise<string> => {
  // Keep short content unchanged
  const tokens = encode(content ?? '');
  if (tokens.length <= budget) return content ?? '';

  // Allocate 45/10/45 head/summary/tail by tokens
  const summaryBudget = Math.max(48, Math.min(128, Math.floor(budget * 0.2)));
  const headBudget = Math.max(1, Math.floor((budget - summaryBudget) / 2));
  const tailBudget = Math.max(1, budget - summaryBudget - headBudget);

  const headTokens = tokens.slice(0, headBudget);
  const tailTokens = tokens.slice(tokens.length - tailBudget);

  const head = decode(headTokens);
  const tail = decode(tailTokens);

  // Use a simple placeholder for the middle in fallback mode
  const middleNote = `\n\n...[${tokens.length - headTokens.length - tailTokens.length} tokens compressed]...\n\n`;

  return `${head}${middleNote}${tail}`;
};

// Join all sections with proper spacing
const renderAll = (items: Block[]) => {
  if (!items?.length) return '';

  const bySection: Record<string, Block[]> = {};
  for (const it of items) {
    const key = it.section ?? 'General';
    if (!bySection[key]) bySection[key] = [];
    bySection[key].push(it);
  }

  const renderedSections: string[] = [];
  for (const [sectionTitle, sectionBlocks] of Object.entries(bySection)) {
    const rendered = sectionBlocks
      .map((b) => `${b.prefix}${b.body}${b.suffix}`)
      .join('\n\n---\n\n');
    renderedSections.push(`## ${sectionTitle}\n\n${rendered}`);
  }

  return `# Context\n\n${renderedSections.join('\n\n')}`;
};

const summarizer = async (
  model: BaseChatModel,
  query: string,
  content: string,
  maxTokens: number,
) => {
  const summarizerModel = model;

  // Build concise, instruction-following messages for deterministic summarization
  const requestMessages = [
    {
      role: 'system',
      content:
        'You are a helpful assistant that compresses context strictly and preserves key structure. ' +
        'Summarize with the given query in mind. Keep headings, bullet points and code blocks concise. ' +
        'Do not add commentary. Output plain text only. Keep within the token budget.',
    },
    {
      role: 'user',
      content: `Query:\n${query}\n\nContext to compress:\n${content ?? ''}`,
    },
  ];

  const responseMessage: any = await summarizerModel.invoke(requestMessages);

  // Extract plain text from the model response
  const raw = ((): string => {
    const maybeContent = responseMessage?.content ?? responseMessage;
    if (typeof maybeContent === 'string') return maybeContent;
    if (Array.isArray(maybeContent)) {
      const textParts = maybeContent
        .filter((part) => part?.type === 'text' && typeof part?.text === 'string')
        .map((part) => part.text);
      if (textParts?.length > 0) return textParts.join('');
    }
    if (typeof maybeContent === 'object') {
      const text = maybeContent?.text ?? maybeContent?.value ?? '';
      if (typeof text === 'string') return text;
    }
    return String(maybeContent ?? '');
  })();

  // Best-effort enforcement of maxTokens: allow model to limit, but trim if needed
  try {
    const { encode, decode } = await import('gpt-tokenizer');
    const tokens = encode(raw ?? '');
    if (tokens.length <= (maxTokens ?? 0)) return raw ?? '';

    // Middle-out fallback trimming: keep head and tail, elide the middle
    const budget = Math.max(64, maxTokens ?? 256);
    const summaryBudget = Math.max(32, Math.min(96, Math.floor(budget * 0.2)));
    const headBudget = Math.max(1, Math.floor((budget - summaryBudget) / 2));
    const tailBudget = Math.max(1, budget - summaryBudget - headBudget);

    const headTokens = tokens.slice(0, headBudget);
    const tailTokens = tokens.slice(tokens.length - tailBudget);
    const head = decode(headTokens);
    const tail = decode(tailTokens);

    return `${head}\n\n...[compressed]...\n\n${tail}`;
  } catch {
    // If tokenizer unavailable for some reason, fallback to a rough character-based trim
    const safe = raw ?? '';
    return fallbackSummarize(query, safe, maxTokens);
  }
};

/**
 *  Middle-out compression across blocks
 * Determine compressible blocks (non-empty bodies)
 */
const compressContext = async (
  query: string,
  contextStr: string,
  blocks: Block[],
  options: {
    maxTokens: number;
    engine: SkillEngine;
  },
) => {
  const maxTokens = options.maxTokens;
  const engine = options.engine;

  engine.logger.log(
    `Starting context compression for ${query} (${blocks.length} blocks) with maxTokens: ${maxTokens}`,
  );

  const compressibleIndexes = blocks
    .map((b, i) => ({ i, tokens: encode(b.body ?? '').length }))
    .filter((x) => x.tokens > 0)
    .map((x) => x.i);

  if (compressibleIndexes.length === 0) {
    // Nothing to compress structurally; fallback to whole-string fallback summarization
    const trimmed = await fallbackSummarize(query, contextStr, maxTokens);
    return { contextStr: trimmed };
  }

  // Generate middle-out order of indices
  const N = blocks.length;
  const order: number[] = [];
  const center = Math.floor((N - 1) / 2);
  for (let offset = 0; offset < N; offset += 1) {
    const left = center - offset;
    const right = center + offset + (N % 2 === 0 ? 1 : 0);
    if (left >= 0) order.push(left);
    if (right < N) order.push(right);
    if (order.length >= N) break;
  }
  // Keep only compressible ones
  const compressOrder = order.filter((idx) => compressibleIndexes.includes(idx));

  // Iteratively summarize middle blocks until within budget
  const currentBlocks = blocks.map((b) => ({ ...b }));
  let currentStr = renderAll(currentBlocks);
  let currentTokens = encode(currentStr ?? '').length;

  const summarizerModel = engine.chatModel({ temperature: 0, maxTokens }, 'queryAnalysis');

  for (const idx of compressOrder) {
    if (currentTokens <= maxTokens) break;

    const original = currentBlocks[idx];
    const bodyTokens = encode(original?.body ?? '').length;
    if (bodyTokens === 0) continue;

    // Target reduction: shrink this block body to ~30% of its size or a reasonable cap
    const targetBodyBudget = Math.max(64, Math.floor(Math.min(bodyTokens * 0.3, maxTokens * 0.15)));

    const summarized = await summarizer(
      summarizerModel,
      query,
      original?.body ?? '',
      targetBodyBudget,
    );
    currentBlocks[idx] = { ...original, body: summarized ?? '' };

    currentStr = renderAll(currentBlocks);
    currentTokens = encode(currentStr ?? '').length;
  }

  // If still over budget, aggressively trim the entire rendered context with fallback
  if (currentTokens > maxTokens) {
    const trimmed = await fallbackSummarize(query, currentStr, maxTokens);
    return { contextStr: trimmed };
  }

  return { contextStr: currentStr };
};

/**
 * Prepare context from SkillContext into a structured markdown format for LLM consumption
 * Converts user-selected context items into clear markdown structure
 */
export async function prepareContext(
  query: string,
  context: SkillContext,
  options: {
    maxTokens: number;
    engine: SkillEngine;
    summarizerConcurrentLimit?: number;
  },
): Promise<{ contextStr: string }> {
  if (!context) {
    return { contextStr: '' };
  }

  const maxTokens = options?.maxTokens ?? 0;

  const blocks: Block[] = [];
  const sections: string[] = [];

  // Helper to push a rendered section made of blocks
  const pushSection = (sectionTitle: string, items: Block[]) => {
    if (!items?.length) return;
    blocks.push(...items);

    const rendered = items.map((b) => `${b.prefix}${b.body}${b.suffix}`).join('\n\n---\n\n');

    sections.push(`## ${sectionTitle}\n\n${rendered}`);
  };

  // Process user selected content
  if (context?.contentList?.length > 0) {
    const items = (context?.contentList ?? [])
      .map((item) => {
        const metadata = (item?.metadata ?? {}) as Record<string, unknown>;
        const title = (metadata as any)?.title ?? 'Untitled Content';
        const domain = (metadata as any)?.domain ?? 'unknown';
        const entityId = (metadata as any)?.entityId;
        const url = (metadata as any)?.url;

        let sourceInfo = `**Source:** ${domain}`;
        if (entityId) {
          sourceInfo += ` (ID: ${entityId})`;
        }
        if (url) {
          sourceInfo += `\n**URL:** ${url}`;
        }

        const prefix = `### ${title}\n\n${sourceInfo}\n\n`;
        const body = item?.content ?? '';
        const suffix = '';

        return { section: 'User Selected Content', prefix, body, suffix } as Block;
      })
      .filter(Boolean);

    pushSection('User Selected Content', items);
  }

  // Process knowledge base documents
  if (context?.documents?.length > 0) {
    const items = (context?.documents ?? [])
      .filter((item) => item?.document?.content)
      .map((item) => {
        const doc = item?.document;
        const docId = doc?.docId ?? 'unknown';
        const title = doc?.title ?? 'Untitled Document';
        const body = doc?.content ?? '';

        const prefix = `### ${title}\n\n**Document ID:** ${docId}\n\n`;
        const suffix = '';

        return { section: 'Knowledge Base Documents', prefix, body, suffix } as Block;
      });

    pushSection('Knowledge Base Documents', items);
  }

  // Process knowledge base resources
  if (context?.resources?.length > 0) {
    const items = (context?.resources ?? []).map((item) => {
      const resource = item?.resource;
      const resourceId = resource?.resourceId ?? 'unknown';
      const title = resource?.title ?? 'Untitled Resource';
      const body = resource?.content ?? '';
      const resourceType = resource?.resourceType ?? 'unknown';
      const publicUrl = resource?.publicURL;

      const prefix = `### ${title}\n\n**Resource ID:** ${resourceId}\n**Type:** ${resourceType}${publicUrl ? `\n**Public URL:** ${publicUrl}` : ''}\n\n`;
      const suffix = '';

      return { section: 'Knowledge Base Resources', prefix, body, suffix } as Block;
    });

    pushSection('Knowledge Base Resources', items);
  }

  // Process code artifacts
  if (context?.codeArtifacts?.length > 0) {
    const items = (context?.codeArtifacts ?? [])
      .filter((item) => item?.codeArtifact?.content)
      .map((item) => {
        const artifact = item?.codeArtifact;
        const artifactId = artifact?.artifactId ?? 'unknown';
        const title = artifact?.title ?? 'Untitled Code Artifact';
        const body = artifact?.content ?? '';
        const language = artifact?.language ?? 'text';

        const prefix = `### ${title}\n\n**Artifact ID:** ${artifactId}\n**Language:** ${language}\n\n\`\`\`${language}\n`;
        const suffix = '\n```';

        return { section: 'Code Artifacts', prefix, body, suffix } as Block;
      });

    pushSection('Code Artifacts', items);
  }

  // Process media items
  if (context?.mediaList?.length > 0) {
    const items = (context?.mediaList ?? [])
      .map((item) => {
        const entityId = item?.entityId;
        const title = item?.title ?? 'Untitled Media';
        const url = item?.url;
        const mediaType = item?.mediaType;
        const storageKey = item?.storageKey;

        const prefix = `### ${title}\n\n**Media ID:** ${entityId}\n**Type:** ${mediaType}\n**URL:** ${url}\n**Storage Key:** ${storageKey}\n\n`;
        const body = `*Media file: ${title}*`;
        const suffix = '';

        return { section: 'Media Items', prefix, body, suffix } as Block;
      })
      .filter(Boolean);

    pushSection('Media Items', items);
  }

  // Process deprecated URLs (for backward compatibility)
  if (context?.urls?.length > 0) {
    const items = (context?.urls ?? [])
      .map((item) => {
        const url = item?.url;
        const metadata = (item?.metadata ?? {}) as Record<string, unknown>;
        const title = (metadata as any)?.title ?? url ?? 'URL';

        const prefix = `### ${title}\n\n**URL:** ${url}`;
        const body = '';
        const suffix = '';

        return { section: 'URLs', prefix, body, suffix } as Block;
      })
      .filter(Boolean);

    pushSection('URLs', items);
  }

  if (context?.files?.length > 0) {
    const items = (context?.files ?? [])
      .map((item) => {
        const file = item?.file;
        const fileId = file?.fileId ?? 'unknown';
        const title = file?.name ?? 'Untitled File';
        const type = file?.type;

        const prefix = `### ${title}\n\n**File ID:** ${fileId}\n**Type:** ${type}\n\n`;
        const body = file?.content ?? 'Empty';
        const suffix = '';

        return { section: 'Files', prefix, body, suffix } as Block;
      })
      .filter(Boolean);

    pushSection('Files', items);
  }

  if (context?.results?.length > 0) {
    const items = (context?.results ?? []).map((item) => {
      const result = item?.result;
      const resultId = result?.resultId ?? 'unknown';
      const title = result?.title ?? 'Untitled Result';

      const prefix = `### ${title}\n\n**Result ID:** ${resultId}\n\n`;
      const body = result?.steps?.map((step) => step.content).join('\n\n') ?? 'Empty';
      const suffix = ''; // TODO: add products of this action result

      return { section: 'Previous Agent Results', prefix, body, suffix } as Block;
    });

    pushSection('Previous Agent Results', items);
  }

  const contextStr = sections.length > 0 ? `# Context\n\n${sections.join('\n\n')}` : '';

  if (maxTokens <= 0) {
    return { contextStr };
  }

  // If within limit, return directly
  const totalTokens = encode(contextStr ?? '').length;
  if (totalTokens <= maxTokens) {
    return { contextStr };
  }

  return await compressContext(query, contextStr, blocks, options);
}
