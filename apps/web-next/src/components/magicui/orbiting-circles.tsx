import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface OrbitingCirclesProps {
  className?: string;
  children?: React.ReactNode;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
}

export const OrbitingCircles: React.FC<OrbitingCirclesProps> = ({
  className,
  children,
  reverse,
  duration = 20,
  delay = 10,
  radius = 50,
  path = true,
}) => {
  return (
    <>
      {path && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <circle
            className="stroke-black/10 stroke-1 dark:stroke-white/10"
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
          />
        </svg>
      )}

      <motion.div
        style={
          {
            '--duration': duration,
            '--radius': radius,
            '--delay': -delay,
          } as React.CSSProperties
        }
        className={cn(
          'absolute flex h-full w-full transform-gpu animate-spin items-center justify-center rounded-full border bg-black/10 [animation-delay:var(--delay)s] [animation-direction:var(--direction)] [animation-duration:calc(var(--duration)*1s)] dark:bg-white/10',
          { '[animation-direction:reverse]': reverse },
          className,
        )}
        animate={{
          rotate: reverse ? -360 : 360,
        }}
        transition={{
          duration: duration,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'linear',
        }}
      >
        <div
          style={{
            transform: `rotate(${reverse ? 360 : -360}deg)`,
          }}
        >
          {children}
        </div>
      </motion.div>
    </>
  );
};
