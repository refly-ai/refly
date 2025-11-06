import { memo, useCallback, useMemo } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { MyUploadItem } from './my-upload-item';
import { Resource } from '@refly/openapi-schema';
import { CanvasNode } from '@refly/canvas-common';

interface MyUploadListProps {
  resources: Resource[];
  searchKeyword: string;
  currentResource: CanvasNode | null;
  setCurrentResource: (resource: CanvasNode | null) => void;
}

export const MyUploadList = memo((props: MyUploadListProps) => {
  const { resources, searchKeyword, currentResource, setCurrentResource } = props;

  const { t } = useTranslation();

  // Filter resources by search keyword
  const filteredResources = useMemo(() => {
    if (!resources?.length) {
      return [];
    }

    let filtered = resources;
    if (searchKeyword?.trim()) {
      const keyword = searchKeyword.toLowerCase().trim();
      filtered = filtered.filter((resource) => {
        const title = resource.title?.toLowerCase() ?? '';
        return title.includes(keyword);
      });
    }

    return filtered;
  }, [resources, searchKeyword]);

  const handleResourceSelect = useCallback(
    (resource: Resource, beforeParsed: boolean) => {
      if (beforeParsed) {
        message.error(
          t('resource.wait_parse_tip', {
            defaultValue: 'The file has not been parsed yet, can not be viewed',
          }),
        );
        return;
      }
      const nodeLike = {
        id: resource.resourceId,
        type: 'resource' as const,
        position: { x: 0, y: 0 }, // Default position
        data: {
          title: resource.title,
          entityId: resource.resourceId,
          metadata: {
            ...resource.data,
            shareId: resource.shareId,
            indexStatus: resource.indexStatus,
            resourceType: resource.resourceType,
          },
        },
      };
      setCurrentResource(nodeLike);
    },
    [setCurrentResource, t],
  );

  if (!filteredResources?.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-refly-text-2 text-sm leading-5">
        {searchKeyword?.trim()
          ? t('canvas.resourceLibrary.noSearchResults')
          : t('canvas.resourceLibrary.empty')}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="h-full flex flex-col gap-2">
        {filteredResources?.map((resource: Resource) => (
          <MyUploadItem
            key={resource.resourceId}
            resource={resource}
            isActive={currentResource?.data?.entityId === resource.resourceId}
            onSelect={handleResourceSelect}
          />
        ))}
      </div>
    </div>
  );
});

MyUploadList.displayName = 'MyUploadList';
