import { IconClose } from '@refly-packages/ai-workspace-common/components/common/icon';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { IconSlideshow } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Minimize2, Maximize2 } from 'lucide-react';

const SlideHeader = memo(
  ({
    onClose,
    onMaximize,
    isMaximized,
  }: {
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
  }) => {
    const { t } = useTranslation();

    return (
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg dark:bg-gray-900 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary-600 shadow-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-medium flex items-center justify-center">
              <IconSlideshow className="w-3 h-3" />
            </span>
          </div>
          <span className="text-sm font-medium leading-normal">
            {t('pages.slideshow.title', { defaultValue: 'Slideshow' })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="text"
            size="small"
            className={`flex items-center justify-center p-0 w-7 h-7 ${isMaximized ? 'text-primary-600 dark:text-primary-300' : 'text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300'} min-w-0`}
            onClick={onMaximize}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button
            type="text"
            size="small"
            className="flex items-center justify-center p-0 w-7 h-7 text-gray-500 hover:text-gray-600 min-w-0 dark:text-gray-400 dark:hover:text-gray-300"
            onClick={onClose}
          >
            <IconClose className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  },
);

SlideHeader.displayName = 'SlideHeader';

export default SlideHeader;
