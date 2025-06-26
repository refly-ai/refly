import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { RAGService } from '../rag/rag.service';
import { FULLTEXT_SEARCH, FulltextSearchService } from '../common/fulltext-search';

describe('SearchService', () => {
  let service: SearchService;

  const configService = createMock<ConfigService>();
  const prismaService = createMock<PrismaService>();
  const fts = createMock<FulltextSearchService>();
  const ragService = createMock<RAGService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prismaService },
        { provide: FULLTEXT_SEARCH, useValue: fts },
        { provide: RAGService, useValue: ragService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
