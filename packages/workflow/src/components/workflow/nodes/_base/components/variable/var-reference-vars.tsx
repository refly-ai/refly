"use client"
import type { FC } from "react"
import React, { useEffect, useRef, useState } from "react"
import { useBoolean, useHover } from "ahooks"
import cn from "classnames"
import { RiSearchLine } from "@remixicon/react"
import { useTranslation } from "react-i18next"
import {
  type NodeOutPutVar,
  type ValueSelector,
  type Var,
  VarType,
} from "@/components/workflow/types"
import { Variable02 } from "@/components/base/icons/src/vender/solid/development"
import { ChevronRight } from "@/components/base/icons/src/vender/line/arrows"
import {
  PortalToFollowElem,
  PortalToFollowElemContent,
  PortalToFollowElemTrigger,
} from "@/components/base/portal-to-follow-elem"
import { XCircle } from "@/components/base/icons/src/vender/solid/general"
import { checkKeys } from "@/utils/var"

type ObjectChildrenProps = {
  nodeId: string
  title: string
  data: Var[]
  objPath: string[]
  onChange: (value: ValueSelector, item: Var) => void
  onHovering?: (value: boolean) => void
  itemWidth?: number
}

type ItemProps = {
  nodeId: string
  title: string
  objPath: string[]
  itemData: Var
  onChange: (value: ValueSelector, item: Var) => void
  onHovering?: (value: boolean) => void
  itemWidth?: number
}

const Item: FC<ItemProps> = ({
  nodeId,
  title,
  objPath,
  itemData,
  onChange,
  onHovering,
  itemWidth,
}) => {
  const isObj =
    itemData.type === VarType.object &&
    itemData.children &&
    itemData.children.length > 0
  const itemRef = useRef(null)
  const [isItemHovering, setIsItemHovering] = useState(false)
  const _ = useHover(itemRef, {
    onChange: hovering => {
      if (hovering) {
        setIsItemHovering(true)
      } else {
        if (isObj) {
          setTimeout(() => {
            setIsItemHovering(false)
          }, 100)
        } else {
          setIsItemHovering(false)
        }
      }
    },
  })
  const [isChildrenHovering, setIsChildrenHovering] = useState(false)
  const isHovering = isItemHovering || isChildrenHovering
  const open = isObj && isHovering
  useEffect(() => {
    onHovering && onHovering(isHovering)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovering])
  const handleChosen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (itemData.variable.startsWith("sys.")) {
      // system variable
      onChange([...objPath, ...itemData.variable.split(".")], itemData)
    } else {
      onChange([nodeId, ...objPath, itemData.variable], itemData)
    }
  }
  return (
    <PortalToFollowElem
      open={open}
      onOpenChange={() => {}}
      placement="left-start">
      <PortalToFollowElemTrigger className="w-full">
        <div
          ref={itemRef}
          className={cn(
            isObj ? "pr-1" : "pr-[18px]",
            isHovering && (isObj ? "bg-primary-50" : "bg-gray-50"),
            "relative flex h-6 w-full cursor-pointer items-center rounded-md pl-3",
          )}
          // style={{ width: itemWidth || 252 }}
          onClick={handleChosen}>
          <div className="flex w-0 grow items-center">
            <Variable02 className="text-primary-500 h-3.5 w-3.5 shrink-0" />
            <div
              title={itemData.variable}
              className="ml-1 w-0 grow truncate text-[13px] font-normal text-gray-900">
              {itemData.variable}
            </div>
          </div>
          <div className="ml-1 shrink-0 text-xs font-normal capitalize text-gray-500">
            {itemData.type}
          </div>
          {isObj && <ChevronRight className="ml-0.5 h-3 w-3 text-gray-500" />}
        </div>
      </PortalToFollowElemTrigger>
      <PortalToFollowElemContent
        style={{
          zIndex: 100,
        }}>
        {isObj && (
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          <ObjectChildren
            nodeId={nodeId}
            title={title}
            objPath={[...objPath, itemData.variable]}
            data={itemData.children as Var[]}
            onChange={onChange}
            onHovering={setIsChildrenHovering}
            itemWidth={itemWidth}
          />
        )}
      </PortalToFollowElemContent>
    </PortalToFollowElem>
  )
}

const ObjectChildren: FC<ObjectChildrenProps> = ({
  title,
  nodeId,
  objPath,
  data,
  onChange,
  onHovering,
  itemWidth,
}) => {
  const currObjPath = objPath
  const itemRef = useRef(null)
  const [isItemHovering, setIsItemHovering] = useState(false)
  const _ = useHover(itemRef, {
    onChange: hovering => {
      if (hovering) {
        setIsItemHovering(true)
      } else {
        setTimeout(() => {
          setIsItemHovering(false)
        }, 100)
      }
    },
  })
  const [isChildrenHovering, setIsChildrenHovering] = useState(false)
  const isHovering = isItemHovering || isChildrenHovering
  useEffect(() => {
    onHovering && onHovering(isHovering)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovering])
  useEffect(() => {
    onHovering && onHovering(isItemHovering)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isItemHovering])
  // absolute top-[-2px]
  return (
    <div
      ref={itemRef}
      className="space-y-1 rounded-lg border border-gray-200 bg-white shadow-lg"
      style={{
        right: itemWidth ? itemWidth - 10 : 215,
        minWidth: 252,
      }}>
      <div className="flex h-[22px] items-center px-3 text-xs font-normal text-gray-700">
        <span className="text-gray-500">{title}.</span>
        {currObjPath.join(".")}
      </div>
      {data &&
        data.length > 0 &&
        data.map((v, i) => (
          <Item
            key={i}
            nodeId={nodeId}
            title={title}
            objPath={objPath}
            itemData={v}
            onChange={onChange}
            onHovering={setIsChildrenHovering}
          />
        ))}
    </div>
  )
}

type Props = {
  hideSearch?: boolean
  searchBoxClassName?: string
  vars: NodeOutPutVar[]
  onChange: (value: ValueSelector, item: Var) => void
  itemWidth?: number
}
const VarReferenceVars: FC<Props> = ({
  hideSearch,
  searchBoxClassName,
  vars,
  onChange,
  itemWidth,
}) => {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState("")
  const filteredVars = vars
    .filter(v => {
      const children = v.vars.filter(
        v =>
          checkKeys([v.variable], false).isValid ||
          v.variable.startsWith("sys."),
      )
      return children.length > 0
    })
    .filter(node => {
      if (!searchText) return node
      const children = node.vars.filter(v => {
        const searchTextLower = searchText.toLowerCase()
        return (
          v.variable.toLowerCase().includes(searchTextLower) ||
          node.title.toLowerCase().includes(searchTextLower)
        )
      })
      return children.length > 0
    })
    .map(node => {
      let vars = node.vars.filter(
        v =>
          checkKeys([v.variable], false).isValid ||
          v.variable.startsWith("sys."),
      )
      if (searchText) {
        const searchTextLower = searchText.toLowerCase()
        if (!node.title.toLowerCase().includes(searchTextLower))
          vars = vars.filter(v =>
            v.variable.toLowerCase().includes(searchText.toLowerCase()),
          )
      }

      return {
        ...node,
        vars,
      }
    })
  const [isFocus, { setFalse: setBlur, setTrue: setFocus }] = useBoolean(false)
  return (
    <>
      {!hideSearch && (
        <>
          <div
            className={cn(
              searchBoxClassName,
              isFocus && "bg-white shadow-sm",
              "mx-1 mb-2 flex items-center rounded-lg bg-gray-100 px-2",
            )}
            onClick={e => e.stopPropagation()}>
            <RiSearchLine className="ml-[1px] mr-[5px] h-3.5 w-3.5 shrink-0 text-gray-400" />
            <input
              value={searchText}
              className="caret-primary-600 grow appearance-none bg-transparent px-0.5 py-[7px] text-[13px] text-gray-700 outline-none placeholder:text-gray-400"
              placeholder={t("workflow.common.searchVar") || ""}
              onChange={e => setSearchText(e.target.value)}
              onFocus={setFocus}
              onBlur={setBlur}
              autoFocus
            />
            {searchText && (
              <div
                className="ml-[5px] flex h-[18px] w-[18px] cursor-pointer items-center justify-center"
                onClick={() => setSearchText("")}>
                <XCircle className="h-[14px] w-[14px] text-gray-400" />
              </div>
            )}
          </div>
          <div
            className="relative left-[-4px] h-[0.5px] bg-black/5"
            style={{
              width: "calc(100% + 8px)",
            }}></div>
        </>
      )}

      {filteredVars.length > 0 ? (
        <div className="max-h-[85vh] overflow-y-auto">
          {filteredVars.map((item, i) => (
            <div key={i}>
              <div
                className="truncate px-3 text-xs font-medium uppercase leading-[22px] text-gray-500"
                title={item.title}>
                {item.title}
              </div>
              {item.vars.map((v, j) => (
                <Item
                  key={j}
                  title={item.title}
                  nodeId={item.nodeId}
                  objPath={[]}
                  itemData={v}
                  onChange={onChange}
                  itemWidth={itemWidth}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="pl-3 text-xs font-medium uppercase leading-[18px] text-gray-500">
          {t("workflow.common.noVar")}
        </div>
      )}
    </>
  )
}
export default React.memo(VarReferenceVars)
