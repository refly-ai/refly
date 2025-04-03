import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanvasTemplateModal } from '@refly-packages/ai-workspace-common/stores/canvas-template-modal';
import { IconTemplate } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { Modal, Divider, Select } from 'antd';

import { cn } from '@refly-packages/utils/cn';
import './index.scss';
import { TemplateList } from './template-list';
import { useListCanvasTemplateCategories } from '@refly-packages/ai-workspace-common/queries';

type Language = 'en' | 'zh-CN';

const TitleRender = ({
  language,
  setLanguage,
  // searchQuery,
  // setSearchQuery,
}: {
  uiLocale: Language;
  language: Language;
  searchQuery: string;
  setLanguage: (language: Language) => void;
  setSearchQuery: (searchQuery: string) => void;
}) => {
  const { t } = useTranslation();

  const languageOptions = [
    { label: '中文', value: 'zh-CN' },
    { label: 'English', value: 'en' },
  ];

  const handleLanguageChange = (value: Language) => {
    setLanguage(value);
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 pl-4 pr-16 py-4">
        <div className="flex items-center gap-2 text-lg font-medium">
          <IconTemplate /> {t('template.templateLibrary')}
        </div>
        {/* <Input
          className="w-80"
          placeholder={t('template.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        /> */}
        <div className="flex items-center">
          <Select
            className="flex-1 w-24 hidden"
            options={languageOptions}
            value={language}
            onChange={handleLanguageChange}
          />
        </div>
      </div>
      <Divider className="my-0" />
    </div>
  );
};

const TemplateCategoryList = ({
  visible,
  currentCategory,
  setCurrentCategory,
  uiLocale,
}: {
  visible: boolean;
  currentCategory: string;
  setCurrentCategory: (category: string) => void;
  uiLocale: Language;
}) => {
  const { t } = useTranslation();
  const { data, isLoading } = useListCanvasTemplateCategories(null, null, {
    enabled: visible,
  });
  const categories = data?.data ?? [];
  const categoryStyle = useCallback(
    (isActive: boolean) =>
      cn('cursor-pointer p-2 rounded-md hover:bg-gray-100 w-full truncate flex items-center', {
        'bg-gray-100 font-medium': isActive,
      }),
    [],
  );

  return (
    <div className="h-full w-[40%] max-w-[200px] overflow-y-auto p-4 box-border flex-shrink-0 flex flex-col gap-1">
      <div
        className={categoryStyle(currentCategory === 'my-templates')}
        onClick={() => setCurrentCategory('my-templates')}
      >
        {t('template.myTemplates')}
      </div>

      <Divider className="my-1" />

      <div className={categoryStyle(currentCategory === '')} onClick={() => setCurrentCategory('')}>
        {t('template.allTemplates')}
      </div>

      <Spin spinning={isLoading}>
        {categories.map((category) => (
          <div
            key={category.categoryId}
            className={categoryStyle(currentCategory === category.categoryId)}
            onClick={() => setCurrentCategory(category.categoryId)}
          >
            {category.labelDict[uiLocale]}
          </div>
        ))}
      </Spin>
    </div>
  );
};

export const CanvasTemplateModal = () => {
  const { visible, setVisible } = useCanvasTemplateModal((state) => ({
    visible: state.visible,
    setVisible: state.setVisible,
  }));
  const [searchQuery, setSearchQuery] = useState('');
  const [currentCategory, setCurrentCategory] = useState('my-templates');
  const { i18n } = useTranslation();
  const currentUiLocale = i18n.language as Language;
  const [language, setLanguage] = useState(currentUiLocale);

  return (
    <Modal
      className="template-list"
      centered
      title={
        <TitleRender
          uiLocale={currentUiLocale}
          language={language}
          setLanguage={setLanguage}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      }
      width={1200}
      footer={null}
      open={visible}
      onCancel={() => setVisible(false)}
      focusTriggerAfterClose={false}
    >
      <div className="canvas-template-modal flex h-[60vh] overflow-hidden">
        <TemplateCategoryList
          visible={visible}
          uiLocale={currentUiLocale}
          currentCategory={currentCategory}
          setCurrentCategory={setCurrentCategory}
        />
        <TemplateList language={language} categoryId={currentCategory} searchQuery={searchQuery} />
      </div>
    </Modal>
  );
};
