"use client"
import type { FC } from "react"
import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useContext } from "use-context-selector"
import cn from "classnames"
import ConfigContent from "./config-content"
import { Settings04 } from "@/components/base/icons/src/vender/line/general"
import ConfigContext from "@/context/debug-configuration"
import Modal from "@/components/base/modal"
import Button from "@/components/base/button"
import { RETRIEVE_TYPE } from "@/types/app"
import Toast from "@/components/base/toast"
import { DATASET_DEFAULT } from "@/config"
import { useModelListAndDefaultModelAndCurrentProviderAndModel } from "@/components/header/account-setting/model-provider-page/hooks"
import { ModelTypeEnum } from "@/components/header/account-setting/model-provider-page/declarations"

const ParamsConfig: FC = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { datasetConfigs, setDatasetConfigs } = useContext(ConfigContext)
  const [tempDataSetConfigs, setTempDataSetConfigs] = useState(datasetConfigs)

  const {
    defaultModel: rerankDefaultModel,
    currentModel: isRerankDefaultModelVaild,
  } = useModelListAndDefaultModelAndCurrentProviderAndModel(
    ModelTypeEnum.rerank,
  )

  const isValid = () => {
    let errMsg = ""
    if (tempDataSetConfigs.retrieval_model === RETRIEVE_TYPE.multiWay) {
      if (
        !tempDataSetConfigs.reranking_model?.reranking_model_name &&
        !rerankDefaultModel &&
        isRerankDefaultModelVaild
      )
        errMsg = t("appDebug.datasetConfig.rerankModelRequired")
    }
    if (errMsg) {
      Toast.notify({
        type: "error",
        message: errMsg,
      })
    }
    return !errMsg
  }
  const handleSave = () => {
    if (!isValid()) return

    const config = { ...tempDataSetConfigs }
    if (
      config.retrieval_model === RETRIEVE_TYPE.multiWay &&
      !config.reranking_model
    ) {
      config.reranking_model = {
        reranking_provider_name: rerankDefaultModel?.provider?.provider,
        reranking_model_name: rerankDefaultModel?.model,
      } as any
    }
    setDatasetConfigs(config)
    setOpen(false)
  }

  return (
    <div>
      <div
        className={cn(
          "flex h-7 cursor-pointer items-center space-x-1 rounded-md px-3 text-gray-700 hover:bg-gray-200",
          open && "bg-gray-200",
        )}
        onClick={() => {
          setTempDataSetConfigs({
            ...datasetConfigs,
            top_k: datasetConfigs.top_k || DATASET_DEFAULT.top_k,
            score_threshold:
              datasetConfigs.score_threshold || DATASET_DEFAULT.score_threshold,
          })
          setOpen(true)
        }}>
        <Settings04 className="h-[14px] w-[14px]" />
        <div className="text-xs font-medium">
          {t("appDebug.datasetConfig.params")}
        </div>
      </div>
      {open && (
        <Modal
          isShow={open}
          onClose={() => {
            setOpen(false)
          }}
          className="sm:min-w-[528px]"
          title={t("appDebug.datasetConfig.settingTitle")}>
          <ConfigContent
            datasetConfigs={tempDataSetConfigs}
            onChange={setTempDataSetConfigs}
          />

          <div className="mt-6 flex justify-end">
            <Button
              className="mr-2 flex-shrink-0"
              onClick={() => {
                setOpen(false)
              }}>
              {t("common.operation.cancel")}
            </Button>
            <Button
              variant="primary"
              className="flex-shrink-0"
              onClick={handleSave}>
              {t("common.operation.save")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
export default memo(ParamsConfig)
