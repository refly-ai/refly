import React, { useEffect, useState } from 'react';
import { Button, Empty, message, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReloadOutlined } from '@ant-design/icons';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useChatStore } from '@refly-packages/ai-workspace-common/stores/chat';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { genActionResultID } from '@refly/utils/id';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { useContextPanelStore } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useFindSkill } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';

interface RecommendQuestionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecommendQuestionsPanel: React.FC<RecommendQuestionsPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { invokeAction } = useInvokeAction();
  const { setNewQAText } = useChatStore();
  const { runtimeConfig } = useContextPanelStore.getState();

  const skill = useFindSkill('recommendQuestions');

  const { selectedMcpServers } = useLaunchpadStoreShallow((state) => ({
    selectedMcpServers: state.selectedMcpServers,
  }));

  const fetchRecommendQuestions = async (refresh = false) => {
    setLoading(true);
    const resultId = genActionResultID();
    const { selectedModel, newQAText } = useChatStore.getState();
    const { contextItems } = useContextPanelStore.getState();

    invokeAction(
      {
        query: newQAText,
        resultId,
        contextItems,
        selectedMcpServers,
        selectedSkill: skill,
        modelInfo: selectedModel,
        runtimeConfig,
        tplConfig: {
          refresh: {
            value: refresh,
            label: t('copilot.recommendQuestions.refresh'),
            displayValue: refresh ? t('copilot.recommendQuestions.refresh') : '',
            configScope: ['runtime'],
          },
        },
      },
      null,
    );
  };

  const handleQuestionClick = (question: string) => {
    setNewQAText(question);
    // onClose();
  };

  useEffect(() => {
    const handleUpdate = (update: { resultId: string; payload: any }) => {
      const { structuredData } = update?.payload?.steps?.[0] || {};
      if (structuredData?.recommendedQuestions) {
        setLoading(false);
        const data = structuredData?.recommendedQuestions?.questions || [];
        setQuestions(data);
      }
    };

    actionEmitter.on('updateResult', handleUpdate);
    return () => {
      actionEmitter.off('updateResult', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchRecommendQuestions();
    }
  }, [isOpen]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-3 px-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-2">
              <Skeleton
                active
                paragraph={false}
                title={{
                  width: '100%',
                  style: {
                    height: '12px',
                    marginBottom: 0,
                  },
                }}
              />
            </div>
          ))}
        </div>
      );
    }

    if (questions?.length === 0) {
      return (
        <Empty
          className="mb-2"
          imageStyle={{ height: 40, width: 40, margin: '4px auto' }}
          description={
            <span className="text-[12px] text-[#00968f]">
              {t('copilot.recommendQuestions.empty')}
            </span>
          }
        />
      );
    }

    return questions.map((question) => (
      <div
        key={question}
        className={cn(
          'group relative flex items-center justify-between',
          'rounded-lg border border-solid border-black/10 dark:border-gray-700 m-1 py-2 px-3 mb-2',
          'cursor-pointer transition-all duration-200',
          'hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm dark:hover:bg-gray-700 dark:hover:border-gray-600',
        )}
        onClick={() => {
          handleQuestionClick(question);
          message.success(t('copilot.message.askFollowingSuccess'));
        }}
      >
        <div className="flex-1 min-w-0">
          <span className="text-[12px] text-[#00968f] font-medium block truncate">{question}</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 ml-2 group-hover:text-[#00968f] transition-colors" />
      </div>
    ));
  };

  if (!isOpen) return null;

  return (
    <div className="w-full border border-solid border-black/10 dark:border-gray-700 shadow-[0px_2px_6px_0px_rgba(0,0,0,0.1)] max-w-7xl mx-auto p-3 pb-1 space-y-1 rounded-lg bg-white dark:bg-gray-900 mb-1">
      <div className="text-gray-800 font-bold flex items-center justify-between">
        <div className="flex items-center space-x-1 pl-1 dark:text-gray-200">
          <span>{t('copilot.recommendQuestions.title')}</span>
        </div>
        <div className="flex items-center space-x-2">
          {!loading ? (
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined className="w-4 h-4 text-gray-400 text-[12px]" />}
              onClick={() => fetchRecommendQuestions(true)}
              loading={loading}
              className="text-[12px] text-[rgba(0,0,0,0.5)] dark:text-gray-400"
            >
              {t('copilot.recommendQuestions.refresh')}
            </Button>
          ) : null}
          <Button
            type="text"
            size="small"
            icon={<ChevronDown className="w-4 h-4 text-gray-400" />}
            onClick={onClose}
            className="text-[12px] text-[rgba(0,0,0,0.5)]"
          />
        </div>
      </div>

      <div className="max-h-[200px] overflow-y-auto">{renderContent()}</div>
    </div>
  );
};
