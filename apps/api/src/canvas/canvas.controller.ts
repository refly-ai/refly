import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { CanvasService } from './canvas.service';
import { LoginedUser } from '@/utils/decorators/user.decorator';
import { canvasPO2DTO } from '@/canvas/canvas.dto';
import { buildSuccessResponse } from '@/utils';
import {
  User,
  UpsertCanvasRequest,
  DeleteCanvasRequest,
  AutoNameCanvasRequest,
  AutoNameCanvasResponse,
} from '@refly-packages/openapi-schema';

@Controller('v1/canvas')
export class CanvasController {
  constructor(private canvasService: CanvasService) {}

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async listCanvases(
    @LoginedUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    const canvases = await this.canvasService.listCanvases(user, { page, pageSize });
    return buildSuccessResponse(canvases.map(canvasPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createCanvas(@LoginedUser() user: User, @Body() body: UpsertCanvasRequest) {
    const canvas = await this.canvasService.createCanvas(user, body);
    return buildSuccessResponse(canvasPO2DTO(canvas));
  }

  @UseGuards(JwtAuthGuard)
  @Post('update')
  async updateCanvas(@LoginedUser() user: User, @Body() body: UpsertCanvasRequest) {
    const canvas = await this.canvasService.updateCanvas(user, body);
    return buildSuccessResponse(canvasPO2DTO(canvas));
  }

  @UseGuards(JwtAuthGuard)
  @Post('delete')
  async deleteCanvas(@LoginedUser() user: User, @Body() body: DeleteCanvasRequest) {
    await this.canvasService.deleteCanvas(user, body);
    return buildSuccessResponse({});
  }

  @UseGuards(JwtAuthGuard)
  @Post('autoName')
  async autoNameCanvas(
    @LoginedUser() user: User,
    @Body() body: AutoNameCanvasRequest,
  ): Promise<AutoNameCanvasResponse> {
    const data = await this.canvasService.autoNameCanvas(user, body);
    return buildSuccessResponse(data);
  }
}
