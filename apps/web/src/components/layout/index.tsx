import { Layout } from "@arco-design/web-react"

import { SiderLayout } from "./sider"
import "./index.scss"
import { useUserStore } from "@refly-packages/ai-workspace-common/stores/user"

// 组件
import { LoginModal } from "@refly-packages/ai-workspace-common/components/login-modal/index"
import { BigSearchModal } from "@refly-packages/ai-workspace-common/components/search/modal"
import { ImportResourceModal } from "@refly-packages/ai-workspace-common/components/import-resource"
import { NewKnowledgeModal } from "@refly-packages/ai-workspace-common/components/knowledge-base/new-knowledge-modal"

// stores
import { useBindCommands } from "@refly-packages/ai-workspace-common/hooks/use-bind-commands"
import { useImportResourceStore } from "@refly-packages/ai-workspace-common/stores/import-resource"
import { useImportKnowledgeModal } from "@refly-packages/ai-workspace-common/stores/import-knowledge-modal"

const Content = Layout.Content

interface AppLayoutProps {
  children?: any
}

export const AppLayout = (props: AppLayoutProps) => {
  // stores
  const userStore = useUserStore()
  const importResourceStore = useImportResourceStore()
  const importKnowledgeModal = useImportKnowledgeModal()

  // 绑定快捷键
  useBindCommands()

  return (
    <Layout className="app-layout main">
      <SiderLayout />
      <Layout
        className="content-layout"
        style={{
          height: "calc(100vh - 16px)",
          flexGrow: 1,
          overflowY: "auto",
          width: `calc(100% - 200px - 16px)`,
        }}>
        <Content>{props.children}</Content>
      </Layout>
      {userStore.loginModalVisible ? <LoginModal /> : null}
      <BigSearchModal />
      {importResourceStore.importResourceModalVisible ? (
        <ImportResourceModal />
      ) : null}
      {importKnowledgeModal.showNewKnowledgeModal && <NewKnowledgeModal />}
    </Layout>
  )
}
