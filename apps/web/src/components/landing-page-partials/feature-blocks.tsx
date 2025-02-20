import { RiCalendar2Fill, RiFile2Fill } from 'react-icons/ri';
import { BellIcon, Share2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import AnimatedBeamMultipleOutputDemo from '@refly-packages/ai-workspace-common/components/magicui/animated-beam-multiple-outputs';
import AnimatedListDemo from '@refly-packages/ai-workspace-common/components/magicui/animated-list-demo';
import {
  BentoCard,
  BentoGrid,
} from '@refly-packages/ai-workspace-common/components/magicui/bento-grid';
import { Marquee } from '@refly-packages/ai-workspace-common/components/magicui/marquee';
import { IconType } from 'react-icons';
import { LucideIcon } from 'lucide-react';

interface FeatureItem {
  Icon: IconType | LucideIcon;
  name: string;
  description: string;
  bulletPoints?: string[];
  href: string;
  cta: string;
  className: string;
  background: JSX.Element;
}

const files = [
  {
    name: 'bitcoin.pdf',
    body: 'Bitcoin is a cryptocurrency invented in 2008 by an unknown person or group of people using the name Satoshi Nakamoto.',
  },
  {
    name: 'finances.xlsx',
    body: 'A spreadsheet or worksheet is a file made of rows and columns that help sort data, arrange data easily, and calculate numerical data.',
  },
  {
    name: 'logo.svg',
    body: 'Scalable Vector Graphics is an Extensible Markup Language-based vector image format for two-dimensional graphics with support for interactivity and animation.',
  },
  {
    name: 'keys.gpg',
    body: 'GPG keys are used to encrypt and decrypt email, files, directories, and whole disk partitions and to authenticate messages.',
  },
  {
    name: 'seed.txt',
    body: 'A seed phrase, seed recovery phrase or backup seed phrase is a list of words which store all the information needed to recover Bitcoin funds on-chain.',
  },
];

export default function FeatureBlocks() {
  const { t } = useTranslation();

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
                'dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]',
                'transform-gpu blur-[1px] transition-all duration-300 ease-out hover:blur-none',
              )}
            >
              <div className="flex flex-row items-center gap-2">
                <div className="flex flex-col">
                  <figcaption className="text-sm font-medium dark:text-white ">{f.name}</figcaption>
                </div>
              </div>
              <blockquote className="mt-2 text-xs">{f.body}</blockquote>
            </figure>
          ))}
        </Marquee>
      ),
    },
    {
      Icon: BellIcon,
      name: t('landingPage.features.featureTwo.tag'),
      description: t('landingPage.features.featureTwo.title'),
      bulletPoints: t('landingPage.features.featureTwo.bulletPoints', {
        returnObjects: true,
      }) as string[],
      href: '#',
      cta: 'Learn more',
      className: 'col-span-3 lg:col-span-2',
      background: (
        <AnimatedListDemo className="absolute right-2 top-4 h-[300px] w-full scale-75 border-none transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] group-hover:scale-90" />
      ),
    },
    {
      Icon: Share2Icon,
      name: t('landingPage.features.featureThree.tag'),
      description: t('landingPage.features.featureThree.title'),
      bulletPoints: t('landingPage.features.featureThree.bulletPoints', {
        returnObjects: true,
      }) as string[],
      href: '#',
      cta: 'Learn more',
      className: 'col-span-3 lg:col-span-2',
      background: (
        <AnimatedBeamMultipleOutputDemo className="absolute right-2 top-4 h-[300px] border-none transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] group-hover:scale-105" />
      ),
    },
    {
      Icon: RiCalendar2Fill,
      name: t('landingPage.features.featureFour.tag'),
      description: t('landingPage.features.featureFour.title'),
      bulletPoints: t('landingPage.features.featureFour.bulletPoints', {
        returnObjects: true,
      }) as string[],
      className: 'col-span-3 lg:col-span-1',
      href: '#',
      cta: 'Learn more',
      background: (
        <AnimatedBeamMultipleOutputDemo className="absolute right-2 top-4 h-[300px] border-none transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] group-hover:scale-105" />
      ),
    },
  ];

  return (
    <section className="relative mx-auto mt-[98px] max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      {/* Header Section */}
      <div className="text-center">
        <span
          className="mb-8 inline-flex items-center justify-center rounded-lg border border-solid border-black/10 bg-white px-6 py-2 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-sm"
          style={{
            boxShadow:
              '0 3px 20px 0 rgba(0,0,0,0.10), 0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(227,227,227,0.50)',
          }}
        >
          {t('landingPage.features.tag')}
        </span>
        <h2 className="mt-4 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-3xl md:text-4xl">
          {t('landingPage.features.title')}
        </h2>
      </div>

      {/* Feature Grid */}
      <div className="mt-16">
        <BentoGrid>
          {features.map((feature, idx) => (
            <BentoCard
              key={idx}
              {...feature}
              className={cn(
                'group relative overflow-hidden rounded-xl border border-transparent bg-gradient-to-b from-neutral-50 to-neutral-100 p-6 shadow-md transition-all hover:shadow-xl dark:from-neutral-900 dark:to-neutral-800',
                feature.className,
              )}
            >
              <div className="relative z-10">
                <feature.Icon className="h-8 w-8" />
                <h3 className="mt-4 text-xl font-semibold">{feature.name}</h3>
                <p className="mt-2 text-neutral-600 dark:text-neutral-300">{feature.description}</p>
                {feature.bulletPoints && (
                  <ul className="mt-4 space-y-2">
                    {feature.bulletPoints.map((point: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                          ✓
                        </span>
                        <span className="text-sm text-neutral-600 dark:text-neutral-300">
                          {point}
                        </span>
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
