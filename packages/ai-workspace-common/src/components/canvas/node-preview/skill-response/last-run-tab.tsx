import { memo, useMemo } from 'react';
import { Button, Divider, Result, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { Thinking } from 'refly-icons';
import { ActionResult, GenericToolset } from '@refly/openapi-schema';
import { ActionContainer } from './action-container';
import { ActionStepCard } from './action-step';
import { FailureNotice } from './failure-notice';

interface LastRunTabProps {
  loading: boolean;
  isStreaming: boolean;
  result?: ActionResult;
  outputStep?: ActionResult['steps'][number];
  statusText: string;
  query?: string | null;
  title?: string;
  nodeId: string;
  selectedToolsets: GenericToolset[];
  handleDelete: () => void;
  handleRetry: () => void;
}

const LastRunTabComponent = ({
  loading,
  isStreaming,
  result,
  outputStep,
  statusText,
  query,
  title,
  nodeId,
  selectedToolsets,
  handleDelete,
  handleRetry,
}: LastRunTabProps) => {
  const { t } = useTranslation();
  const displayQuery = useMemo(() => query ?? title ?? '', [query, title]);

  const initSelectedToolsets = useMemo(
    () => (selectedToolsets?.length ? selectedToolsets : []),
    [selectedToolsets],
  );

  if (!result && !loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Result
          status="404"
          subTitle={t('canvas.skillResponse.resultNotFound')}
          extra={<Button onClick={handleDelete}>{t('canvas.nodeActions.delete')}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 overflow-auto preview-container transition-opacity duration-500">
        {loading && !isStreaming && <Skeleton className="mt-1" active paragraph={{ rows: 5 }} />}
        {(result?.status === 'executing' || result?.status === 'waiting') &&
          !outputStep &&
          statusText && (
            <div className="flex flex-col gap-2 animate-pulse">
              <Divider dashed className="my-2" />
              <div className="m-2 flex items-center gap-1 text-gray-500">
                <Thinking size={16} />
                <span className="text-sm">{statusText}</span>
              </div>
            </div>
          )}
        {outputStep && (
          <>
            <Divider dashed className="my-2" />
            <ActionStepCard
              result={result}
              step={outputStep}
              status={result?.status}
              query={displayQuery}
            />
          </>
        )}
        {result?.status === 'failed' && !loading && (
          <FailureNotice result={result} handleRetry={handleRetry} />
        )}
      </div>

      {outputStep && result?.status === 'finish' && (
        <ActionContainer
          result={result}
          step={outputStep}
          nodeId={nodeId}
          initSelectedToolsets={initSelectedToolsets ?? []}
        />
      )}
    </div>
  );
};

export const LastRunTab = memo(LastRunTabComponent);
LastRunTab.displayName = 'LastRunTab';
