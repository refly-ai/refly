import { Test, TestingModule } from '@nestjs/testing';
import { CodeArtifactController } from './code-artifact.controller';

describe('CodeArtifactController', () => {
  let controller: CodeArtifactController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CodeArtifactController],
    }).compile();

    controller = module.get<CodeArtifactController>(CodeArtifactController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
