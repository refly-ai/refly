import type { CommonNodeType, InputVar } from "@/components/workflow/types"

export type StartNodeType = CommonNodeType & {
  variables: InputVar[]
}
