import { memo, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from 'antd';
import { useUserStoreShallow } from '@refly/stores';
import { PromptSuggestion } from '@refly/openapi-schema';
import { useGetPromptSuggestions } from '@refly-packages/ai-workspace-common/queries';
import {
  fallbackPrompts,
  defaultPromt,
} from '@refly-packages/ai-workspace-common/components/pure-copilot';

interface GreetingProps {
  onQueryClick: (query: string) => void;
}

export const Greeting = memo(({ onQueryClick }: GreetingProps) => {
  const { t, i18n } = useTranslation();

  const { showOnboardingFormModal } = useUserStoreShallow((state) => ({
    showOnboardingFormModal: state.showOnboardingFormModal,
  }));

  const { data, isLoading, refetch } = useGetPromptSuggestions();

  useEffect(() => {
    if (!showOnboardingFormModal) {
      refetch();
    }
  }, [showOnboardingFormModal, refetch]);

  const samplePrompts = useMemo(() => {
    if (data?.data && data.data.length > 0) {
      return [defaultPromt, ...data.data];
    }
    return [...fallbackPrompts];
  }, [data?.data]);

  const getPromptText = useCallback(
    (prompt: PromptSuggestion) => {
      const texts = prompt.prompt ?? {};
      const currentLang = i18n.language;
      if (texts[currentLang]) return texts[currentLang];
      if (currentLang.startsWith('zh')) {
        return texts['zh-CN'] ?? texts.zh ?? texts.en ?? Object.values(texts)[0] ?? '';
      }
      return texts.en ?? Object.values(texts)[0] ?? '';
    },
    [i18n.language],
  );

  return (
    <div className="w-full h-full px-4 flex flex-col items-center justify-end pb-[38px] min-h-[400px]">
      <div className="text-refly-text-0 text-2xl font-bold leading-7">
        {t('copilot.greeting.title')}
      </div>
      <div className="mt-1 text-refly-text-2 text-base leading-5">
        {t('copilot.greeting.subtitle')}
      </div>

      <div className="w-full flex flex-col gap-3 mt-[100px]">
        <div className="text-refly-text-2 text-xs leading-4">{t('copilot.greeting.youCanTry')}</div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton.Button active block className="!h-[36px] !rounded-lg" />
            <Skeleton.Button active block className="!h-[36px] !rounded-lg" />
            <Skeleton.Button active block className="!h-[36px] !rounded-lg" />
          </div>
        ) : (
          samplePrompts.map((prompt, index) => {
            const text = getPromptText(prompt);
            return (
              <div
                key={index}
                className="px-3 py-1.5 rounded-lg text-xs leading-[22px] border-solid border-[1px] border-refly-Card-Border cursor-pointer hover:bg-refly-tertiary-hover flex items-center justify-between group"
                onClick={() => onQueryClick(text)}
              >
                <span>{text}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

Greeting.displayName = 'Greeting';
