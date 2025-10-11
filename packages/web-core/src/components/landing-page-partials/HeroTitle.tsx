import React from 'react';

/**
 * Hero title component following Figma design specifications
 * - Main title: "From Words to Workflows, Open and Reusable."
 * - Subtitle: "Think it. Chat it. Workflow it."
 * - Font: Average (fallback to serif fonts)
 * - Spacing: 24px gap, 32px top padding
 * - Colors: Main title black (#000000), subtitle dark gray (#1C1F23)
 * - Responsive: Scales down on smaller screens
 */
const HeroTitle: React.FC = () => {
  return (
    <div
      className="flex flex-col items-center justify-center gap-6 pt-8 px-4 mx-auto my-[60px]"
      style={{
        fontFamily: 'Average, "Times New Roman", Georgia, serif',
        paddingTop: '32px',
        gap: '24px',
      }}
    >
      {/* Main title */}
      <h1
        className="text-center font-normal leading-tight"
        style={{
          fontSize: 'clamp(32px, 4vw, 48px)',
          lineHeight: '1.216',
          color: '#000000',
          fontWeight: 400,
          maxWidth: '100%',
        }}
      >
        From Words to Workflows, Open and Reusable.
      </h1>

      {/* Subtitle */}
      <h2
        className="text-center font-normal leading-tight"
        style={{
          fontSize: 'clamp(24px, 3vw, 36px)',
          lineHeight: '1.333',
          color: '#1C1F23',
          fontWeight: 400,
          maxWidth: '100%',
        }}
      >
        Think it. Chat it. Workflow it.
      </h2>
    </div>
  );
};

export default HeroTitle;
