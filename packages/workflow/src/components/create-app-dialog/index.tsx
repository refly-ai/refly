"use client"
import { useTranslation } from "react-i18next"
import { RiCloseLine } from "@remixicon/react"
import NewAppDialog from "./newAppDialog"
import AppList, { PageType } from "@/components/explore/app-list"

type CreateAppDialogProps = {
  show: boolean
  onSuccess: () => void
  onClose: () => void
}

const CreateAppTemplateDialog = ({
  show,
  onSuccess,
  onClose,
}: CreateAppDialogProps) => {
  const { t } = useTranslation()

  return (
    <NewAppDialog className="flex" show={show} onClose={() => {}}>
      {/* template list */}
      <div className="flex h-full grow flex-col bg-gray-100">
        <div className="z-10 shrink-0 rounded-se-xl bg-gray-100 pb-3 pl-8 pr-6 pt-6 text-xl font-semibold leading-[30px] text-gray-900">
          {t("app.newApp.startFromTemplate")}
        </div>
        <AppList
          onSuccess={() => {
            onSuccess()
            onClose()
          }}
          pageType={PageType.CREATE}
        />
      </div>
      <div
        className="absolute right-6 top-6 z-20 cursor-pointer p-2"
        onClick={onClose}>
        <RiCloseLine className="h-4 w-4 text-gray-500" />
      </div>
    </NewAppDialog>
  )
}

export default CreateAppTemplateDialog
