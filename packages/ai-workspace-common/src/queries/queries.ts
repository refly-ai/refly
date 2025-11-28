// @ts-nocheck
// generated with @7nohe/openapi-react-query-codegen@2.0.0-beta.3

import { type Options } from '@hey-api/client-fetch';
import { useMutation, UseMutationOptions, useQuery, UseQueryOptions } from '@tanstack/react-query';
import {
  abortAction,
  abortWorkflow,
  activateInvitationCode,
  addNodesToCanvasPage,
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
  convert,
  createCanvas,
  createCanvasTemplate,
  createCanvasVersion,
  createCheckoutSession,
  createCodeArtifact,
  createCreditPackCheckoutSession,
  createDocument,
  createDriveFile,
  createLabelClass,
  createLabelInstance,
  createMcpServer,
  createPilotSession,
  createPortalSession,
  createProject,
  createProvider,
  createProviderItem,
  createResource,
  createResourceWithFile,
  createShare,
  createSkillInstance,
  createSkillTrigger,
  createToolset,
  createVerification,
  createWorkflowApp,
  deleteCanvas,
  deleteDocument,
  deleteDriveFile,
  deleteLabelClass,
  deleteLabelInstance,
  deleteMcpServer,
  deletePage,
  deletePageNode,
  deleteProject,
  deleteProjectItems,
  deleteProvider,
  deleteProviderItem,
  deleteResource,
  deleteShare,
  deleteSkillInstance,
  deleteSkillTrigger,
  deleteToolset,
  deleteWorkflowApp,
  duplicateCanvas,
  duplicateShare,
  emailLogin,
  emailSignup,
  executeWorkflowApp,
  exportCanvas,
  exportDocument,
  extractVariables,
  generateAppTemplate,
  generateMedia,
  getActionResult,
  getAuthConfig,
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
  getFormDefinition,
  getPageByCanvasId,
  getPageDetail,
  getPilotSessionDetail,
  getProjectDetail,
  getResourceDetail,
  getSettings,
  getSubscriptionPlans,
  getSubscriptionUsage,
  getToolCallResult,
  getWorkflowAppDetail,
  getWorkflowDetail,
  getWorkflowVariables,
  hasBeenInvited,
  hasFilledForm,
  importCanvas,
  initializeWorkflow,
  invokeSkill,
  listAccounts,
  listActions,
  listCanvases,
  listCanvasTemplateCategories,
  listCanvasTemplates,
  listCodeArtifacts,
  listCopilotSessions,
  listDocuments,
  listDriveFiles,
  listInvitationCodes,
  listLabelClasses,
  listLabelInstances,
  listMcpServers,
  listModels,
  listPages,
  listPilotSessions,
  listProjects,
  listProviderItemOptions,
  listProviderItems,
  listProviders,
  listResources,
  listShares,
  listSkillInstances,
  listSkills,
  listSkillTriggers,
  listTools,
  listToolsetInventory,
  listToolsets,
  listUserTools,
  listWorkflowApps,
  logout,
  multiLingualWebSearch,
  pinSkillInstance,
  recoverPilotSession,
  refreshToken,
  reindexResource,
  resendVerification,
  revokeComposioConnection,
  scrape,
  search,
  serveStatic,
  setCanvasState,
  sharePage,
  streamInvokeSkill,
  submitForm,
  syncCanvasState,
  testProviderConnection,
  unpinSkillInstance,
  updateCanvas,
  updateCanvasTemplate,
  updateCodeArtifact,
  updateDocument,
  updateDriveFile,
  updateLabelClass,
  updateLabelInstance,
  updateMcpServer,
  updatePage,
  updatePilotSession,
  updateProject,
  updateProjectItems,
  updateProvider,
  updateProviderItem,
  updateResource,
  updateSettings,
  updateSkillInstance,
  updateSkillTrigger,
  updateToolset,
  updateWorkflowVariables,
  upload,
  validateMcpServer,
} from '../requests/services.gen';
import {
  AbortActionData,
  AbortActionError,
  AbortWorkflowData,
  AbortWorkflowError,
  ActivateInvitationCodeData,
  ActivateInvitationCodeError,
  AddNodesToCanvasPageData,
  AddNodesToCanvasPageError,
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
  CreateCodeArtifactData,
  CreateCodeArtifactError,
  CreateCreditPackCheckoutSessionData,
  CreateCreditPackCheckoutSessionError,
  CreateDocumentData,
  CreateDocumentError,
  CreateDriveFileData,
  CreateDriveFileError,
  CreateLabelClassData,
  CreateLabelClassError,
  CreateLabelInstanceData,
  CreateLabelInstanceError,
  CreateMcpServerData,
  CreateMcpServerError,
  CreatePilotSessionData,
  CreatePilotSessionError,
  CreatePortalSessionError,
  CreateProjectData,
  CreateProjectError,
  CreateProviderData,
  CreateProviderError,
  CreateProviderItemData,
  CreateProviderItemError,
  CreateResourceData,
  CreateResourceError,
  CreateResourceWithFileData,
  CreateResourceWithFileError,
  CreateShareData,
  CreateShareError,
  CreateSkillInstanceData,
  CreateSkillInstanceError,
  CreateSkillTriggerData,
  CreateSkillTriggerError,
  CreateToolsetData,
  CreateToolsetError,
  CreateVerificationData,
  CreateVerificationError,
  CreateWorkflowAppData,
  CreateWorkflowAppError,
  DeleteCanvasData,
  DeleteCanvasError,
  DeleteDocumentData,
  DeleteDocumentError,
  DeleteDriveFileData,
  DeleteDriveFileError,
  DeleteLabelClassData,
  DeleteLabelClassError,
  DeleteLabelInstanceData,
  DeleteLabelInstanceError,
  DeleteMcpServerData,
  DeleteMcpServerError,
  DeletePageData,
  DeletePageError,
  DeletePageNodeData,
  DeletePageNodeError,
  DeleteProjectData,
  DeleteProjectError,
  DeleteProjectItemsData,
  DeleteProjectItemsError,
  DeleteProviderData,
  DeleteProviderError,
  DeleteProviderItemData,
  DeleteProviderItemError,
  DeleteResourceData,
  DeleteResourceError,
  DeleteShareData,
  DeleteShareError,
  DeleteSkillInstanceData,
  DeleteSkillInstanceError,
  DeleteSkillTriggerData,
  DeleteSkillTriggerError,
  DeleteToolsetData,
  DeleteToolsetError,
  DeleteWorkflowAppData,
  DeleteWorkflowAppError,
  DuplicateCanvasData,
  DuplicateCanvasError,
  DuplicateShareData,
  DuplicateShareError,
  EmailLoginData,
  EmailLoginError,
  EmailSignupData,
  EmailSignupError,
  ExecuteWorkflowAppData,
  ExecuteWorkflowAppError,
  ExportCanvasData,
  ExportCanvasError,
  ExportDocumentData,
  ExportDocumentError,
  ExtractVariablesData,
  ExtractVariablesError,
  GenerateAppTemplateData,
  GenerateAppTemplateError,
  GenerateMediaData,
  GenerateMediaError,
  GetActionResultData,
  GetActionResultError,
  GetAuthConfigError,
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
  GetFormDefinitionError,
  GetPageByCanvasIdData,
  GetPageByCanvasIdError,
  GetPageDetailData,
  GetPageDetailError,
  GetPilotSessionDetailData,
  GetPilotSessionDetailError,
  GetProjectDetailData,
  GetProjectDetailError,
  GetResourceDetailData,
  GetResourceDetailError,
  GetSettingsError,
  GetSubscriptionPlansError,
  GetSubscriptionUsageError,
  GetToolCallResultData,
  GetToolCallResultError,
  GetWorkflowAppDetailData,
  GetWorkflowAppDetailError,
  GetWorkflowDetailData,
  GetWorkflowDetailError,
  GetWorkflowVariablesData,
  GetWorkflowVariablesError,
  HasBeenInvitedError,
  HasFilledFormError,
  ImportCanvasData,
  ImportCanvasError,
  InitializeWorkflowData,
  InitializeWorkflowError,
  InvokeSkillData,
  InvokeSkillError,
  ListAccountsData,
  ListAccountsError,
  ListActionsError,
  ListCanvasesData,
  ListCanvasesError,
  ListCanvasTemplateCategoriesError,
  ListCanvasTemplatesData,
  ListCanvasTemplatesError,
  ListCodeArtifactsData,
  ListCodeArtifactsError,
  ListCopilotSessionsData,
  ListCopilotSessionsError,
  ListDocumentsData,
  ListDocumentsError,
  ListDriveFilesData,
  ListDriveFilesError,
  ListInvitationCodesError,
  ListLabelClassesData,
  ListLabelClassesError,
  ListLabelInstancesData,
  ListLabelInstancesError,
  ListMcpServersData,
  ListMcpServersError,
  ListModelsError,
  ListPagesData,
  ListPagesError,
  ListPilotSessionsData,
  ListPilotSessionsError,
  ListProjectsData,
  ListProjectsError,
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
  ListSkillInstancesData,
  ListSkillInstancesError,
  ListSkillsError,
  ListSkillTriggersData,
  ListSkillTriggersError,
  ListToolsData,
  ListToolsError,
  ListToolsetInventoryError,
  ListToolsetsData,
  ListToolsetsError,
  ListUserToolsError,
  ListWorkflowAppsData,
  ListWorkflowAppsError,
  LogoutError,
  MultiLingualWebSearchData,
  MultiLingualWebSearchError,
  PinSkillInstanceData,
  PinSkillInstanceError,
  RecoverPilotSessionData,
  RecoverPilotSessionError,
  RefreshTokenError,
  ReindexResourceData,
  ReindexResourceError,
  ResendVerificationData,
  ResendVerificationError,
  RevokeComposioConnectionData,
  RevokeComposioConnectionError,
  ScrapeData,
  ScrapeError,
  SearchData,
  SearchError,
  ServeStaticError,
  SetCanvasStateData,
  SetCanvasStateError,
  SharePageData,
  SharePageError,
  StreamInvokeSkillData,
  StreamInvokeSkillError,
  SubmitFormData,
  SubmitFormError,
  SyncCanvasStateData,
  SyncCanvasStateError,
  TestProviderConnectionData,
  TestProviderConnectionError,
  UnpinSkillInstanceData,
  UnpinSkillInstanceError,
  UpdateCanvasData,
  UpdateCanvasError,
  UpdateCanvasTemplateData,
  UpdateCanvasTemplateError,
  UpdateCodeArtifactData,
  UpdateCodeArtifactError,
  UpdateDocumentData,
  UpdateDocumentError,
  UpdateDriveFileData,
  UpdateDriveFileError,
  UpdateLabelClassData,
  UpdateLabelClassError,
  UpdateLabelInstanceData,
  UpdateLabelInstanceError,
  UpdateMcpServerData,
  UpdateMcpServerError,
  UpdatePageData,
  UpdatePageError,
  UpdatePilotSessionData,
  UpdatePilotSessionError,
  UpdateProjectData,
  UpdateProjectError,
  UpdateProjectItemsData,
  UpdateProjectItemsError,
  UpdateProviderData,
  UpdateProviderError,
  UpdateProviderItemData,
  UpdateProviderItemError,
  UpdateResourceData,
  UpdateResourceError,
  UpdateSettingsData,
  UpdateSettingsError,
  UpdateSkillInstanceData,
  UpdateSkillInstanceError,
  UpdateSkillTriggerData,
  UpdateSkillTriggerError,
  UpdateToolsetData,
  UpdateToolsetError,
  UpdateWorkflowVariablesData,
  UpdateWorkflowVariablesError,
  UploadData,
  UploadError,
  ValidateMcpServerData,
  ValidateMcpServerError,
} from '../requests/types.gen';
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
export const useListPages = <
  TData = Common.ListPagesDefaultResponse,
  TError = ListPagesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListPagesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListPagesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listPages({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetPageDetail = <
  TData = Common.GetPageDetailDefaultResponse,
  TError = GetPageDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetPageDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetPageDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getPageDetail({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetPageByCanvasId = <
  TData = Common.GetPageByCanvasIdDefaultResponse,
  TError = GetPageByCanvasIdError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetPageByCanvasIdData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetPageByCanvasIdKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getPageByCanvasId({ ...clientOptions }).then((response) => response.data as TData) as TData,
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
export const useListProjects = <
  TData = Common.ListProjectsDefaultResponse,
  TError = ListProjectsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListProjectsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListProjectsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listProjects({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetProjectDetail = <
  TData = Common.GetProjectDetailDefaultResponse,
  TError = GetProjectDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetProjectDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetProjectDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getProjectDetail({ ...clientOptions }).then((response) => response.data as TData) as TData,
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
export const useListLabelClasses = <
  TData = Common.ListLabelClassesDefaultResponse,
  TError = ListLabelClassesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListLabelClassesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListLabelClassesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listLabelClasses({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListLabelInstances = <
  TData = Common.ListLabelInstancesDefaultResponse,
  TError = ListLabelInstancesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListLabelInstancesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListLabelInstancesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listLabelInstances({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListActions = <
  TData = Common.ListActionsDefaultResponse,
  TError = ListActionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListActionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listActions({ ...clientOptions }).then((response) => response.data as TData) as TData,
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
export const useListSkills = <
  TData = Common.ListSkillsDefaultResponse,
  TError = ListSkillsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListSkillsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listSkills({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListSkillInstances = <
  TData = Common.ListSkillInstancesDefaultResponse,
  TError = ListSkillInstancesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListSkillInstancesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListSkillInstancesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listSkillInstances({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListSkillTriggers = <
  TData = Common.ListSkillTriggersDefaultResponse,
  TError = ListSkillTriggersError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListSkillTriggersData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListSkillTriggersKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listSkillTriggers({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListPilotSessions = <
  TData = Common.ListPilotSessionsDefaultResponse,
  TError = ListPilotSessionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListPilotSessionsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseListPilotSessionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listPilotSessions({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetPilotSessionDetail = <
  TData = Common.GetPilotSessionDetailDefaultResponse,
  TError = GetPilotSessionDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetPilotSessionDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGetPilotSessionDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getPilotSessionDetail({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
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
export const useHasFilledForm = <
  TData = Common.HasFilledFormDefaultResponse,
  TError = HasFilledFormError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseHasFilledFormKeyFn(clientOptions, queryKey),
    queryFn: () =>
      hasFilledForm({ ...clientOptions }).then((response) => response.data as TData) as TData,
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
export const useHasBeenInvited = <
  TData = Common.HasBeenInvitedDefaultResponse,
  TError = HasBeenInvitedError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseHasBeenInvitedKeyFn(clientOptions, queryKey),
    queryFn: () =>
      hasBeenInvited({ ...clientOptions }).then((response) => response.data as TData) as TData,
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
export const useSharePage = <
  TData = Common.SharePageMutationResult,
  TError = SharePageError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<SharePageData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<SharePageData, true>, TContext>({
    mutationKey: Common.UseSharePageKeyFn(mutationKey),
    mutationFn: (clientOptions) => sharePage(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useAddNodesToCanvasPage = <
  TData = Common.AddNodesToCanvasPageMutationResult,
  TError = AddNodesToCanvasPageError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<AddNodesToCanvasPageData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<AddNodesToCanvasPageData, true>, TContext>({
    mutationKey: Common.UseAddNodesToCanvasPageKeyFn(mutationKey),
    mutationFn: (clientOptions) => addNodesToCanvasPage(clientOptions) as unknown as Promise<TData>,
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
export const useCreateProject = <
  TData = Common.CreateProjectMutationResult,
  TError = CreateProjectError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateProjectData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateProjectData, true>, TContext>({
    mutationKey: Common.UseCreateProjectKeyFn(mutationKey),
    mutationFn: (clientOptions) => createProject(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateProject = <
  TData = Common.UpdateProjectMutationResult,
  TError = UpdateProjectError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateProjectData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateProjectData, true>, TContext>({
    mutationKey: Common.UseUpdateProjectKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateProject(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateProjectItems = <
  TData = Common.UpdateProjectItemsMutationResult,
  TError = UpdateProjectItemsError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateProjectItemsData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateProjectItemsData, true>, TContext>({
    mutationKey: Common.UseUpdateProjectItemsKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateProjectItems(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteProject = <
  TData = Common.DeleteProjectMutationResult,
  TError = DeleteProjectError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteProjectData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteProjectData, true>, TContext>({
    mutationKey: Common.UseDeleteProjectKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteProject(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteProjectItems = <
  TData = Common.DeleteProjectItemsMutationResult,
  TError = DeleteProjectItemsError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteProjectItemsData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteProjectItemsData, true>, TContext>({
    mutationKey: Common.UseDeleteProjectItemsKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteProjectItems(clientOptions) as unknown as Promise<TData>,
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
export const useCreateLabelClass = <
  TData = Common.CreateLabelClassMutationResult,
  TError = CreateLabelClassError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateLabelClassData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateLabelClassData, true>, TContext>({
    mutationKey: Common.UseCreateLabelClassKeyFn(mutationKey),
    mutationFn: (clientOptions) => createLabelClass(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateLabelClass = <
  TData = Common.UpdateLabelClassMutationResult,
  TError = UpdateLabelClassError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateLabelClassData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateLabelClassData, true>, TContext>({
    mutationKey: Common.UseUpdateLabelClassKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateLabelClass(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteLabelClass = <
  TData = Common.DeleteLabelClassMutationResult,
  TError = DeleteLabelClassError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteLabelClassData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteLabelClassData, true>, TContext>({
    mutationKey: Common.UseDeleteLabelClassKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteLabelClass(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateLabelInstance = <
  TData = Common.CreateLabelInstanceMutationResult,
  TError = CreateLabelInstanceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateLabelInstanceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateLabelInstanceData, true>, TContext>({
    mutationKey: Common.UseCreateLabelInstanceKeyFn(mutationKey),
    mutationFn: (clientOptions) => createLabelInstance(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateLabelInstance = <
  TData = Common.UpdateLabelInstanceMutationResult,
  TError = UpdateLabelInstanceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateLabelInstanceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateLabelInstanceData, true>, TContext>({
    mutationKey: Common.UseUpdateLabelInstanceKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateLabelInstance(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteLabelInstance = <
  TData = Common.DeleteLabelInstanceMutationResult,
  TError = DeleteLabelInstanceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteLabelInstanceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteLabelInstanceData, true>, TContext>({
    mutationKey: Common.UseDeleteLabelInstanceKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteLabelInstance(clientOptions) as unknown as Promise<TData>,
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
export const useCreateSkillInstance = <
  TData = Common.CreateSkillInstanceMutationResult,
  TError = CreateSkillInstanceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateSkillInstanceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateSkillInstanceData, true>, TContext>({
    mutationKey: Common.UseCreateSkillInstanceKeyFn(mutationKey),
    mutationFn: (clientOptions) => createSkillInstance(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateSkillInstance = <
  TData = Common.UpdateSkillInstanceMutationResult,
  TError = UpdateSkillInstanceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateSkillInstanceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateSkillInstanceData, true>, TContext>({
    mutationKey: Common.UseUpdateSkillInstanceKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateSkillInstance(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const usePinSkillInstance = <
  TData = Common.PinSkillInstanceMutationResult,
  TError = PinSkillInstanceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<PinSkillInstanceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<PinSkillInstanceData, true>, TContext>({
    mutationKey: Common.UsePinSkillInstanceKeyFn(mutationKey),
    mutationFn: (clientOptions) => pinSkillInstance(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUnpinSkillInstance = <
  TData = Common.UnpinSkillInstanceMutationResult,
  TError = UnpinSkillInstanceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UnpinSkillInstanceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UnpinSkillInstanceData, true>, TContext>({
    mutationKey: Common.UseUnpinSkillInstanceKeyFn(mutationKey),
    mutationFn: (clientOptions) => unpinSkillInstance(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteSkillInstance = <
  TData = Common.DeleteSkillInstanceMutationResult,
  TError = DeleteSkillInstanceError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteSkillInstanceData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteSkillInstanceData, true>, TContext>({
    mutationKey: Common.UseDeleteSkillInstanceKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteSkillInstance(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useCreateSkillTrigger = <
  TData = Common.CreateSkillTriggerMutationResult,
  TError = CreateSkillTriggerError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreateSkillTriggerData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreateSkillTriggerData, true>, TContext>({
    mutationKey: Common.UseCreateSkillTriggerKeyFn(mutationKey),
    mutationFn: (clientOptions) => createSkillTrigger(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdateSkillTrigger = <
  TData = Common.UpdateSkillTriggerMutationResult,
  TError = UpdateSkillTriggerError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdateSkillTriggerData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdateSkillTriggerData, true>, TContext>({
    mutationKey: Common.UseUpdateSkillTriggerKeyFn(mutationKey),
    mutationFn: (clientOptions) => updateSkillTrigger(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteSkillTrigger = <
  TData = Common.DeleteSkillTriggerMutationResult,
  TError = DeleteSkillTriggerError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteSkillTriggerData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteSkillTriggerData, true>, TContext>({
    mutationKey: Common.UseDeleteSkillTriggerKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteSkillTrigger(clientOptions) as unknown as Promise<TData>,
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
export const useCreatePilotSession = <
  TData = Common.CreatePilotSessionMutationResult,
  TError = CreatePilotSessionError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<CreatePilotSessionData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<CreatePilotSessionData, true>, TContext>({
    mutationKey: Common.UseCreatePilotSessionKeyFn(mutationKey),
    mutationFn: (clientOptions) => createPilotSession(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useUpdatePilotSession = <
  TData = Common.UpdatePilotSessionMutationResult,
  TError = UpdatePilotSessionError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdatePilotSessionData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdatePilotSessionData, true>, TContext>({
    mutationKey: Common.UseUpdatePilotSessionKeyFn(mutationKey),
    mutationFn: (clientOptions) => updatePilotSession(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useRecoverPilotSession = <
  TData = Common.RecoverPilotSessionMutationResult,
  TError = RecoverPilotSessionError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<RecoverPilotSessionData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<RecoverPilotSessionData, true>, TContext>({
    mutationKey: Common.UseRecoverPilotSessionKeyFn(mutationKey),
    mutationFn: (clientOptions) => recoverPilotSession(clientOptions) as unknown as Promise<TData>,
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
export const useUpdatePage = <
  TData = Common.UpdatePageMutationResult,
  TError = UpdatePageError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<UpdatePageData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<UpdatePageData, true>, TContext>({
    mutationKey: Common.UseUpdatePageKeyFn(mutationKey),
    mutationFn: (clientOptions) => updatePage(clientOptions) as unknown as Promise<TData>,
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
export const useDeletePage = <
  TData = Common.DeletePageMutationResult,
  TError = DeletePageError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeletePageData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeletePageData, true>, TContext>({
    mutationKey: Common.UseDeletePageKeyFn(mutationKey),
    mutationFn: (clientOptions) => deletePage(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeletePageNode = <
  TData = Common.DeletePageNodeMutationResult,
  TError = DeletePageNodeError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeletePageNodeData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeletePageNodeData, true>, TContext>({
    mutationKey: Common.UseDeletePageNodeKeyFn(mutationKey),
    mutationFn: (clientOptions) => deletePageNode(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
