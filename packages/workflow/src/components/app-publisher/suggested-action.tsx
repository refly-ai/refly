import type { HTMLProps, PropsWithChildren } from "react"
import classNames from "classnames"
import { ArrowUpRight } from "@/components/base/icons/src/vender/line/arrows"

export type SuggestedActionProps = PropsWithChildren<
  HTMLProps<HTMLAnchorElement> & {
    icon?: React.ReactNode
    link?: string
    disabled?: boolean
  }
>

const SuggestedAction = ({
  icon,
  link,
  disabled,
  children,
  className,
  ...props
}: SuggestedActionProps) => (
  <a
    href={disabled ? undefined : link}
    target="_blank"
    rel="noreferrer"
    className={classNames(
      "flex h-[34px] items-center justify-start gap-2 rounded-lg bg-gray-100 px-2.5 transition-colors [&:not(:first-child)]:mt-1",
      disabled
        ? "shadow-xs cursor-not-allowed opacity-30"
        : "hover:bg-primary-50 hover:text-primary-600 cursor-pointer",
      className,
    )}
    {...props}>
    <div className="relative h-4 w-4">{icon}</div>
    <div className="shrink grow basis-0 text-[13px] font-medium leading-[18px]">
      {children}
    </div>
    <ArrowUpRight />
  </a>
)

export default SuggestedAction
