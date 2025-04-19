import { Test, TestingModule } from '@nestjs/testing';
import { CanvasController } from './canvas.controller';
import { CanvasService } from './canvas.service';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

describe('CanvasController', () => {
  let controller: CanvasController;

  const canvasService = createMock<CanvasService>();
  const configService = createMock<ConfigService>();
  const jwtService = createMock<JwtService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CanvasController],
      providers: [
        { provide: CanvasService, useValue: canvasService },
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    controller = module.get<CanvasController>(CanvasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
