import { prosemirrorToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from 'y-prosemirror';
import { Node } from '@tiptap/pm/model';
import * as Y from 'yjs';
import { schema } from './schema';
import { defaultMarkdownSerializer } from './to_markdown';
import { defaultMarkdownParser } from './from_markdown';

export const state2Markdown = (stateUpdate: Uint8Array) => {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, stateUpdate);
  return ydoc2Markdown(ydoc);
};

export const ydoc2Markdown = (ydoc: Y.Doc) => {
  const xmlFragment = ydoc.getXmlFragment('default');
  const node = yXmlFragmentToProseMirrorRootNode(xmlFragment, schema);
  return defaultMarkdownSerializer.serialize(node);
};

export const parseMarkdown = (markdown: string): Node => {
  return defaultMarkdownParser.parse(markdown);
};

export const node2Ydoc = (node: Node) => {
  const ydoc = new Y.Doc();
  prosemirrorToYXmlFragment(node, ydoc.getXmlFragment('default'));
  return ydoc;
};

export const ydoc2StateUpdate = (ydoc: Y.Doc) => {
  return Y.encodeStateAsUpdate(ydoc);
};

export const markdown2StateUpdate = (markdown: string) => {
  const node = parseMarkdown(markdown);
  const ydoc = node2Ydoc(node);
  return ydoc2StateUpdate(ydoc);
};

export type FormatMode =
  | 'render' // For markdown rendering
  | 'ingest' // For consumption by LLMs
  | 'vanilla'; // Without any processing;

/**
 * Clean markdown for consumption by LLM, by removing images and links.
 */
export function cleanMarkdownForIngest(markdown: string): string {
  // Remove images
  let plainText = markdown.replace(/!\[.*?\]\(.*?\)/g, '');

  // Convert links to plain text
  plainText = plainText.replace(/\[(.+?)\]\(.*?\)/g, '$1');

  return plainText;
}

/**
 * Incrementally updates an existing Yjs document with new markdown content.
 * This performs an in-place update while preserving formatting and structure where possible.
 *
 * @param ydoc - Existing Yjs document to update
 * @param markdown - New markdown content to merge into the document
 * @returns The updated Yjs document
 */
export const incrementalMarkdownUpdate = (ydoc: Y.Doc, markdown: string): Y.Doc => {
  // Parse the new markdown content into a ProseMirror node
  const newNode = parseMarkdown(markdown);
  const xmlFragment = ydoc?.getXmlFragment('default');

  if (!xmlFragment) {
    return ydoc;
  }

  // Create a transaction to batch our updates
  ydoc.transact(() => {
    xmlFragment.delete(0, xmlFragment.length);
    prosemirrorToYXmlFragment(newNode, xmlFragment);
  });

  return ydoc;
};
