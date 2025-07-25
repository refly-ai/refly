import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface PulsatingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  pulseColor?: string;
  duration?: string;
}

export const PulsatingButton: React.FC<PulsatingButtonProps> = ({
  children,
  className,
  pulseColor = '59, 130, 246',
  duration = '1.5s',
  ...props
}) => {
  return (
    <motion.button
      className={cn(
        'relative inline-flex h-12 animate-pulse cursor-pointer items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white backdrop-blur-3xl transition-colors',
        className,
      )}
      style={{
        boxShadow: `0 0 0 1px rgba(${pulseColor}, 0.3), 0 0 0 4px rgba(${pulseColor}, 0.1)`,
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      {...props}
    >
      <div className="relative z-10">{children}</div>
      <motion.div
        className="absolute inset-0 rounded-lg"
        style={{
          background: `rgba(${pulseColor}, 0.1)`,
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.7, 0.3, 0.7],
        }}
        transition={{
          duration: Number.parseFloat(duration),
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute inset-0 rounded-lg"
        style={{
          background: `rgba(${pulseColor}, 0.05)`,
        }}
        animate={{
          scale: [1, 1.4, 1],
          opacity: [0.5, 0.1, 0.5],
        }}
        transition={{
          duration: Number.parseFloat(duration),
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
          delay: 0.3,
        }}
      />
    </motion.button>
  );
};
