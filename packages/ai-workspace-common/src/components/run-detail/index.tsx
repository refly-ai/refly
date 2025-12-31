import { memo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Empty, message } from 'antd';
import { client } from '@refly/openapi-schema';
import { Canvas, SnapshotData } from '@refly-packages/ai-workspace-common/components/canvas';
import { RunDetailInfo } from '@refly-packages/ai-workspace-common/components/canvas/run-detail-panel';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { logEvent } from '@refly/telemetry-web';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import './index.scss';

export type RunDetailType = 'workflow' | 'template' | 'schedule';

interface ScheduleRecordDetail {
  scheduleRecordId: string;
  scheduleId: string;
  workflowExecutionId?: string;
  uid: string;
  canvasId: string;
  sourceCanvasId?: string;
  workflowTitle: string;
  usedTools?: string;
  status: string;
  creditUsed: number;
  scheduledAt: string;
  triggeredAt: string;
  completedAt?: string;
  failureReason?: string;
  snapshotStorageKey?: string;
  scheduleName: string;
}

interface RunDetailProps {
  recordId: string;
  type?: RunDetailType;
}

const RunDetail = memo(({ recordId, type = 'schedule' }: RunDetailProps) => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [canvasDataLoading, setCanvasDataLoading] = useState(false);
  const [record, setRecord] = useState<ScheduleRecordDetail | null>(null);
  const [canvasData, setCanvasData] = useState<SnapshotData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { duplicateCanvas, loading: duplicateLoading } = useDuplicateCanvas();

  // Fetch record detail
  useEffect(() => {
    const fetchRecordDetail = async () => {
      if (!recordId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await client.post({
          url: '/schedule/record/detail',
          body: { scheduleRecordId: recordId },
        });

        const responseData = (response.data as any)?.data;
        if (responseData) {
          setRecord(responseData as ScheduleRecordDetail);
        } else {
          setError(t('runDetail.notFound'));
        }
      } catch (err) {
        console.error('Failed to fetch record detail:', err);
        setError(t('runDetail.notFound'));
      } finally {
        setLoading(false);
      }
    };

    fetchRecordDetail();
  }, [recordId, t]);

  // Fetch canvas data directly using canvasId from record
  useEffect(() => {
    const fetchCanvasData = async () => {
      if (!record?.canvasId) return;

      setCanvasDataLoading(true);

      try {
        const response = await getClient().getCanvasData({
          query: { canvasId: record.canvasId },
        });

        const responseData = response.data?.data;
        if (responseData) {
          setCanvasData({
            title: responseData.title || record.workflowTitle,
            nodes: responseData.nodes || [],
            edges: responseData.edges || [],
          } as SnapshotData);
        }
      } catch (err) {
        console.error('Failed to fetch canvas data:', err);
        // Canvas data error is not critical, we can still show the record info
      } finally {
        setCanvasDataLoading(false);
      }
    };

    fetchCanvasData();
  }, [record?.canvasId]);

  const handleDuplicate = useCallback(() => {
    if (!record?.canvasId) {
      message.error(t('runDetail.duplicateFailed'));
      return;
    }

    // Log run_make_copy event
    logEvent('run_make_copy', Date.now(), {
      type,
      recordId,
      canvasId: record.canvasId,
      sourceCanvasId: record.sourceCanvasId,
    });

    duplicateCanvas({
      canvasId: record.canvasId,
      title: record.workflowTitle || t('common.untitled'),
      isCopy: true,
      onSuccess: () => {
        message.success(t('runDetail.duplicateSuccess'));
      },
    });
  }, [record, duplicateCanvas, t, type, recordId]);

  // Build runDetailInfo from record
  // Use sourceCanvasId for navigation to the original canvas (template)
  const runDetailInfo: RunDetailInfo | undefined = record
    ? {
        status: record.status,
        triggeredAt: record.triggeredAt,
        completedAt: record.completedAt,
        creditUsed: record.creditUsed,
        failureReason: record.failureReason,
        canvasId: record.sourceCanvasId || record.canvasId,
        workflowTitle: record.workflowTitle,
      }
    : undefined;

  if (loading) {
    return (
      <div className="run-detail w-full h-full flex items-center justify-center bg-refly-bg-main-z1">
        <Spin size="large" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="run-detail w-full h-full flex items-center justify-center bg-refly-bg-main-z1">
        <Empty
          description={<span className="text-refly-text-2">{t('runDetail.notFound')}</span>}
          image={EmptyImage}
          imageStyle={{ width: 180, height: 180 }}
        />
      </div>
    );
  }

  return (
    <div className="run-detail w-full h-full flex flex-col overflow-hidden">
      {canvasDataLoading ? (
        <div className="w-full h-full flex items-center justify-center bg-refly-bg-main-z1">
          <Spin size="large" />
        </div>
      ) : canvasData ? (
        <Canvas
          canvasId={record.canvasId}
          readonly
          snapshotData={canvasData}
          hideLogoButton
          runDetailInfo={runDetailInfo}
          onDuplicate={handleDuplicate}
          duplicateLoading={duplicateLoading}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-refly-bg-main-z1">
          <Empty
            description={<span className="text-refly-text-2">{t('runDetail.noSnapshot')}</span>}
            image={EmptyImage}
            imageStyle={{ width: 120, height: 120 }}
          />
        </div>
      )}
    </div>
  );
});

RunDetail.displayName = 'RunDetail';

export default RunDetail;
