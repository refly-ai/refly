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
export const ensureUseListMcpServersData = (
  queryClient: QueryClient,
  clientOptions: Options<ListMcpServersData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListMcpServersKeyFn(clientOptions),
    queryFn: () => listMcpServers({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListPagesData = (
  queryClient: QueryClient,
  clientOptions: Options<ListPagesData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListPagesKeyFn(clientOptions),
    queryFn: () => listPages({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetPageDetailData = (
  queryClient: QueryClient,
  clientOptions: Options<GetPageDetailData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetPageDetailKeyFn(clientOptions),
    queryFn: () => getPageDetail({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetPageByCanvasIdData = (
  queryClient: QueryClient,
  clientOptions: Options<GetPageByCanvasIdData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetPageByCanvasIdKeyFn(clientOptions),
    queryFn: () => getPageByCanvasId({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetAuthConfigData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetAuthConfigKeyFn(clientOptions),
    queryFn: () => getAuthConfig({ ...clientOptions }).then((response) => response.data),
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
export const ensureUseListProjectsData = (
  queryClient: QueryClient,
  clientOptions: Options<ListProjectsData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListProjectsKeyFn(clientOptions),
    queryFn: () => listProjects({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetProjectDetailData = (
  queryClient: QueryClient,
  clientOptions: Options<GetProjectDetailData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetProjectDetailKeyFn(clientOptions),
    queryFn: () => getProjectDetail({ ...clientOptions }).then((response) => response.data),
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
export const ensureUseListLabelClassesData = (
  queryClient: QueryClient,
  clientOptions: Options<ListLabelClassesData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListLabelClassesKeyFn(clientOptions),
    queryFn: () => listLabelClasses({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListLabelInstancesData = (
  queryClient: QueryClient,
  clientOptions: Options<ListLabelInstancesData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListLabelInstancesKeyFn(clientOptions),
    queryFn: () => listLabelInstances({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListActionsData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListActionsKeyFn(clientOptions),
    queryFn: () => listActions({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetActionResultData = (
  queryClient: QueryClient,
  clientOptions: Options<GetActionResultData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetActionResultKeyFn(clientOptions),
    queryFn: () => getActionResult({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListSkillsData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListSkillsKeyFn(clientOptions),
    queryFn: () => listSkills({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListSkillInstancesData = (
  queryClient: QueryClient,
  clientOptions: Options<ListSkillInstancesData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListSkillInstancesKeyFn(clientOptions),
    queryFn: () => listSkillInstances({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListSkillTriggersData = (
  queryClient: QueryClient,
  clientOptions: Options<ListSkillTriggersData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListSkillTriggersKeyFn(clientOptions),
    queryFn: () => listSkillTriggers({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseListPilotSessionsData = (
  queryClient: QueryClient,
  clientOptions: Options<ListPilotSessionsData, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseListPilotSessionsKeyFn(clientOptions),
    queryFn: () => listPilotSessions({ ...clientOptions }).then((response) => response.data),
  });
export const ensureUseGetPilotSessionDetailData = (
  queryClient: QueryClient,
  clientOptions: Options<GetPilotSessionDetailData, true>,
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseGetPilotSessionDetailKeyFn(clientOptions),
    queryFn: () => getPilotSessionDetail({ ...clientOptions }).then((response) => response.data),
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
export const ensureUseServeStaticData = (
  queryClient: QueryClient,
  clientOptions: Options<unknown, true> = {},
) =>
  queryClient.ensureQueryData({
    queryKey: Common.UseServeStaticKeyFn(clientOptions),
    queryFn: () => serveStatic({ ...clientOptions }).then((response) => response.data),
  });
