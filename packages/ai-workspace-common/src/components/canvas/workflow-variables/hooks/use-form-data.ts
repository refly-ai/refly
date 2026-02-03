import { useState, useCallback } from 'react';
import type { VariableFormData } from '../types';
import { RESOURCE_TYPE } from '../constants';

const defaultStringData: VariableFormData = {
  name: '',
  value: [{ type: 'text', text: '' }],
  description: '',
  required: true,
  isSingle: true,
  options: [],
};

const defaultResourceData: VariableFormData = {
  name: '',
  value: [{ type: 'resource', resource: { name: '', storageKey: '', fileType: 'image' } }],
  description: '',
  required: true,
  isSingle: false,
  options: [],
  resourceTypes: RESOURCE_TYPE,
};

const defaultOptionData: VariableFormData = {
  name: '',
  value: [{ type: 'text', text: '' }],
  description: '',
  required: true,
  isSingle: true,
  options: [],
};

export const useFormData = () => {
  const [stringFormData, setStringFormData] = useState<VariableFormData>({
    ...defaultStringData,
  });

  const [resourceFormData, setResourceFormData] = useState<VariableFormData>({
    ...defaultResourceData,
  });

  const [optionFormData, setOptionFormData] = useState<VariableFormData>({
    ...defaultOptionData,
  });

  const resetFormData = useCallback(() => {
    setStringFormData({
      ...defaultStringData,
    });
    setResourceFormData({
      ...defaultResourceData,
    });
    setOptionFormData({
      ...defaultOptionData,
    });
  }, []);

  const updateStringFormData = useCallback((data: Partial<VariableFormData>) => {
    setStringFormData((prev) => ({
      ...prev,
      ...data,
    }));
  }, []);

  const updateResourceFormData = useCallback((data: Partial<VariableFormData>) => {
    setResourceFormData((prev) => ({
      ...prev,
      ...data,
    }));
  }, []);

  const updateOptionFormData = useCallback((data: Partial<VariableFormData>) => {
    setOptionFormData((prev) => ({
      ...prev,
      ...data,
    }));
  }, []);

  return {
    stringFormData,
    resourceFormData,
    optionFormData,
    resetFormData,
    updateStringFormData,
    updateResourceFormData,
    updateOptionFormData,
  };
};
