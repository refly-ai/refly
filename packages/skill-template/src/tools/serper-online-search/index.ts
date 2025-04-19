import { Tool } from '@langchain/core/tools';
import { BaseToolParams } from '../../base';
import { SkillEngine } from '../../engine';
import { User } from '@refly/openapi-schema';

export interface SerperSearchParameters extends BaseToolParams {
  user: User;
  locale: string;
  maxResults?: number;
}

export class SerperSearch extends Tool {
  private params: SerperSearchParameters;
  private engine: SkillEngine;
  private user: User;

  constructor(params: SerperSearchParameters) {
    super(params ?? {});

    this.engine = params.engine;
    this.user = params.user;
    this.params = params;
  }

  static lc_name() {
    return 'SerperSearch';
  }

  name = 'serper_search';

  description =
    'A search engine. Useful for when you need to answer questions about current events. Input should be a search query.';

  async _call(input: string): Promise<string> {
    const res = await this.engine.service.webSearch(this.user, {
      q: input,
      hl: this?.params?.locale || 'en',
      limit: this.params.maxResults,
    });

    return JSON.stringify(res);
  }
}
