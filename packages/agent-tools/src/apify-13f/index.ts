import { z } from 'zod/v3';
import { ApifyClient, ActorRun } from 'apify-client';
import type { ToolParams } from '@langchain/core/tools';
import {
  AgentBaseTool,
  AgentBaseToolset,
  type AgentToolConstructor,
  type ToolCallResult,
} from '../base';
import type {
  ToolsetDefinition,
  User,
  EntityType,
  FileVisibility,
  UploadResponse,
} from '@refly/openapi-schema';

// Types for actor pricing and search results

/**
 * Calculate credit cost based on Apify Actor pricing for 13F Actor
 * 1 USD = 140 credits, round up to minimum 1 credit
 * Special handling for PRICE_PER_DATASET_ITEM pricing ($2.00 / 1,000 reports)
 */
function calculate13FCreditCost(run: ActorRun, itemsLength?: number): number {
  // Priority 1: Use usageTotalUsd if available
  if (run.usageTotalUsd !== undefined) {
    const costInCredits = run.usageTotalUsd * 140;
    return Math.max(1, Math.ceil(costInCredits));
  }

  // Priority 2: Calculate based on pricing model
  if (!run.pricingInfo) {
    return 0; // No pricing info means free
  }

  const pricingInfo = run.pricingInfo;
  let totalCostUsd = 0;

  switch (pricingInfo.pricingModel) {
    case 'PRICE_PER_DATASET_ITEM':
      // Special pricing for 13F Actor: $2.00 / 1,000 reports
      if (itemsLength !== undefined) {
        totalCostUsd = (itemsLength / 1000) * 2.0;
      }
      break;

    case 'FREE':
      totalCostUsd = 0;
      break;

    case 'PAY_PER_EVENT':
      if (run.chargedEventCounts) {
        const { pricingPerEvent } = pricingInfo;
        totalCostUsd = Object.entries(run.chargedEventCounts).reduce((total, [eventKey, count]) => {
          const eventPrice = pricingPerEvent.actorChargeEvents[eventKey]?.eventPriceUsd || 0;
          return total + eventPrice * count;
        }, 0);
      }
      break;

    case 'FLAT_PRICE_PER_MONTH':
      // Monthly pricing - for single runs, we might need to prorate, but for now use the full price
      totalCostUsd = pricingInfo.pricePerUnitUsd ?? (itemsLength ?? 0) * 0.002;
      break;

    default:
      totalCostUsd = 0;
  }

  // Apply minimum charge if specified
  if (
    pricingInfo.pricingModel === 'PAY_PER_EVENT' &&
    pricingInfo.minimalMaxTotalChargeUsd !== undefined
  ) {
    totalCostUsd = Math.max(totalCostUsd, pricingInfo.minimalMaxTotalChargeUsd);
  }

  // Convert to credits: 1 USD = 140 credits, minimum 1 credit
  const costInCredits = totalCostUsd * 140;
  return Math.max(1, Math.ceil(costInCredits));
}

// Toolset definition for 13F Actor
export const Apify13FToolsetDefinition: ToolsetDefinition = {
  key: 'apify-13f',
  domain: 'https://apify.com',
  labelDict: {
    en: 'SEC 13F Reports',
    'zh-CN': 'SEC 13F 报告',
  },
  descriptionDict: {
    en: 'Get SEC 13F quarterly reports for investment managers',
    'zh-CN': '获取投资管理人的 SEC 13F 季度报告',
  },
  tools: [
    {
      name: 'run13FActor',
      descriptionDict: {
        en: 'Run the SEC 13F Manager Quarterly Report Scraper Actor to get 13F filing data for a specific manager and quarter. Pricing: $2.00 per 1,000 reports.',
        'zh-CN':
          '运行 SEC 13F 管理人季度报告抓取器 Actor，获取特定管理人和季度的 13F 申报数据。定价：每 1,000 份报告 $2.00。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'credentials',
      credentialItems: [
        {
          key: 'apiToken',
          inputMode: 'text',
          inputProps: { passwordType: true },
          labelDict: { en: 'API Token', 'zh-CN': 'API 令牌' },
          descriptionDict: { en: 'Apify API token', 'zh-CN': 'Apify 的 API 令牌' },
          required: true,
        },
      ],
    },
  ],
  configItems: [],
};

export interface ReflyService {
  uploadFile: (
    user: User,
    param: {
      file: { buffer: Buffer; mimetype?: string; originalname: string };
      entityId?: string;
      entityType?: EntityType;
      visibility?: FileVisibility;
      storageKey?: string;
    },
  ) => Promise<UploadResponse['data']>;
  genImageID: () => Promise<string>;
  uploadBase64: (
    user: User,
    param: {
      base64: string;
      filename?: string;
      entityId?: string;
      entityType?: EntityType;
      visibility?: FileVisibility;
      storageKey?: string;
    },
  ) => Promise<UploadResponse['data']>;
}

interface Apify13FToolParams extends ToolParams {
  apiToken: string;
  user: User;
  reflyService: ReflyService;
}

// run13FActor
export class ApifyRun13FActor extends AgentBaseTool<Apify13FToolParams> {
  name = 'run13FActor';
  toolsetKey = Apify13FToolsetDefinition.key;

  schema = z.object({
    manager_name: z.string().describe("Enter a manager's name which is used to search on 13F"),
    quarter_year: z.string().describe('Enter quarter year, e.g. Q2 2024'),
  });

  description =
    'Run the SEC 13F Manager Quarterly Report Scraper Actor to get 13F filing data for a specific manager and quarter.';

  protected params: Apify13FToolParams;

  constructor(params: Apify13FToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new ApifyClient({
        token: this.params?.apiToken ?? '',
      });

      // Run the 13F Actor with specific input
      const actorInput = {
        manager_name: input.manager_name,
        quarter_year: input.quarter_year,
      };

      const run = await client
        .actor('kenshinsee/sec-13f-manager-quarterly-report-scraper')
        .call(actorInput);

      // Fetch and return Actor results from the run's dataset
      const v = await client.dataset(run.defaultDatasetId).listItems();

      if (!v) {
        return {
          status: 'error',
          error: 'Dataset not found',
          summary: `Dataset '${run.defaultDatasetId}' not found.`,
        };
      }

      // Convert dataset items to CSV and upload via Refly service
      const items = Array.isArray(v?.items) ? (v.items as Record<string, any>[]) : [];

      // Helper to convert items to CSV string
      const toCsv = (rows: Record<string, any>[]): string => {
        if (!Array.isArray(rows) || rows.length === 0) {
          return '';
        }

        const headers: string[] = [];
        for (const row of rows) {
          const keys = Object.keys(row ?? {});
          for (const key of keys) {
            if (!headers.includes(key)) headers.push(key);
          }
        }

        const escapeValue = (value: unknown): string => {
          if (value == null) return '';
          const normalized =
            typeof value === 'object' ? (JSON.stringify(value) ?? '') : String(value ?? '');
          const escaped = normalized.replace(/"/g, '""');
          const needsQuotes = /[",\n\r]/.test(escaped);
          return needsQuotes ? `"${escaped}"` : escaped;
        };

        const lines: string[] = [];
        lines.push(headers.join(','));
        for (const row of rows) {
          const values = headers.map((h) => escapeValue((row as Record<string, any>)?.[h]));
          lines.push(values.join(','));
        }
        return lines.join('\n');
      };

      // Upload generated CSV file and include file metadata in response
      // Instead of creating canvas nodes directly, we put file info in the response
      // so downstream tools (like sandbox) can discover and consume the files
      let storageKey: string | undefined;
      let fileUrl: string | undefined;
      let filename: string | undefined;

      try {
        const csv = toCsv(items);
        const buffer = Buffer.from(csv ?? '', 'utf8');
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `13f-${input.manager_name.replace(/\s+/g, '-').toLowerCase()}-${input.quarter_year.replace(/\s+/g, '-').toLowerCase()}-${ts}.csv`;

        // Generate unique entity ID for the file
        const entityId = await this.params?.reflyService?.genImageID?.();

        const uploadRes = await this.params?.reflyService?.uploadFile?.(this.params?.user, {
          file: { buffer, mimetype: 'text/csv', originalname: filename },
          entityId,
        });

        if (uploadRes) {
          storageKey = uploadRes.storageKey;
          fileUrl = uploadRes.url;
        }
      } catch (error) {
        // Log upload errors but continue returning the dataset items
        console.error('Failed to upload CSV file:', error);
        storageKey = undefined;
        fileUrl = undefined;
      }

      // Calculate credit cost for PRICE_PER_DATASET_ITEM pricing ($2.00 / 1,000 reports)
      const creditCost = calculate13FCreditCost(run, items.length);

      // Prepare file metadata for downstream consumption
      const fileMetadata = storageKey
        ? {
            filename,
            storageKey,
            url: fileUrl,
            mimeType: 'text/csv',
            description: `13F quarterly report data for ${input.manager_name} (${input.quarter_year})`,
            recordCount: items.length,
          }
        : undefined;

      // Build a descriptive summary that includes file information
      // This allows AI and downstream tools to discover and use the file
      const summaryText = fileMetadata
        ? `Successfully retrieved ${items.length} 13F holdings reports for "${input.manager_name}" (${input.quarter_year}).

**Generated File:**
- Filename: ${fileMetadata.filename}
- Storage Key: ${fileMetadata.storageKey}
- URL: ${fileMetadata.url}
- Format: CSV
- Records: ${fileMetadata.recordCount}

The CSV file contains detailed holdings information including security names, values, shares, and position changes. You can use the storage key to download and process this file in downstream tools.`
        : `Successfully retrieved ${items.length} 13F holdings reports for "${input.manager_name}" (${input.quarter_year}), but file upload failed.`;

      return {
        status: 'success',
        data: {
          run,
          manager_name: input.manager_name,
          quarter_year: input.quarter_year,
          file: fileMetadata,
          itemCount: items.length,
        },
        creditCost,
        summary: summaryText,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error running 13F Actor',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while running 13F Actor',
      };
    }
  }
}

export class Apify13FToolset extends AgentBaseToolset<Apify13FToolParams> {
  toolsetKey = Apify13FToolsetDefinition.key;
  tools = [ApifyRun13FActor] satisfies readonly AgentToolConstructor<Apify13FToolParams>[];
}
