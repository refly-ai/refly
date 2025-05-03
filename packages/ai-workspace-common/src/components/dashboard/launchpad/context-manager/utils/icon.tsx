import {
  IconMemo,
  IconResponseFilled,
  IconResourceFilled,
  IconDocumentFilled,
  IconThreadHistoryFilled,
  IconQuote,
  IconImageFilled,
  IconCodeArtifact,
  IconWebsite,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';
import { CanvasNodeType, SelectionKey } from '@refly/openapi-schema';

export const getContextItemIcon = (
  type: CanvasNodeType | SelectionKey,
  style?: React.CSSProperties,
  options?: { withHistory?: boolean },
) => {
  const color = NODE_COLORS[type];

  switch (type) {
    case 'resource':
      return <IconResourceFilled style={{ color, ...style }} />;
    case 'document':
      return <IconDocumentFilled style={{ color, ...style }} />;
    case 'memo':
      return <IconMemo style={{ color, ...style }} />;
    case 'skillResponse':
      return options?.withHistory ? (
        <IconThreadHistoryFilled style={{ color: NODE_COLORS.threadHistory, ...style }} />
      ) : (
        <IconResponseFilled style={{ color, ...style }} />
      );
    case 'codeArtifact':
      return <IconCodeArtifact style={{ color, ...style }} />;
    case 'website':
      return <IconWebsite style={{ color, ...style }} />;
    case 'resourceSelection':
    case 'documentSelection':
    case 'skillResponseSelection':
      return <IconQuote style={{ color, ...style }} />;
    case 'image':
      return <IconImageFilled style={{ color, ...style }} />;
    default:
      return null;
  }
};
