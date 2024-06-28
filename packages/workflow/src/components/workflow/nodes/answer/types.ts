import type { CommonNodeType, Variable } from "@/components/workflow/types"

export type AnswerNodeType = CommonNodeType & {
  variables: Variable[]
  answer: string
}
