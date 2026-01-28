import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppstoreOutlined } from '@ant-design/icons';

export const SkillDocsTab = memo(() => {
  const { t } = useTranslation();

  return (
    <div className="integration-docs-body">
      <div className="integration-docs-header">
        <h2>{t('integration.skill.title')}</h2>
        <p>{t('integration.skill.description')}</p>
      </div>

      <section id="skill-coming-soon" className="integration-docs-section">
        <div className="integration-coming-soon">
          <AppstoreOutlined className="coming-soon-icon" />
          <h3>{t('integration.comingSoon')}</h3>
          <p>{t('integration.skill.comingSoonDescription')}</p>
        </div>
      </section>
    </div>
  );
});

SkillDocsTab.displayName = 'SkillDocsTab';
