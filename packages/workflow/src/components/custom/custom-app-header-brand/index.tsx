import { useTranslation } from "react-i18next"
import s from "./style.module.css"
import Button from "@/components/base/button"
import { Grid01 } from "@/components/base/icons/src/vender/solid/layout"
import {
  Container,
  Database01,
} from "@/components/base/icons/src/vender/line/development"
import { ImagePlus } from "@/components/base/icons/src/vender/line/images"
import { useProviderContext } from "@/context/provider-context"
import { Plan } from "@/components/billing/type"

const CustomAppHeaderBrand = () => {
  const { t } = useTranslation()
  const { plan } = useProviderContext()

  return (
    <div className="py-3">
      <div className="mb-2 text-sm font-medium text-gray-900">
        {t("custom.app.title")}
      </div>
      <div className="border-black/8 shadow-xs relative mb-4 rounded-xl border-[0.5px] bg-gray-100">
        <div className={`${s.mask} absolute inset-0 rounded-xl`}></div>
        <div className="flex h-14 items-center rounded-t-xl pl-5">
          <div className="relative mr-[199px] flex h-10 w-[120px] items-center bg-[rgba(217,45,32,0.12)]">
            <div className="ml-[1px] mr-[3px] h-[34px] w-[34px] rounded-full border-8 border-black/[0.16]"></div>
            <div className="text-[13px] font-bold text-black/[0.24]">
              YOUR LOGO
            </div>
            <div className="absolute bottom-0 left-0.5 top-0 w-[0.5px] bg-[#F97066] opacity-50"></div>
            <div className="absolute bottom-0 right-0.5 top-0 w-[0.5px] bg-[#F97066] opacity-50"></div>
            <div className="absolute left-0 right-0 top-0.5 h-[0.5px] bg-[#F97066] opacity-50"></div>
            <div className="absolute bottom-0.5 left-0 right-0 h-[0.5px] bg-[#F97066] opacity-50"></div>
          </div>
          <div className="shadow-xs mr-3 flex h-7 items-center rounded-xl bg-white px-3">
            <Grid01 className="mr-2 h-4 w-4 shrink-0 text-[#155eef]" />
            <div className="h-1.5 w-12 rounded-[5px] bg-[#155eef] opacity-80"></div>
          </div>
          <div className="mr-3 flex h-7 items-center px-3">
            <Container className="mr-2 h-4 w-4 shrink-0 text-gray-500" />
            <div className="h-1.5 w-[50px] rounded-[5px] bg-gray-300"></div>
          </div>
          <div className="flex h-7 items-center px-3">
            <Database01 className="mr-2 h-4 w-4 shrink-0 text-gray-500" />
            <div className="h-1.5 w-14 rounded-[5px] bg-gray-300 opacity-80"></div>
          </div>
        </div>
        <div className="h-8 rounded-b-xl border-t border-t-gray-200"></div>
      </div>
      <div className="mb-2 flex items-center">
        <Button disabled={plan.type === Plan.sandbox}>
          <ImagePlus className="mr-2 h-4 w-4" />
          {t("custom.upload")}
        </Button>
        <div className="mx-2 h-5 w-[1px] bg-black/5"></div>
        <Button disabled={plan.type === Plan.sandbox}>
          {t("custom.restore")}
        </Button>
      </div>
      <div className="text-xs text-gray-500">
        {t("custom.app.changeLogoTip")}
      </div>
    </div>
  )
}

export default CustomAppHeaderBrand
