import { CodeArtifactType } from '@refly/openapi-schema';

export const ARTIFACT_TAG = 'reflyArtifact';
export const ARTIFACT_THINKING_TAG = 'reflyThinking';

// https://regex101.com/r/TwzTkf/2
export const ARTIFACT_TAG_REGEX =
  /<reflyArtifact\b[^>]*>(?<content>[\S\s]*?)(?:<\/reflyArtifact>|$)/;

// https://regex101.com/r/r9gqGg/1
export const ARTIFACT_TAG_CLOSED_REGEX = /<reflyArtifact\b[^>]*>([\S\s]*?)<\/reflyArtifact>/;

// https://regex101.com/r/AvPA2g/1
export const ARTIFACT_THINKING_TAG_REGEX =
  /<reflyThinking\b[^>]*>([\S\s]*?)(?:<\/reflyThinking>|$)/;

// Similar to ARTIFACT_TAG_CLOSED_REGEX but for reflyThinking
export const ARTIFACT_THINKING_TAG_CLOSED_REGEX =
  /<reflyThinking\b[^>]*>([\S\s]*?)<\/reflyThinking>/;

/**
 * Replace all line breaks in the matched `reflyCanvas` tag with an empty string
 */
export const processWithArtifact = (input = '') => {
  let output = input;
  const thinkMatch = ARTIFACT_THINKING_TAG_REGEX.exec(input);

  // If the input contains the `reflyThinking` tag, replace all line breaks with an empty string
  if (thinkMatch)
    output = input.replace(ARTIFACT_THINKING_TAG_REGEX, (match) =>
      match.replaceAll(/\r?\n|\r/g, ''),
    );

  const match = ARTIFACT_TAG_REGEX.exec(input);
  // If the input contains the `reflyCanvas` tag, replace all line breaks with an empty string
  if (match)
    return output.replace(ARTIFACT_TAG_REGEX, (match) => match.replaceAll(/\r?\n|\r/g, ''));

  // if not match, check if it's start with <reflyCanvas but not closed
  const regex = /<reflyArtifact\b(?:(?!\/?>)[\S\s])*$/;
  if (regex.test(output)) {
    return output.replace(regex, '<reflyArtifact>');
  }

  return output;
};

export const getArtifactContent = (content: string) => {
  // Find the position of the first closing bracket of the opening tag
  const openTagEndPos = content.indexOf('>', content.indexOf('<reflyArtifact'));
  if (openTagEndPos === -1) {
    return '';
  }

  // Find the position of the closing tag
  const closeTagStartPos = content.lastIndexOf('</reflyArtifact>');

  // Extract content between opening and closing tags
  if (closeTagStartPos > -1) {
    return content.substring(openTagEndPos + 1, closeTagStartPos).trim();
  }

  // No closing tag found, extract till the end
  return content.substring(openTagEndPos + 1).trim();
};

// Function to extract content and attributes from artifact tag
export const getArtifactContentAndAttributes = (content: string) => {
  // Step 1: Find the complete opening tag using a more precise regex
  const openingTagRegex = /<reflyArtifact\b[^>]*>/;
  const openingMatch = content.match(openingTagRegex);
  const attributes: Record<string, string> = {};

  if (!openingMatch || !openingMatch[0]) {
    return {
      content: '',
      title: '',
      language: 'typescript',
      type: '',
    };
  }

  const openingTag = openingMatch[0];
  const openingTagIndex = content.indexOf(openingTag);
  const openTagEndPos = openingTagIndex + openingTag.length;

  // Extract attributes from the opening tag
  const attrRegex = /(\w+)=["']([^"']*)["']/g;
  let attrMatch = attrRegex.exec(openingTag);
  while (attrMatch !== null) {
    attributes[attrMatch[1]] = attrMatch[2];
    attrMatch = attrRegex.exec(openingTag);
  }

  // Step 2: Extract the content between opening and closing tags
  let contentValue = '';
  const closeTagStartPos = content.lastIndexOf('</reflyArtifact>');

  if (closeTagStartPos > -1) {
    // Extract content between opening and closing tags
    contentValue = content.substring(openTagEndPos, closeTagStartPos).trim();
  } else {
    // No closing tag found, extract till the end
    contentValue = content.substring(openTagEndPos).trim();
  }

  return {
    content: contentValue,
    title: attributes.title || '',
    language: attributes.language || 'typescript',
    type: attributes.type || '',
    // Include all other attributes
    ...attributes,
  };
};

// Function to extract content from reflyThinking tag
export const getReflyThinkingContent = (content: string) => {
  // Find the position of the first closing bracket of the opening tag
  const openTagEndPos = content.indexOf('>', content.indexOf('<reflyThinking'));
  if (openTagEndPos === -1) {
    return '';
  }

  // Find the position of the closing tag
  const closeTagStartPos = content.lastIndexOf('</reflyThinking>');

  // Extract content between opening and closing tags
  if (closeTagStartPos > -1) {
    return content.substring(openTagEndPos + 1, closeTagStartPos).trim();
  }

  // No closing tag found, extract till the end
  return content.substring(openTagEndPos + 1).trim();
};

// Function to extract content and attributes from reflyThinking tag
export const getReflyThinkingContentAndAttributes = (content: string) => {
  // Step 1: Find the opening tag and extract all attributes
  const openingTagRegex = /<reflyThinking\b([^>]*)>/;
  const openingMatch = openingTagRegex.exec(content);
  const attributes: Record<string, string> = {};

  if (openingMatch && openingMatch.length > 1) {
    const attrStr = openingMatch[1];
    // Use a regex that can handle quoted attribute values potentially containing spaces and special chars
    const attrRegex = /(\w+)=["']([^"']*)["']/g;
    let match: RegExpExecArray | null = null;

    // Extract all attributes using regex
    match = attrRegex.exec(attrStr);
    while (match !== null) {
      attributes[match[1]] = match[2];
      match = attrRegex.exec(attrStr);
    }
  }

  // Step 2: Extract the content between opening and closing tags
  // We'll use a more precise approach to get everything between tags
  let contentValue = '';

  // Find the position of the first closing bracket of the opening tag
  const openTagEndPos = content.indexOf('>', content.indexOf('<reflyThinking'));
  if (openTagEndPos > -1) {
    // Find the position of the closing tag
    const closeTagStartPos = content.lastIndexOf('</reflyThinking>');

    if (closeTagStartPos > -1) {
      // Extract content between opening and closing tags
      contentValue = content.substring(openTagEndPos + 1, closeTagStartPos).trim();
    } else {
      // No closing tag found, extract till the end
      contentValue = content.substring(openTagEndPos + 1).trim();
    }
  }

  return {
    content: contentValue,
    // Include all other attributes
    ...attributes,
  };
};

const typeMapping: Record<string, { mime: CodeArtifactType; display: string }> = {
  react: { mime: 'application/refly.artifacts.react', display: 'React' },
  svg: { mime: 'image/svg+xml', display: 'SVG' },
  mermaid: { mime: 'application/refly.artifacts.mermaid', display: 'Mermaid' },
  markdown: { mime: 'text/markdown', display: 'Markdown' },
  code: { mime: 'application/refly.artifacts.code', display: 'Code' },
  html: { mime: 'text/html', display: 'HTML' },
  mindMap: { mime: 'application/refly.artifacts.mindmap', display: 'Mind Map' },
};
// Function to get simple type description with fuzzy matching
export const getSimpleTypeDescription = (type: CodeArtifactType): string => {
  // Check for exact match first
  for (const [, value] of Object.entries(typeMapping)) {
    if (value.mime === type) {
      return value.display;
    }
  }
  // If no exact match, try fuzzy matching
  const typeStr = type.toLowerCase();
  for (const [key, value] of Object.entries(typeMapping)) {
    if (typeStr.includes(key.toLowerCase())) {
      return value.display;
    }
  }
  // Default fallback
  return type;
};

// Function to get all available artifact types with labels
export const getArtifactTypeOptions = () => {
  // Use entries to get a unique array of options
  return Object.entries(typeMapping).map(([key, { mime, display }]) => ({
    value: mime,
    label: display,
    // Add a unique key to prevent React warnings about duplicate keys
    key: key,
  }));
};

// Function to get file extension based on artifact type with fuzzy matching
export const getFileExtensionFromType = (type: CodeArtifactType): string => {
  const extensionMap: Record<string, string> = {
    react: 'tsx',
    svg: 'svg',
    mermaid: 'mmd',
    markdown: 'md',
    md: 'md',
    code: '', // Will be determined by language
    html: 'html',
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    css: 'css',
    java: 'java',
    mindMap: 'json',
  };

  // Try exact match first
  for (const [key, value] of Object.entries(typeMapping)) {
    if (value.mime === type) {
      return extensionMap[key] ?? '';
    }
  }
  // If no exact match, try fuzzy matching
  const typeStr = type.toLowerCase();
  for (const [key, extension] of Object.entries(extensionMap)) {
    if (typeStr.includes(key.toLowerCase())) {
      return extension;
    }
  }
  // Default fallback
  return '';
};
// Helper function to detect type from content (for external use)
export const detectActualTypeFromType = (type: CodeArtifactType): CodeArtifactType => {
  const lowerContent = type.toLowerCase();

  if (lowerContent.includes('react')) {
    return typeMapping.react.mime;
  }

  if (lowerContent.includes('html')) {
    return typeMapping.html.mime;
  }

  if (lowerContent.includes('svg')) {
    return typeMapping.svg.mime;
  }

  if (
    lowerContent.includes('mermaid') ||
    lowerContent.includes('graph') ||
    lowerContent.includes('flowchart')
  ) {
    return typeMapping.mermaid.mime;
  }

  if (lowerContent.includes('markdown')) {
    return typeMapping.markdown.mime;
  }

  if (lowerContent.includes('mindmap')) {
    return typeMapping.mindMap.mime;
  }

  // Default to code if no specific type detected
  return typeMapping.code.mime;
};

// Add a function to get default content for an artifact type
export const getDefaultContentForType = (type: CodeArtifactType): string => {
  if (type === 'application/refly.artifacts.mindmap') {
    return JSON.stringify(
      {
        id: 'root',
        label: 'Main Topic',
        content: 'Main Topic',
        children: [
          {
            id: 'child1',
            label: 'Subtopic 1',
            content: 'Subtopic 1',
            children: [
              {
                id: 'child1-1',
                label: 'Detail 1',
                content: 'Detail 1',
                children: [],
              },
              {
                id: 'child1-2',
                label: 'Detail 2',
                content: 'Detail 2',
                children: [],
              },
            ],
          },
          {
            id: 'child2',
            label: 'Subtopic 2',
            content: 'Subtopic 2',
            children: [],
          },
          {
            id: 'child3',
            label: 'Subtopic 3',
            content: 'Subtopic 3',
            children: [],
          },
        ],
      },
      null,
      2,
    );
  }

  // Add other type defaults as needed
  return '';
};
