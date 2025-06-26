import { Collapse } from 'antd';
import { useTranslation } from 'react-i18next';

function FrequentlyAskedQuestions() {
  const { t } = useTranslation();
  const panelStyle: React.CSSProperties = {
    marginBottom: 24,
    borderRadius: 8,
  };

  const items = [1, 2, 3, 4, 5, 6].map((item) => ({
    key: item,
    label: <div className="text-lg font-bold">{t(`landingPage.faq.Q${item}`)}</div>,
    children: (
      <p className="text-base text-gray-600 dark:text-gray-300">{t(`landingPage.faq.A${item}`)}</p>
    ),
    style: panelStyle,
  }));

  return (
    <div className="flex w-full justify-center pt-12 md:pt-16">
      <div className="flex w-[70%] max-w-7xl flex-col px-4">
        <div className="mb-4 text-3xl font-bold">{t('landingPage.faq.title')}</div>
        <div className="flex-grow">
          <Collapse bordered={false} style={{ background: 'transparent' }} items={items} />
        </div>
      </div>
    </div>
  );
}

export default FrequentlyAskedQuestions;
