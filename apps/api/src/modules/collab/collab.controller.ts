import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CollabService } from './collab.service';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { GetCollabTokenResponse, User } from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils/response';

@Controller('v1/collab')
export class CollabController {
  constructor(private readonly collabService: CollabService) {}

  @UseGuards(JwtAuthGuard)
  @Get('getToken')
  async getToken(@LoginedUser() user: User): Promise<GetCollabTokenResponse> {
    const { token, expiresAt } = await this.collabService.signCollabToken(user);
    return buildSuccessResponse({ token, expiresAt });
  }

  // @UseGuards(JwtAuthGuard)
  // @Get('loadDocument')
  // async loadDocument(@LoginedUser() user: User, @Query('name') name: string) {
  //   const data = await this.collabService.loadDocument({ documentName: name });
  //   return buildSuccessResponse({ documentId });
  // }

  // @UseGuards(JwtAuthGuard)
  // @Post('storeDocument')
  // async storeDocument(@LoginedUser() user: User, @Query('documentId') documentId: string) {
  //   return buildSuccessResponse({ documentId });
  // }
}
