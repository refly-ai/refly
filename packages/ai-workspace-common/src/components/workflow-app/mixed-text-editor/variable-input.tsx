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
    const [inputWidth, setInputWidth] = useState(30);
    const hiddenRef = useRef<HTMLSpanElement>(null);
    const isEmpty = !value || value.trim() === '';

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
        // Trigger width recalculation immediately after value change
        requestAnimationFrame(() => {
          if (hiddenRef.current) {
            const text = e.target.value || placeholder || '';
            hiddenRef.current.textContent = text;
            const width = Math.max(hiddenRef.current.offsetWidth + 16, 30);
            setInputWidth(Math.min(width, window.innerWidth * 1));
          }
        });
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
        requestAnimationFrame(() => {
          if (hiddenRef.current) {
            const text = target.value || placeholder || '';
            hiddenRef.current.textContent = text;
            const width = Math.max(hiddenRef.current.offsetWidth + 16, 30);
            setInputWidth(Math.min(width, window.innerWidth * 1));
          }
        });
      },
      [placeholder],
    );

    // Calculate input width based on content
    useEffect(() => {
      if (hiddenRef.current) {
        const text = value || placeholder || '';
        hiddenRef.current.textContent = text;
        const width = Math.max(hiddenRef.current.offsetWidth + 16, 30); // Add padding
        setInputWidth(Math.min(width, window.innerWidth * 1)); // Max 80% of viewport
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
        px-0
        py-1
        text-base
        leading-6
        bg-transparent
        border-b
        border-dashed
        border-refly-Card-Border
        rounded-none
        outline-none
        transition-all
        duration-200
        ease-in-out
        ${isFocused ? 'border-refly-primary-default' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}
        focus:border-refly-primary-default
        hover:border-refly-primary-hover
      placeholder:text-[rgba(14,159,119,0.50)]      `}
          style={{
            borderWidth: '0 0 1.5px 0',
            borderStyle: 'dashed',
            borderColor: 'var(--refly-primary-default)',
            margin: '0 8px',
            backgroundColor: 'transparent',
            borderRadius: '0',
            height: '26px',
            width: `${inputWidth}px`,
            minWidth: '30px',
            textAlign: 'center',
            maxWidth: '100%',
            fontFamily: 'PingFang SC',
            fontSize: '16px',
            fontStyle: 'normal',
            fontWeight: isEmpty ? '400' : '500',
            lineHeight: '26px',
            color: isEmpty
              ? 'var(--refly-text-2)'
              : isDefaultValue
                ? 'var(--refly-primary-default)'
                : isModified
                  ? 'var(--refly-primary-default)'
                  : 'var(--refly-primary-default)',
          }}
        />
      </>
    );
  },
);

VariableInput.displayName = 'VariableInput';

export default VariableInput;
