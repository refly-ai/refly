import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { McpServerDTO, ToolsetDefinition } from '@refly/openapi-schema';

interface ToolState {
  isInitialLoading: boolean;
  selectedTab: 'tools' | 'mcp';
  toolStoreModalOpen: boolean;
  toolInstallModalOpen: boolean;
  mcpFormModalOpen: boolean;
  mcpFormMode: 'create' | 'edit';
  currentToolDefinition: ToolsetDefinition | null;
  currentMcpServer: McpServerDTO | null;

  setInitialLoading: (loading: boolean) => void;
  setSelectedTab: (tab: 'tools' | 'mcp') => void;
  setToolStoreModalOpen: (open: boolean) => void;
  setToolInstallModalOpen: (open: boolean) => void;
  setMcpFormModalOpen: (open: boolean) => void;
  setMcpFormMode: (mode: 'create' | 'edit') => void;
  setCurrentToolDefinition: (definition: ToolsetDefinition | null) => void;
  setCurrentMcpServer: (server: McpServerDTO | null) => void;
}

export const useToolStore = create<ToolState>()(
  devtools((set) => ({
    isInitialLoading: false,
    selectedTab: 'tools',
    toolStoreModalOpen: false,
    toolInstallModalOpen: false,
    mcpFormModalOpen: false,
    mcpFormMode: 'create',
    currentToolDefinition: null,
    currentMcpServer: null,

    setInitialLoading: (loading: boolean) => set({ isInitialLoading: loading }),
    setSelectedTab: (tab: 'tools' | 'mcp') => set({ selectedTab: tab }),
    setToolStoreModalOpen: (open: boolean) => set({ toolStoreModalOpen: open }),
    setToolInstallModalOpen: (open: boolean) => set({ toolInstallModalOpen: open }),
    setMcpFormModalOpen: (open: boolean) => set({ mcpFormModalOpen: open }),
    setMcpFormMode: (mode: 'create' | 'edit') => set({ mcpFormMode: mode }),
    setCurrentToolDefinition: (definition: ToolsetDefinition | null) =>
      set({ currentToolDefinition: definition }),
    setCurrentMcpServer: (server: McpServerDTO | null) => set({ currentMcpServer: server }),
  })),
);

export const useToolStoreShallow = <T>(selector: (state: ToolState) => T): T =>
  useToolStore(useShallow(selector));
