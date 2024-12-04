import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useMatch, useSearchParams, useParams } from '@refly-packages/ai-workspace-common/utils/router';
import {
  CanvasNode,
  DocumentNodeProps,
  ResourceNodeProps,
  SkillResponseNode,
  SkillResponseNodeProps,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { DocumentNode, ResourceNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';

export const ContextPreview = ({ item }: { item: CanvasNode }) => {
  const { t } = useTranslation();
  const isShare = useMatch('/share/:shareCode');
  const { shareCode } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  console.log('item', item);

  const [content, setContent] = useState<string>((item?.data?.metadata?.contentPreview as string) || '');
  const [isLoading, setIsLoading] = useState(false);

  const getDocumentDetail = async (docId: string) => {
    setIsLoading(true);
    const { data, error } = await getClient().getDocumentDetail({
      query: { docId },
    });
    setIsLoading(false);

    if (error) {
      return;
    }

    setContent(data?.data?.content);
  };

  const getResourceDetail = async (resourceId: string) => {
    setIsLoading(true);
    const { data: newRes, error } = await getClient().getResourceDetail({
      query: {
        resourceId,
      },
    });
    setIsLoading(false);

    if (error) {
      return;
    }

    setContent(newRes?.data?.content);
  };

  const getShareDocument = async (targetDocId?: string) => {
    setIsLoading(true);
    const { data } = await getClient().getShareContent({
      query: {
        shareCode: shareCode || '',
        ...(targetDocId ? { docId: targetDocId } : {}),
      },
    });
    setIsLoading(false);

    if (!data?.success) {
      return;
    }
    const result = data.data;

    setContent(result?.document?.content);
  };

  const handleShareCanvasChange = (canvasId: string) => {
    setSearchParams({ canvasId }, { replace: true });
  };

  const fetchContent = async () => {
    if (!item?.data?.entityId || (item?.data?.metadata?.sourceType as string)?.includes('Selection')) {
      setContent((item?.data?.metadata?.contentPreview as string) ?? '');
      return;
    }
    try {
      if (item.type === 'document') {
        if (isShare) {
          await getShareDocument(item.data.entityId);
        } else {
          await getDocumentDetail(item.data.entityId);
        }
      } else if (item.type === 'resource') {
        await getResourceDetail(item.data.entityId);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
    }
  };

  useEffect(() => {
    fetchContent();
  }, [item.id]);

  const renderPreviewNode = () => {
    const commonProps = {
      isPreview: true,
      hideActions: true,
      hideHandles: true,
      data: { ...item.data, contentPreview: content },
      selected: false,
      id: item.id,
    };

    switch (item.type) {
      case 'document':
        return <DocumentNode {...(commonProps as DocumentNodeProps)} />;
      case 'resource':
        return <ResourceNode {...(commonProps as ResourceNodeProps)} />;
      case 'skillResponse':
        return <SkillResponseNode {...(commonProps as SkillResponseNodeProps)} />;
      default:
        return null;
    }
  };

  return (
    <div className="preview-content bg-transparent flex flex-1 justify-center items-center p-4">
      {renderPreviewNode()}
    </div>
  );
};
