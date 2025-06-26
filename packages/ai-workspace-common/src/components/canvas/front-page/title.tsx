import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { IconGithub } from '@refly-packages/ai-workspace-common/components/common/icon';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { canvasTemplateEnabled } from '@refly-packages/ai-workspace-common/utils/env';

export const Title = () => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        canvasTemplateEnabled ? 'mt-48' : '',
      )}
    >
      <Tag
        color="orange"
        className="mb-6 mx-2 text-sm cursor-pointer flex items-center px-2 py-1"
        icon={<IconGithub className="w-3.5 h-3.5 mr-1" />}
        onClick={() => {
          window.open('https://github.com/refly-ai/refly', '_blank');
        }}
      >
        {t('frontPage.githubStar')}
      </Tag>
      <h3
        className={cn(
          'text-3xl font-medium text-center text-gray-800 mb-6 mx-2 dark:text-gray-100',
        )}
      >
        <span className="mr-1">{t('frontPage.welcome.part1')}</span>
        <span
          className="relative font-bold mr-1 inline-block bg-gradient-to-r from-[#2D36FF] to-[#DC55DF] bg-clip-text text-transparent"
          style={{
            backgroundImage: 'linear-gradient(55deg, #2D36FF 8%, #DC55DF 114%)',
            paddingRight: '4px',
          }}
        >
          {t('frontPage.welcome.part2')}
        </span>

        <span className="">{t('frontPage.welcome.part3')}</span>
      </h3>
    </div>
  );
};
