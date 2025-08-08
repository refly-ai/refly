import React, { useState, useCallback, useMemo } from 'react';
import { Button, Card, Input, Select, Space, Typography, Alert, Table, Tag, message } from 'antd';
import { PlayCircleOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface TestSession {
  sessionId: string;
  title: string;
  status: string;
  mode: string;
  currentDepth: number;
  maxDepth: number;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TestResponse {
  success: boolean;
  data: any;
  message?: string;
}

const API_BASE_URL = 'http://localhost:5800';

export const PilotTestPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('帮我分析人工智能的发展趋势');
  const [maxDivergence, setMaxDivergence] = useState<number>(4);
  const [maxDepth, setMaxDepth] = useState<number>(3);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [lastResponse, setLastResponse] = useState<TestResponse | null>(null);

  // Create divergent session
  const createSession = useCallback(async () => {
    if (!prompt.trim()) {
      message.error('请输入prompt');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/v1/pilot/divergent/session/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'divergent',
          prompt: prompt.trim(),
          maxDivergence,
          maxDepth,
        }),
      });

      const result: TestResponse = await response.json();
      setLastResponse(result);

      if (result.success && result.data?.sessionId) {
        setSessionId(result.data.sessionId);
        message.success('会话创建成功！');
        // Refresh sessions list
        fetchSessions();
      } else {
        message.error(result.message || '创建会话失败');
      }
    } catch (error) {
      console.error('Create session error:', error);
      message.error('网络错误，请检查API服务器是否启动');
    } finally {
      setLoading(false);
    }
  }, [prompt, maxDivergence, maxDepth]);

  // Get session status
  const getSessionStatus = useCallback(
    async (id?: string) => {
      const targetId = id || sessionId;
      if (!targetId) {
        message.error('请输入或选择会话ID');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/v1/pilot/divergent/session/status?sessionId=${targetId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        const result: TestResponse = await response.json();
        setLastResponse(result);

        if (result.success) {
          setCurrentSession(result.data);
          message.success('状态查询成功！');
        } else {
          message.error(result.message || '查询状态失败');
        }
      } catch (error) {
        console.error('Get status error:', error);
        message.error('网络错误');
      } finally {
        setLoading(false);
      }
    },
    [sessionId],
  );

  // Fetch sessions list
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/v1/pilot/divergent/sessions?limit=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: TestResponse = await response.json();
      setLastResponse(result);

      if (result.success) {
        setSessions(result.data || []);
        message.success('会话列表获取成功！');
      } else {
        message.error(result.message || '获取会话列表失败');
      }
    } catch (error) {
      console.error('Fetch sessions error:', error);
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto refresh status
  const autoRefreshStatus = useCallback(async () => {
    if (sessionId) {
      await getSessionStatus();
    }
  }, [sessionId, getSessionStatus]);

  // Table columns for sessions list
  const sessionColumns = useMemo(
    () => [
      {
        title: '会话ID',
        dataIndex: 'sessionId',
        key: 'sessionId',
        width: 200,
        render: (text: string) => (
          <Text copyable style={{ fontFamily: 'monospace', fontSize: '12px' }}>
            {text}
          </Text>
        ),
      },
      {
        title: '标题',
        dataIndex: 'title',
        key: 'title',
        ellipsis: true,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => {
          const color =
            status === 'completed' ? 'green' : status === 'executing' ? 'blue' : 'default';
          return <Tag color={color}>{status}</Tag>;
        },
      },
      {
        title: '模式',
        dataIndex: 'mode',
        key: 'mode',
        render: (mode: string) => <Tag color="purple">{mode}</Tag>,
      },
      {
        title: '深度',
        dataIndex: 'currentDepth',
        key: 'currentDepth',
        render: (current: number, record: TestSession) => `${current}/${record.maxDepth}`,
      },
      {
        title: '步骤数',
        dataIndex: 'stepCount',
        key: 'stepCount',
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (date: string) => new Date(date).toLocaleString(),
      },
      {
        title: '操作',
        key: 'action',
        render: (_, record: TestSession) => (
          <Space>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSessionId(record.sessionId);
                getSessionStatus(record.sessionId);
              }}
            >
              查看状态
            </Button>
          </Space>
        ),
      },
    ],
    [getSessionStatus],
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Title level={2}>Week1 发散Pilot测试页面</Title>
      <Alert
        message="测试说明"
        description="此页面用于测试Week1实现的发散pilot系统。请确保API服务器在localhost:5800运行。"
        type="info"
        showIcon
        className="mb-6"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 创建会话 */}
        <Card title="创建发散会话" className="h-fit">
          <Space direction="vertical" className="w-full">
            <div>
              <Text strong>Prompt:</Text>
              <TextArea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="输入你的问题或任务..."
                rows={4}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text strong>最大发散数:</Text>
                <Select value={maxDivergence} onChange={setMaxDivergence} className="w-full mt-2">
                  <Option value={1}>1</Option>
                  <Option value={2}>2</Option>
                  <Option value={3}>3</Option>
                  <Option value={4}>4</Option>
                  <Option value={5}>5</Option>
                  <Option value={6}>6</Option>
                </Select>
              </div>
              <div>
                <Text strong>最大深度:</Text>
                <Select value={maxDepth} onChange={setMaxDepth} className="w-full mt-2">
                  <Option value={1}>1</Option>
                  <Option value={2}>2</Option>
                  <Option value={3}>3</Option>
                  <Option value={4}>4</Option>
                </Select>
              </div>
            </div>

            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={loading}
              onClick={createSession}
              className="w-full"
            >
              创建会话
            </Button>
          </Space>
        </Card>

        {/* 查询状态 */}
        <Card title="查询会话状态" className="h-fit">
          <Space direction="vertical" className="w-full">
            <div>
              <Text strong>会话ID:</Text>
              <Input
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="输入会话ID或从下方列表选择"
                className="mt-2"
              />
            </div>

            <Space>
              <Button icon={<EyeOutlined />} loading={loading} onClick={() => getSessionStatus()}>
                查询状态
              </Button>
              <Button icon={<ReloadOutlined />} onClick={autoRefreshStatus} disabled={!sessionId}>
                自动刷新
              </Button>
            </Space>

            {currentSession && (
              <div className="mt-4 p-4 bg-gray-50 rounded">
                <Text strong>当前会话状态:</Text>
                <div className="mt-2 space-y-1 text-sm">
                  <div>
                    状态:{' '}
                    <Tag color={currentSession.status === 'completed' ? 'green' : 'blue'}>
                      {currentSession.status}
                    </Tag>
                  </div>
                  <div>
                    深度: {currentSession.currentDepth}/{currentSession.maxDepth}
                  </div>
                  <div>
                    进度: {currentSession.progress?.completedSteps || 0}/
                    {currentSession.progress?.totalSteps || 0}
                  </div>
                </div>
              </div>
            )}
          </Space>
        </Card>
      </div>

      {/* 会话列表 */}
      <Card title="会话列表" className="mt-6">
        <div className="mb-4">
          <Button icon={<ReloadOutlined />} onClick={fetchSessions} loading={loading}>
            刷新列表
          </Button>
        </div>

        <Table
          dataSource={sessions}
          columns={sessionColumns}
          rowKey="sessionId"
          pagination={false}
          size="small"
          loading={loading}
        />
      </Card>

      {/* API响应展示 */}
      {lastResponse && (
        <Card title="API响应" className="mt-6">
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm overflow-auto">
            <pre>{JSON.stringify(lastResponse, null, 2)}</pre>
          </div>
        </Card>
      )}

      {/* 测试说明 */}
      <Card title="测试指南" className="mt-6">
        <div className="space-y-2 text-sm">
          <div>
            1. <Text strong>创建会话:</Text> 输入prompt和参数，点击创建会话
          </div>
          <div>
            2. <Text strong>查询状态:</Text> 使用返回的sessionId查询执行状态
          </div>
          <div>
            3. <Text strong>自动刷新:</Text> 点击自动刷新按钮持续监控状态
          </div>
          <div>
            4. <Text strong>会话列表:</Text> 查看所有创建的会话
          </div>
          <div className="text-red-500">注意: 确保API服务器在localhost:5800运行</div>
        </div>
      </Card>
    </div>
  );
};
