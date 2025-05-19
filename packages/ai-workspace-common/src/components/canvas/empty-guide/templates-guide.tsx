import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Divider } from 'antd';
import { useListCanvasTemplates } from '@refly-packages/ai-workspace-common/queries';
import { TemplateCard } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { useCanvasTemplateModal } from '@refly-packages/ai-workspace-common/stores/canvas-template-modal';
import { VscNotebookTemplate } from 'react-icons/vsc';
import { useDebouncedCallback } from 'use-debounce';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { canvasTemplateEnabled } from '@refly-packages/ai-workspace-common/utils/env';

export const TemplatesGuide = ({ canvasId }: { canvasId: string }) => {
  const { setVisible } = useCanvasTemplateModal((state) => ({
    setVisible: state.setVisible,
  }));
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const { showTemplates, setShowTemplates } = useCanvasStoreShallow((state) => ({
    showTemplates: state.showTemplates,
    setShowTemplates: state.setShowTemplates,
  }));
  const { data, refetch } = useListCanvasTemplates({
    // TODO: add search
    query: { page: 1, pageSize: 3 },
  });

  const debouncedRefetch = useDebouncedCallback(() => refetch(), 300);

  // const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   setSearch(e.target.value);
  // };

  useEffect(() => {
    debouncedRefetch();
  }, [search]);

  useEffect(() => {
    setSearch('');
  }, [canvasId]);

  return (
    showTemplates &&
    canvasTemplateEnabled && (
      <div className="mt-20" style={{ pointerEvents: 'none' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* <Input
              placeholder={t('template.searchPlaceholder')}
              value={search}
              onChange={handleSearchChange}
              className="w-80"
            /> */}
            {data?.data?.length === 0 && (
              <div className="text-gray-500 text-[14px]">{t('template.noRelatedTemplates')}</div>
            )}
          </div>

          <Button
            type="text"
            onClick={() => setShowTemplates(false)}
            style={{ pointerEvents: 'auto' }}
          >
            {t('template.hideTemplates')}
          </Button>
        </div>
        <Divider className="mt-4 mb-2" />

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-1">
          {data?.data?.length > 0 &&
            data.data.map((template) => (
              <div key={template.templateId} style={{ pointerEvents: 'auto' }}>
                <TemplateCard template={template} showUser={false} />
              </div>
            ))}
          <div
            className="text-center font-bold bg-white dark:bg-gray-800 rounded-lg m-2 flex flex-col items-center justify-center cursor-pointer shadow-sm hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.12)] transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out text-gray-500 hover:text-green-600 h-[244.5px]"
            onClick={() => setVisible(true)}
            style={{ pointerEvents: 'auto' }}
          >
            <VscNotebookTemplate className="mb-3" size={35} />
            {t('template.moreTemplates')}
          </div>
        </div>
      </div>
    )
  );
};
