// 简单的API测试脚本
// 在浏览器控制台中运行此脚本来测试API

const API_BASE_URL = 'http://localhost:5800';

// 测试创建会话
async function testCreateSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/pilot/divergent/session/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'divergent',
        prompt: '帮我分析人工智能的发展趋势',
        maxDivergence: 4,
        maxDepth: 3,
      }),
    });

    const result = await response.json();
    console.log('创建会话结果:', result);
    return result;
  } catch (error) {
    console.error('创建会话失败:', error);
  }
}

// 测试查询状态
async function testGetStatus(sessionId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/v1/pilot/divergent/session/status?sessionId=${sessionId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const result = await response.json();
    console.log('查询状态结果:', result);
    return result;
  } catch (error) {
    console.error('查询状态失败:', error);
  }
}

// 测试获取会话列表
async function testGetSessions() {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/pilot/divergent/sessions?limit=10`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    console.log('获取会话列表结果:', result);
    return result;
  } catch (error) {
    console.error('获取会话列表失败:', error);
  }
}

// 运行完整测试
async function runFullTest() {
  console.log('开始API测试...');

  // 1. 创建会话
  console.log('1. 测试创建会话');
  const createResult = await testCreateSession();

  if (createResult?.success && createResult?.data?.sessionId) {
    const sessionId = createResult.data.sessionId;
    console.log('会话ID:', sessionId);

    // 2. 查询状态
    console.log('2. 测试查询状态');
    await testGetStatus(sessionId);

    // 3. 获取会话列表
    console.log('3. 测试获取会话列表');
    await testGetSessions();
  }

  console.log('测试完成');
}

// 导出测试函数
window.pilotTest = {
  testCreateSession,
  testGetStatus,
  testGetSessions,
  runFullTest,
};

console.log('测试脚本已加载，可以使用以下命令:');
console.log('- pilotTest.runFullTest() - 运行完整测试');
console.log('- pilotTest.testCreateSession() - 测试创建会话');
console.log('- pilotTest.testGetStatus(sessionId) - 测试查询状态');
console.log('- pilotTest.testGetSessions() - 测试获取会话列表');
