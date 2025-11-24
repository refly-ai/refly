import { useState } from 'react';
import { ResourceMeta, ResourceType } from '@refly/openapi-schema';
import { IconText } from '@refly-packages/ai-workspace-common/components/common/icon';
import { BsFileRichtext } from 'react-icons/bs';
import { IconResourceFilled } from '@refly-packages/ai-workspace-common/components/common/icon';
import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';

export const ResourceIcon = (props: {
  url: string;
  resourceType: ResourceType;
  resourceMeta: ResourceMeta;
  size?: number;
}) => {
  const { url, resourceType, size = 18 } = props;
  const [showFallbackIcon, setShowFallbackIcon] = useState(false);

  if (
    resourceType === 'file' ||
    resourceType === 'image' ||
    resourceType === 'video' ||
    resourceType === 'audio'
  ) {
    return <NodeIcon type="resource" filename={resourceType} filled={false} iconSize={size} />;
  }

  if (url) {
    return showFallbackIcon ? (
      <IconResourceFilled color={NODE_COLORS.resource} size={size} />
    ) : (
      <img
        style={{ width: size, height: size }}
        src={`https://www.google.com/s2/favicons?domain=${url}&sz=${size}`}
        alt={url}
        onError={() => setShowFallbackIcon(true)}
      />
    );
  }
  return resourceType === 'text' ? <IconText size={size} /> : <BsFileRichtext size={size} />;
};
