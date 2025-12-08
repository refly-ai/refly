import { useState, useEffect, useRef, ReactNode } from 'react';

interface TicketBottomCardProps {
  children: ReactNode;
  minHeight?: number;
  className?: string;
}

/**
 * A ticket-style card component with a punched circular notch at the top center.
 * The height automatically adjusts based on content.
 */
export const TicketBottomCard = ({
  children,
  minHeight = 262,
  className = '',
}: TicketBottomCardProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(minHeight);

  // Measure content height and update card height
  useEffect(() => {
    const measureHeight = () => {
      if (contentRef.current) {
        const contentHeight = contentRef.current.scrollHeight;
        // Add some padding for safety
        const calculatedHeight = Math.max(minHeight, contentHeight + 20);
        setCardHeight(calculatedHeight);
      }
    };

    measureHeight();

    // Re-measure on window resize
    window.addEventListener('resize', measureHeight);
    return () => window.removeEventListener('resize', measureHeight);
  }, [minHeight, children]);

  // Generate SVG path with dynamic height
  // The path creates a rounded rectangle with a circular notch at the top center
  const generatePath = (height: number) => {
    const cornerRadius = 22;
    const innerHeight = height - cornerRadius;

    // Path breakdown:
    // - Start at top-left (after corner), go to notch area
    // - Create the circular notch at top center
    // - Continue to top-right corner
    // - Draw right side, bottom, left side with rounded corners
    return `M358 0C369.046 0 380 10.9543 380 ${cornerRadius}V${innerHeight}C380 ${innerHeight + 11.046} 369.046 ${height} 358 ${height}H22C10.9543 ${height} 0 ${innerHeight + 11.046} 0 ${innerHeight}V${cornerRadius}C0 10.9543 10.9543 0 22 0H170C174.418 0 177.834 3.95 180.569 7.42C182.766 10.209 186.174 12 190 12C193.826 12 197.234 10.209 199.431 7.42C202.166 3.95 205.582 0 210 0H358Z`;
  };

  return (
    <div className={`absolute bottom-0 left-0 right-0 ${className}`}>
      <svg
        className="w-full"
        height={cardHeight}
        viewBox={`0 0 380 ${cardHeight}`}
        fill="none"
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        {/* Backdrop blur effect filter */}
        <defs>
          <filter id="ticket-backdrop-blur" x="-20" y="-20" width="420" height={cardHeight + 40}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
        </defs>
        {/* White semi-transparent card with punched circular notch at top */}
        <path
          d={generatePath(cardHeight)}
          fill="rgba(255, 255, 255, 0.7)"
          style={{
            filter: 'url(#ticket-backdrop-blur)',
          }}
        />
      </svg>

      {/* Content area - positioned absolutely over the SVG */}
      <div ref={contentRef} className="absolute inset-0 pt-6 pb-6 px-5 flex flex-col justify-end">
        {children}
      </div>
    </div>
  );
};

export default TicketBottomCard;
