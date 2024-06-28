import type { FC } from "react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { isEqual } from "lodash-es"
import cn from "classnames"
import { RiCloseLine } from "@remixicon/react"
import { BookOpenIcon } from "@heroicons/react/24/outline"
import IndexMethodRadio from "@/components/datasets/settings/index-method-radio"
import Button from "@/components/base/button"
import type { DataSet } from "@/models/datasets"
import { useToastContext } from "@/components/base/toast"
import { updateDatasetSetting } from "@/service/datasets"
import { useModalContext } from "@/context/modal-context"
import type { RetrievalConfig } from "@/types/app"
import RetrievalMethodConfig from "@/components/datasets/common/retrieval-method-config"
import EconomicalRetrievalMethodConfig from "@/components/datasets/common/economical-retrieval-method-config"
import {
  ensureRerankModelSelected,
  isReRankModelSelected,
} from "@/components/datasets/common/check-rerank-model"
import { AlertTriangle } from "@/components/base/icons/src/vender/solid/alertsAndFeedback"
import PermissionsRadio from "@/components/datasets/settings/permissions-radio"
import ModelSelector from "@/components/header/account-setting/model-provider-page/model-selector"
import {
  useModelList,
  useModelListAndDefaultModelAndCurrentProviderAndModel,
} from "@/components/header/account-setting/model-provider-page/hooks"
import { ModelTypeEnum } from "@/components/header/account-setting/model-provider-page/declarations"

type SettingsModalProps = {
  currentDataset: DataSet
  onCancel: () => void
  onSave: (newDataset: DataSet) => void
}

const rowClass = `
  flex justify-between py-4 flex-wrap gap-y-2
`

const labelClass = `
  flex w-[168px] shrink-0
`

const SettingsModal: FC<SettingsModalProps> = ({
  currentDataset,
  onCancel,
  onSave,
}) => {
  const { data: embeddingsModelList } = useModelList(
    ModelTypeEnum.textEmbedding,
  )
  const {
    modelList: rerankModelList,
    defaultModel: rerankDefaultModel,
    currentModel: isRerankDefaultModelVaild,
  } = useModelListAndDefaultModelAndCurrentProviderAndModel(
    ModelTypeEnum.rerank,
  )
  const { t } = useTranslation()
  const { notify } = useToastContext()
  const ref = useRef(null)

  const { setShowAccountSettingModal } = useModalContext()
  const [loading, setLoading] = useState(false)
  const [localeCurrentDataset, setLocaleCurrentDataset] = useState({
    ...currentDataset,
  })
  const [indexMethod, setIndexMethod] = useState(
    currentDataset.indexing_technique,
  )
  const [retrievalConfig, setRetrievalConfig] = useState(
    localeCurrentDataset?.retrieval_model_dict as RetrievalConfig,
  )

  const handleValueChange = (type: string, value: string) => {
    setLocaleCurrentDataset({ ...localeCurrentDataset, [type]: value })
  }
  const [isHideChangedTip, setIsHideChangedTip] = useState(false)
  const isRetrievalChanged =
    !isEqual(retrievalConfig, localeCurrentDataset?.retrieval_model_dict) ||
    indexMethod !== localeCurrentDataset?.indexing_technique

  const handleSave = async () => {
    if (loading) return
    if (!localeCurrentDataset.name?.trim()) {
      notify({ type: "error", message: t("datasetSettings.form.nameError") })
      return
    }
    if (
      !isReRankModelSelected({
        rerankDefaultModel,
        isRerankDefaultModelVaild: !!isRerankDefaultModelVaild,
        rerankModelList,
        retrievalConfig,
        indexMethod,
      })
    ) {
      notify({
        type: "error",
        message: t("appDebug.datasetConfig.rerankModelRequired"),
      })
      return
    }
    const postRetrievalConfig = ensureRerankModelSelected({
      rerankDefaultModel: rerankDefaultModel!,
      retrievalConfig,
      indexMethod,
    })
    try {
      setLoading(true)
      const { id, name, description, permission } = localeCurrentDataset
      await updateDatasetSetting({
        datasetId: id,
        body: {
          name,
          description,
          permission,
          indexing_technique: indexMethod,
          retrieval_model: postRetrievalConfig,
          embedding_model: localeCurrentDataset.embedding_model,
          embedding_model_provider:
            localeCurrentDataset.embedding_model_provider,
        },
      })
      notify({
        type: "success",
        message: t("common.actionMsg.modifiedSuccessfully"),
      })
      onSave({
        ...localeCurrentDataset,
        indexing_technique: indexMethod,
        retrieval_model_dict: postRetrievalConfig,
      })
    } catch (e) {
      notify({
        type: "error",
        message: t("common.actionMsg.modifiedUnsuccessfully"),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-xl border-[0.5px] border-gray-200 bg-white shadow-xl"
      style={{
        height: "calc(100vh - 72px)",
      }}
      ref={ref}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-b-gray-100 pl-6 pr-5">
        <div className="flex flex-col text-base font-semibold text-gray-900">
          <div className="leading-6">{t("datasetSettings.title")}</div>
        </div>
        <div className="flex items-center">
          <div
            onClick={onCancel}
            className="flex h-6 w-6 cursor-pointer items-center justify-center">
            <RiCloseLine className="h-4 w-4 text-gray-500" />
          </div>
        </div>
      </div>
      {/* Body */}
      <div
        className="overflow-y-auto border-b p-6 pb-[68px] pt-5"
        style={{
          borderBottom: "rgba(0, 0, 0, 0.05)",
        }}>
        <div className={cn(rowClass, "items-center")}>
          <div className={labelClass}>{t("datasetSettings.form.name")}</div>
          <input
            value={localeCurrentDataset.name}
            onChange={e => handleValueChange("name", e.target.value)}
            className="block h-9 w-full appearance-none rounded-lg bg-gray-100 px-3 text-sm text-gray-900 outline-none"
            placeholder={t("datasetSettings.form.namePlaceholder") || ""}
          />
        </div>
        <div className={cn(rowClass)}>
          <div className={labelClass}>{t("datasetSettings.form.desc")}</div>
          <div className="w-full">
            <textarea
              value={localeCurrentDataset.description || ""}
              onChange={e => handleValueChange("description", e.target.value)}
              className="block h-[88px] w-full resize-none appearance-none rounded-lg bg-gray-100 px-3 py-2 text-sm outline-none"
              placeholder={t("datasetSettings.form.descPlaceholder") || ""}
            />
            <a
              className="mt-2 flex h-[18px] items-center px-3 text-xs text-gray-500"
              href="https://docs.dify.ai/features/datasets#how-to-write-a-good-dataset-description"
              target="_blank"
              rel="noopener noreferrer">
              <BookOpenIcon className="mr-1 h-[18px] w-3" />
              {t("datasetSettings.form.descWrite")}
            </a>
          </div>
        </div>
        <div className={rowClass}>
          <div className={labelClass}>
            <div>{t("datasetSettings.form.permissions")}</div>
          </div>
          <div className="w-full">
            <PermissionsRadio
              disable={!localeCurrentDataset?.embedding_available}
              value={localeCurrentDataset.permission}
              onChange={v => handleValueChange("permission", v!)}
              itemClassName="sm:!w-[280px]"
            />
          </div>
        </div>
        <div className="my-2 h-0 w-full border-b-[0.5px] border-b-gray-200"></div>
        <div className={cn(rowClass)}>
          <div className={labelClass}>
            {t("datasetSettings.form.indexMethod")}
          </div>
          <div className="grow">
            <IndexMethodRadio
              disable={!localeCurrentDataset?.embedding_available}
              value={indexMethod}
              onChange={v => setIndexMethod(v!)}
              itemClassName="sm:!w-[280px]"
            />
          </div>
        </div>
        {indexMethod === "high_quality" && (
          <div className={cn(rowClass)}>
            <div className={labelClass}>
              {t("datasetSettings.form.embeddingModel")}
            </div>
            <div className="w-full">
              <div className="h-9 w-full rounded-lg bg-gray-100 opacity-60">
                <ModelSelector
                  readonly
                  defaultModel={{
                    provider: localeCurrentDataset.embedding_model_provider,
                    model: localeCurrentDataset.embedding_model,
                  }}
                  modelList={embeddingsModelList}
                />
              </div>
              <div className="mt-2 w-full text-xs leading-6 text-gray-500">
                {t("datasetSettings.form.embeddingModelTip")}
                <span
                  className="cursor-pointer text-[#155eef]"
                  onClick={() =>
                    setShowAccountSettingModal({ payload: "provider" })
                  }>
                  {t("datasetSettings.form.embeddingModelTipLink")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Retrieval Method Config */}
        <div className={rowClass}>
          <div className={labelClass}>
            <div>
              <div>{t("datasetSettings.form.retrievalSetting.title")}</div>
              <div className="text-xs font-normal leading-[18px] text-gray-500">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://docs.dify.ai/features/retrieval-augment"
                  className="text-[#155eef]">
                  {t("datasetSettings.form.retrievalSetting.learnMore")}
                </a>
                {t("datasetSettings.form.retrievalSetting.description")}
              </div>
            </div>
          </div>
          <div className="w-[480px]">
            {indexMethod === "high_quality" ? (
              <RetrievalMethodConfig
                value={retrievalConfig}
                onChange={setRetrievalConfig}
              />
            ) : (
              <EconomicalRetrievalMethodConfig
                value={retrievalConfig}
                onChange={setRetrievalConfig}
              />
            )}
          </div>
        </div>
      </div>
      {isRetrievalChanged && !isHideChangedTip && (
        <div className="absolute bottom-[76px] left-[30px] right-[30px] z-10 flex h-10 items-center justify-between rounded-lg border border-[#FEF0C7] bg-[#FFFAEB] px-3 shadow-lg">
          <div className="flex items-center">
            <AlertTriangle className="mr-1 h-3 w-3 text-[#F79009]" />
            <div className="text-xs font-medium leading-[18px] text-gray-700">
              {t("appDebug.datasetConfig.retrieveChangeTip")}
            </div>
          </div>
          <div
            className="cursor-pointer p-1"
            onClick={e => {
              setIsHideChangedTip(true)
              e.stopPropagation()
              e.nativeEvent.stopImmediatePropagation()
            }}>
            <RiCloseLine className="h-4 w-4 text-gray-500" />
          </div>
        </div>
      )}

      <div
        className="sticky bottom-0 z-[5] flex w-full justify-end border-t bg-white px-6 py-4"
        style={{
          borderColor: "rgba(0, 0, 0, 0.05)",
        }}>
        <Button onClick={onCancel} className="mr-2">
          {t("common.operation.cancel")}
        </Button>
        <Button variant="primary" disabled={loading} onClick={handleSave}>
          {t("common.operation.save")}
        </Button>
      </div>
    </div>
  )
}

export default SettingsModal
