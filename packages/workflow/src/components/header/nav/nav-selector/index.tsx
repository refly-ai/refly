"use client"
import { useTranslation } from "react-i18next"
import { Fragment, useCallback } from "react"
import cn from "classnames"
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
} from "@remixicon/react"
import { Menu, Transition } from "@headlessui/react"
import { useRouter } from "next/navigation"
import { debounce } from "lodash-es"
import AppIcon from "@/components/base/app-icon"
import {
  AiText,
  ChatBot,
  CuteRobote,
} from "@/components/base/icons/src/vender/solid/communication"
import { Route } from "@/components/base/icons/src/vender/solid/mapsAndTravel"
import { useAppContext } from "@/context/app-context"
import { useStore as useAppStore } from "@/store"
import {
  FileArrow01,
  FilePlus01,
  FilePlus02,
} from "@/components/base/icons/src/vender/line/files"

export type NavItem = {
  id: string
  name: string
  link: string
  icon: string
  icon_background: string
  mode: string
}
export type INavSelectorProps = {
  navs: NavItem[]
  curNav?: Omit<NavItem, "link">
  createText: string
  isApp: boolean
  onCreate: (state: string) => void
  onLoadmore?: () => void
}

const NavSelector = ({
  curNav,
  navs,
  createText,
  isApp,
  onCreate,
  onLoadmore,
}: INavSelectorProps) => {
  const { t } = useTranslation()
  const router = useRouter()
  const { isCurrentWorkspaceEditor } = useAppContext()
  const setAppDetail = useAppStore(state => state.setAppDetail)

  const handleScroll = useCallback(
    debounce(e => {
      if (typeof onLoadmore === "function") {
        const { clientHeight, scrollHeight, scrollTop } = e.target

        if (clientHeight + scrollTop > scrollHeight - 50) onLoadmore()
      }
    }, 50),
    [],
  )

  return (
    <div className="">
      <Menu as="div" className="relative inline-block text-left">
        {({ open }) => (
          <>
            <Menu.Button
              className={cn(
                "text-primary-600 hover:bg-primary-50 group inline-flex h-7 w-full items-center justify-center rounded-[10px] pl-2 pr-2.5 text-[14px] font-semibold",
                open && "bg-primary-50",
              )}>
              <div className="max-w-[180px] truncate" title={curNav?.name}>
                {curNav?.name}
              </div>
              <RiArrowDownSLine
                className={cn(
                  "ml-1 h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100",
                  open && "!opacity-100",
                )}
                aria-hidden="true"
              />
            </Menu.Button>
            <Menu.Items className="max-w-80 absolute -left-11 right-0 mt-1.5 w-60 origin-top-right divide-y divide-gray-100 rounded-lg bg-white shadow-lg">
              <div
                className="overflow-auto px-1 py-1"
                style={{ maxHeight: "50vh" }}
                onScroll={handleScroll}>
                {navs.map(nav => (
                  <Menu.Item key={nav.id}>
                    <div
                      className="flex w-full cursor-pointer items-center truncate rounded-lg px-3 py-[6px] text-[14px] font-normal text-gray-700 hover:bg-gray-100"
                      onClick={() => {
                        if (curNav?.id === nav.id) return
                        setAppDetail()
                        router.push(nav.link)
                      }}
                      title={nav.name}>
                      <div className="relative mr-2 h-6 w-6 rounded-md">
                        <AppIcon
                          size="tiny"
                          icon={nav.icon}
                          background={nav.icon_background}
                        />
                        {!!nav.mode && (
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded border-[0.5px] border-[rgba(0,0,0,0.02)] bg-white p-0.5 shadow-sm",
                            )}>
                            {nav.mode === "advanced-chat" && (
                              <ChatBot className="h-2.5 w-2.5 text-[#1570EF]" />
                            )}
                            {nav.mode === "agent-chat" && (
                              <CuteRobote className="h-2.5 w-2.5 text-indigo-600" />
                            )}
                            {nav.mode === "chat" && (
                              <ChatBot className="h-2.5 w-2.5 text-[#1570EF]" />
                            )}
                            {nav.mode === "completion" && (
                              <AiText className="h-2.5 w-2.5 text-[#0E9384]" />
                            )}
                            {nav.mode === "workflow" && (
                              <Route className="h-2.5 w-2.5 text-[#f79009]" />
                            )}
                          </span>
                        )}
                      </div>
                      <div className="truncate">{nav.name}</div>
                    </div>
                  </Menu.Item>
                ))}
              </div>
              {!isApp && (
                <Menu.Button className="w-full p-1">
                  <div
                    onClick={() => onCreate("")}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-[6px] hover:bg-gray-100",
                    )}>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-[0.5px] border-gray-200 bg-gray-50">
                      <RiAddLine className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="grow text-left text-[14px] font-normal text-gray-700">
                      {createText}
                    </div>
                  </div>
                </Menu.Button>
              )}
              {isApp && isCurrentWorkspaceEditor && (
                <Menu as="div" className="relative h-full w-full">
                  {({ open }) => (
                    <>
                      <Menu.Button className="w-full p-1">
                        <div
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-[6px] hover:bg-gray-100",
                            open && "!bg-gray-100",
                          )}>
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-[0.5px] border-gray-200 bg-gray-50">
                            <RiAddLine className="h-4 w-4 text-gray-500" />
                          </div>
                          <div className="grow text-left text-[14px] font-normal text-gray-700">
                            {createText}
                          </div>
                          <RiArrowRightSLine className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                        </div>
                      </Menu.Button>
                      <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95">
                        <Menu.Items
                          className={cn(
                            "absolute right-[-198px] top-[3px] z-10 min-w-[200px] rounded-lg border-[0.5px] border-gray-200 bg-white shadow-lg",
                          )}>
                          <div className="p-1">
                            <div
                              className={cn(
                                "flex cursor-pointer items-center rounded-lg px-3 py-[6px] font-normal text-gray-700 hover:bg-gray-100",
                              )}
                              onClick={() => onCreate("blank")}>
                              <FilePlus01 className="mr-2 h-4 w-4 shrink-0 text-gray-600" />
                              {t("app.newApp.startFromBlank")}
                            </div>
                            <div
                              className={cn(
                                "flex cursor-pointer items-center rounded-lg px-3 py-[6px] font-normal text-gray-700 hover:bg-gray-100",
                              )}
                              onClick={() => onCreate("template")}>
                              <FilePlus02 className="mr-2 h-4 w-4 shrink-0 text-gray-600" />
                              {t("app.newApp.startFromTemplate")}
                            </div>
                          </div>
                          <div className="border-t border-gray-100 p-1">
                            <div
                              className={cn(
                                "flex cursor-pointer items-center rounded-lg px-3 py-[6px] font-normal text-gray-700 hover:bg-gray-100",
                              )}
                              onClick={() => onCreate("dsl")}>
                              <FileArrow01 className="mr-2 h-4 w-4 shrink-0 text-gray-600" />
                              {t("app.importDSL")}
                            </div>
                          </div>
                        </Menu.Items>
                      </Transition>
                    </>
                  )}
                </Menu>
              )}
            </Menu.Items>
          </>
        )}
      </Menu>
    </div>
  )
}

export default NavSelector
