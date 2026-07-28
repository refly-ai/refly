import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import {
  findNullReasoningTextPaths,
  sanitizeBedrockReplayMessages,
  sanitizeReasoningContentBlocks,
} from './bedrock-message-sanitize';

// @langchain/aws package exports block deep imports; resolve the on-disk module
// that ChatBedrockConverse uses for Converse payload conversion.
const nodeRequire = createRequire(__filename);
const awsPkgJson = nodeRequire.resolve('@langchain/aws/package.json');
const messageInputsPath = path.join(path.dirname(awsPkgJson), 'dist/utils/message_inputs.js');
if (!fs.existsSync(messageInputsPath)) {
  throw new Error(`Expected langchain aws message_inputs at ${messageInputsPath}`);
}
const { convertToConverseMessages } = nodeRequire(messageInputsPath) as {
  convertToConverseMessages: (messages: unknown[]) => {
    converseMessages: Array<{ role?: string; content?: Array<Record<string, unknown>> }>;
  };
};

/**
 * Builds the exact multi-turn shape that failed in prod:
 * system + human + assistant(tool_use + broken reasoning) + tool result
 *
 * Prod error:
 *   messages.2.member.content.1.member.reasoningContent.reasoningText.text
 *   failed to satisfy constraint: Member must not be null
 */
function buildProdLikeMessages(reasoningBlocks: unknown[]) {
  const assistant = new AIMessage({
    content: reasoningBlocks as AIMessage['content'],
    tool_calls: [
      {
        id: '5db5dbd9-fcde-4d73-83fd-3571077791cf',
        name: 'get_time',
        args: { input: '{}' },
        type: 'tool_call',
      },
    ],
  });

  return [
    new SystemMessage('You are a helpful assistant.'),
    new HumanMessage('查一下当前时间'),
    assistant,
    new ToolMessage({
      content:
        '{"status":"success","data":{"currentTime":"2026-07-27T15:07:04.325Z"},"summary":"ok"}',
      tool_call_id: '5db5dbd9-fcde-4d73-83fd-3571077791cf',
      name: 'get_time',
    }),
  ];
}

function toConversePayload(messages: ReturnType<typeof buildProdLikeMessages>) {
  return convertToConverseMessages(messages).converseMessages;
}

describe('Bedrock Sonnet 5 tool-loop reasoning replay (prod regression)', () => {
  it('reproduces null reasoningText.text for signature-only reasoning blocks', () => {
    // Stream path in @langchain/aws emits signature-only partials as:
    //   { type: 'reasoning_content', reasoningText: { signature } }
    // with no text field. Concatenation keeps signature without text.
    // This is the exact Bedrock ValidationException condition from prod.
    const messages = buildProdLikeMessages([
      {
        type: 'reasoning_content',
        reasoningText: { signature: 'sig-abc-from-sonnet-5' },
      },
    ]);

    const payload = toConversePayload(messages);
    const nullPaths = findNullReasoningTextPaths(payload);

    expect(nullPaths.length).toBeGreaterThan(0);
    expect(nullPaths[0]).toMatch(
      /messages\.\d+\.content\.\d+\.reasoningContent\.reasoningText\.text/,
    );
  });

  it('after sanitize, converse payload never has null reasoningText.text (signature-only)', () => {
    const raw = buildProdLikeMessages([
      {
        type: 'reasoning_content',
        reasoningText: { signature: 'sig-abc-from-sonnet-5' },
      },
    ]);

    // Unsanitized still reproduces the bug
    expect(findNullReasoningTextPaths(toConversePayload(raw)).length).toBeGreaterThan(0);

    const sanitized = sanitizeBedrockReplayMessages(raw);
    const payload = toConversePayload(sanitized as typeof raw);

    expect(findNullReasoningTextPaths(payload)).toEqual([]);

    // reasoning block kept with coerced empty text + original signature
    const assistant = payload.find((m) => m.role === 'assistant');
    const reasoning = assistant?.content?.find((b) => 'reasoningContent' in b) as {
      reasoningContent?: { reasoningText?: { text?: string; signature?: string } };
    };
    expect(reasoning?.reasoningContent?.reasoningText?.text).toBe('');
    expect(reasoning?.reasoningContent?.reasoningText?.signature).toBe('sig-abc-from-sonnet-5');

    // toolUse still present on the assistant turn
    expect(assistant?.content?.some((b) => 'toolUse' in b)).toBe(true);
  });

  it('coerces explicit null text before conversion (defense in depth)', () => {
    // langchain concatenate already turns text:null into "", but we still normalize.
    const content = sanitizeReasoningContentBlocks([
      {
        type: 'reasoning_content',
        reasoningText: { text: null, signature: 'sig-null-text' },
      },
    ]) as Array<{ reasoningText: { text: string; signature: string } }>;

    expect(content[0].reasoningText.text).toBe('');
    expect(content[0].reasoningText.signature).toBe('sig-null-text');
  });

  it('preserves valid reasoning text + signature pairs', () => {
    const raw = buildProdLikeMessages([
      {
        type: 'reasoning_content',
        reasoningText: { text: 'I should call get_time', signature: 'sig-ok' },
      },
    ]);

    const sanitized = sanitizeBedrockReplayMessages(raw);
    const ai = sanitized.find((m) => AIMessage.isInstance(m)) as AIMessage;
    const block = (ai.content as Array<Record<string, unknown>>)[0] as {
      reasoningText: { text: string; signature: string };
    };
    expect(block.reasoningText.text).toBe('I should call get_time');
    expect(block.reasoningText.signature).toBe('sig-ok');

    // Valid pairs must not introduce null paths either
    expect(findNullReasoningTextPaths(toConversePayload(sanitized as typeof raw))).toEqual([]);
  });

  it('drops empty reasoning shells with neither text nor signature', () => {
    const content = sanitizeReasoningContentBlocks([
      { type: 'reasoning_content', reasoningText: {} },
      { type: 'reasoning_content', reasoningText: { text: null } },
      { type: 'text', text: 'hello' },
    ]) as Array<Record<string, unknown>>;

    expect(content).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('keeps tool_calls on sanitized AIMessage', () => {
    const raw = buildProdLikeMessages([
      { type: 'reasoning_content', reasoningText: { signature: 'sig' } },
    ]);
    const sanitized = sanitizeBedrockReplayMessages(raw);
    const ai = sanitized.find((m) => AIMessage.isInstance(m)) as AIMessage;
    expect(ai.tool_calls?.[0]?.name).toBe('get_time');
    expect(ai.tool_calls?.[0]?.id).toBe('5db5dbd9-fcde-4d73-83fd-3571077791cf');
  });

  it('is idempotent', () => {
    const raw = buildProdLikeMessages([
      { type: 'reasoning_content', reasoningText: { signature: 'sig' } },
    ]);
    const once = sanitizeBedrockReplayMessages(raw);
    const twice = sanitizeBedrockReplayMessages(once);
    expect(findNullReasoningTextPaths(toConversePayload(twice as typeof raw))).toEqual([]);
  });
});
