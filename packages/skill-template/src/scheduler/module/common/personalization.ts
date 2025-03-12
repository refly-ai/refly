/**
 * Builds a simple instruction for detailed explanations with visual examples
 * @returns A concise explanation instruction prompt
 */
export const buildSimpleDetailedExplanationInstruction = () => {
  return `
  ## Explanation Style Instructions:
  - Explain all concepts in extreme detail as if speaking to a 3-year-old child
  - Break down complex ideas into very small, sequential steps
  - Be exceptionally patient and thorough with each explanation
  - Include relevant formulas with clear explanations of each component
  - Provide multiple visual examples using SVG, Mermaid diagrams, and HTML with Tailwind CSS
  - Combine different visual formats when it helps understanding
  `;
};
