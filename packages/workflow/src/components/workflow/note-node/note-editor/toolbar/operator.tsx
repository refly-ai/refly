import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiMoreFill } from "@remixicon/react"
import ShortcutsName from "@/components/workflow/shortcuts-name"
import {
  PortalToFollowElem,
  PortalToFollowElemContent,
  PortalToFollowElemTrigger,
} from "@/components/base/portal-to-follow-elem"
import Switch from "@/components/base/switch"

export type OperatorProps = {
  onCopy: () => void
  onDuplicate: () => void
  onDelete: () => void
  showAuthor: boolean
  onShowAuthorChange: (showAuthor: boolean) => void
}
const Operator = ({
  onCopy,
  onDelete,
  onDuplicate,
  showAuthor,
  onShowAuthorChange,
}: OperatorProps) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <PortalToFollowElem
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      offset={4}>
      <PortalToFollowElemTrigger onClick={() => setOpen(!open)}>
        <div
          className={cn(
            "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-black/5",
            open && "bg-black/5",
          )}>
          <RiMoreFill className="h-4 w-4 text-gray-500" />
        </div>
      </PortalToFollowElemTrigger>
      <PortalToFollowElemContent>
        <div className="min-w-[192px] rounded-md border-[0.5px] border-gray-200 bg-white shadow-xl">
          <div className="p-1">
            <div
              className="flex h-8 cursor-pointer items-center justify-between rounded-md px-3 text-sm text-gray-700 hover:bg-black/5"
              onClick={() => {
                onCopy()
                setOpen(false)
              }}>
              {t("workflow.common.copy")}
              <ShortcutsName keys={["ctrl", "c"]} />
            </div>
            <div
              className="flex h-8 cursor-pointer items-center justify-between rounded-md px-3 text-sm text-gray-700 hover:bg-black/5"
              onClick={() => {
                onDuplicate()
                setOpen(false)
              }}>
              {t("workflow.common.duplicate")}
              <ShortcutsName keys={["ctrl", "d"]} />
            </div>
          </div>
          <div className="h-[1px] bg-gray-100"></div>
          <div className="p-1">
            <div
              className="flex h-8 cursor-pointer items-center justify-between rounded-md px-3 text-sm text-gray-700 hover:bg-black/5"
              onClick={e => e.stopPropagation()}>
              <div>{t("workflow.nodes.note.editor.showAuthor")}</div>
              <Switch
                size="l"
                defaultValue={showAuthor}
                onChange={onShowAuthorChange}
              />
            </div>
          </div>
          <div className="h-[1px] bg-gray-100"></div>
          <div className="p-1">
            <div
              className="flex h-8 cursor-pointer items-center justify-between rounded-md px-3 text-sm text-gray-700 hover:bg-[#FEF3F2] hover:text-[#D92D20]"
              onClick={() => {
                onDelete()
                setOpen(false)
              }}>
              {t("common.operation.delete")}
              <ShortcutsName keys={["del"]} />
            </div>
          </div>
        </div>
      </PortalToFollowElemContent>
    </PortalToFollowElem>
  )
}

export default memo(Operator)
