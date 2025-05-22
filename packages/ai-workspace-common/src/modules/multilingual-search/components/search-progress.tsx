import React, { useState, useEffect } from 'react';
import { Timeline, Spin, Collapse } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useMultilingualSearchStore } from '../stores/multilingual-search';
import './search-progress.scss';
import { useTranslation } from 'react-i18next';

const renderStepResult = (step: string, result: any, t: any) => {
  switch (step) {
    case 'rewriteQuery':
      return (
        <ul>
          <li>
            {t('resource.multilingualSearch.steps.rewriteQuery.rewrittenQueries')}:{' '}
            {result.rewrittenQueries.join(', ')}
          </li>
          <li>
            {t('resource.multilingualSearch.steps.rewriteQuery.outputLocale')}:{' '}
            {result.outputLocale}
          </li>
          <li>
            {t('resource.multilingualSearch.steps.rewriteQuery.searchLocales')}:{' '}
            {result.searchLocales.join(', ')}
          </li>
        </ul>
      );

    case 'translateQuery':
      return (
        <ul>
          {Object.entries(result.translatedQueries).map(([locale, queries]: [string, string[]]) => (
            <li key={locale}>
              {locale}: {queries.join(', ')}
            </li>
          ))}
        </ul>
      );

    case 'webSearch':
    case 'translateResults':
      return (
        <ul>
          <li>
            {t('resource.multilingualSearch.steps.webSearch.results')}: {result.length}
          </li>
          <li>
            {t('resource.multilingualSearch.steps.webSearch.searchLocales')}: {result.localeLength}
          </li>
        </ul>
      );

    case 'rerank':
      return (
        <ul>
          <li>
            {t('resource.multilingualSearch.steps.rerank.finalResults')}: {result.length}
          </li>
        </ul>
      );

    case 'finish':
      return null;

    default:
      return result ? (
        <ul>
          {Object.entries(result).map(([key, value]) => (
            <li key={key}>
              {key}: {value as string}
            </li>
          ))}
        </ul>
      ) : null;
  }
};

// 步骤名称映射
const getStepName = (step: string, t: any) => {
  const stepMap: Record<string, string> = {
    rewriteQuery: t('resource.multilingualSearch.steps.rewriteQuery.title'),
    translateQuery: t('resource.multilingualSearch.steps.translateQuery.title'),
    webSearch: t('resource.multilingualSearch.steps.webSearch.title'),
    translateResults: t('resource.multilingualSearch.steps.translateResults.title'),
    rerank: t('resource.multilingualSearch.steps.rerank.title'),
    finish: t('resource.multilingualSearch.steps.finish.title'),
    'Processing...': t('resource.multilingualSearch.steps.processing'),
  };

  return stepMap[step] || step;
};

export const SearchProgress: React.FC = () => {
  const { t } = useTranslation();
  const { searchSteps, isSearching, results, clearSearchSteps, setProcessingStep } =
    useMultilingualSearchStore((state) => ({
      searchSteps: state.searchSteps,
      isSearching: state.isSearching,
      results: state.results,
      clearSearchSteps: state.clearSearchSteps,
      setProcessingStep: state.setProcessingStep,
    }));

  // 添加折叠面板的状态控制
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  // 监听 isSearching 变化，自动展开/折叠
  useEffect(() => {
    if (isSearching) {
      setActiveKeys(['1']);
      clearSearchSteps();
      setProcessingStep();
    } else {
      setActiveKeys([]); // 搜索结束后自动折叠
    }
  }, [isSearching, clearSearchSteps]);

  const finishStep = searchSteps.find((step) => step.step === 'finish');
  const summaryText = finishStep
    ? t('resource.multilingualSearch.progress.summary', {
        count: results.length,
        duration: finishStep.duration,
      })
    : t('resource.multilingualSearch.steps.processing');

  // 处理折叠面板变化
  const handleCollapseChange = (keys: string | string[]) => {
    setActiveKeys(typeof keys === 'string' ? [keys] : keys);
  };

  return (
    <div className="search-progress">
      <Collapse
        ghost
        activeKey={activeKeys}
        onChange={handleCollapseChange}
        items={[
          {
            key: '1',
            label: `${t('resource.multilingualSearch.progress.title')} - ${summaryText}`,
            children: (
              <Timeline
                items={searchSteps.map((step) => ({
                  dot:
                    step.step === 'Processing...' ? (
                      <Spin
                        indicator={
                          <LoadingOutlined style={{ fontSize: 12, color: '#00968f' }} spin />
                        }
                      />
                    ) : undefined,
                  children: (
                    <div className="step-content">
                      <h4>{getStepName(step.step, t)}</h4>
                      {step.result && renderStepResult(step.step, step.result, t)}
                      {step.duration > 0 && (
                        <span className="duration">
                          {t('resource.multilingualSearch.progress.duration', {
                            duration: step.duration,
                          })}
                        </span>
                      )}
                    </div>
                  ),
                }))}
              />
            ),
          },
        ]}
      />
    </div>
  );
};
