import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import ArtifactGallery from '../../components/landing-page-partials/artifact-gallery';
import Header from '../../components/landing-page-partials/Header';
import Footer from '../../components/landing-page-partials/Footer';

function ArtifactGallary() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language as 'zh-CN' | 'en';

  const pageContent = {
    title: {
      'zh-CN': 'Refly 生成作品展示',
      en: 'Refly Artifacts Gallery',
    },
    description: {
      'zh-CN': '探索和发现使用 Refly 生成式画布创作的精彩作品',
      en: 'Discover and explore incredible spaces created with Refly generative canvas',
    },
    metaTitle: {
      'zh-CN': 'Refly Spaces 展示 - 生成式画布创作展',
      en: 'Refly Spaces Gallery - Generative Canvas Creations',
    },
    metaDescription: {
      'zh-CN': '探索由 Refly 生成式画布创作的精彩作品，发现无限创意可能',
      en: 'Explore amazing creations made with Refly generative canvas, discover unlimited creative possibilities',
    },
  };

  return (
    <div
      className="flex flex-col overflow-hidden bg-[#FFFFFF]"
      style={{ minHeight: 'var(--screen-height)' }}
    >
      <Helmet>
        <title>{pageContent.metaTitle[currentLang]}</title>
        <meta name="description" content={pageContent.metaDescription[currentLang]} />
        <meta property="og:title" content={pageContent.metaTitle[currentLang]} />
        <meta property="og:description" content={pageContent.metaDescription[currentLang]} />
        <meta property="og:image" content="https://static.refly.ai/landing/product-og-min.png" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={window.location.href} />
      </Helmet>

      {/* Site header */}
      <Header />

      {/* Main content */}
      <main className="grow">
        {/* Hero Section */}
        <section className="relative mx-auto max-w-7xl pt-20 pb-10 px-4 sm:px-6">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              {pageContent.title[currentLang]}
            </h1>
            <p className="mt-4 text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {pageContent.description[currentLang]}
            </p>
          </div>
        </section>

        {/* Gallery with all items and no view more button */}
        <ArtifactGallery
          maxItems={24}
          showViewMore={false}
          title={pageContent.title[currentLang]}
          description={pageContent.description[currentLang]}
          showHeader={false}
        />
      </main>

      {/* Site footer */}
      <Footer />
    </div>
  );
}

export default ArtifactGallary;
