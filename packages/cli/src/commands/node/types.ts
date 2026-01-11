/**
 * refly node types - List available node types
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { getCacheDir } from '../../config/paths.js';
import { CLIError } from '../../utils/errors.js';

interface NodeType {
  name: string;
  description: string;
  category: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

interface NodeTypesResponse {
  types: NodeType[];
  version: string;
}

const CACHE_FILE = 'node-types.json';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const nodeTypesCommand = new Command('types')
  .description('List available node types')
  .option('--refresh', 'Force refresh from API')
  .option('--category <category>', 'Filter by category')
  .action(async (options) => {
    try {
      let data: NodeTypesResponse;

      // Try cache first
      if (!options.refresh) {
        const cached = loadFromCache();
        if (cached) {
          data = cached;
        } else {
          data = await fetchAndCache();
        }
      } else {
        data = await fetchAndCache();
      }

      // Filter by category if specified
      let types = data.types;
      if (options.category) {
        types = types.filter((t) => t.category.toLowerCase() === options.category.toLowerCase());
      }

      ok('node.types', {
        types,
        total: types.length,
        version: data.version,
        categories: [...new Set(data.types.map((t) => t.category))],
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get node types',
      );
    }
  });

function getCachePath(): string {
  return path.join(getCacheDir(), CACHE_FILE);
}

function loadFromCache(): NodeTypesResponse | null {
  try {
    const cachePath = getCachePath();
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    const stat = fs.statSync(cachePath);
    const age = Date.now() - stat.mtimeMs;
    if (age > CACHE_TTL) {
      return null;
    }

    const content = fs.readFileSync(cachePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function fetchAndCache(): Promise<NodeTypesResponse> {
  const data = await apiRequest<NodeTypesResponse>('/v1/cli/node/types');

  // Save to cache
  try {
    const cachePath = getCachePath();
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
  } catch {
    // Ignore cache write errors
  }

  return data;
}
