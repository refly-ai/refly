import { useCallback, useEffect, useRef } from 'react';
import { useUserStoreShallow } from '@refly/stores';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';

// confetti animation styles
const CONFETTI_STYLES = `
  .particle {
    position: absolute;
    top: 0;
    left: 0;
    opacity: 0;
    animation: fly-out 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards, fade-in-out 1s linear forwards;
  }

  .shape-circle {
    border-radius: 50%;
  }

  .shape-star {
    border-radius: 3px;
    background-color: currentColor;
    clip-path: polygon(50% 0%, 65% 35%, 100% 50%, 65% 65%, 50% 100%, 35% 65%, 0% 50%, 35% 35%);
  }

  @keyframes fly-out {
    0% {
      transform: translate(-50%, -50%) scale(0.2) rotate(0deg);
    }
    100% {
      transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1) rotate(var(--rot));
    }
  }

  @keyframes fade-in-out {
    0% { opacity: 0; }
    15% { opacity: 1; }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }
`;

// confetti animation function
const fireConfetti = (container: HTMLElement) => {
  const confettiColors = ['#4FD1C5', '#38B2AC', '#FFD700', '#F687B3', '#68D391', '#B2F5EA'];
  const count = 40;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');

    // random shape
    p.classList.add(Math.random() > 0.5 ? 'shape-circle' : 'shape-star');

    // random color with safe fallback
    const colorIndex = Math.floor(Math.random() * confettiColors.length);
    p.style.backgroundColor = confettiColors[colorIndex] ?? confettiColors[0] ?? '#4FD1C5';

    // random size (10px - 20px)
    const size = 10 + Math.random() * 10;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;

    // 计算扩散坐标
    const angle = Math.random() * Math.PI * 2;
    const dist = 160 + Math.random() * 140;
    const tx = `${Math.cos(angle) * dist}px`;
    const ty = `${Math.sin(angle) * dist}px`;
    const rot = `${(Math.random() - 0.5) * 360}deg`;

    // set CSS variables
    p.style.setProperty('--tx', tx);
    p.style.setProperty('--ty', ty);
    p.style.setProperty('--rot', rot);

    // remove DOM after animation
    setTimeout(() => {
      p.remove();
    }, 1000);

    container.appendChild(p);
  }
};

export const OnboardingSuccessModal = () => {
  const { t } = useTranslation();
  const { showOnboardingSuccessAnimation, setShowOnboardingSuccessAnimation } = useUserStoreShallow(
    (state) => ({
      showOnboardingSuccessAnimation: state.showOnboardingSuccessAnimation,
      setShowOnboardingSuccessAnimation: state.setShowOnboardingSuccessAnimation,
    }),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const styleElementRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (!showOnboardingSuccessAnimation) {
      return;
    }

    // add styles
    const styleElement = document.createElement('style');
    styleElement.textContent = CONFETTI_STYLES;
    document.head.appendChild(styleElement);
    styleElementRef.current = styleElement;

    // fire animation
    const container = containerRef.current?.querySelector('#confetti-layer') as HTMLElement;
    if (container) {
      fireConfetti(container);
    }

    return () => {
      if (styleElementRef.current && document.head.contains(styleElementRef.current)) {
        document.head.removeChild(styleElementRef.current);
        styleElementRef.current = null;
      }
    };
  }, [showOnboardingSuccessAnimation]);

  const handleClose = useCallback(() => {
    setShowOnboardingSuccessAnimation(false);
    // clean styles
    if (styleElementRef.current && document.head.contains(styleElementRef.current)) {
      document.head.removeChild(styleElementRef.current);
      styleElementRef.current = null;
    }
  }, [setShowOnboardingSuccessAnimation]);

  if (!showOnboardingSuccessAnimation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[65] bg-black/50 flex flex-col items-center justify-center">
      {/* Background card container */}
      <div className="relative">
        {/* Decorative stars */}
        <svg
          className="absolute -top-12 left-16 w-5 h-5 text-[#2DD4BF] z-20"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
        </svg>
        <svg
          className="absolute -top-8 right-12 w-7 h-7 text-[#2DD4BF] z-20"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
        </svg>

        {/* Inner card (letter) - extends to bottom of main card */}
        <div
          className="absolute left-6 right-6 rounded-2xl z-10 shadow-lg"
          style={{
            top: '-20px',
            height: '320px',
            background: 'linear-gradient(90deg, #CDFFEA 0%, #E9FFFE 100%)',
          }}
        >
          {/* Title with decorative lines */}
          <div className="flex items-center justify-center gap-2 pt-6 pb-4">
            <span className="w-4 h-[1px] bg-[#2F9E8C]" />
            <span className="text-[#2F9E8C] text-base font-medium">
              {t('onboarding.rewardTitle')}
            </span>
            <span className="w-4 h-[1px] bg-[#2F9E8C]" />
          </div>
          {/* White content area */}
          <div className="mx-4 bg-white rounded-xl shadow-sm flex items-center justify-center h-[120px]">
            {/* Star icon + points text */}
            <div className="flex items-center gap-3">
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                  fill="url(#starGradient)"
                />
                <defs>
                  <linearGradient
                    id="starGradient"
                    x1="12"
                    y1="2"
                    x2="12"
                    y2="22"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#4FD1C5" />
                    <stop offset="1" stopColor="#2DD4BF" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-4xl font-bold text-gray-900">
                {t('onboarding.rewardPoints')}
              </span>
            </div>
          </div>
        </div>

        {/* Main card (envelope) */}
        <div
          className="relative rounded-3xl overflow-hidden shadow-xl"
          style={{
            width: '360px',
            height: '280px',
            marginTop: '20px',
            background: '#FFFFFF',
          }}
        >
          {/* Bottom envelope fold effect with 50% white overlay */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[40px] flex items-center justify-center z-20"
            style={{
              height: '120px',
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Action button */}
            <Button
              type="primary"
              onClick={handleClose}
              className="w-[200px] h-14 rounded-full text-lg font-medium"
            >
              {t('onboarding.startExperience')}
            </Button>
          </div>

          {/* Confetti animation layer */}
          <div
            ref={containerRef}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ top: '-20px' }}
          >
            <div
              id="confetti-layer"
              className="absolute w-0 h-0 z-[9999] pointer-events-none overflow-visible"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
