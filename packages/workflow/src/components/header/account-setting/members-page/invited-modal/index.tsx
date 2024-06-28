import { CheckCircleIcon } from "@heroicons/react/24/solid"
import { QuestionMarkCircleIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { useTranslation } from "react-i18next"
import { useMemo } from "react"
import InvitationLink from "./invitation-link"
import s from "./index.module.css"
import Modal from "@/components/base/modal"
import Button from "@/components/base/button"
import { IS_CE_EDITION } from "@/config"
import type { InvitationResult } from "@/models/common"
import Tooltip from "@/components/base/tooltip"

export type SuccessInvationResult = Extract<
  InvitationResult,
  { status: "success" }
>
export type FailedInvationResult = Extract<
  InvitationResult,
  { status: "failed" }
>

type IInvitedModalProps = {
  invitationResults: InvitationResult[]
  onCancel: () => void
}
const InvitedModal = ({ invitationResults, onCancel }: IInvitedModalProps) => {
  const { t } = useTranslation()

  const successInvationResults = useMemo<SuccessInvationResult[]>(
    () =>
      invitationResults?.filter(
        item => item.status === "success",
      ) as SuccessInvationResult[],
    [invitationResults],
  )
  const failedInvationResults = useMemo<FailedInvationResult[]>(
    () =>
      invitationResults?.filter(
        item => item.status !== "success",
      ) as FailedInvationResult[],
    [invitationResults],
  )

  return (
    <div className={s.wrap}>
      <Modal isShow onClose={() => {}} className={s.modal}>
        <div className="mb-3 flex justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border-[0.5px] border-gray-100 bg-white shadow-xl">
            <CheckCircleIcon className="h-[22px] w-[22px] text-[#039855]" />
          </div>
          <XMarkIcon className="h-4 w-4 cursor-pointer" onClick={onCancel} />
        </div>
        <div className="mb-1 text-xl font-semibold text-gray-900">
          {t("common.members.invitationSent")}
        </div>
        {!IS_CE_EDITION && (
          <div className="mb-10 text-sm text-gray-500">
            {t("common.members.invitationSentTip")}
          </div>
        )}
        {IS_CE_EDITION && (
          <>
            <div className="mb-5 text-sm text-gray-500">
              {t("common.members.invitationSentTip")}
            </div>
            <div className="mb-9 flex flex-col gap-2">
              {!!successInvationResults.length && (
                <>
                  <div className="font-Medium py-2 text-sm text-gray-900">
                    {t("common.members.invitationLink")}
                  </div>
                  {successInvationResults.map(item => (
                    <InvitationLink key={item.email} value={item} />
                  ))}
                </>
              )}
              {!!failedInvationResults.length && (
                <>
                  <div className="font-Medium py-2 text-sm text-gray-900">
                    {t("common.members.failedinvitationEmails")}
                  </div>
                  <div className="flex flex-wrap justify-between gap-y-1">
                    {failedInvationResults.map(item => (
                      <div
                        key={item.email}
                        className="flex justify-center rounded-md border border-red-300 bg-orange-50 px-1">
                        <Tooltip
                          selector={`invitation-tag-${item.email}`}
                          htmlContent={item.message}>
                          <div className="flex items-center justify-center gap-1 text-sm">
                            {item.email}
                            <QuestionMarkCircleIcon className="h-4 w-4 text-red-300" />
                          </div>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
        <div className="flex justify-end">
          <Button className="w-[96px]" onClick={onCancel} variant="primary">
            {t("common.members.ok")}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default InvitedModal
