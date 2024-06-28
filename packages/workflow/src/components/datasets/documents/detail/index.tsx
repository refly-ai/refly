"use client"
import type { FC } from "react"
import React, { useState } from "react"
import useSWR from "swr"
import { ArrowLeftIcon } from "@heroicons/react/24/solid"
import { createContext, useContext } from "use-context-selector"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { omit } from "lodash-es"
import cn from "classnames"
import { OperationAction, StatusItem } from "../list"
import s from "../style.module.css"
import Completed from "./completed"
import Embedding from "./embedding"
import Metadata from "./metadata"
import SegmentAdd, { ProcessStatus } from "./segment-add"
import BatchModal from "./batch-modal"
import style from "./style.module.css"
import Divider from "@/components/base/divider"
import Loading from "@/components/base/loading"
import type { MetadataType } from "@/service/datasets"
import {
  checkSegmentBatchImportProgress,
  fetchDocumentDetail,
  segmentBatchImport,
} from "@/service/datasets"
import { ToastContext } from "@/components/base/toast"
import type { DocForm } from "@/models/datasets"
import { useDatasetDetailContext } from "@/context/dataset-detail"
import FloatRightContainer from "@/components/base/float-right-container"
import useBreakpoints, { MediaType } from "@/hooks/use-breakpoints"

export const DocumentContext = createContext<{
  datasetId?: string
  documentId?: string
  docForm: string
}>({ docForm: "" })

type DocumentTitleProps = {
  extension?: string
  name?: string
  iconCls?: string
  textCls?: string
  wrapperCls?: string
}

export const DocumentTitle: FC<DocumentTitleProps> = ({
  extension,
  name,
  iconCls,
  textCls,
  wrapperCls,
}) => {
  const localExtension =
    extension?.toLowerCase() || name?.split(".")?.pop()?.toLowerCase()
  return (
    <div className={cn("flex flex-1 items-center justify-start", wrapperCls)}>
      <div
        className={cn(
          s[`${localExtension || "txt"}Icon`],
          style.titleIcon,
          iconCls,
        )}></div>
      <span className={cn("ml-1 text-lg font-semibold text-gray-900", textCls)}>
        {" "}
        {name || "--"}
      </span>
    </div>
  )
}

type Props = {
  datasetId: string
  documentId: string
}

const DocumentDetail: FC<Props> = ({ datasetId, documentId }) => {
  const router = useRouter()
  const { t } = useTranslation()

  const media = useBreakpoints()
  const isMobile = media === MediaType.mobile

  const { notify } = useContext(ToastContext)
  const { dataset } = useDatasetDetailContext()
  const embeddingAvailable = !!dataset?.embedding_available
  const [showMetadata, setShowMetadata] = useState(!isMobile)
  const [newSegmentModalVisible, setNewSegmentModalVisible] = useState(false)
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const [importStatus, setImportStatus] = useState<ProcessStatus | string>()
  const showNewSegmentModal = () => setNewSegmentModalVisible(true)
  const showBatchModal = () => setBatchModalVisible(true)
  const hideBatchModal = () => setBatchModalVisible(false)
  const resetProcessStatus = () => setImportStatus("")
  const checkProcess = async (jobID: string) => {
    try {
      const res = await checkSegmentBatchImportProgress({ jobID })
      setImportStatus(res.job_status)
      if (
        res.job_status === ProcessStatus.WAITING ||
        res.job_status === ProcessStatus.PROCESSING
      )
        setTimeout(() => checkProcess(res.job_id), 2500)
      if (res.job_status === ProcessStatus.ERROR)
        notify({
          type: "error",
          message: `${t("datasetDocuments.list.batchModal.runError")}`,
        })
    } catch (e: any) {
      notify({
        type: "error",
        message: `${t("datasetDocuments.list.batchModal.runError")}${"message" in e ? `: ${e.message}` : ""}`,
      })
    }
  }
  const runBatch = async (csv: File) => {
    const formData = new FormData()
    formData.append("file", csv)
    try {
      const res = await segmentBatchImport({
        url: `/datasets/${datasetId}/documents/${documentId}/segments/batch_import`,
        body: formData,
      })
      setImportStatus(res.job_status)
      checkProcess(res.job_id)
    } catch (e: any) {
      notify({
        type: "error",
        message: `${t("datasetDocuments.list.batchModal.runError")}${"message" in e ? `: ${e.message}` : ""}`,
      })
    }
  }

  const {
    data: documentDetail,
    error,
    mutate: detailMutate,
  } = useSWR(
    {
      action: "fetchDocumentDetail",
      datasetId,
      documentId,
      params: { metadata: "without" as MetadataType },
    },
    apiParams => fetchDocumentDetail(omit(apiParams, "action")),
  )

  const {
    data: documentMetadata,
    error: metadataErr,
    mutate: metadataMutate,
  } = useSWR(
    {
      action: "fetchDocumentDetail",
      datasetId,
      documentId,
      params: { metadata: "only" as MetadataType },
    },
    apiParams => fetchDocumentDetail(omit(apiParams, "action")),
  )

  const backToPrev = () => {
    router.push(`/datasets/${datasetId}/documents`)
  }

  const isDetailLoading = !documentDetail && !error
  const isMetadataLoading = !documentMetadata && !metadataErr

  const embedding = ["queuing", "indexing", "paused"].includes(
    (documentDetail?.display_status || "").toLowerCase(),
  )

  const handleOperate = (operateName?: string) => {
    if (operateName === "delete") backToPrev()
    else detailMutate()
  }

  return (
    <DocumentContext.Provider
      value={{
        datasetId,
        documentId,
        docForm: documentDetail?.doc_form || "",
      }}>
      <div className="flex h-full flex-col">
        <div className="min-h-16 flex flex-wrap items-center justify-between gap-y-2 border-b border-b-gray-100 p-4">
          <div
            onClick={backToPrev}
            className={
              "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-100 shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] hover:border-gray-300"
            }>
            <ArrowLeftIcon className="text-primary-600 h-4 w-4 fill-current stroke-current" />
          </div>
          <Divider className="!h-4" type="vertical" />
          <DocumentTitle
            extension={documentDetail?.data_source_info?.upload_file?.extension}
            name={documentDetail?.name}
          />
          <div className="flex flex-wrap items-center gap-y-2">
            <StatusItem
              status={documentDetail?.display_status || "available"}
              scene="detail"
              errorMessage={documentDetail?.error || ""}
            />
            {embeddingAvailable &&
              documentDetail &&
              !documentDetail.archived && (
                <SegmentAdd
                  importStatus={importStatus}
                  clearProcessStatus={resetProcessStatus}
                  showNewSegmentModal={showNewSegmentModal}
                  showBatchModal={showBatchModal}
                />
              )}
            <OperationAction
              scene="detail"
              embeddingAvailable={embeddingAvailable}
              detail={{
                name: documentDetail?.name || "",
                enabled: documentDetail?.enabled || false,
                archived: documentDetail?.archived || false,
                id: documentId,
                data_source_type: documentDetail?.data_source_type || "",
                doc_form: documentDetail?.doc_form || "",
              }}
              datasetId={datasetId}
              onUpdate={handleOperate}
              className="!w-[216px]"
            />
            <button
              className={cn(
                style.layoutRightIcon,
                showMetadata ? style.iconShow : style.iconClose,
              )}
              onClick={() => setShowMetadata(!showMetadata)}
            />
          </div>
        </div>
        <div
          className="flex flex-1 flex-row"
          style={{ height: "calc(100% - 4rem)" }}>
          {isDetailLoading ? (
            <Loading type="app" />
          ) : (
            <div
              className={`flex h-full w-full flex-col ${embedding ? "px-6 py-3 sm:px-16 sm:py-12" : "px-6 pb-[30px] pt-3"}`}>
              {embedding ? (
                <Embedding
                  detail={documentDetail}
                  detailUpdate={detailMutate}
                />
              ) : (
                <Completed
                  embeddingAvailable={embeddingAvailable}
                  showNewSegmentModal={newSegmentModalVisible}
                  onNewSegmentModalChange={setNewSegmentModalVisible}
                  importStatus={importStatus}
                  archived={documentDetail?.archived}
                />
              )}
            </div>
          )}
          <FloatRightContainer
            showClose
            isOpen={showMetadata}
            onClose={() => setShowMetadata(false)}
            isMobile={isMobile}
            panelClassname="!justify-start"
            footer={null}>
            <Metadata
              docDetail={
                {
                  ...documentDetail,
                  ...documentMetadata,
                  doc_type:
                    documentMetadata?.doc_type === "others"
                      ? ""
                      : documentMetadata?.doc_type,
                } as any
              }
              loading={isMetadataLoading}
              onUpdate={metadataMutate}
            />
          </FloatRightContainer>
        </div>
        <BatchModal
          isShow={batchModalVisible}
          onCancel={hideBatchModal}
          onConfirm={runBatch}
          docForm={documentDetail?.doc_form as DocForm}
        />
      </div>
    </DocumentContext.Provider>
  )
}

export default DocumentDetail
