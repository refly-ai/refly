import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import { RiArrowRightSLine } from "@remixicon/react"
import VarReferencePicker from "../_base/components/variable/var-reference-picker"
import Split from "../_base/components/split"
import ResultPanel from "../../run/result-panel"
import IterationResultPanel from "../../run/iteration-result-panel"
import type { IterationNodeType } from "./types"
import useConfig from "./use-config"
import { InputVarType, type NodePanelProps } from "@/components/workflow/types"
import Field from "@/components/workflow/nodes/_base/components/field"
import BeforeRunForm from "@/components/workflow/nodes/_base/components/before-run-form"

const i18nPrefix = "workflow.nodes.iteration"

const Panel: FC<NodePanelProps<IterationNodeType>> = ({ id, data }) => {
  const { t } = useTranslation()

  const {
    readOnly,
    inputs,
    filterInputVar,
    handleInputChange,
    childrenNodeVars,
    iterationChildrenNodes,
    handleOutputVarChange,
    isShowSingleRun,
    hideSingleRun,
    isShowIterationDetail,
    backToSingleRun,
    showIterationDetail,
    hideIterationDetail,
    runningStatus,
    handleRun,
    handleStop,
    runResult,
    inputVarValues,
    setInputVarValues,
    usedOutVars,
    iterator,
    setIterator,
    iteratorInputKey,
    iterationRunResult,
  } = useConfig(id, data)

  return (
    <div className="mt-2">
      <div className="space-y-4 px-4 pb-4">
        <Field
          title={t(`${i18nPrefix}.input`)}
          operations={
            <div className="border-black/8 flex h-[18px] items-center rounded-[5px] border px-1 text-xs font-medium capitalize text-gray-500">
              Array
            </div>
          }>
          <VarReferencePicker
            readonly={readOnly}
            nodeId={id}
            isShowNodeName
            value={inputs.iterator_selector || []}
            onChange={handleInputChange}
            filterVar={filterInputVar}
          />
        </Field>
      </div>
      <Split />
      <div className="mt-2 space-y-4 px-4 pb-4">
        <Field
          title={t(`${i18nPrefix}.output`)}
          operations={
            <div className="border-black/8 flex h-[18px] items-center rounded-[5px] border px-1 text-xs font-medium capitalize text-gray-500">
              Array
            </div>
          }>
          <VarReferencePicker
            readonly={readOnly}
            nodeId={id}
            isShowNodeName
            value={inputs.output_selector || []}
            onChange={handleOutputVarChange}
            availableNodes={iterationChildrenNodes}
            availableVars={childrenNodeVars}
          />
        </Field>
      </div>
      {isShowSingleRun && (
        <BeforeRunForm
          nodeName={inputs.title}
          onHide={hideSingleRun}
          forms={[
            {
              inputs: [...usedOutVars],
              values: inputVarValues,
              onChange: setInputVarValues,
            },
            {
              label: t(`${i18nPrefix}.input`)!,
              inputs: [
                {
                  label: "",
                  variable: iteratorInputKey,
                  type: InputVarType.iterator,
                  required: false,
                },
              ],
              values: { [iteratorInputKey]: iterator },
              onChange: keyValue =>
                setIterator((keyValue as any)[iteratorInputKey]),
            },
          ]}
          runningStatus={runningStatus}
          onRun={handleRun}
          onStop={handleStop}
          result={
            <div className="mt-3">
              <div className="px-4">
                <div
                  className="flex h-[34px] cursor-pointer items-center justify-between rounded-lg border-[0.5px] border-gray-200 bg-gray-100 px-3"
                  onClick={showIterationDetail}>
                  <div className="text-[13px] font-medium leading-[18px] text-gray-700">
                    {t(`${i18nPrefix}.iteration`, {
                      count: iterationRunResult.length,
                    })}
                  </div>
                  <RiArrowRightSLine className="h-3.5 w-3.5 text-gray-500" />
                </div>
                <Split className="mt-3" />
              </div>
              <ResultPanel {...runResult} showSteps={false} />
            </div>
          }
        />
      )}
      {isShowIterationDetail && (
        <IterationResultPanel
          onBack={backToSingleRun}
          onHide={hideIterationDetail}
          list={iterationRunResult}
        />
      )}
    </div>
  )
}

export default React.memo(Panel)
