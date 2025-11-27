import { memo, useCallback, useEffect, useState } from 'react';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { ArrowDown, Checked } from 'refly-icons';
import { cn } from '@refly/utils/cn';
import { CanvasNode } from '@refly/canvas-common';
import { CanvasNodeType } from '@refly/openapi-schema';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';

const { Text } = Typography;

export interface MultiSelectResultProps {
  selectedResults: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  options: CanvasNode[];
}

// Multi-select component similar to ResultList styling
export const MultiSelectResult = memo(
  ({ selectedResults, onSelectionChange, options }: MultiSelectResultProps) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const handleToggleOption = useCallback(
      (optionId: string) => {
        const newSelection = selectedResults.includes(optionId)
          ? selectedResults.filter((id) => id !== optionId)
          : [...selectedResults, optionId];
        onSelectionChange(newSelection);
      },
      [selectedResults, onSelectionChange],
    );

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element;
        if (isOpen && !target.closest('.multi-select-dropdown')) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    const selectedCount = selectedResults.length;
    const displayText =
      selectedCount === 0
        ? t('workflowApp.changeResult')
        : `${selectedCount} ${t('workflowApp.resultsSelected')}`;

    return (
      <div className="relative multi-select-dropdown">
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <span className="text-xs font-semibold text-refly-text-0">{displayText}</span>
          <ArrowDown
            size={14}
            color="var(--refly-text-2)"
            className={cn('transition-transform', isOpen && 'rotate-180')}
          />
        </div>

        {isOpen && (
          <div
            className="absolute top-full right-0 mt-1 w-80 z-50"
            style={{
              borderRadius: '12px',
              border: '1px solid var(--refly-Card-Border)',
              backgroundColor: 'var(--refly-bg-body-z0)',
              boxShadow: '0 2px 20px 4px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="max-h-60 overflow-y-auto">
              {options.length === 0 ? (
                <div className="p-3 text-center text-refly-text-2 text-sm">
                  {t('workflowApp.noResultsAvailable')}
                </div>
              ) : (
                <div className="p-1">
                  {options.map((option) => (
                    <div
                      key={option.id}
                      className={cn(
                        'h-9 group p-2 cursor-pointer flex items-center justify-between gap-2 text-refly-text-0 rounded-lg',
                      )}
                      style={{
                        backgroundColor: 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--refly-tertiary-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      onClick={() => handleToggleOption(option.id)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <div
                            className={cn(
                              'w-3 h-3 flex items-center justify-center',
                              selectedResults.includes(option.id) &&
                                'bg-refly-primary-default border-refly-primary-default',
                            )}
                            style={{
                              borderRadius: '3px',
                              border: selectedResults.includes(option.id)
                                ? '1px solid var(--refly-primary-default)'
                                : '1px solid var(--refly-semi-color-border)',
                              backgroundColor: selectedResults.includes(option.id)
                                ? 'var(--refly-primary-default)'
                                : 'var(--refly-bg-control-z1)',
                            }}
                          >
                            {selectedResults.includes(option.id) && (
                              <Checked size={10} color="white" />
                            )}
                          </div>
                        </div>
                        <NodeIcon
                          type={option.type as CanvasNodeType}
                          small
                          url={option.data?.metadata?.imageUrl as string}
                        />
                        <Text
                          ellipsis={true}
                          className="block flex-1 min-w-0"
                          style={{
                            overflow: 'hidden',
                            color: 'var(--refly-text-0)',
                            textOverflow: 'ellipsis',
                            fontFamily: '"PingFang SC"',
                            fontSize: '14px',
                            fontStyle: 'normal',
                            fontWeight: 400,
                            lineHeight: '20px',
                          }}
                        >
                          {option.data?.title || t('common.agent', { defaultValue: 'Agent' })}
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

MultiSelectResult.displayName = 'MultiSelectResult';
