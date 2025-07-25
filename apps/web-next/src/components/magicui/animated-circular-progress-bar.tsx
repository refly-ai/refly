import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface AnimatedCircularProgressBarProps {
  max?: number;
  min?: number;
  value?: number;
  gaugePrimaryColor?: string;
  gaugeSecondaryColor?: string;
  className?: string;
}

export const AnimatedCircularProgressBar: React.FC<AnimatedCircularProgressBarProps> = ({
  max = 100,
  min = 0,
  value = 0,
  gaugePrimaryColor = '#3b82f6',
  gaugeSecondaryColor = '#e5e7eb',
  className,
}) => {
  const [displayValue, setDisplayValue] = useState(min);
  const circumference = 2 * Math.PI * 45;
  const percentPx = circumference / 100;
  const currentPercent = ((displayValue - min) / (max - min)) * 100;

  useEffect(() => {
    const animateValue = () => {
      setDisplayValue(value);
    };
    animateValue();
  }, [value, min, max]);

  return (
    <div className={cn('relative h-40 w-40', className)}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="rotate-[-90deg] transform">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke={gaugeSecondaryColor}
          strokeWidth="10"
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          className="opacity-20"
        />

        {/* Progress circle */}
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          stroke={gaugePrimaryColor}
          strokeWidth="10"
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference}
          strokeLinecap="round"
          className="drop-shadow-sm"
          animate={{
            strokeDashoffset: circumference - percentPx * currentPercent,
          }}
          transition={{
            duration: 1,
            ease: 'easeInOut',
          }}
        />
      </svg>

      {/* Center value */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className="text-2xl font-bold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {Math.round(currentPercent)}%
        </motion.span>
      </div>
    </div>
  );
};
