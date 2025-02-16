import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { TbBrowserPlus } from 'react-icons/tb';
import { IconResourceFilled } from '@refly-packages/ai-workspace-common/components/common/icon';
import { EXTENSION_DOWNLOAD_LINK } from '@refly/utils/url';
import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';
import { useState } from 'react';

const SOCIAL_PLATFORMS = [
  {
    name: 'Wikipedia',
    icon: 'https://www.wikipedia.org/static/favicon/wikipedia.ico',
    url: 'https://www.wikipedia.org',
  },
  // Global Social Media
  {
    name: 'X/Twitter',
    icon: 'https://abs.twimg.com/responsive-web/client-web/icon-ios.b1fc727a.png',
    url: 'https://twitter.com',
  },
  {
    name: 'Reddit',
    icon: 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png',
    url: 'https://reddit.com',
  },
  //   {
  //     name: 'YouTube',
  //     icon: 'https://www.youtube.com/s/desktop/e4d15d2c/img/favicon_144x144.png',
  //     url: 'https://youtube.com',
  //   },
  {
    name: 'Medium',
    icon: 'https://miro.medium.com/v2/1*m-R_BkNf1Qjr1YbyOIJY2w.png',
    url: 'https://medium.com',
  },

  // Chinese Social Media & Communities
  {
    name: 'Red Book',
    icon: 'https://ci.xiaohongshu.com/fe-platform/f148480444782b0e55bac65a9c9360f7e5ed6e7d.png',
    url: 'https://xiaohongshu.com/explore',
  },
  {
    name: 'Zhihu',
    icon: 'https://static.zhihu.com/heifetz/favicon.ico',
    url: 'https://www.zhihu.com',
  },
  {
    name: 'Douban',
    icon: 'https://www.douban.com/favicon.ico',
    url: 'https://www.douban.com',
  },
  {
    name: 'Juejin',
    icon: 'https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/static/favicons/favicon-32x32.png',
    url: 'https://juejin.cn',
  },

  // Product & Design
  {
    name: 'Product Hunt',
    icon: 'https://ph-static.imgix.net/ph-favicon-32x32.png',
    url: 'https://www.producthunt.com',
  },
  //   {
  //     name: 'Dribbble',
  //     icon: 'https://cdn.dribbble.com/assets/favicon-b38525134603b9513174ec887944bde1a869eb6cd414f4d640ee48ab2a15a26b.ico',
  //     url: 'https://dribbble.com',
  //   },
  //   {
  //     name: 'Behance',
  //     icon: 'https://a5.behance.net/2acd763b44e2249b6cc54674210d66e5fd08e523/img/site/favicon.ico',
  //     url: 'https://www.behance.net',
  //   },
  //   {
  //     name: 'UI Garage',
  //     icon: 'https://uigarage.net/wp-content/uploads/2019/05/favicon-150x150.png',
  //     url: 'https://uigarage.net',
  //   },

  // Academic & Research
  {
    name: 'arXiv',
    icon: 'https://static.arxiv.org/static/browse/0.3.4/images/icons/favicon-32x32.png',
    url: 'https://arxiv.org',
  },
  {
    name: 'Google Scholar',
    icon: 'https://scholar.google.com/favicon.ico',
    url: 'https://scholar.google.com',
  },
  {
    name: 'ResearchGate',
    icon: 'https://c5.rgstatic.net/m/4177159727632/images/favicon/favicon-32x32.png',
    url: 'https://www.researchgate.net',
  },
  {
    name: 'SSRN',
    icon: 'https://www.ssrn.com/favicon.ico',
    url: 'https://www.ssrn.com',
  },

  // Tech & Development
  {
    name: 'GitHub',
    icon: 'https://github.githubassets.com/favicons/favicon.png',
    url: 'https://github.com',
  },
  {
    name: 'Stack Overflow',
    icon: 'https://cdn.sstatic.net/Sites/stackoverflow/Img/apple-touch-icon.png',
    url: 'https://stackoverflow.com',
  },
  {
    name: 'Dev.to',
    icon: 'https://dev-to-uploads.s3.amazonaws.com/uploads/logos/resized_logo_UQww2soKuUsjaOGNB38o.png',
    url: 'https://dev.to',
  },
  {
    name: 'HackerNews',
    icon: 'https://news.ycombinator.com/favicon.ico',
    url: 'https://news.ycombinator.com',
  },

  // Legal & Professional
  {
    name: 'LexisNexis',
    icon: 'https://www.lexisnexis.com/favicon.ico',
    url: 'https://www.lexisnexis.com',
  },
  {
    name: 'Westlaw',
    icon: 'https://www.westlaw.com/favicon.ico',
    url: 'https://www.westlaw.com',
  },
  {
    name: 'LinkedIn',
    icon: 'https://static.licdn.com/sc/h/al2o9zrvru7aqj8e1x2rzsrca',
    url: 'https://www.linkedin.com',
  },
  {
    name: 'Harvard Business Review',
    icon: 'https://hbr.org/resources/images/favicon.ico',
    url: 'https://hbr.org',
  },

  // Books & Reviews
  {
    name: 'Goodreads',
    icon: 'https://www.goodreads.com/favicon.ico',
    url: 'https://www.goodreads.com',
  },
  {
    name: 'Book Review (NYT)',
    icon: 'https://www.nytimes.com/vi-assets/static-assets/favicon-4bf96cb6a1093748bf5b3c429accb9b4.ico',
    url: 'https://www.nytimes.com/section/books/review',
  },
  {
    name: 'Library Genesis',
    icon: 'https://libgen.rs/favicon.ico',
    url: 'https://libgen.rs',
  },
  {
    name: 'Z-Library',
    icon: 'https://z-lib.org/favicon.ico',
    url: 'https://z-lib.org',
  },

  // Media & Content Creation
  {
    name: 'Substack',
    icon: 'https://substack.com/favicon.ico',
    url: 'https://substack.com',
  },
  {
    name: 'Ghost',
    icon: 'https://ghost.org/favicon.ico',
    url: 'https://ghost.org',
  },
  {
    name: 'Buffer',
    icon: 'https://buffer.com/favicon.ico',
    url: 'https://buffer.com',
  },
  //   {
  //     name: 'Canva',
  //     icon: 'https://static.canva.com/static/images/favicon-1.ico',
  //     url: 'https://www.canva.com',
  //   },

  // Productivity & Notes
  {
    name: 'Notion',
    icon: 'https://www.notion.so/images/favicon.ico',
    url: 'https://notion.so',
  },
  {
    name: 'Flomo',
    icon: 'https://flomoapp.com/images/favicon.ico',
    url: 'https://flomoapp.com',
  },
  {
    name: 'Obsidian',
    icon: 'https://obsidian.md/favicon.ico',
    url: 'https://obsidian.md',
  },
  {
    name: 'Logseq',
    icon: 'https://logseq.com/icons/icon-144x144.png',
    url: 'https://logseq.com',
  },
  {
    name: 'Readwise',
    icon: 'https://readwise.io/favicon.ico',
    url: 'https://readwise.io',
  },

  // Discussion Forums
  {
    name: 'Quora',
    icon: 'https://qsf.fs.quoracdn.net/-4-images.favicon.ico-26-ae77b637b1e7ed2c.ico',
    url: 'https://www.quora.com',
  },
  {
    name: 'V2EX',
    icon: 'https://www.v2ex.com/static/icon-192.png',
    url: 'https://www.v2ex.com',
  },
  {
    name: 'Hupu',
    icon: 'https://w1.hoopchina.com.cn/images/pc/old/favicon.ico',
    url: 'https://bbs.hupu.com',
  },
  {
    name: 'Discord',
    icon: 'https://discord.com/assets/847541504914fd33810e70a0ea73177e.ico',
    url: 'https://discord.com',
  },
];

const PlatformButton = ({ platform }: { platform: (typeof SOCIAL_PLATFORMS)[0] }) => {
  const [showFallbackIcon, setShowFallbackIcon] = useState(false);

  return (
    <Button
      key={platform.name}
      className="flex items-center gap-2 h-auto p-4"
      onClick={() => window.open(platform.url, '_blank')}
    >
      {showFallbackIcon ? (
        <IconResourceFilled color={NODE_COLORS.resource} size={24} />
      ) : (
        <img
          src={`https://www.google.com/s2/favicons?domain=${platform.url}&sz=32`}
          alt={platform.name}
          className="w-6 h-6 rounded-sm object-contain"
          onError={() => setShowFallbackIcon(true)}
        />
      )}
      <span>{platform.name}</span>
    </Button>
  );
};

export const ImportFromExtension = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n?.languages?.[0];

  return (
    <div className="h-full flex flex-col min-w-[500px] box-border">
      {/* header - fixed height */}
      <div className="flex items-center gap-2 p-6 border-b border-gray-200">
        <span className="flex items-center justify-center">
          <TbBrowserPlus className="text-lg" />
        </span>
        <div className="text-base font-bold">{t('resource.import.fromExtension')}</div>
      </div>

      {/* scrollable content area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-6">
          {/* Video Demo */}
          <div className="mb-8">
            <video
              width="100%"
              height="300"
              src="https://static.refly.ai/extension/clip_and_save.mp4"
              controls
              controlsList="nodownload"
              loop
              playsInline
              className="w-full h-[300px] object-cover rounded-lg bg-black"
            >
              <track kind="captions" label="English captions" src="" default />
            </video>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-8">
            <Button
              type="primary"
              size="large"
              className="flex-1"
              onClick={() => window.open(EXTENSION_DOWNLOAD_LINK, '_blank')}
            >
              {t('resource.import.downloadExtension')}
            </Button>
            <Button
              size="large"
              className="flex-1"
              onClick={() => {
                const docsUrl =
                  locale === 'en'
                    ? 'https://docs.refly.ai/guide/chrome-extension'
                    : 'https://docs.refly.ai/zh/guide/chrome-extension';
                window.open(docsUrl, '_blank');
              }}
            >
              {t('resource.import.viewDocs')}
            </Button>
          </div>

          {/* Platform List */}
          <div className="mb-6">
            <h3 className="text-base font-medium mb-4">
              {t('resource.import.recommendedPlatforms')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {SOCIAL_PLATFORMS.map((platform) => (
                <PlatformButton key={platform.name} platform={platform} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
