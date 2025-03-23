/**
 * 测试Xinference重排序功能
 * 
 * 使用方法:
 * 1. 确保Xinference服务运行在http://192.168.3.12:9997
 * 2. 确保bge-reranker-v2-m3模型已加载
 * 3. 执行 `ts-node test-rerank.ts`
 */

// 不再使用node-fetch，改用内置的fetch API
// import fetch from 'node-fetch';

// 模拟SearchResult接口
interface SearchResult {
  id: string;
  title: string;
  snippets: { text: string }[];
  relevanceScore?: number;
}

// Xinference响应接口
interface XinferenceRerankerResponse {
  id: string;
  results: {
    index: number;
    relevance_score: number;
    document: string;
  }[];
}

async function testXinferenceRerank() {
  console.log('开始测试Xinference重排序功能...');

  // 准备测试数据
  const query = "人工智能的应用";
  const testResults: SearchResult[] = [
    {
      id: '1',
      title: 'AI在医疗中的应用',
      snippets: [{ text: '人工智能在医疗领域有广泛应用，包括疾病诊断、药物研发和医学影像分析。' }],
    },
    {
      id: '2',
      title: '自动驾驶技术进展',
      snippets: [{ text: '自动驾驶是人工智能在交通领域的重要应用，Tesla和Waymo等公司在这方面取得了重大进展。' }],
    },
    {
      id: '3',
      title: '太阳系行星介绍',
      snippets: [{ text: '太阳系有八大行星，包括水星、金星、地球、火星、木星、土星、天王星和海王星。' }],
    },
    {
      id: '4',
      title: '人工智能伦理问题',
      snippets: [{ text: '随着人工智能的发展，伦理问题变得越来越重要，包括隐私保护、算法偏见和失业风险等。' }],
    },
  ];

  // 从SearchResult中提取文档内容
  const contentMap = new Map<string, SearchResult>();
  for (const r of testResults) {
    contentMap.set(r.snippets.map((s) => s.text).join('\n\n'), r);
  }

  // 构建请求负载
  const payload = JSON.stringify({
    model: 'bge-reranker-v2-m3',
    query: query,
    documents: Array.from(contentMap.keys()),
  });

  try {
    console.log('发送请求到Xinference API...');
    // 调用Xinference API
    const res = await fetch('http://192.168.3.12:9997/v1/rerank', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    if (!res.ok) {
      throw new Error(`Xinference API 错误: ${res.status} ${res.statusText}`);
    }

    // 处理响应
    const data = await res.json() as XinferenceRerankerResponse;
    console.log('Xinference API响应:');
    console.log(JSON.stringify(data, null, 2));

    // 重排序结果
    const relevanceThreshold = 0.1; // 设置相关性阈值
    const rerankedResults = data.results
      .filter((r) => r.relevance_score >= relevanceThreshold)
      .map((r) => {
        const originalResult = contentMap.get(r.document);
        return {
          ...originalResult,
          relevanceScore: r.relevance_score,
        } as SearchResult;
      });

    console.log('\n重排序后的结果:');
    rerankedResults.forEach((result, index) => {
      console.log(`${index + 1}. [分数: ${result.relevanceScore?.toFixed(4)}] ${result.title}`);
      console.log(`   ${result.snippets[0].text}\n`);
    });

    console.log('测试完成!');
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 执行测试
testXinferenceRerank(); 