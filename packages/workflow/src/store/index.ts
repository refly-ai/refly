import { create } from "zustand"
import type { App } from "@/types/app"
import type { IChatItem } from "@/components/base/chat/chat/type"
import { mockAppDetail } from "@/mock-data/app-detail"

type State = {
  appDetail?: App
  appSidebarExpand: string
  currentLogItem?: IChatItem
  currentLogModalActiveTab: string
  showPromptLogModal: boolean
  showAgentLogModal: boolean
  showMessageLogModal: boolean
}

type Action = {
  setAppDetail: (appDetail?: App) => void
  setAppSiderbarExpand: (state: string) => void
  setCurrentLogItem: (item?: IChatItem) => void
  setCurrentLogModalActiveTab: (tab: string) => void
  setShowPromptLogModal: (showPromptLogModal: boolean) => void
  setShowAgentLogModal: (showAgentLogModal: boolean) => void
  setShowMessageLogModal: (showMessageLogModal: boolean) => void
}

export const useStore = create<State & Action>(set => ({
  appDetail: mockAppDetail as App,
  setAppDetail: appDetail => set(() => ({ appDetail })),
  appSidebarExpand: "",
  setAppSiderbarExpand: appSidebarExpand => set(() => ({ appSidebarExpand })),
  currentLogItem: undefined,
  currentLogModalActiveTab: "DETAIL",
  setCurrentLogItem: currentLogItem => set(() => ({ currentLogItem })),
  setCurrentLogModalActiveTab: currentLogModalActiveTab =>
    set(() => ({ currentLogModalActiveTab })),
  showPromptLogModal: false,
  setShowPromptLogModal: showPromptLogModal =>
    set(() => ({ showPromptLogModal })),
  showAgentLogModal: false,
  setShowAgentLogModal: showAgentLogModal => set(() => ({ showAgentLogModal })),
  showMessageLogModal: false,
  setShowMessageLogModal: showMessageLogModal =>
    set(() => {
      if (showMessageLogModal) {
        return { showMessageLogModal }
      } else {
        return {
          showMessageLogModal,
          currentLogModalActiveTab: "DETAIL",
        }
      }
    }),
}))
