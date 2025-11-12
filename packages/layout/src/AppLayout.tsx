import { type ReactNode } from 'react';

import { Outlet } from 'react-router-dom';
import clsx from 'clsx';

import { RedirectSuspense } from './components/RedirectSuspense';
import { getLayoutSettings } from './helpers/getLayoutSettings';
import { SideMenu } from './side-menu';

interface LayoutProps {
  PreviewPanel: ReactNode;
  Header?: ReactNode;
  children: ReactNode;
}

function Layout({ PreviewPanel, Header, children }: LayoutProps) {
  const layoutSettings = getLayoutSettings();

  return (
    <div className="flex flex-col w-screen h-[var(--screen-height)]">
      {Header}

      <div className="relative pl-2 pr-3 pb-3 pt-0 flex w-full flex-1 min-h-0">
        <div className="rounded-xl flex-1 min-w-0 flex items-stretch overflow-hidden relative">
          <SideMenu />
          <div
            className={clsx(
              'flex-1',
              'min-w-0',
              'w-full',
              'h-full',
              'bg-bg-body',
              'overflow-x-auto',
              'rounded-xl',
              'border',
              'border-solid',
              'border-line-border-card',
              'box-border',
            )}
          >
            {children}
            <Outlet />
          </div>
        </div>
        {layoutSettings.hidePreviewPanel ? null : PreviewPanel}
      </div>
    </div>
  );
}

export const AppLayout = ({ PreviewPanel, Header, children }: LayoutProps) => {
  return (
    <RedirectSuspense>
      <Layout PreviewPanel={PreviewPanel} Header={Header}>
        {children}
      </Layout>
    </RedirectSuspense>
  );
};
