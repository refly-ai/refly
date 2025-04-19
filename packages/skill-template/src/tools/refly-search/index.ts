import { Tool } from '@langchain/core/tools';
import { SearchDomain, SearchMode, User, Entity } from '@refly/openapi-schema';
import { BaseToolParams } from '../../base';
import { SkillEngine } from '../../engine';

export interface ReflySearchParameters extends BaseToolParams {
  user: User;
  domains: SearchDomain[];
  mode: SearchMode;
  entities?: Entity[];
}

export class ReflySearch extends Tool {
  private engine: SkillEngine;
  private user: User;
  private params: ReflySearchParameters;

  name = 'refly_search';

  description = 'Refly search can be used to search everything within Refly.';

  constructor(params: ReflySearchParameters) {
    super(params ?? {});

    this.engine = params.engine;
    this.user = params.user;
    this.params = params;
  }

  static lc_name() {
    return 'ReflySearch';
  }

  async _call(input: string): Promise<string> {
    const res = await this.engine.service.search(
      this.user,
      {
        query: input,
        domains: this.params.domains,
        mode: this.params.mode,
        entities: this.params.entities,
      },
      { enableReranker: true },
    );
    return JSON.stringify(res);
  }
}
