import { memo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import RunDetail from '@refly-packages/ai-workspace-common/components/run-detail';
import { logEvent } from '@refly/telemetry-web';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';

const RunDetailPage = memo(() => {
  const { t } = useTranslation();
  const { recordId = '' } = useParams();

  useEffect(() => {
    logEvent('run_detail_view', null, { recordId });
  }, [recordId]);

  return (
    <>
      <Helmet>
        <title>{t('runDetail.pageTitle')}</title>
      </Helmet>
      <RunDetail recordId={recordId} />
    </>
  );
});

RunDetailPage.displayName = 'RunDetailPage';

export default RunDetailPage;
