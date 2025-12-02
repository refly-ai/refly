import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { IndexeddbPersistence } from 'y-indexeddb';
import { editorEmitter } from '@refly/utils/event-emitter/editor';
import { useDocumentStoreShallow } from '@refly/stores';
import { useCollabToken } from '@refly-packages/ai-workspace-common/hooks/use-collab-token';
import { wsServerOrigin } from '@refly/ui-kit';
import { Document } from '@refly/openapi-schema';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import {
  ensureIndexedDbSupport,
  getIndexedDbSupportState,
} from '@refly-packages/ai-workspace-common/utils/indexeddb';

interface DocumentContextType {
  docId: string;
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  localProvider: IndexeddbPersistence | null;
  isLoading: boolean;
  isShareDocumentLoading: boolean;
  readonly: boolean;
}

const DocumentContext = createContext<DocumentContextType | null>(null);

const providerCache = new Map<
  string,
  { remote: HocuspocusProvider; local: IndexeddbPersistence | null }
>();

const getTitleFromYDoc = (ydoc: Y.Doc) => {
  const title = ydoc.getText('title');
  return title.toJSON();
};

export const DocumentProvider = ({
  docId,
  shareId,
  readonly = false,
  children,
}: {
  docId: string;
  shareId?: string;
  readonly?: boolean;
  children: React.ReactNode;
}) => {
  const { token, refreshToken } = useCollabToken();
  const [isLoading, setIsLoading] = useState(true);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [isIndexedDbAvailable, setIsIndexedDbAvailable] = useState(
    () => getIndexedDbSupportState() ?? false,
  );
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const { setDocumentLocalSyncedAt, setDocumentRemoteSyncedAt, updateDocument } =
    useDocumentStoreShallow((state) => ({
      setDocumentLocalSyncedAt: state.setDocumentLocalSyncedAt,
      setDocumentRemoteSyncedAt: state.setDocumentRemoteSyncedAt,
      updateDocument: state.updateDocument,
    }));

  useEffect(() => {
    let isMounted = true;
    ensureIndexedDbSupport()
      .then((result) => {
        if (isMounted) {
          setIsIndexedDbAvailable(result);
        }
      })
      .catch((error) => {
        console.error('Failed to detect IndexedDB availability:', error);
        if (isMounted) {
          setIsIndexedDbAvailable(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch document data from API when in readonly mode
  const { data: documentData, loading: isShareDocumentLoading } =
    useFetchShareData<Document>(shareId);

  // Set document data from API response when in readonly mode
  useEffect(() => {
    if (readonly && documentData) {
      const { title, content } = documentData;
      updateDocument(docId, { docId, title, content });
      setIsLoading(false);
    }
  }, [readonly, documentData, docId, shareId, updateDocument]);

  const updateDocumentData = useCallback(
    (ydoc: Y.Doc) => {
      const title = getTitleFromYDoc(ydoc);
      updateDocument(docId, { docId, title });
    },
    [docId, updateDocument],
  );

  const {
    remote: provider,
    local: localProvider,
    doc,
  } = useMemo(() => {
    // Don't create providers when in readonly mode
    if (readonly) {
      return { remote: null, local: null, doc: null };
    }

    const existingProvider = providerCache.get(docId);
    if (existingProvider) {
      if (!existingProvider.local && isIndexedDbAvailable) {
        try {
          const upgradedLocal = new IndexeddbPersistence(docId, existingProvider.remote.document);
          const upgradedProviders = { remote: existingProvider.remote, local: upgradedLocal };
          providerCache.set(docId, upgradedProviders);
          return { ...upgradedProviders, doc: upgradedProviders.remote.document };
        } catch (error) {
          console.error('Failed to upgrade IndexedDB persistence:', error);
        }
      }

      return { ...existingProvider, doc: existingProvider.remote.document };
    }

    const doc = new Y.Doc();

    const remoteProvider = new HocuspocusProvider({
      url: wsServerOrigin,
      name: docId,
      token,
      document: doc,
      connect: true,
      forceSyncInterval: 5000,
      onAuthenticationFailed: () => {
        console.log('Authentication failed, refreshing token');
        refreshToken();
      },
    });

    let localProvider: IndexeddbPersistence | null = null;
    if (isIndexedDbAvailable) {
      try {
        localProvider = new IndexeddbPersistence(docId, doc);
      } catch (error) {
        console.error('Failed to initialize IndexedDB persistence:', error);
        localProvider = null;
      }
    }

    const providers = { remote: remoteProvider, local: localProvider };
    providerCache.set(docId, providers);

    return { remote: remoteProvider, local: localProvider, doc };
  }, [docId, token, readonly, refreshToken, isIndexedDbAvailable]);

  // Register event handlers for sync events
  useEffect(() => {
    if (readonly || !provider || !localProvider) return;

    const handleRemoteSync = () => {
      setDocumentRemoteSyncedAt(docId, Date.now());
      editorEmitter.emit('editorSynced');
      setIsLoading(false);
    };

    const handleLocalSync = () => {
      updateDocumentData(doc);
      setDocumentLocalSyncedAt(docId, Date.now());
      setIsLoading(false);
    };

    provider.on('synced', handleRemoteSync);
    localProvider.on('synced', handleLocalSync);

    return () => {
      provider.off('synced', handleRemoteSync);
      localProvider.off('synced', handleLocalSync);
    };
  }, [
    docId,
    provider,
    localProvider,
    doc,
    setDocumentRemoteSyncedAt,
    setDocumentLocalSyncedAt,
    updateDocumentData,
    readonly,
  ]);

  // Handle connection retries
  useEffect(() => {
    if (readonly || !provider) return;

    let timeoutId: NodeJS.Timeout;

    const handleConnection = () => {
      if (provider?.status !== 'connected' && connectionAttempts < MAX_RETRIES) {
        timeoutId = setTimeout(() => {
          console.log(`Retrying connection attempt ${connectionAttempts + 1}/${MAX_RETRIES}`);
          provider.connect();
          setConnectionAttempts((prev) => prev + 1);
        }, RETRY_DELAY);
      }
    };

    const handleStatus = ({ status }: { status: string }) => {
      if (status === 'connected') {
        setConnectionAttempts(0);
      } else {
        handleConnection();
      }
    };

    provider.on('status', handleStatus);

    return () => {
      clearTimeout(timeoutId);
      provider.off('status', handleStatus);
    };
  }, [provider, connectionAttempts, readonly, MAX_RETRIES]);

  // Subscribe to yjs document changes
  useEffect(() => {
    if (readonly || !provider || !doc) return;

    let isDestroyed = false;

    // Get reference to the shared types
    const title = doc.getText('title');

    // Connect handler
    const handleConnect = () => {
      if (isDestroyed) return;

      if (provider?.status === 'connected') {
        updateDocumentData(doc);
      }

      const titleObserverCallback = () => {
        if (provider?.status === 'connected') {
          updateDocumentData(doc);
        }
      };

      // Add observer
      title.observe(titleObserverCallback);

      // Store cleanup function
      return () => {
        title.unobserve(titleObserverCallback);
      };
    };

    const cleanup = handleConnect();
    provider.on('connect', handleConnect);

    return () => {
      isDestroyed = true;
      cleanup?.(); // Clean up observers
      provider.off('connect', handleConnect);
    };
  }, [provider, doc, docId, updateDocumentData, readonly]);

  // Add cleanup on unmount
  useEffect(() => {
    if (readonly) return;

    return () => {
      const providers = providerCache.get(docId);
      if (providers) {
        if (providers?.remote?.status === 'connected') {
          providers.remote.forceSync();
        }
        providers.remote.destroy();
        providers.local.destroy();
        providerCache.delete(docId);
      }
    };
  }, [docId, readonly]);

  const value = useMemo(
    () => ({
      docId,
      provider,
      localProvider,
      ydoc: doc,
      isLoading,
      isShareDocumentLoading,
      readonly,
    }),
    [docId, provider, localProvider, doc, isLoading, readonly, isShareDocumentLoading],
  );

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
};

export const useDocumentContext = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocumentContext must be used within a DocumentProvider');
  }
  return context;
};
