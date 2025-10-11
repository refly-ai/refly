import React from 'react';
import { PriceContent } from '@refly-packages/ai-workspace-common/components/settings/subscribe-modal/priceContent';

/**
 * Subscribe section component following Figma design specifications
 * - Title: "定价方案"
 * - Reuses existing PriceContent component from subscribe-modal
 * - Layout: 1072px width, centered
 * - Background: Clean white background
 */
const SubscribeSection: React.FC = () => {
  return (
    <div className="w-full max-w-[1072px] mx-auto px-4 py-16">
      {/* Title */}
      <h2
        className="text-center mb-6"
        style={{
          fontFamily: 'PingFang SC, -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: 'clamp(18px, 4vw, 22px)',
          fontWeight: 600,
          lineHeight: '1.4545454545454546em',
          color: '#1C1F23',
        }}
      >
        定价方案
      </h2>

      {/* Reuse existing PriceContent component */}
      <div className="w-full">
        <PriceContent source="page" />
      </div>
    </div>
  );
};

export default SubscribeSection;
