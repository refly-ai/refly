import { memo, useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineAppstore } from 'react-icons/ai';
import { Button, Card, Typography, Space } from 'antd';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { categories, useCasesData, UseCase, Category } from './data';

const { Title, Paragraph } = Typography;

interface UseCasesGalleryProps {
  maxItems?: number;
  showViewMore?: boolean;
  title?: string;
  description?: string;
  showHeader?: boolean;
}

const UseCasesGallery = memo(
  ({
    maxItems = 4,
    title,
    description,
    showViewMore = true,
    showHeader = true,
  }: UseCasesGalleryProps) => {
    const { i18n } = useTranslation();
    const currentLang = i18n.language as 'zh-CN' | 'en';

    // Default header configuration
    const defaultHeader = useMemo(
      () => ({
        tag: {
          'zh-CN': '使用案例',
          en: 'Use Cases',
        },
        tagIcon: <AiOutlineAppstore />,
        title: {
          'zh-CN': '探索 Refly 的实际应用场景',
          en: 'Explore Real-World Applications of Refly',
        },
        description: {
          'zh-CN': '了解 Refly 如何通过画布处理真实世界的任务，提供完整的工作流程指南',
          en: 'Learn how Refly handles real-world tasks through step-by-step workflow on Canvas',
        },
        color: '#333333',
        tagShadow:
          '0 3px 20px 0 rgba(0,0,0,0.10), 0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(227,227,227,0.50)',
      }),
      [],
    );

    // State management for active category
    const [activeCategory, setActiveCategory] = useState('featured');

    // Filter use cases based on active category and maxItems
    const filteredUseCases = useMemo(() => {
      if (activeCategory === 'featured') {
        // For featured category, get one item from each category up to maxItems
        const featured: UseCase[] = [];
        const categoriesMap = new Map<string, UseCase[]>();

        // Group use cases by category
        for (const useCase of useCasesData) {
          if (!categoriesMap.has(useCase.category)) {
            categoriesMap.set(useCase.category, []);
          }
          categoriesMap.get(useCase.category)?.push(useCase);
        }

        // Take one item from each category until we reach maxItems
        for (const [_, cases] of categoriesMap) {
          if (featured.length < maxItems && cases.length > 0) {
            featured.push(cases[0]);
          }
        }

        return featured;
      }

      // For specific categories, return up to 4 items from that category
      return useCasesData
        .filter((useCase: UseCase) => useCase.category === activeCategory)
        .slice(0, 4);
    }, [activeCategory, maxItems]);

    // Handle category change
    const handleCategoryChange = useCallback((categoryId: string) => {
      setActiveCategory(categoryId);
    }, []);

    return (
      <section
        className={`relative mx-auto ${showHeader ? 'mt-[98px]' : ''} max-w-7xl px-4 py-16 sm:px-6 sm:py-24`}
      >
        {/* Header Section */}
        {showHeader && (
          <div className="mb-16 text-center">
            <span
              className="mb-8 inline-flex items-center justify-center rounded-lg border border-solid border-black/10 bg-white px-6 py-2 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-sm"
              style={{
                color: defaultHeader.color,
                boxShadow: defaultHeader.tagShadow,
              }}
            >
              <span className="mr-2 flex items-center" style={{ color: defaultHeader.color }}>
                {defaultHeader.tagIcon}
              </span>
              <span>{defaultHeader.tag[currentLang]}</span>
            </span>
            <section className="text-center">
              <Title
                level={2}
                className="font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif]"
              >
                <div className="mt-2">
                  <span className="relative text-[#333333]">
                    {title || defaultHeader.title[currentLang]}
                    <span className="absolute bottom-0 left-0 h-1 w-full bg-[#333333]" />
                  </span>
                </div>
              </Title>
              <Paragraph className="mx-auto mt-4 max-w-3xl text-center text-gray-500">
                {description || defaultHeader.description[currentLang]}
              </Paragraph>
            </section>
          </div>
        )}

        {/* Category Tabs */}
        <Space wrap className="mb-10 flex justify-center">
          {categories.map((category: Category) => (
            <Button
              key={category.id}
              type={activeCategory === category.id ? 'primary' : 'default'}
              onClick={() => handleCategoryChange(category.id)}
              shape="round"
              className={cn(
                'transition-all duration-200',
                activeCategory === category.id && 'shadow-md',
              )}
              style={
                activeCategory === category.id
                  ? { backgroundColor: '#333333', borderColor: '#333333' }
                  : {}
              }
            >
              {category.name[currentLang]}
            </Button>
          ))}
        </Space>

        {/* Use Cases Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {filteredUseCases.map((useCase: UseCase) => (
            <a
              key={useCase.id}
              href={useCase.url}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline text-inherit"
            >
              <Card
                className="group overflow-hidden transition-all duration-300 hover:shadow-md cursor-pointer h-full"
                bodyStyle={{ padding: 0 }}
                cover={
                  <div className="relative h-48 w-full overflow-hidden">
                    <img
                      src={useCase.coverImage}
                      alt={useCase.title[currentLang]}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                }
              >
                <div className="p-6 flex flex-col h-[calc(100%-12rem)]">
                  <Title
                    level={4}
                    className="!mb-2 !mt-0 line-clamp-2"
                    style={{ color: '#333333' }}
                  >
                    {useCase.title[currentLang]}
                  </Title>
                  <Paragraph className="!mb-4 text-gray-600 line-clamp-2 flex-grow">
                    {useCase.description[currentLang]}
                  </Paragraph>
                  {useCase.authorEmail && (
                    <div className="text-sm text-gray-400 mt-auto">
                      {currentLang === 'zh-CN' ? '来自' : 'From'} {useCase.authorEmail}
                    </div>
                  )}
                </div>
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <Button
                      type="primary"
                      shape="round"
                      size="large"
                      className="bg-white text-black hover:bg-white/90 border-none shadow-[0_4px_12px_rgba(255,255,255,0.4)]"
                    >
                      {currentLang === 'zh-CN' ? '查看详情' : 'View Details'}
                    </Button>
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>
        {/* View More Button */}
        {showViewMore && (
          <div className="mt-12 text-center">
            <Button
              type="primary"
              shape="round"
              size="large"
              className="px-8 py-2 no-underline"
              style={{ backgroundColor: '#333333' }}
              href="/use-cases-gallery"
            >
              {currentLang === 'zh-CN' ? '探索更多画布' : 'Explore more canvas'} 👉
            </Button>
          </div>
        )}
      </section>
    );
  },
);

export default UseCasesGallery;
