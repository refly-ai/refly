import { useEffect, useMemo, useState } from 'react';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { sourceObject } from '@refly-packages/ai-workspace-common/components/project/project-directory';

const DATA_NUM = 6;
const DATA_NUM_CANVAS_FOR_PROJECT = 1000;

export const useHandleSiderData = (initData?: boolean) => {
  const { projectId } = useGetProjectCanvasId();
  const {
    canvasList,
    updateCanvasList,
    sourceList,
    updateSourceList,
    projectsList,
    updateProjectsList,
  } = useSiderStoreShallow((state) => ({
    canvasList: state.canvasList,
    updateCanvasList: state.setCanvasList,
    sourceList: state.sourceList,
    updateSourceList: state.setSourceList,
    projectsList: state.projectsList,
    updateProjectsList: state.setProjectsList,
  }));

  const [isLoadingCanvas, setIsLoadingCanvas] = useState(false);
  const [isLoadingResource, setIsLoadingResource] = useState(false);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  const requestCanvasList = async () => {
    const { data: res, error } = await getClient().listCanvases({
      query: { page: 1, pageSize: projectId ? DATA_NUM_CANVAS_FOR_PROJECT : DATA_NUM, projectId },
    });
    if (error) {
      console.error('getCanvasList error', error);
      return [];
    }
    return res?.data || [];
  };

  const getCanvasList = async (setLoading?: boolean) => {
    setLoading && setIsLoadingCanvas(true);

    const canvases = await requestCanvasList();
    setLoading && setIsLoadingCanvas(false);
    const formattedCanvases = canvases.map((canvas) => ({
      id: canvas.canvasId,
      name: canvas.title,
      updatedAt: canvas.updatedAt,
      type: 'canvas' as const,
    }));
    updateCanvasList(formattedCanvases);
    return formattedCanvases;
  };

  const requestProjectsList = async () => {
    const { data: res, error } = await getClient().listProjects({
      query: { page: 1, pageSize: DATA_NUM },
    });
    if (error) {
      console.error('getProjectsList error', error);
      return [];
    }
    return res?.data || [];
  };

  const getProjectsList = async (setLoading?: boolean) => {
    setLoading && setIsLoadingProjects(true);

    const projects = await requestProjectsList();
    setLoading && setIsLoadingProjects(false);
    const formattedProjects = projects.map((project) => ({
      id: project.projectId,
      name: project.name,
      description: project.description,
      updatedAt: project.updatedAt,
      coverUrl: project.coverUrl,
      type: 'project' as const,
    }));
    updateProjectsList(formattedProjects);
    return formattedProjects;
  };

  const getResourceList = async () => {
    if (isLoadingResource) return;
    setIsLoadingResource(true);
    const { data: res, error } = await getClient().listResources({
      query: { page: 1, pageSize: 1000, projectId },
    });
    setIsLoadingResource(false);
    if (error) {
      console.error('getCanvasList error', error);
      return [];
    }
    return res?.data || [];
  };

  const getDocumentList = async () => {
    if (isLoadingDocument) return;
    setIsLoadingDocument(true);
    const { data: res, error } = await getClient().listDocuments({
      query: { page: 1, pageSize: 1000, projectId },
    });
    setIsLoadingDocument(false);
    if (error) {
      console.error('getCanvasList error', error);
      return [];
    }
    return res?.data || [];
  };

  const getSourceList = async () => {
    const resources = await getResourceList();
    const documents = await getDocumentList();

    const docs = (documents || []).map((item) => ({
      ...item,
      entityId: item.docId,
      entityType: 'document',
    }));
    const res = (resources || []).map((item) => ({
      ...item,
      entityId: item.resourceId,
      entityType: 'resource',
    }));

    const merged = [...docs, ...res];

    const sorted = merged.sort((a, b) => {
      const dateA = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });
    updateSourceList(sorted as sourceObject[]);
  };

  const loadingSource = useMemo(
    () => isLoadingResource || isLoadingDocument,
    [isLoadingResource, isLoadingDocument],
  );

  const loadSiderData = async (setLoading?: boolean) => {
    getCanvasList(setLoading);
    getProjectsList(setLoading);
  };

  useEffect(() => {
    if (initData) {
      loadSiderData(true);
      if (projectId) {
        getSourceList();
      }
    }
  }, []);

  return {
    loadSiderData,
    getCanvasList,
    canvasList,
    isLoadingCanvas,
    updateCanvasList,
    getProjectsList,
    projectsList,
    isLoadingProjects,
    updateProjectsList,
    sourceList,
    loadingSource,
    getSourceList,
  };
};
