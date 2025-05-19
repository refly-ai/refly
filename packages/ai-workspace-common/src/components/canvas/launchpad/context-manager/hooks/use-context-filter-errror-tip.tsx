import { useContextPanelStore } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useTranslation } from 'react-i18next';
import { notification } from 'antd';

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
      notification.error({
        style: { width: 400 },
        message: t('knowledgeBase.context.contextLimitTipTitle'),
        description: Content,
      });
      return true;
    }
    return false;
  };

  return {
    handleFilterErrorTip,
  };
};
