import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, Result } from 'antd';
import axios from 'axios';

// 定义API返回的页面数据类型
interface PageData {
  pageId: string;
  title: string;
  content: any; // 页面内容
  version: number;
  createdAt: string;
}

const SharePagePage = () => {
  const { shareId = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageData, setPageData] = useState<PageData | null>(null);

  useEffect(() => {
    // 获取分享页面数据
    const fetchSharedPage = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/v1/pages/share/${shareId}`);

        if (response.data?.success && response.data?.data) {
          setPageData(response.data.data);
        } else {
          setError('无法加载页面内容');
        }
      } catch (err) {
        console.error('Failed to fetch shared page:', err);
        setError('无法加载页面内容');
      } finally {
        setLoading(false);
      }
    };

    if (shareId) {
      fetchSharedPage();
    }
  }, [shareId]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center h-[var(--screen-height)]">
        <Spin size="large" />
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <Result status="404" title="页面未找到" subTitle="抱歉，您访问的分享页面不存在或已失效。" />
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{pageData.title}</h1>
        <p className="text-gray-500 text-sm">
          创建于 {new Date(pageData.createdAt).toLocaleString('zh-CN')}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {/* 渲染页面内容 */}
        {/* 这里需要根据你的页面内容格式来实现具体的渲染逻辑 */}
        <div>{JSON.stringify(pageData.content)}</div>
      </div>
    </div>
  );
};

export default SharePagePage;
