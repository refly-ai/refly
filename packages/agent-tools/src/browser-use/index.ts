// import { z } from 'zod/v3';
// import { ToolParams } from '@langchain/core/tools';
// import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
// import { ToolsetDefinition } from '@refly/openapi-schema';

// export const BrowserUseToolsetDefinition: ToolsetDefinition = {
//   key: 'browser-use',
//   domain: 'https://browser-use.com',
//   labelDict: {
//     en: 'Browser Use',
//     'zh-CN': '浏览器使用',
//   },
//   descriptionDict: {
//     en: 'Browser automation tool that allows AI agents to control web browsers and perform complex web tasks. Supports stealth browsing, proxy configuration, domain restrictions, and result schema validation.',
//     'zh-CN':
//       '浏览器自动化工具，允许 AI 代理控制网页浏览器并执行复杂的网页任务。支持隐身浏览、代理配置、域名限制和结果模式验证。',
//   },
//   tools: [
//     {
//       name: 'create_task',
//       descriptionDict: {
//         en: 'Create and execute browser automation tasks. Can perform web scraping, form filling, navigation, and other browser-based operations with optional result schema validation.',
//         'zh-CN':
//           '创建并执行浏览器自动化任务。可以执行网页抓取、表单填写、导航和其他基于浏览器的操作，支持可选的结果模式验证。',
//       },
//     },
//   ],
//   requiresAuth: true,
//   authPatterns: [
//     {
//       type: 'credentials',
//       credentialItems: [
//         {
//           key: 'apiKey',
//           inputMode: 'text',
//           inputProps: {
//             passwordType: true,
//           },
//           labelDict: {
//             en: 'API Key',
//             'zh-CN': 'API 密钥',
//           },
//           descriptionDict: {
//             en: 'The API key for Browser Use service',
//             'zh-CN': 'Browser Use 服务的 API 密钥',
//           },
//           required: true,
//         },
//       ],
//     },
//   ],
//   configItems: [
//     {
//       key: 'baseUrl',
//       inputMode: 'text',
//       labelDict: {
//         en: 'Base URL',
//         'zh-CN': '基础 URL',
//       },
//       descriptionDict: {
//         en: 'The base URL of Browser Use service',
//         'zh-CN': 'Browser Use 服务的 URL',
//       },
//       defaultValue: 'https://api.browser-use.com',
//     },
//   ],
// };

// interface BrowserUseToolParams extends ToolParams {
//   apiKey: string;
//   baseUrl?: string;
// }

// // Model pricing per step in USD
// const MODEL_PRICING: Record<string, number> = {
//   'gpt-4.1': 0.025,
//   'gpt-4.1-mini': 0.0075,
//   'o4-mini': 0.02,
//   o3: 0.01,
//   'gemini-2.5-flash': 0.0075,
//   'gemini-2.5-pro': 0.025,
//   'claude-sonnet-4-20250514': 0.03,
//   'gpt-4o': 0.025, // Default fallback pricing
//   'gpt-4o-mini': 0.0075, // Default fallback pricing
//   'llama-4-maverick-17b-128e-instruct': 0.01,
//   'claude-3-7-sonnet-20250219': 0.03,
// };

// const TASK_INITIALIZATION_COST = 0.01; // USD
// const CREDITS_PER_USD = 140; // Credit conversion rate

// export class BrowserUseCreateTask extends AgentBaseTool<BrowserUseToolParams> {
//   name = 'create_task';
//   toolsetKey = BrowserUseToolsetDefinition.key;

//   schema = z.object({
//     task: z.string().min(1).max(20000).describe('The task prompt/instruction for the agent'),
//     structuredOutput: z
//       .any()
//       .optional()
//       .describe(
//         'Optional Zod schema to validate and structure the task result (will be stringified as JSON schema)',
//       ),
//     sessionId: z.string().optional().describe('Optional session ID to reuse a browser session'),
//     profileId: z.string().optional().describe('Optional profile ID to use for the session'),
//     proxyCountryCode: z
//       .string()
//       .optional()
//       .describe('Optional proxy country code for stealth browsing (e.g., "us", "uk")'),
//     startUrl: z.string().url().optional().describe('Optional URL to start the task from'),
//     maxSteps: z
//       .number()
//       .int()
//       .min(1)
//       .max(200)
//       .optional()
//       .describe('Maximum number of steps the agent can take before stopping (default: 30)'),
//     allowedDomains: z
//       .array(z.string())
//       .optional()
//       .describe('Optional list of allowed domains for navigation restrictions'),
//     secrets: z
//       .record(z.string())
//       .optional()
//       .describe('Optional secrets for the task (domain-specific credentials)'),
//     metadata: z
//       .record(z.string())
//       .optional()
//       .describe('Optional metadata for the task (up to 10 key-value pairs)'),
//     highlightElements: z
//       .boolean()
//       .optional()
//       .describe('Whether to highlight interactive elements on the page (default: false)'),
//     flashMode: z
//       .boolean()
//       .optional()
//       .describe('Enable maximum speed execution by reducing thinking time (default: false)'),
//     thinking: z.boolean().optional().describe('Whether to enable thinking mode (default: false)'),
//     vision: z
//       .boolean()
//       .optional()
//       .describe('Whether to enable vision capabilities (default: true)'),
//     systemPromptExtension: z
//       .string()
//       .max(2000)
//       .optional()
//       .describe('Optional extension to the agent system prompt (max 2000 characters)'),
//     llm: z
//       .enum([
//         'gpt-4.1',
//         'gpt-4.1-mini',
//         'o4-mini',
//         'o3',
//         'gemini-2.5-flash',
//         'gemini-2.5-pro',
//         'claude-sonnet-4-20250514',
//         'gpt-4o',
//         'gpt-4o-mini',
//         'llama-4-maverick-17b-128e-instruct',
//         'claude-3-7-sonnet-20250219',
//       ])
//       .optional()
//       .describe('The LLM model to use for the agent'),
//   });

//   description =
//     'Create and execute browser automation tasks. Can perform web scraping, form filling, navigation, and other browser-based operations with optional result schema validation.';

//   protected params: BrowserUseToolParams;

//   constructor(params: BrowserUseToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const apiBase = `${this.params.baseUrl ?? 'https://api.browser-use.com'}/api/v1`;

//       const headers: Record<string, string> = {
//         Authorization: `Bearer ${this.params.apiKey}`,
//         'Content-Type': 'application/json',
//       };

//       // Build request payload for /run-task (minimal fields per v1 docs)
//       const payload: Record<string, any> = { task: input.task };

//       if (input.structuredOutput) {
//         // Convert Zod schema to JSON schema string as structured_output_json
//         const { zodToJsonSchema } = await import('zod-to-json-schema');
//         const jsonSchema = zodToJsonSchema(input.structuredOutput);
//         payload.structured_output_json = JSON.stringify(jsonSchema);
//       }

//       const runResponse = await fetch(`${apiBase}/run-task`, {
//         method: 'POST',
//         headers,
//         body: JSON.stringify(payload),
//       });

//       if (!runResponse.ok) {
//         let errorData: any = {};
//         try {
//           errorData = await runResponse.json();
//         } catch {}
//         throw new Error(
//           errorData?.error ?? `HTTP ${runResponse.status}: ${runResponse.statusText}`,
//         );
//       }

//       const runJson: any = await runResponse.json();
//       const taskId: string | undefined = runJson?.id ?? runJson?.task_id ?? runJson?.taskId;
//       if (!taskId) {
//         throw new Error('Missing task id in run-task response');
//       }

//       // Poll task details until completion
//       const pollIntervalMs = 2000;
//       const maxWaitMs = 300000; // 5 minutes safety cap
//       const deadline = Date.now() + maxWaitMs;

//       let finalDetails: any | undefined;
//       // Helper to fetch task details
//       const fetchDetails = async (): Promise<any> => {
//         const resp = await fetch(`${apiBase}/task/${taskId}`, { headers });
//         if (!resp.ok) {
//           let err: any = {};
//           try {
//             err = await resp.json();
//           } catch {}
//           throw new Error(err?.error ?? `HTTP ${resp.status}: ${resp.statusText}`);
//         }
//         return resp.json();
//       };

//       for (;;) {
//         const details = await fetchDetails();
//         const status = details?.status ?? '';
//         if (status === 'finished' || status === 'failed' || status === 'stopped') {
//           finalDetails = details;
//           break;
//         }
//         if (Date.now() > deadline) {
//           throw new Error('Timeout while waiting for task to finish');
//         }
//         await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
//       }

//       const resultObj = finalDetails ?? {};
//       const responseData: any = {
//         output: resultObj?.output ?? null,
//         fullResult: resultObj,
//       };

//       if (input.structuredOutput && resultObj?.parsed) {
//         responseData.parsed = resultObj.parsed;
//       }

//       if (resultObj?.sessionId) {
//         responseData.sessionId = resultObj.sessionId;
//       }

//       // Calculate credit cost
//       const steps = resultObj?.steps ?? [];
//       const modelUsed = input.llm ?? 'gpt-4o'; // Default fallback model
//       const stepCostPerUnit = MODEL_PRICING[modelUsed] ?? MODEL_PRICING['gpt-4o'];
//       const initializationCost = TASK_INITIALIZATION_COST;
//       const stepsCost = steps.length * stepCostPerUnit;
//       const totalCostUSD = initializationCost + stepsCost;
//       const creditCost = Math.ceil(totalCostUSD * CREDITS_PER_USD); // Round up to nearest integer

//       const summaryParts = ['Successfully executed browser automation task'];
//       if (resultObj?.parsed) {
//         summaryParts.push('with structured result');
//       }
//       if (input.proxyCountryCode) {
//         summaryParts.push(`using proxy from ${input.proxyCountryCode.toUpperCase()}`);
//       }
//       if (input.flashMode) {
//         summaryParts.push('(flash mode enabled)');
//       }
//       if (input.llm) {
//         summaryParts.push(`using ${input.llm} model`);
//       }

//       return {
//         status: 'success',
//         data: responseData,
//         summary: summaryParts.join(' '),
//         creditCost,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error executing browser automation task',
//         summary:
//           error instanceof Error
//             ? error.message
//             : 'Unknown error occurred while executing browser automation task',
//       };
//     }
//   }
// }

// export class BrowserUseToolset extends AgentBaseToolset<BrowserUseToolParams> {
//   toolsetKey = BrowserUseToolsetDefinition.key;
//   tools = [BrowserUseCreateTask] satisfies readonly AgentToolConstructor<BrowserUseToolParams>[];
// }
