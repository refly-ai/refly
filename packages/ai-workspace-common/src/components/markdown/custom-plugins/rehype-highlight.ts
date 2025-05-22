import { visit } from 'unist-util-visit';
import type { Node } from 'unist';

// Define minimal Plugin type inline to avoid dependency on 'unified'
type Plugin = () => (tree: any) => void;

/**
 * Rehype plugin to transform text nodes with ==highlight== syntax to proper HTML elements.
 */
const rehypeHighlight: Plugin = () => {
  return (tree: Node) => {
    // Process text nodes for special syntax
    visit(tree, 'text', (node: any, index: number | null, parent: any) => {
      if (!parent || index === null) return;

      const { value } = node;
      if (typeof value !== 'string') return;

      // Match patterns for highlight
      const highlightRegex = /==(.*?)==/g;

      // Check if we have any matches
      if (!highlightRegex.test(value)) return;

      // Reset regex lastIndex
      highlightRegex.lastIndex = 0;

      // Process the text to create HTML elements
      const parts = [];
      let lastIndex = 0;
      const text = value;

      // Process highlights
      let match: any = highlightRegex.exec(text);
      while (match !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
          parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }

        // Add the highlight element
        parts.push({
          type: 'element',
          tagName: 'mark',
          properties: {},
          children: [{ type: 'text', value: match[1] }],
        });

        lastIndex = match.index + match[0].length;
        match = highlightRegex.exec(text);
      }

      // Add any remaining text
      if (lastIndex < text.length) {
        parts.push({ type: 'text', value: text.slice(lastIndex) });
      }

      // Replace the original node with our processed parts
      if (parts.length > 0) {
        parent.children.splice(index, 1, ...parts);
      }
    });
  };
};

export default rehypeHighlight;
