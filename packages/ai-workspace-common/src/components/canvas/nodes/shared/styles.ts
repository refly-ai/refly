// Common styles for canvas nodes
export const getNodeCommonStyles = ({
  selected,
  isHovered,
}: { selected: boolean; isHovered: boolean }) => `
  bg-refly-bg-content-z2
  rounded-2xl
  box-border
  transition-all
  duration-200
  border-[1.5px]
  border-solid
  overflow-hidden
  ${selected ? 'border-refly-bg-dark' : 'border-refly-Card-Border'}
  ${isHovered || selected ? 'shadow-refly-m' : ''}
`;
