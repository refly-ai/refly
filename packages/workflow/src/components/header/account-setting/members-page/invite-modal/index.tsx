"use client"
import { Fragment, useCallback, useMemo, useState } from "react"
import { useContext } from "use-context-selector"
import { XMarkIcon } from "@heroicons/react/24/outline"
import { useTranslation } from "react-i18next"
import { ReactMultiEmail } from "react-multi-email"
import { Listbox, Transition } from "@headlessui/react"
import { CheckIcon } from "@heroicons/react/20/solid"
import cn from "classnames"
import s from "./index.module.css"
import Modal from "@/components/base/modal"
import Button from "@/components/base/button"
import { inviteMember } from "@/service/common"
import { emailRegex } from "@/config"
import { ToastContext } from "@/components/base/toast"
import type { InvitationResult } from "@/models/common"
import I18n from "@/context/i18n"

import "react-multi-email/dist/style.css"
type IInviteModalProps = {
  onCancel: () => void
  onSend: (invitationResults: InvitationResult[]) => void
}

const InviteModal = ({ onCancel, onSend }: IInviteModalProps) => {
  const { t } = useTranslation()
  const [emails, setEmails] = useState<string[]>([])
  const { notify } = useContext(ToastContext)

  const { locale } = useContext(I18n)

  const InvitingRoles = useMemo(
    () => [
      {
        name: "normal",
        description: t("common.members.normalTip"),
      },
      {
        name: "editor",
        description: t("common.members.editorTip"),
      },
      {
        name: "admin",
        description: t("common.members.adminTip"),
      },
    ],
    [t],
  )
  const [role, setRole] = useState(InvitingRoles[0])

  const handleSend = useCallback(async () => {
    if (emails.map((email: string) => emailRegex.test(email)).every(Boolean)) {
      try {
        const { result, invitation_results } = await inviteMember({
          url: "/workspaces/current/members/invite-email",
          body: { emails, role: role.name, language: locale },
        })

        if (result === "success") {
          onCancel()
          onSend(invitation_results)
        }
      } catch (e) {}
    } else {
      notify({ type: "error", message: t("common.members.emailInvalid") })
    }
  }, [role, emails, notify, onCancel, onSend, t])

  return (
    <div className={cn(s.wrap)}>
      <Modal overflowVisible isShow onClose={() => {}} className={cn(s.modal)}>
        <div className="mb-2 flex justify-between">
          <div className="text-xl font-semibold text-gray-900">
            {t("common.members.inviteTeamMember")}
          </div>
          <XMarkIcon className="h-4 w-4 cursor-pointer" onClick={onCancel} />
        </div>
        <div className="mb-7 text-[13px] text-gray-500">
          {t("common.members.inviteTeamMemberTip")}
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-gray-900">
            {t("common.members.email")}
          </div>
          <div className="mb-8 flex h-36 items-stretch">
            <ReactMultiEmail
              className={cn(
                "w-full border-none px-3 pt-2 outline-none",
                "appearance-none overflow-y-auto rounded-lg text-sm text-gray-900",
                s.emailsInput,
              )}
              autoFocus
              emails={emails}
              inputClassName="bg-transparent"
              onChange={setEmails}
              getLabel={(email, index, removeEmail) => (
                <div data-tag key={index} className={cn(s.emailBackground)}>
                  <div data-tag-item>{email}</div>
                  <span data-tag-handle onClick={() => removeEmail(index)}>
                    ×
                  </span>
                </div>
              )}
              placeholder={t("common.members.emailPlaceholder") || ""}
            />
          </div>
          <Listbox value={role} onChange={setRole}>
            <div className="relative pb-6">
              <Listbox.Button className="relative w-full appearance-none rounded-lg border-none bg-gray-100 py-2 pl-3 pr-10 text-left text-sm text-gray-900 outline-none">
                <span className="block truncate capitalize">
                  {t("common.members.invitedAsRole", {
                    role: t(`common.members.${role.name}`),
                  })}
                </span>
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-200"
                leaveFrom="opacity-200"
                leaveTo="opacity-0">
                <Listbox.Options className="absolute my-2 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {InvitingRoles.map(role => (
                    <Listbox.Option
                      key={role.name}
                      className={({ active }) =>
                        `${active ? "rounded-xl bg-gray-50" : "bg-transparent"} relative mx-2 flex cursor-default select-none flex-col px-4 py-2`
                      }
                      value={role}>
                      {({ selected }) => (
                        <div className="flex flex-row">
                          <span
                            className={cn(
                              "mr-2 text-indigo-600",
                              "flex items-center",
                            )}>
                            {selected && (
                              <CheckIcon
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                          <div className="flex flex-grow flex-col">
                            <span
                              className={`${selected ? "font-medium" : "font-normal"} block truncate capitalize`}>
                              {t(`common.members.${role.name}`)}
                            </span>
                            <span
                              className={`${selected ? "font-medium" : "font-normal"} block capitalize text-gray-500`}>
                              {role.description}
                            </span>
                          </div>
                        </div>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
          <Button
            tabIndex={0}
            className="w-full"
            onClick={handleSend}
            disabled={!emails.length}
            variant="primary">
            {t("common.members.sendInvite")}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default InviteModal
