// import { z } from 'zod';
// import { AgentBaseTool, ToolCallResult, AgentBaseToolset, AgentToolConstructor } from '../base';
// import { ToolsetDefinition } from '@refly/openapi-schema';
// import { WhaleWisdomClient } from './client';
// import { ToolParams } from '@langchain/core/tools';

// export { WhaleWisdomClient, type WhaleWisdomConfig } from './client';

// // Toolset definition for WhaleWisdom
// export const WhaleWisdomToolsetDefinition: ToolsetDefinition = {
//   key: 'whalewisdom',
//   domain: 'https://whalewisdom.com',
//   labelDict: {
//     en: 'WhaleWisdom',
//     'zh-CN': 'WhaleWisdom',
//   },
//   descriptionDict: {
//     en: 'Access 13F institutional holdings data from WhaleWisdom',
//     'zh-CN': '访问 WhaleWisdom 的机构持股数据',
//   },
//   tools: [
//     {
//       name: 'stock_lookup',
//       descriptionDict: {
//         en: 'Look up stock information by symbol or name',
//         'zh-CN': '根据股票代码或名称查找股票信息',
//       },
//     },
//     {
//       name: 'filer_lookup',
//       descriptionDict: {
//         en: 'Look up institutional filer information',
//         'zh-CN': '查找机构投资者信息',
//       },
//     },
//     {
//       name: 'get_quarters',
//       descriptionDict: {
//         en: 'Get available 13F filing quarters',
//         'zh-CN': '获取可用的 13F 申报季度',
//       },
//     },
//     {
//       name: 'get_holdings',
//       descriptionDict: {
//         en: 'Get holdings for specific institutional filers',
//         'zh-CN': '获取特定机构投资者的持仓数据',
//       },
//     },
//     {
//       name: 'get_holders',
//       descriptionDict: {
//         en: 'Get institutional holders for specific stocks',
//         'zh-CN': '获取特定股票的机构投资者',
//       },
//     },
//     {
//       name: 'get_filer_metadata',
//       descriptionDict: {
//         en: 'Get metadata for a specific institutional filer',
//         'zh-CN': '获取特定机构投资者的元数据',
//       },
//     },
//     {
//       name: 'compare_stocks',
//       descriptionDict: {
//         en: 'Compare stock holdings between different quarters',
//         'zh-CN': '比较股票在不同季度间的持仓变化',
//       },
//     },
//     {
//       name: 'compare_holdings',
//       descriptionDict: {
//         en: 'Compare holdings between different institutional filers',
//         'zh-CN': '比较不同机构投资者间的持仓',
//       },
//     },
//   ],
//   requiresAuth: true,
//   authPatterns: [
//     {
//       type: 'credentials',
//       credentialItems: [
//         {
//           key: 'sharedKey',
//           inputMode: 'text',
//           inputProps: {
//             passwordType: false,
//           },
//           labelDict: {
//             en: 'Shared Access Key',
//             'zh-CN': '共享访问密钥',
//           },
//           descriptionDict: {
//             en: 'Your WhaleWisdom shared access key',
//             'zh-CN': '您的 WhaleWisdom 共享访问密钥',
//           },
//           required: true,
//         },
//         {
//           key: 'secretKey',
//           inputMode: 'text',
//           inputProps: {
//             passwordType: true,
//           },
//           labelDict: {
//             en: 'Secret Access Key',
//             'zh-CN': '秘密访问密钥',
//           },
//           descriptionDict: {
//             en: 'Your WhaleWisdom secret access key',
//             'zh-CN': '您的 WhaleWisdom 秘密访问密钥',
//           },
//           required: true,
//         },
//       ],
//     },
//   ],
//   configItems: [],
// };

// interface WhaleWisdomToolParams extends ToolParams {
//   sharedKey: string;
//   secretKey: string;
// }

// // Stock Lookup Tool
// export class WhaleWisdomStockLookup extends AgentBaseTool<WhaleWisdomToolParams> {
//   name = 'stock_lookup';
//   toolsetKey = WhaleWisdomToolsetDefinition.key;

//   schema = z.object({
//     query: z.string().describe('Stock symbol (e.g., AAPL) or company name to search for'),
//   }) as any;

//   description = 'Look up stock information by symbol or name';

//   protected params: WhaleWisdomToolParams;

//   constructor(params: WhaleWisdomToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const client = new WhaleWisdomClient({
//         sharedKey: this.params.sharedKey,
//         secretKey: this.params.secretKey,
//       });

//       // Try symbol first, then name
//       let result = await client.lookupStock({ symbol: input.query });
//       if (!result || (Array.isArray(result) && result.length === 0)) {
//         result = await client.lookupStock({ name: input.query });
//       }

//       return {
//         status: 'success',
//         data: result,
//         summary: `Found stock information for ${input.query}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error looking up stock',
//         summary:
//           error instanceof Error ? error.message : 'Unknown error occurred while looking up stock',
//       };
//     }
//   }
// }

// // Filer Lookup Tool
// export class WhaleWisdomFilerLookup extends AgentBaseTool<WhaleWisdomToolParams> {
//   name = 'filer_lookup';
//   toolsetKey = WhaleWisdomToolsetDefinition.key;

//   schema = z.object({
//     query: z.string().describe('Filer name or CIK to search for'),
//   }) as any;

//   description = 'Look up institutional filer information';

//   protected params: WhaleWisdomToolParams;

//   constructor(params: WhaleWisdomToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const client = new WhaleWisdomClient({
//         sharedKey: this.params.sharedKey,
//         secretKey: this.params.secretKey,
//       });

//       // Try name first, then CIK if it looks like a CIK (numeric)
//       let result = await client.lookupFiler({ name: input.query });
//       if (!result || (Array.isArray(result) && result.length === 0)) {
//         // Check if query looks like a CIK (all digits)
//         if (/^\d+$/.test(input.query)) {
//           result = await client.lookupFiler({ cik: input.query });
//         }
//       }

//       return {
//         status: 'success',
//         data: result,
//         summary: `Found filer information for ${input.query}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error looking up filer',
//         summary:
//           error instanceof Error ? error.message : 'Unknown error occurred while looking up filer',
//       };
//     }
//   }
// }

// // Get Quarters Tool
// export class WhaleWisdomGetQuarters extends AgentBaseTool<WhaleWisdomToolParams> {
//   name = 'get_quarters';
//   toolsetKey = WhaleWisdomToolsetDefinition.key;

//   schema = z.object({}) as any;

//   description = 'Get available 13F filing quarters';

//   protected params: WhaleWisdomToolParams;

//   constructor(params: WhaleWisdomToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(_input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const client = new WhaleWisdomClient({
//         sharedKey: this.params.sharedKey,
//         secretKey: this.params.secretKey,
//       });

//       const result = await client.getQuarters();

//       return {
//         status: 'success',
//         data: result,
//         summary: 'Retrieved available 13F filing quarters',
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error getting quarters',
//         summary:
//           error instanceof Error ? error.message : 'Unknown error occurred while getting quarters',
//       };
//     }
//   }
// }

// // Get Holdings Tool
// export class WhaleWisdomGetHoldings extends AgentBaseTool<WhaleWisdomToolParams> {
//   name = 'get_holdings';
//   toolsetKey = WhaleWisdomToolsetDefinition.key;

//   schema = z.object({
//     filer_ids: z.array(z.number()).describe('Array of institutional filer IDs'),
//     include_13d: z.number().optional().describe('Include 13D/G filings (1 for yes, 0 for no)'),
//     quarter_ids: z.array(z.number()).optional().describe('Array of quarter IDs to filter by'),
//   }) as any;

//   description = 'Get holdings for specific institutional filers';

//   protected params: WhaleWisdomToolParams;

//   constructor(params: WhaleWisdomToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const client = new WhaleWisdomClient({
//         sharedKey: this.params.sharedKey,
//         secretKey: this.params.secretKey,
//       });

//       const result = await client.getHoldings(input);

//       return {
//         status: 'success',
//         data: result,
//         summary: `Retrieved holdings for ${input.filer_ids.length} institutional filers`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error getting holdings',
//         summary:
//           error instanceof Error ? error.message : 'Unknown error occurred while getting holdings',
//       };
//     }
//   }
// }

// // Get Holders Tool
// export class WhaleWisdomGetHolders extends AgentBaseTool<WhaleWisdomToolParams> {
//   name = 'get_holders';
//   toolsetKey = WhaleWisdomToolsetDefinition.key;

//   schema = z.object({
//     stock_ids: z.array(z.number()).describe('Array of stock IDs'),
//     filer_ids: z
//       .array(z.number())
//       .optional()
//       .describe('Array of institutional filer IDs to filter by'),
//     quarter_ids: z.array(z.number()).optional().describe('Array of quarter IDs to filter by'),
//     include_13d: z.number().optional().describe('Include 13D/G filings (1 for yes, 0 for no)'),
//     hedge_funds_only: z
//       .number()
//       .optional()
//       .describe('Only include hedge funds (1 for yes, 0 for no)'),
//     sort: z.string().optional().describe('Sort field (e.g., percent_ownership)'),
//     dir: z.enum(['ASC', 'DESC']).optional().describe('Sort direction'),
//     limit: z.number().optional().describe('Maximum number of results'),
//     columns: z.array(z.number()).optional().describe('Specific columns to include'),
//   }) as any;

//   description = 'Get institutional holders for specific stocks';

//   protected params: WhaleWisdomToolParams;

//   constructor(params: WhaleWisdomToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const client = new WhaleWisdomClient({
//         sharedKey: this.params.sharedKey,
//         secretKey: this.params.secretKey,
//       });

//       const result = await client.getHolders(input);

//       return {
//         status: 'success',
//         data: result,
//         summary: `Retrieved holders for ${input.stock_ids.length} stocks`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error getting holders',
//         summary:
//           error instanceof Error ? error.message : 'Unknown error occurred while getting holders',
//       };
//     }
//   }
// }

// // Get Filer Metadata Tool
// export class WhaleWisdomGetFilerMetadata extends AgentBaseTool<WhaleWisdomToolParams> {
//   name = 'get_filer_metadata';
//   toolsetKey = WhaleWisdomToolsetDefinition.key;

//   schema = z.object({
//     filer_id: z.number().describe('Institutional filer ID'),
//   }) as any;

//   description = 'Get metadata for a specific institutional filer';

//   protected params: WhaleWisdomToolParams;

//   constructor(params: WhaleWisdomToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const client = new WhaleWisdomClient({
//         sharedKey: this.params.sharedKey,
//         secretKey: this.params.secretKey,
//       });

//       const result = await client.getFilerMetadata(input.filer_id);

//       return {
//         status: 'success',
//         data: result,
//         summary: `Retrieved metadata for institutional filer ${input.filer_id}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error getting filer metadata',
//         summary:
//           error instanceof Error
//             ? error.message
//             : 'Unknown error occurred while getting filer metadata',
//       };
//     }
//   }
// }

// // Compare Stocks Tool
// export class WhaleWisdomCompareStocks extends AgentBaseTool<WhaleWisdomToolParams> {
//   name = 'compare_stocks';
//   toolsetKey = WhaleWisdomToolsetDefinition.key;

//   schema = z.object({
//     stockid: z.number().describe('Stock ID to compare'),
//     q1id: z.number().describe('First quarter ID for comparison'),
//     q2id: z.number().describe('Second quarter ID for comparison'),
//     order: z.string().optional().describe('Sort order for results'),
//   }) as any;

//   description = 'Compare stock holdings between different quarters';

//   protected params: WhaleWisdomToolParams;

//   constructor(params: WhaleWisdomToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const client = new WhaleWisdomClient({
//         sharedKey: this.params.sharedKey,
//         secretKey: this.params.secretKey,
//       });

//       const result = await client.compareStocks(input);

//       return {
//         status: 'success',
//         data: result,
//         summary: `Compared holdings for stock ${input.stockid} between quarters ${input.q1id} and ${input.q2id}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error comparing stocks',
//         summary:
//           error instanceof Error ? error.message : 'Unknown error occurred while comparing stocks',
//       };
//     }
//   }
// }

// // Compare Holdings Tool
// export class WhaleWisdomCompareHoldings extends AgentBaseTool<WhaleWisdomToolParams> {
//   name = 'compare_holdings';
//   toolsetKey = WhaleWisdomToolsetDefinition.key;

//   schema = z.object({
//     filer_ids: z.array(z.number()).describe('Array of institutional filer IDs to compare'),
//     quarter_id: z.number().describe('Quarter ID for comparison'),
//     order: z.string().optional().describe('Sort order for results'),
//     include_13d: z.number().optional().describe('Include 13D/G filings (1 for yes, 0 for no)'),
//   }) as any;

//   description = 'Compare holdings between different institutional filers';

//   protected params: WhaleWisdomToolParams;

//   constructor(params: WhaleWisdomToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const client = new WhaleWisdomClient({
//         sharedKey: this.params.sharedKey,
//         secretKey: this.params.secretKey,
//       });

//       const result = await client.compareHoldings(input);

//       return {
//         status: 'success',
//         data: result,
//         summary: `Compared holdings between ${input.filer_ids.length} institutional filers for quarter ${input.quarter_id}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error comparing holdings',
//         summary:
//           error instanceof Error
//             ? error.message
//             : 'Unknown error occurred while comparing holdings',
//       };
//     }
//   }
// }

// // Toolset class
// export class WhaleWisdomToolset extends AgentBaseToolset<WhaleWisdomToolParams> {
//   toolsetKey = WhaleWisdomToolsetDefinition.key;
//   tools = [
//     WhaleWisdomStockLookup,
//     WhaleWisdomFilerLookup,
//     WhaleWisdomGetQuarters,
//     WhaleWisdomGetHoldings,
//     WhaleWisdomGetHolders,
//     WhaleWisdomGetFilerMetadata,
//     WhaleWisdomCompareStocks,
//     WhaleWisdomCompareHoldings,
//   ] as readonly AgentToolConstructor<WhaleWisdomToolParams>[];
// }
