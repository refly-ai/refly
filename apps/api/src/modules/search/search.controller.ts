import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  User,
  MultiLingualWebSearchRequest,
  SearchRequest,
  SearchResponse,
  MultiLingualWebSearchResponse,
} from '@refly/openapi-schema';

import { buildSuccessResponse } from '../../utils';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { SearchService } from '../search/search.service';

@Controller('v1/search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async search(@LoginedUser() user: User, @Body() body: SearchRequest): Promise<SearchResponse> {
    return buildSuccessResponse(await this.searchService.search(user, body));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/multilingualSearch')
  async multiLingualWebSearch(
    @LoginedUser() user: User,
    @Body() body: MultiLingualWebSearchRequest,
  ): Promise<MultiLingualWebSearchResponse> {
    const result = await this.searchService.multiLingualWebSearch(user, body);
    return buildSuccessResponse(result);
  }
}
