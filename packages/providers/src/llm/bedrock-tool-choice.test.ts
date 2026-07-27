import { describe, expect, it } from 'vitest';
import { resolveBedrockToolChoiceValues } from './index';

/**
 * Mirrors @langchain/aws@1.1.0 supportedToolChoiceValuesForModel.
 * Kept inline so the regression stays visible if langchain is upgraded.
 */
function langchainInferredToolChoiceValues(
  model: string,
): Array<'auto' | 'any' | 'tool'> | undefined {
  if (
    model.includes('claude-3') ||
    model.includes('claude-4') ||
    model.includes('claude-opus-4') ||
    model.includes('claude-sonnet-4')
  ) {
    return ['auto', 'any', 'tool'];
  }
  if (model.includes('mistral-large')) {
    return ['auto', 'any'];
  }
  return undefined;
}

function assertToolChoiceAllowed(
  model: string,
  toolChoiceType: 'auto' | 'any' | 'tool',
  supportsToolChoiceValues?: Array<'auto' | 'any' | 'tool'>,
): void {
  const values = supportsToolChoiceValues ?? [];
  if (!values.includes(toolChoiceType)) {
    throw new Error(
      values.length
        ? `Model ${model} does not currently support 'tool_choice' of type ${toolChoiceType}.`
        : `Model ${model} does not currently support 'tool_choice'.`,
    );
  }
}

const CLAUDE_MODELS = [
  'global.anthropic.claude-opus-5',
  'global.anthropic.claude-sonnet-5',
  'global.anthropic.claude-opus-4-8',
  'global.anthropic.claude-opus-4-7',
];

describe('resolveBedrockToolChoiceValues', () => {
  it.each(CLAUDE_MODELS)('enables tool_choice for %s', (modelId) => {
    expect(resolveBedrockToolChoiceValues(modelId)).toEqual(['auto', 'any', 'tool']);
  });

  it('respects explicit supportToolChoice=false', () => {
    expect(resolveBedrockToolChoiceValues('global.anthropic.claude-opus-5', false)).toBeUndefined();
  });

  it('returns undefined for unknown models', () => {
    expect(resolveBedrockToolChoiceValues('amazon.titan-text-express-v1')).toBeUndefined();
  });
});

describe('Claude 5 tool_choice regression vs langchain inference', () => {
  it('langchain inference rejects Claude 5 (prod failure mode)', () => {
    for (const model of ['global.anthropic.claude-opus-5', 'global.anthropic.claude-sonnet-5']) {
      expect(langchainInferredToolChoiceValues(model)).toBeUndefined();
      expect(() => assertToolChoiceAllowed(model, 'auto')).toThrow(
        /does not currently support 'tool_choice'/,
      );
    }
  });

  it('langchain inference still accepts Claude 4.x', () => {
    expect(langchainInferredToolChoiceValues('global.anthropic.claude-opus-4-8')).toEqual([
      'auto',
      'any',
      'tool',
    ]);
  });

  it.each(['global.anthropic.claude-opus-5', 'global.anthropic.claude-sonnet-5'])(
    'override allows tool_choice for %s',
    (modelId) => {
      const override = resolveBedrockToolChoiceValues(modelId);
      expect(() => assertToolChoiceAllowed(modelId, 'auto', override)).not.toThrow();
    },
  );
});
