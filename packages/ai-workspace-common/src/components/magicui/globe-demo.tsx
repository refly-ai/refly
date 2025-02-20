import { Globe } from './globe';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';

export default function GlobeDemo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex h-[200px] w-full items-center justify-center overflow-hidden',
        className,
      )}
    >
      <div className="flex size-full max-w-lg flex-row items-center justify-center">
        <div className="relative flex size-full items-center justify-center">
          {/* Background Globe */}
          <Globe className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform scale-75 opacity-90" />

          {/* Overlay for better text visibility */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}
