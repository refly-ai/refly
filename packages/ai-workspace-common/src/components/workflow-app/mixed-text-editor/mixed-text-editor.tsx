import React, { memo, useCallback, useMemo } from 'react';
import { MixedTextEditorProps, TextSegment } from './types';
import VariableInput from './variable-input';
import FileInput from './file-input';
import SelectInput from './select-input';
import { WorkflowVariable } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';

const MixedTextEditor: React.FC<MixedTextEditorProps> = memo(
  ({
    templateContent,
    variables = [] as WorkflowVariable[],
    onVariablesChange,
    className = '',
    disabled = false,
    originalVariables = [] as WorkflowVariable[],
  }) => {
    const { t } = useTranslation();
    // Parse template content to extract variables and text segments
    const segments = useMemo((): TextSegment[] => {
      const segments: TextSegment[] = [];
      const variableRegex = /\{\{([^}]+)\}\}/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      match = variableRegex.exec(templateContent);
      while (match !== null) {
        // Add text before the variable
        if (match.index > lastIndex) {
          segments.push({
            type: 'text',
            content: templateContent.slice(lastIndex, match.index),
          });
        }

        // Add the variable
        const variableName = match[1].trim();
        const variable = variables.find((v) => v.name === variableName);

        // Handle both single and multi-select values
        let currentValue: string | string[];
        if (variable?.variableType === 'option' && variable?.isSingle === false) {
          // Multi-select: extract all text values
          currentValue = variable.value?.map((v) => v.text).filter(Boolean) || [];
        } else {
          // Single select or other types: use first value
          currentValue = variable?.value?.[0]?.text || '';
        }

        // Determine state: compare current value with original value
        const isEmpty = Array.isArray(currentValue)
          ? currentValue.length === 0
          : !currentValue || currentValue.trim() === '';

        // Find original value for comparison
        const originalVariable = originalVariables.find((v) => v.name === variableName);
        let originalValue: string | string[];
        if (originalVariable?.variableType === 'option' && originalVariable?.isSingle === false) {
          originalValue = originalVariable.value?.map((v) => v.text).filter(Boolean) || [];
        } else {
          originalValue = originalVariable?.value?.[0]?.text || '';
        }

        const isDefaultValue =
          !isEmpty && JSON.stringify(currentValue) === JSON.stringify(originalValue);
        const isModified =
          !isEmpty && JSON.stringify(currentValue) !== JSON.stringify(originalValue);

        segments.push({
          type: 'variable',
          content: currentValue,
          id: variableName,
          placeholder:
            t('canvas.workflow.variables.inputPlaceholder') || `Please enter ${variableName}`,
          variable,
          isDefaultValue,
          isModified,
        });

        lastIndex = match.index + match[0].length;
        match = variableRegex.exec(templateContent);
      }

      // Add remaining text after the last variable
      if (lastIndex < templateContent.length) {
        segments.push({
          type: 'text',
          content: templateContent.slice(lastIndex),
        });
      }

      return segments;
    }, [templateContent, variables]);

    const handleVariableChange = useCallback(
      (variableId: string, value: string | any) => {
        if (onVariablesChange) {
          const updatedVariables = variables.map((variable) => {
            if (variable.name === variableId) {
              if (variable.variableType === 'resource') {
                // Handle file upload
                return {
                  ...variable,
                  value: [{ type: 'resource' as const, resource: value }],
                };
              } else if (variable.variableType === 'option') {
                // Handle option values - ensure it's always an array
                const optionValue = Array.isArray(value) ? value : value ? [value] : [];
                return {
                  ...variable,
                  value: optionValue.map((v) => ({ type: 'text' as const, text: v })),
                };
              } else {
                // Handle text values
                return {
                  ...variable,
                  value: [{ type: 'text' as const, text: value || '' }],
                };
              }
            }
            return variable;
          });
          onVariablesChange(updatedVariables);
        }
      },
      [variables, onVariablesChange],
    );

    return (
      <div className={`mixed-text-editor ${className}`}>
        <div
          className="text-base text-refly-text-1"
          style={{
            fontFamily:
              'PingFang SC, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '16px',
            lineHeight: '30px',
          }}
        >
          {segments.map((segment, index) => {
            if (segment.type === 'text') {
              return <span key={index}>{segment.content}</span>;
            }

            // Render different input types based on variable type
            if (segment.variable?.variableType === 'option') {
              return (
                <SelectInput
                  key={`${segment.id}-${index}`}
                  id={segment.id || ''}
                  value={segment.content}
                  placeholder={segment.variable?.name || segment.placeholder}
                  onChange={(value) => handleVariableChange(segment.id || '', value)}
                  disabled={disabled}
                  options={
                    segment.variable.options?.map((option) => ({
                      label: option,
                      value: option,
                    })) || []
                  }
                  isDefaultValue={segment.isDefaultValue}
                  isModified={segment.isModified}
                  isSingle={segment.variable.isSingle ?? true}
                />
              );
            }

            if (segment.variable?.variableType === 'resource') {
              const currentFile = segment.variable.value?.[0]?.resource;

              return (
                <FileInput
                  key={`${segment.id}-${index}`}
                  id={segment.id || ''}
                  value={currentFile}
                  placeholder={segment.variable?.name || segment.placeholder}
                  onChange={(value) => handleVariableChange(segment.id || '', value)}
                  disabled={disabled}
                  isDefaultValue={segment.isDefaultValue}
                  isModified={segment.isModified}
                />
              );
            }

            return (
              <VariableInput
                key={`${segment.id}-${index}`}
                id={segment.id || ''}
                value={Array.isArray(segment.content) ? segment.content[0] || '' : segment.content}
                placeholder={segment.variable?.name || segment.placeholder}
                onChange={(value) => handleVariableChange(segment.id || '', value)}
                disabled={disabled}
                isDefaultValue={segment.isDefaultValue}
                isModified={segment.isModified}
              />
            );
          })}
        </div>
      </div>
    );
  },
);

MixedTextEditor.displayName = 'MixedTextEditor';

export default MixedTextEditor;
