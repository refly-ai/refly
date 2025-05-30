import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RAGService } from './rag.service';
import { createMock } from '@golevelup/ts-jest';
import { VectorSearchService } from '../common/vector-search';
import { VECTOR_SEARCH } from '../common/vector-search/tokens';
import { ProviderService } from '../provider/provider.service';

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

  const vectorSearchService = createMock<VectorSearchService>();
  const providerService = createMock<ProviderService>();

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
        { provide: VECTOR_SEARCH, useValue: vectorSearchService },
        { provide: ProviderService, useValue: providerService },
      ],
    }).compile();

    service = module.get<RAGService>(RAGService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
