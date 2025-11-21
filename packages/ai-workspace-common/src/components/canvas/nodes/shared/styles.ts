// Common styles for canvas nodes
export const getNodeCommonStyles = ({
  selected,
  isHovered,
  shouldHighlight,
}: { selected: boolean; isHovered: boolean; shouldHighlight?: boolean }) => `
  bg-refly-bg-content-z2
  rounded-2xl
  box-border
  transition-all
  duration-200
  border-[1.5px]
  border-solid
  overflow-hidden
  ${selected ? 'border-refly-bg-dark' : shouldHighlight ? 'border-refly-node-run' : 'border-refly-Card-Border'}
  ${isHovered || selected ? 'shadow-refly-m' : ''}
`;
