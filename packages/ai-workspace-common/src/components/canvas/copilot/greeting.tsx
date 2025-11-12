import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface GreetingProps {
  onQueryClick: (query: string) => void;
}

export const Greeting = memo(({ onQueryClick }: GreetingProps) => {
  const { t } = useTranslation();

  const icons = ['📚', '📮', '🖼'];
  const queries = useMemo(() => {
    return [
      { icon: icons[0], query: t('copilot.greeting.query1') },
      { icon: icons[1], query: t('copilot.greeting.query2') },
      { icon: icons[2], query: t('copilot.greeting.query3') },
    ];
  }, [t]);

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

        {queries.map(({ icon, query }: { icon: string; query: string }, index: number) => (
          <div
            key={index}
            className="px-3 py-1.5 rounded-lg text-xs leading-[22px] border-solid border-[1px] border-refly-Card-Border cursor-pointer hover:bg-refly-tertiary-hover"
            onClick={() => onQueryClick(query)}
          >
            {icon} {query}
          </div>
        ))}
      </div>
    </div>
  );
});

Greeting.displayName = 'Greeting';
