import { useCallback } from 'react';
import { useUpdateSettings } from '@refly-packages/ai-workspace-common/queries';
import { useUserStoreShallow } from '@refly/stores';
import { UserPreferences } from '@refly/openapi-schema';

export const useUpdateUserPreferences = () => {
  const { userProfile, setUserProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
    setUserProfile: state.setUserProfile,
  }));
  const { mutate: updateUserSettings } = useUpdateSettings();

  const updateUserPreferences = useCallback(
    (preferences: Partial<UserPreferences>) => {
      if (!userProfile) return;

      const updatedPreferences = {
        ...userProfile.preferences,
        ...preferences,
      };

      setUserProfile({
        ...userProfile,
        preferences: updatedPreferences,
      });

      updateUserSettings({
        body: {
          preferences,
        },
      });
    },
    [userProfile, setUserProfile, updateUserSettings],
  );

  return {
    updateUserPreferences,
    userProfile,
  };
};
