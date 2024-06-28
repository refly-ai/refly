"use client"
import Drawer from "@/components/base/drawer"
import type { IDrawerProps } from "@/components/base/drawer"

type IFloatRightContainerProps = {
  isMobile: boolean
  children?: React.ReactNode
} & IDrawerProps

const FloatRightContainer = ({
  isMobile,
  children,
  isOpen,
  ...drawerProps
}: IFloatRightContainerProps) => {
  return (
    <>
      {isMobile && (
        <Drawer isOpen={isOpen} {...drawerProps}>
          {children}
        </Drawer>
      )}
      {!isMobile && isOpen && <>{children}</>}
    </>
  )
}

export default FloatRightContainer
