import type { FC } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import Button from "@/components/base/button"
import type { ImageFile } from "@/types/app"
import { TransferMethod } from "@/types/app"

type ImageLinkInputProps = {
  onUpload: (imageFile: ImageFile) => void
  disabled?: boolean
}
const regex = /^(https?|ftp):\/\//
const ImageLinkInput: FC<ImageLinkInputProps> = ({ onUpload, disabled }) => {
  const { t } = useTranslation()
  const [imageLink, setImageLink] = useState("")

  const handleClick = () => {
    if (disabled) return

    const imageFile = {
      type: TransferMethod.remote_url,
      _id: `${Date.now()}`,
      fileId: "",
      progress: regex.test(imageLink) ? 0 : -1,
      url: imageLink,
    }

    onUpload(imageFile)
  }

  return (
    <div className="shadow-xs flex h-8 items-center rounded-lg border border-gray-200 bg-white pl-1.5 pr-1">
      <input
        type="text"
        className="mr-0.5 h-[18px] grow appearance-none px-1 text-[13px] outline-none"
        value={imageLink}
        onChange={e => setImageLink(e.target.value)}
        placeholder={
          t("common.imageUploader.pasteImageLinkInputPlaceholder") || ""
        }
      />
      <Button
        variant="primary"
        size="small"
        disabled={!imageLink || disabled}
        onClick={handleClick}>
        {t("common.operation.ok")}
      </Button>
    </div>
  )
}

export default ImageLinkInput
