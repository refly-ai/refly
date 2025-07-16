import { useTranslation } from 'react-i18next';
import { reflyEnv } from '@refly/utils/env';
import { bigSearchQuickOpenEmitter } from '@refly-packages/ai-workspace-common/utils/event-emitter/big-search-quick-open';
import classNames from 'classnames';
import { IconSearch } from '@refly-packages/ai-workspace-common/components/common/icon';

interface SearchQuickOpenBtnProps extends React.ComponentProps<'div'> {
  placeholder?: string;
}

export const SearchQuickOpenBtn = (props: SearchQuickOpenBtnProps) => {
  const { placeholder, ...divProps } = props;
  const { t } = useTranslation();

  return (
    <div {...divProps} className={classNames(divProps.className)}>
      <div
        className="flex flex-row flex-nowrap justify-between rounded-md border border-solid border-gray-200 p-2 transition-colors duration-500 hover:cursor-pointer hover:border-green-500 dark:border-gray-700 dark:hover:border-green-500"
        onClick={() => {
          bigSearchQuickOpenEmitter.emit('openSearch');
        }}
      >
        <div className="flex items-center text-sm font-normal text-gray-500 dark:text-gray-400">
          <IconSearch className="mr-1" />
          <span className="ml-1">{t(`${placeholder || 'loggedHomePage.searchEverything'}`)}</span>
        </div>
        <div className="flex flex-row items-center">
          <div className="flex h-5 w-5 items-center justify-center rounded border border-solid border-gray-200 px-1 text-xs text-gray-500 dark:text-gray-400 dark:border-gray-700">
            {reflyEnv.getOsType() === 'OSX' ? '⌘' : 'Ctrl'}
          </div>
          <div className="ml-0.5 flex h-5 w-5 items-center justify-center rounded border border-solid border-gray-200 px-1 text-xs text-gray-500 dark:text-gray-400 dark:border-gray-700">
            K
          </div>
        </div>
      </div>
    </div>
  );
};
