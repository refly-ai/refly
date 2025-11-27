import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Modal, Form, Input, Radio, Switch, Button, message, Checkbox, InputNumber } from 'antd';
import {
  ToolsetDefinition,
  ToolsetInstance,
  UpsertToolsetRequest,
  ToolsetAuthType,
  DynamicConfigItem,
  DynamicConfigValue,
} from '@refly-packages/ai-workspace-common/requests';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Close } from 'refly-icons';
import {
  useListTools,
  useListToolsets,
  useListUserToolsKey,
} from '@refly-packages/ai-workspace-common/queries';
import { useQueryClient } from '@tanstack/react-query';
import { OAuthStatusChecker } from './oauth-status-checker';
import './index.scss';
const { TextArea } = Input;

interface ToolInstallModalProps {
  mode: 'install' | 'update';
  toolInstance?: ToolsetInstance;
  toolDefinition?: ToolsetDefinition;
  visible: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

const getDictValue = (dict: { [key: string]: string } | undefined, locale: string) => {
  return dict?.[locale] || dict?.en || '';
};

// ConfigItem component for rendering individual form fields
const ConfigItem = React.memo(
  ({
    item,
    field,
    locale,
    configValue,
    onValueChange,
    readonly = false,
    isUpdateMode = false,
  }: {
    item: DynamicConfigItem;
    field: string;
    locale: string;
    configValue?: DynamicConfigValue;
    onValueChange: (field: string, val: any) => void;
    readonly?: boolean;
    isUpdateMode?: boolean;
  }) => {
    const [initialValue, setInitialValue] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Handle initial value setup
    React.useEffect(() => {
      if (!initialValue) {
        // Priority 1: Use existing configValue if available
        if (configValue?.value !== undefined) {
          setInitialValue(configValue.value);
        }
        // Priority 2: Use default value from schema
        else if (item?.defaultValue !== undefined) {
          setInitialValue(item.defaultValue);
        }
      }
    }, [configValue, item, initialValue]);

    const onValueChangeHandler = (val: any) => {
      setInitialValue(val);
      onValueChange(field, val);
    };

    if (item.inputMode === 'text') {
      if (item.inputProps?.passwordType) {
        // Handle password fields in update mode
        if (isUpdateMode && !isEditing && !initialValue) {
          return (
            <Input.Password
              variant="filled"
              placeholder={getDictValue(item.descriptionDict, locale)}
              value="************"
              readOnly
              onClick={() => setIsEditing(true)}
              className="cursor-pointer"
            />
          );
        }

        return (
          <Input.Password
            variant="filled"
            placeholder={getDictValue(item.descriptionDict, locale)}
            value={initialValue !== null ? String(initialValue) : undefined}
            onChange={(e) => {
              const val = e.target.value;
              onValueChangeHandler(val);
            }}
            onBlur={() => setIsEditing(false)}
            onFocus={() => setIsEditing(true)}
            disabled={readonly}
          />
        );
      }

      return (
        <Input
          variant="filled"
          placeholder={getDictValue(item.descriptionDict, locale)}
          value={initialValue !== null ? String(initialValue) : undefined}
          onChange={(e) => {
            const val = e.target.value;
            onValueChangeHandler(val);
          }}
          disabled={readonly}
        />
      );
    }

    if (item.inputMode === 'textarea') {
      return (
        <TextArea
          variant="filled"
          placeholder={getDictValue(item.descriptionDict, locale)}
          value={initialValue !== null ? String(initialValue) : undefined}
          rows={4}
          autoSize={{
            minRows: 4,
            maxRows: 10,
          }}
          onChange={(e) => {
            const val = e.target.value;
            onValueChangeHandler(val);
          }}
          disabled={readonly}
        />
      );
    }

    if (item.inputMode === 'number') {
      return (
        <InputNumber
          variant="filled"
          controls
          value={initialValue !== null ? Number(initialValue) : undefined}
          className="w-full"
          onChange={(val) => {
            onValueChangeHandler(val);
          }}
          disabled={readonly}
        />
      );
    }

    if (item.inputMode === 'select' || item.inputMode === 'multiSelect') {
      const defaultValue =
        configValue?.value ||
        (item.inputMode === 'multiSelect' ? [item.options?.[0]?.value] : item.options?.[0]?.value);

      if (item.inputMode === 'multiSelect') {
        return (
          <Checkbox.Group
            options={(item.options ?? []).map((option) => ({
              label: getDictValue(option.labelDict ?? {}, locale),
              value: option.value,
            }))}
            style={{ fontSize: '10px' }}
            value={(configValue?.value as string[]) || (defaultValue as string[])}
            onChange={(val) => {
              onValueChangeHandler(val);
            }}
            disabled={readonly}
          />
        );
      }

      return (
        <Radio.Group
          value={configValue?.value || defaultValue}
          onChange={(e) => {
            const checkedValue = e.target.value;
            onValueChangeHandler(checkedValue);
          }}
          disabled={readonly}
        >
          {(item.options ?? []).map((option) => (
            <Radio key={option.value} value={option.value} className="config-radio text-[10px]">
              {getDictValue(option.labelDict ?? {}, locale)}
            </Radio>
          ))}
        </Radio.Group>
      );
    }

    if (item.inputMode === 'switch') {
      return (
        <Switch
          size="small"
          checked={Boolean(configValue?.value)}
          onChange={(checked) => {
            onValueChangeHandler(checked);
          }}
          disabled={readonly}
        />
      );
    }

    return null;
  },
);

ConfigItem.displayName = 'ConfigItem';

export const ToolInstallModal = React.memo(
  ({ mode, toolInstance, toolDefinition, visible, onCancel, onSuccess }: ToolInstallModalProps) => {
    const { i18n, t } = useTranslation();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [oauthStatus, setOAuthStatus] = useState<
      'checking' | 'authorized' | 'unauthorized' | 'error' | null
    >(null);
    const queryClient = useQueryClient();
    const { data, refetch: refetchToolsets } = useListToolsets({}, [], {
      enabled: true,
    });

    const { refetch: refetchEnabledTools } = useListTools({ query: { enabled: true } }, [], {
      enabled: false,
    });
    const toolInstances = data?.data || [];

    const currentLocale = i18n.language || 'en';

    const sourceData = useMemo(() => {
      if (mode === 'install') {
        return toolDefinition;
      }
      return {
        ...toolInstance,
        authPatterns: toolInstance?.definition?.authPatterns || [],
        configItems: toolInstance?.definition?.configItems || [],
        descriptionDict: toolInstance?.definition?.descriptionDict || {},
      };
    }, [mode, toolDefinition, toolInstance]);

    const defaultName = useMemo(() => {
      if (mode === 'install' && toolDefinition?.labelDict) {
        return toolDefinition.labelDict[currentLocale] || toolDefinition.labelDict.en;
      }
      if (mode === 'update' && toolInstance?.name) {
        return toolInstance.name;
      }
      return '';
    }, [mode, toolDefinition, toolInstance, currentLocale]);

    const authPatterns = useMemo(() => {
      return sourceData?.authPatterns || [];
    }, [sourceData]);

    const [selectedAuthType, setSelectedAuthType] = useState<ToolsetAuthType | ''>(
      authPatterns.length ? authPatterns[0].type : '',
    );

    const selectedAuthPattern = useMemo(() => {
      if (!selectedAuthType || !authPatterns.length) return null;
      return authPatterns.find((pattern) => pattern.type === selectedAuthType);
    }, [selectedAuthType, authPatterns]);

    const credentialItems = useMemo(() => {
      return selectedAuthPattern?.credentialItems || [];
    }, [selectedAuthPattern]);

    const configItems = useMemo(() => {
      return sourceData?.configItems || [];
    }, [sourceData]);

    useEffect(() => {
      if (visible && sourceData) {
        form?.resetFields();
        setOAuthStatus(null); // Reset OAuth status when modal opens
        const initialValues: Record<string, unknown> = {
          name: defaultName,
          enabled: mode === 'update' ? (toolInstance?.enabled ?? true) : true,
        };

        if (mode === 'update' && toolInstance) {
          initialValues.authType = toolInstance?.authType;
          setSelectedAuthType(toolInstance?.authType);

          initialValues.authData = toolInstance.authData;

          initialValues.config = toolInstance.config;
        }

        if (mode === 'install' && authPatterns.length) {
          initialValues.authType = authPatterns[0].type;
          setSelectedAuthType(authPatterns[0].type);
          initialValues.config = sourceData?.configItems?.reduce(
            (acc, item) => {
              acc[item.key] = item.defaultValue;
              return acc;
            },
            {} as Record<string, any>,
          );
        }

        form.setFieldsValue(initialValues);
      } else {
        form?.resetFields();
        setOAuthStatus(null); // Reset OAuth status when modal closes
      }
    }, [visible, sourceData, mode, toolInstance, defaultName, form, authPatterns]);

    const handleAuthTypeChange = useCallback(
      (value: ToolsetAuthType) => {
        setSelectedAuthType(value);
        form.setFieldValue('authData', {});
      },
      [form],
    );

    const handleCredentialValueChange = useCallback(
      (field: string, val: any) => {
        form.setFieldValue(['authData', field], val);
      },
      [form],
    );

    const handleConfigValueChange = useCallback(
      (field: string, val: any) => {
        form.setFieldValue(['config', field], val);
      },
      [form],
    );

    const handleOAuthStatusChange = useCallback(
      (status: 'checking' | 'authorized' | 'unauthorized' | 'error') => {
        setOAuthStatus(status);
      },
      [],
    );

    // Render credential form fields based on credential items
    const renderCredentialFields = useCallback(() => {
      if (!credentialItems.length) return null;

      return (
        <>
          {credentialItems.map((item) => (
            <Form.Item
              key={item.key}
              label={getDictValue(item.labelDict, currentLocale)}
              name={['authData', item.key]}
              rules={[
                {
                  required: mode === 'install' ? item.required : false,
                  message: t('settings.toolStore.install.required', {
                    name: getDictValue(item.labelDict, currentLocale),
                  }),
                },
              ]}
            >
              <ConfigItem
                item={item}
                field={item.key}
                locale={currentLocale}
                configValue={form.getFieldValue(['authData', item.key])}
                onValueChange={handleCredentialValueChange}
                isUpdateMode={mode === 'update'}
              />
            </Form.Item>
          ))}
        </>
      );
    }, [credentialItems, currentLocale, form, handleCredentialValueChange, mode]);

    // Render OAuth status check for OAuth auth patterns
    const renderOAuthStatus = useCallback(() => {
      if (selectedAuthPattern?.type !== 'oauth') return null;
      if (!sourceData?.key) return null;

      return (
        <Form.Item label={t('settings.toolStore.install.oauthStatus')} name="oauthStatus">
          <OAuthStatusChecker
            toolKey={sourceData.key}
            authPattern={selectedAuthPattern as any}
            onStatusChange={handleOAuthStatusChange}
          />
        </Form.Item>
      );
    }, [selectedAuthPattern, t, handleOAuthStatusChange, sourceData]);

    // Render config form fields based on config items
    const renderConfigFields = useCallback(() => {
      if (!configItems.length) return null;

      return (
        <>
          {configItems.map((item) => (
            <Form.Item
              key={item.key}
              label={getDictValue(item.labelDict, currentLocale)}
              name={['config', item.key]}
              rules={[
                {
                  required: item.required,
                  message: t('settings.toolStore.install.required', {
                    name: getDictValue(item.labelDict, currentLocale),
                  }),
                },
              ]}
            >
              <ConfigItem
                item={item}
                field={item.key}
                locale={currentLocale}
                configValue={form.getFieldValue(['config', item.key])}
                onValueChange={handleConfigValueChange}
                isUpdateMode={mode === 'update'}
              />
            </Form.Item>
          ))}
        </>
      );
    }, [configItems, currentLocale, form, handleConfigValueChange, mode]);

    const refetchToolsOnUpdate = useCallback(() => {
      refetchToolsets();
      refetchEnabledTools();
      // Invalidate useListUserTools cache to refresh mention list
      queryClient.invalidateQueries({ queryKey: [useListUserToolsKey] });
    }, [refetchToolsets, refetchEnabledTools, queryClient]);

    // Determine if the submit button should be disabled
    const isSubmitDisabled = useMemo(() => {
      // If it's an OAuth auth pattern and OAuth is not authorized, disable the button
      if (selectedAuthPattern?.type === 'oauth' && oauthStatus === 'unauthorized') {
        return true;
      }
      // If OAuth is still checking, disable the button
      if (selectedAuthPattern?.type === 'oauth' && oauthStatus === 'checking') {
        return true;
      }
      return false;
    }, [selectedAuthPattern?.type, oauthStatus]);

    // Handle form submission
    const handleSubmit = useCallback(async () => {
      try {
        const values = await form.validateFields();
        setLoading(true);

        const requestData: UpsertToolsetRequest = {
          name: values.name,
          key: sourceData?.key,
          enabled: values.enabled,
        };

        if (selectedAuthType) {
          requestData.authType = selectedAuthType;
          requestData.provider = selectedAuthPattern?.provider;
          requestData.scope = selectedAuthPattern?.scope;

          // In update mode, only include authData fields that have values
          if (mode === 'update' && values.authData) {
            const filteredAuthData: Record<string, any> = {};
            for (const [key, value] of Object.entries(values.authData)) {
              if (value !== undefined && value !== null && value !== '') {
                filteredAuthData[key] = value;
              }
            }
            requestData.authData = filteredAuthData;
          } else {
            requestData.authData = values.authData || {};
          }
        }

        if (values.config) {
          requestData.config = values.config;
        }

        let response: any;
        if (mode === 'install') {
          response = await getClient().createToolset({ body: requestData });
        } else {
          requestData.toolsetId = toolInstance?.toolsetId;
          response = await getClient().updateToolset({ body: requestData });
        }

        if (!response.data.success) {
          message.error(t(`settings.toolStore.install.${mode}Error`));
          return;
        }

        refetchToolsOnUpdate();
        onSuccess?.();
        onCancel();
      } catch (error) {
        console.error('Form validation failed:', error);
      } finally {
        setLoading(false);
      }
    }, [
      form,
      mode,
      sourceData,
      selectedAuthType,
      toolInstance,
      onSuccess,
      onCancel,
      refetchToolsOnUpdate,
      refetchEnabledTools,
    ]);

    return (
      <Modal
        title={
          <div className="flex items-center gap-2 justify-between w-full">
            <div className="text-lg font-semibold text-refly-text-0 leading-6">
              {t(`settings.toolStore.install.${mode}Title`)}
            </div>
            <Button type="text" onClick={onCancel} icon={<Close size={24} />} />
          </div>
        }
        centered
        open={visible}
        onCancel={onCancel}
        footer={[
          <Button key="cancel" onClick={onCancel}>
            {t('common.cancel')}
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={loading}
            disabled={isSubmitDisabled}
            onClick={handleSubmit}
          >
            {t(`settings.toolStore.install.${mode}`)}
          </Button>,
        ]}
        width={600}
        closable={false}
      >
        <div className="max-h-[calc(80vh-100px)] overflow-y-auto tool-install-modal-content">
          <Form form={form} layout="vertical" className="space-y-4">
            {/* Name field */}
            <Form.Item
              label={t('settings.toolStore.install.name')}
              name="name"
              rules={[
                { required: true, message: t('settings.toolStore.install.namePlaceholder') },
                {
                  validator: async (_, value) => {
                    if (!value) return;

                    // Check if name already exists (excluding current tool in update mode)
                    const existingTool = toolInstances.find(
                      (tool) =>
                        tool.name === value &&
                        (mode === 'update' ? tool.toolsetId !== toolInstance?.toolsetId : true),
                    );

                    if (existingTool) {
                      throw new Error(t('settings.toolStore.install.nameDuplicate'));
                    }
                  },
                },
              ]}
            >
              <Input
                variant="filled"
                placeholder={t('settings.toolStore.install.namePlaceholder')}
              />
            </Form.Item>

            {/* Auth type selection */}
            {authPatterns.length > 0 && (
              <Form.Item
                label={t('settings.toolStore.install.authType')}
                name="authType"
                rules={[
                  { required: true, message: t('settings.toolStore.install.authTypePlaceholder') },
                ]}
              >
                <Radio.Group
                  onChange={(e) => handleAuthTypeChange(e.target.value)}
                  disabled={mode === 'update'}
                >
                  {authPatterns.map((pattern) => (
                    <Radio key={pattern.type} value={pattern.type}>
                      {pattern.type}
                    </Radio>
                  ))}
                </Radio.Group>
              </Form.Item>
            )}

            {/* OAuth status check */}
            {selectedAuthType && renderOAuthStatus()}

            {/* Credential fields */}
            {selectedAuthType && credentialItems.length > 0 && renderCredentialFields()}

            {/* Config fields */}
            {configItems.length > 0 && renderConfigFields()}

            {/* Enabled switch */}
            <Form.Item name="enabled" valuePropName="checked">
              <Switch
                checkedChildren={t('common.enable')}
                unCheckedChildren={t('common.disable')}
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    );
  },
);

ToolInstallModal.displayName = 'ToolInstallModal';
