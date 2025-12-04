import path from 'node:path';

/**
 * Markdown file extensions
 */
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd']);

/**
 * Markdown MIME types
 */
const MARKDOWN_MIME_TYPES = new Set(['text/markdown', 'text/x-markdown']);

/**
 * HTML file extensions
 */
const HTML_EXTENSIONS = new Set(['.html', '.htm', '.xhtml']);

/**
 * HTML MIME types
 */
const HTML_MIME_TYPES = new Set(['text/html', 'application/xhtml+xml']);

/**
 * SVG file extensions
 */
const SVG_EXTENSIONS = new Set(['.svg']);

/**
 * SVG MIME types
 */
const SVG_MIME_TYPES = new Set(['image/svg+xml']);

/**
 * Check if a file is a markdown file based on filename extension or MIME type
 * @param filename - File name with extension
 * @param contentType - MIME type of the file
 * @returns true if the file is markdown
 */
export function isMarkdownFile(filename: string, contentType: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  const normalizedContentType = contentType.toLowerCase();

  return (
    MARKDOWN_EXTENSIONS.has(ext) ||
    MARKDOWN_MIME_TYPES.has(normalizedContentType) ||
    normalizedContentType.includes('markdown')
  );
}

/**
 * Check if a file is an HTML file based on filename extension or MIME type
 * @param filename - File name with extension
 * @param contentType - MIME type of the file
 * @returns true if the file is HTML
 */
export function isHtmlFile(filename: string, contentType: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  const normalizedContentType = contentType.toLowerCase();

  return (
    HTML_EXTENSIONS.has(ext) ||
    HTML_MIME_TYPES.has(normalizedContentType) ||
    normalizedContentType.includes('html')
  );
}

/**
 * Check if a file is an SVG file based on filename extension or MIME type
 * @param filename - File name with extension
 * @param contentType - MIME type of the file
 * @returns true if the file is SVG
 */
export function isSvgFile(filename: string, contentType: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  const normalizedContentType = contentType.toLowerCase();

  return (
    SVG_EXTENSIONS.has(ext) ||
    SVG_MIME_TYPES.has(normalizedContentType) ||
    normalizedContentType.includes('svg')
  );
}

/**
 * Check if a file content may contain embeddable links (markdown, HTML, or SVG)
 * @param filename - File name with extension
 * @param contentType - MIME type of the file
 * @returns true if the file may contain embeddable links
 */
export function isEmbeddableLinkFile(filename: string, contentType: string): boolean {
  return (
    isMarkdownFile(filename, contentType) ||
    isHtmlFile(filename, contentType) ||
    isSvgFile(filename, contentType)
  );
}
