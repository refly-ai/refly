/**
 * Live Bedrock repro for Claude Sonnet 5 tool-loop reasoning null text.
 * Usage (from packages/providers):
 *   AWS_* from sts get-session-token
 *   node scripts/bedrock-sonnet5-repro.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';

const require = createRequire(import.meta.url);
// zod is hoisted under pnpm; resolve via a package that depends on it
const z = require(
  require.resolve('zod', {
    paths: [
      path.join(process.cwd(), '../skill-template'),
      path.join(process.cwd(), '../../apps/api'),
      process.cwd(),
    ],
  }),
);

const awsPkg = require.resolve('@langchain/aws/package.json');
const { ChatBedrockConverse } = require(path.join(path.dirname(awsPkg), 'dist/chat_models.js'));
const { convertToConverseMessages } = require(
  path.join(path.dirname(awsPkg), 'dist/utils/message_inputs.js'),
);

function sanitizeReasoningContentBlocks(content) {
  if (!Array.isArray(content)) return content;
  const sanitized = [];
  for (const raw of content) {
    if (!raw || typeof raw !== 'object') {
      sanitized.push(raw);
      continue;
    }
    if (raw.type !== 'reasoning_content') {
      sanitized.push(raw);
      continue;
    }
    if ('redactedContent' in raw && raw.redactedContent != null) {
      sanitized.push(raw);
      continue;
    }
    if (!('reasoningText' in raw) || raw.reasoningText == null) continue;
    const { text, signature } = raw.reasoningText;
    const hasSignature = typeof signature === 'string' && signature.length > 0;
    const normalizedText = text == null ? '' : String(text);
    if (!normalizedText && !hasSignature) continue;
    sanitized.push({
      ...raw,
      type: 'reasoning_content',
      reasoningText: {
        ...raw.reasoningText,
        text: normalizedText,
        ...(signature != null ? { signature: String(signature) } : {}),
      },
    });
  }
  return sanitized;
}

function sanitizeBedrockReplayMessages(messages) {
  return messages.map((message) => {
    if (!AIMessage.isInstance(message) || !Array.isArray(message.content)) return message;
    const prev = message.content;
    const next = sanitizeReasoningContentBlocks(message.content);
    const unchanged = prev.length === next.length && prev.every((b, i) => b === next[i]);
    if (unchanged) return message;
    return new AIMessage({
      content: next,
      tool_calls: message.tool_calls,
      invalid_tool_calls: message.invalid_tool_calls,
      usage_metadata: message.usage_metadata,
      additional_kwargs: message.additional_kwargs,
      response_metadata: message.response_metadata,
      id: message.id,
      name: message.name,
    });
  });
}

function findNullReasoningTextPaths(converseMessages) {
  const paths = [];
  converseMessages.forEach((msg, mi) => {
    msg.content?.forEach((block, bi) => {
      const rt = block?.reasoningContent?.reasoningText;
      if (rt && rt.text == null) {
        paths.push(`messages.${mi}.content.${bi}.reasoningContent.reasoningText.text`);
      }
    });
  });
  return paths;
}

const MODEL = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-5';
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

for (const k of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) {
  if (!process.env[k]) throw new Error(`Missing env ${k}`);
}

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
};

const getTimeTool = new DynamicStructuredTool({
  name: 'get_time',
  description: 'Get the current time in UTC',
  schema: z.object({
    input: z.string().optional().describe('unused'),
  }),
  func: async () => {
    const now = new Date();
    return JSON.stringify({
      status: 'success',
      data: { currentTime: now.toISOString(), timestamp: now.getTime(), timezone: 'UTC' },
      summary: `Successfully retrieved current time: ${now.toISOString()}`,
    });
  },
});

function makeBound() {
  const base = new ChatBedrockConverse({
    model: MODEL,
    region: REGION,
    credentials,
    maxTokens: 1024,
    temperature: undefined,
    supportsToolChoiceValues: ['auto', 'any', 'tool'],
  });
  return base.bindTools([getTimeTool], { tool_choice: 'auto' });
}

function summarizeContent(content) {
  if (typeof content === 'string') return { kind: 'string', len: content.length };
  if (!Array.isArray(content)) return { kind: typeof content };
  return content.map((b) => {
    if (!b || typeof b !== 'object') return b;
    if (b.type === 'reasoning_content') {
      return {
        type: 'reasoning_content',
        textIsNull: b.reasoningText ? b.reasoningText.text == null : null,
        textLen: b.reasoningText?.text?.length ?? null,
        hasSignature: !!b.reasoningText?.signature,
        signatureLen: b.reasoningText?.signature?.length ?? 0,
      };
    }
    if (b.type === 'text') return { type: 'text', len: (b.text || '').length };
    return { type: b.type || Object.keys(b) };
  });
}

async function tryInvoke(bound, messages) {
  try {
    const resp = await bound.invoke(messages);
    return {
      ok: true,
      contentPreview: String(
        typeof resp.content === 'string' ? resp.content : JSON.stringify(resp.content),
      ).slice(0, 400),
    };
  } catch (err) {
    return {
      ok: false,
      name: err?.name,
      message: String(err?.message || err).slice(0, 600),
    };
  }
}

async function main() {
  console.log(JSON.stringify({ phase: 'start', model: MODEL, region: REGION }));

  const bound = makeBound();
  const system = new SystemMessage(
    'You are a helpful assistant. Use the get_time tool when asked about the current time.',
  );
  const human = new HumanMessage('查一下当前时间');

  console.log('--- turn 1 ---');
  const ai1 = await bound.invoke([system, human]);
  console.log(
    JSON.stringify({
      phase: 'turn1',
      contentSummary: summarizeContent(ai1.content),
      toolCalls: (ai1.tool_calls || []).map((t) => ({ id: t.id, name: t.name, args: t.args })),
    }),
  );

  if (!ai1.tool_calls?.length) {
    console.log(
      JSON.stringify({
        phase: 'abort',
        reason: 'no tool calls',
        preview: String(ai1.content).slice(0, 300),
      }),
    );
    process.exit(2);
  }

  const toolMessages = [];
  for (const tc of ai1.tool_calls) {
    const out = await getTimeTool.invoke(tc.args || {});
    toolMessages.push(
      new ToolMessage({
        content: typeof out === 'string' ? out : JSON.stringify(out),
        tool_call_id: tc.id,
        name: tc.name,
      }),
    );
  }

  const loopMessages = [system, human, ai1, ...toolMessages];
  const nullPaths = findNullReasoningTextPaths(
    convertToConverseMessages(loopMessages).converseMessages,
  );
  console.log(
    JSON.stringify({
      phase: 'pre_turn2_payload_check',
      nullReasoningTextPaths: nullPaths,
      assistantContentSummary: summarizeContent(ai1.content),
    }),
  );

  console.log('--- turn 2a RAW ---');
  const rawResult = await tryInvoke(bound, loopMessages);
  console.log(JSON.stringify({ phase: 'turn2_raw', ...rawResult }));

  console.log('--- turn 2b SANITIZED ---');
  const sanitized = sanitizeBedrockReplayMessages(loopMessages);
  const sanNull = findNullReasoningTextPaths(
    convertToConverseMessages(sanitized).converseMessages,
  );
  const sanResult = await tryInvoke(bound, sanitized);
  console.log(
    JSON.stringify({ phase: 'turn2_sanitized', nullPathsAfterSanitize: sanNull, ...sanResult }),
  );

  // Force prod shape using the REAL model signature but strip text field
  // (missing text → AWS SDK serializes null → ValidationException).
  console.log('--- strip-text from live reasoning (prod shape, real signature) ---');
  let strippedAi = ai1;
  if (Array.isArray(ai1.content)) {
    const strippedContent = ai1.content.map((b) => {
      if (!b || b.type !== 'reasoning_content' || !b.reasoningText) return b;
      const { text: _t, ...rest } = b.reasoningText;
      return { ...b, reasoningText: { ...rest } }; // keep signature only
    });
    strippedAi = new AIMessage({
      content: strippedContent,
      tool_calls: ai1.tool_calls,
      invalid_tool_calls: ai1.invalid_tool_calls,
      usage_metadata: ai1.usage_metadata,
      additional_kwargs: ai1.additional_kwargs,
      response_metadata: ai1.response_metadata,
      id: ai1.id,
      name: ai1.name,
    });
  }
  const strippedLoop = [system, human, strippedAi, ...toolMessages];
  const strippedNull = findNullReasoningTextPaths(
    convertToConverseMessages(strippedLoop).converseMessages,
  );
  const strippedRaw = await tryInvoke(bound, strippedLoop);
  const strippedSanMsgs = sanitizeBedrockReplayMessages(strippedLoop);
  const strippedSanNull = findNullReasoningTextPaths(
    convertToConverseMessages(strippedSanMsgs).converseMessages,
  );
  const strippedSan = await tryInvoke(bound, strippedSanMsgs);

  console.log(
    JSON.stringify({
      phase: 'stripped_live_signature',
      strippedContentSummary: summarizeContent(strippedAi.content),
      strippedNull,
      strippedRaw,
      strippedSanNull,
      strippedSan,
    }),
  );

  // Fake signature control (should fail null-check raw; after sanitize may fail signature)
  console.log('--- fake signature-only control ---');
  const fakeAi = new AIMessage({
    content: [
      { type: 'reasoning_content', reasoningText: { signature: 'synthetic-sig-for-repro' } },
    ],
    tool_calls: ai1.tool_calls,
  });
  const fakeLoop = [system, human, fakeAi, ...toolMessages];
  const fakeNull = findNullReasoningTextPaths(
    convertToConverseMessages(fakeLoop).converseMessages,
  );
  const fakeRaw = await tryInvoke(bound, fakeLoop);
  const fakeSan = await tryInvoke(bound, sanitizeBedrockReplayMessages(fakeLoop));
  console.log(JSON.stringify({ phase: 'fake_signature', fakeNull, fakeRaw, fakeSan }));

  const looksProd = (r) =>
    !r.ok && /reasoningContent\.reasoningText\.text|must not be null/i.test(r.message || '');

  const summary = {
    phase: 'summary',
    model: MODEL,
    liveTurn2RawOk: rawResult.ok,
    liveTurn2SanitizedOk: sanResult.ok,
    strippedNullPaths: strippedNull.length > 0,
    strippedRawLooksLikeProdBug: looksProd(strippedRaw),
    strippedSanitizedOk: strippedSan.ok,
    fakeRawLooksLikeProdBug: looksProd(fakeRaw),
    fakeSanitizedClearedNullCheck:
      !looksProd(fakeSan) /* either ok or different error e.g. invalid signature */,
  };

  if (
    summary.strippedRawLooksLikeProdBug &&
    summary.strippedSanitizedOk &&
    summary.liveTurn2SanitizedOk
  ) {
    summary.verdict =
      'FIX_CONFIRMED_ON_REAL_BEDROCK: real-signature stripped-text fails raw with prod error, passes after sanitize';
  } else if (summary.liveTurn2SanitizedOk && summary.strippedSanitizedOk) {
    summary.verdict = 'SANITIZE_OK_ON_REAL_BEDROCK';
  } else {
    summary.verdict = 'UNEXPECTED';
  }

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.strippedSanitizedOk || !summary.liveTurn2SanitizedOk) process.exit(1);
  if (!summary.strippedRawLooksLikeProdBug) {
    console.log(
      JSON.stringify({
        note: 'stripped raw did not hit prod null error; check model/SDK behavior',
      }),
    );
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ phase: 'fatal', message: String(e?.stack || e) }));
  process.exit(1);
});
