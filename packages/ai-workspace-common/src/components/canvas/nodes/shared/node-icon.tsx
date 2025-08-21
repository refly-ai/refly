import type { ComponentType, NamedExoticComponent } from 'react';
import { memo } from 'react';
import {
  NODE_COLORS,
  type ResourceFileType,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';
import { CanvasNodeType, ResourceMeta, ResourceType, SelectionKey } from '@refly/openapi-schema';
import { GrResources } from 'react-icons/gr';

import {
  AiChat,
  Group,
  Image,
  Video,
  Audio,
  Web1,
  Note,
  Media,
  Code1,
  Pdf,
  Doc1,
  Markdown,
  Text,
  Excel,
  CodeZip,
  GeneralFile,
  Html,
} from 'refly-icons';
import { Avatar } from 'antd';
import { Favicon } from '../../../common/favicon';

type IconComponent = ComponentType<{ size?: number | string; color?: string }>;
const ICONS: Record<CanvasNodeType | SelectionKey, IconComponent> = {
  group: Group,
  image: Image,
  video: Video,
  audio: Audio,
  document: Doc1,
  resource: GrResources,
  codeArtifact: Code1,
  website: Web1,
  memo: Note,
  skillResponse: AiChat,
  // Add missing types with reasonable defaults
  tool: AiChat,
  toolResponse: AiChat,
  skill: AiChat,
  mediaSkill: Media,
  mediaSkillResponse: Media,
  documentSelection: Doc1,
  resourceSelection: Doc1,
  skillResponseSelection: AiChat,
  extensionWeblinkSelection: Web1,
  documentCursorSelection: Doc1,
  documentBeforeCursorSelection: Doc1,
  documentAfterCursorSelection: Doc1,
};

const RESOURCE_ICONS: Record<ResourceFileType, IconComponent> = {
  'application/pdf': Pdf,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': Doc1,
  'text/markdown': Markdown,
  'text/plain': Text,
  'application/epub+zip': CodeZip,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': Excel,
  'text/html': Html,
};

interface NodeIconProps {
  type: CanvasNodeType | SelectionKey;
  className?: string;
  iconColor?: string;
  iconSize?: number;
  small?: boolean;
  filled?: boolean;
  url?: string;
  resourceType?: ResourceType;
  resourceMeta?: ResourceMeta;
}

export const NodeIcon: NamedExoticComponent<NodeIconProps> = memo(
  ({
    type,
    className,
    iconColor = 'white',
    iconSize,
    small = false,
    filled = true,
    url,
    resourceType,
    resourceMeta,
  }: NodeIconProps) => {
    const size = !filled ? 20 : small ? 14 : 16;

    const isWeblink = type === 'resource' && resourceType === 'weblink';
    const isResourceFile = type === 'resource' && resourceType === 'file' && resourceMeta;

    const Icon =
      (isResourceFile ? RESOURCE_ICONS[resourceMeta?.contentType ?? ''] : ICONS[type]) ??
      GeneralFile;

    const resolvedColor = isResourceFile
      ? (NODE_COLORS[resourceMeta?.contentType ?? ''] ?? NODE_COLORS.resource)
      : (NODE_COLORS[type] ?? NODE_COLORS.document);

    if (isWeblink && resourceMeta?.url) {
      return (
        <div className="rounded-md flex items-center justify-center flex-shrink-0">
          <Favicon url={resourceMeta.url} size={iconSize || size} />
        </div>
      );
    }

    if (url) {
      return (
        <div className="rounded-md flex items-center justify-center flex-shrink-0">
          <Avatar
            src={url}
            alt={type}
            icon={<Image size={size} />}
            className={`rounded-md object-cover ${small ? 'w-5 h-5' : 'w-6 h-6'} ${
              className ?? ''
            }`}
          />
        </div>
      );
    }

    if (!filled) {
      return (
        <div
          className={`rounded-md flex items-center justify-center flex-shrink-0 ${
            small ? 'w-5 h-5' : 'w-6 h-6'
          } ${className ?? ''}`}
        >
          <Icon size={iconSize || size} color={resolvedColor ?? iconColor} />
        </div>
      );
    }

    return (
      <div
        className={`rounded-md flex items-center justify-center flex-shrink-0 ${
          small ? 'w-5 h-5' : 'w-6 h-6'
        } ${type === 'image' ? 'bg-gradient-to-r from-pink-500 to-purple-500' : ''} ${
          className ?? ''
        }`}
        style={{ backgroundColor: resolvedColor }}
      >
        <Icon size={iconSize || size} color="white" />
      </div>
    );
  },
);

NodeIcon.displayName = 'NodeIcon';
