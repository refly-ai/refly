// @ts-ignore
import MarkdownIt from 'markdown-it';
import Token from './token';
import { MarkdownParser } from 'prosemirror-markdown';
import { schema } from './schema';

function listIsTight(tokens: readonly any[], i: number) {
  // biome-ignore lint/style/noParameterAssign: using param assign is cleaner
  while (++i < tokens.length) if (tokens[i].type !== 'listItem_open') return tokens[i].hidden;
  return false;
}

// Configure markdown-it with tables plugin
const md = MarkdownIt();

// Enable tables with block-level content in cells
// This is a custom modification to the default markdown-it table parser
// that allows block-level content in table cells

// Process tokens to convert inline content in table cells to block content
md.core.ruler.push('table_block_cells', (state) => {
  const tokens = state.tokens;

  for (let i = 0; i < tokens.length; i++) {
    // Find table cell tokens
    if (tokens[i].type === 'td_open' || tokens[i].type === 'th_open') {
      // Check if the next token is inline
      if (i + 1 < tokens.length && tokens[i + 1].type === 'inline') {
        // Create a new paragraph_open token
        const paragraphOpen = new Token('paragraph_open', 'p', 1);

        // Get the inline token
        const inlineToken = tokens[i + 1];

        // Create a paragraph_close token
        const paragraphClose = new Token('paragraph_close', 'p', -1);

        // Replace the inline token with paragraph_open, inline, paragraph_close
        tokens.splice(i + 1, 1, paragraphOpen, inlineToken, paragraphClose);

        // Skip the tokens we just added
        i += 2;
      }
    }
  }

  return true;
});

/// A parser parsing unextended [CommonMark](http://commonmark.org/),
/// without inline HTML, and producing a document in the basic schema.
export const defaultMarkdownParser = new MarkdownParser(schema, md, {
  blockquote: { block: 'blockquote' },
  paragraph: { block: 'paragraph' },
  list_item: { block: 'listItem' },
  bullet_list: {
    block: 'bulletList',
    getAttrs: (_, tokens, i) => ({ tight: listIsTight(tokens, i) }),
  },
  ordered_list: {
    block: 'orderedList',
    getAttrs: (tok, tokens, i) => ({
      order: +tok.attrGet('start')! || 1,
      tight: listIsTight(tokens, i),
    }),
  },
  task_item: { block: 'taskItem' },
  task_list: {
    block: 'taskList',
    getAttrs: (_, tokens, i) => ({ tight: listIsTight(tokens, i) }),
  },
  heading: {
    block: 'heading',
    getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
  },
  code_block: { block: 'codeBlock', noCloseToken: true },
  fence: {
    block: 'codeBlock',
    getAttrs: (tok) => ({ params: tok.info || '' }),
    noCloseToken: true,
  },
  hr: { node: 'horizontalRule' },
  image: {
    node: 'image',
    getAttrs: (tok) => ({
      src: tok.attrGet('src'),
      title: tok.attrGet('title') || null,
      alt: tok.children?.[0]?.content || null,
      width: tok.attrGet('width') || null,
      height: tok.attrGet('height') || null,
    }),
  },
  hardbreak: { node: 'hardBreak' },

  table: {
    block: 'table',
    getAttrs: (tok) => {
      const style = tok.attrGet('style');
      return {
        align: style?.match(/text-align:\s*(left|right|center)/)?.[1] ?? null,
      };
    },
  },
  tr: {
    block: 'tableRow',
    getAttrs: (tok) => {
      const style = tok.attrGet('style');
      return {
        align: style?.match(/text-align:\s*(left|right|center)/)?.[1] ?? null,
      };
    },
  },
  td: {
    block: 'tableCell',
    getAttrs: (tok) => {
      const style = tok.attrGet('style');
      const align = style?.match(/text-align:\s*(left|right|center)/)?.[1] ?? null;
      return {
        header: false,
        align,
        colspan: +(tok.attrGet('colspan') ?? 1),
        rowspan: +(tok.attrGet('rowspan') ?? 1),
      };
    },
  },
  th: {
    block: 'tableHeader',
    getAttrs: (tok) => {
      const style = tok.attrGet('style');
      const align = style?.match(/text-align:\s*(left|right|center)/)?.[1] ?? null;
      return {
        header: true,
        align,
        colspan: +(tok.attrGet('colspan') ?? 1),
        rowspan: +(tok.attrGet('rowspan') ?? 1),
      };
    },
  },
  thead: {
    ignore: true,
  },
  tbody: {
    ignore: true,
  },

  em: {
    mark: 'italic',
    getAttrs: (_tok) => {
      if (!schema.marks.italic) {
        console.error('Italic mark not found in schema');
        return null;
      }
      return {};
    },
  },
  strong: {
    mark: 'bold',
    getAttrs: (_tok) => {
      if (!schema.marks.bold) {
        console.error('Bold mark not found in schema');
        return null;
      }
      return {};
    },
  },
  strike: {
    mark: 'strike',
    getAttrs: (_tok) => {
      if (!schema.marks.strike) {
        console.error('Strike mark not found in schema');
        return null;
      }
      return {};
    },
  },
  link: {
    mark: 'link',
    getAttrs: (tok) => {
      if (!schema.marks.link) {
        console.error('Link mark not found in schema');
        return null;
      }
      return {
        href: tok.attrGet('href'),
        title: tok.attrGet('title') || null,
      };
    },
  },
  code_inline: {
    mark: 'code',
    getAttrs: (_tok) => {
      if (!schema.marks.code) {
        console.error('Code mark not found in schema');
        return null;
      }
      return {};
    },
    noCloseToken: true,
  },
});

export { MarkdownParser };
