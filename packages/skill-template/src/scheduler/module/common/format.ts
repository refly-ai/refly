export const buildFormatDisplayInstruction = () => {
  return `
  ## Markdown Formatting Guidelines:
  1. Heading Level Requirements:
     - Maximum heading level should be H3 (###)
     - Sub-sections should use H4 (####)
     - Never use H1 or H2 headings
     - Maintain proper heading hierarchy

  2. General Formatting Rules:
     - Use proper markdown syntax
     - Keep content well-structured
     - Ensure consistent indentation
     - Follow heading level hierarchy strictly
     - Always specify language identifiers in code blocks (e.g. \`\`\`js, \`\`\`ts, \`\`\`svg, \`\`\`mermaid)

   3. Mermaid Diagram Rules:
     - Use \`\`\`mermaid code block for all Mermaid diagrams
     - Mermaid renderer version is 11.6.0, please follow this version's syntax.
  `;
};

export const buildVisualExamplesInstruction = () => {
  return `
  ## Visual Content Generation Guidelines:
  - When explaining concepts, demonstrating examples, or addressing various scenarios, prioritize generating visual content
  - Prefer creating SVG, HTML (with Tailwind CSS), or Mermaid diagrams when appropriate
  - Generate multiple visual examples in a single response when showing different variations or approaches
  - HTML examples should utilize Tailwind CSS for styling - import from https://cdn.tailwindcss.com
  - Combination of different visual formats (SVG + HTML, Mermaid + HTML, etc.) is encouraged when it enhances understanding
  - Ensure all visual content is properly explained with accompanying text

  ### Visual Examples Generation Guidelines:
  1. Types of Visual Content to Generate:
     - SVG: Use \`\`\`svg blocks for simple illustrations, icons, charts, and diagrams
     - HTML: Use \`\`\`html blocks for interactive UI components and layouts with Tailwind CSS
     - Mermaid: Use \`\`\`mermaid blocks for flowcharts, sequence diagrams, entity relationships, etc.
     - React Components: Use \`\`\`tsx or \`\`\`jsx blocks for more complex interactive examples

  2. When to Generate Visual Content:
     - Explanations of complex concepts that benefit from visualization
     - UI/UX design demonstrations
     - Workflow or process illustrations
     - Comparison of different approaches or variations
     - Step-by-step tutorials where visual guidance enhances understanding

  3. Multiple Examples Best Practices:
     - Generate a variety of examples to illustrate different approaches
     - Provide progressive examples (simple → complex)
     - Include variations that address different use cases
     - Combine different visualization types when they complement each other
     - Ensure each example has clear explanatory text
     - Always use appropriate language identifiers in code blocks
  `;
};
