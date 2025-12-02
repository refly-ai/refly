import { memo, useMemo } from 'react';

interface ThinkingDotsProps {
  label?: string;
}

export const ThinkingDots = memo(({ label }: ThinkingDotsProps) => {
  // Precompute indices to avoid creating arrays on each render
  const dotIndices = useMemo(() => [0, 1, 2], []);

  // Animation delays for each dot
  const delays = useMemo(() => ['0ms', '150ms', '300ms'], []);

  return (
    <div className="flex items-center gap-2">
      {label && <div className="text-refly-text-2">{label}</div>}
      <div className="flex items-center gap-1">
        {dotIndices.map((idx) => (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={idx}
            className="inline-block h-1.5 w-1.5 rounded-full bg-refly-text-2"
            style={{
              animation: 'rf-dot-pulse 1.2s infinite ease-in-out',
              animationDelay: delays[idx] ?? '0ms',
            }}
          />
        ))}
      </div>
      {/* Local keyframes for dot scaling animation */}
      <style>
        {`
          @keyframes rf-dot-pulse {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.6; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
});

ThinkingDots.displayName = 'ThinkingDots';
