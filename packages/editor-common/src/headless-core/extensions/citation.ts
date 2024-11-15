import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { CitationView } from '../components/citation-view';

export interface CitationOptions {
  HTMLAttributes: Record<string, any>;
}

export interface CitationAttrs {
  referenceId: string;
  seq: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      addCitation: (attrs: Omit<CitationAttrs, 'seq'>) => ReturnType;
    };
  }
}

const updateCitationNumbers = (tr: any) => {
  const citations = [] as any[];
  const seqMap = new Map<string, number>(); // Map to store referenceId -> seq mapping
  let nextSeq = 1;

  // First pass: collect all citations and assign sequence numbers
  tr.doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'citation') {
      citations.push({ node, pos });
      // If this referenceId hasn't been seen before, assign it a new sequence number
      if (!seqMap.has(node.attrs.referenceId)) {
        seqMap.set(node.attrs.referenceId, nextSeq++);
      }
    }
  });

  // Second pass: update all citations with their sequence numbers
  citations.forEach((citation) => {
    const newAttrs = {
      ...citation.node.attrs,
      seq: seqMap.get(citation.node.attrs.referenceId),
    };
    tr.setNodeMarkup(citation.pos, undefined, newAttrs);
  });
};

export const Citation = Node.create<CitationOptions>({
  name: 'citation',

  inline: true,
  group: 'inline',
  atom: true,

  addAttributes() {
    return {
      referenceId: {
        default: null,
      },
      seq: {
        default: 1,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="citation"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'citation' }), `[${HTMLAttributes.seq}]`];
  },

  addCommands() {
    return {
      addCitation:
        (attrs: Omit<CitationAttrs, 'seq'>) =>
        ({ chain, state }) => {
          // Get the current selection's end position
          const pos = state.selection.to;

          return chain()
            .insertContentAt(pos, {
              type: this.name,
              attrs: {
                ...attrs,
                seq: 1, // Will be automatically updated by plugin
              },
            })
            .run();
        },
    };
  },

  addProseMirrorPlugins() {
    const citationPlugin = new Plugin({
      key: new PluginKey('citation-sequence'),
      appendTransaction: (transactions, oldState, newState) => {
        // Only update if the document changed
        if (!transactions.some((tr) => tr.docChanged)) return null;

        const tr = newState.tr;
        updateCitationNumbers(tr);
        return tr;
      },
    });

    return [citationPlugin];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CitationView);
  },
});
