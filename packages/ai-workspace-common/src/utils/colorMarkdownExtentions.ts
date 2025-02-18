import { Extension } from '@tiptap/core';
export const ColorMarkdownExtension = Extension.create({
  name: 'colorMarkdown',

  addStorage() {
    return {
      transformers: {
        markdownToHTML: [
          {
            regexp: /\{color:(#[0-9a-fA-F]{6}|[a-zA-Z]+)\}(.*?)\{\/color\}/g,
            transform: (_: string, color: string, content: string) => {
              return `<span style="color: ${color}">${content}</span>`;
            },
          },
        ],
        HTMLToMarkdown: [
          {
            regexp: /<span style="color: ([^"]+)">(.*?)<\/span>/g,
            transform: (_: string, color: string, content: string) => {
              return `{color:${color}}${content}{/color}`;
            },
          },
        ],
      },
    };
  },
});
