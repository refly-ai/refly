import { useContextPanelStore } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useTranslation } from 'react-i18next';
import { Notification } from '@arco-design/web-react';

export const useContextFilterErrorTip = () => {
  const { t } = useTranslation();
  const { filterErrorInfo } = useContextPanelStore((state) => ({
    filterErrorInfo: state.filterErrorInfo,
  }));

  const handleFilterErrorTip = () => {
    if (Object.keys(filterErrorInfo).length > 0) {
      const Content = (
        <div>
          {Object.keys(filterErrorInfo).map((key) => (
            <div key={key}>
              {filterErrorInfo[key].required
                ? t('knowledgeBase.context.contextRequiredTip', {
                    type: t(`knowledgeBase.context.${key}`),
                  })
                : t('knowledgeBase.context.contextLimitTip', {
                    limit: filterErrorInfo[key].limit,
                    currentCount: filterErrorInfo[key].currentCount,
                    type: t(`knowledgeBase.context.${key}`),
                  })}
            </div>
          ))}
        </div>
      );
      Notification.error({
        style: { width: 400 },
        title: t('knowledgeBase.context.contextLimitTipTitle'),
        content: Content,
      });
      return true;
    }
    return false;
  };

  return {
    handleFilterErrorTip,
  };
};
