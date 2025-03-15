// @ts-ignore
import MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token.mjs';
import { MarkdownParser } from 'prosemirror-markdown';
import { schema } from './schema';

function listIsTight(tokens: readonly Token[], i: number) {
  // biome-ignore lint/style/noParameterAssign: using param assign is cleaner
  while (++i < tokens.length) if (tokens[i].type !== 'listItem_open') return tokens[i].hidden;
  return false;
}

/// A parser parsing unextended [CommonMark](http://commonmark.org/),
/// without inline HTML, and producing a document in the basic schema.
export const defaultMarkdownParser = new MarkdownParser(
  schema,
  MarkdownIt('commonmark', { html: false }),
  {
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
  },
);

export { MarkdownParser };
