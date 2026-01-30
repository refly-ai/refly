import { memo, useMemo } from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RemarkBreaks from 'remark-breaks';
import { apiDocsData } from '../data/api-docs.generated';
import { useApiKeys } from '../hooks/use-api-keys';
import { useSelectedApiKey } from '../hooks/use-selected-api-key';
import { CodeExample } from './code-example';
import { useGetWorkflowVariables } from '@refly-packages/ai-workspace-common/queries/queries';
import {
  buildRunRequestExample,
  buildMultipartFormExample,
  generateBestPracticesExamples,
  extractRequestBodyFields,
  extractSchemaFields,
  generateCodeExamples,
  generateExampleFromSchema,
  getApiBaseUrl,
} from '../utils';
import type { ApiEndpoint } from '../types';

interface ApiDocsTabProps {
  canvasId: string;
}

const MarkdownText = ({ content }: { content: string }) => (
  <ReactMarkdown className="api-docs-markdown" remarkPlugins={[RemarkBreaks, remarkGfm]}>
    {content}
  </ReactMarkdown>
);

const renderParameters = (endpoint: ApiEndpoint, t: (key: string) => string) => {
  if (!endpoint.parameters?.length) {
    return <div className="api-docs-empty">{t('integration.api.noParameters')}</div>;
  }

  return (
    <table className="api-docs-table">
      <thead>
        <tr>
          <th>{t('integration.api.paramName')}</th>
          <th>{t('integration.api.paramIn')}</th>
          <th>{t('integration.api.paramType')}</th>
          <th>{t('integration.api.paramRequired')}</th>
          <th>{t('integration.api.paramDescription')}</th>
        </tr>
      </thead>
      <tbody>
        {endpoint.parameters.map((param) => (
          <tr key={`${endpoint.id}-${param.name}-${param.in}`}>
            <td>
              <code>{param.name}</code>
            </td>
            <td>{param.in}</td>
            <td>{param.type}</td>
            <td>{param.required ? t('common.yes') : t('common.no')}</td>
            <td>{param.descriptionKey ? t(param.descriptionKey) : param.description || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const renderResponses = (endpoint: ApiEndpoint, t: (key: string) => string) => {
  const entries = Object.entries(endpoint.responses || {});
  if (!entries.length) {
    return <div className="api-docs-empty">{t('integration.api.noResponses')}</div>;
  }

  const responseFields = entries.map(([status, response]) => {
    const fields = extractSchemaFields(response.schema);
    if (!fields.length) return null;
    return (
      <div key={`${endpoint.id}-${status}-fields`} className="endpoint-subsection">
        <div className="endpoint-subsection-title">
          {`${t('integration.api.responseFieldsTitle')} (${status})`}
        </div>
        <table className="api-docs-table">
          <thead>
            <tr>
              <th>{t('integration.api.paramName')}</th>
              <th>{t('integration.api.paramType')}</th>
              <th>{t('integration.api.paramRequired')}</th>
              <th>{t('integration.api.paramDescription')}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={`${endpoint.id}-${status}-${field.name}`}>
                <td>
                  <code>{field.name}</code>
                </td>
                <td>{field.type}</td>
                <td>{field.required ? t('common.yes') : t('common.no')}</td>
                <td>{field.descriptionKey ? t(field.descriptionKey) : field.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  });

  return (
    <div className="api-response-list">
      <div className="endpoint-subsection">
        <div className="endpoint-subsection-title">{t('integration.api.responseStatusTitle')}</div>
        <table className="api-docs-table">
          <thead>
            <tr>
              <th>{t('integration.api.responseStatus')}</th>
              <th>{t('integration.api.responseDescription')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([status, response]) => (
              <tr key={`${endpoint.id}-${status}`}>
                <td>
                  <code>{status}</code>
                </td>
                <td>
                  {response.descriptionKey
                    ? t(response.descriptionKey)
                    : response.description || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {responseFields.some(Boolean) ? (
        responseFields
      ) : (
        <div className="endpoint-subsection">
          <div className="endpoint-subsection-title">
            {t('integration.api.responseFieldsTitle')}
          </div>
          <div className="api-docs-empty">{t('integration.api.noResponseFields')}</div>
        </div>
      )}

      {entries.map(([status, response]) => {
        const example = response.example ?? generateExampleFromSchema(response.schema);
        if (example === null || example === undefined) return null;
        const display = JSON.stringify(example, null, 2);
        return (
          <div key={`${endpoint.id}-${status}-example`} className="endpoint-subsection">
            <div className="endpoint-subsection-title">
              {`${t('integration.api.responseExample')} (${status})`}
            </div>
            <CodeExample language="json" code={display} />
          </div>
        );
      })}
    </div>
  );
};

const renderRequestBodyFields = (endpoint: ApiEndpoint, t: (key: string) => string) => {
  const fields = extractRequestBodyFields(endpoint.requestBody?.schema, {
    wildcard: {
      name: t('integration.api.requestBodyWildcardName'),
      type: t('integration.api.requestBodyWildcardType'),
      description: t('integration.api.requestBodyWildcardDescription'),
    },
  });

  if (!fields.length) {
    return <div className="api-docs-empty">{t('integration.api.noRequestBodyFields')}</div>;
  }

  return (
    <table className="api-docs-table">
      <thead>
        <tr>
          <th>{t('integration.api.paramName')}</th>
          <th>{t('integration.api.paramType')}</th>
          <th>{t('integration.api.paramRequired')}</th>
          <th>{t('integration.api.paramDescription')}</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr key={`${endpoint.id}-${field.name}`}>
            <td>
              <code>{field.name}</code>
            </td>
            <td>{field.type}</td>
            <td>{field.required ? t('common.yes') : t('common.no')}</td>
            <td>{field.descriptionKey ? t(field.descriptionKey) : field.description || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const ApiDocsTab = memo(({ canvasId }: ApiDocsTabProps) => {
  const { t, i18n } = useTranslation();
  const { apiKeys } = useApiKeys();
  const { selectedKey } = useSelectedApiKey(apiKeys);
  const { data: workflowVariablesResponse } = useGetWorkflowVariables(
    {
      query: { canvasId },
    },
    undefined,
    {
      enabled: !!canvasId,
    },
  );

  const baseUrl = useMemo(() => getApiBaseUrl(apiDocsData.baseUrl), []);
  const displayKey = selectedKey ? `${selectedKey.keyPrefix}****` : 'YOUR_API_KEY';
  const pathParams = useMemo(() => ({ canvasId }), [canvasId]);
  const bestPracticeExamples = useMemo(
    () =>
      generateBestPracticesExamples(baseUrl, canvasId, displayKey, {
        upload: t('integration.api.bestPracticesCommentUpload'),
        run: t('integration.api.bestPracticesCommentRun'),
        poll: t('integration.api.bestPracticesCommentPoll'),
        output: t('integration.api.bestPracticesCommentOutput'),
      }),
    [baseUrl, canvasId, displayKey, t],
  );
  const bestPracticeCopyExamples = useMemo(
    () =>
      generateBestPracticesExamples(baseUrl, canvasId, 'YOUR_API_KEY', {
        upload: t('integration.api.bestPracticesCommentUpload'),
        run: t('integration.api.bestPracticesCommentRun'),
        poll: t('integration.api.bestPracticesCommentPoll'),
        output: t('integration.api.bestPracticesCommentOutput'),
      }),
    [baseUrl, canvasId, t],
  );
  const workflowVariables = workflowVariablesResponse?.data ?? null;
  const runRequestExample = useMemo(() => {
    if (!workflowVariables) return null;
    return buildRunRequestExample(workflowVariables);
  }, [workflowVariables]);

  // Filter out internal endpoints and webhook endpoints, only show API endpoints
  const publicEndpoints = useMemo(
    () =>
      apiDocsData.endpoints.filter(
        (endpoint) => endpoint.path.startsWith('/openapi/') && !endpoint.path.includes('/webhook/'),
      ),
    [],
  );

  const resolveText = (fallback: string, i18nMap?: Record<string, string>) => {
    if (!i18nMap) return fallback;
    const locale = i18n.language;
    const normalized =
      locale.startsWith('zh') && i18nMap['zh-Hans'] ? 'zh-Hans' : locale.split('-')[0];
    return i18nMap[locale] ?? i18nMap[normalized] ?? fallback;
  };

  return (
    <div className="integration-docs-body">
      <div className="integration-docs-header">
        <h2>{t('integration.api.title')}</h2>
        <p>{t('integration.api.description')}</p>
      </div>

      <section id="api-overview" className="integration-docs-section">
        <h3 className="integration-docs-section-title">{t('integration.api.overviewTitle')}</h3>
        <div className="integration-docs-section-desc">
          <MarkdownText content={t('integration.api.overviewDescription')} />
        </div>
      </section>

      <section id="api-best-practices" className="integration-docs-section">
        <h3 className="integration-docs-section-title">
          {t('integration.api.bestPracticesTitle')}
        </h3>
        <div className="integration-docs-section-desc">
          <MarkdownText content={t('integration.api.bestPracticesDescription')} />
        </div>
        <div className="api-best-practices-examples">
          <h4 className="endpoint-section-title">
            {t('integration.api.bestPracticesExamplesTitle')}
          </h4>
          <Tabs
            items={[
              {
                key: 'curl',
                label: 'cURL',
                children: (
                  <CodeExample
                    language="bash"
                    code={bestPracticeExamples.curl}
                    copyText={bestPracticeCopyExamples.curl}
                  />
                ),
              },
              {
                key: 'python',
                label: 'Python',
                children: (
                  <CodeExample
                    language="python"
                    code={bestPracticeExamples.python}
                    copyText={bestPracticeCopyExamples.python}
                  />
                ),
              },
              {
                key: 'javascript',
                label: 'JavaScript',
                children: (
                  <CodeExample
                    language="javascript"
                    code={bestPracticeExamples.javascript}
                    copyText={bestPracticeCopyExamples.javascript}
                  />
                ),
              },
            ]}
          />
        </div>
      </section>

      <section id="api-endpoints" className="integration-docs-section">
        <h3 className="integration-docs-section-title">{t('integration.api.endpointsTitle')}</h3>
        <p className="integration-docs-section-desc">{t('integration.api.endpointsDescription')}</p>

        {publicEndpoints.map((endpoint) => {
          const endpointAnchorId = `api-endpoint-${endpoint.operationId || endpoint.id}`;
          const isRunEndpoint =
            endpoint.operationId === 'runWorkflowViaApi' ||
            endpoint.path === '/openapi/workflow/{canvasId}/run';
          const displayExamples = generateCodeExamples(endpoint, baseUrl, displayKey, pathParams);
          const copyExamples = generateCodeExamples(endpoint, baseUrl, 'YOUR_API_KEY', pathParams);
          const requestExample =
            (isRunEndpoint && runRequestExample) ||
            endpoint.requestBody?.example ||
            generateExampleFromSchema(endpoint.requestBody?.schema);
          const isMultipart = endpoint.requestBody?.contentType?.startsWith('multipart/');
          const requestDisplay = isMultipart
            ? buildMultipartFormExample(endpoint.requestBody?.schema)
            : requestExample !== null && requestExample !== undefined
              ? JSON.stringify(requestExample, null, 2)
              : '';
          const resolvedDisplayExamples = isRunEndpoint
            ? generateCodeExamples(endpoint, baseUrl, displayKey, pathParams, requestExample)
            : displayExamples;
          const resolvedCopyExamples = isRunEndpoint
            ? generateCodeExamples(endpoint, baseUrl, 'YOUR_API_KEY', pathParams, requestExample)
            : copyExamples;

          return (
            <article key={endpoint.id} id={endpointAnchorId} className="api-endpoint-card">
              <div className="endpoint-header">
                <span className={`endpoint-method ${endpoint.method.toLowerCase()}`}>
                  {endpoint.method}
                </span>
                <span className="endpoint-path">{endpoint.path}</span>
              </div>
              <div className="endpoint-body">
                <div className="endpoint-summary">
                  {endpoint.summaryKey ? t(endpoint.summaryKey) : endpoint.summary}
                </div>
                {(() => {
                  const text = endpoint.descriptionKey
                    ? t(endpoint.descriptionKey)
                    : endpoint.description;
                  return text ? (
                    <div className="endpoint-description">
                      <MarkdownText content={text} />
                    </div>
                  ) : null;
                })()}

                <div className="endpoint-section">
                  <h4 className="endpoint-section-title">{t('integration.api.parametersTitle')}</h4>
                  {renderParameters(endpoint, t)}
                </div>

                <div className="endpoint-section">
                  <h4 className="endpoint-section-title">
                    {t('integration.api.requestBodyTitle')}
                  </h4>
                  {endpoint.requestBody ? (
                    <>
                      {(() => {
                        const text = endpoint.requestBody.schema?.descriptionKey
                          ? t(endpoint.requestBody.schema.descriptionKey)
                          : endpoint.requestBody.schema?.description;
                        return text ? (
                          <div className="api-docs-section-desc">
                            <MarkdownText content={text} />
                          </div>
                        ) : null;
                      })()}
                      <div className="endpoint-subsection">
                        <h5 className="endpoint-subsection-title">
                          {t('integration.api.requestBodyFieldsTitle')}
                        </h5>
                        {renderRequestBodyFields(endpoint, t)}
                      </div>
                      <div className="endpoint-subsection">
                        <h5 className="endpoint-subsection-title">
                          {t('integration.api.requestBodyExampleTitle')}
                        </h5>
                        {requestDisplay ? (
                          <CodeExample
                            language={isMultipart ? 'text' : 'json'}
                            code={requestDisplay}
                          />
                        ) : (
                          <div className="api-docs-empty">{t('integration.api.noRequestBody')}</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="api-docs-empty">{t('integration.api.noRequestBody')}</div>
                  )}
                </div>

                <div className="endpoint-section">
                  <h4 className="endpoint-section-title">{t('integration.api.responsesTitle')}</h4>
                  {renderResponses(endpoint, t)}
                </div>

                <div className="endpoint-section">
                  <h4 className="endpoint-section-title">
                    {t('integration.api.codeExamplesTitle')}
                  </h4>
                  <Tabs
                    items={[
                      {
                        key: 'curl',
                        label: 'cURL',
                        children: (
                          <CodeExample
                            language="bash"
                            code={resolvedDisplayExamples.curl}
                            copyText={resolvedCopyExamples.curl}
                          />
                        ),
                      },
                      {
                        key: 'python',
                        label: 'Python',
                        children: (
                          <CodeExample
                            language="python"
                            code={resolvedDisplayExamples.python}
                            copyText={resolvedCopyExamples.python}
                          />
                        ),
                      },
                      {
                        key: 'javascript',
                        label: 'JavaScript',
                        children: (
                          <CodeExample
                            language="javascript"
                            code={resolvedDisplayExamples.javascript}
                            copyText={resolvedCopyExamples.javascript}
                          />
                        ),
                      },
                    ]}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section id="api-errors" className="integration-docs-section">
        <h3 className="integration-docs-section-title">{t('integration.api.errorsTitle')}</h3>
        <p className="integration-docs-section-desc">{t('integration.api.errorsDescription')}</p>
        <table className="api-docs-table">
          <thead>
            <tr>
              <th>{t('integration.api.errorCode')}</th>
              <th>{t('integration.api.errorStatus')}</th>
              <th>{t('integration.api.errorMessage')}</th>
              <th>{t('integration.api.errorDescription')}</th>
            </tr>
          </thead>
          <tbody>
            {apiDocsData.errorCodes.map((error) => (
              <tr key={error.code}>
                <td>
                  <code>{error.code}</code>
                </td>
                <td>{error.httpStatus ?? '-'}</td>
                <td>{resolveText(error.message, error.messageI18n)}</td>
                <td>{resolveText(error.description, error.descriptionI18n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
});

ApiDocsTab.displayName = 'ApiDocsTab';
