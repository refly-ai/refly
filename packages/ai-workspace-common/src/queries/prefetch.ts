// generated with @7nohe/openapi-react-query-codegen@2.0.0-beta.3

import { type Options } from '@hey-api/client-fetch';
import { type QueryClient } from '@tanstack/react-query';
import {
  checkSettingsField,
  exportCanvas,
  exportDocument,
  getActionResult,
  getAuthConfig,
  getCanvasData,
  getCanvasDetail,
  getCodeArtifactDetail,
  getCollabToken,
  getDocumentDetail,
  getMediaResult,
  getPageByCanvasId,
  getPageDetail,
  getPilotSessionDetail,
  getProjectDetail,
  getResourceDetail,
  getSettings,
  getSubscriptionPlans,
  getSubscriptionUsage,
  listActions,
  listCanvases,
  listCanvasTemplateCategories,
  listCanvasTemplates,
  listDocuments,
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
  serveStatic,
} from '../requests/services.gen';
import {
  CheckSettingsFieldData,
  ExportCanvasData,
  ExportDocumentData,
  GetActionResultData,
  GetCanvasDataData,
  GetCanvasDetailData,
  GetCodeArtifactDetailData,
  GetDocumentDetailData,
  GetMediaResultData,
  GetPageByCanvasIdData,
  GetPageDetailData,
  GetPilotSessionDetailData,
  GetProjectDetailData,
  GetResourceDetailData,
  ListCanvasesData,
  ListCanvasTemplatesData,
  ListDocumentsData,
  ListLabelClassesData,
  ListLabelInstancesData,
  ListMcpServersData,
  ListPagesData,
  ListPilotSessionsData,
  ListProjectsData,
  ListProviderItemOptionsData,
  ListProviderItemsData,
  ListProvidersData,
  ListResourcesData,
  ListSharesData,
  ListSkillInstancesData,
  ListSkillTriggersData,
} from '../requests/types.gen';
import * as Common from './common';
export const prefetchUseListMcpServers = (
  queryClient: QueryClient,
  clientOptions: Options<ListMcpServersData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListMcpServersKeyFn(clientOptions),
    queryFn: () => listMcpServers({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListPages = (
  queryClient: QueryClient,
  clientOptions: Options<ListPagesData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListPagesKeyFn(clientOptions),
    queryFn: () => listPages({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetPageDetail = (
  queryClient: QueryClient,
  clientOptions: Options<GetPageDetailData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetPageDetailKeyFn(clientOptions),
    queryFn: () => getPageDetail({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetPageByCanvasId = (
  queryClient: QueryClient,
  clientOptions: Options<GetPageByCanvasIdData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetPageByCanvasIdKeyFn(clientOptions),
    queryFn: () => getPageByCanvasId({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetAuthConfig = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetAuthConfigKeyFn(clientOptions),
    queryFn: () => getAuthConfig({ ...clientOptions }).then((response) => response.data),
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
export const prefetchUseListProjects = (
  queryClient: QueryClient,
  clientOptions: Options<ListProjectsData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListProjectsKeyFn(clientOptions),
    queryFn: () => listProjects({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetProjectDetail = (
  queryClient: QueryClient,
  clientOptions: Options<GetProjectDetailData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetProjectDetailKeyFn(clientOptions),
    queryFn: () => getProjectDetail({ ...clientOptions }).then((response) => response.data),
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
export const prefetchUseListLabelClasses = (
  queryClient: QueryClient,
  clientOptions: Options<ListLabelClassesData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListLabelClassesKeyFn(clientOptions),
    queryFn: () => listLabelClasses({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListLabelInstances = (
  queryClient: QueryClient,
  clientOptions: Options<ListLabelInstancesData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListLabelInstancesKeyFn(clientOptions),
    queryFn: () => listLabelInstances({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListActions = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListActionsKeyFn(clientOptions),
    queryFn: () => listActions({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetActionResult = (
  queryClient: QueryClient,
  clientOptions: Options<GetActionResultData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetActionResultKeyFn(clientOptions),
    queryFn: () => getActionResult({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListSkills = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListSkillsKeyFn(clientOptions),
    queryFn: () => listSkills({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListSkillInstances = (
  queryClient: QueryClient,
  clientOptions: Options<ListSkillInstancesData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListSkillInstancesKeyFn(clientOptions),
    queryFn: () => listSkillInstances({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListSkillTriggers = (
  queryClient: QueryClient,
  clientOptions: Options<ListSkillTriggersData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListSkillTriggersKeyFn(clientOptions),
    queryFn: () => listSkillTriggers({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetMediaResult = (
  queryClient: QueryClient,
  clientOptions: Options<GetMediaResultData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetMediaResultKeyFn(clientOptions),
    queryFn: () => getMediaResult({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseListPilotSessions = (
  queryClient: QueryClient,
  clientOptions: Options<ListPilotSessionsData, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseListPilotSessionsKeyFn(clientOptions),
    queryFn: () => listPilotSessions({ ...clientOptions }).then((response) => response.data),
  });
export const prefetchUseGetPilotSessionDetail = (
  queryClient: QueryClient,
  clientOptions: Options<GetPilotSessionDetailData, true>,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGetPilotSessionDetailKeyFn(clientOptions),
    queryFn: () => getPilotSessionDetail({ ...clientOptions }).then((response) => response.data),
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
export const prefetchUseServeStatic = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseServeStaticKeyFn(clientOptions),
    queryFn: () => serveStatic({ ...clientOptions }).then((response) => response.data),
  });
