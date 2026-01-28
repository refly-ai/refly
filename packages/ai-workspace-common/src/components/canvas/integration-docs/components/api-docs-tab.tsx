import { memo, useMemo } from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { apiDocsData } from '../data/api-docs.generated';
import { useApiKeys } from '../hooks/use-api-keys';
import { useSelectedApiKey } from '../hooks/use-selected-api-key';
import { CodeExample } from './code-example';
import { generateCodeExamples, generateExampleFromSchema, getApiBaseUrl } from '../utils';
import type { ApiEndpoint } from '../types';

interface ApiDocsTabProps {
  canvasId: string;
}

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
            <td>{param.description || '-'}</td>
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

  return (
    <div className="api-response-list">
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
              <td>{response.description || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {entries.map(([status, response]) => {
        const example = response.example ?? generateExampleFromSchema(response.schema);
        if (example === null || example === undefined) return null;
        const display = JSON.stringify(example, null, 2);
        return (
          <div key={`${endpoint.id}-${status}-example`} className="api-response-example">
            <div className="api-response-title">
              {`${t('integration.api.responseExample')} (${status})`}
            </div>
            <CodeExample language="json" code={display} />
          </div>
        );
      })}
    </div>
  );
};

export const ApiDocsTab = memo(({ canvasId }: ApiDocsTabProps) => {
  const { t } = useTranslation();
  const { apiKeys } = useApiKeys();
  const { selectedKey } = useSelectedApiKey(apiKeys);

  const baseUrl = useMemo(() => getApiBaseUrl(apiDocsData.baseUrl), []);
  const displayKey = selectedKey ? `${selectedKey.keyPrefix}****` : 'YOUR_API_KEY';
  const pathParams = useMemo(() => ({ canvasId }), [canvasId]);

  // Filter out internal endpoints and webhook endpoints, only show API endpoints
  const publicEndpoints = useMemo(
    () =>
      apiDocsData.endpoints.filter(
        (endpoint) => endpoint.path.startsWith('/openapi/') && !endpoint.path.includes('/webhook/'),
      ),
    [],
  );

  return (
    <div className="integration-docs-body">
      <div className="integration-docs-header">
        <h2>{t('integration.api.title')}</h2>
        <p>{t('integration.api.description')}</p>
      </div>

      <section id="api-overview" className="integration-docs-section">
        <h3 className="integration-docs-section-title">{t('integration.api.overviewTitle')}</h3>
        <p className="integration-docs-section-desc">{t('integration.api.overviewDescription')}</p>
      </section>

      <section id="api-endpoints" className="integration-docs-section">
        <h3 className="integration-docs-section-title">{t('integration.api.endpointsTitle')}</h3>
        <p className="integration-docs-section-desc">{t('integration.api.endpointsDescription')}</p>

        {publicEndpoints.map((endpoint) => {
          const displayExamples = generateCodeExamples(endpoint, baseUrl, displayKey, pathParams);
          const copyExamples = generateCodeExamples(endpoint, baseUrl, 'YOUR_API_KEY', pathParams);
          const requestExample =
            endpoint.requestBody?.example ??
            generateExampleFromSchema(endpoint.requestBody?.schema);
          const requestDisplay =
            requestExample !== null && requestExample !== undefined
              ? JSON.stringify(requestExample, null, 2)
              : '';

          return (
            <article key={endpoint.id} className="api-endpoint-card">
              <div className="endpoint-header">
                <span className={`endpoint-method ${endpoint.method.toLowerCase()}`}>
                  {endpoint.method}
                </span>
                <span className="endpoint-path">{endpoint.path}</span>
              </div>
              <div className="endpoint-body">
                <div className="endpoint-summary">{endpoint.summary}</div>
                {endpoint.description ? (
                  <div className="endpoint-description">{endpoint.description}</div>
                ) : null}

                <div className="endpoint-section">
                  <h4>{t('integration.api.parametersTitle')}</h4>
                  {renderParameters(endpoint, t)}
                </div>

                <div className="endpoint-section">
                  <h4>{t('integration.api.requestBodyTitle')}</h4>
                  {endpoint.requestBody ? (
                    requestDisplay ? (
                      <CodeExample language="json" code={requestDisplay} />
                    ) : (
                      <div className="api-docs-empty">{t('integration.api.noRequestBody')}</div>
                    )
                  ) : (
                    <div className="api-docs-empty">{t('integration.api.noRequestBody')}</div>
                  )}
                </div>

                <div className="endpoint-section">
                  <h4>{t('integration.api.responsesTitle')}</h4>
                  {renderResponses(endpoint, t)}
                </div>

                <div className="endpoint-section">
                  <h4>{t('integration.api.codeExamplesTitle')}</h4>
                  <Tabs
                    items={[
                      {
                        key: 'curl',
                        label: 'cURL',
                        children: (
                          <CodeExample
                            language="bash"
                            code={displayExamples.curl}
                            copyText={copyExamples.curl}
                          />
                        ),
                      },
                      {
                        key: 'python',
                        label: 'Python',
                        children: (
                          <CodeExample
                            language="python"
                            code={displayExamples.python}
                            copyText={copyExamples.python}
                          />
                        ),
                      },
                      {
                        key: 'javascript',
                        label: 'JavaScript',
                        children: (
                          <CodeExample
                            language="javascript"
                            code={displayExamples.javascript}
                            copyText={copyExamples.javascript}
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
                <td>{error.httpStatus}</td>
                <td>{error.message}</td>
                <td>{error.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
});

ApiDocsTab.displayName = 'ApiDocsTab';
