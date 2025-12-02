import { memo } from 'react';

interface DiamondIconProps {
  className?: string;
  style?: React.CSSProperties;
}

export const DiamondIcon = memo(({ className, style }: DiamondIconProps) => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <path
        d="M7 0L9.5 5H12.5L7 14L1.5 5H4.5L7 0Z"
        fill="currentColor"
        style={{ filter: 'var(--refly-icon-filter, none)' }}
      />
    </svg>
  );
});

DiamondIcon.displayName = 'DiamondIcon';
