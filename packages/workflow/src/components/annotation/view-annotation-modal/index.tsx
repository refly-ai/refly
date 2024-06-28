"use client"
import type { FC } from "react"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { Pagination } from "react-headless-pagination"
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline"
import EditItem, { EditItemType } from "../edit-annotation-modal/edit-item"
import type { AnnotationItem, HitHistoryItem } from "../type"
import s from "./style.module.css"
import HitHistoryNoData from "./hit-history-no-data"
import Drawer from "@/components/base/drawer-plus"
import { MessageCheckRemove } from "@/components/base/icons/src/vender/line/communication"
import DeleteConfirmModal from "@/components/base/modal/delete-confirm-modal"
import TabSlider from "@/components/base/tab-slider-plain"
import { fetchHitHistoryList } from "@/service/annotation"
import { APP_PAGE_LIMIT } from "@/config"
import useTimestamp from "@/hooks/use-timestamp"

type Props = {
  appId: string
  isShow: boolean
  onHide: () => void
  item: AnnotationItem
  onSave: (editedQuery: string, editedAnswer: string) => void
  onRemove: () => void
}

enum TabType {
  annotation = "annotation",
  hitHistory = "hitHistory",
}

const ViewAnnotationModal: FC<Props> = ({
  appId,
  isShow,
  onHide,
  item,
  onSave,
  onRemove,
}) => {
  const { id, question, answer, created_at: createdAt } = item
  const [newQuestion, setNewQuery] = useState(question)
  const [newAnswer, setNewAnswer] = useState(answer)
  const { t } = useTranslation()
  const { formatTime } = useTimestamp()
  const [currPage, setCurrPage] = React.useState<number>(0)
  const [total, setTotal] = useState(0)
  const [hitHistoryList, setHitHistoryList] = useState<HitHistoryItem[]>([])
  const fetchHitHistory = async (page = 1) => {
    try {
      const { data, total }: any = await fetchHitHistoryList(appId, id, {
        page,
        limit: 10,
      })
      setHitHistoryList(data as HitHistoryItem[])
      setTotal(total)
    } catch (e) {}
  }

  useEffect(() => {
    fetchHitHistory(currPage + 1)
  }, [currPage])

  const tabs = [
    {
      value: TabType.annotation,
      text: t("appAnnotation.viewModal.annotatedResponse"),
    },
    {
      value: TabType.hitHistory,
      text:
        hitHistoryList.length > 0 ? (
          <div className="flex items-center space-x-1">
            <div>{t("appAnnotation.viewModal.hitHistory")}</div>
            <div className="item-center flex h-5 rounded-md border border-black/[8%] px-1.5 text-xs font-medium text-gray-500">
              {total}{" "}
              {t(
                `appAnnotation.viewModal.hit${hitHistoryList.length > 1 ? "s" : ""}`,
              )}
            </div>
          </div>
        ) : (
          t("appAnnotation.viewModal.hitHistory")
        ),
    },
  ]
  const [activeTab, setActiveTab] = useState(TabType.annotation)
  const handleSave = (type: EditItemType, editedContent: string) => {
    if (type === EditItemType.Query) {
      setNewQuery(editedContent)
      onSave(editedContent, newAnswer)
    } else {
      setNewAnswer(editedContent)
      onSave(newQuestion, editedContent)
    }
  }
  const [showModal, setShowModal] = useState(false)

  const annotationTab = (
    <>
      <EditItem
        type={EditItemType.Query}
        content={question}
        onSave={editedContent => handleSave(EditItemType.Query, editedContent)}
      />
      <EditItem
        type={EditItemType.Answer}
        content={answer}
        onSave={editedContent => handleSave(EditItemType.Answer, editedContent)}
      />
    </>
  )

  const hitHistoryTab =
    total === 0 ? (
      <HitHistoryNoData />
    ) : (
      <div>
        <table
          className={cn(
            s.table,
            "w-full min-w-[440px] border-collapse border-0 text-sm",
          )}>
          <thead className="h-8 border-b border-gray-200 font-bold leading-8 text-gray-500">
            <tr className="uppercase">
              <td className="whitespace-nowrap">
                {t("appAnnotation.hitHistoryTable.query")}
              </td>
              <td className="whitespace-nowrap">
                {t("appAnnotation.hitHistoryTable.match")}
              </td>
              <td className="whitespace-nowrap">
                {t("appAnnotation.hitHistoryTable.response")}
              </td>
              <td className="whitespace-nowrap">
                {t("appAnnotation.hitHistoryTable.source")}
              </td>
              <td className="whitespace-nowrap">
                {t("appAnnotation.hitHistoryTable.score")}
              </td>
              <td className="w-[160px] whitespace-nowrap">
                {t("appAnnotation.hitHistoryTable.time")}
              </td>
            </tr>
          </thead>
          <tbody className="text-gray-500">
            {hitHistoryList.map(item => (
              <tr
                key={item.id}
                className={
                  "h-8 cursor-pointer border-b border-gray-200 hover:bg-gray-50"
                }>
                <td
                  className="max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap"
                  title={item.question}>
                  {item.question}
                </td>
                <td
                  className="max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap"
                  title={item.match}>
                  {item.match}
                </td>
                <td
                  className="max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap"
                  title={item.response}>
                  {item.response}
                </td>
                <td>{item.source}</td>
                <td>{item.score ? item.score.toFixed(2) : "-"}</td>
                <td>
                  {formatTime(
                    item.created_at,
                    t("appLog.dateTimeFormat") as string,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total && total > APP_PAGE_LIMIT ? (
          <Pagination
            className="mt-8 flex h-10 w-full select-none items-center text-sm"
            currentPage={currPage}
            edgePageCount={2}
            middlePagesSiblingCount={1}
            setCurrentPage={setCurrPage}
            totalPages={Math.ceil(total / APP_PAGE_LIMIT)}
            truncableClassName="w-8 px-0.5 text-center"
            truncableText="...">
            <Pagination.PrevButton
              disabled={currPage === 0}
              className={`mr-2 flex items-center text-gray-500 focus:outline-none ${currPage === 0 ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-gray-600 dark:hover:text-gray-200"}`}>
              <ArrowLeftIcon className="mr-3 h-3 w-3" />
              {t("appLog.table.pagination.previous")}
            </Pagination.PrevButton>
            <div
              className={`flex flex-grow items-center justify-center ${s.pagination}`}>
              <Pagination.PageButton
                activeClassName="bg-primary-50 dark:bg-opacity-0 text-primary-600 dark:text-white"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full"
                inactiveClassName="text-gray-500"
              />
            </div>
            <Pagination.NextButton
              disabled={currPage === Math.ceil(total / APP_PAGE_LIMIT) - 1}
              className={`mr-2 flex items-center text-gray-500 focus:outline-none ${currPage === Math.ceil(total / APP_PAGE_LIMIT) - 1 ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-gray-600 dark:hover:text-gray-200"}`}>
              {t("appLog.table.pagination.next")}
              <ArrowRightIcon className="ml-3 h-3 w-3" />
            </Pagination.NextButton>
          </Pagination>
        ) : null}
      </div>
    )
  return (
    <div>
      <Drawer
        isShow={isShow}
        onHide={onHide}
        maxWidthClassName="!max-w-[800px]"
        // t('appAnnotation.editModal.title') as string
        title={
          <TabSlider
            className="relative top-[9px] shrink-0"
            value={activeTab}
            onChange={v => setActiveTab(v as TabType)}
            options={tabs}
            noBorderBottom
            itemClassName="!pb-3.5"
          />
        }
        body={
          <div className="space-y-6 p-6 pb-4">
            {activeTab === TabType.annotation ? annotationTab : hitHistoryTab}
          </div>
        }
        foot={
          id ? (
            <div className="flex h-16 items-center justify-between rounded-bl-xl rounded-br-xl border-t border-black/5 bg-gray-50 px-4 text-[13px] font-medium leading-[18px] text-gray-500">
              <div
                className="flex cursor-pointer items-center space-x-2 pl-3"
                onClick={() => setShowModal(true)}>
                <MessageCheckRemove />
                <div>{t("appAnnotation.editModal.removeThisCache")}</div>
              </div>
              <div>
                {t("appAnnotation.editModal.createdAt")}&nbsp;
                {formatTime(createdAt, t("appLog.dateTimeFormat") as string)}
              </div>
            </div>
          ) : undefined
        }
      />
      <DeleteConfirmModal
        isShow={showModal}
        onHide={() => setShowModal(false)}
        onRemove={async () => {
          await onRemove()
          setShowModal(false)
          onHide()
        }}
        text={t("appDebug.feature.annotation.removeConfirm") as string}
      />
    </div>
  )
}
export default React.memo(ViewAnnotationModal)
