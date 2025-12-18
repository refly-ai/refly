import { ReactNode } from 'react';

interface TicketBottomCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * A ticket-style card component with a punched circular notch at the top center.
 * Uses CSS for the shape, making it responsive to width changes.
 */
export const TicketBottomCard = ({ children, className = '' }: TicketBottomCardProps) => {
  return (
    <div className={`absolute bottom-4 left-1 right-2 z-10 ${className}`}>
      {/* Card background with rounded corners */}
      <div
        className="relative rounded-[16px]"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        {/* Circular notch at top center - created using a pseudo-element approach */}
        {/* <div
          className="absolute left-1/2 -translate-x-1/2 -top-[6px] w-[24px] h-[12px] rounded-b-full"
          style={{
            backgroundColor: 'transparent',
            boxShadow: '0 -10px 0 0 rgba(255, 255, 255, 0.7)',
          }}
        /> */}
        {/* Mask for the notch - covers the card area where the notch should punch through */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-[1px] w-[24px] h-[13px]"
          style={{
            background: '#DBFFF4',
            borderRadius: '0 0 12px 12px',
          }}
        />

        {/* Content area */}
        <div
          className="pt-4 pb-4 px-4 flex flex-col"
          style={{
            filter: 'drop-shadow(0 -2px 2px rgba(42, 121, 105, 0.05))',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default TicketBottomCard;
