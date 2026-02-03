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
export const ensureUseListMcpServersData = (
  queryClient: QueryClient,
  clientOptions: Options<ListMcpServersData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListMcpServersKeyFn(clientOptions),
    queryFn: () => listMcpServers({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetAuthConfigData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetAuthConfigKeyFn(clientOptions),
    queryFn: () => getAuthConfig({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListAccountsData = (
  queryClient: QueryClient,
  clientOptions: Options<ListAccountsData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListAccountsKeyFn(clientOptions),
    queryFn: () => listAccounts({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseCheckToolOauthStatusData = (
  queryClient: QueryClient,
  clientOptions: Options<CheckToolOauthStatusData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseCheckToolOauthStatusKeyFn(clientOptions),
    queryFn: () => checkToolOauthStatus({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListCliApiKeysData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListCliApiKeysKeyFn(clientOptions),
    queryFn: () => listCliApiKeys({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCollabTokenData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCollabTokenKeyFn(clientOptions),
    queryFn: () => getCollabToken({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListCanvasesData = (
  queryClient: QueryClient,
  clientOptions: Options<ListCanvasesData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListCanvasesKeyFn(clientOptions),
    queryFn: () => listCanvases({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCanvasDetailData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCanvasDetailData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCanvasDetailKeyFn(clientOptions),
    queryFn: () => getCanvasDetail({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCanvasDataData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCanvasDataData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCanvasDataKeyFn(clientOptions),
    queryFn: () => getCanvasData({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseExportCanvasData = (
  queryClient: QueryClient,
  clientOptions: Options<ExportCanvasData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseExportCanvasKeyFn(clientOptions),
    queryFn: () => exportCanvas({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCanvasStateData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCanvasStateData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCanvasStateKeyFn(clientOptions),
    queryFn: () => getCanvasState({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCanvasTransactionsData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCanvasTransactionsData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCanvasTransactionsKeyFn(clientOptions),
    queryFn: () => getCanvasTransactions({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetWorkflowVariablesData = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowVariablesData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetWorkflowVariablesKeyFn(clientOptions),
    queryFn: () => getWorkflowVariables({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListDriveFilesData = (
  queryClient: QueryClient,
  clientOptions: Options<ListDriveFilesData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListDriveFilesKeyFn(clientOptions),
    queryFn: () => listDriveFiles({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListCanvasTemplatesData = (
  queryClient: QueryClient,
  clientOptions: Options<ListCanvasTemplatesData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListCanvasTemplatesKeyFn(clientOptions),
    queryFn: () => listCanvasTemplates({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListCanvasTemplateCategoriesData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListCanvasTemplateCategoriesKeyFn(clientOptions),
    queryFn: () =>
      listCanvasTemplateCategories({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListResourcesData = (
  queryClient: QueryClient,
  clientOptions: Options<ListResourcesData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListResourcesKeyFn(clientOptions),
    queryFn: () => listResources({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetResourceDetailData = (
  queryClient: QueryClient,
  clientOptions: Options<GetResourceDetailData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetResourceDetailKeyFn(clientOptions),
    queryFn: () => getResourceDetail({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListDocumentsData = (
  queryClient: QueryClient,
  clientOptions: Options<ListDocumentsData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListDocumentsKeyFn(clientOptions),
    queryFn: () => listDocuments({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetDocumentDetailData = (
  queryClient: QueryClient,
  clientOptions: Options<GetDocumentDetailData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetDocumentDetailKeyFn(clientOptions),
    queryFn: () => getDocumentDetail({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseExportDocumentData = (
  queryClient: QueryClient,
  clientOptions: Options<ExportDocumentData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseExportDocumentKeyFn(clientOptions),
    queryFn: () => exportDocument({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetExportJobStatusData = (
  queryClient: QueryClient,
  clientOptions: Options<GetExportJobStatusData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetExportJobStatusKeyFn(clientOptions),
    queryFn: () => getExportJobStatus({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseDownloadExportJobResultData = (
  queryClient: QueryClient,
  clientOptions: Options<DownloadExportJobResultData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseDownloadExportJobResultKeyFn(clientOptions),
    queryFn: () => downloadExportJobResult({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListCodeArtifactsData = (
  queryClient: QueryClient,
  clientOptions: Options<ListCodeArtifactsData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListCodeArtifactsKeyFn(clientOptions),
    queryFn: () => listCodeArtifacts({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCodeArtifactDetailData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCodeArtifactDetailData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCodeArtifactDetailKeyFn(clientOptions),
    queryFn: () => getCodeArtifactDetail({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListSharesData = (
  queryClient: QueryClient,
  clientOptions: Options<ListSharesData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListSharesKeyFn(clientOptions),
    queryFn: () => listShares({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetActionResultData = (
  queryClient: QueryClient,
  clientOptions: Options<GetActionResultData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetActionResultKeyFn(clientOptions),
    queryFn: () => getActionResult({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListCopilotSessionsData = (
  queryClient: QueryClient,
  clientOptions: Options<ListCopilotSessionsData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListCopilotSessionsKeyFn(clientOptions),
    queryFn: () => listCopilotSessions({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCopilotSessionDetailData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCopilotSessionDetailData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCopilotSessionDetailKeyFn(clientOptions),
    queryFn: () => getCopilotSessionDetail({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListWorkflowExecutionsData = (
  queryClient: QueryClient,
  clientOptions: Options<ListWorkflowExecutionsData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListWorkflowExecutionsKeyFn(clientOptions),
    queryFn: () => listWorkflowExecutions({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetWorkflowDetailData = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowDetailData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetWorkflowDetailKeyFn(clientOptions),
    queryFn: () => getWorkflowDetail({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetWorkflowPlanDetailData = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowPlanDetailData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetWorkflowPlanDetailKeyFn(clientOptions),
    queryFn: () => getWorkflowPlanDetail({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetWorkflowAppDetailData = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowAppDetailData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetWorkflowAppDetailKeyFn(clientOptions),
    queryFn: () => getWorkflowAppDetail({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListWorkflowAppsData = (
  queryClient: QueryClient,
  clientOptions: Options<ListWorkflowAppsData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListWorkflowAppsKeyFn(clientOptions),
    queryFn: () => listWorkflowApps({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetTemplateGenerationStatusData = (
  queryClient: QueryClient,
  clientOptions: Options<GetTemplateGenerationStatusData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetTemplateGenerationStatusKeyFn(clientOptions),
    queryFn: () =>
      getTemplateGenerationStatus({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetWebhookConfigData = (
  queryClient: QueryClient,
  clientOptions: Options<GetWebhookConfigData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetWebhookConfigKeyFn(clientOptions),
    queryFn: () => getWebhookConfig({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetWebhookHistoryData = (
  queryClient: QueryClient,
  clientOptions: Options<GetWebhookHistoryData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetWebhookHistoryKeyFn(clientOptions),
    queryFn: () => getWebhookHistory({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetOpenapiConfigData = (
  queryClient: QueryClient,
  clientOptions: Options<GetOpenapiConfigData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetOpenapiConfigKeyFn(clientOptions),
    queryFn: () => getOpenapiConfig({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseSearchWorkflowsViaApiData = (
  queryClient: QueryClient,
  clientOptions: Options<SearchWorkflowsViaApiData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseSearchWorkflowsViaApiKeyFn(clientOptions),
    queryFn: () => searchWorkflowsViaApi({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetWorkflowDetailViaApiData = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowDetailViaApiData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetWorkflowDetailViaApiKeyFn(clientOptions),
    queryFn: () => getWorkflowDetailViaApi({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetWorkflowStatusViaApiData = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowStatusViaApiData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetWorkflowStatusViaApiKeyFn(clientOptions),
    queryFn: () => getWorkflowStatusViaApi({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetWorkflowOutputData = (
  queryClient: QueryClient,
  clientOptions: Options<GetWorkflowOutputData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetWorkflowOutputKeyFn(clientOptions),
    queryFn: () => getWorkflowOutput({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetSettingsData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetSettingsKeyFn(clientOptions),
    queryFn: () => getSettings({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseCheckSettingsFieldData = (
  queryClient: QueryClient,
  clientOptions: Options<CheckSettingsFieldData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseCheckSettingsFieldKeyFn(clientOptions),
    queryFn: () => checkSettingsField({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetFormDefinitionData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetFormDefinitionKeyFn(clientOptions),
    queryFn: () => getFormDefinition({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCreditRechargeData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCreditRechargeData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCreditRechargeKeyFn(clientOptions),
    queryFn: () => getCreditRecharge({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCreditUsageData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCreditUsageData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCreditUsageKeyFn(clientOptions),
    queryFn: () => getCreditUsage({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCreditBalanceData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCreditBalanceKeyFn(clientOptions),
    queryFn: () => getCreditBalance({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCreditUsageByResultIdData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCreditUsageByResultIdData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCreditUsageByResultIdKeyFn(clientOptions),
    queryFn: () => getCreditUsageByResultId({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCreditUsageByExecutionIdData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCreditUsageByExecutionIdData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCreditUsageByExecutionIdKeyFn(clientOptions),
    queryFn: () =>
      getCreditUsageByExecutionId({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCreditUsageByCanvasIdData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCreditUsageByCanvasIdData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCreditUsageByCanvasIdKeyFn(clientOptions),
    queryFn: () => getCreditUsageByCanvasId({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetCanvasCommissionByCanvasIdData = (
  queryClient: QueryClient,
  clientOptions: Options<GetCanvasCommissionByCanvasIdData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetCanvasCommissionByCanvasIdKeyFn(clientOptions),
    queryFn: () =>
      getCanvasCommissionByCanvasId({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListInvitationCodesData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListInvitationCodesKeyFn(clientOptions),
    queryFn: () => listInvitationCodes({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetSubscriptionPlansData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetSubscriptionPlansKeyFn(clientOptions),
    queryFn: () => getSubscriptionPlans({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetSubscriptionUsageData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetSubscriptionUsageKeyFn(clientOptions),
    queryFn: () => getSubscriptionUsage({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListModelsData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListModelsKeyFn(clientOptions),
    queryFn: () => listModels({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListProvidersData = (
  queryClient: QueryClient,
  clientOptions: Options<ListProvidersData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListProvidersKeyFn(clientOptions),
    queryFn: () => listProviders({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListProviderItemsData = (
  queryClient: QueryClient,
  clientOptions: Options<ListProviderItemsData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListProviderItemsKeyFn(clientOptions),
    queryFn: () => listProviderItems({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListProviderItemOptionsData = (
  queryClient: QueryClient,
  clientOptions: Options<ListProviderItemOptionsData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListProviderItemOptionsKeyFn(clientOptions),
    queryFn: () => listProviderItemOptions({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListToolsData = (
  queryClient: QueryClient,
  clientOptions: Options<ListToolsData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListToolsKeyFn(clientOptions),
    queryFn: () => listTools({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListUserToolsData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListUserToolsKeyFn(clientOptions),
    queryFn: () => listUserTools({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListToolsetInventoryData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListToolsetInventoryKeyFn(clientOptions),
    queryFn: () => listToolsetInventory({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListToolsetsData = (
  queryClient: QueryClient,
  clientOptions: Options<ListToolsetsData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListToolsetsKeyFn(clientOptions),
    queryFn: () => listToolsets({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseExportToolsetDefinitionsData = (
  queryClient: QueryClient,
  clientOptions: Options<ExportToolsetDefinitionsData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseExportToolsetDefinitionsKeyFn(clientOptions),
    queryFn: () => exportToolsetDefinitions({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetToolCallResultData = (
  queryClient: QueryClient,
  clientOptions: Options<GetToolCallResultData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetToolCallResultKeyFn(clientOptions),
    queryFn: () => getToolCallResult({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetComposioConnectionStatusData = (
  queryClient: QueryClient,
  clientOptions: Options<GetComposioConnectionStatusData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetComposioConnectionStatusKeyFn(clientOptions),
    queryFn: () =>
      getComposioConnectionStatus({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseServeStaticData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseServeStaticKeyFn(clientOptions),
    queryFn: () => serveStatic({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetPromptSuggestionsData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetPromptSuggestionsKeyFn(clientOptions),
    queryFn: () => getPromptSuggestions({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetAvailableVouchersData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetAvailableVouchersKeyFn(clientOptions),
    queryFn: () => getAvailableVouchers({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListUserVouchersData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListUserVouchersKeyFn(clientOptions),
    queryFn: () => listUserVouchers({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseVerifyVoucherInvitationData = (
  queryClient: QueryClient,
  clientOptions: Options<VerifyVoucherInvitationData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseVerifyVoucherInvitationKeyFn(clientOptions),
    queryFn: () => verifyVoucherInvitation({ ...clientOptions }).then((response) => response.data),
  });
