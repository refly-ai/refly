import React, { useState, useEffect } from 'react';
import { FloatButton, Tooltip } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import TestPanel from './TestPanel';

/**
 * 测试面板触发器
 * 在页面右下角显示一个悬浮按钮，点击后打开测试面板
 */
const TestPanelTrigger: React.FC = () => {
  const { t } = useTranslation();
  const [panelVisible, setPanelVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // 检查环境变量是否启用测试面板
    const envValue = import.meta.env.VITE_ENABLE_TEST_PANEL;
    const isTestPanelEnabled = envValue ? envValue === 'true' : false;
    setEnabled(isTestPanelEnabled);
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <Tooltip title={t('common.openTestPanel')} placement="left">
        <FloatButton
          icon={<ExperimentOutlined />}
          type="primary"
          onClick={() => setPanelVisible(true)}
          badge={{ dot: true }}
        />
      </Tooltip>
      <TestPanel visible={panelVisible} onClose={() => setPanelVisible(false)} />
    </>
  );
};

export default TestPanelTrigger;
