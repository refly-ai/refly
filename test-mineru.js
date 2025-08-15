// 测试 MinerU 解析器
const { MineruParser } = require('./apps/api/src/modules/knowledge/parsers/mineru.parser.ts');

async function testMineruParser() {
  console.log('🧪 测试 MinerU 解析器...');

  try {
    // 创建 MinerU 解析器实例（使用 mock 模式）
    const parser = new MineruParser({
      mockMode: true,
      apiKey: 'test-key',
      useBatchUpload: true,
      isOcr: false,
      enableFormula: true,
      enableTable: true,
      language: 'ch',
    });

    console.log('✅ MinerU 解析器创建成功');
    console.log('📝 解析器名称:', parser.name);

    // 测试解析功能
    const testInput = '这是一个测试文档';
    const result = await parser.parse(testInput);

    console.log('✅ 解析测试成功');
    console.log('📄 解析结果:', result);

    return true;
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    return false;
  }
}

// 运行测试
testMineruParser().then((success) => {
  if (success) {
    console.log('\n🎉 MinerU 解析器测试通过！');
  } else {
    console.log('\n💥 MinerU 解析器测试失败！');
  }
});
