import React from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStoreShallow } from '@refly/stores';
import { useEffect, useMemo, useCallback } from 'react';
import { ContentHeader } from '@refly-packages/ai-workspace-common/components/settings/contentHeader';
import FlowDark from '@refly-packages/ai-workspace-common/assets/flow-dark.png';
import FlowLight from '@refly-packages/ai-workspace-common/assets/flow-light.png';
import Logo from '@refly-packages/ai-workspace-common/assets/logo.svg';
import { useUserStore } from '@refly/stores';

type ThemeMode = 'light' | 'dark' | 'system';

// Theme card component
const ThemeCard = React.memo(
  ({
    isSelected,
    onClick,
    title,
    flowImage,
    bgColor,
  }: {
    isSelected: boolean;
    onClick: () => void;
    title: string;
    flowImage: string;
    bgColor: string;
  }) => {
    return (
      <div>
        <div
          className={`w-[200px] relative cursor-pointer rounded-lg border-solid border-[2px] hover:border-refly-primary-default ${
            isSelected ? 'border-refly-primary-default' : 'border-[rgba(0,0,0,0.1)]'
          }`}
          style={{
            backgroundColor: bgColor,
          }}
          onClick={onClick}
        >
          <div className="absolute top-2 left-2 w-6 h-6 bg-refly-primary rounded-full flex items-center justify-center">
            <img src={Logo} alt="Refly" className="w-4 h-4" />
          </div>

          <div className="p-4 pt-8">
            <img src={flowImage} alt={`${title} theme preview`} className="w-full h-auto" />
          </div>
        </div>

        <div className="text-center w-full mt-3 text-xs text-refly-text-0">{title}</div>
      </div>
    );
  },
);

// System theme card with split background
const SystemThemeCard = React.memo(
  ({
    isSelected,
    onClick,
    title,
  }: {
    isSelected: boolean;
    onClick: () => void;
    title: string;
  }) => {
    return (
      <div>
        <div
          className={`w-[200px] relative cursor-pointer rounded-lg border-solid border-[2px] hover:border-refly-primary-default ${
            isSelected ? 'border-refly-primary-default' : 'border-[rgba(0,0,0,0.1)]'
          }`}
          onClick={onClick}
        >
          <div className="absolute top-2 left-2 w-6 h-6 bg-refly-primary rounded-full flex items-center justify-center">
            <img src={Logo} alt="Refly" className="w-4 h-4" />
          </div>

          {/* Split background */}
          <div className="absolute top-0 left-0 w-full h-full flex">
            <div className="flex-1 bg-black rounded-l-lg" />
            <div className="flex-1 bg-white rounded-r-lg" />
          </div>

          <div className="relative z-1 p-4 pt-8">
            <img src={FlowLight} alt={`${title} theme preview`} className="w-full h-auto" />
          </div>
        </div>

        <div className="text-center w-full mt-3 text-xs text-refly-text-0">{title}</div>
      </div>
    );
  },
);

export const AppearanceSetting = () => {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const isLoggedIn = !!userStore?.userProfile?.uid;

  const { themeMode, setThemeMode, setLoggedIn } = useThemeStoreShallow((state) => ({
    themeMode: state.themeMode,
    setThemeMode: state.setThemeMode,
    setLoggedIn: state.setLoggedIn,
  }));

  useEffect(() => {
    // Update login status in theme store
    // Note: setLoggedIn already calls initTheme internally, so we don't need to call it again
    setLoggedIn(isLoggedIn);
  }, [isLoggedIn, setLoggedIn]);

  const handleThemeModeChange = useCallback(
    (theme: ThemeMode) => {
      setThemeMode(theme);
    },
    [setThemeMode],
  );

  const themeOptions = useMemo(
    () => [
      {
        value: 'light' as ThemeMode,
        title: t('settings.appearance.lightMode'),
        flowImage: FlowLight,
        bgColor: '#ffffff',
        borderColor: '#12B76A',
      },
      {
        value: 'dark' as ThemeMode,
        title: t('settings.appearance.darkMode'),
        flowImage: FlowDark,
        bgColor: '#000000',
        borderColor: '#374151',
      },
      {
        value: 'system' as ThemeMode,
        title: t('settings.appearance.systemMode'),
      },
    ],
    [t],
  );

  return (
    <div className="h-full overflow-auto flex flex-col">
      <ContentHeader title={t('settings.appearance.title')} />

      <div className="py-6 px-5">
        <div className="text-sm font-semibold text-refly-text-0 leading-5 mb-4">
          {t('settings.appearance.themeMode')}
        </div>

        <div className="flex items-center gap-4">
          {themeOptions.map((option) => (
            <div key={option.value}>
              {option.value === 'system' ? (
                <SystemThemeCard
                  isSelected={themeMode === option.value}
                  onClick={() => handleThemeModeChange(option.value)}
                  title={option.title}
                />
              ) : (
                <ThemeCard
                  isSelected={themeMode === option.value}
                  onClick={() => handleThemeModeChange(option.value)}
                  title={option.title}
                  flowImage={option.flowImage}
                  bgColor={option.bgColor!}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
