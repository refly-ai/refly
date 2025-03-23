import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { RAGService } from './rag.service';
import { QdrantService } from '@/common/qdrant.service';
import { SearchResult } from '@refly-packages/openapi-schema';

// 模拟全局fetch
global.fetch = jest.fn() as jest.Mock;

describe('RAGService', () => {
  let service: RAGService;
  let configService: ConfigService;

  // 模拟配置服务返回函数
  const mockConfigGet = (key: string) => {
    const config = {
      'reranker.topN': 5,
      'reranker.relevanceThreshold': 0.1,
      'embeddings.provider': 'jina',
      'embeddings.modelName': 'jina-embeddings-v2-base-zh',
      'embeddings.batchSize': 32,
      'embeddings.dimensions': 1000,
      'credentials.jina': 'mock-api-key',
    };
    return config[key];
  };

  beforeEach(async () => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RAGService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => mockConfigGet(key)),
            getOrThrow: jest.fn((key) => {
              const value = mockConfigGet(key);
              if (value === undefined) throw new Error(`Config key ${key} not found`);
              return value;
            }),
          },
        },
        {
          provide: QdrantService,
          useValue: {
            search: jest.fn(),
            scroll: jest.fn(),
            batchSaveData: jest.fn(),
            batchDelete: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RAGService>(RAGService);
    configService = module.get<ConfigService>(ConfigService);

    // 设置fetch模拟的默认实现
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
      status: 200,
      statusText: 'OK',
    });
  });

  describe('rerank', () => {
    it('应该使用Xinference API重排序搜索结果', async () => {
      // 准备测试数据
      const query = '人工智能的应用';
      const searchResults: SearchResult[] = [
        {
          id: '1',
          title: 'AI在医疗中的应用',
          domain: 'document',
          snippets: [{ text: '人工智能在医疗领域有广泛应用，包括疾病诊断、药物研发和医学影像分析。' }],
        },
        {
          id: '2',
          title: '编程语言排行榜',
          domain: 'document',
          snippets: [{ text: 'Python、JavaScript和Java持续占据编程语言受欢迎度排行榜前三名。' }],
        },
      ];

      // 模拟Xinference API响应
      const mockResponse = {
        id: 'mock-uuid',
        results: [
          { 
            index: 0,
            relevance_score: 0.95,
            document: '人工智能在医疗领域有广泛应用，包括疾病诊断、药物研发和医学影像分析。'
          },
          {
            index: 1,
            relevance_score: 0.05,
            document: 'Python、JavaScript和Java持续占据编程语言受欢迎度排行榜前三名。'
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
        status: 200,
        statusText: 'OK',
      });

      // 执行测试
      const result = await service.rerank(query, searchResults);

      // 验证结果
      expect(global.fetch).toHaveBeenCalledWith('http://192.168.3.12:9997/v1/rerank', {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
      });

      // 验证payload包含正确的数据
      const calledPayload = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(calledPayload).toEqual({
        model: 'bge-reranker-v2-m3',
        query: query,
        documents: searchResults.map(r => r.snippets?.map(s => s.text).join('\n\n')),
      });

      // 验证结果经过过滤和正确排序
      expect(result.length).toBe(1); // 只有一个结果的分数超过阈值0.1
      expect(result[0]?.id).toBe('1');
      expect(result[0]?.relevanceScore).toBe(0.95);
    });

    it('当API调用失败时应该回退到默认排序', async () => {
      // 准备测试数据
      const query = '测试查询';
      const searchResults: SearchResult[] = [
        {
          id: '1',
          title: '结果1',
          domain: 'document',
          snippets: [{ text: '内容1' }],
        },
        {
          id: '2',
          title: '结果2',
          domain: 'document',
          snippets: [{ text: '内容2' }],
        },
      ];

      // 模拟API调用失败
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API调用失败'));

      // 执行测试
      const result = await service.rerank(query, searchResults);

      // 验证结果
      expect(result.length).toBe(2);
      expect(result[0]?.id).toBe('1');
      expect(result[0]?.relevanceScore).toBe(1);
      expect(result[1]?.id).toBe('2');
      expect(result[1]?.relevanceScore).toBe(0.9);
    });
  });
});
