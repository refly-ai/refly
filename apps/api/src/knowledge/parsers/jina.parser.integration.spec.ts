import { JinaParser } from './jina.parser';

/**
 * 这是一个集成测试，验证JinaParser在真实环境中的行为
 * 默认跳过此测试，只在需要手动验证时运行
 * 运行命令: jest -t "JinaParser 集成测试" --no-skip
 */
describe.skip('JinaParser 集成测试', () => {
  let jinaParser: JinaParser;
  let jinaNodeParser: JinaParser;

  beforeEach(() => {
    // 创建解析器实例，一个默认，一个强制使用Node
    jinaParser = new JinaParser();
    jinaNodeParser = new JinaParser({ useNodeFallback: true });
  });

  it('应该使用Python/Trafilatura解析网页内容', async () => {
    // 一个简单的测试URL
    const url = 'https://github.blog/2019-03-29-leader-spotlight-erin-spiceland/';
    
    console.log('开始使用Python/Trafilatura解析...');
    const result = await jinaParser.parse(url);
    
    console.log('解析结果：');
    console.log('标题:', result.title);
    console.log('内容摘要:', result.content?.substring(0, 100) + '...');
    console.log('作者:', result.metadata?.author);
    console.log('日期:', result.metadata?.date);
    
    // 基本验证
    expect(result.title).toBeTruthy();
    expect(result.content).toBeTruthy();
    expect(result.content.length).toBeGreaterThan(100);
  }, 30000); // 延长超时时间为30秒

  it('应该使用Node.js解析网页内容', async () => {
    // 一个简单的测试URL
    const url = 'https://github.blog/2019-03-29-leader-spotlight-erin-spiceland/';
    
    console.log('开始使用Node.js解析...');
    const result = await jinaNodeParser.parse(url);
    
    console.log('解析结果：');
    console.log('标题:', result.title);
    console.log('内容摘要:', result.content?.substring(0, 100) + '...');
    console.log('作者:', result.metadata?.author);
    console.log('日期:', result.metadata?.date);
    
    // 基本验证
    expect(result.title).toBeTruthy();
    expect(result.content).toBeTruthy();
    expect(result.content.length).toBeGreaterThan(100);
  }, 30000); // 延长超时时间为30秒

  it('应该能够解析不同类型的网页', async () => {
    // 测试不同类型的网页
    const urls = [
      'https://www.bbc.com/news',
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
      'https://medium.com/topic/technology'
    ];
    
    for (const url of urls) {
      console.log(`\n开始解析 ${url}...`);
      
      // 默认解析器（优先Python/Trafilatura）
      console.log('使用默认解析器：');
      const result1 = await jinaParser.parse(url);
      console.log('标题:', result1.title);
      console.log('内容长度:', result1.content?.length);
      
      // Node.js解析器
      console.log('使用Node.js解析器：');
      const result2 = await jinaNodeParser.parse(url);
      console.log('标题:', result2.title);
      console.log('内容长度:', result2.content?.length);
      
      // 基本验证
      expect(result1.content || result2.content).toBeTruthy();
    }
  }, 90000); // 延长超时时间为90秒
}); 