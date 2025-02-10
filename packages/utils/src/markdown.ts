import { tables } from 'turndown-plugin-gfm';
import TurndownService from 'turndown';

export type FormatMode =
  | 'render' // For markdown rendering
  | 'ingest' // For consumption by LLMs
  | 'vanilla'; // Without any processing;

export function tidyMarkdown(markdown: string): string {
  // Step 1: Handle complex broken links with text and optional images spread across multiple lines
  let normalizedMarkdown = markdown.replace(
    /\[\s*([^\]\n]+?)\s*\]\s*\(\s*([^)]+)\s*\)/g,
    (_match, text, url) => {
      const cleanText = text.replace(/\s+/g, ' ').trim();
      const cleanUrl = url.replace(/\s+/g, '').trim();
      return `[${cleanText}](${cleanUrl})`;
    },
  );

  normalizedMarkdown = normalizedMarkdown.replace(
    /\[\s*([^\]\n!]*?)\s*\n*(?:!\[([^\]]*)\]\((.*?)\))?\s*\n*\]\s*\(\s*([^)]+)\s*\)/g,
    (_match, text, alt, imgUrl, linkUrl) => {
      const cleanText = text.replace(/\s+/g, ' ').trim();
      const cleanAlt = alt ? alt.replace(/\s+/g, ' ').trim() : '';
      const cleanImgUrl = imgUrl ? imgUrl.replace(/\s+/g, '').trim() : '';
      const cleanLinkUrl = linkUrl.replace(/\s+/g, '').trim();
      if (cleanImgUrl) {
        return `[${cleanText} ![${cleanAlt}](${cleanImgUrl})](${cleanLinkUrl})`;
      }
      return `[${cleanText}](${cleanLinkUrl})`;
    },
  );

  // Step 2: Normalize regular links that may be broken across lines
  normalizedMarkdown = normalizedMarkdown.replace(
    /\[\s*([^\]]+)\]\s*\(\s*([^)]+)\)/g,
    (_match, text, url) => {
      const cleanText = text.replace(/\s+/g, ' ').trim();
      const cleanUrl = url.replace(/\s+/g, '').trim();
      return `[${cleanText}](${cleanUrl})`;
    },
  );

  // Step 3: Remove leading spaces from each line
  normalizedMarkdown = normalizedMarkdown.replace(/^[ \t]+/gm, '');

  // Step 4: Replace more than two consecutive empty lines with exactly two empty lines
  normalizedMarkdown = normalizedMarkdown.replace(/\n{3,}/g, '\n\n');

  return normalizedMarkdown.trim();
}

const getTurndown = (mode: FormatMode) => {
  const turnDownService = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });
  if (mode === 'render') {
    turnDownService.addRule('remove-irrelevant', {
      filter: ['meta', 'style', 'script', 'noscript', 'link', 'textarea'],
      replacement: () => '',
    });
  } else if (mode === 'ingest') {
    turnDownService.addRule('remove-irrelevant', {
      filter: ['meta', 'style', 'script', 'noscript', 'link', 'textarea', 'img'],
      replacement: () => '',
    });
    turnDownService.addRule('unlink', {
      filter: ['a'],
      replacement: (_content, node) => node.textContent,
    });
  }

  return turnDownService;
};

export const convertHTMLToMarkdown = (mode: FormatMode, html: string): string => {
  const turnDownPlugins = [tables];
  const toBeTurnedToMd = html;
  let turnDownService = getTurndown(mode);
  for (const plugin of turnDownPlugins) {
    turnDownService = turnDownService.use(plugin);
  }

  let contentText = '';
  if (toBeTurnedToMd) {
    try {
      contentText = turnDownService.turndown(toBeTurnedToMd).trim();
    } catch (err) {
      console.error(`Turndown failed to run, retrying without plugins: ${err}`);
      const vanillaTurnDownService = getTurndown('vanilla');
      try {
        contentText = vanillaTurnDownService.turndown(toBeTurnedToMd).trim();
      } catch (err2) {
        console.error(`Turndown failed to run, giving up: ${err2}`);
      }
    }
  }

  if (
    !contentText ||
    (contentText.startsWith('<') && contentText.endsWith('>') && toBeTurnedToMd !== html)
  ) {
    try {
      contentText = turnDownService.turndown(html);
    } catch (err) {
      console.warn('Turndown failed to run, retrying without plugins', { err });
      const vanillaTurnDownService = getTurndown('vanilla');
      try {
        contentText = vanillaTurnDownService.turndown(html);
      } catch (err2) {
        console.warn('Turndown failed to run, giving up', { err: err2 });
      }
    }
  }

  return tidyMarkdown(contentText || '').trim();
};
