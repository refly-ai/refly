import { memo, useCallback, useMemo } from 'react';
import validator from '@rjsf/validator-ajv8';
import { ReflyRjsfForm } from '@refly-packages/ai-workspace-common/components/rjsf';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { IconError } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useUserStoreShallow } from '@refly/stores';
import { useGetFormDefinition } from '@refly-packages/ai-workspace-common/queries';
import type { GetFormDefinitionDefaultResponse } from '@refly-packages/ai-workspace-common/queries/common';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import reflyUnionSvg from '@refly-packages/ai-workspace-common/assets/refly-union.svg';

const FormOnboardingModalComponent: React.FC = () => {
  const { showOnboardingFormModal, userProfile } = useUserStoreShallow((state) => ({
    showOnboardingFormModal: state.showOnboardingFormModal,
    userProfile: state.userProfile,
  }));

  const {
    data: formDefinitionResponse,
    isLoading: isFormDefinitionLoading,
    isError: isFormDefinitionError,
  } = useGetFormDefinition<GetFormDefinitionDefaultResponse>();

  const { formSchema, formUiSchema } = useMemo<{
    formSchema: RJSFSchema | null;
    formUiSchema: UiSchema | null;
  }>(() => {
    const definition = formDefinitionResponse?.data;

    if (!definition?.schema) {
      return {
        formSchema: null,
        formUiSchema: null,
      };
    }

    try {
      const parsedSchema = JSON.parse(definition.schema) as RJSFSchema;
      const mergedSchema: RJSFSchema = {
        ...parsedSchema,
        formId: definition?.formId ?? '',
        uid: userProfile?.uid ?? '',
      };
      const parsedUiSchema = definition.uiSchema
        ? (JSON.parse(definition.uiSchema) as UiSchema)
        : null;

      return {
        formSchema: mergedSchema,
        formUiSchema: parsedUiSchema,
      };
    } catch (error) {
      // Log parsing error for debugging
      // eslint-disable-next-line no-console
      console.error('Failed to parse form definition', error);

      return {
        formSchema: null,
        formUiSchema: null,
      };
    }
  }, [formDefinitionResponse?.data]);

  const handleLog = useCallback(
    (type: string) => (data: unknown) => {
      // Log form events for debugging only
      // eslint-disable-next-line no-console
      console.log(type, data);
    },
    [],
  );

  if (!showOnboardingFormModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] bg-refly-bg-canvas flex flex-col items-center justify-center">
      <div className="max-w-[580px] px-6 flex flex-col items-center mb-8 relative z-10">
        {isFormDefinitionLoading && (
          <div className="flex items-center justify-center px-8 py-6">
            <Spin />
          </div>
        )}
        {!isFormDefinitionLoading && (isFormDefinitionError || !formSchema) && (
          <div className="flex flex-col items-center justify-center px-8 py-6 text-center">
            <IconError className="w-8 h-8 text-red-500 mb-2" />
            <span className="text-sm text-refly-text-2">Please try again later.</span>
          </div>
        )}
        {!isFormDefinitionLoading && !isFormDefinitionError && formSchema && (
          <ReflyRjsfForm
            schema={formSchema}
            uiSchema={formUiSchema ?? {}}
            validator={validator}
            onChange={handleLog('changed')}
            onSubmit={handleLog('submitted')}
            onError={handleLog('errors')}
          />
        )}
      </div>
      <img
        src={reflyUnionSvg}
        alt="Refly Union"
        className="w-full absolute bottom-0 left-0 -z-10"
      />
    </div>
  );
};

export const FormOnboardingModal = memo(FormOnboardingModalComponent);
