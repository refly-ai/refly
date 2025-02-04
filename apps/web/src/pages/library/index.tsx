import { Helmet } from 'react-helmet';

import { ContentPanel } from '@refly-packages/ai-workspace-common/components/workspace/content-panel';

import './index.scss';
// types
import { useTranslation } from 'react-i18next';

const Library = () => {
  const { t } = useTranslation();

  return (
    <div className="workspace-container" style={{}}>
      <Helmet>
        <title>
          {t('productName')} | {t('landingPage.slogan')}
        </title>
        <meta name="description" content={t('landingPage.description')} />
      </Helmet>
      <div className="workspace-inner-container">
        <ContentPanel />
      </div>
    </div>
  );
};

export default Library;
