import type { FC } from "react"
import { useState } from "react"
import cn from "classnames"
import { RiDeleteBinLine, RiEditLine } from "@remixicon/react"
import { useDebounceFn } from "ahooks"
import { useContext } from "use-context-selector"
import { useTranslation } from "react-i18next"
import { useStore as useTagStore } from "./store"
import TagRemoveModal from "./tag-remove-modal"
import type { Tag } from "@/components/base/tag-management/constant"
import { ToastContext } from "@/components/base/toast"
import { deleteTag, updateTag } from "@/service/tag"

type TagItemEditorProps = {
  tag: Tag
}
const TagItemEditor: FC<TagItemEditorProps> = ({ tag }) => {
  const { t } = useTranslation()
  const { notify } = useContext(ToastContext)
  const tagList = useTagStore(s => s.tagList)
  const setTagList = useTagStore(s => s.setTagList)

  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(tag.name)
  const editTag = async (tagID: string, name: string) => {
    if (name === tag.name) {
      setIsEditing(false)
      return
    }
    if (!name) {
      notify({ type: "error", message: "tag name is empty" })
      setName(tag.name)
      setIsEditing(false)
      return
    }
    try {
      const newList = tagList.map(tag => {
        if (tag.id === tagID) {
          return {
            ...tag,
            name,
          }
        }
        return tag
      })
      setTagList([...newList])
      setIsEditing(false)
      await updateTag(tagID, name)
      notify({
        type: "success",
        message: t("common.actionMsg.modifiedSuccessfully"),
      })
      setName(name)
    } catch (e: any) {
      notify({
        type: "error",
        message: t("common.actionMsg.modifiedUnsuccessfully"),
      })
      setName(tag.name)
      const recoverList = tagList.map(tag => {
        if (tag.id === tagID) {
          return {
            ...tag,
            name: tag.name,
          }
        }
        return tag
      })
      setTagList([...recoverList])
      setIsEditing(false)
    }
  }
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [pending, setPending] = useState<Boolean>(false)
  const removeTag = async (tagID: string) => {
    if (pending) return
    try {
      setPending(true)
      await deleteTag(tagID)
      notify({
        type: "success",
        message: t("common.actionMsg.modifiedSuccessfully"),
      })
      const newList = tagList.filter(tag => tag.id !== tagID)
      setTagList([...newList])
      setPending(false)
    } catch (e: any) {
      notify({
        type: "error",
        message: t("common.actionMsg.modifiedUnsuccessfully"),
      })
      setPending(false)
    }
  }
  const { run: handleRemove } = useDebounceFn(
    () => {
      removeTag(tag.id)
    },
    { wait: 200 },
  )

  return (
    <>
      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 rounded-lg border border-gray-200 py-1 pl-2 pr-1 text-sm leading-5 text-gray-700",
        )}>
        {!isEditing && (
          <>
            <div className="text-sm leading-5 text-gray-700">{tag.name}</div>
            <div className="leading-4.5 shrink-0 px-1 text-sm font-medium text-gray-500">
              {tag.binding_count}
            </div>
            <div
              className="group/edit shrink-0 cursor-pointer rounded-md p-1 hover:bg-black/5"
              onClick={() => setIsEditing(true)}>
              <RiEditLine className="h-3 w-3 text-gray-500 group-hover/edit:text-gray-800" />
            </div>
            <div
              className="group/remove shrink-0 cursor-pointer rounded-md p-1 hover:bg-black/5"
              onClick={() => {
                if (tag.binding_count) setShowRemoveModal(true)
                else handleRemove()
              }}>
              <RiDeleteBinLine className="h-3 w-3 text-gray-500 group-hover/remove:text-gray-800" />
            </div>
          </>
        )}
        {isEditing && (
          <input
            className="caret-primary-600 shrink-0 appearance-none outline-none placeholder:text-gray-300"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && editTag(tag.id, name)}
            onBlur={() => editTag(tag.id, name)}
          />
        )}
      </div>
      <TagRemoveModal
        tag={tag}
        show={showRemoveModal}
        onConfirm={() => {
          handleRemove()
          setShowRemoveModal(false)
        }}
        onClose={() => setShowRemoveModal(false)}
      />
    </>
  )
}

export default TagItemEditor
