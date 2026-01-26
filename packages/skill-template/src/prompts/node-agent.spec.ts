import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildNodeAgentSystemPrompt } from './node-agent';
import { PtcContext } from '../base';

describe('buildNodeAgentSystemPrompt', () => {
  it('should render default prompt when ptc is disabled', () => {
    const prompt = buildNodeAgentSystemPrompt({ ptcEnabled: false });

    // Check if it contains basic identity info
    expect(prompt).toContain('You are the Node Agent of Refly.ai');

    // Check that PTC section is NOT present
    expect(prompt).not.toContain('PTC Mode: Specialized SDK Tools');
  });

  it('should render ptc section and partial when ptc is enabled', () => {
    const falImageDoc = fs.readFileSync(path.join(__dirname, 'fixtures/fal_image.md'), 'utf-8');
    const nanoBananaDoc = fs.readFileSync(path.join(__dirname, 'fixtures/nano_banana.md'), 'utf-8');

    const mockPtcContext: PtcContext = {
      toolsets: [
        { id: '1', name: 'Fal Image', key: 'fal_image' },
        { id: '2', name: 'Nano Banana', key: 'nano_banana' },
      ],
      sdk: {
        pathPrefix: '',
        codes: [],
        docs: [
          {
            toolsetKey: 'fal_image',
            path: 'docs/fal_image.md',
            content: falImageDoc,
          },
          {
            toolsetKey: 'nano_banana',
            path: 'docs/nano_banana.md',
            content: nanoBananaDoc,
          },
        ],
      },
    };

    const prompt = buildNodeAgentSystemPrompt({
      ptcEnabled: true,
      ptcContext: mockPtcContext,
    });

    // Should still contain basic identity
    expect(prompt).toContain('You are the Node Agent of Refly.ai');

    // Should contain PTC section from partial
    expect(prompt).toContain('## PTC Mode: Specialized SDK Tools');

    // Should list available toolsets
    expect(prompt).toContain('- fal_image');
    expect(prompt).toContain('- nano_banana');

    // Should contain SDK documentation from files
    expect(prompt).toContain('#### fal_image.py');
    expect(prompt).toContain('#### nano_banana.py');
    expect(prompt).toContain('flux_image_to_image');
    expect(prompt).toContain('flux_text_to_image');
    expect(prompt).toContain('generate_image');
  });

  it('should handle missing ptcContext gracefully', () => {
    const prompt = buildNodeAgentSystemPrompt({ ptcEnabled: true });
    expect(prompt).toContain('PTC Mode: Specialized SDK Tools');
    expect(prompt).toContain('### Available SDK Toolsets');

    // Check that there are no toolsets listed after the header
    const toolsetsSection = prompt.split('### Available SDK Toolsets')[1];
    const firstPartOfSection = toolsetsSection.split('### Available SDK Documentation')[0];
    expect(firstPartOfSection.trim()).toBe('');
  });
});
