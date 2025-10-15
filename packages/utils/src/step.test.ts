import { describe, it, expect } from 'vitest';
import { mergeStepsByName, mergeActionResults, sortSteps } from './step';
import type { ActionStep, ActionResult } from '@refly/openapi-schema';

describe('step utilities', () => {
  describe('mergeStepsByName', () => {
    it('should return empty array when both inputs are empty', () => {
      const result = mergeStepsByName([], []);
      expect(result).toEqual([]);
    });

    it('should return new steps when old steps are empty', () => {
      const newSteps: ActionStep[] = [
        { name: 'step1', content: 'content1' },
        { name: 'step2', content: 'content2' },
      ];
      const result = mergeStepsByName(undefined, newSteps);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('step1');
      expect(result[0].content).toBe('content1');
      expect(result[1].name).toBe('step2');
      expect(result[1].content).toBe('content2');
      // Function adds default fields
      expect(result[0].artifacts).toEqual([]);
      expect(result[0].logs).toEqual([]);
      expect(result[0].structuredData).toEqual({});
    });

    it('should return old steps when new steps are empty', () => {
      const oldSteps: ActionStep[] = [
        { name: 'step1', content: 'content1' },
        { name: 'step2', content: 'content2' },
      ];
      const result = mergeStepsByName(oldSteps, undefined);
      expect(result).toEqual(oldSteps);
    });

    it('should merge steps by name, keeping longer content', () => {
      const oldSteps: ActionStep[] = [
        { name: 'step1', content: 'short', reasoningContent: 'short reason' },
        { name: 'step2', content: 'old content' },
      ];
      const newSteps: ActionStep[] = [
        { name: 'step1', content: 'longer content', reasoningContent: 'longer reasoning content' },
        { name: 'step3', content: 'new step' },
      ];

      const result = mergeStepsByName(oldSteps, newSteps);

      expect(result).toHaveLength(3);
      expect(result.find((s) => s.name === 'step1')?.content).toBe('longer content');
      expect(result.find((s) => s.name === 'step1')?.reasoningContent).toBe(
        'longer reasoning content',
      );
      expect(result.find((s) => s.name === 'step2')?.content).toBe('old content');
      expect(result.find((s) => s.name === 'step3')?.content).toBe('new step');
    });

    it('should merge artifacts by entityId', () => {
      const oldSteps: ActionStep[] = [
        {
          name: 'step1',
          artifacts: [
            { entityId: 'id1', title: 'old title' },
            { entityId: 'id2', title: 'artifact2' },
          ] as any[],
        },
      ];
      const newSteps: ActionStep[] = [
        {
          name: 'step1',
          artifacts: [
            { entityId: 'id1', title: 'new title' },
            { entityId: 'id3', title: 'artifact3' },
          ] as any[],
        },
      ];

      const result = mergeStepsByName(oldSteps, newSteps);

      expect(result).toHaveLength(1);
      const step = result[0];
      expect(step.artifacts).toHaveLength(3);
      expect(step.artifacts?.find((a: any) => a.entityId === 'id1')?.title).toBe('new title');
      expect(step.artifacts?.find((a: any) => a.entityId === 'id2')?.title).toBe('artifact2');
      expect(step.artifacts?.find((a: any) => a.entityId === 'id3')?.title).toBe('artifact3');
    });

    it('should aggregate token usage', () => {
      const oldSteps: ActionStep[] = [
        {
          name: 'step1',
          tokenUsage: [{ modelName: 'gpt-4', inputTokens: 100, outputTokens: 50 }] as any[],
        },
      ];
      const newSteps: ActionStep[] = [
        {
          name: 'step1',
          tokenUsage: [{ modelName: 'gpt-4', inputTokens: 200, outputTokens: 75 }] as any[],
        },
      ];

      const result = mergeStepsByName(oldSteps, newSteps);

      expect(result).toHaveLength(1);
      const step = result[0];
      expect(step.tokenUsage).toHaveLength(1);
      expect(step.tokenUsage?.[0].inputTokens).toBe(300);
      expect(step.tokenUsage?.[0].outputTokens).toBe(125);
    });

    it('should maintain original order when possible', () => {
      const oldSteps: ActionStep[] = [
        { name: 'step1', content: 'content1' },
        { name: 'step2', content: 'content2' },
        { name: 'step3', content: 'content3' },
      ];
      const newSteps: ActionStep[] = [
        { name: 'step1', content: 'updated content1' },
        { name: 'step4', content: 'content4' },
      ];

      const result = mergeStepsByName(oldSteps, newSteps);

      expect(result.map((s) => s.name)).toEqual(['step1', 'step2', 'step3', 'step4']);
    });
  });

  describe('mergeActionResults', () => {
    it('should merge partial action result into existing result', () => {
      const oldResult: ActionResult = {
        resultId: 'test-id',
        version: 1,
        status: 'executing',
        title: 'Old Title',
        steps: [{ name: 'step1', content: 'old content' }],
      };

      const incoming: Partial<ActionResult> = {
        version: 2,
        status: 'finish',
        title: 'New Title',
        steps: [
          { name: 'step1', content: 'new content' },
          { name: 'step2', content: 'step2 content' },
        ],
      };

      const result = mergeActionResults(oldResult, incoming);

      expect(result.resultId).toBe('test-id');
      expect(result.version).toBe(2);
      expect(result.status).toBe('finish');
      expect(result.title).toBe('New Title');
      expect(result.steps).toHaveLength(2);
    });

    it('should keep higher version number', () => {
      const oldResult: ActionResult = {
        resultId: 'test-id',
        version: 3,
        status: 'executing',
      };

      const incoming: Partial<ActionResult> = {
        version: 5,
        status: 'finish',
      };

      const result = mergeActionResults(oldResult, incoming);

      expect(result.version).toBe(5);
      expect(result.status).toBe('finish');
    });

    it('should keep old status when version matches and status is finish/failed', () => {
      const oldResult: ActionResult = {
        resultId: 'test-id',
        version: 5,
        status: 'finish' as const,
      };

      const incoming: Partial<ActionResult> = {
        version: 5,
        status: 'executing' as const,
      };

      const result = mergeActionResults(oldResult, incoming);

      expect(result.status).toBe('finish');
    });

    it('should merge arrays by concatenation', () => {
      const oldResult: ActionResult = {
        resultId: 'test-id',
        version: 1,
        errors: ['error1'],
        toolsets: [{ type: 'regular', id: 'tool1', name: 'tool1' }],
        history: [{ resultId: 'hist1', version: 1 }],
      };

      const incoming: Partial<ActionResult> = {
        errors: ['error2'],
        toolsets: [{ type: 'regular', id: 'tool2', name: 'tool2' }],
        history: [{ resultId: 'hist2', version: 1 }],
      };

      const result = mergeActionResults(oldResult, incoming);

      expect(result.errors).toEqual(['error1', 'error2']);
      expect(result.toolsets).toHaveLength(2);
      expect(result.history).toHaveLength(2);
    });

    it('should handle undefined old result', () => {
      const incoming: Partial<ActionResult> = {
        resultId: 'test-id',
        version: 1,
        status: 'finish',
        title: 'New Title',
      };

      const result = mergeActionResults(undefined, incoming);

      expect(result.resultId).toBe('test-id');
      expect(result.version).toBe(1);
      expect(result.status).toBe('finish');
      expect(result.title).toBe('New Title');
    });
  });

  describe('sortSteps', () => {
    it('should sort steps by predefined order', () => {
      const steps: ActionStep[] = [
        { name: 'answerQuestion' },
        { name: 'generateDocument' },
        { name: 'analyzeQuery' },
        { name: 'webSearch' },
      ];

      const result = sortSteps(steps);

      expect(result.map((s) => s.name)).toEqual([
        'analyzeQuery',
        'webSearch',
        'generateDocument',
        'answerQuestion',
      ]);
    });

    it('should sort known steps by order and keep unknown steps in relative order', () => {
      const steps: ActionStep[] = [
        { name: 'unknownStep' },
        { name: 'analyzeQuery' },
        { name: 'anotherUnknown' },
        { name: 'webSearch' },
      ];

      const result = sortSteps(steps);

      expect(result.map((s) => s.name)).toEqual([
        'unknownStep', // order: 0 (unknown), first in input
        'analyzeQuery', // order: 0 (known)
        'anotherUnknown', // order: 0 (unknown), third in input
        'webSearch', // order: 15
      ]);
    });
  });
});
