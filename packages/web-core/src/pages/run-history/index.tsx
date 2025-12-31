import { memo, useEffect } from 'react';
import RunHistoryList from '@refly-packages/ai-workspace-common/components/run-history';
import { logEvent } from '@refly/telemetry-web';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';

export const RunHistoryPage = memo(() => {
  const { t } = useTranslation();

  useEffect(() => {
    logEvent('run_history_view');
  }, []);

  return (
    <>
      <Helmet>
        <title>{t('runHistory.pageTitle')}</title>
      </Helmet>
      <RunHistoryList />
    </>
  );
});

RunHistoryPage.displayName = 'RunHistoryPage';

export default RunHistoryPage;
