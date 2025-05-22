import React, { useState } from 'react';
import { Typography, Select, Tooltip } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';

// styles
import './index.scss';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';

interface Option {
  label: string;
  value: string;
}

interface FormHeaderProps {
  title: string;
  icon?: React.ReactNode;
  options?: Option[];
  enableSelect?: boolean;
  enableCollapse?: boolean;
  enableMultiSelect?: boolean;
  onSelectChange?: (value: string | string[]) => void;
  onCollapseChange?: (collapsed: boolean) => void;
  collapsed?: boolean;
  selectTooltipTitle?: string;
}

export const FormHeader: React.FC<FormHeaderProps> = ({
  title,
  icon,
  options = [],
  enableSelect = false,
  enableCollapse = false,
  enableMultiSelect = false,
  onSelectChange,
  onCollapseChange,
  collapsed = false,
  selectTooltipTitle,
}) => {
  const [isMultiSelect, setIsMultiSelect] = useState(enableMultiSelect);

  const handleSelectChange = (value: string | string[]) => {
    if (onSelectChange) {
      onSelectChange(value);
    }
  };

  const handleCollapseChange = () => {
    if (onCollapseChange) {
      onCollapseChange(!collapsed);
    }
  };

  const _handleSwitchChange = (checked: boolean) => {
    setIsMultiSelect(checked);
    // Reset selection when switching between single and multi-select
    if (onSelectChange) {
      onSelectChange(checked ? [] : '');
    }
  };

  return (
    <div className="form-header">
      <div className="form-header-left" onClick={handleCollapseChange}>
        {enableCollapse && (
          <Typography.Text style={{ color: 'rgba(0, 0, 0, .5)' }}>
            {collapsed ? <DownOutlined /> : <UpOutlined />}
          </Typography.Text>
        )}
        {icon && <div className="form-header-icon">{icon}</div>}
        <Typography.Title level={5} style={{ margin: 0, marginLeft: 8 }}>
          {title}
        </Typography.Title>
      </div>
      <div
        className="form-header-right"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        {enableSelect && (
          <>
            {!isMultiSelect && (
              <Tooltip title={selectTooltipTitle} getPopupContainer={getPopupContainer}>
                <Select
                  size="small"
                  getPopupContainer={getPopupContainer}
                  className="context-selector"
                  defaultValue={options?.[0]?.value}
                  options={options}
                  onChange={handleSelectChange}
                  style={{ minWidth: 100, maxWidth: 200 }}
                />
              </Tooltip>
            )}
            {/* <Switch
              type="round"
              size="small"
              checked={isMultiSelect}
              onChange={setIsMultiSelect}
              checkedText="多选"
              uncheckedText="单选"
            /> */}
          </>
        )}
      </div>
    </div>
  );
};
