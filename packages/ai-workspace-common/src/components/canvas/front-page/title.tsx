import { useTranslation } from 'react-i18next';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { canvasTemplateEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';

export const Title = () => {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh-CN';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center mb-6',
        canvasTemplateEnabled ? 'mt-48' : '',
      )}
    >
      <div className="flex flex-col max-w-full w-[800px]">
        <div className="flex gap-2 justify-center items-center self-center">
          {isZh ? (
            <div className="flex gap-2 items-center text-zinc-900 text-3xl font-semibold leading-10 text-center">
              <div className="self-stretch my-auto">和</div>
              <Logo logoProps={{ show: false }} textProps={{ show: true, className: 'w-[70px]' }} />
              <div className="self-stretch my-auto">一起探索</div>
              <div className="self-stretch my-auto text-emerald-600">好奇心</div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 items-center my-auto text-zinc-900 text-3xl font-semibold leading-none text-center whitespace-nowrap">
                <span className="self-stretch my-auto">Explore</span>
                <span className="self-stretch my-auto text-emerald-600">Curiosity</span>
                <span className="self-stretch my-auto">With</span>
                <Logo
                  logoProps={{ show: false }}
                  textProps={{ show: true, className: 'w-[70px]' }}
                />
              </div>
            </>
          )}
        </div>
      </div>
      {/* <h3
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
      </h3> */}
    </div>
  );
};
