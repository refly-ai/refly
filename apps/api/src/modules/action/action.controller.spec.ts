import { Test, TestingModule } from '@nestjs/testing';
import { ActionController } from './action.controller';
import { ActionService } from './action.service';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

describe('ActionController', () => {
  let controller: ActionController;

  const actionService = createMock<ActionService>();
  const configService = createMock<ConfigService>();
  const jwtService = createMock<JwtService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActionController],
      providers: [
        { provide: ActionService, useValue: actionService },
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    controller = module.get<ActionController>(ActionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
