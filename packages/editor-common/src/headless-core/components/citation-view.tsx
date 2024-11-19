import React, { useEffect, useState } from 'react';
import { NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper } from '@tiptap/react';
import { Popover, Spin } from 'antd';
import { Reference } from '@refly/openapi-schema';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { IconLink } from '@arco-design/web-react/icon';
import { IconCanvas, IconResource } from '@refly-packages/ai-workspace-common/components/common/icon';

const CitationPopoverContent = ({ referenceId }: { referenceId: string }) => {
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState<Reference>(null);

  useEffect(() => {
    setLoading(true);
    getClient()
      .queryReferences({ body: { referenceId } })
      .then((res) => {
        if (res.data.data?.length > 0) {
          setReference(res.data.data[0]);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [referenceId]);

  let icon = <IconLink />;
  if (reference?.targetType === 'resource') {
    icon = <IconResource />;
  } else if (reference?.targetType === 'canvas') {
    icon = <IconCanvas />;
  }

  return (
    <Spin className="w-10" spinning={loading}>
      <div className="flex items-center gap-2">
        {icon}
        <div>{reference?.targetMeta?.title}</div>
      </div>
      <div>{reference?.targetMeta?.url}</div>
      {reference?.targetMeta?.description && (
        <div className="mt-2 max-w-[400px] max-h-[150px] overflow-scroll text-xs text-gray-500">
          {reference?.targetMeta?.description}
        </div>
      )}
    </Spin>
  );
};

export const CitationView: React.FC<NodeViewProps> = ({ node }) => {
  const { seq, referenceId, title } = node.attrs;

  return (
    <NodeViewWrapper className="inline-block">
      <Popover
        mouseEnterDelay={0.6}
        trigger={['hover', 'click']}
        content={<CitationPopoverContent referenceId={referenceId} />}
      >
        <span className="text-sm ml-1 cursor-pointer bg-gray-100 text-gray-500 rounded-sm hover:text-green-500">
          [{seq}]
        </span>
      </Popover>
    </NodeViewWrapper>
  );
};
