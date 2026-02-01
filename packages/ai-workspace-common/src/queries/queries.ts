// @ts-nocheck
// generated with @7nohe/openapi-react-query-codegen@2.0.0-beta.3

import { type Options } from '@hey-api/client-fetch';
import { useMutation, UseMutationOptions, useQuery, UseQueryOptions } from '@tanstack/react-query';
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
import {
  AbortActionData,
  AbortActionError,
  AbortWorkflowData,
  AbortWorkflowError,
  AbortWorkflowViaApiData,
  AbortWorkflowViaApiError,
  ActivateInvitationCodeData,
  ActivateInvitationCodeError,
  AuthorizeComposioConnectionData,
  AuthorizeComposioConnectionError,
  AutoNameCanvasData,
  AutoNameCanvasError,
  BatchCreateDriveFilesData,
  BatchCreateDriveFilesError,
  BatchCreateProviderItemsData,
  BatchCreateProviderItemsError,
  BatchCreateResourceData,
  BatchCreateResourceError,
  BatchUpdateDocumentData,
  BatchUpdateDocumentError,
  BatchUpdateProviderItemsData,
  BatchUpdateProviderItemsError,
  CheckSettingsFieldData,
  CheckSettingsFieldError,
  CheckToolOauthStatusData,
  CheckToolOauthStatusError,
  CheckVerificationData,
  CheckVerificationError,
  ClaimVoucherInvitationData,
  ClaimVoucherInvitationError,
  ConvertData,
  ConvertError,
  CreateCanvasData,
  CreateCanvasError,
  CreateCanvasTemplateData,
  CreateCanvasTemplateError,
  CreateCanvasVersionData,
  CreateCanvasVersionError,
  CreateCheckoutSessionData,
  CreateCheckoutSessionError,
  CreateCliApiKeyData,
  CreateCliApiKeyError,
  CreateCodeArtifactData,
  CreateCodeArtifactError,
  CreateCreditPackCheckoutSessionData,
  CreateCreditPackCheckoutSessionError,
  CreateDocumentData,
  CreateDocumentError,
  CreateDriveFileData,
  CreateDriveFileError,
  CreateMcpServerData,
  CreateMcpServerError,
  CreatePortalSessionError,
  CreateProviderData,
  CreateProviderError,
  CreateProviderItemData,
  CreateProviderItemError,
  CreateResourceData,
  CreateResourceError,
  CreateResourceWithFileData,
  CreateResourceWithFileError,
  CreateScheduleData,
  CreateScheduleError,
  CreateShareData,
  CreateShareError,
  CreateToolsetData,
  CreateToolsetError,
  CreateVerificationData,
  CreateVerificationError,
  CreateVoucherInvitationData,
  CreateVoucherInvitationError,
  CreateWorkflowAppData,
  CreateWorkflowAppError,
  DeleteCanvasData,
  DeleteCanvasError,
  DeleteDocumentData,
  DeleteDocumentError,
  DeleteDriveFileData,
  DeleteDriveFileError,
  DeleteMcpServerData,
  DeleteMcpServerError,
  DeleteProviderData,
  DeleteProviderError,
  DeleteProviderItemData,
  DeleteProviderItemError,
  DeleteResourceData,
  DeleteResourceError,
  DeleteScheduleData,
  DeleteScheduleError,
  DeleteShareData,
  DeleteShareError,
  DeleteToolsetData,
  DeleteToolsetError,
  DeleteWorkflowAppData,
  DeleteWorkflowAppError,
  DisableWebhookData,
  DisableWebhookError,
  DownloadExportJobResultData,
  DownloadExportJobResultError,
  DuplicateCanvasData,
  DuplicateCanvasError,
  DuplicateShareData,
  DuplicateShareError,
  EmailLoginData,
  EmailLoginError,
  EmailSignupData,
  EmailSignupError,
  EnableWebhookData,
  EnableWebhookError,
  ExecuteToolData,
  ExecuteToolError,
  ExecuteWorkflowAppData,
  ExecuteWorkflowAppError,
  ExportCanvasData,
  ExportCanvasError,
  ExportDocumentData,
  ExportDocumentError,
  ExportToolsetDefinitionsData,
  ExportToolsetDefinitionsError,
  ExtractVariablesData,
  ExtractVariablesError,
  GenerateAppTemplateData,
  GenerateAppTemplateError,
  GenerateMediaData,
  GenerateMediaError,
  GenerateWorkflowViaCopilotData,
  GenerateWorkflowViaCopilotError,
  GetActionResultData,
  GetActionResultError,
  GetAuthConfigError,
  GetAvailableToolsError,
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
  GetRecordSnapshotData,
  GetRecordSnapshotError,
  GetResourceDetailData,
  GetResourceDetailError,
  GetScheduleDetailData,
  GetScheduleDetailError,
  GetScheduleRecordDetailData,
  GetScheduleRecordDetailError,
  GetScheduleRecordsData,
  GetScheduleRecordsError,
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
  ImportCanvasData,
  ImportCanvasError,
  InitializeWorkflowData,
  InitializeWorkflowError,
  InvokeSkillData,
  InvokeSkillError,
  ListAccountsData,
  ListAccountsError,
  ListAllScheduleRecordsData,
  ListAllScheduleRecordsError,
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
  ListSchedulesData,
  ListSchedulesError,
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
  LogoutError,
  MultiLingualWebSearchData,
  MultiLingualWebSearchError,
  RefreshTokenError,
  ReindexResourceData,
  ReindexResourceError,
  ResendVerificationData,
  ResendVerificationError,
  ResetWebhookData,
  ResetWebhookError,
  RetryScheduleRecordData,
  RetryScheduleRecordError,
  RevokeCliApiKeyData,
  RevokeCliApiKeyError,
  RevokeComposioConnectionData,
  RevokeComposioConnectionError,
  RunWebhookData,
  RunWebhookError,
  RunWorkflowViaApiData,
  RunWorkflowViaApiError,
  ScrapeData,
  ScrapeError,
  SearchData,
  SearchError,
  SearchWorkflowsViaApiData,
  SearchWorkflowsViaApiError,
  ServeStaticError,
  SetCanvasStateData,
  SetCanvasStateError,
  SkipInvitationCodeError,
  StartExportJobData,
  StartExportJobError,
  StreamInvokeSkillData,
  StreamInvokeSkillError,
  SubmitFormData,
  SubmitFormError,
  SyncCanvasStateData,
  SyncCanvasStateError,
  TestProviderConnectionData,
  TestProviderConnectionError,
  TriggerScheduleManuallyData,
  TriggerScheduleManuallyError,
  TriggerVoucherData,
  TriggerVoucherError,
  UpdateCanvasData,
  UpdateCanvasError,
  UpdateCanvasTemplateData,
  UpdateCanvasTemplateError,
  UpdateCliApiKeyData,
  UpdateCliApiKeyError,
  UpdateCodeArtifactData,
  UpdateCodeArtifactError,
  UpdateDocumentData,
  UpdateDocumentError,
  UpdateDriveFileData,
  UpdateDriveFileError,
  UpdateMcpServerData,
  UpdateMcpServerError,
  UpdateOpenapiConfigData,
  UpdateOpenapiConfigError,
  UpdateProviderData,
  UpdateProviderError,
  UpdateProviderItemData,
  UpdateProviderItemError,
  UpdateResourceData,
  UpdateResourceError,
  UpdateScheduleData,
  UpdateScheduleError,
  UpdateSettingsData,
  UpdateSettingsError,
  UpdateToolsetData,
  UpdateToolsetError,
  UpdateWebhookData,
  UpdateWebhookError,
  UpdateWorkflowVariablesData,
  UpdateWorkflowVariablesError,
  UploadData,
  UploadError,
  UploadOpenapiFilesData,
  UploadOpenapiFilesError,
  ValidateMcpServerData,
  ValidateMcpServerError,
  ValidateVoucherData,
  ValidateVoucherError,
  VerifyVoucherInvitationData,
  VerifyVoucherInvitationError,
} from '@refly/openapi-schema';
import * as Common from './common';
export const useListMcpServers = <
  TData = Common.ListMcpServersDefaultResponse,
  TError = ListMcpServersError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListMcpServersData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListMcpServersKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listMcpServers({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetAuthConfig = <
  TData = Common.GetAuthConfigDefaultResponse,
  TError = GetAuthConfigError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetAuthConfigKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getAuthConfig({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListAccounts = <
  TData = Common.ListAccountsDefaultResponse,
  TError = ListAccountsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListAccountsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListAccountsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listAccounts({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useCheckToolOauthStatus = <
  TData = Common.CheckToolOauthStatusDefaultResponse,
  TError = CheckToolOauthStatusError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<CheckToolOauthStatusData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseCheckToolOauthStatusKeyFn(clientOptions, queryKey),
    queryFn: () =>
      checkToolOauthStatus({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListCliApiKeys = <
  TData = Common.ListCliApiKeysDefaultResponse,
  TError = ListCliApiKeysError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListCliApiKeysKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listCliApiKeys({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCollabToken = <
  TData = Common.GetCollabTokenDefaultResponse,
  TError = GetCollabTokenError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCollabTokenKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCollabToken({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListCanvases = <
  TData = Common.ListCanvasesDefaultResponse,
  TError = ListCanvasesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListCanvasesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListCanvasesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listCanvases({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCanvasDetail = <
  TData = Common.GetCanvasDetailDefaultResponse,
  TError = GetCanvasDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCanvasDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCanvasDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCanvasDetail({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCanvasData = <
  TData = Common.GetCanvasDataDefaultResponse,
  TError = GetCanvasDataError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCanvasDataData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCanvasDataKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCanvasData({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useExportCanvas = <
  TData = Common.ExportCanvasDefaultResponse,
  TError = ExportCanvasError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ExportCanvasData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseExportCanvasKeyFn(clientOptions, queryKey),
    queryFn: () =>
      exportCanvas({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCanvasState = <
  TData = Common.GetCanvasStateDefaultResponse,
  TError = GetCanvasStateError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCanvasStateData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCanvasStateKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCanvasState({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCanvasTransactions = <
  TData = Common.GetCanvasTransactionsDefaultResponse,
  TError = GetCanvasTransactionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCanvasTransactionsData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCanvasTransactionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCanvasTransactions({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWorkflowVariables = <
  TData = Common.GetWorkflowVariablesDefaultResponse,
  TError = GetWorkflowVariablesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowVariablesData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowVariablesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowVariables({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListDriveFiles = <
  TData = Common.ListDriveFilesDefaultResponse,
  TError = ListDriveFilesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListDriveFilesData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListDriveFilesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listDriveFiles({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListCanvasTemplates = <
  TData = Common.ListCanvasTemplatesDefaultResponse,
  TError = ListCanvasTemplatesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListCanvasTemplatesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListCanvasTemplatesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listCanvasTemplates({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListCanvasTemplateCategories = <
  TData = Common.ListCanvasTemplateCategoriesDefaultResponse,
  TError = ListCanvasTemplateCategoriesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListCanvasTemplateCategoriesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listCanvasTemplateCategories({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListResources = <
  TData = Common.ListResourcesDefaultResponse,
  TError = ListResourcesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListResourcesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListResourcesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listResources({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetResourceDetail = <
  TData = Common.GetResourceDetailDefaultResponse,
  TError = GetResourceDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetResourceDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetResourceDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getResourceDetail({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListDocuments = <
  TData = Common.ListDocumentsDefaultResponse,
  TError = ListDocumentsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListDocumentsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListDocumentsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listDocuments({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetDocumentDetail = <
  TData = Common.GetDocumentDetailDefaultResponse,
  TError = GetDocumentDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetDocumentDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetDocumentDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getDocumentDetail({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useExportDocument = <
  TData = Common.ExportDocumentDefaultResponse,
  TError = ExportDocumentError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ExportDocumentData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseExportDocumentKeyFn(clientOptions, queryKey),
    queryFn: () =>
      exportDocument({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetExportJobStatus = <
  TData = Common.GetExportJobStatusDefaultResponse,
  TError = GetExportJobStatusError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetExportJobStatusData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetExportJobStatusKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getExportJobStatus({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useDownloadExportJobResult = <
  TData = Common.DownloadExportJobResultDefaultResponse,
  TError = DownloadExportJobResultError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<DownloadExportJobResultData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseDownloadExportJobResultKeyFn(clientOptions, queryKey),
    queryFn: () =>
      downloadExportJobResult({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListCodeArtifacts = <
  TData = Common.ListCodeArtifactsDefaultResponse,
  TError = ListCodeArtifactsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListCodeArtifactsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListCodeArtifactsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listCodeArtifacts({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCodeArtifactDetail = <
  TData = Common.GetCodeArtifactDetailDefaultResponse,
  TError = GetCodeArtifactDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCodeArtifactDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCodeArtifactDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCodeArtifactDetail({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListShares = <
  TData = Common.ListSharesDefaultResponse,
  TError = ListSharesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListSharesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListSharesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listShares({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetActionResult = <
  TData = Common.GetActionResultDefaultResponse,
  TError = GetActionResultError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetActionResultData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetActionResultKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getActionResult({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListCopilotSessions = <
  TData = Common.ListCopilotSessionsDefaultResponse,
  TError = ListCopilotSessionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListCopilotSessionsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListCopilotSessionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listCopilotSessions({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCopilotSessionDetail = <
  TData = Common.GetCopilotSessionDetailDefaultResponse,
  TError = GetCopilotSessionDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCopilotSessionDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCopilotSessionDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCopilotSessionDetail({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListWorkflowExecutions = <
  TData = Common.ListWorkflowExecutionsDefaultResponse,
  TError = ListWorkflowExecutionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListWorkflowExecutionsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListWorkflowExecutionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listWorkflowExecutions({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWorkflowDetail = <
  TData = Common.GetWorkflowDetailDefaultResponse,
  TError = GetWorkflowDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowDetail({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetWorkflowPlanDetail = <
  TData = Common.GetWorkflowPlanDetailDefaultResponse,
  TError = GetWorkflowPlanDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowPlanDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowPlanDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowPlanDetail({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWorkflowAppDetail = <
  TData = Common.GetWorkflowAppDetailDefaultResponse,
  TError = GetWorkflowAppDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowAppDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowAppDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowAppDetail({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListWorkflowApps = <
  TData = Common.ListWorkflowAppsDefaultResponse,
  TError = ListWorkflowAppsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListWorkflowAppsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListWorkflowAppsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listWorkflowApps({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetTemplateGenerationStatus = <
  TData = Common.GetTemplateGenerationStatusDefaultResponse,
  TError = GetTemplateGenerationStatusError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetTemplateGenerationStatusData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetTemplateGenerationStatusKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getTemplateGenerationStatus({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWebhookConfig = <
  TData = Common.GetWebhookConfigDefaultResponse,
  TError = GetWebhookConfigError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWebhookConfigData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetWebhookConfigKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWebhookConfig({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetWebhookHistory = <
  TData = Common.GetWebhookHistoryDefaultResponse,
  TError = GetWebhookHistoryError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWebhookHistoryData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetWebhookHistoryKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWebhookHistory({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetOpenapiConfig = <
  TData = Common.GetOpenapiConfigDefaultResponse,
  TError = GetOpenapiConfigError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetOpenapiConfigData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetOpenapiConfigKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getOpenapiConfig({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useSearchWorkflowsViaApi = <
  TData = Common.SearchWorkflowsViaApiDefaultResponse,
  TError = SearchWorkflowsViaApiError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<SearchWorkflowsViaApiData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSearchWorkflowsViaApiKeyFn(clientOptions, queryKey),
    queryFn: () =>
      searchWorkflowsViaApi({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWorkflowDetailViaApi = <
  TData = Common.GetWorkflowDetailViaApiDefaultResponse,
  TError = GetWorkflowDetailViaApiError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowDetailViaApiData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowDetailViaApiKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowDetailViaApi({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWorkflowStatusViaApi = <
  TData = Common.GetWorkflowStatusViaApiDefaultResponse,
  TError = GetWorkflowStatusViaApiError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowStatusViaApiData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowStatusViaApiKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowStatusViaApi({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetWorkflowOutput = <
  TData = Common.GetWorkflowOutputDefaultResponse,
  TError = GetWorkflowOutputError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWorkflowOutputData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetWorkflowOutputKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getWorkflowOutput({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetSettings = <
  TData = Common.GetSettingsDefaultResponse,
  TError = GetSettingsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetSettingsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getSettings({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useCheckSettingsField = <
  TData = Common.CheckSettingsFieldDefaultResponse,
  TError = CheckSettingsFieldError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<CheckSettingsFieldData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseCheckSettingsFieldKeyFn(clientOptions, queryKey),
    queryFn: () =>
      checkSettingsField({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetFormDefinition = <
  TData = Common.GetFormDefinitionDefaultResponse,
  TError = GetFormDefinitionError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetFormDefinitionKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getFormDefinition({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCreditRecharge = <
  TData = Common.GetCreditRechargeDefaultResponse,
  TError = GetCreditRechargeError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCreditRechargeData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCreditRechargeKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCreditRecharge({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCreditUsage = <
  TData = Common.GetCreditUsageDefaultResponse,
  TError = GetCreditUsageError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCreditUsageData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCreditUsageKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCreditUsage({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCreditBalance = <
  TData = Common.GetCreditBalanceDefaultResponse,
  TError = GetCreditBalanceError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCreditBalanceKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCreditBalance({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetCreditUsageByResultId = <
  TData = Common.GetCreditUsageByResultIdDefaultResponse,
  TError = GetCreditUsageByResultIdError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCreditUsageByResultIdData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCreditUsageByResultIdKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCreditUsageByResultId({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetCreditUsageByExecutionId = <
  TData = Common.GetCreditUsageByExecutionIdDefaultResponse,
  TError = GetCreditUsageByExecutionIdError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCreditUsageByExecutionIdData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCreditUsageByExecutionIdKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCreditUsageByExecutionId({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetCreditUsageByCanvasId = <
  TData = Common.GetCreditUsageByCanvasIdDefaultResponse,
  TError = GetCreditUsageByCanvasIdError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCreditUsageByCanvasIdData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCreditUsageByCanvasIdKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCreditUsageByCanvasId({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetCanvasCommissionByCanvasId = <
  TData = Common.GetCanvasCommissionByCanvasIdDefaultResponse,
  TError = GetCanvasCommissionByCanvasIdError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCanvasCommissionByCanvasIdData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetCanvasCommissionByCanvasIdKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getCanvasCommissionByCanvasId({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListInvitationCodes = <
  TData = Common.ListInvitationCodesDefaultResponse,
  TError = ListInvitationCodesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListInvitationCodesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listInvitationCodes({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetSubscriptionPlans = <
  TData = Common.GetSubscriptionPlansDefaultResponse,
  TError = GetSubscriptionPlansError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetSubscriptionPlansKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getSubscriptionPlans({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetSubscriptionUsage = <
  TData = Common.GetSubscriptionUsageDefaultResponse,
  TError = GetSubscriptionUsageError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetSubscriptionUsageKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getSubscriptionUsage({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListModels = <
  TData = Common.ListModelsDefaultResponse,
  TError = ListModelsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListModelsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listModels({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListProviders = <
  TData = Common.ListProvidersDefaultResponse,
  TError = ListProvidersError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListProvidersData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListProvidersKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listProviders({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListProviderItems = <
  TData = Common.ListProviderItemsDefaultResponse,
  TError = ListProviderItemsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListProviderItemsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListProviderItemsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listProviderItems({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListProviderItemOptions = <
  TData = Common.ListProviderItemOptionsDefaultResponse,
  TError = ListProviderItemOptionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListProviderItemOptionsData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListProviderItemOptionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listProviderItemOptions({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListTools = <
  TData = Common.ListToolsDefaultResponse,
  TError = ListToolsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListToolsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListToolsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listTools({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListUserTools = <
  TData = Common.ListUserToolsDefaultResponse,
  TError = ListUserToolsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListUserToolsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listUserTools({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListToolsetInventory = <
  TData = Common.ListToolsetInventoryDefaultResponse,
  TError = ListToolsetInventoryError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListToolsetInventoryKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listToolsetInventory({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListToolsets = <
  TData = Common.ListToolsetsDefaultResponse,
  TError = ListToolsetsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListToolsetsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListToolsetsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listToolsets({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useExportToolsetDefinitions = <
  TData = Common.ExportToolsetDefinitionsDefaultResponse,
  TError = ExportToolsetDefinitionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ExportToolsetDefinitionsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseExportToolsetDefinitionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      exportToolsetDefinitions({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetToolCallResult = <
  TData = Common.GetToolCallResultDefaultResponse,
  TError = GetToolCallResultError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetToolCallResultData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetToolCallResultKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getToolCallResult({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetComposioConnectionStatus = <
  TData = Common.GetComposioConnectionStatusDefaultResponse,
  TError = GetComposioConnectionStatusError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetComposioConnectionStatusData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetComposioConnectionStatusKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getComposioConnectionStatus({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useServeStatic = <
  TData = Common.ServeStaticDefaultResponse,
  TError = ServeStaticError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseServeStaticKeyFn(clientOptions, queryKey),
    queryFn: () =>
      serveStatic({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetPromptSuggestions = <
  TData = Common.GetPromptSuggestionsDefaultResponse,
  TError = GetPromptSuggestionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetPromptSuggestionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getPromptSuggestions({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useGetAvailableVouchers = <
  TData = Common.GetAvailableVouchersDefaultResponse,
  TError = GetAvailableVouchersError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetAvailableVouchersKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getAvailableVouchers({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useListUserVouchers = <
  TData = Common.ListUserVouchersDefaultResponse,
  TError = ListUserVouchersError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListUserVouchersKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listUserVouchers({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useVerifyVoucherInvitation = <
  TData = Common.VerifyVoucherInvitationDefaultResponse,
  TError = VerifyVoucherInvitationError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<VerifyVoucherInvitationData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseVerifyVoucherInvitationKeyFn(clientOptions, queryKey),
    queryFn: () =>
      verifyVoucherInvitation({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
    ...options,
  });
export const useExtractVariables = <
  TData = Common.ExtractVariablesMutationResult,
  TError = ExtractVariablesError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ExtractVariablesData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ExtractVariablesData, true>, TContext>({
    mutationKey: Common.UseExtractVariablesKeyFn(mutationKey),
    mutationFn: (clientOptions) => extractVariables(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useGenerateAppTemplate = <
  TData = Common.GenerateAppTemplateMutationResult,
  TError = GenerateAppTemplateError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<GenerateAppTemplateData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<GenerateAppTemplateData, true>, TContext>({
    mutationKey: Common.UseGenerateAppTemplateKeyFn(mutationKey),
    mutationFn: (clientOptions) => generateAppTemplate(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateMcpServer = <
  TData = Common.CreateMcpServerMutationResult,
  TError = CreateMcpServerError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateMcpServerData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateMcpServerData, true>, TContext>({
    mutationKey: Common.UseCreateMcpServerKeyFn(mutationKey),
    mutationFn: (clientOptions) => createMcpServer(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateMcpServer = <
  TData = Common.UpdateMcpServerMutationResult,
  TError = UpdateMcpServerError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateMcpServerData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateMcpServerData, true>, TContext>({
    mutationKey: Common.UseUpdateMcpServerKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateMcpServer(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteMcpServer = <
  TData = Common.DeleteMcpServerMutationResult,
  TError = DeleteMcpServerError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteMcpServerData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteMcpServerData, true>, TContext>({
    mutationKey: Common.UseDeleteMcpServerKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteMcpServer(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useValidateMcpServer = <
  TData = Common.ValidateMcpServerMutationResult,
  TError = ValidateMcpServerError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ValidateMcpServerData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ValidateMcpServerData, true>, TContext>({
    mutationKey: Common.UseValidateMcpServerKeyFn(mutationKey),
    mutationFn: (clientOptions) => validateMcpServer(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useRefreshToken = <
  TData = Common.RefreshTokenMutationResult,
  TError = RefreshTokenError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<unknown, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<unknown, true>, TContext>({
    mutationKey: Common.UseRefreshTokenKeyFn(mutationKey),
    mutationFn: (clientOptions) => refreshToken(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useEmailSignup = <
  TData = Common.EmailSignupMutationResult,
  TError = EmailSignupError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<EmailSignupData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<EmailSignupData, true>, TContext>({
    mutationKey: Common.UseEmailSignupKeyFn(mutationKey),
    mutationFn: (clientOptions) => emailSignup(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useEmailLogin = <
  TData = Common.EmailLoginMutationResult,
  TError = EmailLoginError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<EmailLoginData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<EmailLoginData, true>, TContext>({
    mutationKey: Common.UseEmailLoginKeyFn(mutationKey),
    mutationFn: (clientOptions) => emailLogin(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateVerification = <
  TData = Common.CreateVerificationMutationResult,
  TError = CreateVerificationError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateVerificationData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateVerificationData, true>, TContext>({
    mutationKey: Common.UseCreateVerificationKeyFn(mutationKey),
    mutationFn: (clientOptions) => createVerification(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useResendVerification = <
  TData = Common.ResendVerificationMutationResult,
  TError = ResendVerificationError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ResendVerificationData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ResendVerificationData, true>, TContext>({
    mutationKey: Common.UseResendVerificationKeyFn(mutationKey),
    mutationFn: (clientOptions) => resendVerification(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCheckVerification = <
  TData = Common.CheckVerificationMutationResult,
  TError = CheckVerificationError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CheckVerificationData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CheckVerificationData, true>, TContext>({
    mutationKey: Common.UseCheckVerificationKeyFn(mutationKey),
    mutationFn: (clientOptions) => checkVerification(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useLogout = <
  TData = Common.LogoutMutationResult,
  TError = LogoutError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<unknown, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<unknown, true>, TContext>({
    mutationKey: Common.UseLogoutKeyFn(mutationKey),
    mutationFn: (clientOptions) => logout(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateCliApiKey = <
  TData = Common.CreateCliApiKeyMutationResult,
  TError = CreateCliApiKeyError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateCliApiKeyData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateCliApiKeyData, true>, TContext>({
    mutationKey: Common.UseCreateCliApiKeyKeyFn(mutationKey),
    mutationFn: (clientOptions) => createCliApiKey(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useImportCanvas = <
  TData = Common.ImportCanvasMutationResult,
  TError = ImportCanvasError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ImportCanvasData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ImportCanvasData, true>, TContext>({
    mutationKey: Common.UseImportCanvasKeyFn(mutationKey),
    mutationFn: (clientOptions) => importCanvas(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateCanvas = <
  TData = Common.CreateCanvasMutationResult,
  TError = CreateCanvasError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateCanvasData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateCanvasData, true>, TContext>({
    mutationKey: Common.UseCreateCanvasKeyFn(mutationKey),
    mutationFn: (clientOptions) => createCanvas(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDuplicateCanvas = <
  TData = Common.DuplicateCanvasMutationResult,
  TError = DuplicateCanvasError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DuplicateCanvasData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DuplicateCanvasData, true>, TContext>({
    mutationKey: Common.UseDuplicateCanvasKeyFn(mutationKey),
    mutationFn: (clientOptions) => duplicateCanvas(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateCanvas = <
  TData = Common.UpdateCanvasMutationResult,
  TError = UpdateCanvasError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateCanvasData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateCanvasData, true>, TContext>({
    mutationKey: Common.UseUpdateCanvasKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateCanvas(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteCanvas = <
  TData = Common.DeleteCanvasMutationResult,
  TError = DeleteCanvasError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteCanvasData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteCanvasData, true>, TContext>({
    mutationKey: Common.UseDeleteCanvasKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteCanvas(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useAutoNameCanvas = <
  TData = Common.AutoNameCanvasMutationResult,
  TError = AutoNameCanvasError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<AutoNameCanvasData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<AutoNameCanvasData, true>, TContext>({
    mutationKey: Common.UseAutoNameCanvasKeyFn(mutationKey),
    mutationFn: (clientOptions) => autoNameCanvas(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useSetCanvasState = <
  TData = Common.SetCanvasStateMutationResult,
  TError = SetCanvasStateError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<SetCanvasStateData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<SetCanvasStateData, true>, TContext>({
    mutationKey: Common.UseSetCanvasStateKeyFn(mutationKey),
    mutationFn: (clientOptions) => setCanvasState(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useSyncCanvasState = <
  TData = Common.SyncCanvasStateMutationResult,
  TError = SyncCanvasStateError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<SyncCanvasStateData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<SyncCanvasStateData, true>, TContext>({
    mutationKey: Common.UseSyncCanvasStateKeyFn(mutationKey),
    mutationFn: (clientOptions) => syncCanvasState(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateCanvasVersion = <
  TData = Common.CreateCanvasVersionMutationResult,
  TError = CreateCanvasVersionError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateCanvasVersionData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateCanvasVersionData, true>, TContext>({
    mutationKey: Common.UseCreateCanvasVersionKeyFn(mutationKey),
    mutationFn: (clientOptions) => createCanvasVersion(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateWorkflowVariables = <
  TData = Common.UpdateWorkflowVariablesMutationResult,
  TError = UpdateWorkflowVariablesError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateWorkflowVariablesData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateWorkflowVariablesData, true>, TContext>({
    mutationKey: Common.UseUpdateWorkflowVariablesKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      updateWorkflowVariables(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateDriveFile = <
  TData = Common.CreateDriveFileMutationResult,
  TError = CreateDriveFileError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateDriveFileData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateDriveFileData, true>, TContext>({
    mutationKey: Common.UseCreateDriveFileKeyFn(mutationKey),
    mutationFn: (clientOptions) => createDriveFile(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useBatchCreateDriveFiles = <
  TData = Common.BatchCreateDriveFilesMutationResult,
  TError = BatchCreateDriveFilesError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<BatchCreateDriveFilesData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<BatchCreateDriveFilesData, true>, TContext>({
    mutationKey: Common.UseBatchCreateDriveFilesKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      batchCreateDriveFiles(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateDriveFile = <
  TData = Common.UpdateDriveFileMutationResult,
  TError = UpdateDriveFileError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateDriveFileData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateDriveFileData, true>, TContext>({
    mutationKey: Common.UseUpdateDriveFileKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateDriveFile(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteDriveFile = <
  TData = Common.DeleteDriveFileMutationResult,
  TError = DeleteDriveFileError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteDriveFileData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteDriveFileData, true>, TContext>({
    mutationKey: Common.UseDeleteDriveFileKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteDriveFile(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateCanvasTemplate = <
  TData = Common.CreateCanvasTemplateMutationResult,
  TError = CreateCanvasTemplateError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateCanvasTemplateData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateCanvasTemplateData, true>, TContext>({
    mutationKey: Common.UseCreateCanvasTemplateKeyFn(mutationKey),
    mutationFn: (clientOptions) => createCanvasTemplate(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateCanvasTemplate = <
  TData = Common.UpdateCanvasTemplateMutationResult,
  TError = UpdateCanvasTemplateError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateCanvasTemplateData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateCanvasTemplateData, true>, TContext>({
    mutationKey: Common.UseUpdateCanvasTemplateKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateCanvasTemplate(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateResource = <
  TData = Common.UpdateResourceMutationResult,
  TError = UpdateResourceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateResourceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateResourceData, true>, TContext>({
    mutationKey: Common.UseUpdateResourceKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateResource(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateResource = <
  TData = Common.CreateResourceMutationResult,
  TError = CreateResourceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateResourceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateResourceData, true>, TContext>({
    mutationKey: Common.UseCreateResourceKeyFn(mutationKey),
    mutationFn: (clientOptions) => createResource(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateResourceWithFile = <
  TData = Common.CreateResourceWithFileMutationResult,
  TError = CreateResourceWithFileError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateResourceWithFileData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateResourceWithFileData, true>, TContext>({
    mutationKey: Common.UseCreateResourceWithFileKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      createResourceWithFile(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useBatchCreateResource = <
  TData = Common.BatchCreateResourceMutationResult,
  TError = BatchCreateResourceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<BatchCreateResourceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<BatchCreateResourceData, true>, TContext>({
    mutationKey: Common.UseBatchCreateResourceKeyFn(mutationKey),
    mutationFn: (clientOptions) => batchCreateResource(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useReindexResource = <
  TData = Common.ReindexResourceMutationResult,
  TError = ReindexResourceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ReindexResourceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ReindexResourceData, true>, TContext>({
    mutationKey: Common.UseReindexResourceKeyFn(mutationKey),
    mutationFn: (clientOptions) => reindexResource(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteResource = <
  TData = Common.DeleteResourceMutationResult,
  TError = DeleteResourceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteResourceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteResourceData, true>, TContext>({
    mutationKey: Common.UseDeleteResourceKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteResource(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useStartExportJob = <
  TData = Common.StartExportJobMutationResult,
  TError = StartExportJobError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<StartExportJobData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<StartExportJobData, true>, TContext>({
    mutationKey: Common.UseStartExportJobKeyFn(mutationKey),
    mutationFn: (clientOptions) => startExportJob(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateDocument = <
  TData = Common.UpdateDocumentMutationResult,
  TError = UpdateDocumentError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateDocumentData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateDocumentData, true>, TContext>({
    mutationKey: Common.UseUpdateDocumentKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateDocument(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateDocument = <
  TData = Common.CreateDocumentMutationResult,
  TError = CreateDocumentError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateDocumentData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateDocumentData, true>, TContext>({
    mutationKey: Common.UseCreateDocumentKeyFn(mutationKey),
    mutationFn: (clientOptions) => createDocument(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteDocument = <
  TData = Common.DeleteDocumentMutationResult,
  TError = DeleteDocumentError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteDocumentData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteDocumentData, true>, TContext>({
    mutationKey: Common.UseDeleteDocumentKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteDocument(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useBatchUpdateDocument = <
  TData = Common.BatchUpdateDocumentMutationResult,
  TError = BatchUpdateDocumentError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<BatchUpdateDocumentData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<BatchUpdateDocumentData, true>, TContext>({
    mutationKey: Common.UseBatchUpdateDocumentKeyFn(mutationKey),
    mutationFn: (clientOptions) => batchUpdateDocument(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateCodeArtifact = <
  TData = Common.CreateCodeArtifactMutationResult,
  TError = CreateCodeArtifactError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateCodeArtifactData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateCodeArtifactData, true>, TContext>({
    mutationKey: Common.UseCreateCodeArtifactKeyFn(mutationKey),
    mutationFn: (clientOptions) => createCodeArtifact(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateCodeArtifact = <
  TData = Common.UpdateCodeArtifactMutationResult,
  TError = UpdateCodeArtifactError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateCodeArtifactData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateCodeArtifactData, true>, TContext>({
    mutationKey: Common.UseUpdateCodeArtifactKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateCodeArtifact(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateShare = <
  TData = Common.CreateShareMutationResult,
  TError = CreateShareError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateShareData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateShareData, true>, TContext>({
    mutationKey: Common.UseCreateShareKeyFn(mutationKey),
    mutationFn: (clientOptions) => createShare(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteShare = <
  TData = Common.DeleteShareMutationResult,
  TError = DeleteShareError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteShareData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteShareData, true>, TContext>({
    mutationKey: Common.UseDeleteShareKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteShare(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDuplicateShare = <
  TData = Common.DuplicateShareMutationResult,
  TError = DuplicateShareError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DuplicateShareData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DuplicateShareData, true>, TContext>({
    mutationKey: Common.UseDuplicateShareKeyFn(mutationKey),
    mutationFn: (clientOptions) => duplicateShare(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useAbortAction = <
  TData = Common.AbortActionMutationResult,
  TError = AbortActionError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<AbortActionData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<AbortActionData, true>, TContext>({
    mutationKey: Common.UseAbortActionKeyFn(mutationKey),
    mutationFn: (clientOptions) => abortAction(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useInvokeSkill = <
  TData = Common.InvokeSkillMutationResult,
  TError = InvokeSkillError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<InvokeSkillData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<InvokeSkillData, true>, TContext>({
    mutationKey: Common.UseInvokeSkillKeyFn(mutationKey),
    mutationFn: (clientOptions) => invokeSkill(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useStreamInvokeSkill = <
  TData = Common.StreamInvokeSkillMutationResult,
  TError = StreamInvokeSkillError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<StreamInvokeSkillData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<StreamInvokeSkillData, true>, TContext>({
    mutationKey: Common.UseStreamInvokeSkillKeyFn(mutationKey),
    mutationFn: (clientOptions) => streamInvokeSkill(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useGenerateMedia = <
  TData = Common.GenerateMediaMutationResult,
  TError = GenerateMediaError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<GenerateMediaData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<GenerateMediaData, true>, TContext>({
    mutationKey: Common.UseGenerateMediaKeyFn(mutationKey),
    mutationFn: (clientOptions) => generateMedia(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useInitializeWorkflow = <
  TData = Common.InitializeWorkflowMutationResult,
  TError = InitializeWorkflowError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<InitializeWorkflowData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<InitializeWorkflowData, true>, TContext>({
    mutationKey: Common.UseInitializeWorkflowKeyFn(mutationKey),
    mutationFn: (clientOptions) => initializeWorkflow(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useAbortWorkflow = <
  TData = Common.AbortWorkflowMutationResult,
  TError = AbortWorkflowError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<AbortWorkflowData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<AbortWorkflowData, true>, TContext>({
    mutationKey: Common.UseAbortWorkflowKeyFn(mutationKey),
    mutationFn: (clientOptions) => abortWorkflow(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateWorkflowApp = <
  TData = Common.CreateWorkflowAppMutationResult,
  TError = CreateWorkflowAppError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateWorkflowAppData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateWorkflowAppData, true>, TContext>({
    mutationKey: Common.UseCreateWorkflowAppKeyFn(mutationKey),
    mutationFn: (clientOptions) => createWorkflowApp(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteWorkflowApp = <
  TData = Common.DeleteWorkflowAppMutationResult,
  TError = DeleteWorkflowAppError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteWorkflowAppData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteWorkflowAppData, true>, TContext>({
    mutationKey: Common.UseDeleteWorkflowAppKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteWorkflowApp(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useExecuteWorkflowApp = <
  TData = Common.ExecuteWorkflowAppMutationResult,
  TError = ExecuteWorkflowAppError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ExecuteWorkflowAppData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ExecuteWorkflowAppData, true>, TContext>({
    mutationKey: Common.UseExecuteWorkflowAppKeyFn(mutationKey),
    mutationFn: (clientOptions) => executeWorkflowApp(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateSchedule = <
  TData = Common.CreateScheduleMutationResult,
  TError = CreateScheduleError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateScheduleData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateScheduleData, true>, TContext>({
    mutationKey: Common.UseCreateScheduleKeyFn(mutationKey),
    mutationFn: (clientOptions) => createSchedule(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateSchedule = <
  TData = Common.UpdateScheduleMutationResult,
  TError = UpdateScheduleError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateScheduleData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateScheduleData, true>, TContext>({
    mutationKey: Common.UseUpdateScheduleKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateSchedule(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteSchedule = <
  TData = Common.DeleteScheduleMutationResult,
  TError = DeleteScheduleError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteScheduleData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteScheduleData, true>, TContext>({
    mutationKey: Common.UseDeleteScheduleKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteSchedule(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useListSchedules = <
  TData = Common.ListSchedulesMutationResult,
  TError = ListSchedulesError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ListSchedulesData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ListSchedulesData, true>, TContext>({
    mutationKey: Common.UseListSchedulesKeyFn(mutationKey),
    mutationFn: (clientOptions) => listSchedules(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useGetScheduleDetail = <
  TData = Common.GetScheduleDetailMutationResult,
  TError = GetScheduleDetailError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<GetScheduleDetailData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<GetScheduleDetailData, true>, TContext>({
    mutationKey: Common.UseGetScheduleDetailKeyFn(mutationKey),
    mutationFn: (clientOptions) => getScheduleDetail(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useGetScheduleRecords = <
  TData = Common.GetScheduleRecordsMutationResult,
  TError = GetScheduleRecordsError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<GetScheduleRecordsData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<GetScheduleRecordsData, true>, TContext>({
    mutationKey: Common.UseGetScheduleRecordsKeyFn(mutationKey),
    mutationFn: (clientOptions) => getScheduleRecords(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useListAllScheduleRecords = <
  TData = Common.ListAllScheduleRecordsMutationResult,
  TError = ListAllScheduleRecordsError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ListAllScheduleRecordsData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ListAllScheduleRecordsData, true>, TContext>({
    mutationKey: Common.UseListAllScheduleRecordsKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      listAllScheduleRecords(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useGetAvailableTools = <
  TData = Common.GetAvailableToolsMutationResult,
  TError = GetAvailableToolsError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<unknown, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<unknown, true>, TContext>({
    mutationKey: Common.UseGetAvailableToolsKeyFn(mutationKey),
    mutationFn: (clientOptions) => getAvailableTools(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useGetScheduleRecordDetail = <
  TData = Common.GetScheduleRecordDetailMutationResult,
  TError = GetScheduleRecordDetailError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<GetScheduleRecordDetailData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<GetScheduleRecordDetailData, true>, TContext>({
    mutationKey: Common.UseGetScheduleRecordDetailKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      getScheduleRecordDetail(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useGetRecordSnapshot = <
  TData = Common.GetRecordSnapshotMutationResult,
  TError = GetRecordSnapshotError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<GetRecordSnapshotData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<GetRecordSnapshotData, true>, TContext>({
    mutationKey: Common.UseGetRecordSnapshotKeyFn(mutationKey),
    mutationFn: (clientOptions) => getRecordSnapshot(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useTriggerScheduleManually = <
  TData = Common.TriggerScheduleManuallyMutationResult,
  TError = TriggerScheduleManuallyError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<TriggerScheduleManuallyData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<TriggerScheduleManuallyData, true>, TContext>({
    mutationKey: Common.UseTriggerScheduleManuallyKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      triggerScheduleManually(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useRetryScheduleRecord = <
  TData = Common.RetryScheduleRecordMutationResult,
  TError = RetryScheduleRecordError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<RetryScheduleRecordData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<RetryScheduleRecordData, true>, TContext>({
    mutationKey: Common.UseRetryScheduleRecordKeyFn(mutationKey),
    mutationFn: (clientOptions) => retryScheduleRecord(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useEnableWebhook = <
  TData = Common.EnableWebhookMutationResult,
  TError = EnableWebhookError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<EnableWebhookData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<EnableWebhookData, true>, TContext>({
    mutationKey: Common.UseEnableWebhookKeyFn(mutationKey),
    mutationFn: (clientOptions) => enableWebhook(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDisableWebhook = <
  TData = Common.DisableWebhookMutationResult,
  TError = DisableWebhookError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DisableWebhookData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DisableWebhookData, true>, TContext>({
    mutationKey: Common.UseDisableWebhookKeyFn(mutationKey),
    mutationFn: (clientOptions) => disableWebhook(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useResetWebhook = <
  TData = Common.ResetWebhookMutationResult,
  TError = ResetWebhookError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ResetWebhookData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ResetWebhookData, true>, TContext>({
    mutationKey: Common.UseResetWebhookKeyFn(mutationKey),
    mutationFn: (clientOptions) => resetWebhook(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateWebhook = <
  TData = Common.UpdateWebhookMutationResult,
  TError = UpdateWebhookError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateWebhookData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateWebhookData, true>, TContext>({
    mutationKey: Common.UseUpdateWebhookKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateWebhook(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useRunWebhook = <
  TData = Common.RunWebhookMutationResult,
  TError = RunWebhookError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<RunWebhookData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<RunWebhookData, true>, TContext>({
    mutationKey: Common.UseRunWebhookKeyFn(mutationKey),
    mutationFn: (clientOptions) => runWebhook(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateOpenapiConfig = <
  TData = Common.UpdateOpenapiConfigMutationResult,
  TError = UpdateOpenapiConfigError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateOpenapiConfigData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateOpenapiConfigData, true>, TContext>({
    mutationKey: Common.UseUpdateOpenapiConfigKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateOpenapiConfig(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUploadOpenapiFiles = <
  TData = Common.UploadOpenapiFilesMutationResult,
  TError = UploadOpenapiFilesError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UploadOpenapiFilesData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UploadOpenapiFilesData, true>, TContext>({
    mutationKey: Common.UseUploadOpenapiFilesKeyFn(mutationKey),
    mutationFn: (clientOptions) => uploadOpenapiFiles(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useRunWorkflowViaApi = <
  TData = Common.RunWorkflowViaApiMutationResult,
  TError = RunWorkflowViaApiError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<RunWorkflowViaApiData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<RunWorkflowViaApiData, true>, TContext>({
    mutationKey: Common.UseRunWorkflowViaApiKeyFn(mutationKey),
    mutationFn: (clientOptions) => runWorkflowViaApi(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useGenerateWorkflowViaCopilot = <
  TData = Common.GenerateWorkflowViaCopilotMutationResult,
  TError = GenerateWorkflowViaCopilotError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<GenerateWorkflowViaCopilotData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<GenerateWorkflowViaCopilotData, true>, TContext>({
    mutationKey: Common.UseGenerateWorkflowViaCopilotKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      generateWorkflowViaCopilot(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useAbortWorkflowViaApi = <
  TData = Common.AbortWorkflowViaApiMutationResult,
  TError = AbortWorkflowViaApiError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<AbortWorkflowViaApiData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<AbortWorkflowViaApiData, true>, TContext>({
    mutationKey: Common.UseAbortWorkflowViaApiKeyFn(mutationKey),
    mutationFn: (clientOptions) => abortWorkflowViaApi(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useSubmitForm = <
  TData = Common.SubmitFormMutationResult,
  TError = SubmitFormError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<SubmitFormData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<SubmitFormData, true>, TContext>({
    mutationKey: Common.UseSubmitFormKeyFn(mutationKey),
    mutationFn: (clientOptions) => submitForm(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useActivateInvitationCode = <
  TData = Common.ActivateInvitationCodeMutationResult,
  TError = ActivateInvitationCodeError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ActivateInvitationCodeData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ActivateInvitationCodeData, true>, TContext>({
    mutationKey: Common.UseActivateInvitationCodeKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      activateInvitationCode(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useSkipInvitationCode = <
  TData = Common.SkipInvitationCodeMutationResult,
  TError = SkipInvitationCodeError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<unknown, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<unknown, true>, TContext>({
    mutationKey: Common.UseSkipInvitationCodeKeyFn(mutationKey),
    mutationFn: (clientOptions) => skipInvitationCode(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateCheckoutSession = <
  TData = Common.CreateCheckoutSessionMutationResult,
  TError = CreateCheckoutSessionError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateCheckoutSessionData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateCheckoutSessionData, true>, TContext>({
    mutationKey: Common.UseCreateCheckoutSessionKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      createCheckoutSession(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateCreditPackCheckoutSession = <
  TData = Common.CreateCreditPackCheckoutSessionMutationResult,
  TError = CreateCreditPackCheckoutSessionError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateCreditPackCheckoutSessionData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateCreditPackCheckoutSessionData, true>, TContext>({
    mutationKey: Common.UseCreateCreditPackCheckoutSessionKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      createCreditPackCheckoutSession(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreatePortalSession = <
  TData = Common.CreatePortalSessionMutationResult,
  TError = CreatePortalSessionError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<unknown, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<unknown, true>, TContext>({
    mutationKey: Common.UseCreatePortalSessionKeyFn(mutationKey),
    mutationFn: (clientOptions) => createPortalSession(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useSearch = <
  TData = Common.SearchMutationResult,
  TError = SearchError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<SearchData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<SearchData, true>, TContext>({
    mutationKey: Common.UseSearchKeyFn(mutationKey),
    mutationFn: (clientOptions) => search(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useMultiLingualWebSearch = <
  TData = Common.MultiLingualWebSearchMutationResult,
  TError = MultiLingualWebSearchError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<MultiLingualWebSearchData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<MultiLingualWebSearchData, true>, TContext>({
    mutationKey: Common.UseMultiLingualWebSearchKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      multiLingualWebSearch(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateProvider = <
  TData = Common.CreateProviderMutationResult,
  TError = CreateProviderError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateProviderData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateProviderData, true>, TContext>({
    mutationKey: Common.UseCreateProviderKeyFn(mutationKey),
    mutationFn: (clientOptions) => createProvider(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateProvider = <
  TData = Common.UpdateProviderMutationResult,
  TError = UpdateProviderError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateProviderData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateProviderData, true>, TContext>({
    mutationKey: Common.UseUpdateProviderKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateProvider(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteProvider = <
  TData = Common.DeleteProviderMutationResult,
  TError = DeleteProviderError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteProviderData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteProviderData, true>, TContext>({
    mutationKey: Common.UseDeleteProviderKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteProvider(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useTestProviderConnection = <
  TData = Common.TestProviderConnectionMutationResult,
  TError = TestProviderConnectionError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<TestProviderConnectionData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<TestProviderConnectionData, true>, TContext>({
    mutationKey: Common.UseTestProviderConnectionKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      testProviderConnection(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateProviderItem = <
  TData = Common.CreateProviderItemMutationResult,
  TError = CreateProviderItemError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateProviderItemData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateProviderItemData, true>, TContext>({
    mutationKey: Common.UseCreateProviderItemKeyFn(mutationKey),
    mutationFn: (clientOptions) => createProviderItem(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useBatchCreateProviderItems = <
  TData = Common.BatchCreateProviderItemsMutationResult,
  TError = BatchCreateProviderItemsError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<BatchCreateProviderItemsData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<BatchCreateProviderItemsData, true>, TContext>({
    mutationKey: Common.UseBatchCreateProviderItemsKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      batchCreateProviderItems(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateProviderItem = <
  TData = Common.UpdateProviderItemMutationResult,
  TError = UpdateProviderItemError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateProviderItemData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateProviderItemData, true>, TContext>({
    mutationKey: Common.UseUpdateProviderItemKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateProviderItem(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useBatchUpdateProviderItems = <
  TData = Common.BatchUpdateProviderItemsMutationResult,
  TError = BatchUpdateProviderItemsError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<BatchUpdateProviderItemsData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<BatchUpdateProviderItemsData, true>, TContext>({
    mutationKey: Common.UseBatchUpdateProviderItemsKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      batchUpdateProviderItems(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteProviderItem = <
  TData = Common.DeleteProviderItemMutationResult,
  TError = DeleteProviderItemError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteProviderItemData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteProviderItemData, true>, TContext>({
    mutationKey: Common.UseDeleteProviderItemKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteProviderItem(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateToolset = <
  TData = Common.CreateToolsetMutationResult,
  TError = CreateToolsetError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateToolsetData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateToolsetData, true>, TContext>({
    mutationKey: Common.UseCreateToolsetKeyFn(mutationKey),
    mutationFn: (clientOptions) => createToolset(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateToolset = <
  TData = Common.UpdateToolsetMutationResult,
  TError = UpdateToolsetError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateToolsetData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateToolsetData, true>, TContext>({
    mutationKey: Common.UseUpdateToolsetKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateToolset(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteToolset = <
  TData = Common.DeleteToolsetMutationResult,
  TError = DeleteToolsetError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteToolsetData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteToolsetData, true>, TContext>({
    mutationKey: Common.UseDeleteToolsetKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteToolset(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useExecuteTool = <
  TData = Common.ExecuteToolMutationResult,
  TError = ExecuteToolError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ExecuteToolData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ExecuteToolData, true>, TContext>({
    mutationKey: Common.UseExecuteToolKeyFn(mutationKey),
    mutationFn: (clientOptions) => executeTool(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useAuthorizeComposioConnection = <
  TData = Common.AuthorizeComposioConnectionMutationResult,
  TError = AuthorizeComposioConnectionError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<AuthorizeComposioConnectionData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<AuthorizeComposioConnectionData, true>, TContext>({
    mutationKey: Common.UseAuthorizeComposioConnectionKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      authorizeComposioConnection(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useRevokeComposioConnection = <
  TData = Common.RevokeComposioConnectionMutationResult,
  TError = RevokeComposioConnectionError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<RevokeComposioConnectionData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<RevokeComposioConnectionData, true>, TContext>({
    mutationKey: Common.UseRevokeComposioConnectionKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      revokeComposioConnection(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useScrape = <
  TData = Common.ScrapeMutationResult,
  TError = ScrapeError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ScrapeData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ScrapeData, true>, TContext>({
    mutationKey: Common.UseScrapeKeyFn(mutationKey),
    mutationFn: (clientOptions) => scrape(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpload = <
  TData = Common.UploadMutationResult,
  TError = UploadError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UploadData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UploadData, true>, TContext>({
    mutationKey: Common.UseUploadKeyFn(mutationKey),
    mutationFn: (clientOptions) => upload(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useConvert = <
  TData = Common.ConvertMutationResult,
  TError = ConvertError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ConvertData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ConvertData, true>, TContext>({
    mutationKey: Common.UseConvertKeyFn(mutationKey),
    mutationFn: (clientOptions) => convert(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useValidateVoucher = <
  TData = Common.ValidateVoucherMutationResult,
  TError = ValidateVoucherError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ValidateVoucherData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ValidateVoucherData, true>, TContext>({
    mutationKey: Common.UseValidateVoucherKeyFn(mutationKey),
    mutationFn: (clientOptions) => validateVoucher(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateVoucherInvitation = <
  TData = Common.CreateVoucherInvitationMutationResult,
  TError = CreateVoucherInvitationError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateVoucherInvitationData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateVoucherInvitationData, true>, TContext>({
    mutationKey: Common.UseCreateVoucherInvitationKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      createVoucherInvitation(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useClaimVoucherInvitation = <
  TData = Common.ClaimVoucherInvitationMutationResult,
  TError = ClaimVoucherInvitationError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<ClaimVoucherInvitationData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<ClaimVoucherInvitationData, true>, TContext>({
    mutationKey: Common.UseClaimVoucherInvitationKeyFn(mutationKey),
    mutationFn: (clientOptions) =>
      claimVoucherInvitation(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useTriggerVoucher = <
  TData = Common.TriggerVoucherMutationResult,
  TError = TriggerVoucherError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<TriggerVoucherData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<TriggerVoucherData, true>, TContext>({
    mutationKey: Common.UseTriggerVoucherKeyFn(mutationKey),
    mutationFn: (clientOptions) => triggerVoucher(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateSettings = <
  TData = Common.UpdateSettingsMutationResult,
  TError = UpdateSettingsError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateSettingsData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateSettingsData, true>, TContext>({
    mutationKey: Common.UseUpdateSettingsKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateSettings(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateCliApiKey = <
  TData = Common.UpdateCliApiKeyMutationResult,
  TError = UpdateCliApiKeyError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateCliApiKeyData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateCliApiKeyData, true>, TContext>({
    mutationKey: Common.UseUpdateCliApiKeyKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateCliApiKey(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useRevokeCliApiKey = <
  TData = Common.RevokeCliApiKeyMutationResult,
  TError = RevokeCliApiKeyError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<RevokeCliApiKeyData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<RevokeCliApiKeyData, true>, TContext>({
    mutationKey: Common.UseRevokeCliApiKeyKeyFn(mutationKey),
    mutationFn: (clientOptions) => revokeCliApiKey(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
