"use client"
import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import RetrievalParamConfig from "../retrieval-param-config"
import { RETRIEVE_METHOD } from "@/types/app"
import RadioCard from "@/components/base/radio-card"
import { HighPriority } from "@/components/base/icons/src/vender/solid/arrows"
import type { RetrievalConfig } from "@/types/app"

type Props = {
  value: RetrievalConfig
  onChange: (value: RetrievalConfig) => void
}

const EconomicalRetrievalMethodConfig: FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <RadioCard
        icon={<HighPriority className="h-4 w-4 text-[#7839EE]" />}
        title={t("dataset.retrieval.invertedIndex.title")}
        description={t("dataset.retrieval.invertedIndex.description")}
        noRadio
        chosenConfig={
          <RetrievalParamConfig
            type={RETRIEVE_METHOD.invertedIndex}
            value={value}
            onChange={onChange}
          />
        }
      />
    </div>
  )
}
export default React.memo(EconomicalRetrievalMethodConfig)
