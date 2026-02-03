// generated with @7nohe/openapi-react-query-codegen@2.0.0-beta.3

import { type Options } from '@hey-api/client-fetch';
import { UseQueryResult } from '@tanstack/react-query';
import {
  abortAction,
  abortWorkflow,
  abortWorkflowViaApi,
  activateInvitationCode,
  authorizeComposioConnection,
  autoNameCanvas,
  batchCreateDriveFiles,
  batchCreateProviderItems,
  batchCreateResource,
  batchUpdateDocument,
  batchUpdateProviderItems,
  checkSettingsField,
  checkToolOauthStatus,
  checkVerification,
  claimVoucherInvitation,
  convert,
  createCanvas,
  createCanvasTemplate,
  createCanvasVersion,
  createCheckoutSession,
  createCliApiKey,
  createCodeArtifact,
  createCreditPackCheckoutSession,
  createDocument,
  createDriveFile,
  createMcpServer,
  createPortalSession,
  createProvider,
  createProviderItem,
  createResource,
  createResourceWithFile,
  createSchedule,
  createShare,
  createToolset,
  createVerification,
  createVoucherInvitation,
  createWorkflowApp,
  deleteCanvas,
  deleteDocument,
  deleteDriveFile,
  deleteMcpServer,
  deleteProvider,
  deleteProviderItem,
  deleteResource,
  deleteSchedule,
  deleteShare,
  deleteToolset,
  deleteWorkflowApp,
  disableWebhook,
  downloadExportJobResult,
  duplicateCanvas,
  duplicateShare,
  emailLogin,
  emailSignup,
  enableWebhook,
  executeTool,
  executeWorkflowApp,
  exportCanvas,
  exportDocument,
  exportToolsetDefinitions,
  extractVariables,
  generateAppTemplate,
  generateMedia,
  generateWorkflowViaCopilot,
  getActionResult,
  getAuthConfig,
  getAvailableTools,
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
  getRecordSnapshot,
  getResourceDetail,
  getScheduleDetail,
  getScheduleRecordDetail,
  getScheduleRecords,
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
  importCanvas,
  initializeWorkflow,
  invokeSkill,
  listAccounts,
  listAllScheduleRecords,
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
  listSchedules,
  listShares,
  listTools,
  listToolsetInventory,
  listToolsets,
  listUserTools,
  listUserVouchers,
  listWorkflowApps,
  listWorkflowExecutions,
  logout,
  multiLingualWebSearch,
  refreshToken,
  reindexResource,
  resendVerification,
  resetWebhook,
  retryScheduleRecord,
  revokeCliApiKey,
  revokeComposioConnection,
  runWebhook,
  runWorkflowViaApi,
  scrape,
  search,
  searchWorkflowsViaApi,
  serveStatic,
  setCanvasState,
  skipInvitationCode,
  startExportJob,
  streamInvokeSkill,
  submitForm,
  syncCanvasState,
  testProviderConnection,
  triggerScheduleManually,
  triggerVoucher,
  updateCanvas,
  updateCanvasTemplate,
  updateCliApiKey,
  updateCodeArtifact,
  updateDocument,
  updateDriveFile,
  updateMcpServer,
  updateOpenapiConfig,
  updateProvider,
  updateProviderItem,
  updateResource,
  updateSchedule,
  updateSettings,
  updateToolset,
  updateWebhook,
  updateWorkflowVariables,
  upload,
  uploadOpenapiFiles,
  validateMcpServer,
  validateVoucher,
  verifyVoucherInvitation,
} from '@refly/openapi-schema';
export type ListMcpServersDefaultResponse = Awaited<ReturnType<typeof listMcpServers>>['data'];
export type ListMcpServersQueryResult<
  TData = ListMcpServersDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListMcpServersKey = 'ListMcpServers';
export const UseListMcpServersKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListMcpServersKey, ...(queryKey ?? [clientOptions])];
export type GetAuthConfigDefaultResponse = Awaited<ReturnType<typeof getAuthConfig>>['data'];
export type GetAuthConfigQueryResult<
  TData = GetAuthConfigDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetAuthConfigKey = 'GetAuthConfig';
export const UseGetAuthConfigKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useGetAuthConfigKey, ...(queryKey ?? [clientOptions])];
export type ListAccountsDefaultResponse = Awaited<ReturnType<typeof listAccounts>>['data'];
export type ListAccountsQueryResult<
  TData = ListAccountsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListAccountsKey = 'ListAccounts';
export const UseListAccountsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListAccountsKey, ...(queryKey ?? [clientOptions])];
export type CheckToolOauthStatusDefaultResponse = Awaited<
  ReturnType<typeof checkToolOauthStatus>
>['data'];
export type CheckToolOauthStatusQueryResult<
  TData = CheckToolOauthStatusDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useCheckToolOauthStatusKey = 'CheckToolOauthStatus';
export const UseCheckToolOauthStatusKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useCheckToolOauthStatusKey, ...(queryKey ?? [clientOptions])];
export type ListCliApiKeysDefaultResponse = Awaited<ReturnType<typeof listCliApiKeys>>['data'];
export type ListCliApiKeysQueryResult<
  TData = ListCliApiKeysDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListCliApiKeysKey = 'ListCliApiKeys';
export const UseListCliApiKeysKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListCliApiKeysKey, ...(queryKey ?? [clientOptions])];
export type GetCollabTokenDefaultResponse = Awaited<ReturnType<typeof getCollabToken>>['data'];
export type GetCollabTokenQueryResult<
  TData = GetCollabTokenDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCollabTokenKey = 'GetCollabToken';
export const UseGetCollabTokenKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useGetCollabTokenKey, ...(queryKey ?? [clientOptions])];
export type ListCanvasesDefaultResponse = Awaited<ReturnType<typeof listCanvases>>['data'];
export type ListCanvasesQueryResult<
  TData = ListCanvasesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListCanvasesKey = 'ListCanvases';
export const UseListCanvasesKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListCanvasesKey, ...(queryKey ?? [clientOptions])];
export type GetCanvasDetailDefaultResponse = Awaited<ReturnType<typeof getCanvasDetail>>['data'];
export type GetCanvasDetailQueryResult<
  TData = GetCanvasDetailDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCanvasDetailKey = 'GetCanvasDetail';
export const UseGetCanvasDetailKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetCanvasDetailKey, ...(queryKey ?? [clientOptions])];
export type GetCanvasDataDefaultResponse = Awaited<ReturnType<typeof getCanvasData>>['data'];
export type GetCanvasDataQueryResult<
  TData = GetCanvasDataDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCanvasDataKey = 'GetCanvasData';
export const UseGetCanvasDataKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetCanvasDataKey, ...(queryKey ?? [clientOptions])];
export type ExportCanvasDefaultResponse = Awaited<ReturnType<typeof exportCanvas>>['data'];
export type ExportCanvasQueryResult<
  TData = ExportCanvasDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useExportCanvasKey = 'ExportCanvas';
export const UseExportCanvasKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useExportCanvasKey, ...(queryKey ?? [clientOptions])];
export type GetCanvasStateDefaultResponse = Awaited<ReturnType<typeof getCanvasState>>['data'];
export type GetCanvasStateQueryResult<
  TData = GetCanvasStateDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCanvasStateKey = 'GetCanvasState';
export const UseGetCanvasStateKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetCanvasStateKey, ...(queryKey ?? [clientOptions])];
export type GetCanvasTransactionsDefaultResponse = Awaited<
  ReturnType<typeof getCanvasTransactions>
>['data'];
export type GetCanvasTransactionsQueryResult<
  TData = GetCanvasTransactionsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCanvasTransactionsKey = 'GetCanvasTransactions';
export const UseGetCanvasTransactionsKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetCanvasTransactionsKey, ...(queryKey ?? [clientOptions])];
export type GetWorkflowVariablesDefaultResponse = Awaited<
  ReturnType<typeof getWorkflowVariables>
>['data'];
export type GetWorkflowVariablesQueryResult<
  TData = GetWorkflowVariablesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetWorkflowVariablesKey = 'GetWorkflowVariables';
export const UseGetWorkflowVariablesKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetWorkflowVariablesKey, ...(queryKey ?? [clientOptions])];
export type ListDriveFilesDefaultResponse = Awaited<ReturnType<typeof listDriveFiles>>['data'];
export type ListDriveFilesQueryResult<
  TData = ListDriveFilesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListDriveFilesKey = 'ListDriveFiles';
export const UseListDriveFilesKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useListDriveFilesKey, ...(queryKey ?? [clientOptions])];
export type ListCanvasTemplatesDefaultResponse = Awaited<
  ReturnType<typeof listCanvasTemplates>
>['data'];
export type ListCanvasTemplatesQueryResult<
  TData = ListCanvasTemplatesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListCanvasTemplatesKey = 'ListCanvasTemplates';
export const UseListCanvasTemplatesKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListCanvasTemplatesKey, ...(queryKey ?? [clientOptions])];
export type ListCanvasTemplateCategoriesDefaultResponse = Awaited<
  ReturnType<typeof listCanvasTemplateCategories>
>['data'];
export type ListCanvasTemplateCategoriesQueryResult<
  TData = ListCanvasTemplateCategoriesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListCanvasTemplateCategoriesKey = 'ListCanvasTemplateCategories';
export const UseListCanvasTemplateCategoriesKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListCanvasTemplateCategoriesKey, ...(queryKey ?? [clientOptions])];
export type ListResourcesDefaultResponse = Awaited<ReturnType<typeof listResources>>['data'];
export type ListResourcesQueryResult<
  TData = ListResourcesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListResourcesKey = 'ListResources';
export const UseListResourcesKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListResourcesKey, ...(queryKey ?? [clientOptions])];
export type GetResourceDetailDefaultResponse = Awaited<
  ReturnType<typeof getResourceDetail>
>['data'];
export type GetResourceDetailQueryResult<
  TData = GetResourceDetailDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetResourceDetailKey = 'GetResourceDetail';
export const UseGetResourceDetailKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetResourceDetailKey, ...(queryKey ?? [clientOptions])];
export type ListDocumentsDefaultResponse = Awaited<ReturnType<typeof listDocuments>>['data'];
export type ListDocumentsQueryResult<
  TData = ListDocumentsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListDocumentsKey = 'ListDocuments';
export const UseListDocumentsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListDocumentsKey, ...(queryKey ?? [clientOptions])];
export type GetDocumentDetailDefaultResponse = Awaited<
  ReturnType<typeof getDocumentDetail>
>['data'];
export type GetDocumentDetailQueryResult<
  TData = GetDocumentDetailDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetDocumentDetailKey = 'GetDocumentDetail';
export const UseGetDocumentDetailKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetDocumentDetailKey, ...(queryKey ?? [clientOptions])];
export type ExportDocumentDefaultResponse = Awaited<ReturnType<typeof exportDocument>>['data'];
export type ExportDocumentQueryResult<
  TData = ExportDocumentDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useExportDocumentKey = 'ExportDocument';
export const UseExportDocumentKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useExportDocumentKey, ...(queryKey ?? [clientOptions])];
export type GetExportJobStatusDefaultResponse = Awaited<
  ReturnType<typeof getExportJobStatus>
>['data'];
export type GetExportJobStatusQueryResult<
  TData = GetExportJobStatusDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetExportJobStatusKey = 'GetExportJobStatus';
export const UseGetExportJobStatusKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetExportJobStatusKey, ...(queryKey ?? [clientOptions])];
export type DownloadExportJobResultDefaultResponse = Awaited<
  ReturnType<typeof downloadExportJobResult>
>['data'];
export type DownloadExportJobResultQueryResult<
  TData = DownloadExportJobResultDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useDownloadExportJobResultKey = 'DownloadExportJobResult';
export const UseDownloadExportJobResultKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useDownloadExportJobResultKey, ...(queryKey ?? [clientOptions])];
export type ListCodeArtifactsDefaultResponse = Awaited<
  ReturnType<typeof listCodeArtifacts>
>['data'];
export type ListCodeArtifactsQueryResult<
  TData = ListCodeArtifactsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListCodeArtifactsKey = 'ListCodeArtifacts';
export const UseListCodeArtifactsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListCodeArtifactsKey, ...(queryKey ?? [clientOptions])];
export type GetCodeArtifactDetailDefaultResponse = Awaited<
  ReturnType<typeof getCodeArtifactDetail>
>['data'];
export type GetCodeArtifactDetailQueryResult<
  TData = GetCodeArtifactDetailDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCodeArtifactDetailKey = 'GetCodeArtifactDetail';
export const UseGetCodeArtifactDetailKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetCodeArtifactDetailKey, ...(queryKey ?? [clientOptions])];
export type ListSharesDefaultResponse = Awaited<ReturnType<typeof listShares>>['data'];
export type ListSharesQueryResult<
  TData = ListSharesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListSharesKey = 'ListShares';
export const UseListSharesKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListSharesKey, ...(queryKey ?? [clientOptions])];
export type GetActionResultDefaultResponse = Awaited<ReturnType<typeof getActionResult>>['data'];
export type GetActionResultQueryResult<
  TData = GetActionResultDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetActionResultKey = 'GetActionResult';
export const UseGetActionResultKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetActionResultKey, ...(queryKey ?? [clientOptions])];
export type ListCopilotSessionsDefaultResponse = Awaited<
  ReturnType<typeof listCopilotSessions>
>['data'];
export type ListCopilotSessionsQueryResult<
  TData = ListCopilotSessionsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListCopilotSessionsKey = 'ListCopilotSessions';
export const UseListCopilotSessionsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListCopilotSessionsKey, ...(queryKey ?? [clientOptions])];
export type GetCopilotSessionDetailDefaultResponse = Awaited<
  ReturnType<typeof getCopilotSessionDetail>
>['data'];
export type GetCopilotSessionDetailQueryResult<
  TData = GetCopilotSessionDetailDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCopilotSessionDetailKey = 'GetCopilotSessionDetail';
export const UseGetCopilotSessionDetailKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetCopilotSessionDetailKey, ...(queryKey ?? [clientOptions])];
export type ListWorkflowExecutionsDefaultResponse = Awaited<
  ReturnType<typeof listWorkflowExecutions>
>['data'];
export type ListWorkflowExecutionsQueryResult<
  TData = ListWorkflowExecutionsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListWorkflowExecutionsKey = 'ListWorkflowExecutions';
export const UseListWorkflowExecutionsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListWorkflowExecutionsKey, ...(queryKey ?? [clientOptions])];
export type GetWorkflowDetailDefaultResponse = Awaited<
  ReturnType<typeof getWorkflowDetail>
>['data'];
export type GetWorkflowDetailQueryResult<
  TData = GetWorkflowDetailDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetWorkflowDetailKey = 'GetWorkflowDetail';
export const UseGetWorkflowDetailKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetWorkflowDetailKey, ...(queryKey ?? [clientOptions])];
export type GetWorkflowPlanDetailDefaultResponse = Awaited<
  ReturnType<typeof getWorkflowPlanDetail>
>['data'];
export type GetWorkflowPlanDetailQueryResult<
  TData = GetWorkflowPlanDetailDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetWorkflowPlanDetailKey = 'GetWorkflowPlanDetail';
export const UseGetWorkflowPlanDetailKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetWorkflowPlanDetailKey, ...(queryKey ?? [clientOptions])];
export type GetWorkflowAppDetailDefaultResponse = Awaited<
  ReturnType<typeof getWorkflowAppDetail>
>['data'];
export type GetWorkflowAppDetailQueryResult<
  TData = GetWorkflowAppDetailDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetWorkflowAppDetailKey = 'GetWorkflowAppDetail';
export const UseGetWorkflowAppDetailKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetWorkflowAppDetailKey, ...(queryKey ?? [clientOptions])];
export type ListWorkflowAppsDefaultResponse = Awaited<ReturnType<typeof listWorkflowApps>>['data'];
export type ListWorkflowAppsQueryResult<
  TData = ListWorkflowAppsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListWorkflowAppsKey = 'ListWorkflowApps';
export const UseListWorkflowAppsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListWorkflowAppsKey, ...(queryKey ?? [clientOptions])];
export type GetTemplateGenerationStatusDefaultResponse = Awaited<
  ReturnType<typeof getTemplateGenerationStatus>
>['data'];
export type GetTemplateGenerationStatusQueryResult<
  TData = GetTemplateGenerationStatusDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetTemplateGenerationStatusKey = 'GetTemplateGenerationStatus';
export const UseGetTemplateGenerationStatusKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetTemplateGenerationStatusKey, ...(queryKey ?? [clientOptions])];
export type GetWebhookConfigDefaultResponse = Awaited<ReturnType<typeof getWebhookConfig>>['data'];
export type GetWebhookConfigQueryResult<
  TData = GetWebhookConfigDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetWebhookConfigKey = 'GetWebhookConfig';
export const UseGetWebhookConfigKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetWebhookConfigKey, ...(queryKey ?? [clientOptions])];
export type GetWebhookHistoryDefaultResponse = Awaited<
  ReturnType<typeof getWebhookHistory>
>['data'];
export type GetWebhookHistoryQueryResult<
  TData = GetWebhookHistoryDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetWebhookHistoryKey = 'GetWebhookHistory';
export const UseGetWebhookHistoryKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetWebhookHistoryKey, ...(queryKey ?? [clientOptions])];
export type GetOpenapiConfigDefaultResponse = Awaited<ReturnType<typeof getOpenapiConfig>>['data'];
export type GetOpenapiConfigQueryResult<
  TData = GetOpenapiConfigDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetOpenapiConfigKey = 'GetOpenapiConfig';
export const UseGetOpenapiConfigKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetOpenapiConfigKey, ...(queryKey ?? [clientOptions])];
export type SearchWorkflowsViaApiDefaultResponse = Awaited<
  ReturnType<typeof searchWorkflowsViaApi>
>['data'];
export type SearchWorkflowsViaApiQueryResult<
  TData = SearchWorkflowsViaApiDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useSearchWorkflowsViaApiKey = 'SearchWorkflowsViaApi';
export const UseSearchWorkflowsViaApiKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useSearchWorkflowsViaApiKey, ...(queryKey ?? [clientOptions])];
export type GetWorkflowDetailViaApiDefaultResponse = Awaited<
  ReturnType<typeof getWorkflowDetailViaApi>
>['data'];
export type GetWorkflowDetailViaApiQueryResult<
  TData = GetWorkflowDetailViaApiDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetWorkflowDetailViaApiKey = 'GetWorkflowDetailViaApi';
export const UseGetWorkflowDetailViaApiKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetWorkflowDetailViaApiKey, ...(queryKey ?? [clientOptions])];
export type GetWorkflowStatusViaApiDefaultResponse = Awaited<
  ReturnType<typeof getWorkflowStatusViaApi>
>['data'];
export type GetWorkflowStatusViaApiQueryResult<
  TData = GetWorkflowStatusViaApiDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetWorkflowStatusViaApiKey = 'GetWorkflowStatusViaApi';
export const UseGetWorkflowStatusViaApiKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetWorkflowStatusViaApiKey, ...(queryKey ?? [clientOptions])];
export type GetWorkflowOutputDefaultResponse = Awaited<
  ReturnType<typeof getWorkflowOutput>
>['data'];
export type GetWorkflowOutputQueryResult<
  TData = GetWorkflowOutputDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetWorkflowOutputKey = 'GetWorkflowOutput';
export const UseGetWorkflowOutputKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetWorkflowOutputKey, ...(queryKey ?? [clientOptions])];
export type GetSettingsDefaultResponse = Awaited<ReturnType<typeof getSettings>>['data'];
export type GetSettingsQueryResult<
  TData = GetSettingsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetSettingsKey = 'GetSettings';
export const UseGetSettingsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useGetSettingsKey, ...(queryKey ?? [clientOptions])];
export type CheckSettingsFieldDefaultResponse = Awaited<
  ReturnType<typeof checkSettingsField>
>['data'];
export type CheckSettingsFieldQueryResult<
  TData = CheckSettingsFieldDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useCheckSettingsFieldKey = 'CheckSettingsField';
export const UseCheckSettingsFieldKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useCheckSettingsFieldKey, ...(queryKey ?? [clientOptions])];
export type GetFormDefinitionDefaultResponse = Awaited<
  ReturnType<typeof getFormDefinition>
>['data'];
export type GetFormDefinitionQueryResult<
  TData = GetFormDefinitionDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetFormDefinitionKey = 'GetFormDefinition';
export const UseGetFormDefinitionKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useGetFormDefinitionKey, ...(queryKey ?? [clientOptions])];
export type GetCreditRechargeDefaultResponse = Awaited<
  ReturnType<typeof getCreditRecharge>
>['data'];
export type GetCreditRechargeQueryResult<
  TData = GetCreditRechargeDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCreditRechargeKey = 'GetCreditRecharge';
export const UseGetCreditRechargeKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useGetCreditRechargeKey, ...(queryKey ?? [clientOptions])];
export type GetCreditUsageDefaultResponse = Awaited<ReturnType<typeof getCreditUsage>>['data'];
export type GetCreditUsageQueryResult<
  TData = GetCreditUsageDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCreditUsageKey = 'GetCreditUsage';
export const UseGetCreditUsageKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useGetCreditUsageKey, ...(queryKey ?? [clientOptions])];
export type GetCreditBalanceDefaultResponse = Awaited<ReturnType<typeof getCreditBalance>>['data'];
export type GetCreditBalanceQueryResult<
  TData = GetCreditBalanceDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCreditBalanceKey = 'GetCreditBalance';
export const UseGetCreditBalanceKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useGetCreditBalanceKey, ...(queryKey ?? [clientOptions])];
export type GetCreditUsageByResultIdDefaultResponse = Awaited<
  ReturnType<typeof getCreditUsageByResultId>
>['data'];
export type GetCreditUsageByResultIdQueryResult<
  TData = GetCreditUsageByResultIdDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCreditUsageByResultIdKey = 'GetCreditUsageByResultId';
export const UseGetCreditUsageByResultIdKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetCreditUsageByResultIdKey, ...(queryKey ?? [clientOptions])];
export type GetCreditUsageByExecutionIdDefaultResponse = Awaited<
  ReturnType<typeof getCreditUsageByExecutionId>
>['data'];
export type GetCreditUsageByExecutionIdQueryResult<
  TData = GetCreditUsageByExecutionIdDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCreditUsageByExecutionIdKey = 'GetCreditUsageByExecutionId';
export const UseGetCreditUsageByExecutionIdKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetCreditUsageByExecutionIdKey, ...(queryKey ?? [clientOptions])];
export type GetCreditUsageByCanvasIdDefaultResponse = Awaited<
  ReturnType<typeof getCreditUsageByCanvasId>
>['data'];
export type GetCreditUsageByCanvasIdQueryResult<
  TData = GetCreditUsageByCanvasIdDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCreditUsageByCanvasIdKey = 'GetCreditUsageByCanvasId';
export const UseGetCreditUsageByCanvasIdKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetCreditUsageByCanvasIdKey, ...(queryKey ?? [clientOptions])];
export type GetCanvasCommissionByCanvasIdDefaultResponse = Awaited<
  ReturnType<typeof getCanvasCommissionByCanvasId>
>['data'];
export type GetCanvasCommissionByCanvasIdQueryResult<
  TData = GetCanvasCommissionByCanvasIdDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetCanvasCommissionByCanvasIdKey = 'GetCanvasCommissionByCanvasId';
export const UseGetCanvasCommissionByCanvasIdKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetCanvasCommissionByCanvasIdKey, ...(queryKey ?? [clientOptions])];
export type ListInvitationCodesDefaultResponse = Awaited<
  ReturnType<typeof listInvitationCodes>
>['data'];
export type ListInvitationCodesQueryResult<
  TData = ListInvitationCodesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListInvitationCodesKey = 'ListInvitationCodes';
export const UseListInvitationCodesKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListInvitationCodesKey, ...(queryKey ?? [clientOptions])];
export type GetSubscriptionPlansDefaultResponse = Awaited<
  ReturnType<typeof getSubscriptionPlans>
>['data'];
export type GetSubscriptionPlansQueryResult<
  TData = GetSubscriptionPlansDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetSubscriptionPlansKey = 'GetSubscriptionPlans';
export const UseGetSubscriptionPlansKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useGetSubscriptionPlansKey, ...(queryKey ?? [clientOptions])];
export type GetSubscriptionUsageDefaultResponse = Awaited<
  ReturnType<typeof getSubscriptionUsage>
>['data'];
export type GetSubscriptionUsageQueryResult<
  TData = GetSubscriptionUsageDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetSubscriptionUsageKey = 'GetSubscriptionUsage';
export const UseGetSubscriptionUsageKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useGetSubscriptionUsageKey, ...(queryKey ?? [clientOptions])];
export type ListModelsDefaultResponse = Awaited<ReturnType<typeof listModels>>['data'];
export type ListModelsQueryResult<
  TData = ListModelsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListModelsKey = 'ListModels';
export const UseListModelsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListModelsKey, ...(queryKey ?? [clientOptions])];
export type ListProvidersDefaultResponse = Awaited<ReturnType<typeof listProviders>>['data'];
export type ListProvidersQueryResult<
  TData = ListProvidersDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListProvidersKey = 'ListProviders';
export const UseListProvidersKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListProvidersKey, ...(queryKey ?? [clientOptions])];
export type ListProviderItemsDefaultResponse = Awaited<
  ReturnType<typeof listProviderItems>
>['data'];
export type ListProviderItemsQueryResult<
  TData = ListProviderItemsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListProviderItemsKey = 'ListProviderItems';
export const UseListProviderItemsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListProviderItemsKey, ...(queryKey ?? [clientOptions])];
export type ListProviderItemOptionsDefaultResponse = Awaited<
  ReturnType<typeof listProviderItemOptions>
>['data'];
export type ListProviderItemOptionsQueryResult<
  TData = ListProviderItemOptionsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListProviderItemOptionsKey = 'ListProviderItemOptions';
export const UseListProviderItemOptionsKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useListProviderItemOptionsKey, ...(queryKey ?? [clientOptions])];
export type ListToolsDefaultResponse = Awaited<ReturnType<typeof listTools>>['data'];
export type ListToolsQueryResult<
  TData = ListToolsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListToolsKey = 'ListTools';
export const UseListToolsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListToolsKey, ...(queryKey ?? [clientOptions])];
export type ListUserToolsDefaultResponse = Awaited<ReturnType<typeof listUserTools>>['data'];
export type ListUserToolsQueryResult<
  TData = ListUserToolsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListUserToolsKey = 'ListUserTools';
export const UseListUserToolsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListUserToolsKey, ...(queryKey ?? [clientOptions])];
export type ListToolsetInventoryDefaultResponse = Awaited<
  ReturnType<typeof listToolsetInventory>
>['data'];
export type ListToolsetInventoryQueryResult<
  TData = ListToolsetInventoryDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListToolsetInventoryKey = 'ListToolsetInventory';
export const UseListToolsetInventoryKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListToolsetInventoryKey, ...(queryKey ?? [clientOptions])];
export type ListToolsetsDefaultResponse = Awaited<ReturnType<typeof listToolsets>>['data'];
export type ListToolsetsQueryResult<
  TData = ListToolsetsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListToolsetsKey = 'ListToolsets';
export const UseListToolsetsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListToolsetsKey, ...(queryKey ?? [clientOptions])];
export type ExportToolsetDefinitionsDefaultResponse = Awaited<
  ReturnType<typeof exportToolsetDefinitions>
>['data'];
export type ExportToolsetDefinitionsQueryResult<
  TData = ExportToolsetDefinitionsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useExportToolsetDefinitionsKey = 'ExportToolsetDefinitions';
export const UseExportToolsetDefinitionsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useExportToolsetDefinitionsKey, ...(queryKey ?? [clientOptions])];
export type GetToolCallResultDefaultResponse = Awaited<
  ReturnType<typeof getToolCallResult>
>['data'];
export type GetToolCallResultQueryResult<
  TData = GetToolCallResultDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetToolCallResultKey = 'GetToolCallResult';
export const UseGetToolCallResultKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetToolCallResultKey, ...(queryKey ?? [clientOptions])];
export type GetComposioConnectionStatusDefaultResponse = Awaited<
  ReturnType<typeof getComposioConnectionStatus>
>['data'];
export type GetComposioConnectionStatusQueryResult<
  TData = GetComposioConnectionStatusDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetComposioConnectionStatusKey = 'GetComposioConnectionStatus';
export const UseGetComposioConnectionStatusKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetComposioConnectionStatusKey, ...(queryKey ?? [clientOptions])];
export type ServeStaticDefaultResponse = Awaited<ReturnType<typeof serveStatic>>['data'];
export type ServeStaticQueryResult<
  TData = ServeStaticDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useServeStaticKey = 'ServeStatic';
export const UseServeStaticKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useServeStaticKey, ...(queryKey ?? [clientOptions])];
export type GetPromptSuggestionsDefaultResponse = Awaited<
  ReturnType<typeof getPromptSuggestions>
>['data'];
export type GetPromptSuggestionsQueryResult<
  TData = GetPromptSuggestionsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetPromptSuggestionsKey = 'GetPromptSuggestions';
export const UseGetPromptSuggestionsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useGetPromptSuggestionsKey, ...(queryKey ?? [clientOptions])];
export type GetAvailableVouchersDefaultResponse = Awaited<
  ReturnType<typeof getAvailableVouchers>
>['data'];
export type GetAvailableVouchersQueryResult<
  TData = GetAvailableVouchersDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetAvailableVouchersKey = 'GetAvailableVouchers';
export const UseGetAvailableVouchersKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useGetAvailableVouchersKey, ...(queryKey ?? [clientOptions])];
export type ListUserVouchersDefaultResponse = Awaited<ReturnType<typeof listUserVouchers>>['data'];
export type ListUserVouchersQueryResult<
  TData = ListUserVouchersDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListUserVouchersKey = 'ListUserVouchers';
export const UseListUserVouchersKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListUserVouchersKey, ...(queryKey ?? [clientOptions])];
export type VerifyVoucherInvitationDefaultResponse = Awaited<
  ReturnType<typeof verifyVoucherInvitation>
>['data'];
export type VerifyVoucherInvitationQueryResult<
  TData = VerifyVoucherInvitationDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useVerifyVoucherInvitationKey = 'VerifyVoucherInvitation';
export const UseVerifyVoucherInvitationKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useVerifyVoucherInvitationKey, ...(queryKey ?? [clientOptions])];
export type ExtractVariablesMutationResult = Awaited<ReturnType<typeof extractVariables>>;
export const useExtractVariablesKey = 'ExtractVariables';
export const UseExtractVariablesKeyFn = (mutationKey?: Array<unknown>) => [
  useExtractVariablesKey,
  ...(mutationKey ?? []),
];
export type GenerateAppTemplateMutationResult = Awaited<ReturnType<typeof generateAppTemplate>>;
export const useGenerateAppTemplateKey = 'GenerateAppTemplate';
export const UseGenerateAppTemplateKeyFn = (mutationKey?: Array<unknown>) => [
  useGenerateAppTemplateKey,
  ...(mutationKey ?? []),
];
export type CreateMcpServerMutationResult = Awaited<ReturnType<typeof createMcpServer>>;
export const useCreateMcpServerKey = 'CreateMcpServer';
export const UseCreateMcpServerKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateMcpServerKey,
  ...(mutationKey ?? []),
];
export type UpdateMcpServerMutationResult = Awaited<ReturnType<typeof updateMcpServer>>;
export const useUpdateMcpServerKey = 'UpdateMcpServer';
export const UseUpdateMcpServerKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateMcpServerKey,
  ...(mutationKey ?? []),
];
export type DeleteMcpServerMutationResult = Awaited<ReturnType<typeof deleteMcpServer>>;
export const useDeleteMcpServerKey = 'DeleteMcpServer';
export const UseDeleteMcpServerKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteMcpServerKey,
  ...(mutationKey ?? []),
];
export type ValidateMcpServerMutationResult = Awaited<ReturnType<typeof validateMcpServer>>;
export const useValidateMcpServerKey = 'ValidateMcpServer';
export const UseValidateMcpServerKeyFn = (mutationKey?: Array<unknown>) => [
  useValidateMcpServerKey,
  ...(mutationKey ?? []),
];
export type RefreshTokenMutationResult = Awaited<ReturnType<typeof refreshToken>>;
export const useRefreshTokenKey = 'RefreshToken';
export const UseRefreshTokenKeyFn = (mutationKey?: Array<unknown>) => [
  useRefreshTokenKey,
  ...(mutationKey ?? []),
];
export type EmailSignupMutationResult = Awaited<ReturnType<typeof emailSignup>>;
export const useEmailSignupKey = 'EmailSignup';
export const UseEmailSignupKeyFn = (mutationKey?: Array<unknown>) => [
  useEmailSignupKey,
  ...(mutationKey ?? []),
];
export type EmailLoginMutationResult = Awaited<ReturnType<typeof emailLogin>>;
export const useEmailLoginKey = 'EmailLogin';
export const UseEmailLoginKeyFn = (mutationKey?: Array<unknown>) => [
  useEmailLoginKey,
  ...(mutationKey ?? []),
];
export type CreateVerificationMutationResult = Awaited<ReturnType<typeof createVerification>>;
export const useCreateVerificationKey = 'CreateVerification';
export const UseCreateVerificationKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateVerificationKey,
  ...(mutationKey ?? []),
];
export type ResendVerificationMutationResult = Awaited<ReturnType<typeof resendVerification>>;
export const useResendVerificationKey = 'ResendVerification';
export const UseResendVerificationKeyFn = (mutationKey?: Array<unknown>) => [
  useResendVerificationKey,
  ...(mutationKey ?? []),
];
export type CheckVerificationMutationResult = Awaited<ReturnType<typeof checkVerification>>;
export const useCheckVerificationKey = 'CheckVerification';
export const UseCheckVerificationKeyFn = (mutationKey?: Array<unknown>) => [
  useCheckVerificationKey,
  ...(mutationKey ?? []),
];
export type LogoutMutationResult = Awaited<ReturnType<typeof logout>>;
export const useLogoutKey = 'Logout';
export const UseLogoutKeyFn = (mutationKey?: Array<unknown>) => [
  useLogoutKey,
  ...(mutationKey ?? []),
];
export type CreateCliApiKeyMutationResult = Awaited<ReturnType<typeof createCliApiKey>>;
export const useCreateCliApiKeyKey = 'CreateCliApiKey';
export const UseCreateCliApiKeyKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateCliApiKeyKey,
  ...(mutationKey ?? []),
];
export type ImportCanvasMutationResult = Awaited<ReturnType<typeof importCanvas>>;
export const useImportCanvasKey = 'ImportCanvas';
export const UseImportCanvasKeyFn = (mutationKey?: Array<unknown>) => [
  useImportCanvasKey,
  ...(mutationKey ?? []),
];
export type CreateCanvasMutationResult = Awaited<ReturnType<typeof createCanvas>>;
export const useCreateCanvasKey = 'CreateCanvas';
export const UseCreateCanvasKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateCanvasKey,
  ...(mutationKey ?? []),
];
export type DuplicateCanvasMutationResult = Awaited<ReturnType<typeof duplicateCanvas>>;
export const useDuplicateCanvasKey = 'DuplicateCanvas';
export const UseDuplicateCanvasKeyFn = (mutationKey?: Array<unknown>) => [
  useDuplicateCanvasKey,
  ...(mutationKey ?? []),
];
export type UpdateCanvasMutationResult = Awaited<ReturnType<typeof updateCanvas>>;
export const useUpdateCanvasKey = 'UpdateCanvas';
export const UseUpdateCanvasKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateCanvasKey,
  ...(mutationKey ?? []),
];
export type DeleteCanvasMutationResult = Awaited<ReturnType<typeof deleteCanvas>>;
export const useDeleteCanvasKey = 'DeleteCanvas';
export const UseDeleteCanvasKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteCanvasKey,
  ...(mutationKey ?? []),
];
export type AutoNameCanvasMutationResult = Awaited<ReturnType<typeof autoNameCanvas>>;
export const useAutoNameCanvasKey = 'AutoNameCanvas';
export const UseAutoNameCanvasKeyFn = (mutationKey?: Array<unknown>) => [
  useAutoNameCanvasKey,
  ...(mutationKey ?? []),
];
export type SetCanvasStateMutationResult = Awaited<ReturnType<typeof setCanvasState>>;
export const useSetCanvasStateKey = 'SetCanvasState';
export const UseSetCanvasStateKeyFn = (mutationKey?: Array<unknown>) => [
  useSetCanvasStateKey,
  ...(mutationKey ?? []),
];
export type SyncCanvasStateMutationResult = Awaited<ReturnType<typeof syncCanvasState>>;
export const useSyncCanvasStateKey = 'SyncCanvasState';
export const UseSyncCanvasStateKeyFn = (mutationKey?: Array<unknown>) => [
  useSyncCanvasStateKey,
  ...(mutationKey ?? []),
];
export type CreateCanvasVersionMutationResult = Awaited<ReturnType<typeof createCanvasVersion>>;
export const useCreateCanvasVersionKey = 'CreateCanvasVersion';
export const UseCreateCanvasVersionKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateCanvasVersionKey,
  ...(mutationKey ?? []),
];
export type UpdateWorkflowVariablesMutationResult = Awaited<
  ReturnType<typeof updateWorkflowVariables>
>;
export const useUpdateWorkflowVariablesKey = 'UpdateWorkflowVariables';
export const UseUpdateWorkflowVariablesKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateWorkflowVariablesKey,
  ...(mutationKey ?? []),
];
export type CreateDriveFileMutationResult = Awaited<ReturnType<typeof createDriveFile>>;
export const useCreateDriveFileKey = 'CreateDriveFile';
export const UseCreateDriveFileKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateDriveFileKey,
  ...(mutationKey ?? []),
];
export type BatchCreateDriveFilesMutationResult = Awaited<ReturnType<typeof batchCreateDriveFiles>>;
export const useBatchCreateDriveFilesKey = 'BatchCreateDriveFiles';
export const UseBatchCreateDriveFilesKeyFn = (mutationKey?: Array<unknown>) => [
  useBatchCreateDriveFilesKey,
  ...(mutationKey ?? []),
];
export type UpdateDriveFileMutationResult = Awaited<ReturnType<typeof updateDriveFile>>;
export const useUpdateDriveFileKey = 'UpdateDriveFile';
export const UseUpdateDriveFileKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateDriveFileKey,
  ...(mutationKey ?? []),
];
export type DeleteDriveFileMutationResult = Awaited<ReturnType<typeof deleteDriveFile>>;
export const useDeleteDriveFileKey = 'DeleteDriveFile';
export const UseDeleteDriveFileKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteDriveFileKey,
  ...(mutationKey ?? []),
];
export type CreateCanvasTemplateMutationResult = Awaited<ReturnType<typeof createCanvasTemplate>>;
export const useCreateCanvasTemplateKey = 'CreateCanvasTemplate';
export const UseCreateCanvasTemplateKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateCanvasTemplateKey,
  ...(mutationKey ?? []),
];
export type UpdateCanvasTemplateMutationResult = Awaited<ReturnType<typeof updateCanvasTemplate>>;
export const useUpdateCanvasTemplateKey = 'UpdateCanvasTemplate';
export const UseUpdateCanvasTemplateKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateCanvasTemplateKey,
  ...(mutationKey ?? []),
];
export type UpdateResourceMutationResult = Awaited<ReturnType<typeof updateResource>>;
export const useUpdateResourceKey = 'UpdateResource';
export const UseUpdateResourceKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateResourceKey,
  ...(mutationKey ?? []),
];
export type CreateResourceMutationResult = Awaited<ReturnType<typeof createResource>>;
export const useCreateResourceKey = 'CreateResource';
export const UseCreateResourceKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateResourceKey,
  ...(mutationKey ?? []),
];
export type CreateResourceWithFileMutationResult = Awaited<
  ReturnType<typeof createResourceWithFile>
>;
export const useCreateResourceWithFileKey = 'CreateResourceWithFile';
export const UseCreateResourceWithFileKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateResourceWithFileKey,
  ...(mutationKey ?? []),
];
export type BatchCreateResourceMutationResult = Awaited<ReturnType<typeof batchCreateResource>>;
export const useBatchCreateResourceKey = 'BatchCreateResource';
export const UseBatchCreateResourceKeyFn = (mutationKey?: Array<unknown>) => [
  useBatchCreateResourceKey,
  ...(mutationKey ?? []),
];
export type ReindexResourceMutationResult = Awaited<ReturnType<typeof reindexResource>>;
export const useReindexResourceKey = 'ReindexResource';
export const UseReindexResourceKeyFn = (mutationKey?: Array<unknown>) => [
  useReindexResourceKey,
  ...(mutationKey ?? []),
];
export type DeleteResourceMutationResult = Awaited<ReturnType<typeof deleteResource>>;
export const useDeleteResourceKey = 'DeleteResource';
export const UseDeleteResourceKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteResourceKey,
  ...(mutationKey ?? []),
];
export type StartExportJobMutationResult = Awaited<ReturnType<typeof startExportJob>>;
export const useStartExportJobKey = 'StartExportJob';
export const UseStartExportJobKeyFn = (mutationKey?: Array<unknown>) => [
  useStartExportJobKey,
  ...(mutationKey ?? []),
];
export type UpdateDocumentMutationResult = Awaited<ReturnType<typeof updateDocument>>;
export const useUpdateDocumentKey = 'UpdateDocument';
export const UseUpdateDocumentKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateDocumentKey,
  ...(mutationKey ?? []),
];
export type CreateDocumentMutationResult = Awaited<ReturnType<typeof createDocument>>;
export const useCreateDocumentKey = 'CreateDocument';
export const UseCreateDocumentKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateDocumentKey,
  ...(mutationKey ?? []),
];
export type DeleteDocumentMutationResult = Awaited<ReturnType<typeof deleteDocument>>;
export const useDeleteDocumentKey = 'DeleteDocument';
export const UseDeleteDocumentKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteDocumentKey,
  ...(mutationKey ?? []),
];
export type BatchUpdateDocumentMutationResult = Awaited<ReturnType<typeof batchUpdateDocument>>;
export const useBatchUpdateDocumentKey = 'BatchUpdateDocument';
export const UseBatchUpdateDocumentKeyFn = (mutationKey?: Array<unknown>) => [
  useBatchUpdateDocumentKey,
  ...(mutationKey ?? []),
];
export type CreateCodeArtifactMutationResult = Awaited<ReturnType<typeof createCodeArtifact>>;
export const useCreateCodeArtifactKey = 'CreateCodeArtifact';
export const UseCreateCodeArtifactKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateCodeArtifactKey,
  ...(mutationKey ?? []),
];
export type UpdateCodeArtifactMutationResult = Awaited<ReturnType<typeof updateCodeArtifact>>;
export const useUpdateCodeArtifactKey = 'UpdateCodeArtifact';
export const UseUpdateCodeArtifactKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateCodeArtifactKey,
  ...(mutationKey ?? []),
];
export type CreateShareMutationResult = Awaited<ReturnType<typeof createShare>>;
export const useCreateShareKey = 'CreateShare';
export const UseCreateShareKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateShareKey,
  ...(mutationKey ?? []),
];
export type DeleteShareMutationResult = Awaited<ReturnType<typeof deleteShare>>;
export const useDeleteShareKey = 'DeleteShare';
export const UseDeleteShareKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteShareKey,
  ...(mutationKey ?? []),
];
export type DuplicateShareMutationResult = Awaited<ReturnType<typeof duplicateShare>>;
export const useDuplicateShareKey = 'DuplicateShare';
export const UseDuplicateShareKeyFn = (mutationKey?: Array<unknown>) => [
  useDuplicateShareKey,
  ...(mutationKey ?? []),
];
export type AbortActionMutationResult = Awaited<ReturnType<typeof abortAction>>;
export const useAbortActionKey = 'AbortAction';
export const UseAbortActionKeyFn = (mutationKey?: Array<unknown>) => [
  useAbortActionKey,
  ...(mutationKey ?? []),
];
export type InvokeSkillMutationResult = Awaited<ReturnType<typeof invokeSkill>>;
export const useInvokeSkillKey = 'InvokeSkill';
export const UseInvokeSkillKeyFn = (mutationKey?: Array<unknown>) => [
  useInvokeSkillKey,
  ...(mutationKey ?? []),
];
export type StreamInvokeSkillMutationResult = Awaited<ReturnType<typeof streamInvokeSkill>>;
export const useStreamInvokeSkillKey = 'StreamInvokeSkill';
export const UseStreamInvokeSkillKeyFn = (mutationKey?: Array<unknown>) => [
  useStreamInvokeSkillKey,
  ...(mutationKey ?? []),
];
export type GenerateMediaMutationResult = Awaited<ReturnType<typeof generateMedia>>;
export const useGenerateMediaKey = 'GenerateMedia';
export const UseGenerateMediaKeyFn = (mutationKey?: Array<unknown>) => [
  useGenerateMediaKey,
  ...(mutationKey ?? []),
];
export type InitializeWorkflowMutationResult = Awaited<ReturnType<typeof initializeWorkflow>>;
export const useInitializeWorkflowKey = 'InitializeWorkflow';
export const UseInitializeWorkflowKeyFn = (mutationKey?: Array<unknown>) => [
  useInitializeWorkflowKey,
  ...(mutationKey ?? []),
];
export type AbortWorkflowMutationResult = Awaited<ReturnType<typeof abortWorkflow>>;
export const useAbortWorkflowKey = 'AbortWorkflow';
export const UseAbortWorkflowKeyFn = (mutationKey?: Array<unknown>) => [
  useAbortWorkflowKey,
  ...(mutationKey ?? []),
];
export type CreateWorkflowAppMutationResult = Awaited<ReturnType<typeof createWorkflowApp>>;
export const useCreateWorkflowAppKey = 'CreateWorkflowApp';
export const UseCreateWorkflowAppKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateWorkflowAppKey,
  ...(mutationKey ?? []),
];
export type DeleteWorkflowAppMutationResult = Awaited<ReturnType<typeof deleteWorkflowApp>>;
export const useDeleteWorkflowAppKey = 'DeleteWorkflowApp';
export const UseDeleteWorkflowAppKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteWorkflowAppKey,
  ...(mutationKey ?? []),
];
export type ExecuteWorkflowAppMutationResult = Awaited<ReturnType<typeof executeWorkflowApp>>;
export const useExecuteWorkflowAppKey = 'ExecuteWorkflowApp';
export const UseExecuteWorkflowAppKeyFn = (mutationKey?: Array<unknown>) => [
  useExecuteWorkflowAppKey,
  ...(mutationKey ?? []),
];
export type CreateScheduleMutationResult = Awaited<ReturnType<typeof createSchedule>>;
export const useCreateScheduleKey = 'CreateSchedule';
export const UseCreateScheduleKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateScheduleKey,
  ...(mutationKey ?? []),
];
export type UpdateScheduleMutationResult = Awaited<ReturnType<typeof updateSchedule>>;
export const useUpdateScheduleKey = 'UpdateSchedule';
export const UseUpdateScheduleKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateScheduleKey,
  ...(mutationKey ?? []),
];
export type DeleteScheduleMutationResult = Awaited<ReturnType<typeof deleteSchedule>>;
export const useDeleteScheduleKey = 'DeleteSchedule';
export const UseDeleteScheduleKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteScheduleKey,
  ...(mutationKey ?? []),
];
export type ListSchedulesMutationResult = Awaited<ReturnType<typeof listSchedules>>;
export const useListSchedulesKey = 'ListSchedules';
export const UseListSchedulesKeyFn = (mutationKey?: Array<unknown>) => [
  useListSchedulesKey,
  ...(mutationKey ?? []),
];
export type GetScheduleDetailMutationResult = Awaited<ReturnType<typeof getScheduleDetail>>;
export const useGetScheduleDetailKey = 'GetScheduleDetail';
export const UseGetScheduleDetailKeyFn = (mutationKey?: Array<unknown>) => [
  useGetScheduleDetailKey,
  ...(mutationKey ?? []),
];
export type GetScheduleRecordsMutationResult = Awaited<ReturnType<typeof getScheduleRecords>>;
export const useGetScheduleRecordsKey = 'GetScheduleRecords';
export const UseGetScheduleRecordsKeyFn = (mutationKey?: Array<unknown>) => [
  useGetScheduleRecordsKey,
  ...(mutationKey ?? []),
];
export type ListAllScheduleRecordsMutationResult = Awaited<
  ReturnType<typeof listAllScheduleRecords>
>;
export const useListAllScheduleRecordsKey = 'ListAllScheduleRecords';
export const UseListAllScheduleRecordsKeyFn = (mutationKey?: Array<unknown>) => [
  useListAllScheduleRecordsKey,
  ...(mutationKey ?? []),
];
export type GetAvailableToolsMutationResult = Awaited<ReturnType<typeof getAvailableTools>>;
export const useGetAvailableToolsKey = 'GetAvailableTools';
export const UseGetAvailableToolsKeyFn = (mutationKey?: Array<unknown>) => [
  useGetAvailableToolsKey,
  ...(mutationKey ?? []),
];
export type GetScheduleRecordDetailMutationResult = Awaited<
  ReturnType<typeof getScheduleRecordDetail>
>;
export const useGetScheduleRecordDetailKey = 'GetScheduleRecordDetail';
export const UseGetScheduleRecordDetailKeyFn = (mutationKey?: Array<unknown>) => [
  useGetScheduleRecordDetailKey,
  ...(mutationKey ?? []),
];
export type GetRecordSnapshotMutationResult = Awaited<ReturnType<typeof getRecordSnapshot>>;
export const useGetRecordSnapshotKey = 'GetRecordSnapshot';
export const UseGetRecordSnapshotKeyFn = (mutationKey?: Array<unknown>) => [
  useGetRecordSnapshotKey,
  ...(mutationKey ?? []),
];
export type TriggerScheduleManuallyMutationResult = Awaited<
  ReturnType<typeof triggerScheduleManually>
>;
export const useTriggerScheduleManuallyKey = 'TriggerScheduleManually';
export const UseTriggerScheduleManuallyKeyFn = (mutationKey?: Array<unknown>) => [
  useTriggerScheduleManuallyKey,
  ...(mutationKey ?? []),
];
export type RetryScheduleRecordMutationResult = Awaited<ReturnType<typeof retryScheduleRecord>>;
export const useRetryScheduleRecordKey = 'RetryScheduleRecord';
export const UseRetryScheduleRecordKeyFn = (mutationKey?: Array<unknown>) => [
  useRetryScheduleRecordKey,
  ...(mutationKey ?? []),
];
export type EnableWebhookMutationResult = Awaited<ReturnType<typeof enableWebhook>>;
export const useEnableWebhookKey = 'EnableWebhook';
export const UseEnableWebhookKeyFn = (mutationKey?: Array<unknown>) => [
  useEnableWebhookKey,
  ...(mutationKey ?? []),
];
export type DisableWebhookMutationResult = Awaited<ReturnType<typeof disableWebhook>>;
export const useDisableWebhookKey = 'DisableWebhook';
export const UseDisableWebhookKeyFn = (mutationKey?: Array<unknown>) => [
  useDisableWebhookKey,
  ...(mutationKey ?? []),
];
export type ResetWebhookMutationResult = Awaited<ReturnType<typeof resetWebhook>>;
export const useResetWebhookKey = 'ResetWebhook';
export const UseResetWebhookKeyFn = (mutationKey?: Array<unknown>) => [
  useResetWebhookKey,
  ...(mutationKey ?? []),
];
export type UpdateWebhookMutationResult = Awaited<ReturnType<typeof updateWebhook>>;
export const useUpdateWebhookKey = 'UpdateWebhook';
export const UseUpdateWebhookKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateWebhookKey,
  ...(mutationKey ?? []),
];
export type RunWebhookMutationResult = Awaited<ReturnType<typeof runWebhook>>;
export const useRunWebhookKey = 'RunWebhook';
export const UseRunWebhookKeyFn = (mutationKey?: Array<unknown>) => [
  useRunWebhookKey,
  ...(mutationKey ?? []),
];
export type UpdateOpenapiConfigMutationResult = Awaited<ReturnType<typeof updateOpenapiConfig>>;
export const useUpdateOpenapiConfigKey = 'UpdateOpenapiConfig';
export const UseUpdateOpenapiConfigKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateOpenapiConfigKey,
  ...(mutationKey ?? []),
];
export type UploadOpenapiFilesMutationResult = Awaited<ReturnType<typeof uploadOpenapiFiles>>;
export const useUploadOpenapiFilesKey = 'UploadOpenapiFiles';
export const UseUploadOpenapiFilesKeyFn = (mutationKey?: Array<unknown>) => [
  useUploadOpenapiFilesKey,
  ...(mutationKey ?? []),
];
export type RunWorkflowViaApiMutationResult = Awaited<ReturnType<typeof runWorkflowViaApi>>;
export const useRunWorkflowViaApiKey = 'RunWorkflowViaApi';
export const UseRunWorkflowViaApiKeyFn = (mutationKey?: Array<unknown>) => [
  useRunWorkflowViaApiKey,
  ...(mutationKey ?? []),
];
export type GenerateWorkflowViaCopilotMutationResult = Awaited<
  ReturnType<typeof generateWorkflowViaCopilot>
>;
export const useGenerateWorkflowViaCopilotKey = 'GenerateWorkflowViaCopilot';
export const UseGenerateWorkflowViaCopilotKeyFn = (mutationKey?: Array<unknown>) => [
  useGenerateWorkflowViaCopilotKey,
  ...(mutationKey ?? []),
];
export type AbortWorkflowViaApiMutationResult = Awaited<ReturnType<typeof abortWorkflowViaApi>>;
export const useAbortWorkflowViaApiKey = 'AbortWorkflowViaApi';
export const UseAbortWorkflowViaApiKeyFn = (mutationKey?: Array<unknown>) => [
  useAbortWorkflowViaApiKey,
  ...(mutationKey ?? []),
];
export type SubmitFormMutationResult = Awaited<ReturnType<typeof submitForm>>;
export const useSubmitFormKey = 'SubmitForm';
export const UseSubmitFormKeyFn = (mutationKey?: Array<unknown>) => [
  useSubmitFormKey,
  ...(mutationKey ?? []),
];
export type ActivateInvitationCodeMutationResult = Awaited<
  ReturnType<typeof activateInvitationCode>
>;
export const useActivateInvitationCodeKey = 'ActivateInvitationCode';
export const UseActivateInvitationCodeKeyFn = (mutationKey?: Array<unknown>) => [
  useActivateInvitationCodeKey,
  ...(mutationKey ?? []),
];
export type SkipInvitationCodeMutationResult = Awaited<ReturnType<typeof skipInvitationCode>>;
export const useSkipInvitationCodeKey = 'SkipInvitationCode';
export const UseSkipInvitationCodeKeyFn = (mutationKey?: Array<unknown>) => [
  useSkipInvitationCodeKey,
  ...(mutationKey ?? []),
];
export type CreateCheckoutSessionMutationResult = Awaited<ReturnType<typeof createCheckoutSession>>;
export const useCreateCheckoutSessionKey = 'CreateCheckoutSession';
export const UseCreateCheckoutSessionKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateCheckoutSessionKey,
  ...(mutationKey ?? []),
];
export type CreateCreditPackCheckoutSessionMutationResult = Awaited<
  ReturnType<typeof createCreditPackCheckoutSession>
>;
export const useCreateCreditPackCheckoutSessionKey = 'CreateCreditPackCheckoutSession';
export const UseCreateCreditPackCheckoutSessionKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateCreditPackCheckoutSessionKey,
  ...(mutationKey ?? []),
];
export type CreatePortalSessionMutationResult = Awaited<ReturnType<typeof createPortalSession>>;
export const useCreatePortalSessionKey = 'CreatePortalSession';
export const UseCreatePortalSessionKeyFn = (mutationKey?: Array<unknown>) => [
  useCreatePortalSessionKey,
  ...(mutationKey ?? []),
];
export type SearchMutationResult = Awaited<ReturnType<typeof search>>;
export const useSearchKey = 'Search';
export const UseSearchKeyFn = (mutationKey?: Array<unknown>) => [
  useSearchKey,
  ...(mutationKey ?? []),
];
export type MultiLingualWebSearchMutationResult = Awaited<ReturnType<typeof multiLingualWebSearch>>;
export const useMultiLingualWebSearchKey = 'MultiLingualWebSearch';
export const UseMultiLingualWebSearchKeyFn = (mutationKey?: Array<unknown>) => [
  useMultiLingualWebSearchKey,
  ...(mutationKey ?? []),
];
export type CreateProviderMutationResult = Awaited<ReturnType<typeof createProvider>>;
export const useCreateProviderKey = 'CreateProvider';
export const UseCreateProviderKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateProviderKey,
  ...(mutationKey ?? []),
];
export type UpdateProviderMutationResult = Awaited<ReturnType<typeof updateProvider>>;
export const useUpdateProviderKey = 'UpdateProvider';
export const UseUpdateProviderKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateProviderKey,
  ...(mutationKey ?? []),
];
export type DeleteProviderMutationResult = Awaited<ReturnType<typeof deleteProvider>>;
export const useDeleteProviderKey = 'DeleteProvider';
export const UseDeleteProviderKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteProviderKey,
  ...(mutationKey ?? []),
];
export type TestProviderConnectionMutationResult = Awaited<
  ReturnType<typeof testProviderConnection>
>;
export const useTestProviderConnectionKey = 'TestProviderConnection';
export const UseTestProviderConnectionKeyFn = (mutationKey?: Array<unknown>) => [
  useTestProviderConnectionKey,
  ...(mutationKey ?? []),
];
export type CreateProviderItemMutationResult = Awaited<ReturnType<typeof createProviderItem>>;
export const useCreateProviderItemKey = 'CreateProviderItem';
export const UseCreateProviderItemKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateProviderItemKey,
  ...(mutationKey ?? []),
];
export type BatchCreateProviderItemsMutationResult = Awaited<
  ReturnType<typeof batchCreateProviderItems>
>;
export const useBatchCreateProviderItemsKey = 'BatchCreateProviderItems';
export const UseBatchCreateProviderItemsKeyFn = (mutationKey?: Array<unknown>) => [
  useBatchCreateProviderItemsKey,
  ...(mutationKey ?? []),
];
export type UpdateProviderItemMutationResult = Awaited<ReturnType<typeof updateProviderItem>>;
export const useUpdateProviderItemKey = 'UpdateProviderItem';
export const UseUpdateProviderItemKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateProviderItemKey,
  ...(mutationKey ?? []),
];
export type BatchUpdateProviderItemsMutationResult = Awaited<
  ReturnType<typeof batchUpdateProviderItems>
>;
export const useBatchUpdateProviderItemsKey = 'BatchUpdateProviderItems';
export const UseBatchUpdateProviderItemsKeyFn = (mutationKey?: Array<unknown>) => [
  useBatchUpdateProviderItemsKey,
  ...(mutationKey ?? []),
];
export type DeleteProviderItemMutationResult = Awaited<ReturnType<typeof deleteProviderItem>>;
export const useDeleteProviderItemKey = 'DeleteProviderItem';
export const UseDeleteProviderItemKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteProviderItemKey,
  ...(mutationKey ?? []),
];
export type CreateToolsetMutationResult = Awaited<ReturnType<typeof createToolset>>;
export const useCreateToolsetKey = 'CreateToolset';
export const UseCreateToolsetKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateToolsetKey,
  ...(mutationKey ?? []),
];
export type UpdateToolsetMutationResult = Awaited<ReturnType<typeof updateToolset>>;
export const useUpdateToolsetKey = 'UpdateToolset';
export const UseUpdateToolsetKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateToolsetKey,
  ...(mutationKey ?? []),
];
export type DeleteToolsetMutationResult = Awaited<ReturnType<typeof deleteToolset>>;
export const useDeleteToolsetKey = 'DeleteToolset';
export const UseDeleteToolsetKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteToolsetKey,
  ...(mutationKey ?? []),
];
export type ExecuteToolMutationResult = Awaited<ReturnType<typeof executeTool>>;
export const useExecuteToolKey = 'ExecuteTool';
export const UseExecuteToolKeyFn = (mutationKey?: Array<unknown>) => [
  useExecuteToolKey,
  ...(mutationKey ?? []),
];
export type AuthorizeComposioConnectionMutationResult = Awaited<
  ReturnType<typeof authorizeComposioConnection>
>;
export const useAuthorizeComposioConnectionKey = 'AuthorizeComposioConnection';
export const UseAuthorizeComposioConnectionKeyFn = (mutationKey?: Array<unknown>) => [
  useAuthorizeComposioConnectionKey,
  ...(mutationKey ?? []),
];
export type RevokeComposioConnectionMutationResult = Awaited<
  ReturnType<typeof revokeComposioConnection>
>;
export const useRevokeComposioConnectionKey = 'RevokeComposioConnection';
export const UseRevokeComposioConnectionKeyFn = (mutationKey?: Array<unknown>) => [
  useRevokeComposioConnectionKey,
  ...(mutationKey ?? []),
];
export type ScrapeMutationResult = Awaited<ReturnType<typeof scrape>>;
export const useScrapeKey = 'Scrape';
export const UseScrapeKeyFn = (mutationKey?: Array<unknown>) => [
  useScrapeKey,
  ...(mutationKey ?? []),
];
export type UploadMutationResult = Awaited<ReturnType<typeof upload>>;
export const useUploadKey = 'Upload';
export const UseUploadKeyFn = (mutationKey?: Array<unknown>) => [
  useUploadKey,
  ...(mutationKey ?? []),
];
export type ConvertMutationResult = Awaited<ReturnType<typeof convert>>;
export const useConvertKey = 'Convert';
export const UseConvertKeyFn = (mutationKey?: Array<unknown>) => [
  useConvertKey,
  ...(mutationKey ?? []),
];
export type ValidateVoucherMutationResult = Awaited<ReturnType<typeof validateVoucher>>;
export const useValidateVoucherKey = 'ValidateVoucher';
export const UseValidateVoucherKeyFn = (mutationKey?: Array<unknown>) => [
  useValidateVoucherKey,
  ...(mutationKey ?? []),
];
export type CreateVoucherInvitationMutationResult = Awaited<
  ReturnType<typeof createVoucherInvitation>
>;
export const useCreateVoucherInvitationKey = 'CreateVoucherInvitation';
export const UseCreateVoucherInvitationKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateVoucherInvitationKey,
  ...(mutationKey ?? []),
];
export type ClaimVoucherInvitationMutationResult = Awaited<
  ReturnType<typeof claimVoucherInvitation>
>;
export const useClaimVoucherInvitationKey = 'ClaimVoucherInvitation';
export const UseClaimVoucherInvitationKeyFn = (mutationKey?: Array<unknown>) => [
  useClaimVoucherInvitationKey,
  ...(mutationKey ?? []),
];
export type TriggerVoucherMutationResult = Awaited<ReturnType<typeof triggerVoucher>>;
export const useTriggerVoucherKey = 'TriggerVoucher';
export const UseTriggerVoucherKeyFn = (mutationKey?: Array<unknown>) => [
  useTriggerVoucherKey,
  ...(mutationKey ?? []),
];
export type UpdateSettingsMutationResult = Awaited<ReturnType<typeof updateSettings>>;
export const useUpdateSettingsKey = 'UpdateSettings';
export const UseUpdateSettingsKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateSettingsKey,
  ...(mutationKey ?? []),
];
export type UpdateCliApiKeyMutationResult = Awaited<ReturnType<typeof updateCliApiKey>>;
export const useUpdateCliApiKeyKey = 'UpdateCliApiKey';
export const UseUpdateCliApiKeyKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateCliApiKeyKey,
  ...(mutationKey ?? []),
];
export type RevokeCliApiKeyMutationResult = Awaited<ReturnType<typeof revokeCliApiKey>>;
export const useRevokeCliApiKeyKey = 'RevokeCliApiKey';
export const UseRevokeCliApiKeyKeyFn = (mutationKey?: Array<unknown>) => [
  useRevokeCliApiKeyKey,
  ...(mutationKey ?? []),
];
