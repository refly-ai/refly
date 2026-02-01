// generated with @7nohe/openapi-react-query-codegen@2.0.0-beta.3

import { type Options } from '@hey-api/client-fetch';
import { type QueryClient } from '@tanstack/react-query';
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
  CheckToolOauthStatusData,
  DownloadExportJobResultData,
  ExportCanvasData,
  ExportDocumentData,
  ExportToolsetDefinitionsData,
  GetActionResultData,
  GetCanvasCommissionByCanvasIdData,
  GetCanvasDataData,
  GetCanvasDetailData,
  GetCanvasStateData,
  GetCanvasTransactionsData,
  GetCodeArtifactDetailData,
  GetComposioConnectionStatusData,
  GetCopilotSessionDetailData,
  GetCreditRechargeData,
  GetCreditUsageByCanvasIdData,
  GetCreditUsageByExecutionIdData,
  GetCreditUsageByResultIdData,
  GetCreditUsageData,
  GetDocumentDetailData,
  GetExportJobStatusData,
  GetOpenapiConfigData,
  GetResourceDetailData,
  GetTemplateGenerationStatusData,
  GetToolCallResultData,
  GetWebhookConfigData,
  GetWebhookHistoryData,
  GetWorkflowAppDetailData,
  GetWorkflowDetailData,
  GetWorkflowDetailViaApiData,
  GetWorkflowOutputData,
  GetWorkflowPlanDetailData,
  GetWorkflowStatusViaApiData,
  GetWorkflowVariablesData,
  ListAccountsData,
  ListCanvasesData,
  ListCanvasTemplatesData,
  ListCodeArtifactsData,
  ListCopilotSessionsData,
  ListDocumentsData,
  ListDriveFilesData,
  ListMcpServersData,
  ListProviderItemOptionsData,
  ListProviderItemsData,
  ListProvidersData,
  ListResourcesData,
  ListSharesData,
  ListToolsData,
  ListToolsetsData,
  ListWorkflowAppsData,
  ListWorkflowExecutionsData,
  SearchWorkflowsViaApiData,
  VerifyVoucherInvitationData,
} from '@refly/openapi-schema';
import * as Common from './common';
export const prefetchUseListMcpServers = (
  queryClient: QueryClient,
  clientOptions: Options<ListMcpServersData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListMcpServersKeyFn(clientOptions),
    queryFn: () => listMcpServers({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetAuthConfig = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetAuthConfigKeyFn(clientOptions),
    queryFn: () => getAuthConfig({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListAccounts = (
  queryClient: QueryClient,
  clientOptions: Options<ListAccountsData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListAccountsKeyFn(clientOptions),
    queryFn: () => listAccounts({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseCheckToolOauthStatus = (
  queryClient: QueryClient,
  clientOptions: Options<CheckToolOauthStatusData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseCheckToolOauthStatusKeyFn(clientOptions),
    queryFn: () => checkToolOauthStatus({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListCliApiKeys = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListCliApiKeysKeyFn(clientOptions),
    queryFn: () => listCliApiKeys({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCollabToken = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCollabTokenKeyFn(clientOptions),
    queryFn: () => getCollabToken({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListCanvases = (
  queryClient: QueryClient,
  clientOptions: Options<ListCanvasesData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListCanvasesKeyFn(clientOptions),
    queryFn: () => listCanvases({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCanvasDetail = (
  queryClient: QueryClient,
  clientOptions: Options<GetCanvasDetailData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCanvasDetailKeyFn(clientOptions),
    queryFn: () => getCanvasDetail({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCanvasData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCanvasDataData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCanvasDataKeyFn(clientOptions),
    queryFn: () => getCanvasData({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseExportCanvas = (
  queryClient: QueryClient,
  clientOptions: Options<ExportCanvasData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseExportCanvasKeyFn(clientOptions),
    queryFn: () => exportCanvas({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCanvasState = (
  queryClient: QueryClient,
  clientOptions: Options<GetCanvasStateData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCanvasStateKeyFn(clientOptions),
    queryFn: () => getCanvasState({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCanvasTransactions = (
  queryClient: QueryClient,
  clientOptions: Options<GetCanvasTransactionsData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCanvasTransactionsKeyFn(clientOptions),
    queryFn: () => getCanvasTransactions({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetWorkflowVariables = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowVariablesData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetWorkflowVariablesKeyFn(clientOptions),
    queryFn: () => getWorkflowVariables({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListDriveFiles = (
  queryClient: QueryClient,
  clientOptions: Options<ListDriveFilesData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListDriveFilesKeyFn(clientOptions),
    queryFn: () => listDriveFiles({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListCanvasTemplates = (
  queryClient: QueryClient,
  clientOptions: Options<ListCanvasTemplatesData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListCanvasTemplatesKeyFn(clientOptions),
    queryFn: () => listCanvasTemplates({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListCanvasTemplateCategories = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListCanvasTemplateCategoriesKeyFn(clientOptions),
    queryFn: () =>
      listCanvasTemplateCategories({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListResources = (
  queryClient: QueryClient,
  clientOptions: Options<ListResourcesData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListResourcesKeyFn(clientOptions),
    queryFn: () => listResources({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetResourceDetail = (
  queryClient: QueryClient,
  clientOptions: Options<GetResourceDetailData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetResourceDetailKeyFn(clientOptions),
    queryFn: () => getResourceDetail({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListDocuments = (
  queryClient: QueryClient,
  clientOptions: Options<ListDocumentsData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListDocumentsKeyFn(clientOptions),
    queryFn: () => listDocuments({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetDocumentDetail = (
  queryClient: QueryClient,
  clientOptions: Options<GetDocumentDetailData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetDocumentDetailKeyFn(clientOptions),
    queryFn: () => getDocumentDetail({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseExportDocument = (
  queryClient: QueryClient,
  clientOptions: Options<ExportDocumentData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseExportDocumentKeyFn(clientOptions),
    queryFn: () => exportDocument({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetExportJobStatus = (
  queryClient: QueryClient,
  clientOptions: Options<GetExportJobStatusData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetExportJobStatusKeyFn(clientOptions),
    queryFn: () => getExportJobStatus({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseDownloadExportJobResult = (
  queryClient: QueryClient,
  clientOptions: Options<DownloadExportJobResultData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseDownloadExportJobResultKeyFn(clientOptions),
    queryFn: () => downloadExportJobResult({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListCodeArtifacts = (
  queryClient: QueryClient,
  clientOptions: Options<ListCodeArtifactsData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListCodeArtifactsKeyFn(clientOptions),
    queryFn: () => listCodeArtifacts({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCodeArtifactDetail = (
  queryClient: QueryClient,
  clientOptions: Options<GetCodeArtifactDetailData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCodeArtifactDetailKeyFn(clientOptions),
    queryFn: () => getCodeArtifactDetail({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListShares = (
  queryClient: QueryClient,
  clientOptions: Options<ListSharesData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListSharesKeyFn(clientOptions),
    queryFn: () => listShares({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetActionResult = (
  queryClient: QueryClient,
  clientOptions: Options<GetActionResultData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetActionResultKeyFn(clientOptions),
    queryFn: () => getActionResult({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListCopilotSessions = (
  queryClient: QueryClient,
  clientOptions: Options<ListCopilotSessionsData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListCopilotSessionsKeyFn(clientOptions),
    queryFn: () => listCopilotSessions({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCopilotSessionDetail = (
  queryClient: QueryClient,
  clientOptions: Options<GetCopilotSessionDetailData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCopilotSessionDetailKeyFn(clientOptions),
    queryFn: () => getCopilotSessionDetail({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListWorkflowExecutions = (
  queryClient: QueryClient,
  clientOptions: Options<ListWorkflowExecutionsData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListWorkflowExecutionsKeyFn(clientOptions),
    queryFn: () => listWorkflowExecutions({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetWorkflowDetail = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowDetailData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetWorkflowDetailKeyFn(clientOptions),
    queryFn: () => getWorkflowDetail({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetWorkflowPlanDetail = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowPlanDetailData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetWorkflowPlanDetailKeyFn(clientOptions),
    queryFn: () => getWorkflowPlanDetail({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetWorkflowAppDetail = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowAppDetailData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetWorkflowAppDetailKeyFn(clientOptions),
    queryFn: () => getWorkflowAppDetail({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListWorkflowApps = (
  queryClient: QueryClient,
  clientOptions: Options<ListWorkflowAppsData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListWorkflowAppsKeyFn(clientOptions),
    queryFn: () => listWorkflowApps({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetTemplateGenerationStatus = (
  queryClient: QueryClient,
  clientOptions: Options<GetTemplateGenerationStatusData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetTemplateGenerationStatusKeyFn(clientOptions),
    queryFn: () =>
      getTemplateGenerationStatus({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetWebhookConfig = (
  queryClient: QueryClient,
  clientOptions: Options<GetWebhookConfigData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetWebhookConfigKeyFn(clientOptions),
    queryFn: () => getWebhookConfig({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetWebhookHistory = (
  queryClient: QueryClient,
  clientOptions: Options<GetWebhookHistoryData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetWebhookHistoryKeyFn(clientOptions),
    queryFn: () => getWebhookHistory({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetOpenapiConfig = (
  queryClient: QueryClient,
  clientOptions: Options<GetOpenapiConfigData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetOpenapiConfigKeyFn(clientOptions),
    queryFn: () => getOpenapiConfig({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseSearchWorkflowsViaApi = (
  queryClient: QueryClient,
  clientOptions: Options<SearchWorkflowsViaApiData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSearchWorkflowsViaApiKeyFn(clientOptions),
    queryFn: () => searchWorkflowsViaApi({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetWorkflowDetailViaApi = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowDetailViaApiData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetWorkflowDetailViaApiKeyFn(clientOptions),
    queryFn: () => getWorkflowDetailViaApi({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetWorkflowStatusViaApi = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowStatusViaApiData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetWorkflowStatusViaApiKeyFn(clientOptions),
    queryFn: () => getWorkflowStatusViaApi({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetWorkflowOutput = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowOutputData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetWorkflowOutputKeyFn(clientOptions),
    queryFn: () => getWorkflowOutput({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetSettings = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetSettingsKeyFn(clientOptions),
    queryFn: () => getSettings({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseCheckSettingsField = (
  queryClient: QueryClient,
  clientOptions: Options<CheckSettingsFieldData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseCheckSettingsFieldKeyFn(clientOptions),
    queryFn: () => checkSettingsField({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetFormDefinition = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetFormDefinitionKeyFn(clientOptions),
    queryFn: () => getFormDefinition({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCreditRecharge = (
  queryClient: QueryClient,
  clientOptions: Options<GetCreditRechargeData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCreditRechargeKeyFn(clientOptions),
    queryFn: () => getCreditRecharge({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCreditUsage = (
  queryClient: QueryClient,
  clientOptions: Options<GetCreditUsageData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCreditUsageKeyFn(clientOptions),
    queryFn: () => getCreditUsage({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCreditBalance = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCreditBalanceKeyFn(clientOptions),
    queryFn: () => getCreditBalance({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCreditUsageByResultId = (
  queryClient: QueryClient,
  clientOptions: Options<GetCreditUsageByResultIdData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCreditUsageByResultIdKeyFn(clientOptions),
    queryFn: () => getCreditUsageByResultId({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCreditUsageByExecutionId = (
  queryClient: QueryClient,
  clientOptions: Options<GetCreditUsageByExecutionIdData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCreditUsageByExecutionIdKeyFn(clientOptions),
    queryFn: () =>
      getCreditUsageByExecutionId({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCreditUsageByCanvasId = (
  queryClient: QueryClient,
  clientOptions: Options<GetCreditUsageByCanvasIdData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCreditUsageByCanvasIdKeyFn(clientOptions),
    queryFn: () => getCreditUsageByCanvasId({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetCanvasCommissionByCanvasId = (
  queryClient: QueryClient,
  clientOptions: Options<GetCanvasCommissionByCanvasIdData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetCanvasCommissionByCanvasIdKeyFn(clientOptions),
    queryFn: () =>
      getCanvasCommissionByCanvasId({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListInvitationCodes = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListInvitationCodesKeyFn(clientOptions),
    queryFn: () => listInvitationCodes({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetSubscriptionPlans = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetSubscriptionPlansKeyFn(clientOptions),
    queryFn: () => getSubscriptionPlans({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetSubscriptionUsage = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetSubscriptionUsageKeyFn(clientOptions),
    queryFn: () => getSubscriptionUsage({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListModels = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListModelsKeyFn(clientOptions),
    queryFn: () => listModels({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListProviders = (
  queryClient: QueryClient,
  clientOptions: Options<ListProvidersData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListProvidersKeyFn(clientOptions),
    queryFn: () => listProviders({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListProviderItems = (
  queryClient: QueryClient,
  clientOptions: Options<ListProviderItemsData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListProviderItemsKeyFn(clientOptions),
    queryFn: () => listProviderItems({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListProviderItemOptions = (
  queryClient: QueryClient,
  clientOptions: Options<ListProviderItemOptionsData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListProviderItemOptionsKeyFn(clientOptions),
    queryFn: () => listProviderItemOptions({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListTools = (
  queryClient: QueryClient,
  clientOptions: Options<ListToolsData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListToolsKeyFn(clientOptions),
    queryFn: () => listTools({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListUserTools = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListUserToolsKeyFn(clientOptions),
    queryFn: () => listUserTools({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListToolsetInventory = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListToolsetInventoryKeyFn(clientOptions),
    queryFn: () => listToolsetInventory({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListToolsets = (
  queryClient: QueryClient,
  clientOptions: Options<ListToolsetsData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListToolsetsKeyFn(clientOptions),
    queryFn: () => listToolsets({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseExportToolsetDefinitions = (
  queryClient: QueryClient,
  clientOptions: Options<ExportToolsetDefinitionsData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseExportToolsetDefinitionsKeyFn(clientOptions),
    queryFn: () => exportToolsetDefinitions({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetToolCallResult = (
  queryClient: QueryClient,
  clientOptions: Options<GetToolCallResultData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetToolCallResultKeyFn(clientOptions),
    queryFn: () => getToolCallResult({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetComposioConnectionStatus = (
  queryClient: QueryClient,
  clientOptions: Options<GetComposioConnectionStatusData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetComposioConnectionStatusKeyFn(clientOptions),
    queryFn: () =>
      getComposioConnectionStatus({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseServeStatic = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseServeStaticKeyFn(clientOptions),
    queryFn: () => serveStatic({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetPromptSuggestions = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetPromptSuggestionsKeyFn(clientOptions),
    queryFn: () => getPromptSuggestions({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetAvailableVouchers = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetAvailableVouchersKeyFn(clientOptions),
    queryFn: () => getAvailableVouchers({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListUserVouchers = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListUserVouchersKeyFn(clientOptions),
    queryFn: () => listUserVouchers({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseVerifyVoucherInvitation = (
  queryClient: QueryClient,
  clientOptions: Options<VerifyVoucherInvitationData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseVerifyVoucherInvitationKeyFn(clientOptions),
    queryFn: () => verifyVoucherInvitation({ ...clientOptions }).then((response) => response.data),
  });
