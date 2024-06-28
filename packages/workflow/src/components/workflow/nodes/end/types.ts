import type { CommonNodeType, Variable } from "@/components/workflow/types"

export type EndNodeType = CommonNodeType & {
  outputs: Variable[]
}
