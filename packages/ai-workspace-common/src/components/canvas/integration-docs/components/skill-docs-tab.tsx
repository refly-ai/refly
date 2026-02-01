import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppstoreOutlined } from '@ant-design/icons';

export const SkillDocsTab = memo(() => {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-[800px] pt-5 px-4 pb-10 md:pt-6 md:px-5 md:pb-12 lg:pt-8 lg:px-10 lg:pb-16">
      <div className="mb-8">
        <h2 className="text-[22px] md:text-[28px] font-semibold text-[var(--integration-docs-text-1)] mb-2">
          {t('integration.skill.title')}
        </h2>
        <p className="m-0 text-[15px] text-[var(--integration-docs-text-2)] leading-relaxed">
          {t('integration.skill.description')}
        </p>
      </div>

      <section id="skill-coming-soon" className="mb-10 scroll-mt-6 last:mb-0">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center text-[var(--integration-docs-text-3)]">
          <AppstoreOutlined className="text-[48px] mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-[var(--integration-docs-text-2)] mb-2">
            {t('integration.comingSoon')}
          </h3>
          <p className="text-sm max-w-[300px]">{t('integration.skill.comingSoonDescription')}</p>
        </div>
      </section>
    </div>
  );
});

SkillDocsTab.displayName = 'SkillDocsTab';
