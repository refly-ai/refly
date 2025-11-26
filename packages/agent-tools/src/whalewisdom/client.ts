// import { createHmac } from 'node:crypto';

// export interface WhaleWisdomConfig {
//   sharedKey: string;
//   secretKey: string;
//   baseUrl?: string;
// }

// export class WhaleWisdomClient {
//   private config: WhaleWisdomConfig;

//   constructor(config: WhaleWisdomConfig) {
//     this.config = {
//       baseUrl: 'https://whalewisdom.com/shell',
//       ...config,
//     };
//   }

//   /**
//    * Generate HMAC-SHA1 signature for API request
//    */
//   private generateSignature(args: string, timestamp: string): string {
//     const message = `${args}\n${timestamp}`;
//     const hmac = createHmac('sha1', this.config.secretKey);
//     hmac.update(message, 'utf8');
//     return hmac.digest('base64').replace(/\n/g, '');
//   }

//   /**
//    * Create timestamp in required format
//    */
//   private createTimestamp(): string {
//     return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
//   }

//   /**
//    * Make authenticated API request
//    */
//   private async makeRequest(
//     command: string,
//     args: Record<string, any>,
//     outputType: 'json' | 'html' | 'csv' = 'json',
//   ): Promise<any> {
//     const argsJson = JSON.stringify({ command, ...args });
//     const timestamp = this.createTimestamp();
//     const signature = this.generateSignature(argsJson, timestamp);

//     const params = new URLSearchParams({
//       args: argsJson,
//       api_shared_key: this.config.sharedKey,
//       api_sig: signature,
//       timestamp,
//     });

//     const url = `${this.config.baseUrl}/command.${outputType}?${params}`;

//     try {
//       const response = await fetch(url);
//       if (!response.ok) {
//         throw new Error(`API request failed: ${response.status} ${response.statusText}`);
//       }

//       const contentType = response.headers.get('content-type');
//       if (outputType === 'json' && contentType?.includes('application/json')) {
//         return await response.json();
//       } else {
//         return await response.text();
//       }
//     } catch (error) {
//       console.error('API request error:', error);
//       throw error;
//     }
//   }

//   /**
//    * Get list of available quarters
//    */
//   async getQuarters(): Promise<any> {
//     return this.makeRequest('quarters', {});
//   }

//   /**
//    * Lookup stock by name or symbol
//    */
//   async lookupStock(params: { name?: string; symbol?: string }): Promise<any> {
//     if (!params.name && !params.symbol) {
//       throw new Error('Either name or symbol must be provided');
//     }
//     return this.makeRequest('stock_lookup', params);
//   }

//   /**
//    * Lookup filer by various parameters
//    */
//   async lookupFiler(params: {
//     name?: string;
//     cik?: string;
//     id?: number;
//     city?: string;
//     state?: string;
//     state_incorporation?: string;
//     business_phone?: string;
//     irs_number?: string;
//     offset?: number;
//   }): Promise<any> {
//     return this.makeRequest('filer_lookup', params);
//   }

//   /**
//    * Get holdings for specific filers
//    */
//   async getHoldings(params: {
//     filer_ids: number[];
//     include_13d?: number;
//     quarter_ids?: number[];
//   }): Promise<any> {
//     return this.makeRequest('holdings', params);
//   }

//   /**
//    * Get holders for specific stocks
//    */
//   async getHolders(params: {
//     stock_ids: number[];
//     filer_ids?: number[];
//     quarter_ids?: number[];
//     include_13d?: number;
//     hedge_funds_only?: number;
//     sort?: string;
//     dir?: 'ASC' | 'DESC';
//     limit?: number;
//     columns?: number[];
//   }): Promise<any> {
//     return this.makeRequest('holders', params);
//   }

//   /**
//    * Get filer metadata
//    */
//   async getFilerMetadata(filerId: number): Promise<any> {
//     return this.makeRequest('filer_metadata', { filer_id: filerId });
//   }

//   /**
//    * Compare stock holdings between quarters
//    */
//   async compareStocks(params: {
//     stockid: number;
//     q1id: number;
//     q2id: number;
//     order?: string;
//   }): Promise<any> {
//     return this.makeRequest('stock_comparison', params);
//   }

//   /**
//    * Compare holdings between filers
//    */
//   async compareHoldings(params: {
//     filer_ids: number[];
//     quarter_id: number;
//     order?: string;
//     include_13d?: number;
//   }): Promise<any> {
//     return this.makeRequest('holdings_comparison', params);
//   }
// }
