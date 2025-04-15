/**
 * Builds a simple instruction for detailed explanations with visual examples
 * @returns A concise explanation instruction prompt
 */
export const buildSimpleDetailedExplanationInstruction = () => {
  return `
  ## Explanation Style Instructions:
  - Break down complex ideas into very small, sequential steps
  - Be exceptionally patient and thorough with each explanation
  - Include relevant formulas with clear explanations of each component
  - Combine different visual formats when it helps understanding
  `;
};

/**
 * Builds a custom instructions section when project customInstructions are provided
 * @param customInstructions - Optional custom instructions from the project
 * @returns A formatted custom instructions section or empty string if no instructions provided
 */
export const buildCustomProjectInstructions = (customInstructions?: string) => {
  if (!customInstructions) {
    return '';
  }

  return `
  ## Custom Instructions:
  The user has selected a specific knowledge base as an external knowledge source for answering their query. 
  This knowledge base has the following custom instructions that you MUST follow when providing answers:
  
  <custom-instructions>
  ${customInstructions}
  </custom-instructions>
  
  These instructions should be applied when using information from the knowledge base context (found in <Context> tags).
  If relevant context is available from this knowledge base, prioritize these custom instructions while also addressing the user's query intent.
  If the context is irrelevant to the query, still follow the original query intent, but incorporate these custom instructions where applicable.
  `;
};

/**
 * Builds a custom instructions section for user prompts
 * @param customInstructions - Optional custom instructions from the project
 * @returns A formatted custom instructions section for use in user prompts
 */
export const buildCustomProjectInstructionsForUserPrompt = (customInstructions?: string) => {
  if (!customInstructions) {
    return '';
  }

  return `
## Custom Instructions
Please follow these custom instructions when answering this query:

<custom_instructions>
${customInstructions}
</custom_instructions>
`;
};
