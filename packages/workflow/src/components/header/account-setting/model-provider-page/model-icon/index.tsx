import type { FC } from "react"
import type { Model, ModelProvider } from "../declarations"
import { useLanguage } from "../hooks"
import { CubeOutline } from "@/components/base/icons/src/vender/line/shapes"
import { OpenaiViolet } from "@/components/base/icons/src/public/llm"

type ModelIconProps = {
  provider?: Model | ModelProvider
  modelName?: string
  className?: string
}
const ModelIcon: FC<ModelIconProps> = ({ provider, className, modelName }) => {
  const language = useLanguage()

  if (provider?.provider === "openai" && modelName?.startsWith("gpt-4"))
    return <OpenaiViolet className={`h-4 w-4 ${className}`} />

  if (provider?.icon_small) {
    return (
      <img
        alt="model-icon"
        src={`${provider.icon_small[language] || provider.icon_small.en_US}?_token=${localStorage.getItem("console_token")}`}
        className={`h-4 w-4 ${className}`}
      />
    )
  }

  return (
    <div
      className={`flex h-6 w-6 items-center justify-center rounded border-[0.5px] border-black/5 bg-gray-50 ${className} `}>
      <CubeOutline className="h-4 w-4 text-gray-400" />
    </div>
  )
}

export default ModelIcon
