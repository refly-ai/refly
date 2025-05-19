import { useTranslation } from 'react-i18next';
import { Card, Typography, Button } from 'antd';
import { AiOutlineAppstore } from 'react-icons/ai';
import { memo } from 'react';
import { artifactGalleryData } from './data';

const { Title, Paragraph } = Typography;

interface ArtifactGalleryProps {
  maxItems?: number;
  showViewMore?: boolean;
  title?: string;
  description?: string;
  showHeader?: boolean;
}

const ArtifactGallery = memo(
  ({
    maxItems = 8,
    showViewMore = true,
    title,
    description,
    showHeader = true,
  }: ArtifactGalleryProps) => {
    const { i18n } = useTranslation();

    // Default header configuration
    const defaultHeader = {
      tag: {
        'zh-CN': 'Refly 作品',
        en: 'Refly Artifacts',
      },
      tagIcon: <AiOutlineAppstore />,
      title: {
        'zh-CN': 'Refly 生成作品展示',
        en: 'Refly Artifacts Gallery',
      },
      description: {
        'zh-CN': '探索和发现 Refly 生成式画布生成的精彩作品',
        en: 'Discover and explore incredible artifacts created with Refly Genertive Canvas',
      },
      color: '#333333',
      tagShadow:
        '0 3px 20px 0 rgba(0,0,0,0.10), 0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(227,227,227,0.50)',
    };

    // Get current language
    const currentLang = i18n.language as 'zh-CN' | 'en';
    console.log('currentLang', currentLang);

    // Limit the number of artifacts to display
    const displayedArtifacts = artifactGalleryData.slice(0, maxItems);

    return (
      <section
        className={`relative mx-auto ${
          showHeader ? 'mt-[98px]' : ''
        } max-w-7xl px-4 py-16 sm:px-6 sm:py-24`}
      >
        {/* Header Section */}
        {showHeader ? (
          <div className="mb-16 text-center">
            <span
              className="mb-8 inline-flex items-center justify-center rounded-lg border border-solid border-black/10 bg-white dark:bg-gray-900 dark:border-white/10 px-6 py-2 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-sm"
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
                  <span className="relative text-gray-700 dark:text-gray-200">
                    {title || defaultHeader.title[currentLang]}
                    <span className="absolute bottom-0 left-0 h-1 w-full bg-gray-700 dark:bg-gray-200" />
                  </span>
                </div>
              </Title>
              <Paragraph className="mx-auto mt-4 max-w-3xl text-center text-gray-500 dark:text-gray-400">
                {description || defaultHeader.description[currentLang]}
              </Paragraph>
            </section>
          </div>
        ) : null}

        {/* Artifacts Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {displayedArtifacts.map((artifact) => (
            <a
              key={artifact.id}
              href={artifact.url}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline text-inherit"
            >
              <Card
                className="group overflow-hidden transition-all duration-300 hover:shadow-md cursor-pointer h-full relative"
                bodyStyle={{ padding: 0 }}
                cover={
                  <div className="relative h-48 w-full overflow-hidden">
                    <img
                      src={artifact.coverImage}
                      alt={artifact.title[currentLang]}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                }
              >
                <div className="p-6 flex flex-col h-[calc(100%-12rem)]">
                  <Title
                    level={4}
                    className="!mb-2 !mt-0 line-clamp-2 text-white dark:bg-gray-200 dark:text-black"
                  >
                    {artifact.title[currentLang]}
                  </Title>
                  {artifact.description && (
                    <Paragraph className="!mb-4 text-gray-600 dark:text-gray-300 line-clamp-2 flex-grow">
                      {artifact.description[currentLang]}
                    </Paragraph>
                  )}
                  <div className="text-sm text-gray-400 dark:text-gray-500 mt-auto">
                    {currentLang === 'zh-CN' ? '来自' : 'From'}{' '}
                    {artifact.authorEmail ||
                      {
                        'zh-CN': '匿名',
                        en: 'Anonymous',
                      }[currentLang]}
                  </div>
                </div>
                {/* Hover Overlay - Moved outside of cover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center dark:bg-gray-100/50">
                  <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <Button
                      type="primary"
                      shape="round"
                      size="large"
                      className="bg-white text-black hover:bg-white/90 border-none shadow-[0_4px_12px_rgba(255,255,255,0.4)] dark:hover:bg-gray-900/10 dark:shadow-[0_4px_12px_rgba(0,0,0,0.4)] dark:text-white dark:bg-gray-900"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open(artifact.url, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      {currentLang === 'zh-CN' ? '访问作品' : 'Visit Artifact'}
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
              className="px-8 py-2 no-underline bg-gray-700 dark:bg-gray-200"
              href="/artifact-gallery"
            >
              {currentLang === 'zh-CN' ? '探索更多作品' : 'Explore more artifacts'} 👉
            </Button>
          </div>
        )}
      </section>
    );
  },
);

export default ArtifactGallery;
