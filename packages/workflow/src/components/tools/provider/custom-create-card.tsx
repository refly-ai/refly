"use client"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useContext } from "use-context-selector"
import { RiAddLine } from "@remixicon/react"
import type { CustomCollectionBackend } from "../types"
import I18n from "@/context/i18n"
import { getLanguage } from "@/i18n/language"
import { BookOpen01 } from "@/components/base/icons/src/vender/line/education"
import { ArrowUpRight } from "@/components/base/icons/src/vender/line/arrows"
import EditCustomToolModal from "@/components/tools/edit-custom-collection-modal"
import { createCustomCollection } from "@/service/tools"
import Toast from "@/components/base/toast"
import { useAppContext } from "@/context/app-context"

type Props = {
  onRefreshData: () => void
}

const Contribute = ({ onRefreshData }: Props) => {
  const { t } = useTranslation()
  const { locale } = useContext(I18n)
  const language = getLanguage(locale)
  const { isCurrentWorkspaceManager } = useAppContext()

  const linkUrl = useMemo(() => {
    if (language.startsWith("zh_"))
      return "https://docs.dify.ai/v/zh-hans/guides/gong-ju/quick-tool-integration"
    return "https://docs.dify.ai/tutorials/quick-tool-integration"
  }, [language])

  const [isShowEditCollectionToolModal, setIsShowEditCustomCollectionModal] =
    useState(false)
  const doCreateCustomToolCollection = async (
    data: CustomCollectionBackend,
  ) => {
    await createCustomCollection(data)
    Toast.notify({
      type: "success",
      message: t("common.api.actionSuccess"),
    })
    setIsShowEditCustomCollectionModal(false)
    onRefreshData()
  }

  return (
    <>
      {isCurrentWorkspaceManager && (
        <div className="col-span-1 flex min-h-[160px] cursor-pointer flex-col rounded-xl border-[0.5px] border-black/5 bg-gray-200 transition-all duration-200 ease-in-out hover:bg-gray-50 hover:shadow-lg">
          <div
            className="group grow rounded-t-xl hover:bg-white"
            onClick={() => setIsShowEditCustomCollectionModal(true)}>
            <div className="flex shrink-0 items-center p-4 pb-3">
              <div className="group-hover:border-primary-100 group-hover:bg-primary-50 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                <RiAddLine className="group-hover:text-primary-600 h-4 w-4 text-gray-500" />
              </div>
              <div className="group-hover:text-primary-600 ml-3 text-sm font-semibold leading-5 text-gray-800">
                {t("tools.createCustomTool")}
              </div>
            </div>
          </div>
          <div className="rounded-b-xl border-t-[0.5px] border-black/5 px-4 py-3 text-gray-500 hover:bg-white hover:text-[#155EEF]">
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1">
              <BookOpen01 className="h-3 w-3 shrink-0" />
              <div
                className="grow truncate text-xs font-normal leading-[18px]"
                title={t("tools.customToolTip") || ""}>
                {t("tools.customToolTip")}
              </div>
              <ArrowUpRight className="h-3 w-3 shrink-0" />
            </a>
          </div>
        </div>
      )}
      {isShowEditCollectionToolModal && (
        <EditCustomToolModal
          payload={null}
          onHide={() => setIsShowEditCustomCollectionModal(false)}
          onAdd={doCreateCustomToolCollection}
        />
      )}
    </>
  )
}
export default Contribute
