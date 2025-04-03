import type { Node } from 'unist';
import { visit } from 'unist-util-visit';

import { ARTIFACT_THINKING_TAG, getReflyThinkingContent } from '@refly/utils/artifact';

// eslint-disable-next-line unicorn/consistent-function-scoping
const rehypePlugin = () => (tree: Node) => {
  visit(tree, (node: any, index, parent) => {
    // Direct raw tag handling (complete artifact thinking tag)
    if (
      node.type === 'raw' &&
      (node.value.startsWith(`<${ARTIFACT_THINKING_TAG}`) ||
        node.value.includes(`<${ARTIFACT_THINKING_TAG}`))
    ) {
      // Extract content using our robust method
      const content = getReflyThinkingContent(node.value);

      // Create new node
      const reflyThinkingNode = {
        children: content ? [{ type: 'text', value: content }] : [],
        properties: {},
        tagName: ARTIFACT_THINKING_TAG,
        type: 'element',
      };

      // Replace the original node
      if (parent && index != null) {
        parent.children.splice(index, 1, reflyThinkingNode);
      }
      return;
    }

    // Handle paragraph containing artifact thinking tags
    if (node.type === 'element' && node.tagName === 'p' && node.children?.length > 0) {
      // Check if any child is or contains a reflyThinking tag
      const paragraphText = node.children
        .map((child: any) => {
          if (child.type === 'text') return child.value;
          if (child.type === 'raw') return child.value;
          return '';
        })
        .join('');

      // Check if paragraph contains a reflyThinking tag
      if (
        paragraphText.includes(`<${ARTIFACT_THINKING_TAG}`) &&
        (paragraphText.includes(`</${ARTIFACT_THINKING_TAG}>`) ||
          paragraphText.includes(`<${ARTIFACT_THINKING_TAG}`))
      ) {
        // Extract content using our robust method
        const content = getReflyThinkingContent(paragraphText);

        // Create new node
        const reflyThinkingNode = {
          children: content ? [{ type: 'text', value: content }] : [],
          properties: {},
          tagName: ARTIFACT_THINKING_TAG,
          type: 'element',
        };

        // Replace the paragraph with the artifact thinking node
        if (parent && index != null) {
          parent.children.splice(index, 1, reflyThinkingNode);
        }
      }
    }
  });
};

export default rehypePlugin;
