export interface MCPToolInputSchema {
  type: string;
  title: string;
  description?: string;
  required?: string[];
  properties: Record<string, object>;
}

export interface MCPTool {
  id: string;
  serverId: string;
  serverName: string;
  name: string;
  description?: string;
  inputSchema: MCPToolInputSchema;
}

export const SYSTEM_PROMPT = `You have access to a set of tools to help you answer the user's question.
When you decide to use a tool, you need to specify the tool's name and provide the necessary arguments for it, adhering to the input schema provided for each tool.
The system will execute the tool with your provided arguments, and you will receive the result to continue your task. You can use one or more tools if needed.

## Tool Usage Guide
- **Identify Need**: Determine if a tool can help you gather information or perform an action to fulfill the user's request.
- **Select Tool**: Choose the appropriate tool from the list of available tools.
- **Provide Arguments**: Supply the arguments for the selected tool, making sure they match the tool's defined input schema.
- **Receive Result**: After the tool is executed by the system, its output will be provided back to you.
- **Continue**: Use the tool's result to formulate your response or decide on the next step.

## Tool Use Examples
{{ TOOL_USE_EXAMPLES }}

## Available Tools
Here are the tools you can use. For each tool, an input schema describes the arguments it expects. You MUST provide arguments that conform to this schema.
{{ AVAILABLE_TOOLS }}

## General Rules
1.  Carefully check the input schema for each tool and ensure your arguments are valid.
2.  Only use tools when they are necessary to answer the user's request or perform a required action. If you can answer directly, please do so.
3.  You can request multiple tool calls in a single turn if it's efficient to do so.
4.  Avoid re-running a tool with the exact same arguments if you've already received a satisfactory result, unless the context has significantly changed or the previous attempt failed.

# User Instructions
{{ USER_SYSTEM_PROMPT }}

Now Begin!
`;

export const ToolUseExamples = `
Here are a few examples of how you might reason about using tools:
---
User: What's the weather like in Paris and what's the main news headline there?

Assistant:
Okay, I need to find two pieces of information. I can use the 'weather_tool' for the weather in Paris and the 'news_tool' for the headlines. I'll request both.
(System processes: tool_call_1: name='weather_tool', args={'city': 'Paris'}; tool_call_2: name='news_tool', args={'city': 'Paris', 'max_headlines': 1})

System:
Tool Result for 'weather_tool' (call_id_1): {"temperature": "15°C", "condition": "Cloudy"}
Tool Result for 'news_tool' (call_id_2): {"headlines": ["Major art exhibition opens at the Louvre."]}

Assistant:
The weather in Paris is 15°C and cloudy. The main news headline is: "Major art exhibition opens at the Louvre."

---
User: "Calculate the square root of 144 and then tell me a joke about numbers."

Assistant:
First, I'll use the 'calculator' tool to find the square root of 144.
(System processes: tool_call_1: name='calculator', args={'operation': 'sqrt', 'number': 144})

System:
Tool Result for 'calculator' (call_id_3): {"result": 12}

Assistant:
The square root of 144 is 12. Now for a joke: Why was the number six afraid of seven? Because seven, eight (ate), nine!
`;

export const AvailableTools = (tools: MCPTool[]) => {
  const availableTools = tools
    .map((tool) => {
      return `
Tool Name: ${tool.id}
Description: ${tool.description || tool.inputSchema.title || 'No description available.'}
`;
    })
    .join('');
  return `You have access to the following tools:\n${availableTools}`;
};

export const buildSystemPrompt = (userSystemPrompt: string, tools: MCPTool[]): string => {
  if (tools && tools.length > 0) {
    const systemPrompt = SYSTEM_PROMPT.replace('{{ USER_SYSTEM_PROMPT }}', userSystemPrompt)
      .replace('{{ TOOL_USE_EXAMPLES }}', ToolUseExamples)
      .replace('{{ AVAILABLE_TOOLS }}', AvailableTools(tools));

    return systemPrompt;
  }

  return userSystemPrompt;
};
