"use client"
import type { FC } from "react"
import React, { useCallback } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiCloseLine, RiLoader2Line } from "@remixicon/react"
import type { Props as FormProps } from "./form"
import Form from "./form"
import Button from "@/components/base/button"
import { StopCircle } from "@/components/base/icons/src/vender/solid/mediaAndDevices"
import Split from "@/components/workflow/nodes/_base/components/split"
import { InputVarType, NodeRunningStatus } from "@/components/workflow/types"
import ResultPanel from "@/components/workflow/run/result-panel"
import Toast from "@/components/base/toast"
import { TransferMethod } from "@/types/app"

const i18nPrefix = "workflow.singleRun"

type BeforeRunFormProps = {
  nodeName: string
  onHide: () => void
  onRun: (submitData: Record<string, any>) => void
  onStop: () => void
  runningStatus: NodeRunningStatus
  result?: JSX.Element
  forms: FormProps[]
}

function formatValue(value: string | any, type: InputVarType) {
  if (type === InputVarType.number) return parseFloat(value)
  if (type === InputVarType.json) return JSON.parse(value)
  if (type === InputVarType.contexts) {
    return value.map((item: any) => {
      return JSON.parse(item)
    })
  }

  return value
}
const BeforeRunForm: FC<BeforeRunFormProps> = ({
  nodeName,
  onHide,
  onRun,
  onStop,
  runningStatus,
  result,
  forms,
}) => {
  const { t } = useTranslation()

  const isFinished =
    runningStatus === NodeRunningStatus.Succeeded ||
    runningStatus === NodeRunningStatus.Failed
  const isRunning = runningStatus === NodeRunningStatus.Running
  const isFileLoaded = (() => {
    // system files
    const filesForm = forms.find(item => !!item.values["#files#"])
    if (!filesForm) return true

    const files = filesForm.values["#files#"] as any
    if (
      files?.some(
        (item: any) =>
          item.transfer_method === TransferMethod.local_file &&
          !item.upload_file_id,
      )
    )
      return false

    return true
  })()
  const handleRun = useCallback(() => {
    let errMsg = ""
    forms.forEach(form => {
      form.inputs.forEach(input => {
        const value = form.values[input.variable]
        if (
          !errMsg &&
          input.required &&
          (value === "" ||
            value === undefined ||
            value === null ||
            (input.type === InputVarType.files && value.length === 0))
        )
          errMsg = t("workflow.errorMsg.fieldRequired", {
            field:
              typeof input.label === "object"
                ? input.label.variable
                : input.label,
          })
      })
    })
    if (errMsg) {
      Toast.notify({
        message: errMsg,
        type: "error",
      })
      return
    }

    const submitData: Record<string, any> = {}
    let parseErrorJsonField = ""
    forms.forEach(form => {
      form.inputs.forEach(input => {
        try {
          const value = formatValue(form.values[input.variable], input.type)
          submitData[input.variable] = value
        } catch (e) {
          parseErrorJsonField = input.variable
        }
      })
    })
    if (parseErrorJsonField) {
      Toast.notify({
        message: t("workflow.errorMsg.invalidJson", {
          field: parseErrorJsonField,
        }),
        type: "error",
      })
      return
    }

    onRun(submitData)
  }, [forms, onRun, t])
  return (
    <div
      className="absolute inset-0 z-10 rounded-2xl pt-10"
      style={{
        backgroundColor: "rgba(16, 24, 40, 0.20)",
      }}>
      <div className="flex h-full flex-col rounded-2xl bg-white">
        <div className="flex h-8 shrink-0 items-center justify-between pl-4 pr-3 pt-3">
          <div className="truncate text-base font-semibold text-gray-900">
            {t(`${i18nPrefix}.testRun`)} {nodeName}
          </div>
          <div className="ml-2 shrink-0 cursor-pointer p-1" onClick={onHide}>
            <RiCloseLine className="h-4 w-4 text-gray-500" />
          </div>
        </div>

        <div className="h-0 grow overflow-y-auto pb-4">
          <div className="mt-3 space-y-4 px-4">
            {forms.map((form, index) => (
              <div key={index}>
                <Form
                  key={index}
                  className={cn(index < forms.length - 1 && "mb-4")}
                  {...form}
                />
                {index < forms.length - 1 && <Split />}
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-between space-x-2 px-4">
            {isRunning && (
              <div
                className="shadow-xs cursor-pointer rounded-lg border border-gray-200 bg-white p-2"
                onClick={onStop}>
                <StopCircle className="h-4 w-4 text-gray-500" />
              </div>
            )}
            <Button
              disabled={!isFileLoaded || isRunning}
              variant="primary"
              className="w-0 grow space-x-2"
              onClick={handleRun}>
              {isRunning && (
                <RiLoader2Line className="h-4 w-4 animate-spin text-white" />
              )}
              <div>
                {t(`${i18nPrefix}.${isRunning ? "running" : "startRun"}`)}
              </div>
            </Button>
          </div>
          {isRunning && <ResultPanel status="running" showSteps={false} />}
          {isFinished && <>{result}</>}
        </div>
      </div>
    </div>
  )
}
export default React.memo(BeforeRunForm)
