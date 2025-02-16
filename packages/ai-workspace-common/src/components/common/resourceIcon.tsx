import { useState } from 'react';
import { ResourceType } from '@refly/openapi-schema';
import { IconText } from '@refly-packages/ai-workspace-common/components/common/icon';
import { BsFileRichtext } from 'react-icons/bs';
import {
  FileIcon,
  defaultStyles,
} from '@refly-packages/ai-workspace-common/components/common/resource-icon';
import { IconResourceFilled } from '@refly-packages/ai-workspace-common/components/common/icon';
import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';

const FileExtensionIcon = Object.keys(defaultStyles);
const getExtensionIcon = (extension: string, size: number) => {
  const fileExtension = FileExtensionIcon.includes(extension) ? extension : 'file';
  return <FileIcon width={size} extension={fileExtension} {...defaultStyles[fileExtension]} />;
};

export const ResourceIcon = (props: {
  url: string;
  resourceType: ResourceType;
  extension?: string;
  size?: number;
}) => {
  const { url, resourceType, extension, size = 18 } = props;
  const [showFallbackIcon, setShowFallbackIcon] = useState(false);

  if (resourceType === 'file') {
    return getExtensionIcon(extension, size);
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
