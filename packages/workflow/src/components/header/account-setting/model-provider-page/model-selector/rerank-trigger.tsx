import { RiExternalLinkLine } from "@remixicon/react"
import { CubeOutline } from "@/components/base/icons/src/vender/line/shapes"

const ModelTrigger = () => {
  return (
    <div className="flex h-8 cursor-pointer items-center rounded-lg bg-gray-100 px-2 hover:bg-gray-200">
      <div className="flex grow items-center">
        <div className="mr-1.5 flex h-4 w-4 items-center justify-center rounded-[5px] border-dashed border-black/5">
          <CubeOutline className="h-[11px] w-[11px] text-gray-400" />
        </div>
        <div
          className="truncate text-[13px] text-gray-500"
          title="Select model">
          Please setup the Rerank model
        </div>
      </div>
      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
        <RiExternalLinkLine className="h-3.5 w-3.5 text-gray-500" />
      </div>
    </div>
  )
}

export default ModelTrigger
