// generated with @7nohe/openapi-react-query-codegen@2.0.0-beta.3

import { type Options } from '@hey-api/client-fetch';
import { UseQueryOptions, useSuspenseQuery } from '@tanstack/react-query';
import {
  checkSettingsField,
  checkToolOauthStatus,
  downloadExportJobResult,
  exportCanvas,
  exportDocument,
  exportToolsetDefinitions,
  getActionResult,
  getAuthConfig,
  getAvailableVouchers,
  getCanvasCommissionByCanvasId,
  getCanvasData,
  getCanvasDetail,
  getCanvasState,
  getCanvasTransactions,
  getCodeArtifactDetail,
  getCollabToken,
  getComposioConnectionStatus,
  getCopilotSessionDetail,
  getCreditBalance,
  getCreditRecharge,
  getCreditUsage,
  getCreditUsageByCanvasId,
  getCreditUsageByExecutionId,
  getCreditUsageByResultId,
  getDocumentDetail,
  getExportJobStatus,
  getFormDefinition,
  getOpenapiConfig,
  getPromptSuggestions,
  getResourceDetail,
  getSettings,
  getSubscriptionPlans,
  getSubscriptionUsage,
  getTemplateGenerationStatus,
  getToolCallResult,
  getWebhookConfig,
  getWebhookHistory,
  getWorkflowAppDetail,
  getWorkflowDetail,
  getWorkflowDetailViaApi,
  getWorkflowOutput,
  getWorkflowPlanDetail,
  getWorkflowStatusViaApi,
  getWorkflowVariables,
  listAccounts,
  listCanvases,
  listCanvasTemplateCategories,
  listCanvasTemplates,
  listCliApiKeys,
  listCodeArtifacts,
  listCopilotSessions,
  listDocuments,
  listDriveFiles,
  listInvitationCodes,
  listMcpServers,
  listModels,
  listProviderItemOptions,
  listProviderItems,
  listProviders,
  listResources,
  listShares,
  listTools,
  listToolsetInventory,
  listToolsets,
  listUserTools,
  listUserVouchers,
  listWorkflowApps,
  listWorkflowExecutions,
  searchWorkflowsViaApi,
  serveStatic,
  verifyVoucherInvitation,
} from '@refly/openapi-schema';
import {
  CheckSettingsFieldData,
  CheckSettingsFieldError,
  CheckToolOauthStatusData,
  CheckToolOauthStatusError,
  DownloadExportJobResultData,
  DownloadExportJobResultError,
  ExportCanvasData,
  ExportCanvasError,
  ExportDocumentData,
  ExportDocumentError,
  ExportToolsetDefinitionsData,
  ExportToolsetDefinitionsError,
  GetActionResultData,
  GetActionResultError,
  GetAuthConfigError,
  GetAvailableVouchersError,
  GetCanvasCommissionByCanvasIdData,
  GetCanvasCommissionByCanvasIdError,
  GetCanvasDataData,
  GetCanvasDataError,
  GetCanvasDetailData,
  GetCanvasDetailError,
  GetCanvasStateData,
  GetCanvasStateError,
  GetCanvasTransactionsData,
  GetCanvasTransactionsError,
  GetCodeArtifactDetailData,
  GetCodeArtifactDetailError,
  GetCollabTokenError,
  GetComposioConnectionStatusData,
  GetComposioConnectionStatusError,
  GetCopilotSessionDetailData,
  GetCopilotSessionDetailError,
  GetCreditBalanceError,
  GetCreditRechargeData,
  GetCreditRechargeError,
  GetCreditUsageByCanvasIdData,
  GetCreditUsageByCanvasIdError,
  GetCreditUsageByExecutionIdData,
  GetCreditUsageByExecutionIdError,
  GetCreditUsageByResultIdData,
  GetCreditUsageByResultIdError,
  GetCreditUsageData,
  GetCreditUsageError,
  GetDocumentDetailData,
  GetDocumentDetailError,
  GetExportJobStatusData,
  GetExportJobStatusError,
  GetFormDefinitionError,
  GetOpenapiConfigData,
  GetOpenapiConfigError,
  GetPromptSuggestionsError,
  GetResourceDetailData,
  GetResourceDetailError,
  GetSettingsError,
  GetSubscriptionPlansError,
  GetSubscriptionUsageError,
  GetTemplateGenerationStatusData,
  GetTemplateGenerationStatusError,
  GetToolCallResultData,
  GetToolCallResultError,
  GetWebhookConfigData,
  GetWebhookConfigError,
  GetWebhookHistoryData,
  GetWebhookHistoryError,
  GetWorkflowAppDetailData,
  GetWorkflowAppDetailError,
  GetWorkflowDetailData,
  GetWorkflowDetailError,
  GetWorkflowDetailViaApiData,
  GetWorkflowDetailViaApiError,
  GetWorkflowOutputData,
  GetWorkflowOutputError,
  GetWorkflowPlanDetailData,
  GetWorkflowPlanDetailError,
  GetWorkflowStatusViaApiData,
  GetWorkflowStatusViaApiError,
  GetWorkflowVariablesData,
  GetWorkflowVariablesError,
  ListAccountsData,
  ListAccountsError,
  ListCanvasesData,
  ListCanvasesError,
  ListCanvasTemplateCategoriesError,
  ListCanvasTemplatesData,
  ListCanvasTemplatesError,
  ListCliApiKeysError,
  ListCodeArtifactsData,
  ListCodeArtifactsError,
  ListCopilotSessionsData,
  ListCopilotSessionsError,
  ListDocumentsData,
  ListDocumentsError,
  ListDriveFilesData,
  ListDriveFilesError,
  ListInvitationCodesError,
  ListMcpServersData,
  ListMcpServersError,
  ListModelsError,
  ListProviderItemOptionsData,
  ListProviderItemOptionsError,
  ListProviderItemsData,
  ListProviderItemsError,
  ListProvidersData,
  ListProvidersError,
  ListResourcesData,
  ListResourcesError,
  ListSharesData,
  ListSharesError,
  ListToolsData,
  ListToolsError,
  ListToolsetInventoryError,
  ListToolsetsData,
  ListToolsetsError,
  ListUserToolsError,
  ListUserVouchersError,
  ListWorkflowAppsData,
  ListWorkflowAppsError,
  ListWorkflowExecutionsData,
  ListWorkflowExecutionsError,
  SearchWorkflowsViaApiData,
  SearchWorkflowsViaApiError,
  ServeStaticError,
  VerifyVoucherInvitationData,
  VerifyVoucherInvitationError,
} from '@refly/openapi-schema';
import * as Common from './common';
export const useListMcpServersSuspense = <
  TData = Common.ListMcpServersDefaultResponse,
  TError = ListMcpServersError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListMcpServersData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListMcpServersKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listMcpServers({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetAuthConfigSuspense = <
  TData = Common.GetAuthConfigDefaultResponse,
  TError = GetAuthConfigError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetAuthConfigKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getAuthConfig({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListAccountsSuspense = <
  TData = Common.ListAccountsDefaultResponse,
  TError = ListAccountsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListAccountsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListAccountsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listAccounts({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useCheckToolOauthStatusSuspense = <
  TData = Common.CheckToolOauthStatusDefaultResponse,
  TError = CheckToolOauthStatusError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<CheckToolOauthStatusData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseCheckToolOauthStatusKeyFn(clientOptions, queryKey),
    queryFn: () =>
      checkToolOauthStatus({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListCliApiKeysSuspense = <
  TData = Common.ListCliApiKeysDefaultResponse,
  TError = ListCliApiKeysError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListCliApiKeysKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listCliApiKeys({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCollabTokenSuspense = <
  TData = Common.GetCollabTokenDefaultResponse,
  TError = GetCollabTokenError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCollabTokenKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCollabToken({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListCanvasesSuspense = <
  TData = Common.ListCanvasesDefaultResponse,
  TError = ListCanvasesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListCanvasesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListCanvasesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listCanvases({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCanvasDetailSuspense = <
  TData = Common.GetCanvasDetailDefaultResponse,
  TError = GetCanvasDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCanvasDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCanvasDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCanvasDetail({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCanvasDataSuspense = <
  TData = Common.GetCanvasDataDefaultResponse,
  TError = GetCanvasDataError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCanvasDataData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCanvasDataKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCanvasData({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useExportCanvasSuspense = <
  TData = Common.ExportCanvasDefaultResponse,
  TError = ExportCanvasError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ExportCanvasData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseExportCanvasKeyFn(clientOptions, queryKey),
    queryFn: () =>
      exportCanvas({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCanvasStateSuspense = <
  TData = Common.GetCanvasStateDefaultResponse,
  TError = GetCanvasStateError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCanvasStateData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCanvasStateKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCanvasState({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCanvasTransactionsSuspense = <
  TData = Common.GetCanvasTransactionsDefaultResponse,
  TError = GetCanvasTransactionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCanvasTransactionsData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCanvasTransactionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCanvasTransactions({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWorkflowVariablesSuspense = <
  TData = Common.GetWorkflowVariablesDefaultResponse,
  TError = GetWorkflowVariablesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowVariablesData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowVariablesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowVariables({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListDriveFilesSuspense = <
  TData = Common.ListDriveFilesDefaultResponse,
  TError = ListDriveFilesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListDriveFilesData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListDriveFilesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listDriveFiles({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListCanvasTemplatesSuspense = <
  TData = Common.ListCanvasTemplatesDefaultResponse,
  TError = ListCanvasTemplatesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListCanvasTemplatesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListCanvasTemplatesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listCanvasTemplates({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListCanvasTemplateCategoriesSuspense = <
  TData = Common.ListCanvasTemplateCategoriesDefaultResponse,
  TError = ListCanvasTemplateCategoriesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListCanvasTemplateCategoriesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listCanvasTemplateCategories({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListResourcesSuspense = <
  TData = Common.ListResourcesDefaultResponse,
  TError = ListResourcesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListResourcesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListResourcesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listResources({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetResourceDetailSuspense = <
  TData = Common.GetResourceDetailDefaultResponse,
  TError = GetResourceDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetResourceDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetResourceDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getResourceDetail({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListDocumentsSuspense = <
  TData = Common.ListDocumentsDefaultResponse,
  TError = ListDocumentsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListDocumentsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListDocumentsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listDocuments({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetDocumentDetailSuspense = <
  TData = Common.GetDocumentDetailDefaultResponse,
  TError = GetDocumentDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetDocumentDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetDocumentDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getDocumentDetail({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useExportDocumentSuspense = <
  TData = Common.ExportDocumentDefaultResponse,
  TError = ExportDocumentError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ExportDocumentData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseExportDocumentKeyFn(clientOptions, queryKey),
    queryFn: () =>
      exportDocument({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetExportJobStatusSuspense = <
  TData = Common.GetExportJobStatusDefaultResponse,
  TError = GetExportJobStatusError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetExportJobStatusData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetExportJobStatusKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getExportJobStatus({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useDownloadExportJobResultSuspense = <
  TData = Common.DownloadExportJobResultDefaultResponse,
  TError = DownloadExportJobResultError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<DownloadExportJobResultData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseDownloadExportJobResultKeyFn(clientOptions, queryKey),
    queryFn: () =>
      downloadExportJobResult({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListCodeArtifactsSuspense = <
  TData = Common.ListCodeArtifactsDefaultResponse,
  TError = ListCodeArtifactsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListCodeArtifactsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListCodeArtifactsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listCodeArtifacts({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCodeArtifactDetailSuspense = <
  TData = Common.GetCodeArtifactDetailDefaultResponse,
  TError = GetCodeArtifactDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCodeArtifactDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCodeArtifactDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCodeArtifactDetail({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListSharesSuspense = <
  TData = Common.ListSharesDefaultResponse,
  TError = ListSharesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListSharesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListSharesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listShares({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetActionResultSuspense = <
  TData = Common.GetActionResultDefaultResponse,
  TError = GetActionResultError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetActionResultData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetActionResultKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getActionResult({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListCopilotSessionsSuspense = <
  TData = Common.ListCopilotSessionsDefaultResponse,
  TError = ListCopilotSessionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListCopilotSessionsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListCopilotSessionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listCopilotSessions({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCopilotSessionDetailSuspense = <
  TData = Common.GetCopilotSessionDetailDefaultResponse,
  TError = GetCopilotSessionDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCopilotSessionDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCopilotSessionDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCopilotSessionDetail({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListWorkflowExecutionsSuspense = <
  TData = Common.ListWorkflowExecutionsDefaultResponse,
  TError = ListWorkflowExecutionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListWorkflowExecutionsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListWorkflowExecutionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listWorkflowExecutions({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWorkflowDetailSuspense = <
  TData = Common.GetWorkflowDetailDefaultResponse,
  TError = GetWorkflowDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowDetail({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetWorkflowPlanDetailSuspense = <
  TData = Common.GetWorkflowPlanDetailDefaultResponse,
  TError = GetWorkflowPlanDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowPlanDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowPlanDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowPlanDetail({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWorkflowAppDetailSuspense = <
  TData = Common.GetWorkflowAppDetailDefaultResponse,
  TError = GetWorkflowAppDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowAppDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowAppDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowAppDetail({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListWorkflowAppsSuspense = <
  TData = Common.ListWorkflowAppsDefaultResponse,
  TError = ListWorkflowAppsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListWorkflowAppsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListWorkflowAppsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listWorkflowApps({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetTemplateGenerationStatusSuspense = <
  TData = Common.GetTemplateGenerationStatusDefaultResponse,
  TError = GetTemplateGenerationStatusError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetTemplateGenerationStatusData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetTemplateGenerationStatusKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getTemplateGenerationStatus({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWebhookConfigSuspense = <
  TData = Common.GetWebhookConfigDefaultResponse,
  TError = GetWebhookConfigError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWebhookConfigData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetWebhookConfigKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWebhookConfig({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetWebhookHistorySuspense = <
  TData = Common.GetWebhookHistoryDefaultResponse,
  TError = GetWebhookHistoryError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWebhookHistoryData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetWebhookHistoryKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWebhookHistory({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetOpenapiConfigSuspense = <
  TData = Common.GetOpenapiConfigDefaultResponse,
  TError = GetOpenapiConfigError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetOpenapiConfigData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetOpenapiConfigKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getOpenapiConfig({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useSearchWorkflowsViaApiSuspense = <
  TData = Common.SearchWorkflowsViaApiDefaultResponse,
  TError = SearchWorkflowsViaApiError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<SearchWorkflowsViaApiData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSearchWorkflowsViaApiKeyFn(clientOptions, queryKey),
    queryFn: () =>
      searchWorkflowsViaApi({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWorkflowDetailViaApiSuspense = <
  TData = Common.GetWorkflowDetailViaApiDefaultResponse,
  TError = GetWorkflowDetailViaApiError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowDetailViaApiData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowDetailViaApiKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowDetailViaApi({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWorkflowStatusViaApiSuspense = <
  TData = Common.GetWorkflowStatusViaApiDefaultResponse,
  TError = GetWorkflowStatusViaApiError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowStatusViaApiData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowStatusViaApiKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowStatusViaApi({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWorkflowOutputSuspense = <
  TData = Common.GetWorkflowOutputDefaultResponse,
  TError = GetWorkflowOutputError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowOutputData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowOutputKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowOutput({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetSettingsSuspense = <
  TData = Common.GetSettingsDefaultResponse,
  TError = GetSettingsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetSettingsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getSettings({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useCheckSettingsFieldSuspense = <
  TData = Common.CheckSettingsFieldDefaultResponse,
  TError = CheckSettingsFieldError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<CheckSettingsFieldData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseCheckSettingsFieldKeyFn(clientOptions, queryKey),
    queryFn: () =>
      checkSettingsField({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetFormDefinitionSuspense = <
  TData = Common.GetFormDefinitionDefaultResponse,
  TError = GetFormDefinitionError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetFormDefinitionKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getFormDefinition({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCreditRechargeSuspense = <
  TData = Common.GetCreditRechargeDefaultResponse,
  TError = GetCreditRechargeError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCreditRechargeData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCreditRechargeKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCreditRecharge({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCreditUsageSuspense = <
  TData = Common.GetCreditUsageDefaultResponse,
  TError = GetCreditUsageError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCreditUsageData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCreditUsageKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCreditUsage({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCreditBalanceSuspense = <
  TData = Common.GetCreditBalanceDefaultResponse,
  TError = GetCreditBalanceError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCreditBalanceKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCreditBalance({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCreditUsageByResultIdSuspense = <
  TData = Common.GetCreditUsageByResultIdDefaultResponse,
  TError = GetCreditUsageByResultIdError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCreditUsageByResultIdData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCreditUsageByResultIdKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCreditUsageByResultId({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetCreditUsageByExecutionIdSuspense = <
  TData = Common.GetCreditUsageByExecutionIdDefaultResponse,
  TError = GetCreditUsageByExecutionIdError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCreditUsageByExecutionIdData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCreditUsageByExecutionIdKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCreditUsageByExecutionId({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetCreditUsageByCanvasIdSuspense = <
  TData = Common.GetCreditUsageByCanvasIdDefaultResponse,
  TError = GetCreditUsageByCanvasIdError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCreditUsageByCanvasIdData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCreditUsageByCanvasIdKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCreditUsageByCanvasId({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetCanvasCommissionByCanvasIdSuspense = <
  TData = Common.GetCanvasCommissionByCanvasIdDefaultResponse,
  TError = GetCanvasCommissionByCanvasIdError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCanvasCommissionByCanvasIdData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetCanvasCommissionByCanvasIdKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCanvasCommissionByCanvasId({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListInvitationCodesSuspense = <
  TData = Common.ListInvitationCodesDefaultResponse,
  TError = ListInvitationCodesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListInvitationCodesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listInvitationCodes({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetSubscriptionPlansSuspense = <
  TData = Common.GetSubscriptionPlansDefaultResponse,
  TError = GetSubscriptionPlansError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetSubscriptionPlansKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getSubscriptionPlans({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetSubscriptionUsageSuspense = <
  TData = Common.GetSubscriptionUsageDefaultResponse,
  TError = GetSubscriptionUsageError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetSubscriptionUsageKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getSubscriptionUsage({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListModelsSuspense = <
  TData = Common.ListModelsDefaultResponse,
  TError = ListModelsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListModelsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listModels({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListProvidersSuspense = <
  TData = Common.ListProvidersDefaultResponse,
  TError = ListProvidersError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListProvidersData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListProvidersKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listProviders({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListProviderItemsSuspense = <
  TData = Common.ListProviderItemsDefaultResponse,
  TError = ListProviderItemsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListProviderItemsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListProviderItemsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listProviderItems({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListProviderItemOptionsSuspense = <
  TData = Common.ListProviderItemOptionsDefaultResponse,
  TError = ListProviderItemOptionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListProviderItemOptionsData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListProviderItemOptionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listProviderItemOptions({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListToolsSuspense = <
  TData = Common.ListToolsDefaultResponse,
  TError = ListToolsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListToolsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListToolsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listTools({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListUserToolsSuspense = <
  TData = Common.ListUserToolsDefaultResponse,
  TError = ListUserToolsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListUserToolsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listUserTools({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListToolsetInventorySuspense = <
  TData = Common.ListToolsetInventoryDefaultResponse,
  TError = ListToolsetInventoryError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListToolsetInventoryKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listToolsetInventory({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListToolsetsSuspense = <
  TData = Common.ListToolsetsDefaultResponse,
  TError = ListToolsetsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListToolsetsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListToolsetsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listToolsets({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useExportToolsetDefinitionsSuspense = <
  TData = Common.ExportToolsetDefinitionsDefaultResponse,
  TError = ExportToolsetDefinitionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ExportToolsetDefinitionsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseExportToolsetDefinitionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      exportToolsetDefinitions({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetToolCallResultSuspense = <
  TData = Common.GetToolCallResultDefaultResponse,
  TError = GetToolCallResultError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetToolCallResultData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetToolCallResultKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getToolCallResult({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetComposioConnectionStatusSuspense = <
  TData = Common.GetComposioConnectionStatusDefaultResponse,
  TError = GetComposioConnectionStatusError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetComposioConnectionStatusData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetComposioConnectionStatusKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getComposioConnectionStatus({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useServeStaticSuspense = <
  TData = Common.ServeStaticDefaultResponse,
  TError = ServeStaticError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseServeStaticKeyFn(clientOptions, queryKey),
    queryFn: () =>
      serveStatic({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetPromptSuggestionsSuspense = <
  TData = Common.GetPromptSuggestionsDefaultResponse,
  TError = GetPromptSuggestionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetPromptSuggestionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getPromptSuggestions({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetAvailableVouchersSuspense = <
  TData = Common.GetAvailableVouchersDefaultResponse,
  TError = GetAvailableVouchersError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetAvailableVouchersKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getAvailableVouchers({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListUserVouchersSuspense = <
  TData = Common.ListUserVouchersDefaultResponse,
  TError = ListUserVouchersError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListUserVouchersKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listUserVouchers({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useVerifyVoucherInvitationSuspense = <
  TData = Common.VerifyVoucherInvitationDefaultResponse,
  TError = VerifyVoucherInvitationError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<VerifyVoucherInvitationData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseVerifyVoucherInvitationKeyFn(clientOptions, queryKey),
    queryFn: () =>
      verifyVoucherInvitation({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
