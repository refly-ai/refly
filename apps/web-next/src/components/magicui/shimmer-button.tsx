import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  shimmerColor?: string;
  background?: string;
  shimmerSize?: string;
  borderRadius?: string;
}

export const ShimmerButton: React.FC<ShimmerButtonProps> = ({
  children,
  className,
  shimmerColor = '#ffffff',
  background = 'rgba(0, 0, 0, 1)',
  shimmerSize = '100px',
  borderRadius = '100px',
  ...props
}) => {
  return (
    <motion.button
      style={
        {
          '--spread': '90deg',
          '--shimmer-color': shimmerColor,
          '--radius': borderRadius,
          '--speed': '1.5s',
          '--cut': '0.1em',
          '--bg': background,
        } as React.CSSProperties
      }
      className={cn(
        'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10 px-6 py-3 text-white [background:var(--bg)] [border-radius:var(--radius)] dark:text-black',
        'transform-gpu transition-transform duration-300 ease-in-out active:translate-y-[1px]',
        className,
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      {...props}
    >
      {/* spark container */}
      <div
        className={cn(
          '-z-30 blur-[2px]',
          'absolute inset-0 overflow-visible [container-type:size]',
        )}
      >
        {/* spark */}
        <div className="absolute inset-0 h-[100cqh] animate-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
          {/* spark before */}
          <div className="animate-spin-around absolute inset-[-100%] w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </div>
      </div>

      {/* backdrop */}
      <div
        className={cn(
          '-z-20',
          'absolute inset-[var(--cut)] rounded-[calc(var(--radius)-var(--cut))] bg-[var(--bg)]',
        )}
      />

      {/* content */}
      <div className="relative z-20">{children}</div>
    </motion.button>
  );
};
