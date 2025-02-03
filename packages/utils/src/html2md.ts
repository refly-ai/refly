import { parse } from 'node-html-parser';
import { Readability } from '@mozilla/readability';
import { convertHTMLToMarkdown } from './markdown';

// HTML preprocessing utilities
const cleanHtml = (htmlContent: string): string => {
  let cleanedHtml = htmlContent;

  // Remove all comments
  cleanedHtml = cleanedHtml.replace(/<!--[\s\S]*?-->/g, '');

  // Remove all script and style tags with their content
  cleanedHtml = cleanedHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleanedHtml = cleanedHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove base64 images
  cleanedHtml = cleanedHtml.replace(/<img[^>]+src="data:image\/[^>]+"[^>]*>/g, '');

  // Remove empty tags except for specific ones we want to keep
  const keepTags = ['img', 'br', 'hr'];
  const emptyTagPattern = new RegExp(
    `<(?!(?:${keepTags.join('|')})\b)[^>]+?>[\s\r\n]*</[^>]+?>`,
    'g',
  );
  cleanedHtml = cleanedHtml.replace(emptyTagPattern, '');

  // Clean up excessive whitespace
  cleanedHtml = cleanedHtml.replace(/\s+/g, ' ').trim();

  return cleanedHtml;
};

// Markdown postprocessing utilities
const cleanMarkdown = (markdownContent: string): string => {
  let cleanedMarkdown = markdownContent;

  // Remove multiple consecutive empty lines
  cleanedMarkdown = cleanedMarkdown.replace(/\n{3,}/g, '\n\n');

  // Remove trailing spaces at the end of lines
  cleanedMarkdown = cleanedMarkdown.replace(/[ \t]+$/gm, '');

  // Clean up code blocks (ensure proper spacing)
  cleanedMarkdown = cleanedMarkdown.replace(/```(\w*)\n\n/g, '```$1\n');

  // Remove base64 image markdown
  cleanedMarkdown = cleanedMarkdown.replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g, '');

  // Remove javascript: links
  cleanedMarkdown = cleanedMarkdown.replace(/\[[^\]]*\]\(javascript:[^)]*\)/g, '');
  cleanedMarkdown = cleanedMarkdown.replace(/\(javascript:[^)]*\)/g, '');

  // Remove empty links
  cleanedMarkdown = cleanedMarkdown.replace(/\[([^\]]*)\]\(\s*\)/g, '$1');
  cleanedMarkdown = cleanedMarkdown.replace(/!\[([^\]]*)\]\(\s*\)/g, '');

  // Clean up excessive spaces around bold/italic markers
  cleanedMarkdown = cleanedMarkdown.replace(/\*\s+(\S)/g, '*$1');
  cleanedMarkdown = cleanedMarkdown.replace(/(\S)\s+\*/g, '$1*');

  // Remove zero-width spaces and other invisible characters
  // biome-ignore lint/suspicious/noMisleadingCharacterClass: <explanation>
  cleanedMarkdown = cleanedMarkdown.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

  // Remove empty lines that only contain spaces or special characters
  cleanedMarkdown = cleanedMarkdown.replace(/^\s*[\[\]\(\)\*\-\_\#\~\`]+\s*$/gm, '');

  // Clean up multiple spaces between words
  cleanedMarkdown = cleanedMarkdown.replace(/\s{2,}/g, ' ');

  return cleanedMarkdown.trim();
};

export const removeUnusedHtmlNode = () => {
  const $ = parse(document?.documentElement?.innerHTML);

  for (const item of $.querySelectorAll('style')) {
    item.innerHTML = 'p{color: red;}';
  }
  for (const item of $.querySelectorAll('script')) {
    item.innerHTML = `console.log('script')`;
  }
  for (const item of $.querySelectorAll('link')) {
    item.setAttribute('href', '');
  }
  for (const item of $.querySelectorAll('svg')) {
    item.innerHTML = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="#0077b6" />
</svg>`;
  }
  for (const item of $.querySelectorAll('img')) {
    // Remove base64 images and keep only valid URL images
    const src = item.getAttribute('src') || '';
    if (src.startsWith('data:')) {
      item.remove();
    } else {
      item.setAttribute('all', 'unset');
    }
  }
  for (const item of $.querySelectorAll('plasmo-csui')) {
    item.innerHTML = '<div></div>';
  }

  const commentNodes = $.querySelectorAll('*').filter(
    (node) => node.nodeType === Node.COMMENT_NODE,
  );
  for (const item of commentNodes) {
    item.remove();
  }

  const html = $.innerHTML;
  return cleanHtml(html);
};

export const getReadabilityHtml = (node: Document | HTMLElement | DocumentFragment) => {
  try {
    const parsed = new Readability(node.cloneNode(true) as Document).parse();
    return parsed?.content ? cleanHtml(parsed.content) : removeUnusedHtmlNode();
  } catch (_err) {
    return removeUnusedHtmlNode();
  }
};

export const getReadabilityMarkdown = (element: Document | HTMLElement | DocumentFragment) => {
  const html = getReadabilityHtml(element);
  const md = convertHTMLToMarkdown('render', html);
  return cleanMarkdown(md);
};

export const getMarkdown = (element: Document | HTMLElement | DocumentFragment) => {
  const div = document.createElement('div');
  div.appendChild(element.cloneNode(true));
  const html = cleanHtml(div.innerHTML);
  const md = convertHTMLToMarkdown('render', html);
  return cleanMarkdown(md);
};

export function getSelectionNodesMarkdown() {
  const selection = window.getSelection();
  const range = selection?.getRangeAt(0);
  const text = selection?.toString();

  const fragment = range.cloneRange().cloneContents();
  const mdText = getMarkdown(fragment);

  return mdText || text || ''; // compatible with empty markdown text
}
