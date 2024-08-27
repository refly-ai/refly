import { Divider, Button } from '@arco-design/web-react';
import { IconPlus } from '@arco-design/web-react/icon';
import { useAINote } from '@refly-packages/ai-workspace-common/hooks/use-ai-note';
import { NoteList } from '@refly-packages/ai-workspace-common/components/workspace/note-list';
import { useKnowledgeBaseStore } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useTranslation } from 'react-i18next';
import './index.scss';

export const AINoteEmpty = () => {
  const { handleInitEmptyNote } = useAINote();
  const knowledgeBaseStore = useKnowledgeBaseStore();
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center w-full mt-16 overflow-auto ai-note-empty">
      <div className="w-full h-full max-w-screen-lg">
        {/* <Title className="mb-8 ml-8 text-3xl font-bold">暂无笔记</Title> */}
        <Button className="ml-8 text-green-400" icon={<IconPlus />} onClick={() => handleInitEmptyNote('New note')}>
          {t('knowledgeBase.note.newNote')}
        </Button>
        <Divider />
        <NoteList
          listGrid={
            knowledgeBaseStore.resourcePanelVisible
              ? {
                  sm: 48,
                  md: 24,
                  lg: 16,
                  xl: 12,
                }
              : null
          }
        />
      </div>
    </div>
  );
};
