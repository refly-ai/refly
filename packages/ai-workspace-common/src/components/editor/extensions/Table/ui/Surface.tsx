import { cn } from '../../../../../utils/cn';
import { HTMLProps, forwardRef } from 'react';

export type SurfaceProps = HTMLProps<HTMLDivElement> & {
  withShadow?: boolean;
  withBorder?: boolean;
};

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ children, className, withShadow = true, withBorder = true, ...props }, ref) => {
    const surfaceClass = cn(
      className,
      'bg-white rounded-lg',
      withShadow ? 'shadow-lg' : '',
      withBorder ? 'border border-neutral-200' : '',
    );

    return (
      <div className={surfaceClass} {...props} ref={ref}>
        {children}
      </div>
    );
  },
);

Surface.displayName = 'Surface';
