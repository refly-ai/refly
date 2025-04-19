import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RAGService } from './rag.service';
import { createMock } from '@golevelup/ts-jest';
import { QdrantService } from '../common/qdrant.service';

const mockConfig = (key: string) => {
  switch (key) {
    case 'embeddings.provider':
      return 'jina';
    default:
      return null;
  }
};

describe('RAGService', () => {
  let service: RAGService;

  const qdrantService = createMock<QdrantService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RAGService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(mockConfig),
            getOrThrow: jest.fn(mockConfig),
          },
        },
        { provide: QdrantService, useValue: qdrantService },
      ],
    }).compile();

    service = module.get<RAGService>(RAGService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
