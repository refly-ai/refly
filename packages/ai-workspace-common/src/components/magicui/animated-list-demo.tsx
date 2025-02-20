'use client';

import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { AnimatedList } from './animated-list';
import { ModelProviderIcons } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';

interface ModelInfo {
  name: string;
  description: string;
  provider: string;
}

interface Item {
  name: string;
  description: string;
  icon: string;
  time: string;
}

export default function AnimatedListDemo({
  className,
}: {
  className?: string;
}) {
  const { t } = useTranslation();

  const notifications = [
    {
      ...(t('landingPage.features.models.deepseekR1', {
        returnObjects: true,
      }) as unknown as ModelInfo),
      icon: ModelProviderIcons.deepseek,
    },
    {
      ...(t('landingPage.features.models.o3mini', { returnObjects: true }) as unknown as ModelInfo),
      icon: ModelProviderIcons.openai,
    },
    {
      ...(t('landingPage.features.models.claude35', {
        returnObjects: true,
      }) as unknown as ModelInfo),
      icon: ModelProviderIcons.anthropic,
    },
    {
      ...(t('landingPage.features.models.gemini', { returnObjects: true }) as unknown as ModelInfo),
      icon: ModelProviderIcons.google,
    },
    {
      ...(t('landingPage.features.models.qwen', { returnObjects: true }) as unknown as ModelInfo),
      icon: ModelProviderIcons.qwen,
    },
    {
      ...(t('landingPage.features.models.llama', { returnObjects: true }) as unknown as ModelInfo),
      icon: ModelProviderIcons['meta-llama'],
    },
    {
      ...(t('landingPage.features.models.mistral', {
        returnObjects: true,
      }) as unknown as ModelInfo),
      icon: ModelProviderIcons.mistral,
    },
    {
      ...(t('landingPage.features.models.deepseekR1', {
        returnObjects: true,
      }) as unknown as ModelInfo),
      icon: ModelProviderIcons.deepseek,
    },
    {
      ...(t('landingPage.features.models.o3mini', { returnObjects: true }) as unknown as ModelInfo),
      icon: ModelProviderIcons.openai,
    },
  ];

  const repeatedNotifications = Array.from({ length: 5 }, () => notifications).flat();

  return (
    <div className={cn('relative flex h-[500px] w-full flex-col overflow-hidden p-2', className)}>
      <AnimatedList>
        {repeatedNotifications.map((item, idx) => (
          <Notification {...item} key={idx} time={item.provider} />
        ))}
      </AnimatedList>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background" />
    </div>
  );
}

const Notification = ({ name, description, icon, time }: Item) => {
  return (
    <figure
      className={cn(
        'relative mx-auto min-h-fit w-full max-w-[400px] cursor-pointer overflow-hidden rounded-2xl p-4',
        // animation styles
        'transition-all duration-200 ease-in-out hover:scale-[103%]',
        // light styles
        'bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]',
        // dark styles
        'transform-gpu dark:bg-transparent dark:backdrop-blur-md dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]',
      )}
    >
      <div className="flex flex-row items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-white border border-gray-200">
          <img src={icon} alt={name} className="size-6" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <figcaption className="flex flex-row items-center whitespace-pre text-lg font-medium dark:text-white ">
            <span className="text-sm sm:text-lg">{name}</span>
            <span className="mx-1">·</span>
            <span className="text-xs text-gray-500">{time}</span>
          </figcaption>
          <p className="text-sm font-normal dark:text-white/60">{description}</p>
        </div>
      </div>
    </figure>
  );
};
