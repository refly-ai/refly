import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSiderStoreShallow } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useUserStore } from '@refly/stores';

export const DATA_NUM = 100;

export const useHandleSiderData = (initData?: boolean) => {
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
  const hasInitialized = useRef(false);

  const requestCanvasList = useCallback(async () => {
    const { data: res, error } = await getClient().listCanvases({
      query: { page: 1, pageSize: DATA_NUM },
    });
    if (error) {
      console.error('getCanvasList error', error);
      return [];
    }
    return res?.data || [];
  }, []);

  const getCanvasList = useCallback(
    async (setLoading?: boolean) => {
      setLoading && setIsLoadingCanvas(true);

      const canvases = await requestCanvasList();
      setLoading && setIsLoadingCanvas(false);
      const formattedCanvases = canvases.map((canvas) => ({
        id: canvas.canvasId,
        name: canvas.title,
        createdAt: canvas.createdAt,
        updatedAt: canvas.updatedAt,
        type: 'canvas' as const,
        owner: canvas.owner,
        usedToolsets: canvas.usedToolsets,
        shareRecord: canvas.shareRecord,
      }));
      updateCanvasList(formattedCanvases);
      return formattedCanvases;
    },
    [requestCanvasList, updateCanvasList],
  );

  const requestProjectsList = useCallback(async () => {
    const { isLogin } = useUserStore.getState();
    if (!isLogin) return;

    const { data: res, error } = await getClient().listProjects({
      query: { page: 1, pageSize: DATA_NUM },
    });
    if (error) {
      console.error('getProjectsList error', error);
      return [];
    }
    return res?.data || [];
  }, []);

  const getProjectsList = useCallback(
    async (setLoading?: boolean) => {
      if (setLoading) {
        setIsLoadingProjects(true);
      }

      try {
        const projects = await requestProjectsList();

        if (!projects) return [];

        const formattedProjects = projects.map((project) => ({
          id: project.projectId,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt ?? '',
          updatedAt: project.updatedAt ?? '',
          coverUrl: project.coverUrl,
          type: 'project' as const,
        }));
        updateProjectsList(formattedProjects);
        return formattedProjects;
      } finally {
        if (setLoading) {
          setIsLoadingProjects(false);
        }
      }
    },
    [requestProjectsList, updateProjectsList],
  );

  const getResourceList = useCallback(async () => {
    if (isLoadingResource) return;
    setIsLoadingResource(true);
    const { data: res, error } = await getClient().listResources({
      query: { page: 1, pageSize: 1000 },
    });
    setIsLoadingResource(false);
    if (error) {
      console.error('getCanvasList error', error);
      return [];
    }
    return res?.data || [];
  }, [isLoadingResource]);

  const getDocumentList = useCallback(async () => {
    if (isLoadingDocument) return;
    setIsLoadingDocument(true);
    const { data: res, error } = await getClient().listDocuments({
      query: { page: 1, pageSize: 1000 },
    });
    setIsLoadingDocument(false);
    if (error) {
      console.error('getCanvasList error', error);
      return [];
    }
    return res?.data || [];
  }, [isLoadingDocument]);

  const getSourceList = useCallback(async () => {
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
    updateSourceList(sorted as any);
  }, [getResourceList, getDocumentList, updateSourceList]);

  const loadingSource = useMemo(
    () => isLoadingResource || isLoadingDocument,
    [isLoadingResource, isLoadingDocument],
  );

  const loadSiderData = async (setLoading?: boolean) => {
    getCanvasList(setLoading);
    getProjectsList(setLoading);
  };

  useEffect(() => {
    if (initData && !hasInitialized.current) {
      hasInitialized.current = true;
      loadSiderData(true);
    }
  }, [initData]);

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
