import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { VariableInputProps } from './types';

const VariableInput: React.FC<VariableInputProps> = memo(
  ({
    id,
    value,
    placeholder,
    onChange,
    disabled = false,
    isDefaultValue = false,
    isModified = false,
  }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [inputWidth, setInputWidth] = useState(60);
    const hiddenRef = useRef<HTMLSpanElement>(null);
    const isEmpty = !value || value.trim() === '';

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
        // Trigger width recalculation immediately after value change
        setTimeout(() => {
          if (hiddenRef.current) {
            const text = e.target.value || placeholder || '';
            hiddenRef.current.textContent = text;
            const width = Math.max(hiddenRef.current.offsetWidth + 16, 60);
            setInputWidth(Math.min(width, window.innerWidth * 0.8));
          }
        }, 0);
      },
      [onChange, placeholder],
    );

    const handleFocus = useCallback(() => {
      setIsFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
    }, []);

    const handleInput = useCallback(
      (e: React.FormEvent<HTMLInputElement>) => {
        // Handle paste, cut, and other input events
        const target = e.target as HTMLInputElement;
        setTimeout(() => {
          if (hiddenRef.current) {
            const text = target.value || placeholder || '';
            hiddenRef.current.textContent = text;
            const width = Math.max(hiddenRef.current.offsetWidth + 16, 60);
            setInputWidth(Math.min(width, window.innerWidth * 0.8));
          }
        }, 0);
      },
      [placeholder],
    );

    // Calculate input width based on content
    useEffect(() => {
      if (hiddenRef.current) {
        const text = value || placeholder || '';
        hiddenRef.current.textContent = text;
        const width = Math.max(hiddenRef.current.offsetWidth + 16, 60); // Add padding
        setInputWidth(Math.min(width, window.innerWidth * 0.8)); // Max 80% of viewport
      }
    }, [value, placeholder]);

    return (
      <>
        {/* Hidden span to measure text width */}
        <span
          ref={hiddenRef}
          style={{
            position: 'absolute',
            visibility: 'hidden',
            whiteSpace: 'nowrap',
            fontFamily:
              'PingFang SC, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '16px',
            lineHeight: '1.625em',
          }}
        />
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={handleChange}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className={`
        inline-block
        px-2
        py-1
        text-base
        leading-6
        bg-[#EBFFF9]
        border
        border-dashed
        border-[rgba(14,159,119,0.3)]
        rounded-lg
        outline-none
        transition-all
        duration-200
        ease-in-out
        ${isFocused ? 'border-[rgba(14,159,119,0.6)] bg-[#F0FFF8]' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}
        focus:border-[rgba(14,159,119,0.6)]
        focus:bg-[#F0FFF8]
        hover:border-[rgba(14,159,119,0.4)]
        placeholder:text-[#0E9F77]
        placeholder:opacity-70
      `}
          style={{
            borderWidth: '0.5px',
            borderStyle: 'dashed',
            borderColor: isFocused
              ? 'rgba(14,159,119,0.6)'
              : isEmpty
                ? 'rgba(14,159,119,0.15)' // Empty value: lightest border
                : isDefaultValue
                  ? 'rgba(14,159,119,0.3)' // Default value: medium border
                  : isModified
                    ? 'rgba(14,159,119,0.5)' // Modified value: darkest border
                    : 'rgba(14,159,119,0.3)',
            backgroundColor: isFocused
              ? '#F0FFF8'
              : isEmpty
                ? '#F0F9F7' // Empty value: lightest background
                : isDefaultValue
                  ? '#EBFFF9' // Default value: medium background
                  : isModified
                    ? '#EBFFF9' // Modified value: darkest background
                    : '#EBFFF9',
            borderRadius: '8px',
            padding: '4px 8px',
            height: '26px',
            width: `${inputWidth}px`,
            minWidth: '60px',
            maxWidth: '100%',
            fontFamily:
              'PingFang SC, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '16px',
            lineHeight: '1.625em',
            color: isEmpty
              ? '#7FB3A3' // Empty value: light green font
              : isDefaultValue
                ? '#0E9F77' // Default value: normal green font
                : isModified
                  ? '#0E9F77' // Modified value: normal green font
                  : '#0E9F77', // Green font
          }}
        />
      </>
    );
  },
);

VariableInput.displayName = 'VariableInput';

export default VariableInput;
