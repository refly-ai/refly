import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface SelectInputProps {
  id: string;
  value: string | string[];
  placeholder?: string;
  onChange: (value: string | string[]) => void;
  disabled?: boolean;
  options: Array<{ label: string; value: string }>;
  isDefaultValue?: boolean; // Whether this is a default value
  isModified?: boolean; // Whether the value has been modified by user
  isSingle?: boolean; // Whether this is single select (true) or multi-select (false)
}

const SelectInput: React.FC<SelectInputProps> = memo(
  ({
    value,
    placeholder,
    onChange,
    disabled = false,
    options = [],
    isDefaultValue = false,
    isModified = false,
    isSingle = true,
  }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);

    // Handle both single and multi-select values
    const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
    const isEmpty = selectedValues.length === 0;

    const handleClick = useCallback(() => {
      if (!disabled) {
        setIsOpen(!isOpen);
      }
    }, [disabled, isOpen]);

    const handleOptionClick = useCallback(
      (optionValue: string) => {
        if (isSingle) {
          // Single select: replace the value
          onChange(optionValue);
          setIsOpen(false);
        } else {
          // Multi-select: toggle the value
          const newSelectedValues = selectedValues.includes(optionValue)
            ? selectedValues.filter((v) => v !== optionValue)
            : [...selectedValues, optionValue];
          onChange(newSelectedValues);
          // Keep dropdown open for multi-select
        }
      },
      [onChange, isSingle, selectedValues],
    );

    const handleFocus = useCallback(() => {
      setIsFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      // Delay closing to allow option clicks
      setTimeout(() => setIsOpen(false), 150);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    // Get display text for selected values
    const getDisplayText = useCallback(() => {
      if (isEmpty) {
        return placeholder || t('canvas.workflow.variables.selectPlaceholder');
      }

      if (isSingle) {
        const selectedOption = options.find((option) => selectedValues.includes(option.value));
        return selectedOption?.label || selectedValues[0] || '';
      } else {
        // Multi-select: show all selected items separated by comma
        const selectedLabels = selectedValues.map((value) => {
          const option = options.find((opt) => opt.value === value);
          return option?.label || value;
        });

        // Use Chinese comma for Chinese content, English comma for English content
        const separator = /[\u4e00-\u9fff]/.test(selectedLabels.join('')) ? '，' : ', ';
        return selectedLabels.join(separator);
      }
    }, [isEmpty, isSingle, selectedValues, options, placeholder, t]);

    // Calculate the minimum width based on content
    const getMinWidth = useCallback(() => {
      const displayText = getDisplayText();
      const allTexts = [
        displayText,
        placeholder || t('canvas.workflow.variables.selectPlaceholder') || '',
        ...options.map((option) => option.label),
      ];

      // Estimate width based on character count (rough approximation)
      // Chinese characters are wider, so we give them more weight
      const maxLength = Math.max(
        ...allTexts.map((text) => {
          const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
          const otherChars = text.length - chineseChars;
          return chineseChars * 1.5 + otherChars; // Chinese chars are roughly 1.5x wider
        }),
      );

      // Convert to approximate pixel width (16px font size)
      const estimatedWidth = Math.max(maxLength * 10, 30); // Minimum 30px
      return `${estimatedWidth}px`;
    }, [getDisplayText, placeholder, t, options]);

    const isSelected = selectedValues?.length > 0;

    return (
      <div ref={selectRef} className="relative inline-block">
        <div
          className={`
              inline-flex items-center justify-between min-w-[30px] cursor-pointer
              bg-transparent border-b border-dashed border-refly-Card-Border rounded-none
              transition-all duration-200 ease-in-out
              ${isFocused || isOpen ? 'border-refly-primary-default' : 'border-refly-Card-Border'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              hover:border-refly-primary-hover
              text-refly-primary-default
            `}
          style={{
            margin: '0 8px',
            borderWidth: '0 0 1.5px 0',
            borderStyle: 'dashed',
            borderColor: 'var(--refly-primary-default)',
            backgroundColor: 'transparent',
            borderRadius: '0',
            height: '26px',
            fontFamily: 'PingFang SC',
            fontSize: '16px',
            fontStyle: 'normal',
            fontWeight: isEmpty ? '400' : '500',
            lineHeight: '26px',
            minWidth: getMinWidth(),
            color: isEmpty
              ? 'var(--refly-text-2)'
              : isDefaultValue
                ? 'var(--refly-primary-default)'
                : isModified
                  ? 'var(--refly-primary-default)'
                  : 'var(--refly-primary-default)',
          }}
          onClick={handleClick}
          onFocus={handleFocus}
          onBlur={handleBlur}
          tabIndex={disabled ? -1 : 0}
        >
          <span
            className={
              // biome-ignore lint/style/useTemplate: <explanation>
              'flex-1 ' + isSelected
                ? 'text-refly-primary-default'
                : 'text-[rgba(14,159,119,0.50)] '
            }
          >
            {getDisplayText()}
          </span>
          <svg
            className={`w-3 h-3 ml-1 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: 'var(--refly-primary-default)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {isOpen && !disabled && (
          <div
            className="absolute top-full left-0 mt-1 bg-refly-bg-content-z2 border border-refly-Card-Border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
            style={{
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--refly-Card-Border)',
              borderRadius: '8px',
              minWidth: getMinWidth(),
            }}
          >
            {options.map((option) => {
              const isSelected = selectedValues.includes(option.value);

              return (
                <div
                  key={option.value}
                  className={`
                    px-3 py-2 cursor-pointer transition-colors duration-150 flex items-center gap-2
                    ${
                      isSelected
                        ? 'bg-refly-primary-light text-refly-primary-default'
                        : 'hover:bg-refly-bg-control-z1 text-refly-text-1'
                    }
                  `}
                  onClick={() => handleOptionClick(option.value)}
                  style={{
                    fontFamily:
                      'PingFang SC, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '16px',
                    lineHeight: '1.625em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span className="flex-1">{option.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);

SelectInput.displayName = 'SelectInput';

export default SelectInput;
