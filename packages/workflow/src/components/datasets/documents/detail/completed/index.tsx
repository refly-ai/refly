"use client"
import type { FC } from "react"
import React, { memo, useEffect, useMemo, useState } from "react"
import { HashtagIcon } from "@heroicons/react/24/solid"
import { useTranslation } from "react-i18next"
import { useContext } from "use-context-selector"
import { debounce, isNil, omitBy } from "lodash-es"
import cn from "classnames"
import { RiCloseLine, RiEditLine } from "@remixicon/react"
import { StatusItem } from "../../list"
import { DocumentContext } from "../index"
import { ProcessStatus } from "../segment-add"
import s from "./style.module.css"
import InfiniteVirtualList from "./InfiniteVirtualList"
import { formatNumber } from "@/utils/format"
import Modal from "@/components/base/modal"
import Switch from "@/components/base/switch"
import Divider from "@/components/base/divider"
import Input from "@/components/base/input"
import { ToastContext } from "@/components/base/toast"
import type { Item } from "@/components/base/select"
import { SimpleSelect } from "@/components/base/select"
import {
  deleteSegment,
  disableSegment,
  enableSegment,
  fetchSegments,
  updateSegment,
} from "@/service/datasets"
import type {
  SegmentDetailModel,
  SegmentUpdator,
  SegmentsQuery,
  SegmentsResponse,
} from "@/models/datasets"
import { asyncRunSafe } from "@/utils"
import type { CommonResponse } from "@/models/common"
import AutoHeightTextarea from "@/components/base/auto-height-textarea/common"
import Button from "@/components/base/button"
import NewSegmentModal from "@/components/datasets/documents/detail/new-segment-modal"
import TagInput from "@/components/base/tag-input"
import { useEventEmitterContextContext } from "@/context/event-emitter"

export const SegmentIndexTag: FC<{
  positionId: string | number
  className?: string
}> = ({ positionId, className }) => {
  const localPositionId = useMemo(() => {
    const positionIdStr = String(positionId)
    if (positionIdStr.length >= 3) return positionId
    return positionIdStr.padStart(3, "0")
  }, [positionId])
  return (
    <div
      className={`box-border flex items-center rounded-md border border-gray-200 pl-1 pr-1.5 text-[11px] font-medium italic text-gray-500 ${className ?? ""}`}>
      <HashtagIcon className="mr-1 h-3 w-3 fill-current stroke-current stroke-1 text-gray-400" />
      {localPositionId}
    </div>
  )
}

type ISegmentDetailProps = {
  embeddingAvailable: boolean
  segInfo?: Partial<SegmentDetailModel> & { id: string }
  onChangeSwitch?: (segId: string, enabled: boolean) => Promise<void>
  onUpdate: (segmentId: string, q: string, a: string, k: string[]) => void
  onCancel: () => void
  archived?: boolean
}
/**
 * Show all the contents of the segment
 */
const SegmentDetailComponent: FC<ISegmentDetailProps> = ({
  embeddingAvailable,
  segInfo,
  archived,
  onChangeSwitch,
  onUpdate,
  onCancel,
}) => {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [question, setQuestion] = useState(segInfo?.content || "")
  const [answer, setAnswer] = useState(segInfo?.answer || "")
  const [keywords, setKeywords] = useState<string[]>(segInfo?.keywords || [])
  const { eventEmitter } = useEventEmitterContextContext()
  const [loading, setLoading] = useState(false)

  eventEmitter?.useSubscription(v => {
    if (v === "update-segment") setLoading(true)
    else setLoading(false)
  })

  const handleCancel = () => {
    setIsEditing(false)
    setQuestion(segInfo?.content || "")
    setAnswer(segInfo?.answer || "")
    setKeywords(segInfo?.keywords || [])
  }
  const handleSave = () => {
    onUpdate(segInfo?.id || "", question, answer, keywords)
  }

  const renderContent = () => {
    if (segInfo?.answer) {
      return (
        <>
          <div className="mb-1 text-xs font-medium text-gray-500">QUESTION</div>
          <AutoHeightTextarea
            outerClassName="mb-4"
            className="text-md leading-6 text-gray-800"
            value={question}
            placeholder={
              t("datasetDocuments.segment.questionPlaceholder") || ""
            }
            onChange={e => setQuestion(e.target.value)}
            disabled={!isEditing}
          />
          <div className="mb-1 text-xs font-medium text-gray-500">ANSWER</div>
          <AutoHeightTextarea
            outerClassName="mb-4"
            className="text-md leading-6 text-gray-800"
            value={answer}
            placeholder={t("datasetDocuments.segment.answerPlaceholder") || ""}
            onChange={e => setAnswer(e.target.value)}
            disabled={!isEditing}
            autoFocus
          />
        </>
      )
    }

    return (
      <AutoHeightTextarea
        className="text-md leading-6 text-gray-800"
        value={question}
        placeholder={t("datasetDocuments.segment.contentPlaceholder") || ""}
        onChange={e => setQuestion(e.target.value)}
        disabled={!isEditing}
        autoFocus
      />
    )
  }

  return (
    <div className={"relative flex flex-col"}>
      <div className="absolute right-0 top-0 flex h-7 items-center">
        {isEditing && (
          <>
            <Button onClick={handleCancel}>
              {t("common.operation.cancel")}
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={loading}>
              {t("common.operation.save")}
            </Button>
          </>
        )}
        {!isEditing && !archived && embeddingAvailable && (
          <>
            <div className="group relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-md hover:bg-gray-100">
              <div
                className={cn(
                  s.editTip,
                  "absolute -top-10 hidden h-[34px] items-center whitespace-nowrap rounded-lg bg-white px-3 text-xs font-semibold text-gray-700 group-hover:flex",
                )}>
                {t("common.operation.edit")}
              </div>
              <RiEditLine
                className="h-4 w-4 text-gray-500"
                onClick={() => setIsEditing(true)}
              />
            </div>
            <div className="mx-3 h-3 w-[1px] bg-gray-200" />
          </>
        )}
        <div
          className="flex h-6 w-6 cursor-pointer items-center justify-center"
          onClick={onCancel}>
          <RiCloseLine className="h-4 w-4 text-gray-500" />
        </div>
      </div>
      <SegmentIndexTag
        positionId={segInfo?.position || ""}
        className="mb-6 mt-[2px] w-fit"
      />
      <div className={s.segModalContent}>{renderContent()}</div>
      <div className={s.keywordTitle}>
        {t("datasetDocuments.segment.keywords")}
      </div>
      <div className={s.keywordWrapper}>
        {!segInfo?.keywords?.length ? (
          "-"
        ) : (
          <TagInput
            items={keywords}
            onChange={newKeywords => setKeywords(newKeywords)}
            disableAdd={!isEditing}
            disableRemove={!isEditing || keywords.length === 1}
          />
        )}
      </div>
      <div className={cn(s.footer, s.numberInfo)}>
        <div className="flex flex-wrap items-center gap-y-2">
          <div className={cn(s.commonIcon, s.typeSquareIcon)} />
          <span className="mr-8">
            {formatNumber(segInfo?.word_count as number)}{" "}
            {t("datasetDocuments.segment.characters")}
          </span>
          <div className={cn(s.commonIcon, s.targetIcon)} />
          <span className="mr-8">
            {formatNumber(segInfo?.hit_count as number)}{" "}
            {t("datasetDocuments.segment.hitCount")}
          </span>
          <div className={cn(s.commonIcon, s.bezierCurveIcon)} />
          <span className={s.hashText}>
            {t("datasetDocuments.segment.vectorHash")}
            {segInfo?.index_node_hash}
          </span>
        </div>
        <div className="flex items-center">
          <StatusItem
            status={segInfo?.enabled ? "enabled" : "disabled"}
            reverse
            textCls="text-gray-500 text-xs"
          />
          {embeddingAvailable && (
            <>
              <Divider type="vertical" className="!h-2" />
              <Switch
                size="md"
                defaultValue={segInfo?.enabled}
                onChange={async val => {
                  await onChangeSwitch?.(segInfo?.id || "", val)
                }}
                disabled={archived}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
export const SegmentDetail = memo(SegmentDetailComponent)

export const splitArray = (arr: any[], size = 3) => {
  if (!arr || !arr.length) return []
  const result = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

type ICompletedProps = {
  embeddingAvailable: boolean
  showNewSegmentModal: boolean
  onNewSegmentModalChange: (state: boolean) => void
  importStatus: ProcessStatus | string | undefined
  archived?: boolean
  // data: Array<{}> // all/part segments
}
/**
 * Embedding done, show list of all segments
 * Support search and filter
 */
const Completed: FC<ICompletedProps> = ({
  embeddingAvailable,
  showNewSegmentModal,
  onNewSegmentModalChange,
  importStatus,
  archived,
}) => {
  const { t } = useTranslation()
  const { notify } = useContext(ToastContext)
  const {
    datasetId = "",
    documentId = "",
    docForm,
  } = useContext(DocumentContext)
  // the current segment id and whether to show the modal
  const [currSegment, setCurrSegment] = useState<{
    segInfo?: SegmentDetailModel
    showModal: boolean
  }>({ showModal: false })

  const [searchValue, setSearchValue] = useState<string>() // the search value
  const [selectedStatus, setSelectedStatus] = useState<boolean | "all">("all") // the selected status, enabled/disabled/undefined

  const [lastSegmentsRes, setLastSegmentsRes] = useState<
    SegmentsResponse | undefined
  >(undefined)
  const [allSegments, setAllSegments] = useState<Array<SegmentDetailModel[]>>(
    [],
  ) // all segments data
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState<number | undefined>()
  const { eventEmitter } = useEventEmitterContextContext()

  const onChangeStatus = ({ value }: Item) => {
    setSelectedStatus(value === "all" ? "all" : !!value)
  }

  const getSegments = async (needLastId?: boolean) => {
    const finalLastId =
      lastSegmentsRes?.data?.[lastSegmentsRes.data.length - 1]?.id || ""
    setLoading(true)
    const [e, res] = await asyncRunSafe<SegmentsResponse>(
      fetchSegments({
        datasetId,
        documentId,
        params: omitBy(
          {
            last_id: !needLastId ? undefined : finalLastId,
            limit: 12,
            keyword: searchValue,
            enabled: selectedStatus === "all" ? "all" : !!selectedStatus,
          },
          isNil,
        ) as SegmentsQuery,
      }) as Promise<SegmentsResponse>,
    )
    if (!e) {
      setAllSegments([
        ...(!needLastId ? [] : allSegments),
        ...splitArray(res.data || []),
      ])
      setLastSegmentsRes(res)
      if (!lastSegmentsRes || !needLastId) setTotal(res?.total || 0)
    }
    setLoading(false)
  }

  const resetList = () => {
    setLastSegmentsRes(undefined)
    setAllSegments([])
    setLoading(false)
    setTotal(undefined)
    getSegments(false)
  }

  const onClickCard = (detail: SegmentDetailModel) => {
    setCurrSegment({ segInfo: detail, showModal: true })
  }

  const onCloseModal = () => {
    setCurrSegment({ ...currSegment, showModal: false })
  }

  const onChangeSwitch = async (segId: string, enabled: boolean) => {
    const opApi = enabled ? enableSegment : disableSegment
    const [e] = await asyncRunSafe<CommonResponse>(
      opApi({ datasetId, segmentId: segId }) as Promise<CommonResponse>,
    )
    if (!e) {
      notify({
        type: "success",
        message: t("common.actionMsg.modifiedSuccessfully"),
      })
      for (const item of allSegments) {
        for (const seg of item) {
          if (seg.id === segId) seg.enabled = enabled
        }
      }
      setAllSegments([...allSegments])
    } else {
      notify({
        type: "error",
        message: t("common.actionMsg.modifiedUnsuccessfully"),
      })
    }
  }

  const onDelete = async (segId: string) => {
    const [e] = await asyncRunSafe<CommonResponse>(
      deleteSegment({
        datasetId,
        documentId,
        segmentId: segId,
      }) as Promise<CommonResponse>,
    )
    if (!e) {
      notify({
        type: "success",
        message: t("common.actionMsg.modifiedSuccessfully"),
      })
      resetList()
    } else {
      notify({
        type: "error",
        message: t("common.actionMsg.modifiedUnsuccessfully"),
      })
    }
  }

  const handleUpdateSegment = async (
    segmentId: string,
    question: string,
    answer: string,
    keywords: string[],
  ) => {
    const params: SegmentUpdator = { content: "" }
    if (docForm === "qa_model") {
      if (!question.trim())
        return notify({
          type: "error",
          message: t("datasetDocuments.segment.questionEmpty"),
        })
      if (!answer.trim())
        return notify({
          type: "error",
          message: t("datasetDocuments.segment.answerEmpty"),
        })

      params.content = question
      params.answer = answer
    } else {
      if (!question.trim())
        return notify({
          type: "error",
          message: t("datasetDocuments.segment.contentEmpty"),
        })

      params.content = question
    }

    if (keywords.length) params.keywords = keywords

    try {
      eventEmitter?.emit("update-segment")
      const res = await updateSegment({
        datasetId,
        documentId,
        segmentId,
        body: params,
      })
      notify({
        type: "success",
        message: t("common.actionMsg.modifiedSuccessfully"),
      })
      onCloseModal()
      for (const item of allSegments) {
        for (const seg of item) {
          if (seg.id === segmentId) {
            seg.answer = res.data.answer
            seg.content = res.data.content
            seg.keywords = res.data.keywords
            seg.word_count = res.data.word_count
            seg.hit_count = res.data.hit_count
            seg.index_node_hash = res.data.index_node_hash
            seg.enabled = res.data.enabled
          }
        }
      }
      setAllSegments([...allSegments])
    } finally {
      eventEmitter?.emit("")
    }
  }

  useEffect(() => {
    if (lastSegmentsRes !== undefined) getSegments(false)
  }, [selectedStatus, searchValue])

  useEffect(() => {
    if (importStatus === ProcessStatus.COMPLETED) resetList()
  }, [importStatus])

  return (
    <>
      <div className={s.docSearchWrapper}>
        <div className={s.totalText}>
          {total ? formatNumber(total) : "--"}{" "}
          {t("datasetDocuments.segment.paragraphs")}
        </div>
        <SimpleSelect
          onSelect={onChangeStatus}
          items={[
            { value: "all", name: t("datasetDocuments.list.index.all") },
            { value: 0, name: t("datasetDocuments.list.status.disabled") },
            { value: 1, name: t("datasetDocuments.list.status.enabled") },
          ]}
          defaultValue={"all"}
          className={s.select}
          wrapperClassName="h-fit w-[120px] mr-2"
        />
        <Input
          showPrefix
          wrapperClassName="!w-52"
          className="!h-8"
          onChange={debounce(setSearchValue, 500)}
        />
      </div>
      <InfiniteVirtualList
        embeddingAvailable={embeddingAvailable}
        hasNextPage={lastSegmentsRes?.has_more ?? true}
        isNextPageLoading={loading}
        items={allSegments}
        loadNextPage={getSegments}
        onChangeSwitch={onChangeSwitch}
        onDelete={onDelete}
        onClick={onClickCard}
        archived={archived}
      />
      <Modal
        isShow={currSegment.showModal}
        onClose={() => {}}
        className="!max-w-[640px] !overflow-visible">
        <SegmentDetail
          embeddingAvailable={embeddingAvailable}
          segInfo={currSegment.segInfo ?? { id: "" }}
          onChangeSwitch={onChangeSwitch}
          onUpdate={handleUpdateSegment}
          onCancel={onCloseModal}
          archived={archived}
        />
      </Modal>
      <NewSegmentModal
        isShow={showNewSegmentModal}
        docForm={docForm}
        onCancel={() => onNewSegmentModalChange(false)}
        onSave={resetList}
      />
    </>
  )
}

export default Completed
