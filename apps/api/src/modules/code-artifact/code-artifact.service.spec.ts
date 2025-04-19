import { Test, TestingModule } from '@nestjs/testing';
import { CodeArtifactService } from './code-artifact.service';

describe('CodeArtifactService', () => {
  let service: CodeArtifactService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CodeArtifactService],
    }).compile();

    service = module.get<CodeArtifactService>(CodeArtifactService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
