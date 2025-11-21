import { Typography } from 'antd';
import { IContextItem } from '@refly/common-types';
import { PreviewContextManager } from './preview-context-manager';
import { useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { processQueryWithMentions } from '@refly/utils/query-processor';

import { DriveFile } from '@refly/openapi-schema';

const { Paragraph } = Typography;

interface PreviewChatInputProps {
  enabled: boolean;
  contextItems: IContextItem[];
  query: string;
  actionMeta?: {
    icon?: any;
    name?: string;
  };
  setEditMode: (mode: boolean) => void;
  readonly?: boolean;
  files?: DriveFile[];
}

const PreviewChatInputComponent = (props: PreviewChatInputProps) => {
  const { enabled, contextItems, query, readonly, setEditMode, files } = props;
  const { t } = useTranslation();

  // Function to render query with @variableName format as components
  const renderQueryWithVariables = useMemo(() => {
    if (!query) return t('common.noContent');

    const { processedQuery } = processQueryWithMentions(query, { files });
    return String(processedQuery);
  }, [query, t, files]);

  if (!enabled) {
    return null;
  }

  return (
    <div
      className="min-h-10 rounded-lg bg-refly-bg-control-z0 p-2 hover:bg-refly-tertiary-hover cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        if (!readonly) {
          setEditMode(true);
        }
      }}
    >
      {contextItems?.length > 0 && <PreviewContextManager contextItems={contextItems} />}
      <Paragraph
        className="text-sm break-all text-refly-text-0 font-normal leading-5 !mb-0"
        style={{ fontFamily: 'PingFang SC', letterSpacing: 0 }}
        ellipsis={{ rows: 4 }}
      >
        {renderQueryWithVariables}
      </Paragraph>
    </div>
  );
};

const arePropsEqual = (prevProps: PreviewChatInputProps, nextProps: PreviewChatInputProps) => {
  return (
    prevProps.enabled === nextProps.enabled &&
    prevProps.query === nextProps.query &&
    prevProps.readonly === nextProps.readonly &&
    prevProps.contextItems === nextProps.contextItems &&
    prevProps.actionMeta?.name === nextProps.actionMeta?.name
  );
};

export const PreviewChatInput = memo(PreviewChatInputComponent, arePropsEqual);
