// generated with @7nohe/openapi-react-query-codegen@2.0.0-beta.3

import { type Options } from '@hey-api/client-fetch';
import { UseQueryResult } from '@tanstack/react-query';
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
  getWorkflowAppDetail,
  getWorkflowDetail,
  getWorkflowVariables,
  hasBeenInvited,
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
export type ListPagesDefaultResponse = Awaited<ReturnType<typeof listPages>>['data'];
export type ListPagesQueryResult<
  TData = ListPagesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListPagesKey = 'ListPages';
export const UseListPagesKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListPagesKey, ...(queryKey ?? [clientOptions])];
export type GetPageDetailDefaultResponse = Awaited<ReturnType<typeof getPageDetail>>['data'];
export type GetPageDetailQueryResult<
  TData = GetPageDetailDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetPageDetailKey = 'GetPageDetail';
export const UseGetPageDetailKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetPageDetailKey, ...(queryKey ?? [clientOptions])];
export type GetPageByCanvasIdDefaultResponse = Awaited<
  ReturnType<typeof getPageByCanvasId>
>['data'];
export type GetPageByCanvasIdQueryResult<
  TData = GetPageByCanvasIdDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetPageByCanvasIdKey = 'GetPageByCanvasId';
export const UseGetPageByCanvasIdKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetPageByCanvasIdKey, ...(queryKey ?? [clientOptions])];
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
export type ListProjectsDefaultResponse = Awaited<ReturnType<typeof listProjects>>['data'];
export type ListProjectsQueryResult<
  TData = ListProjectsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListProjectsKey = 'ListProjects';
export const UseListProjectsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListProjectsKey, ...(queryKey ?? [clientOptions])];
export type GetProjectDetailDefaultResponse = Awaited<ReturnType<typeof getProjectDetail>>['data'];
export type GetProjectDetailQueryResult<
  TData = GetProjectDetailDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetProjectDetailKey = 'GetProjectDetail';
export const UseGetProjectDetailKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetProjectDetailKey, ...(queryKey ?? [clientOptions])];
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
export type ListLabelClassesDefaultResponse = Awaited<ReturnType<typeof listLabelClasses>>['data'];
export type ListLabelClassesQueryResult<
  TData = ListLabelClassesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListLabelClassesKey = 'ListLabelClasses';
export const UseListLabelClassesKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListLabelClassesKey, ...(queryKey ?? [clientOptions])];
export type ListLabelInstancesDefaultResponse = Awaited<
  ReturnType<typeof listLabelInstances>
>['data'];
export type ListLabelInstancesQueryResult<
  TData = ListLabelInstancesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListLabelInstancesKey = 'ListLabelInstances';
export const UseListLabelInstancesKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListLabelInstancesKey, ...(queryKey ?? [clientOptions])];
export type ListActionsDefaultResponse = Awaited<ReturnType<typeof listActions>>['data'];
export type ListActionsQueryResult<
  TData = ListActionsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListActionsKey = 'ListActions';
export const UseListActionsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListActionsKey, ...(queryKey ?? [clientOptions])];
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
export type ListSkillsDefaultResponse = Awaited<ReturnType<typeof listSkills>>['data'];
export type ListSkillsQueryResult<
  TData = ListSkillsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListSkillsKey = 'ListSkills';
export const UseListSkillsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListSkillsKey, ...(queryKey ?? [clientOptions])];
export type ListSkillInstancesDefaultResponse = Awaited<
  ReturnType<typeof listSkillInstances>
>['data'];
export type ListSkillInstancesQueryResult<
  TData = ListSkillInstancesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListSkillInstancesKey = 'ListSkillInstances';
export const UseListSkillInstancesKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListSkillInstancesKey, ...(queryKey ?? [clientOptions])];
export type ListSkillTriggersDefaultResponse = Awaited<
  ReturnType<typeof listSkillTriggers>
>['data'];
export type ListSkillTriggersQueryResult<
  TData = ListSkillTriggersDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListSkillTriggersKey = 'ListSkillTriggers';
export const UseListSkillTriggersKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListSkillTriggersKey, ...(queryKey ?? [clientOptions])];
export type ListPilotSessionsDefaultResponse = Awaited<
  ReturnType<typeof listPilotSessions>
>['data'];
export type ListPilotSessionsQueryResult<
  TData = ListPilotSessionsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useListPilotSessionsKey = 'ListPilotSessions';
export const UseListPilotSessionsKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useListPilotSessionsKey, ...(queryKey ?? [clientOptions])];
export type GetPilotSessionDetailDefaultResponse = Awaited<
  ReturnType<typeof getPilotSessionDetail>
>['data'];
export type GetPilotSessionDetailQueryResult<
  TData = GetPilotSessionDetailDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGetPilotSessionDetailKey = 'GetPilotSessionDetail';
export const UseGetPilotSessionDetailKeyFn = (
  clientOptions: Options<unknown, true>,
  queryKey?: Array<unknown>,
) => [useGetPilotSessionDetailKey, ...(queryKey ?? [clientOptions])];
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
  clientOptions: Options<unknown, true>,
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
export type HasBeenInvitedDefaultResponse = Awaited<ReturnType<typeof hasBeenInvited>>['data'];
export type HasBeenInvitedQueryResult<
  TData = HasBeenInvitedDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useHasBeenInvitedKey = 'HasBeenInvited';
export const UseHasBeenInvitedKeyFn = (
  clientOptions: Options<unknown, true> = {},
  queryKey?: Array<unknown>,
) => [useHasBeenInvitedKey, ...(queryKey ?? [clientOptions])];
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
export type SharePageMutationResult = Awaited<ReturnType<typeof sharePage>>;
export const useSharePageKey = 'SharePage';
export const UseSharePageKeyFn = (mutationKey?: Array<unknown>) => [
  useSharePageKey,
  ...(mutationKey ?? []),
];
export type AddNodesToCanvasPageMutationResult = Awaited<ReturnType<typeof addNodesToCanvasPage>>;
export const useAddNodesToCanvasPageKey = 'AddNodesToCanvasPage';
export const UseAddNodesToCanvasPageKeyFn = (mutationKey?: Array<unknown>) => [
  useAddNodesToCanvasPageKey,
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
export type CreateProjectMutationResult = Awaited<ReturnType<typeof createProject>>;
export const useCreateProjectKey = 'CreateProject';
export const UseCreateProjectKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateProjectKey,
  ...(mutationKey ?? []),
];
export type UpdateProjectMutationResult = Awaited<ReturnType<typeof updateProject>>;
export const useUpdateProjectKey = 'UpdateProject';
export const UseUpdateProjectKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateProjectKey,
  ...(mutationKey ?? []),
];
export type UpdateProjectItemsMutationResult = Awaited<ReturnType<typeof updateProjectItems>>;
export const useUpdateProjectItemsKey = 'UpdateProjectItems';
export const UseUpdateProjectItemsKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateProjectItemsKey,
  ...(mutationKey ?? []),
];
export type DeleteProjectMutationResult = Awaited<ReturnType<typeof deleteProject>>;
export const useDeleteProjectKey = 'DeleteProject';
export const UseDeleteProjectKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteProjectKey,
  ...(mutationKey ?? []),
];
export type DeleteProjectItemsMutationResult = Awaited<ReturnType<typeof deleteProjectItems>>;
export const useDeleteProjectItemsKey = 'DeleteProjectItems';
export const UseDeleteProjectItemsKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteProjectItemsKey,
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
export type CreateLabelClassMutationResult = Awaited<ReturnType<typeof createLabelClass>>;
export const useCreateLabelClassKey = 'CreateLabelClass';
export const UseCreateLabelClassKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateLabelClassKey,
  ...(mutationKey ?? []),
];
export type UpdateLabelClassMutationResult = Awaited<ReturnType<typeof updateLabelClass>>;
export const useUpdateLabelClassKey = 'UpdateLabelClass';
export const UseUpdateLabelClassKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateLabelClassKey,
  ...(mutationKey ?? []),
];
export type DeleteLabelClassMutationResult = Awaited<ReturnType<typeof deleteLabelClass>>;
export const useDeleteLabelClassKey = 'DeleteLabelClass';
export const UseDeleteLabelClassKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteLabelClassKey,
  ...(mutationKey ?? []),
];
export type CreateLabelInstanceMutationResult = Awaited<ReturnType<typeof createLabelInstance>>;
export const useCreateLabelInstanceKey = 'CreateLabelInstance';
export const UseCreateLabelInstanceKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateLabelInstanceKey,
  ...(mutationKey ?? []),
];
export type UpdateLabelInstanceMutationResult = Awaited<ReturnType<typeof updateLabelInstance>>;
export const useUpdateLabelInstanceKey = 'UpdateLabelInstance';
export const UseUpdateLabelInstanceKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateLabelInstanceKey,
  ...(mutationKey ?? []),
];
export type DeleteLabelInstanceMutationResult = Awaited<ReturnType<typeof deleteLabelInstance>>;
export const useDeleteLabelInstanceKey = 'DeleteLabelInstance';
export const UseDeleteLabelInstanceKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteLabelInstanceKey,
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
export type CreateSkillInstanceMutationResult = Awaited<ReturnType<typeof createSkillInstance>>;
export const useCreateSkillInstanceKey = 'CreateSkillInstance';
export const UseCreateSkillInstanceKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateSkillInstanceKey,
  ...(mutationKey ?? []),
];
export type UpdateSkillInstanceMutationResult = Awaited<ReturnType<typeof updateSkillInstance>>;
export const useUpdateSkillInstanceKey = 'UpdateSkillInstance';
export const UseUpdateSkillInstanceKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateSkillInstanceKey,
  ...(mutationKey ?? []),
];
export type PinSkillInstanceMutationResult = Awaited<ReturnType<typeof pinSkillInstance>>;
export const usePinSkillInstanceKey = 'PinSkillInstance';
export const UsePinSkillInstanceKeyFn = (mutationKey?: Array<unknown>) => [
  usePinSkillInstanceKey,
  ...(mutationKey ?? []),
];
export type UnpinSkillInstanceMutationResult = Awaited<ReturnType<typeof unpinSkillInstance>>;
export const useUnpinSkillInstanceKey = 'UnpinSkillInstance';
export const UseUnpinSkillInstanceKeyFn = (mutationKey?: Array<unknown>) => [
  useUnpinSkillInstanceKey,
  ...(mutationKey ?? []),
];
export type DeleteSkillInstanceMutationResult = Awaited<ReturnType<typeof deleteSkillInstance>>;
export const useDeleteSkillInstanceKey = 'DeleteSkillInstance';
export const UseDeleteSkillInstanceKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteSkillInstanceKey,
  ...(mutationKey ?? []),
];
export type CreateSkillTriggerMutationResult = Awaited<ReturnType<typeof createSkillTrigger>>;
export const useCreateSkillTriggerKey = 'CreateSkillTrigger';
export const UseCreateSkillTriggerKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateSkillTriggerKey,
  ...(mutationKey ?? []),
];
export type UpdateSkillTriggerMutationResult = Awaited<ReturnType<typeof updateSkillTrigger>>;
export const useUpdateSkillTriggerKey = 'UpdateSkillTrigger';
export const UseUpdateSkillTriggerKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateSkillTriggerKey,
  ...(mutationKey ?? []),
];
export type DeleteSkillTriggerMutationResult = Awaited<ReturnType<typeof deleteSkillTrigger>>;
export const useDeleteSkillTriggerKey = 'DeleteSkillTrigger';
export const UseDeleteSkillTriggerKeyFn = (mutationKey?: Array<unknown>) => [
  useDeleteSkillTriggerKey,
  ...(mutationKey ?? []),
];
export type GenerateMediaMutationResult = Awaited<ReturnType<typeof generateMedia>>;
export const useGenerateMediaKey = 'GenerateMedia';
export const UseGenerateMediaKeyFn = (mutationKey?: Array<unknown>) => [
  useGenerateMediaKey,
  ...(mutationKey ?? []),
];
export type CreatePilotSessionMutationResult = Awaited<ReturnType<typeof createPilotSession>>;
export const useCreatePilotSessionKey = 'CreatePilotSession';
export const UseCreatePilotSessionKeyFn = (mutationKey?: Array<unknown>) => [
  useCreatePilotSessionKey,
  ...(mutationKey ?? []),
];
export type UpdatePilotSessionMutationResult = Awaited<ReturnType<typeof updatePilotSession>>;
export const useUpdatePilotSessionKey = 'UpdatePilotSession';
export const UseUpdatePilotSessionKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdatePilotSessionKey,
  ...(mutationKey ?? []),
];
export type RecoverPilotSessionMutationResult = Awaited<ReturnType<typeof recoverPilotSession>>;
export const useRecoverPilotSessionKey = 'RecoverPilotSession';
export const UseRecoverPilotSessionKeyFn = (mutationKey?: Array<unknown>) => [
  useRecoverPilotSessionKey,
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
export type CreateCheckoutSessionMutationResult = Awaited<ReturnType<typeof createCheckoutSession>>;
export const useCreateCheckoutSessionKey = 'CreateCheckoutSession';
export const UseCreateCheckoutSessionKeyFn = (mutationKey?: Array<unknown>) => [
  useCreateCheckoutSessionKey,
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
export type UpdatePageMutationResult = Awaited<ReturnType<typeof updatePage>>;
export const useUpdatePageKey = 'UpdatePage';
export const UseUpdatePageKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdatePageKey,
  ...(mutationKey ?? []),
];
export type UpdateSettingsMutationResult = Awaited<ReturnType<typeof updateSettings>>;
export const useUpdateSettingsKey = 'UpdateSettings';
export const UseUpdateSettingsKeyFn = (mutationKey?: Array<unknown>) => [
  useUpdateSettingsKey,
  ...(mutationKey ?? []),
];
export type DeletePageMutationResult = Awaited<ReturnType<typeof deletePage>>;
export const useDeletePageKey = 'DeletePage';
export const UseDeletePageKeyFn = (mutationKey?: Array<unknown>) => [
  useDeletePageKey,
  ...(mutationKey ?? []),
];
export type DeletePageNodeMutationResult = Awaited<ReturnType<typeof deletePageNode>>;
export const useDeletePageNodeKey = 'DeletePageNode';
export const UseDeletePageNodeKeyFn = (mutationKey?: Array<unknown>) => [
  useDeletePageNodeKey,
  ...(mutationKey ?? []),
];
