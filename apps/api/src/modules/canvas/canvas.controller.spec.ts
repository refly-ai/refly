import { Test, TestingModule } from '@nestjs/testing';
import { CanvasController } from './canvas.controller';
import { CanvasService } from './canvas.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

describe('CanvasController', () => {
  let controller: CanvasController;

  const canvasService = createMock<CanvasService>();
  const canvasSyncService = createMock<CanvasSyncService>();
  const configService = createMock<ConfigService>();
  const jwtService = createMock<JwtService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CanvasController],
      providers: [
        { provide: CanvasService, useValue: canvasService },
        { provide: CanvasSyncService, useValue: canvasSyncService },
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    controller = module.get<CanvasController>(CanvasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('importCanvas', () => {
    it('should import a canvas successfully', async () => {
      const mockFile = {
        buffer: Buffer.from(
          JSON.stringify({
            title: 'Test Canvas',
            nodes: [],
            edges: [],
          }),
        ),
      } as Express.Multer.File;

      const mockCanvas = {
        pk: BigInt(1),
        canvasId: 'test-canvas-id',
        uid: 'test-uid',
        title: 'Test Canvas',
        storageSize: BigInt(0),
        version: '1.0.0',
        stateStorageKey: 'test-state-key',
        minimapStorageKey: 'test-minimap-key',
        readOnly: false,
        isPublic: false,
        status: 'ready',
        visibility: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        projectId: null,
        workflow: JSON.stringify({ variables: [] }),
      };

      const mockUser = { uid: 'test-uid' };

      canvasService.importCanvas.mockResolvedValue(mockCanvas);

      const result = await controller.importCanvas(mockUser, mockFile, {
        canvasId: 'test-canvas-id',
      } as any);

      expect(canvasService.importCanvas).toHaveBeenCalledWith(mockUser, {
        file: mockFile.buffer,
        canvasId: 'test-canvas-id',
      });
      expect(result).toBeDefined();
    });
  });
});
