import { useEffect, useRef } from 'react';
import { useUserStoreShallow } from '@refly/stores';

const SUCCESS_ANIMATION_DURATION = 1800;

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
  const { showOnboardingSuccessAnimation, setShowOnboardingSuccessAnimation } = useUserStoreShallow(
    (state) => ({
      showOnboardingSuccessAnimation: state.showOnboardingSuccessAnimation,
      setShowOnboardingSuccessAnimation: state.setShowOnboardingSuccessAnimation,
    }),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showOnboardingSuccessAnimation) {
      return;
    }

    // add styles
    const styleElement = document.createElement('style');
    styleElement.textContent = CONFETTI_STYLES;
    document.head.appendChild(styleElement);

    // fire animation
    const container = containerRef.current?.querySelector('#confetti-layer') as HTMLElement;
    if (container) {
      fireConfetti(container);
    }

    const timer = window.setTimeout(() => {
      setShowOnboardingSuccessAnimation(false);
      // clean styles
      document.head.removeChild(styleElement);
    }, SUCCESS_ANIMATION_DURATION);

    return () => {
      window.clearTimeout(timer);
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, [setShowOnboardingSuccessAnimation, showOnboardingSuccessAnimation]);

  if (!showOnboardingSuccessAnimation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[65] bg-refly-bg-canvas/90 flex flex-col items-center justify-center">
      <div ref={containerRef} className="relative" style={{ width: '122px', height: '122px' }}>
        <div
          id="confetti-layer"
          className="fixed top-1/2 left-1/2 w-0 h-0 z-[9999] pointer-events-none overflow-visible -translate-x-1/2 -translate-y-1/2"
        />
      </div>
    </div>
  );
};
