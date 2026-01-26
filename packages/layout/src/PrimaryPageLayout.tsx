import { type ReactElement, type ReactNode } from 'react';

import { Typography } from 'antd';
import clsx from 'clsx';

import {
  LayoutContainer,
  LayoutContainerContextUpdater,
  type LayoutContainerRenderLayoutProps,
  type LayoutContainerSlotType,
} from './components/LayoutContainer';

const { Text } = Typography;

const PRIMARY_PAGE_CONTENT_MIN_WIDTH = 524;

interface PrimaryPageLayoutContext {
  title?: ReactNode;
  actions?: ReactNode;
  extra?: ReactNode;
  fixHeight?: boolean;
  noPaddingY?: boolean;
  noPaddingX?: boolean;
}

function RenderLayout({
  renderSlot,
  context,
}: LayoutContainerRenderLayoutProps<PrimaryPageLayoutContext>) {
  return (
    <div
      className="w-full h-full flex flex-col box-border"
      style={{
        minWidth: PRIMARY_PAGE_CONTENT_MIN_WIDTH,
      }}
    >
      <div className="w-full flex flex-col pb-3 p-6 z-20">
        <div className="w-full flex items-center gap-3">
          <div className="w-full flex flex-col gap-[1px]">
            <div className="flex items-center justify-between h-8 -my-0.5 shrink-1">
              <Text className="text-text-title">{context.title}</Text>
              <div className="flex items-center shrink-0">{context.actions}</div>
            </div>
          </div>
        </div>

        {context.extra ? <div className="relative">{context.extra}</div> : null}
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <div className={clsx('flex-1 relative z-10')}>{renderSlot('Content')}</div>
      </div>
    </div>
  );
}

type PrimaryPageLayoutSlotType = LayoutContainerSlotType<PrimaryPageLayoutContext>;

interface PrimaryPageLayoutProps {
  children?: PrimaryPageLayoutSlotType;
}

export function PrimaryPageLayout({ children }: PrimaryPageLayoutProps): ReactElement {
  return (
    <LayoutContainer<PrimaryPageLayoutContext>
      slots={{
        Content: <div className="h-full">{children as ReactNode}</div>,
      }}
      initialContextValue={{
        noPaddingX: false,
      }}
      RenderLayout={RenderLayout}
    />
  );
}

interface PrimaryPageLayoutContextUpdaterProps extends PrimaryPageLayoutContext {
  deps?: unknown[];
}

export function PrimaryPageLayoutContextUpdater({
  deps,
  ...context
}: PrimaryPageLayoutContextUpdaterProps): ReactElement {
  return <LayoutContainerContextUpdater {...context} RenderLayout={RenderLayout} deps={deps} />;
}
