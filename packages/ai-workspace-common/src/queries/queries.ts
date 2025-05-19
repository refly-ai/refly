// generated with @7nohe/openapi-react-query-codegen@2.0.0-beta.3

import { type Options } from '@hey-api/client-fetch';
import { useMutation, UseMutationOptions, useQuery, UseQueryOptions } from '@tanstack/react-query';
import {
  addNodesToCanvasPage,
  addReferences,
  autoNameCanvas,
  batchCreateProviderItems,
  batchCreateResource,
  batchUpdateDocument,
  batchUpdateProviderItems,
  checkSettingsField,
  checkVerification,
  convert,
  createCanvas,
  createCanvasTemplate,
  createCheckoutSession,
  createCodeArtifact,
  createDocument,
  createLabelClass,
  createLabelInstance,
  createMcpServer,
  createPortalSession,
  createProject,
  createProvider,
  createProviderItem,
  createResource,
  createResourceWithFile,
  createShare,
  createSkillInstance,
  createSkillTrigger,
  createVerification,
  deleteCanvas,
  deleteDocument,
  deleteLabelClass,
  deleteLabelInstance,
  deleteMcpServer,
  deletePage,
  deletePageNode,
  deleteProject,
  deleteProjectItems,
  deleteProvider,
  deleteProviderItem,
  deleteReferences,
  deleteResource,
  deleteShare,
  deleteSkillInstance,
  deleteSkillTrigger,
  duplicateCanvas,
  duplicateShare,
  emailLogin,
  emailSignup,
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
  getProjectDetail,
  getResourceDetail,
  getSettings,
  getSubscriptionPlans,
  getSubscriptionUsage,
  importCanvas,
  invokeSkill,
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
  listProjects,
  listProviderItemOptions,
  listProviderItems,
  listProviders,
  listResources,
  listShares,
  listSkillInstances,
  listSkills,
  listSkillTriggers,
  logout,
  multiLingualWebSearch,
  pinSkillInstance,
  queryReferences,
  refreshToken,
  reindexResource,
  resendVerification,
  scrape,
  search,
  serveStatic,
  sharePage,
  streamInvokeSkill,
  unpinSkillInstance,
  updateCanvas,
  updateCanvasTemplate,
  updateCodeArtifact,
  updateDocument,
  updateLabelClass,
  updateLabelInstance,
  updateMcpServer,
  updatePage,
  updateProject,
  updateProjectItems,
  updateProvider,
  updateProviderItem,
  updateResource,
  updateSettings,
  updateSkillInstance,
  updateSkillTrigger,
  upload,
  validateMcpServer,
} from '../requests/services.gen';
import {
  AddNodesToCanvasPageData,
  AddNodesToCanvasPageError,
  AddReferencesData,
  AddReferencesError,
  AutoNameCanvasData,
  AutoNameCanvasError,
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
  CheckVerificationData,
  CheckVerificationError,
  ConvertData,
  ConvertError,
  CreateCanvasData,
  CreateCanvasError,
  CreateCanvasTemplateData,
  CreateCanvasTemplateError,
  CreateCheckoutSessionData,
  CreateCheckoutSessionError,
  CreateCodeArtifactData,
  CreateCodeArtifactError,
  CreateDocumentData,
  CreateDocumentError,
  CreateLabelClassData,
  CreateLabelClassError,
  CreateLabelInstanceData,
  CreateLabelInstanceError,
  CreateMcpServerData,
  CreateMcpServerError,
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
  CreateVerificationData,
  CreateVerificationError,
  DeleteCanvasData,
  DeleteCanvasError,
  DeleteDocumentData,
  DeleteDocumentError,
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
  DeleteReferencesData,
  DeleteReferencesError,
  DeleteResourceData,
  DeleteResourceError,
  DeleteShareData,
  DeleteShareError,
  DeleteSkillInstanceData,
  DeleteSkillInstanceError,
  DeleteSkillTriggerData,
  DeleteSkillTriggerError,
  DuplicateCanvasData,
  DuplicateCanvasError,
  DuplicateShareData,
  DuplicateShareError,
  EmailLoginData,
  EmailLoginError,
  EmailSignupData,
  EmailSignupError,
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
  GetCodeArtifactDetailData,
  GetCodeArtifactDetailError,
  GetCollabTokenError,
  GetDocumentDetailData,
  GetDocumentDetailError,
  GetPageByCanvasIdData,
  GetPageByCanvasIdError,
  GetPageDetailData,
  GetPageDetailError,
  GetProjectDetailData,
  GetProjectDetailError,
  GetResourceDetailData,
  GetResourceDetailError,
  GetSettingsError,
  GetSubscriptionPlansError,
  GetSubscriptionUsageError,
  ImportCanvasData,
  ImportCanvasError,
  InvokeSkillData,
  InvokeSkillError,
  ListActionsError,
  ListCanvasesData,
  ListCanvasesError,
  ListCanvasTemplateCategoriesError,
  ListCanvasTemplatesData,
  ListCanvasTemplatesError,
  ListDocumentsData,
  ListDocumentsError,
  ListLabelClassesData,
  ListLabelClassesError,
  ListLabelInstancesData,
  ListLabelInstancesError,
  ListMcpServersData,
  ListMcpServersError,
  ListModelsError,
  ListPagesData,
  ListPagesError,
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
  LogoutError,
  MultiLingualWebSearchData,
  MultiLingualWebSearchError,
  PinSkillInstanceData,
  PinSkillInstanceError,
  QueryReferencesData,
  QueryReferencesError,
  RefreshTokenError,
  ReindexResourceData,
  ReindexResourceError,
  ResendVerificationData,
  ResendVerificationError,
  ScrapeData,
  ScrapeError,
  SearchData,
  SearchError,
  ServeStaticError,
  SharePageData,
  SharePageError,
  StreamInvokeSkillData,
  StreamInvokeSkillError,
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
  UpdateLabelClassData,
  UpdateLabelClassError,
  UpdateLabelInstanceData,
  UpdateLabelInstanceError,
  UpdateMcpServerData,
  UpdateMcpServerError,
  UpdatePageData,
  UpdatePageError,
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
export const useQueryReferences = <
  TData = Common.QueryReferencesMutationResult,
  TError = QueryReferencesError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<QueryReferencesData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<QueryReferencesData, true>, TContext>({
    mutationKey: Common.UseQueryReferencesKeyFn(mutationKey),
    mutationFn: (clientOptions) => queryReferences(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useAddReferences = <
  TData = Common.AddReferencesMutationResult,
  TError = AddReferencesError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<AddReferencesData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<AddReferencesData, true>, TContext>({
    mutationKey: Common.UseAddReferencesKeyFn(mutationKey),
    mutationFn: (clientOptions) => addReferences(clientOptions) as unknown as Promise<TData>,
    ...options,
  });
export const useDeleteReferences = <
  TData = Common.DeleteReferencesMutationResult,
  TError = DeleteReferencesError,
  TQueryKey extends Array<unknown> = unknown[],
  TContext = unknown,
>(
  mutationKey?: TQueryKey,
  options?: Omit<
    UseMutationOptions<TData, TError, Options<DeleteReferencesData, true>, TContext>,
    'mutationKey' | 'mutationFn'
  >,
) =>
  useMutation<TData, TError, Options<DeleteReferencesData, true>, TContext>({
    mutationKey: Common.UseDeleteReferencesKeyFn(mutationKey),
    mutationFn: (clientOptions) => deleteReferences(clientOptions) as unknown as Promise<TData>,
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
