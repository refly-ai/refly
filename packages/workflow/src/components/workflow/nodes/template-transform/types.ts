import type { CommonNodeType, Variable } from "@/components/workflow/types"

export type TemplateTransformNodeType = CommonNodeType & {
  variables: Variable[]
  template: string
}
