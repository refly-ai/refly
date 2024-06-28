import type { FC } from "react"
import { useTranslation } from "react-i18next"
import { PlusCircle } from "@/components/base/icons/src/vender/solid/general"

type AddModelButtonProps = {
  className?: string
  onClick: () => void
}
const AddModelButton: FC<AddModelButtonProps> = ({ className, onClick }) => {
  const { t } = useTranslation()

  return (
    <span
      className={`hover:bg-primary-50 hover:text-primary-600 flex h-6 shrink-0 cursor-pointer items-center rounded-md px-1.5 text-xs font-medium text-gray-500 ${className} `}
      onClick={onClick}>
      <PlusCircle className="mr-1 h-3 w-3" />
      {t("common.modelProvider.addModel")}
    </span>
  )
}

export default AddModelButton
