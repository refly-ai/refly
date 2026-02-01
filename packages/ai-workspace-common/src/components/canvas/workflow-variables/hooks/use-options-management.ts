import { useCallback, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { MAX_OPTIONS } from '../constants';
import { ensureUniqueOptions } from '../utils';
import type { DropResult } from '@refly-packages/ai-workspace-common/components/common/lazy-dnd';
import { useThrottledCallback } from 'use-debounce';

export const useOptionsManagement = (initialOptions: string[] = []) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<string[]>(initialOptions);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentOption, setCurrentOption] = useState<string>('');

  // Create a throttled error message function that only shows once within 2 seconds
  const showDuplicateError = useThrottledCallback(
    () => {
      message.error(
        t('canvas.workflow.variables.duplicateOption') || 'Duplicate option value is not allowed',
      );
    },
    3000,
    { trailing: false, leading: true },
  );

  const setOptionsValue = useCallback((newOptions: string[]) => {
    const uniqueOptions = ensureUniqueOptions(newOptions);
    setOptions(uniqueOptions);
    return uniqueOptions;
  }, []);

  // Function to add new options without filtering (for adding empty options)
  const addNewOption = useCallback((newOptions: string[]) => {
    setOptions(newOptions);
    return newOptions;
  }, []);

  // Option management handlers with form data sync
  const handleAddOption = useCallback(() => {
    if (options.length < MAX_OPTIONS) {
      // Add empty option directly without filtering
      const newOptions = [...options, ''];
      addNewOption(newOptions);

      // Auto focus the new input field
      const newIndex = newOptions.length - 1;
      setEditingIndex(newIndex);
      setCurrentOption('');
      return newOptions;
    } else {
      message.warning(
        t('canvas.workflow.variables.maxOptions', { max: MAX_OPTIONS }) ||
          `Maximum ${MAX_OPTIONS} options allowed`,
      );
      return options;
    }
  }, [options, addNewOption, t]);

  const handleRemoveOption = useCallback(
    (index: number) => {
      const newOptions = options.filter((_, i) => i !== index);
      setOptionsValue(newOptions);
      return newOptions;
    },
    [options, setOptionsValue],
  );

  const handleOptionChange = useCallback(
    (index: number, value: string) => {
      const newOptions = [...options];
      newOptions[index] = value;

      // During editing, allow empty values and don't filter
      // Only check for duplicates among non-empty values
      if (value.trim()) {
        // Check for duplicates only if the value is not empty
        const duplicateIndex = newOptions.findIndex(
          (option, i) => i !== index && option.trim() && option === value,
        );

        if (duplicateIndex !== -1) {
          // Use the throttled error message function
          showDuplicateError();
          return options; // Don't update if duplicate found
        }
      }

      // Update options without filtering (allow empty values during editing)
      addNewOption(newOptions);
      return newOptions;
    },
    [options, addNewOption, showDuplicateError],
  );

  const handleEditStart = useCallback(
    (index: number) => {
      setEditingIndex(index);
      const value = options?.[index] ?? '';
      setCurrentOption(value);
      return value;
    },
    [options],
  );

  const handleEditSave = useCallback(
    (value: string, index: number) => {
      const trimmedValue = value.trim();

      if (trimmedValue) {
        // When saving, use setOptionsValue to ensure uniqueness and filter empty values
        const newOptions = [...options];
        newOptions[index] = trimmedValue;
        setOptionsValue(newOptions);
        return newOptions;
      } else {
        return handleRemoveOption(index);
      }
    },
    [options, setOptionsValue, handleRemoveOption],
  );

  // Handle drag and drop for reordering options
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return options;
      }

      const sourceIndex = result.source.index;
      const destinationIndex = result.destination.index;

      if (sourceIndex === destinationIndex) {
        return options;
      }

      const newOptions = Array.from(options);
      const [removed] = newOptions.splice(sourceIndex, 1);
      newOptions.splice(destinationIndex, 0, removed);

      // After reordering, use setOptionsValue to ensure uniqueness and filter empty values
      setOptionsValue(newOptions);
      return newOptions;
    },
    [options, setOptionsValue],
  );

  const handleDragStart = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const resetOptions = useCallback(() => {
    setOptions([]);
    setEditingIndex(null);
    setCurrentOption('');
  }, []);

  return {
    options,
    editingIndex,
    currentOption,
    setOptionsValue,
    addNewOption,
    handleAddOption,
    handleRemoveOption,
    handleOptionChange,
    handleEditStart,
    handleEditSave,
    handleDragEnd,
    handleDragStart,
    setEditingIndex,
    setCurrentOption,
    resetOptions,
  };
};
