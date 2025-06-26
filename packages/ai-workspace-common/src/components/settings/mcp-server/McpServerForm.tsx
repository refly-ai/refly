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
import { McpServerType } from '@refly/openapi-schema';
import { McpServerFormProps, McpServerFormData } from './types';
import { McpServerJsonEditor } from './McpServerJsonEditor';
import {
  useCreateMcpServer,
  useUpdateMcpServer,
  useValidateMcpServer,
} from '@refly-packages/ai-workspace-common/queries';
import { mapServerType } from '@refly-packages/ai-workspace-common/components/settings/mcp-server/utils';

const { TabPane } = Tabs;
const { Option } = Select;

export const McpServerForm: React.FC<McpServerFormProps> = ({
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

  // Convert environment variables from object format to key-value pair array format for form usage
  const convertEnvObjectToArray = (envObj: Record<string, string> = {}) => {
    return Object.entries(envObj || {}).map(([key, value]) => ({ key, value }));
  };

  // Convert environment variables from key-value pair array format back to object format
  const convertEnvArrayToObject = (envArray: any[] = []) => {
    return (envArray || []).reduce(
      (acc, { key, value }) => {
        if (key) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, string>,
    );
  };

  // Create and update mutations
  const createMutation = useCreateMcpServer([], {
    onSuccess: (response, _variables, _context) => {
      if (!response?.data?.success) {
        // Use a more specific error message or re-throw the server's error message
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
        // Use a more specific error message or re-throw the server's error message
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

  // Validate server configuration
  const validateMutation = useValidateMcpServer([], {
    onSuccess: (response) => {
      if (!response?.data?.success) {
        throw response.data.errMsg;
      }

      // Server validation successful, returns true
      message.success(t('settings.mcpServer.validateSuccess'));

      setIsEnabled(true);
      const currentValues = form.getFieldsValue();
      form.setFieldsValue({ ...currentValues, enabled: true });

      // When updating internal state, ensure environment variables are in object format
      const updatedFormData = { ...formData, enabled: true };
      if (currentValues.env && Array.isArray(currentValues.env)) {
        updatedFormData.env = convertEnvArrayToObject(currentValues.env as any[]);
      }
      setFormData(updatedFormData);
    },
    onError: (error) => {
      message.error(t('settings.mcpServer.validateError'));
      console.error('Failed to validate MCP server:', error);
      setIsEnabled(false);
      const currentValues = form.getFieldsValue();
      if (currentValues.enabled) {
        form.setFieldsValue({ ...currentValues, enabled: false });
      }

      // When updating internal state, ensure environment variables are in object format
      const updatedFormData = { ...formData, enabled: false };
      if (currentValues.env && Array.isArray(currentValues.env)) {
        updatedFormData.env = convertEnvArrayToObject(currentValues.env as any[]);
      }
      setFormData(updatedFormData);
    },
  });

  // Initialize form with initial data
  useEffect(() => {
    if (initialData) {
      // Convert environment variables from object format to array format for form usage
      const envArray = convertEnvObjectToArray(initialData.env);

      const formValues: McpServerFormData = {
        name: initialData.name,
        type: initialData.type,
        url: initialData.url,
        command: initialData.command,
        args: initialData.args || [],
        env: initialData.env || {}, // Keep original format for internal state
        headers: initialData.headers || {},
        reconnect: initialData.reconnect || { enabled: false },
        config: initialData.config || {},
        enabled: initialData.enabled,
      };

      // Set form values, but use array format for environment variables
      const formFieldValues = {
        ...formValues,
      };
      // Use type assertion to resolve type issues
      (formFieldValues as any).env = envArray;

      form.setFieldsValue(formFieldValues);

      setFormData(formValues);
      setServerType(initialData.type);
    } else {
      form.setFieldsValue({
        enabled: false,
        type: 'sse',
      });
    }
  }, [initialData, form]);

  // Handle form changes to update JSON editor
  const handleFormValuesChange = () => {
    const values = form.getFieldsValue();

    // Create a new object for setting form data
    const formDataValues = { ...values };

    // If there are environment variables in array format, convert them to object format
    if (values.env && Array.isArray(values.env)) {
      formDataValues.env = convertEnvArrayToObject(values.env);
    }

    setFormData(formDataValues);
  };

  // Convert Refly format to universal format
  const convertToUniversalFormat = (server: McpServerFormData): any => {
    const mcpServers: Record<string, any> = {};

    // Ensure environment variables are in object format
    let envData = server.env || {};
    if (Array.isArray(envData)) {
      envData = convertEnvArrayToObject(envData as any[]);
    }

    // Filter out empty arguments
    const filteredArgs = (server.args || []).filter((arg) => arg !== '');

    // Filter out empty environment variables
    const filteredEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(envData)) {
      if (key && value !== undefined && value !== null && value !== '') {
        filteredEnv[key] = value;
      }
    }

    // Process headers for JSON mode
    let headersData = server.headers ?? {};
    if (Array.isArray(headersData)) {
      headersData = headersData.reduce(
        (acc, item) => {
          // biome-ignore lint/complexity/useOptionalChain: <explanation>
          if (item && item.key) {
            acc[item.key] = item.value ?? '';
          }
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    mcpServers[server.name] = {
      type: server.type,
      description: server.config?.description ?? '',
      url: server.url ?? '',
      command: server.command ?? '',
      args: filteredArgs,
      env: filteredEnv,
      headers: headersData,
    };

    return { mcpServers };
  };

  // Convert universal format to Refly format
  const convertToReflyFormat = (data: any): McpServerFormData => {
    // If data is already in McpServerFormData format, return directly
    if (!data.mcpServers && typeof data === 'object') {
      return data as McpServerFormData;
    }

    // If data has mcpServers property, it's in universal format
    if (data?.mcpServers && typeof data.mcpServers === 'object') {
      // Only take the first server, as the form can only edit one server
      const entries = Object.entries(data.mcpServers);
      if (entries.length > 0) {
        const [name, serverConfig] = entries[0] as [string, any];

        // Map universal format fields to Refly format
        const server: McpServerFormData = {
          name: name,
          type: mapServerType(serverConfig.type, serverConfig),
          url: serverConfig.url ?? '',
          command: serverConfig.command ?? '',
          args: serverConfig.args ?? [],
          env: serverConfig.env ?? {},
          headers: serverConfig.headers ?? {},
          reconnect: { enabled: false },
          config: {},
        };

        // If there's a description, add it to config
        if (serverConfig.description) {
          server.config = { ...server.config, description: serverConfig.description };
        }

        return server;
      }
    }

    // If conversion fails, return original data
    return formData;
  };

  // Handle JSON editor changes
  const handleJsonChange = (newData: any) => {
    // Convert universal format to Refly format
    const reflyData = convertToReflyFormat(newData);
    setFormData(reflyData);

    // If there are environment variables in object format, convert them to array format for form usage
    const formValues = { ...reflyData };
    if (formValues.env && typeof formValues.env === 'object' && !Array.isArray(formValues.env)) {
      // Use type assertion to resolve type issues
      (formValues as any).env = convertEnvObjectToArray(formValues.env as Record<string, string>);
    }

    // Convert headers from object format to array format for form usage
    if (
      formValues.headers &&
      typeof formValues.headers === 'object' &&
      !Array.isArray(formValues.headers)
    ) {
      (formValues as any).headers = Object.entries(formValues.headers).map(([key, value]) => ({
        key,
        value,
      }));
    }

    form.setFieldsValue(formValues);
  };

  // Handle server type change
  const handleTypeChange = (value: McpServerType) => {
    setServerType(value);
  };

  // Handle form submission
  const handleFinish = (values: McpServerFormData) => {
    // Create a new object for submission
    const submitValues = { ...values };

    // Ensure the enabled value in the form matches the isEnabled state
    submitValues.enabled = isEnabled;

    // Convert environment variables from array format to object format required by API
    if (submitValues.env && Array.isArray(submitValues.env)) {
      // Use type assertion to resolve type issues
      submitValues.env = convertEnvArrayToObject(submitValues.env as any[]) as Record<
        string,
        string
      >;
    }

    // Convert headers from array format to object format required by API
    if (submitValues.headers && Array.isArray(submitValues.headers)) {
      // Similar to env variables, convert headers to object format
      submitValues.headers = (submitValues.headers as any[]).reduce(
        (acc, { key, value }) => {
          if (key) {
            acc[key] = value || '';
          }
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    // If server is enabled but not validated, automatically validate
    if (isEnabled) {
      message.info(t('settings.mcpServer.validatingBeforeEnable'));
      // Auto validate
      validateMutation.mutate({ body: submitValues });
      return;
    }

    // Prepare data for API
    const apiData = {
      ...submitValues,
      args: submitValues.args || [],
      env: submitValues.env || {},
      headers: submitValues.headers || {},
      reconnect: submitValues.reconnect || {},
      config: submitValues.config || {},
    };

    // Call create or update API
    if (initialData) {
      updateMutation.mutate({ body: apiData });
    } else {
      createMutation.mutate({ body: apiData });
    }
  };

  // Handle enabled status change
  const handleEnabledChange = async (checked: boolean) => {
    if (checked) {
      validateMutation.mutate({ body: form.getFieldsValue() });
    } else {
      // When disabling, no validation needed, directly update state
      setIsEnabled(false);
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
                                  form.getFieldValue(['env']) &&
                                  Array.isArray(form.getFieldValue(['env'])) &&
                                  form.getFieldValue(['env'])[field.name] &&
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
                <Typography.Text>
                  {t('settings.mcpServer.enabled')}
                  <Tooltip title={t('settings.mcpServer.enabledTooltip')}>
                    <QuestionCircleOutlined style={{ marginLeft: 8 }} />
                  </Tooltip>
                </Typography.Text>
                <Form.Item noStyle>
                  <Switch checked={isEnabled} onChange={handleEnabledChange} />
                </Form.Item>
              </div>
              {!validateMutation.data && !initialData?.enabled && (
                <Typography.Text type="secondary" className="block mt-2">
                  {t('settings.mcpServer.autoValidateHint')}
                </Typography.Text>
              )}
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
                  {initialData ? t('common.update') : t('common.create')}
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
                {initialData ? t('common.update') : t('common.create')}
              </Button>
              <Button onClick={onCancel}>{t('common.cancel')}</Button>
            </Space>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
};
