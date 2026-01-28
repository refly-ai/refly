import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
  Tabs,
  Divider,
  message,
  InputNumber,
  Tooltip,
  Card,
  Typography,
  Collapse,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  CodeOutlined,
  FormOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  CaretRightOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { McpServerType, UpsertMcpServerRequest } from '@refly/openapi-schema';
import { McpServerFormProps, McpServerFormData } from './types';
import { McpServerJsonEditor } from './McpServerJsonEditor';
import {
  useCreateMcpServer,
  useUpdateMcpServer,
  useValidateMcpServer,
} from '@refly-packages/ai-workspace-common/queries';
import { mapServerType } from './utils';

const { TabPane } = Tabs;
const { Option } = Select;

// Type definitions for better type safety
interface KeyValuePair {
  key: string;
  value: string;
}

export const McpServerForm: React.FC<McpServerFormProps> = ({
  formMode,
  initialData,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<McpServerFormData>();
  const [activeTab, setActiveTab] = useState<string>('form');
  const [formData, setFormData] = useState<McpServerFormData>({
    name: '',
    type: 'sse',
    enabled: false,
  });
  const [isEnabled, setIsEnabled] = useState<boolean>(initialData?.enabled || false);

  const [serverType, setServerType] = useState<McpServerType>(initialData?.type || 'sse');

  // ✅ Unified utility functions for key-value pair conversions
  const convertObjectToKeyValueArray = (obj: Record<string, string> = {}): KeyValuePair[] => {
    return Object.entries(obj || {}).map(([key, value]) => ({ key, value }));
  };

  const convertKeyValueArrayToObject = (array: KeyValuePair[] = []): Record<string, string> => {
    return (array || []).reduce(
      (acc, { key, value }) => {
        // Only add entries where key exists and is not empty
        if (key && key.trim() !== '') {
          // Preserve empty string values as they might be intentional
          acc[key] = value || '';
        }
        return acc;
      },
      {} as Record<string, string>,
    );
  };

  // ✅ Enhanced data validation functions
  const isValidMcpServerFormData = (data: any): data is McpServerFormData => {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.name === 'string' &&
      ['sse', 'streamable', 'stdio'].includes(data.type)
    );
  };

  const isUniversalFormat = (data: any): boolean => {
    return (
      data && typeof data === 'object' && data.mcpServers && typeof data.mcpServers === 'object'
    );
  };

  // Create and update mutations
  const createMutation = useCreateMcpServer([], {
    onSuccess: (response, _variables, _context) => {
      if (!response?.data?.success) {
        throw new Error(response?.data?.errMsg || 'Server creation reported failure in onSuccess');
      }
      message.success(t('settings.mcpServer.createSuccess'));
      onSubmit(form.getFieldsValue());
    },
    onError: (error) => {
      message.error(t('settings.mcpServer.createError'));
      console.error('Failed to create MCP server:', error);
    },
  });

  const updateMutation = useUpdateMcpServer([], {
    onSuccess: (response, _variables, _context) => {
      if (!response?.data?.success) {
        throw new Error(response?.data?.errMsg || 'Server update reported failure in onSuccess');
      }
      message.success(t('settings.mcpServer.updateSuccess'));
      onSubmit(form.getFieldsValue());
    },
    onError: (error) => {
      message.error(t('settings.mcpServer.updateError'));
      console.error('Failed to update MCP server:', error);
    },
  });

  // ✅ Enhanced validate server configuration
  const validateMutation = useValidateMcpServer([], {
    onSuccess: (response) => {
      if (!response?.data?.success) {
        throw response.data.errMsg;
      }

      message.success(t('settings.mcpServer.validateSuccess'));
      setIsEnabled(true);

      // After successful validation, trigger the actual save operation
      const currentValues = form.getFieldsValue();
      const processedValues = processFormDataForSubmission({ ...currentValues, enabled: true });

      if (formMode === 'edit') {
        updateMutation.mutate({ body: buildUpdatePayload(processedValues) });
      } else {
        createMutation.mutate({ body: processedValues });
      }
    },
    onError: (error) => {
      message.error(t('settings.mcpServer.validateError'));
      console.error('Failed to validate MCP server:', error);
      setIsEnabled(false);

      // Update form and internal state
      const currentValues = form.getFieldsValue();
      form.setFieldsValue({ ...currentValues, enabled: false });
      updateInternalFormData({ ...currentValues, enabled: false });
    },
  });

  // ✅ Process form data for submission (unified processing)
  const processFormDataForSubmission = (values: any): McpServerFormData => {
    const submitValues = { ...values };

    // Convert environment variables from array format to object format
    if (submitValues.env && Array.isArray(submitValues.env)) {
      submitValues.env = convertKeyValueArrayToObject(submitValues.env);
    }

    // Convert headers from array format to object format
    if (submitValues.headers && Array.isArray(submitValues.headers)) {
      submitValues.headers = convertKeyValueArrayToObject(submitValues.headers);
    }

    return {
      ...submitValues,
      args: submitValues.args || [],
      env: submitValues.env || {},
      headers: submitValues.headers || {},
      reconnect: submitValues.reconnect || { enabled: false },
      config: submitValues.config || {},
    };
  };

  const buildUpdatePayload = (values: McpServerFormData): UpsertMcpServerRequest => {
    const originalName = initialData?.name ?? values.name;
    return {
      ...values,
      originalName,
    };
  };

  // ✅ Update internal form data state (unified update)
  const updateInternalFormData = (values: any) => {
    const updatedFormData = { ...values };

    // Ensure env is in object format for internal state
    if (updatedFormData.env && Array.isArray(updatedFormData.env)) {
      updatedFormData.env = convertKeyValueArrayToObject(updatedFormData.env);
    }

    // Ensure headers is in object format for internal state
    if (updatedFormData.headers && Array.isArray(updatedFormData.headers)) {
      updatedFormData.headers = convertKeyValueArrayToObject(updatedFormData.headers);
    }

    setFormData(updatedFormData);
  };

  // Initialize form with initial data
  useEffect(() => {
    if (initialData) {
      // Convert both env and headers to array format for form usage
      const envArray = convertObjectToKeyValueArray(initialData.env);
      const headersArray = convertObjectToKeyValueArray(initialData.headers);

      const formValues: McpServerFormData = {
        name: initialData.name,
        type: initialData.type,
        url: initialData.url,
        command: initialData.command,
        args: initialData.args || [],
        env: initialData.env || {},
        headers: initialData.headers || {},
        reconnect: initialData.reconnect || { enabled: false },
        config: initialData.config || {},
        enabled: initialData.enabled,
      };

      // ✅ Set form values with array format for both env and headers
      const formFieldValues = {
        ...formValues,
        env: envArray as any, // Form expects array format
        headers: headersArray as any, // Form expects array format
      };

      form.setFieldsValue(formFieldValues);
      setFormData(formValues); // Keep object format for internal state
      setServerType(initialData.type);
    } else {
      form.setFieldsValue({
        enabled: false,
        type: 'sse',
      });
    }
  }, [initialData, form]);

  // ✅ Enhanced form values change handler
  const handleFormValuesChange = () => {
    const values = form.getFieldsValue();
    updateInternalFormData(values);
  };

  // ✅ Enhanced convert Refly format to universal format
  const convertToUniversalFormat = (server: McpServerFormData): any => {
    const mcpServers: Record<string, any> = {};

    // Ensure environment variables are in object format
    let envData = server.env || {};
    if (Array.isArray(envData)) {
      envData = convertKeyValueArrayToObject(envData);
    }

    // Ensure headers are in object format
    let headersData = server.headers || {};
    if (Array.isArray(headersData)) {
      headersData = convertKeyValueArrayToObject(headersData);
    }

    // ✅ Only filter out completely empty arguments (not just empty strings)
    const filteredArgs = (server.args || []).filter((arg) => arg !== undefined && arg !== null);

    // ✅ Preserve empty string values but filter out null/undefined
    const filteredEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(envData)) {
      if (key && key.trim() !== '') {
        filteredEnv[key] = value || '';
      }
    }

    // ✅ Apply same filtering logic to headers
    const filteredHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headersData)) {
      if (key && key.trim() !== '') {
        filteredHeaders[key] = value || '';
      }
    }

    mcpServers[server.name] = {
      type: server.type,
      description: server.config?.description ?? '',
      url: server.url ?? '',
      command: server.command ?? '',
      args: filteredArgs,
      env: filteredEnv,
      headers: filteredHeaders,
      // ✅ Add reconnect configuration to universal format
      reconnect: server.reconnect || { enabled: false },
    };

    return { mcpServers };
  };

  // ✅ Fixed convert universal format to Refly format
  const convertToReflyFormat = (data: any): McpServerFormData => {
    // Check if data is in universal format
    if (isUniversalFormat(data)) {
      const entries = Object.entries(data.mcpServers);
      if (entries.length > 0) {
        const [name, serverConfig] = entries[0] as [string, any];

        const server: McpServerFormData = {
          name: name,
          type: mapServerType(serverConfig.type, serverConfig),
          url: serverConfig.url ?? '',
          command: serverConfig.command ?? '',
          args: serverConfig.args ?? [],
          env: serverConfig.env ?? {},
          headers: serverConfig.headers ?? {},
          // ✅ Properly handle reconnect configuration from universal format
          reconnect: serverConfig.reconnect || { enabled: false },
          config: {},
        };

        if (serverConfig.description) {
          server.config = { ...server.config, description: serverConfig.description };
        }

        return server;
      }
    }

    // ✅ Check if data is already in valid McpServerFormData format
    if (isValidMcpServerFormData(data)) {
      return data;
    }

    // ✅ If conversion fails, return current formData as fallback
    return formData;
  };

  // ✅ Enhanced JSON editor change handler
  const handleJsonChange = (newData: any) => {
    const reflyData = convertToReflyFormat(newData);
    setFormData(reflyData);

    // Convert object formats to array formats for form display
    const formValues: any = { ...reflyData };

    if (formValues.env && typeof formValues.env === 'object' && !Array.isArray(formValues.env)) {
      formValues.env = convertObjectToKeyValueArray(formValues.env);
    }

    if (
      formValues.headers &&
      typeof formValues.headers === 'object' &&
      !Array.isArray(formValues.headers)
    ) {
      formValues.headers = convertObjectToKeyValueArray(formValues.headers);
    }

    form.setFieldsValue(formValues);
  };

  // Handle server type change
  const handleTypeChange = (value: McpServerType) => {
    setServerType(value);
  };

  // ✅ Enhanced form submission handler
  const handleFinish = (values: McpServerFormData) => {
    const submitValues = processFormDataForSubmission(values);
    submitValues.enabled = isEnabled;

    // ✅ Fixed validation flow - don't interrupt save if already validated
    if (isEnabled && !validateMutation.data?.data?.success) {
      message.info(t('settings.mcpServer.validatingBeforeEnable'));
      validateMutation.mutate({ body: submitValues });
      return;
    }

    // Proceed with save operation
    if (formMode === 'edit') {
      updateMutation.mutate({ body: buildUpdatePayload(submitValues) });
    } else {
      createMutation.mutate({ body: submitValues });
    }
  };

  return (
    <div className="mcp-server-form">
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <span>
              <FormOutlined /> {t('settings.mcpServer.formMode')}
            </span>
          }
          key="form"
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            onValuesChange={handleFormValuesChange}
            initialValues={{
              enabled: false,
              type: 'sse',
            }}
          >
            {/* Basic Information */}
            <Form.Item
              name="name"
              label={t('settings.mcpServer.name')}
              rules={[{ required: true, message: t('settings.mcpServer.nameRequired') }]}
            >
              <Input placeholder={t('settings.mcpServer.namePlaceholder')} />
            </Form.Item>

            <Form.Item
              name="type"
              label={
                <>
                  {t('settings.mcpServer.type')}
                  <Tooltip title={t('settings.mcpServer.stdioWebDisabledTooltip')}>
                    <InfoCircleOutlined style={{ marginLeft: 8 }} />
                  </Tooltip>
                </>
              }
              rules={[{ required: true, message: t('settings.mcpServer.typeRequired') }]}
            >
              <Select onChange={handleTypeChange}>
                <Option value="sse">{t('settings.mcpServer.typeSSE')} (SSE)</Option>
                <Option value="streamable">
                  {t('settings.mcpServer.typeStreamable')} (Streamable)
                </Option>
                <Option value="stdio" disabled>
                  {t('settings.mcpServer.typeStdio')} (Stdio)
                </Option>
              </Select>
            </Form.Item>

            {/* URL for SSE and Streamable types */}
            {(serverType === 'sse' || serverType === 'streamable') && (
              <Form.Item
                name="url"
                label={t('settings.mcpServer.url')}
                rules={[{ required: true, message: t('settings.mcpServer.urlRequired') }]}
              >
                <Input placeholder={t('settings.mcpServer.urlPlaceholder')} />
              </Form.Item>
            )}

            {/* Command and Args for Stdio type */}
            {serverType === 'stdio' && (
              <>
                <Form.Item
                  name="command"
                  label={t('settings.mcpServer.command')}
                  rules={[{ required: true, message: t('settings.mcpServer.commandRequired') }]}
                >
                  <Input placeholder={t('settings.mcpServer.commandPlaceholder')} />
                </Form.Item>

                <Card
                  title={
                    <Space>
                      {t('settings.mcpServer.args')}
                      <Tooltip title={t('settings.mcpServer.argsTooltip')}>
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  size="small"
                  className="mb-4"
                >
                  <Form.List name="args">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map((field) => (
                          <Form.Item key={field.key} style={{ marginBottom: 8 }}>
                            <div className="flex items-center">
                              <Form.Item {...field} noStyle>
                                <Input
                                  placeholder={t('settings.mcpServer.argPlaceholder')}
                                  style={{ width: 'calc(100% - 32px)' }}
                                />
                              </Form.Item>
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => remove(field.name)}
                                style={{ marginLeft: 8 }}
                              />
                            </div>
                          </Form.Item>
                        ))}
                        <Form.Item>
                          <Button
                            type="dashed"
                            onClick={() => add('')}
                            icon={<PlusOutlined />}
                            block
                          >
                            {t('settings.mcpServer.addArg')}
                          </Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </Card>
              </>
            )}

            {/* Headers for SSE and Streamable types */}
            {(serverType === 'sse' || serverType === 'streamable') && (
              <>
                <Divider orientation="left">{t('settings.mcpServer.headers')}</Divider>
                <Form.List name="headers">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map((field) => (
                        <Form.Item key={field.key}>
                          <div className="flex items-center w-full">
                            <Form.Item name={[field.name, 'key']} noStyle>
                              <Input
                                placeholder={t('settings.mcpServer.headerKey')}
                                style={{ width: '40%', marginRight: 8 }}
                              />
                            </Form.Item>
                            <Form.Item name={[field.name, 'value']} noStyle>
                              <Input
                                placeholder={t('settings.mcpServer.headerValue')}
                                style={{ width: 'calc(60% - 40px)' }}
                              />
                            </Form.Item>
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(field.name)}
                              style={{ marginLeft: 8 }}
                            />
                          </div>
                        </Form.Item>
                      ))}
                      <Form.Item>
                        <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                          {t('settings.mcpServer.addHeader')}
                        </Button>
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </>
            )}

            {/* Environment Variables for Stdio type */}
            {serverType === 'stdio' && (
              <Card
                title={
                  <Space>
                    {t('settings.mcpServer.env')}
                    <Tooltip title={t('settings.mcpServer.envTooltip')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                size="small"
                className="mb-4"
              >
                <Form.List name="env">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map((field) => (
                        <Form.Item key={field.key} style={{ marginBottom: 12 }}>
                          <div className="flex items-center">
                            <Form.Item
                              name={[field.name, 'key']}
                              noStyle
                              rules={[
                                {
                                  required: true,
                                  message: t('settings.mcpServer.envKeyRequired'),
                                },
                              ]}
                            >
                              <Input
                                placeholder={t('settings.mcpServer.envKey')}
                                style={{ width: '40%', marginRight: 8 }}
                              />
                            </Form.Item>
                            <Form.Item
                              name={[field.name, 'value']}
                              noStyle
                              rules={[
                                {
                                  required: true,
                                  message: t('settings.mcpServer.envValueRequired'),
                                },
                              ]}
                            >
                              <Input
                                placeholder={t('settings.mcpServer.envValue')}
                                style={{ width: 'calc(60% - 40px)' }}
                                type={
                                  // Check if the key contains sensitive information
                                  field.name !== undefined &&
                                  form.getFieldValue(['env'])?.[field.name]?.key &&
                                  (form
                                    .getFieldValue(['env'])
                                    [field.name].key.toLowerCase()
                                    .includes('token') ||
                                    form
                                      .getFieldValue(['env'])
                                      [field.name].key.toLowerCase()
                                      .includes('key') ||
                                    form
                                      .getFieldValue(['env'])
                                      [field.name].key.toLowerCase()
                                      .includes('secret') ||
                                    form
                                      .getFieldValue(['env'])
                                      [field.name].key.toLowerCase()
                                      .includes('password') ||
                                    form
                                      .getFieldValue(['env'])
                                      [field.name].key.toLowerCase()
                                      .includes('auth'))
                                    ? 'password'
                                    : 'text'
                                }
                              />
                            </Form.Item>
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(field.name)}
                              style={{ marginLeft: 8 }}
                            />
                          </div>
                        </Form.Item>
                      ))}
                      <Form.Item>
                        <Button
                          type="dashed"
                          onClick={() => add({ key: '', value: '' })}
                          icon={<PlusOutlined />}
                          block
                        >
                          {t('settings.mcpServer.addEnv')}
                        </Button>
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </Card>
            )}

            {/* Reconnect Configuration */}
            <Collapse
              className="mb-4"
              bordered={false}
              expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
              items={[
                {
                  key: 'reconnect',
                  label: (
                    <Space>
                      {t('settings.mcpServer.reconnect')}
                      <Tooltip title={t('settings.mcpServer.reconnectTooltip')}>
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  ),
                  children: (
                    <div className="pl-4 pr-4 pb-2">
                      <Form.Item name={['reconnect', 'enabled']} valuePropName="checked">
                        <Switch />
                      </Form.Item>

                      <Form.Item
                        name={['reconnect', 'maxAttempts']}
                        label={t('settings.mcpServer.maxAttempts')}
                      >
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>

                      <Form.Item
                        name={['reconnect', 'delayMs']}
                        label={t('settings.mcpServer.delayMs')}
                      >
                        <InputNumber min={0} step={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </div>
                  ),
                },
              ]}
            />

            {/* Enabled Switch */}
            <Card title={t('settings.mcpServer.status')} size="small" className="mb-4">
              <div className="flex items-center justify-between">
                <Typography.Text>{t('settings.mcpServer.enabled')}</Typography.Text>
                <Form.Item noStyle>
                  <Switch checked={isEnabled} />
                </Form.Item>
              </div>
            </Card>

            {/* Form Actions */}
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    validateMutation.isPending
                  }
                >
                  {formMode === 'create' ? t('common.create') : t('common.update')}
                </Button>
                <Button onClick={onCancel}>{t('common.cancel')}</Button>
              </Space>
            </Form.Item>
          </Form>
        </TabPane>
        <TabPane
          tab={
            <span>
              <CodeOutlined /> {t('settings.mcpServer.jsonMode')}
            </span>
          }
          key="json"
        >
          <Alert
            message={t('settings.mcpServer.jsonModeStdioWarning')}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <McpServerJsonEditor
            value={convertToUniversalFormat(formData)}
            onChange={handleJsonChange}
          />
          <div className="mt-4">
            <Space>
              <Button
                type="primary"
                onClick={() => form.submit()}
                loading={
                  createMutation.isPending || updateMutation.isPending || validateMutation.isPending
                }
              >
                {formMode === 'edit' ? t('common.update') : t('common.create')}
              </Button>
              <Button onClick={onCancel}>{t('common.cancel')}</Button>
            </Space>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
};
