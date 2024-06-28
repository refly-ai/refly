import { Fragment } from "react"
import type { FC } from "react"
import { Popover, Transition } from "@headlessui/react"
import { useTranslation } from "react-i18next"
import { RiCheckLine, RiMoreFill } from "@remixicon/react"
import { PreferredProviderTypeEnum } from "../declarations"
import Button from "@/components/base/button"

type SelectorProps = {
  value?: string
  onSelect: (key: PreferredProviderTypeEnum) => void
}
const Selector: FC<SelectorProps> = ({ value, onSelect }) => {
  const { t } = useTranslation()
  const options = [
    {
      key: PreferredProviderTypeEnum.custom,
      text: t("common.modelProvider.apiKey"),
    },
    {
      key: PreferredProviderTypeEnum.system,
      text: t("common.modelProvider.quota"),
    },
  ]

  return (
    <Popover className="relative">
      <Popover.Button>
        {({ open }) => (
          <Button
            className={`h-6 w-6 rounded-md bg-white px-0 ${open && "!bg-gray-100"} `}>
            <RiMoreFill className="h-3 w-3 text-gray-700" />
          </Button>
        )}
      </Popover.Button>
      <Transition
        as={Fragment}
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0">
        <Popover.Panel className="absolute right-0 top-7 z-10 w-[144px] rounded-lg border-[0.5px] border-gray-200 bg-white shadow-lg">
          <div className="p-1">
            <div className="px-3 pb-1 pt-2 text-sm font-medium text-gray-700">
              {t("common.modelProvider.card.priorityUse")}
            </div>
            {options.map(option => (
              <Popover.Button as={Fragment} key={option.key}>
                <div
                  className="flex h-9 cursor-pointer items-center justify-between rounded-lg px-3 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => onSelect(option.key)}>
                  <div className="grow">{option.text}</div>
                  {value === option.key && (
                    <RiCheckLine className="text-primary-600 h-4 w-4" />
                  )}
                </div>
              </Popover.Button>
            ))}
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  )
}

export default Selector
