import { useTranslation } from 'react-i18next';
import { Modal, Button } from 'antd';
import { useUserStoreShallow } from '@refly/stores';
import { useUpdateSettings } from '@refly-packages/ai-workspace-common/queries';
import { useEffect, useMemo, useState } from 'react';
import { LuLightbulb } from 'react-icons/lu';
import { useVideo } from '@refly-packages/ai-workspace-common/hooks/use-video';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

interface Step {
  key: string;
  videoUrl: string;
  videoType: 'youtube' | 'nativeVideo';
}

const steps: Step[] = [
  {
    key: '1',
    videoUrl: 'https://www.youtube.com/embed/7aAFcsV_Ts0?si=rT6iYZZYjg4VTn5l',
    videoType: 'youtube',
  },
  {
    key: '2',
    videoUrl: 'https://www.youtube.com/embed/P7Hfq3nfFvY?si=TnYYJQc7LsQmYX-R',
    videoType: 'youtube',
  },
  {
    key: '3',
    videoUrl: 'https://www.youtube.com/embed/yofLxuAKiNM?si=7erwVv-7P4TIwP9g',
    videoType: 'youtube',
  },
  {
    key: '4',
    videoUrl: 'https://www.youtube.com/embed/_EaxsxXH5V0?si=KjgwkQeInjq3RDju',
    videoType: 'youtube',
  },
  {
    key: '5',
    videoUrl: 'https://www.youtube.com/embed/rNuvdNRQGDw?si=Vk1Y57TGLtDqpVdW',
    videoType: 'youtube',
  },
  {
    key: '6',
    videoUrl: 'https://www.youtube.com/embed/0JRg52MJMBs?si=KO133RQyQzXgDK3O',
    videoType: 'youtube',
  },
  {
    key: '7',
    videoUrl: 'https://static.refly.ai/onboarding/tour/help.webm',
    videoType: 'nativeVideo',
  },
];

interface TourContentProps {
  description: string;
  videoUrl: string;
  videoType: 'youtube' | 'nativeVideo';
}

const TourContent = ({ description, videoUrl, videoType }: TourContentProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const { videoRef, handlePlay } = useVideo();

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, [videoUrl]);

  const renderVideo = () => {
    if (videoType === 'youtube') {
      return (
        <iframe
          width="100%"
          height="100%"
          src={videoUrl}
          title="Tutorial video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="w-full rounded-lg bg-black dark:bg-gray-100"
          style={{
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.3s ease-in-out',
          }}
          onLoad={() => {
            setTimeout(() => setIsLoading(false), 500);
          }}
        />
      );
    }

    return (
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        controlsList="nodownload"
        loop
        playsInline
        onPlay={handlePlay}
        className="w-full h-full object-cover rounded-lg bg-black dark:bg-gray-100"
        style={{
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
        }}
        onLoadedData={() => {
          setTimeout(() => setIsLoading(false), 500);
        }}
      >
        <track kind="captions" srcLang="en" src={videoUrl} />
      </video>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-gray-600 dark:text-gray-300">{description}</p>
      <div className="flex justify-center">
        <div key={videoUrl} className="relative w-full" style={{ height: '400px' }}>
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-50 rounded-lg dark:bg-gray-900">
              <Spin className="w-6 h-6" />
              <div className="text-gray-600 dark:text-gray-300 text-sm mt-2">
                {t('canvas.toolbar.videoLoading')}
              </div>
            </div>
          )}
          {renderVideo()}
        </div>
      </div>
    </div>
  );
};

export const TourModal = () => {
  const { t } = useTranslation();
  const { showTourModal, setShowTourModal, userProfile, setUserProfile } = useUserStoreShallow(
    (state) => ({
      showTourModal: state.showTourModal,
      setShowTourModal: state.setShowTourModal,
      userProfile: state.userProfile,
      setUserProfile: state.setUserProfile,
    }),
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [finishedOnboardingTour, setFinishedOnboardingTour] = useState<boolean>(
    ['skipped', 'completed'].includes(userProfile?.onboarding?.tour ?? ''),
  );

  const { mutate: updateSettings } = useUpdateSettings();

  const handleClose = (status: 'skipped' | 'completed') => {
    setShowTourModal(false);
    if (!finishedOnboardingTour) {
      setUserProfile({
        ...userProfile,
        onboarding: {
          ...userProfile?.onboarding,
          tour: status,
        },
      });

      updateSettings({
        body: {
          onboarding: {
            ...userProfile?.onboarding,
            tour: status,
          },
        },
      });
      setFinishedOnboardingTour(true);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose('completed');
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = useMemo(() => steps[currentStep], [currentStep]);

  const title = `${t('tour.onboardingModal.title')} (${currentStepData.key}/${steps.length}) : ${t(`tour.onboardingModal.highlight.${currentStepData.key}`)}`;

  return (
    <Modal
      centered
      width={800}
      open={showTourModal}
      onCancel={() => handleClose('skipped')}
      footer={null}
    >
      <div className="mb-6">
        <h2 className="mb-4 flex items-center gap-1 text-lg font-bold text-gray-900 dark:text-gray-100">
          <LuLightbulb /> <span>{title}</span>
        </h2>
        <TourContent
          description={t(`tour.onboardingModal.description.${currentStepData.key}`)}
          videoUrl={currentStepData.videoUrl}
          videoType={currentStepData.videoType}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center justify-center gap-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentStep ? 'bg-green-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={handlePrev} disabled={currentStep === 0}>
            {t('tour.onboardingModal.prev')}
          </Button>
          <Button type="primary" onClick={handleNext}>
            {currentStep === steps.length - 1
              ? t('tour.onboardingModal.startInteractive')
              : t('tour.onboardingModal.next')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
