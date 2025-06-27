import { Injectable, Logger } from '@nestjs/common';
import { genImageID } from '@refly/utils';

@Injectable()
export class ImageProcessor {
  private logger = new Logger(ImageProcessor.name);

  async generateImage(prompt: string, config: Record<string, any>, genId?: string): Promise<any> {
    // 原有图像生成skill部分核心逻辑
    const apiUrl = config.apiUrl || 'https://api.tu-zi.com/v1/chat/completions';
    const apiKey = config.apiKey;
    const ratio = config.imageRatio || '1:1';
    const model = config.model || 'gpt-4o-image-vip';

    if (!apiKey) {
      throw new Error('API key is required for image generation');
    }

    const jsonConfig = {
      prompt,
      ratio,
      ...(genId && { gen_id: genId }),
    };

    const messages = [
      {
        role: 'user',
        content: `\`\`\`\n${JSON.stringify(jsonConfig, null, 2)}\n\`\`\``,
      },
    ];

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        stream: true,
        model,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Image generation failed: ${response.status}`);
    }

    // 处理流式响应，提取图像URL和gen_id
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Unable to read response stream');
    }

    const decoder = new TextDecoder();
    let fullResponse = '';
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;

      if (!done && result.value) {
        const chunk = decoder.decode(result.value, { stream: true });
        fullResponse += chunk;
      }
    }

    // 提取图像URL和gen_id
    const urlMatch = fullResponse.match(/!\[.*?\]\((https:\/\/.*?)\)/);
    const genIdMatch = fullResponse.match(/gen_id:\s*[`'"]([^`'"]+)[`'"]/);

    if (!urlMatch?.[1]) {
      throw new Error('No image URL found in response');
    }

    return {
      imageUrl: urlMatch[1],
      genId: genIdMatch?.[1] || genImageID(),
      fullResponse,
    };
  }
}
