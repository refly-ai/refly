import { SKIP, visit } from 'unist-util-visit';

import { ARTIFACT_TAG, ARTIFACT_TAG_REGEX } from '@refly/utils/artifact';

function rehypePlugin() {
  return (tree: any) => {
    visit(tree, (node, index, parent) => {
      // Direct raw tag handling (complete artifact tag)
      if (
        node.type === 'raw' &&
        (node.value.startsWith(`<${ARTIFACT_TAG}`) || node.value.includes(`<${ARTIFACT_TAG}`))
      ) {
        // Extract content from the complete tag
        const match = ARTIFACT_TAG_REGEX.exec(node.value);
        let content = '';
        const attributes: Record<string, string> = {};

        if (match?.groups?.content) {
          content = match.groups.content;
        }

        // Extract attributes
        const attributeRegex = /(\w+)="([^"]*)"/g;
        const attrText = node.value.split('>')[0];

        let attrMatch = attributeRegex.exec(attrText);
        while (attrMatch !== null) {
          attributes[attrMatch[1]] = attrMatch[2];
          attrMatch = attributeRegex.exec(attrText);
        }

        // Create new node
        const newNode = {
          children: content ? [{ type: 'text', value: content }] : [],
          properties: attributes,
          tagName: ARTIFACT_TAG,
          type: 'element',
        };

        // Replace the original node
        parent.children.splice(index, 1, newNode);
        return [SKIP, index];
      }

      // Handle paragraph containing artifact tags
      if (node.type === 'element' && node.tagName === 'p' && node.children?.length > 0) {
        // Check if any child is or contains an artifact tag
        let hasArtifactTag = false;
        let artifactContent = '';
        const attributes: Record<string, string> = {};

        // Simple check for artifact tag in paragraph text
        const paragraphText = node.children
          .map((child: any) => {
            if (child.type === 'text') return child.value;
            if (child.type === 'raw') return child.value;
            return '';
          })
          .join('');

        const match = ARTIFACT_TAG_REGEX.exec(paragraphText);

        if (match) {
          hasArtifactTag = true;
          if (match.groups?.content) {
            artifactContent = match.groups.content;
          }

          // Extract attributes
          const attributeRegex = /(\w+)="([^"]*)"/g;
          const tagOpening = paragraphText.split('>')[0];
          let attrMatch = attributeRegex.exec(tagOpening);

          while (attrMatch !== null) {
            attributes[attrMatch[1]] = attrMatch[2];
            attrMatch = attributeRegex.exec(tagOpening);
          }
        }

        if (hasArtifactTag) {
          // Create new artifact node
          const newNode = {
            children: artifactContent ? [{ type: 'text', value: artifactContent }] : [],
            properties: attributes,
            tagName: ARTIFACT_TAG,
            type: 'element',
          };

          // Replace the paragraph with the artifact node
          parent.children.splice(index, 1, newNode);
          return [SKIP, index];
        }
      }
    });
  };
}

export default rehypePlugin;
