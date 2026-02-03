import React, { type ReactNode } from 'react';
import clsx from 'clsx';

interface HeaderProps {
  leftActions?: ReactNode[];
  rightActions?: ReactNode[];
  className?: string;
}

const renderAction = (action: ReactNode) => {
  return action;
};

const renderActions = (actions: ReactNode[]) => {
  return actions.map(renderAction);
};

export const Header: React.FC<HeaderProps> = ({
  leftActions = [],
  rightActions = [],
  className,
}) => {
  return (
    <header
      className={clsx(
        'flex flex-shrink-0 items-center justify-between h-14 px-6 w-full bg-bg-body border-b border-line-divider-default',
        className,
      )}
    >
      <div className="flex items-center">{renderActions(leftActions)}</div>
      <div className="flex items-center gap-3">{renderActions(rightActions)}</div>
    </header>
  );
};
