// Jina API Client
// Generated from OpenAPI schema v1

export interface JinaConfig {
  apiKey: string;
}

class JinaError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any,
  ) {
    super(message);
    this.name = 'JinaError';
  }
}

export class JinaClient {
  private config: Required<JinaConfig>;

  constructor(config: JinaConfig) {
    this.config = { apiKey: config.apiKey };
  }

  async read(endpoint: string, returnFormat: string): Promise<any> {
    const url = `https://r.jina.ai/${endpoint}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        'X-Return-Format': returnFormat,
      },
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // Ignore JSON parsing errors
      }

      throw new JinaError(
        errorData.error ?? `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData,
      );
    }

    return response.json();
  }

  /**
   * Perform a search using Jina's SERP API.
   * If readFullContent is false, add 'X-Respond-With': 'no-content'.
   * If readFullContent is true, add 'X-Engine': 'direct'.
   */
  async serp(
    query: string,
    readFullContent: boolean,
    site?: string,
    offset?: number,
  ): Promise<any> {
    const url = 'https://s.jina.ai/';

    // Build headers based on readFullContent flag
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config?.apiKey ?? ''}`,
    };

    if (readFullContent === false) {
      headers['X-Respond-With'] = 'no-content';
    } else {
      headers['X-Engine'] = 'direct';
    }

    if (site) {
      headers['X-Site'] = site;
    }

    const requestInit: RequestInit = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ q: query, page: offset }),
    };

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // Ignore JSON parsing errors
      }
      throw new JinaError(
        errorData?.error ?? `HTTP ${response.status}: ${response.statusText}`,
        response.status,
      );
    }

    return response.json();
  }
}
