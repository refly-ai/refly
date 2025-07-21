import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface AgentPanelButtonProps {
  onClick?: () => void;
}

/**
 * AgentPanelButton component - replicates the exact design from the SVG mockup
 * This is the button that shows when the pilot panel is closed
 */
export const AgentPanelButton = memo<AgentPanelButtonProps>(({ onClick }) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-20 cursor-pointer group bg-transparent border-none p-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-xl"
      onClick={onClick}
    >
      <div className="relative">
        {/* Main container with background and border */}
        <div
          className="bg-white/85 backdrop-blur-sm rounded-xl px-6 py-3 border border-black/10 shadow-lg transition-all duration-200 group-hover:shadow-xl group-hover:bg-white/90 group-hover:scale-[1.02]"
          style={{
            filter: 'drop-shadow(0px 6px 60px rgba(0, 0, 0, 0.08))',
            minWidth: '260px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {/* Refly Agent text */}
          <div className="flex items-center gap-2">
            <span
              className="font-medium text-gray-900 transition-colors duration-200 group-hover:text-gray-700"
              style={{
                fontSize: '16px',
                lineHeight: '20px',
                fontWeight: 500,
              }}
            >
              Refly
            </span>
            <span
              className="text-gray-900 font-normal transition-colors duration-200 group-hover:text-gray-700"
              style={{
                fontSize: '16px',
                lineHeight: '20px',
              }}
            >
              Agent
            </span>
          </div>

          {/* Placeholder text */}
          <span
            className="text-gray-400 font-normal flex-1 transition-colors duration-200 group-hover:text-gray-500"
            style={{
              fontSize: '16px',
              lineHeight: '20px',
              opacity: 0.6,
            }}
          >
            {t('pilot.placeholder', { defaultValue: '描述你的需求...' })}
          </span>

          {/* Three dots indicator */}
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-gray-900/60 transition-all duration-200 group-hover:bg-gray-700/70" />
            <div className="w-1 h-1 rounded-full bg-gray-900/60 transition-all duration-200 group-hover:bg-gray-700/70" />
            <div className="w-1 h-1 rounded-full bg-gray-900/60 transition-all duration-200 group-hover:bg-gray-700/70" />
          </div>
        </div>
      </div>
    </button>
  );
});

AgentPanelButton.displayName = 'AgentPanelButton';
