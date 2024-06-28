import { memo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { RiCloseLine } from "@remixicon/react"
import { useStore } from "./store"
import { useIsChatMode, useNodesReadOnly, useNodesSyncDraft } from "./hooks"
import { FeaturesChoose, FeaturesPanel } from "@/components/base/features"

const Features = () => {
  const { t } = useTranslation()
  const isChatMode = useIsChatMode()
  const setShowFeaturesPanel = useStore(s => s.setShowFeaturesPanel)
  const { nodesReadOnly } = useNodesReadOnly()
  const { handleSyncWorkflowDraft } = useNodesSyncDraft()

  const handleFeaturesChange = useCallback(() => {
    handleSyncWorkflowDraft()
  }, [handleSyncWorkflowDraft])

  return (
    <div className="fixed bottom-2 left-2 top-16 z-10 w-[600px] rounded-2xl border-[0.5px] border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between px-4 pt-3">
        {t("workflow.common.features")}
        <div className="flex items-center">
          {isChatMode && (
            <>
              <FeaturesChoose
                disabled={nodesReadOnly}
                onChange={handleFeaturesChange}
              />
              <div className="mx-3 h-[14px] w-[1px] bg-gray-200"></div>
            </>
          )}
          <div
            className="flex h-6 w-6 cursor-pointer items-center justify-center"
            onClick={() => setShowFeaturesPanel(false)}>
            <RiCloseLine className="h-4 w-4 text-gray-500" />
          </div>
        </div>
      </div>
      <div className="p-4">
        <FeaturesPanel
          disabled={nodesReadOnly}
          onChange={handleFeaturesChange}
          openingStatementProps={{
            onAutoAddPromptVariable: () => {},
          }}
        />
      </div>
    </div>
  )
}

export default memo(Features)
