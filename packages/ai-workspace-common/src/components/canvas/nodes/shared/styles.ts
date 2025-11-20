import { CanvasNodeType } from '@refly/openapi-schema';

// Common styles for canvas nodes
export const getNodeCommonStyles = ({
  selected,
  isHovered,
  nodeType,
}: { selected: boolean; isHovered: boolean; nodeType?: CanvasNodeType }) => `
  bg-refly-bg-content-z2
  rounded-2xl
  box-border
  transition-all
  duration-200
  border-[1.5px]
  border-solid
  overflow-hidden
  ${selected ? 'border-refly-bg-dark' : isHovered && nodeType === 'skillResponse' ? 'border-refly-node-run' : 'border-refly-Card-Border'}
  ${isHovered || selected ? 'shadow-refly-m' : ''}
`;
