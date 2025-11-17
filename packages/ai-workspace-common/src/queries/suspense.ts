// generated with @7nohe/openapi-react-query-codegen@2.0.0-beta.3

import { type Options } from '@hey-api/client-fetch';
import { UseQueryOptions, useSuspenseQuery } from '@tanstack/react-query';
import {
  checkSettingsField,
  checkToolOauthStatus,
  exportCanvas,
  exportDocument,
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
  listAccounts,
  listActions,
  listCanvases,
  listCanvasTemplateCategories,
  listCanvasTemplates,
  listCodeArtifacts,
  listCopilotSessions,
  listDocuments,
  listDriveFiles,
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
  serveStatic,
} from '../requests/services.gen';
import {
  CheckSettingsFieldData,
  CheckSettingsFieldError,
  CheckToolOauthStatusData,
  CheckToolOauthStatusError,
  ExportCanvasData,
  ExportCanvasError,
  ExportDocumentData,
  ExportDocumentError,
  GetActionResultData,
  GetActionResultError,
  GetAuthConfigError,
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
  GetWorkflowAppDetailData,
  GetWorkflowAppDetailError,
  GetWorkflowDetailData,
  GetWorkflowDetailError,
  GetWorkflowVariablesData,
  GetWorkflowVariablesError,
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
  ListWorkflowAppsData,
  ListWorkflowAppsError,
  ServeStaticError,
} from '../requests/types.gen';
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
export const useListPagesSuspense = <
  TData = Common.ListPagesDefaultResponse,
  TError = ListPagesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListPagesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListPagesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listPages({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetPageDetailSuspense = <
  TData = Common.GetPageDetailDefaultResponse,
  TError = GetPageDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetPageDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetPageDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getPageDetail({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetPageByCanvasIdSuspense = <
  TData = Common.GetPageByCanvasIdDefaultResponse,
  TError = GetPageByCanvasIdError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetPageByCanvasIdData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetPageByCanvasIdKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getPageByCanvasId({ ...clientOptions }).then((response) => response.data as TData) as TData,
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
export const useListProjectsSuspense = <
  TData = Common.ListProjectsDefaultResponse,
  TError = ListProjectsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListProjectsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListProjectsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listProjects({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetProjectDetailSuspense = <
  TData = Common.GetProjectDetailDefaultResponse,
  TError = GetProjectDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetProjectDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetProjectDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getProjectDetail({ ...clientOptions }).then((response) => response.data as TData) as TData,
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
export const useListLabelClassesSuspense = <
  TData = Common.ListLabelClassesDefaultResponse,
  TError = ListLabelClassesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListLabelClassesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListLabelClassesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listLabelClasses({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListLabelInstancesSuspense = <
  TData = Common.ListLabelInstancesDefaultResponse,
  TError = ListLabelInstancesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListLabelInstancesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListLabelInstancesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listLabelInstances({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListActionsSuspense = <
  TData = Common.ListActionsDefaultResponse,
  TError = ListActionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListActionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listActions({ ...clientOptions }).then((response) => response.data as TData) as TData,
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
export const useListSkillsSuspense = <
  TData = Common.ListSkillsDefaultResponse,
  TError = ListSkillsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<unknown, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListSkillsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listSkills({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListSkillInstancesSuspense = <
  TData = Common.ListSkillInstancesDefaultResponse,
  TError = ListSkillInstancesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListSkillInstancesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListSkillInstancesKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listSkillInstances({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListSkillTriggersSuspense = <
  TData = Common.ListSkillTriggersDefaultResponse,
  TError = ListSkillTriggersError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListSkillTriggersData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListSkillTriggersKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listSkillTriggers({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useListPilotSessionsSuspense = <
  TData = Common.ListPilotSessionsDefaultResponse,
  TError = ListPilotSessionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListPilotSessionsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseListPilotSessionsKeyFn(clientOptions, queryKey),
    queryFn: () =>
      listPilotSessions({ ...clientOptions }).then((response) => response.data as TData) as TData,
    ...options,
  });
export const useGetPilotSessionDetailSuspense = <
  TData = Common.GetPilotSessionDetailDefaultResponse,
  TError = GetPilotSessionDetailError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetPilotSessionDetailData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGetPilotSessionDetailKeyFn(clientOptions, queryKey),
    queryFn: () =>
      getPilotSessionDetail({ ...clientOptions }).then(
        (response) => response.data as TData,
      ) as TData,
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
