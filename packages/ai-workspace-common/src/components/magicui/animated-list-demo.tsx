'use client';

import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { AnimatedList } from './animated-list';
import { ModelProviderIcons } from '@refly-packages/ai-workspace-common/components/common/icon';

interface Item {
  name: string;
  description: string;
  icon: string;
  time: string;
}

let notifications = [
  {
    name: 'Claude 3.5 Sonnet',
    description: 'Most capable model for highly complex tasks',
    time: 'Anthropic',
    icon: ModelProviderIcons.anthropic,
  },
  {
    name: 'o3-mini',
    description: 'Advanced reasoning and creativity',
    time: 'OpenAI',
    icon: ModelProviderIcons.openai,
  },
  {
    name: 'Gemini Flash 2.0',
    description: 'Fast and efficient for everyday tasks',
    time: 'Google',
    icon: ModelProviderIcons.google,
  },
  {
    name: 'Qwen-Max',
    description: 'Powerful multilingual capabilities',
    time: 'Qwen',
    icon: ModelProviderIcons.qwen,
  },
  {
    name: 'Llama 3.3 70B',
    description: 'Open source foundation model',
    time: 'Meta',
    icon: ModelProviderIcons['meta-llama'],
  },
  {
    name: 'DeepSeek R1',
    description: 'Advanced language understanding',
    time: 'DeepSeek',
    icon: ModelProviderIcons.deepseek,
  },
  {
    name: 'Mistral 8x7B Instruct',
    description: 'Efficient and powerful language model',
    time: 'Mistral',
    icon: ModelProviderIcons.mistral,
  },
];

notifications = Array.from({ length: 5 }, () => notifications).flat();

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

export default function AnimatedListDemo({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn('relative flex h-[500px] w-full flex-col overflow-hidden p-2', className)}>
      <AnimatedList>
        {notifications.map((item, idx) => (
          <Notification {...item} key={idx} />
        ))}
      </AnimatedList>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background" />
    </div>
  );
}
