import { SKIP, visit } from 'unist-util-visit';

// Define the tool use and tool result tags directly here to avoid circular dependencies
const TOOL_USE_TAG = 'tool_use';

// Define the tool use and tool result tags directly here to avoid circular dependencies
export const TOOL_USE_TAG_RENDER = 'reflyToolUse';

// Regular expressions to match tool tags and their content
const TOOL_USE_REGEX = new RegExp(`<${TOOL_USE_TAG}[^>]*>([\\s\\S]*?)<\\/${TOOL_USE_TAG}>`, 'i');

// Regular expressions to extract data from tool tags with improved special character handling
const NAME_REGEX = /<name>([\s\S]*?)<\/name>/i;
const ARGUMENTS_REGEX = /<arguments>([\s\S]*?)<\/arguments>/i;
const RESULT_REGEX = /<result>([\s\S]*?)<\/result>/i;
const BASE64_IMAGE_URL_REGEX =
  /data:image\/(?<format>png|jpeg|gif|webp|svg\+xml);base64,(?<data>[A-Za-z0-9+\/=]+)/i;

// Regular expression to match HTTP/HTTPS image links
const HTTP_IMAGE_URL_REGEX =
  /https?:\/\/[^\s"'<>]+\.(?<format>png|jpeg|jpg|gif|webp|svg)[^\s"'<>]*/i;

/**
 * Utility function to safely extract content from regex matches
 * @param content The content to extract from
 * @param regex The regex pattern to use
 * @returns The extracted content or empty string
 */
const safeExtract = (content: string, regex: RegExp): string => {
  const match = regex.exec(content);
  if (match?.[1]) {
    return match[1].trim();
  }
  return '';
};

/**
 * Extract image URL from a string
 * @param str The string to search in
 * @returns The found image URL, format and whether it's an HTTP link
 */
const extractImageUrl = (
  str: string,
): { url: string | undefined; format: string | undefined; isHttp: boolean } => {
  // First check if it contains a base64 image URL
  const base64Match = BASE64_IMAGE_URL_REGEX.exec(str);
  if (base64Match?.groups && base64Match[0]) {
    return {
      url: base64Match[0],
      format: base64Match.groups.format,
      isHttp: false,
    };
  }

  // Then check if it contains an HTTP image URL
  const httpMatch = HTTP_IMAGE_URL_REGEX.exec(str);
  if (httpMatch?.groups && httpMatch[0]) {
    return {
      url: httpMatch[0],
      format: httpMatch.groups.format,
      isHttp: true,
    };
  }

  return { url: undefined, format: undefined, isHttp: false };
};

/**
 * Rehype plugin to process tool_use tags in markdown
 * When parsing <tool_use> tags, if a <result> exists, extract both <arguments> and <result> and put them on the same node property.
 * If there is no <result>, only extract <arguments>.
 * Preserves text content outside the tags, so text in paragraphs is not lost.
 */
function rehypePlugin() {
  return (tree: any) => {
    visit(tree, (node, index, parent) => {
      // Handle raw HTML nodes that might contain our tool tags
      if (node.type === 'raw') {
        // Check for tool_use tags
        if (node.value?.includes(`<${TOOL_USE_TAG}`)) {
          const match = TOOL_USE_REGEX.exec(node.value);
          if (match?.[1]) {
            const content = match[1];
            const attributes: Record<string, string> = {};

            // Extract tool name using safe extraction
            const toolNameStr = safeExtract(content, NAME_REGEX);
            if (toolNameStr) {
              attributes['data-tool-name'] = toolNameStr;
            }

            // Extract arguments using safe extraction
            const argsStr = safeExtract(content, ARGUMENTS_REGEX);
            if (argsStr) {
              attributes['data-tool-arguments'] = argsStr;
            }

            // Extract result using safe extraction
            const resultStr = safeExtract(content, RESULT_REGEX);
            if (resultStr) {
              attributes['data-tool-result'] = resultStr;

              // Attempt to find and process image data (base64 or HTTP URL) in the result
              let imageUrlFromDetails: string | undefined;
              let imageFormatFromDetails: string | undefined;
              let isHttpUrl = false;
              let imageNameFromArgs = 'image'; // Default image name

              // 1. Directly search for image URL in the result string
              const { url, format, isHttp } = extractImageUrl(resultStr);
              if (url) {
                imageUrlFromDetails = url;
                imageFormatFromDetails = format;
                isHttpUrl = isHttp;
              } else {
                // 2. If direct search fails, try to parse JSON and search in the stringified JSON result
                try {
                  const resultObj = JSON.parse(resultStr);
                  const resultJsonStr = JSON.stringify(resultObj);
                  const jsonResult = extractImageUrl(resultJsonStr);

                  if (jsonResult.url) {
                    imageUrlFromDetails = jsonResult.url;
                    imageFormatFromDetails = jsonResult.format;
                    isHttpUrl = jsonResult.isHttp;
                  }
                } catch (_e) {
                  // Not a JSON result, or JSON parsing failed
                }
              }

              if (imageUrlFromDetails && imageFormatFromDetails) {
                // Set different attributes based on whether it's an HTTP link or not
                if (isHttpUrl) {
                  attributes['data-tool-image-http-url'] = imageUrlFromDetails;
                } else {
                  attributes['data-tool-image-base64-url'] = imageUrlFromDetails;
                }
                // attributes['data-tool-image-format'] = imageFormatFromDetails; // Format is in the URL

                // Attempt to get image name from arguments
                if (argsStr) {
                  try {
                    const argsObj = JSON.parse(argsStr);
                    if (typeof argsObj.params === 'string') {
                      const paramsObj = JSON.parse(argsObj.params);
                      if (paramsObj && typeof paramsObj.name === 'string') {
                        const trimmedName = paramsObj.name.trim();
                        if (trimmedName) {
                          // Ensure non-empty name after trimming
                          imageNameFromArgs = trimmedName;
                        }
                      }
                    } else if (argsObj && typeof argsObj.name === 'string') {
                      const trimmedName = argsObj.name.trim();
                      if (trimmedName) {
                        // Ensure non-empty name after trimming
                        imageNameFromArgs = trimmedName;
                      }
                    }
                  } catch (_e) {
                    // console.warn('MCP-Call rehypePlugin: Could not parse arguments to find image name.', e);
                  }
                }
                attributes['data-tool-image-name'] =
                  `${imageNameFromArgs}.${imageFormatFromDetails}`;
              }
            }

            // Create a new node with the extracted data for tool_use
            const toolNode = {
              type: 'element',
              tagName: TOOL_USE_TAG_RENDER,
              properties: attributes,
              children: [],
            };

            // Get the full match (including the tags)
            const fullMatch = match[0];

            // Split the raw text by the full match to get text before and after the tool_use tag
            const parts = node.value.split(fullMatch);

            // Create array to hold new nodes
            const newNodes = [];

            // Add text before the tool_use tag if it exists
            if (parts[0]) {
              newNodes.push({
                type: 'raw',
                value: parts[0],
              });
            }

            // Add the tool node
            newNodes.push(toolNode);

            // Add text after the tool_use tag if it exists
            if (parts[1]) {
              newNodes.push({
                type: 'raw',
                value: parts[1],
              });
            }

            // Replace the original node with the new nodes
            parent.children.splice(index, 1, ...newNodes);
            return [SKIP, index + newNodes.length - 1]; // Skip to after the last inserted node
          }
        }
      }

      // Handle text nodes within paragraphs that might contain our tool tags
      if (node.type === 'element' && node.tagName === 'p' && node.children?.length > 0) {
        const paragraphText = node.children
          .map((child: any) => {
            if (child.type === 'text') return child.value;
            if (child.type === 'raw') return child.value;
            return '';
          })
          .join('');

        // Check if paragraph contains tool_use tags
        if (paragraphText.includes(`<${TOOL_USE_TAG}`)) {
          const useMatch = TOOL_USE_REGEX.exec(paragraphText);
          if (useMatch?.[1]) {
            const content = useMatch[1];
            const attributes: Record<string, string> = {};

            // Extract tool name using safe extraction
            const name = safeExtract(content, NAME_REGEX);
            if (name) {
              attributes['data-tool-name'] = name;
            }

            // Extract arguments using safe extraction
            const argsStr = safeExtract(content, ARGUMENTS_REGEX);
            if (argsStr) {
              attributes['data-tool-arguments'] = argsStr;
            }

            // Extract result using safe extraction
            const resultStr = safeExtract(content, RESULT_REGEX);
            if (resultStr) {
              attributes['data-tool-result'] = resultStr;

              // Attempt to find and process image data (base64 or HTTP URL) in the result (similar to raw node block)
              let imageUrlFromDetails: string | undefined;
              let imageFormatFromDetails: string | undefined;
              let isHttpUrl = false;
              let imageNameFromArgs = 'image'; // Default image name

              // Directly search for image URL in the result string
              const { url, format, isHttp } = extractImageUrl(resultStr);
              if (url) {
                imageUrlFromDetails = url;
                imageFormatFromDetails = format;
                isHttpUrl = isHttp;
              } else {
                // If direct search fails, try to parse JSON and search in the stringified JSON result
                try {
                  const resultObj = JSON.parse(resultStr);
                  const resultJsonStr = JSON.stringify(resultObj);
                  const jsonResult = extractImageUrl(resultJsonStr);

                  if (jsonResult.url) {
                    imageUrlFromDetails = jsonResult.url;
                    imageFormatFromDetails = jsonResult.format;
                    isHttpUrl = jsonResult.isHttp;
                  }
                } catch (_e) {
                  // Not a JSON result, or JSON parsing failed
                }
              }

              if (imageUrlFromDetails && imageFormatFromDetails) {
                // Set different attributes based on whether it's an HTTP link or not
                if (isHttpUrl) {
                  attributes['data-tool-image-http-url'] = imageUrlFromDetails;
                } else {
                  attributes['data-tool-image-base64-url'] = imageUrlFromDetails;
                }

                if (argsStr) {
                  try {
                    const argsObj = JSON.parse(argsStr);
                    if (typeof argsObj.params === 'string') {
                      const paramsObj = JSON.parse(argsObj.params);
                      if (paramsObj && typeof paramsObj.name === 'string') {
                        const trimmedName = paramsObj.name.trim();
                        if (trimmedName) {
                          // Ensure non-empty name after trimming
                          imageNameFromArgs = trimmedName;
                        }
                      }
                    } else if (argsObj && typeof argsObj.name === 'string') {
                      const trimmedName = argsObj.name.trim();
                      if (trimmedName) {
                        // Ensure non-empty name after trimming
                        imageNameFromArgs = trimmedName;
                      }
                    }
                  } catch (_e) {
                    // Argument parsing failed
                  }
                }
                attributes['data-tool-image-name'] =
                  `${imageNameFromArgs}.${imageFormatFromDetails}`;
              }
            }

            // Create a new node with the extracted data for tool_use
            const toolNode = {
              type: 'element',
              tagName: TOOL_USE_TAG_RENDER,
              properties: attributes,
              children: [],
            };

            // Get the full match (including the tags)
            const fullMatch = useMatch[0];

            // Split the paragraph text by the full match to get text before and after the tool_use tag
            const parts = paragraphText.split(fullMatch);

            // Create new children array for the paragraph
            const newChildren = [];

            // Add text before the tool_use tag if it exists
            if (parts[0]) {
              newChildren.push({
                type: 'text',
                value: parts[0],
              });
            }

            // Add the tool node
            newChildren.push(toolNode);

            // Add text after the tool_use tag if it exists
            if (parts[1]) {
              newChildren.push({
                type: 'text',
                value: parts[1],
              });
            }

            // Replace the children of the paragraph with our new children
            node.children = newChildren;
            return [SKIP, index];
          }
        }
      }
    });
  };
}

export default rehypePlugin;
