import { useEffect } from 'react';
import Lottie from 'lottie-react';
import { useUserStoreShallow } from '@refly/stores';
import successAnimation from './loading.json';

const SUCCESS_ANIMATION_DURATION = 1800;

export const OnboardingSuccessModal = () => {
  const { showOnboardingSuccessAnimation, setShowOnboardingSuccessAnimation } = useUserStoreShallow(
    (state) => ({
      showOnboardingSuccessAnimation: state.showOnboardingSuccessAnimation,
      setShowOnboardingSuccessAnimation: state.setShowOnboardingSuccessAnimation,
    }),
  );

  useEffect(() => {
    if (!showOnboardingSuccessAnimation) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShowOnboardingSuccessAnimation(false);
    }, SUCCESS_ANIMATION_DURATION);

    return () => {
      window.clearTimeout(timer);
    };
  }, [setShowOnboardingSuccessAnimation, showOnboardingSuccessAnimation]);

  if (!showOnboardingSuccessAnimation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[65] bg-refly-bg-canvas/90 flex flex-col items-center justify-center">
      <div className="relative" style={{ width: '122px', height: '122px' }}>
        <Lottie
          animationData={successAnimation}
          loop
          autoplay
          style={{ width: '122px', height: '122px' }}
        />
      </div>
    </div>
  );
};
