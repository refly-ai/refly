import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { LOCALE } from '@refly/common-types';
import { getErrorMessage } from '@refly/errors';
import { guessModelProviderError } from '@refly/errors';
import { useMemo } from 'react';

export const useSkillError = (error: string | Error) => {
  return useMemo(() => {
    const { localSettings } = useUserStore.getState();
    const locale = localSettings?.uiLocale as LOCALE;

    const guessedErr = guessModelProviderError(error);
    const errMsg = getErrorMessage(guessedErr.code, locale);

    return {
      errCode: guessedErr.code,
      errMsg,
    };
  }, [error]);
};
