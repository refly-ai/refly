import { RiRobot2Fill, RiMarkdownLine, RiFile2Fill } from 'react-icons/ri';
import { Share2Icon, GitBranchIcon, LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import AnimatedBeamMultipleOutputDemo from '@refly-packages/ai-workspace-common/components/magicui/animated-beam-multiple-outputs';
import AnimatedListDemo from '@refly-packages/ai-workspace-common/components/magicui/animated-list-demo';
import AnimatedBeanDemo from '@refly-packages/ai-workspace-common/components/magicui/animated-bean-demo';
import {
  BentoCard,
  BentoGrid,
} from '@refly-packages/ai-workspace-common/components/magicui/bento-grid';
import { Marquee } from '@refly-packages/ai-workspace-common/components/magicui/marquee';
import { IconType } from 'react-icons';
import { AiOutlineAppstore } from 'react-icons/ai';

interface FileFormat {
  name: string;
  body: string;
}

interface FeatureItem {
  Icon: IconType | LucideIcon;
  name: string;
  description: string;
  bulletPoints?: string[];
  href: string;
  cta: string;
  className: string;
  background: JSX.Element;
  color?: string;
  tagShadow?: string;
}

export default function FeatureBlocks() {
  const { t, i18n } = useTranslation();

  const header = {
    tag: t('landingPage.features.tag'),
    tagIcon: <AiOutlineAppstore />,
    title: t('landingPage.features.title'),
    color: '#000000',
    tagShadow:
      '0 3px 20px 0 rgba(0,0,0,0.10), 0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(227,227,227,0.50)',
  };

  const files = [
    t('landingPage.features.fileFormats.pdf', { returnObjects: true }) as FileFormat,
    t('landingPage.features.fileFormats.markdown', { returnObjects: true }) as FileFormat,
    t('landingPage.features.fileFormats.word', { returnObjects: true }) as FileFormat,
    t('landingPage.features.fileFormats.html', { returnObjects: true }) as FileFormat,
    t('landingPage.features.fileFormats.epub', { returnObjects: true }) as FileFormat,
    t('landingPage.features.fileFormats.jpg', { returnObjects: true }) as FileFormat,
    t('landingPage.features.fileFormats.gif', { returnObjects: true }) as FileFormat,
    t('landingPage.features.fileFormats.png', { returnObjects: true }) as FileFormat,
  ];

  const artifacts = [
    {
      name: 'Document',
      description: 'Rich text documents with markdown support',
      icon: '📄',
    },
    {
      name: 'HTML',
      description: 'Interactive web content and layouts',
      icon: '🌐',
    },
    {
      name: 'SVG',
      description: 'Scalable vector graphics and illustrations',
      icon: '🎨',
    },
    {
      name: 'Mermaid',
      description: 'Diagrams and flowcharts as code',
      icon: '📊',
    },
    {
      name: 'React',
      description: 'Interactive UI components and applications',
      icon: '⚛️',
    },
    {
      name: 'Markdown',
      description: 'Simple and powerful text formatting',
      icon: '📝',
    },
    {
      name: 'Code',
      description: 'Syntax highlighted code blocks',
      icon: '💻',
    },
    {
      name: 'Math',
      description: 'LaTeX math equations and formulas',
      icon: '🔢',
    },
  ] as const;

  const features: FeatureItem[] = [
    {
      Icon: RiFile2Fill,
      name: t('landingPage.features.featureOne.tag'),
      description: t('landingPage.features.featureOne.title'),
      bulletPoints: t('landingPage.features.featureOne.bulletPoints', {
        returnObjects: true,
      }) as string[],
      href: '#',
      cta: 'Learn more',
      className: 'col-span-3 lg:col-span-1',
      color: '#6E3FF3',
      tagShadow: '0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(131,98,223,0.12)',
      background: (
        <Marquee
          pauseOnHover
          className="absolute top-10 [--duration:20s] [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)] "
        >
          {files.map((f, idx) => (
            <figure
              key={idx}
              className={cn(
                'relative w-32 cursor-pointer overflow-hidden rounded-xl border p-4',
                'border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]',
              )}
            >
              <div className="flex flex-row items-center gap-2">
                <div className="flex flex-col">
                  <figcaption className="text-sm font-medium">{f?.name}</figcaption>
                </div>
              </div>
              <blockquote className="mt-2 text-xs">{f?.body}</blockquote>
            </figure>
          ))}
        </Marquee>
      ),
    },
    {
      Icon: RiRobot2Fill,
      name: t('landingPage.features.featureTwo.tag'),
      description: t('landingPage.features.featureTwo.title'),
      bulletPoints: t('landingPage.features.featureTwo.bulletPoints', {
        returnObjects: true,
      }) as string[],
      href: '#',
      cta: 'Learn more',
      className: 'col-span-3 lg:col-span-2',
      color: '#3B82F6',
      tagShadow: '0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(59,130,246,0.20)',
      background: (
        <AnimatedListDemo className="absolute right-2 top-4 h-[300px] w-full scale-75 border-none transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] group-hover:scale-90" />
      ),
    },
    {
      Icon: GitBranchIcon,
      name: t('landingPage.features.featureThree.tag'),
      description: t('landingPage.features.featureThree.title'),
      bulletPoints: t('landingPage.features.featureThree.bulletPoints', {
        returnObjects: true,
      }) as string[],
      href: '#',
      cta: 'Learn more',
      className: 'col-span-3 lg:col-span-1',
      color: '#4CAF50',
      tagShadow: '0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(76,175,80,0.20)',
      background: (
        <AnimatedBeamMultipleOutputDemo className="absolute right-2 top-4 h-[300px] border-none transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] group-hover:scale-105" />
      ),
    },
    {
      Icon: Share2Icon,
      name: t('landingPage.features.featureFour.tag'),
      description: t('landingPage.features.featureFour.title'),
      bulletPoints: t('landingPage.features.featureFour.bulletPoints', {
        returnObjects: true,
      }) as string[],
      href: '#',
      cta: 'Learn more',
      className: 'col-span-3 lg:col-span-1',
      color: '#F17B2C',
      tagShadow: '0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(241,123,44,0.10)',
      background: (
        <AnimatedBeanDemo className="absolute right-2 top-4 h-[300px] border-none transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] group-hover:scale-105" />
      ),
    },
    {
      Icon: RiMarkdownLine,
      name: t('landingPage.features.featureFive.tag'),
      description: t('landingPage.features.featureFive.title'),
      bulletPoints: t('landingPage.features.featureFive.bulletPoints', {
        returnObjects: true,
      }) as string[],
      className: 'col-span-3 lg:col-span-1',
      href: '#',
      cta: 'Learn more',
      color: '#F1A62D',
      tagShadow: '0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(200,140,44,0.20)',
      background: (
        <Marquee
          pauseOnHover
          className="absolute top-10 [--duration:20s] [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)]"
        >
          {artifacts.map((artifact, idx) => (
            <figure
              key={idx}
              className={cn(
                'relative w-40 cursor-pointer overflow-hidden rounded-xl border p-4',
                'border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]',
              )}
            >
              <div className="flex flex-row items-center gap-2">
                <div className="flex flex-col">
                  <figcaption className="text-sm font-medium flex items-center gap-2">
                    <span>{artifact.icon}</span>
                    <span>{artifact.name}</span>
                  </figcaption>
                </div>
              </div>
              <blockquote className="mt-2 text-xs text-neutral-600">
                {artifact.description}
              </blockquote>
            </figure>
          ))}
        </Marquee>
      ),
    },
  ];

  return (
    <section className="relative mx-auto mt-[98px] max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      {/* Header Section */}
      <div className="mb-16 text-center">
        <span
          className="mb-8 inline-flex items-center justify-center rounded-lg border border-solid border-black/10 bg-white px-6 py-2 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-sm"
          style={{
            color: header?.color ?? '#000000',
            boxShadow: header?.tagShadow ?? '0 3px 20px 0 rgba(0,0,0,0.10)',
          }}
        >
          {header?.tagIcon && (
            <span className="mr-2 flex items-center" style={{ color: header?.color ?? '#000000' }}>
              {typeof header.tagIcon === 'string' ? header.tagIcon : header.tagIcon}
            </span>
          )}
          <span>{header?.tag}</span>
        </span>
        <section className="text-center">
          <h1 className="font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-3xl md:text-4xl">
            {i18n.language === 'zh-CN' ? (
              <>
                Refly
                <div className="mt-2">
                  <span className="relative text-[#F1A62D]">
                    主要功能总览
                    <span className="absolute bottom-0 left-0 h-1 w-full bg-[#F1A62D]" />
                  </span>
                </div>
              </>
            ) : (
              <>
                {header?.title?.split('Primary Features')[0]}
                <div className="mt-2">
                  <span className="relative text-[#F1A62D]">
                    Primary Features
                    <span className="absolute bottom-0 left-0 h-1 w-full bg-[#F1A62D]" />
                  </span>
                </div>
              </>
            )}
          </h1>
        </section>
      </div>

      {/* Feature Grid */}
      <div className="mt-16">
        <BentoGrid>
          {features.map((feature, idx) => (
            <BentoCard
              key={idx}
              {...feature}
              className={cn(
                'group relative overflow-hidden rounded-xl border border-transparent bg-gradient-to-b from-neutral-50 to-neutral-100 p-6 shadow-md transition-all hover:shadow-xl',
                feature.className,
              )}
            >
              <div className="relative z-10">
                <span
                  className="mb-3 inline-flex w-fit items-center rounded-lg px-4 py-1 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-sm"
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${feature.color ?? '#000000'}`,
                    boxShadow: feature.tagShadow ?? '0 3px 20px 0 rgba(0,0,0,0.10)',
                    borderRadius: '8px',
                    color: feature.color ?? '#000000',
                  }}
                >
                  <feature.Icon className="mr-2 h-4 w-4" />
                  <span>{feature?.name}</span>
                </span>
                <h3 className="mt-4 text-xl font-semibold">{feature?.description}</h3>
                {feature?.bulletPoints && (
                  <ul className="mt-4 space-y-2">
                    {feature.bulletPoints.map((point: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: feature.color ?? '#37C390' }}
                        >
                          ✓
                        </span>
                        <span className="text-sm text-neutral-600">{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="absolute inset-0 z-0">{feature.background}</div>
            </BentoCard>
          ))}
        </BentoGrid>
      </div>
    </section>
  );
}
