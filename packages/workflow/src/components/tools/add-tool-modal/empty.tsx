import { useTranslation } from "react-i18next"

const Empty = () => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center">
      <div className="h-[149px] w-[163px] shrink-0 bg-[url('~@/components/tools/add-tool-modal/empty.png')] bg-cover bg-no-repeat"></div>
      <div className="mb-1 text-[13px] font-medium leading-[18px] text-gray-700">
        {t("tools.addToolModal.emptyTitle")}
      </div>
      <div className="text-[13px] leading-[18px] text-gray-500">
        {t("tools.addToolModal.emptyTip")}
      </div>
    </div>
  )
}

export default Empty
