import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CanvasService } from './canvas.service';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { canvasPO2DTO } from '../canvas/canvas.dto';
import { buildSuccessResponse } from '../../utils';
import {
  User,
  UpsertCanvasRequest,
  DeleteCanvasRequest,
  AutoNameCanvasRequest,
  AutoNameCanvasResponse,
  DuplicateCanvasRequest,
  SyncCanvasStateRequest,
  GetCanvasStateResponse,
  BaseResponse,
  GetCanvasTransactionsResponse,
  CreateCanvasVersionRequest,
  CreateCanvasVersionResponse,
  SetCanvasStateRequest,
  ImportCanvasRequest,
  ExportCanvasResponse,
  WorkflowVariable,
  GetCanvasDataResponse,
  ListOrder,
  ListCanvasResponse,
  SyncCanvasStateResponse,
} from '@refly/openapi-schema';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('v1/canvas')
export class CanvasController {
  constructor(
    private canvasService: CanvasService,
    private canvasSyncService: CanvasSyncService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async listCanvases(
    @LoginedUser() user: User,
    @Query('projectId') projectId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('order', new DefaultValuePipe('updationDesc')) order: ListOrder,
    @Query('keyword') keyword: string,
  ): Promise<ListCanvasResponse> {
    const canvases = await this.canvasService.listCanvases(user, {
      page,
      pageSize,
      projectId,
      order,
      keyword,
    });
    return buildSuccessResponse(canvases.map(canvasPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Get('detail')
  async getCanvasDetail(@LoginedUser() user: User, @Query('canvasId') canvasId: string) {
    const canvas = await this.canvasService.getCanvasDetail(user, canvasId);
    return buildSuccessResponse(canvasPO2DTO(canvas));
  }

  @UseGuards(JwtAuthGuard)
  @Get('data')
  async getCanvasData(
    @LoginedUser() user: User,
    @Query('canvasId') canvasId: string,
  ): Promise<GetCanvasDataResponse> {
    const data = await this.canvasService.getCanvasRawData(user, canvasId);
    return buildSuccessResponse(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('duplicate')
  async duplicateCanvas(@LoginedUser() user: User, @Body() body: DuplicateCanvasRequest) {
    const canvas = await this.canvasService.duplicateCanvas(user, body, { checkOwnership: true });
    return buildSuccessResponse(canvasPO2DTO(canvas));
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
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/json') {
          return cb(new BadRequestException('Only JSON files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  @Post('import')
  async importCanvas(
    @LoginedUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportCanvasRequest,
  ) {
    const canvas = await this.canvasService.importCanvas(user, {
      file: file.buffer,
      canvasId: body.canvasId,
    });
    return buildSuccessResponse(canvasPO2DTO(canvas));
  }

  @UseGuards(JwtAuthGuard)
  @Get('export')
  async exportCanvas(
    @LoginedUser() user: User,
    @Query('canvasId') canvasId: string,
  ): Promise<ExportCanvasResponse> {
    const downloadUrl = await this.canvasService.exportCanvas(user, canvasId);
    return buildSuccessResponse({ downloadUrl });
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

  @UseGuards(JwtAuthGuard)
  @Get('getState')
  async getCanvasState(
    @LoginedUser() user: User,
    @Query('canvasId') canvasId: string,
    @Query('version') version?: string,
  ): Promise<GetCanvasStateResponse> {
    const state = await this.canvasSyncService.getState(user, { canvasId, version });
    return buildSuccessResponse(state);
  }

  @UseGuards(JwtAuthGuard)
  @Post('setState')
  async setCanvasState(
    @LoginedUser() user: User,
    @Body() body: SetCanvasStateRequest,
  ): Promise<BaseResponse> {
    await this.canvasSyncService.setState(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Get('getTx')
  async getCanvasTransactions(
    @LoginedUser() user: User,
    @Query('canvasId') canvasId: string,
    @Query('version') version?: string,
    @Query('since', new DefaultValuePipe(0), ParseIntPipe) since?: number,
  ): Promise<GetCanvasTransactionsResponse> {
    const transactions = await this.canvasSyncService.getTransactions(user, {
      canvasId,
      version,
      since,
    });
    return buildSuccessResponse(transactions);
  }

  @UseGuards(JwtAuthGuard)
  @Post('syncState')
  async syncCanvasState(
    @LoginedUser() user: User,
    @Body() body: SyncCanvasStateRequest,
  ): Promise<SyncCanvasStateResponse> {
    const result = await this.canvasSyncService.syncState(user, body);
    return buildSuccessResponse(result);
  }

  @UseGuards(JwtAuthGuard)
  @Post('createVersion')
  async createCanvasVersion(
    @LoginedUser() user: User,
    @Body() body: CreateCanvasVersionRequest,
  ): Promise<CreateCanvasVersionResponse> {
    const result = await this.canvasSyncService.createCanvasVersion(user, body);
    return buildSuccessResponse(result);
  }

  @UseGuards(JwtAuthGuard)
  @Get('workflow/variables')
  async getWorkflowVariables(@LoginedUser() user: User, @Query('canvasId') canvasId: string) {
    const variables = await this.canvasService.getWorkflowVariables(user, { canvasId });
    return buildSuccessResponse(variables);
  }

  @UseGuards(JwtAuthGuard)
  @Post('workflow/variables')
  async updateWorkflowVariables(
    @LoginedUser() user: User,
    @Body() body: { canvasId: string; variables: WorkflowVariable[] },
  ) {
    const variables = await this.canvasService.updateWorkflowVariables(user, body);
    return buildSuccessResponse(variables);
  }
}
