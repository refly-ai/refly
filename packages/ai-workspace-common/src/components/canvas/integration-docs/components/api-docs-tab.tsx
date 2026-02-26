import { memo, useMemo } from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RemarkBreaks from 'remark-breaks';
import { apiDocsData } from '../data/api-docs.generated';
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
  groupApiEndpoints,
} from '../utils';
import type { ApiEndpoint } from '../types';

interface ApiDocsTabProps {
  canvasId: string;
}

const tableClassName =
  'w-full border-collapse my-4 text-sm rounded-lg overflow-hidden border border-[var(--integration-docs-border,rgba(0,0,0,0.12))] bg-[var(--integration-docs-bg)] [&_tr:last-child_td]:border-b-0';
const tableHeaderCellClassName =
  'text-left px-3 py-2.5 border-b border-r border-[var(--integration-docs-border,rgba(0,0,0,0.12))] bg-[var(--integration-docs-bg-subtle)] font-medium text-refly-text-0 last:border-r-0';
const tableCellClassName =
  'text-left px-3 py-2.5 border-b border-r border-[var(--integration-docs-border,rgba(0,0,0,0.12))] text-refly-text-1 last:border-r-0';
const inlineCodeClassName =
  'bg-[var(--integration-docs-inline-code-bg)] px-1.5 py-0.5 rounded text-[13px] text-[var(--integration-docs-inline-code-text)]';
const emptyStateClassName = 'text-[13px] text-[var(--integration-docs-text-3)] py-1.5';
const sectionDescClassName = 'mt-2 mb-4 text-sm text-refly-text-1 leading-relaxed';

const MarkdownText = ({ content }: { content: string }) => (
  <ReactMarkdown
    className="text-sm text-refly-text-1 leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_code]:bg-[var(--integration-docs-inline-code-bg)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:text-[var(--integration-docs-inline-code-text)]"
    remarkPlugins={[RemarkBreaks, remarkGfm]}
  >
    {content}
  </ReactMarkdown>
);

const renderParameters = (endpoint: ApiEndpoint, t: (key: string) => string) => {
  if (!endpoint.parameters?.length) {
    return <div className={emptyStateClassName}>{t('integration.api.noParameters')}</div>;
  }

  return (
    <table className={tableClassName}>
      <thead>
        <tr>
          <th className={tableHeaderCellClassName}>{t('integration.api.paramName')}</th>
          <th className={tableHeaderCellClassName}>{t('integration.api.paramIn')}</th>
          <th className={tableHeaderCellClassName}>{t('integration.api.paramType')}</th>
          <th className={tableHeaderCellClassName}>{t('integration.api.paramRequired')}</th>
          <th className={tableHeaderCellClassName}>{t('integration.api.paramDescription')}</th>
        </tr>
      </thead>
      <tbody>
        {endpoint.parameters.map((param) => (
          <tr key={`${endpoint.id}-${param.name}-${param.in}`}>
            <td className={tableCellClassName}>
              <code className={inlineCodeClassName}>{param.name}</code>
            </td>
            <td className={tableCellClassName}>{param.in}</td>
            <td className={tableCellClassName}>{param.type}</td>
            <td className={tableCellClassName}>
              {param.required ? t('common.yes') : t('common.no')}
            </td>
            <td className={tableCellClassName}>
              {param.descriptionKey ? t(param.descriptionKey) : param.description || '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const renderResponses = (endpoint: ApiEndpoint, t: (key: string) => string) => {
  const entries = Object.entries(endpoint.responses || {});
  if (!entries.length) {
    return <div className={emptyStateClassName}>{t('integration.api.noResponses')}</div>;
  }

  const responseFields = entries.map(([status, response]) => {
    const fields = extractSchemaFields(response.schema);
    if (!fields.length) return null;
    return (
      <div
        key={`${endpoint.id}-${status}-fields`}
        className="mt-3 pl-3 border-l-2 border-[var(--integration-docs-border)]"
      >
        <div className="text-xs font-semibold text-refly-text-1 tracking-[0.2px] mb-1.5">
          {`${t('integration.api.responseFieldsTitle')} (${status})`}
        </div>
        <table className={tableClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>{t('integration.api.paramName')}</th>
              <th className={tableHeaderCellClassName}>{t('integration.api.paramType')}</th>
              <th className={tableHeaderCellClassName}>{t('integration.api.paramRequired')}</th>
              <th className={tableHeaderCellClassName}>{t('integration.api.paramDescription')}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={`${endpoint.id}-${status}-${field.name}`}>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>{field.name}</code>
                </td>
                <td className={tableCellClassName}>{field.type}</td>
                <td className={tableCellClassName}>
                  {field.required ? t('common.yes') : t('common.no')}
                </td>
                <td className={tableCellClassName}>
                  {field.descriptionKey ? t(field.descriptionKey) : field.description || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="mt-3 pl-3 border-l-2 border-[var(--integration-docs-border)]">
        <div className="text-xs font-semibold text-refly-text-1 tracking-[0.2px] mb-1.5">
          {t('integration.api.responseStatusTitle')}
        </div>
        <table className={tableClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>{t('integration.api.responseStatus')}</th>
              <th className={tableHeaderCellClassName}>
                {t('integration.api.responseDescription')}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([status, response]) => (
              <tr key={`${endpoint.id}-${status}`}>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>{status}</code>
                </td>
                <td className={tableCellClassName}>
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
        <div className="mt-3 pl-3 border-l-2 border-[var(--integration-docs-border)]">
          <div className="text-xs font-semibold text-refly-text-1 tracking-[0.2px] mb-1.5">
            {t('integration.api.responseFieldsTitle')}
          </div>
          <div className={emptyStateClassName}>{t('integration.api.noResponseFields')}</div>
        </div>
      )}

      {entries.map(([status, response]) => {
        const example = response.example ?? generateExampleFromSchema(response.schema);
        if (example === null || example === undefined) return null;
        const display = JSON.stringify(example, null, 2);
        return (
          <div
            key={`${endpoint.id}-${status}-example`}
            className="mt-3 pl-3 border-l-2 border-[var(--integration-docs-border)]"
          >
            <div className="text-xs font-semibold text-refly-text-1 tracking-[0.2px] mb-1.5">
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
    return <div className={emptyStateClassName}>{t('integration.api.noRequestBodyFields')}</div>;
  }

  return (
    <table className={tableClassName}>
      <thead>
        <tr>
          <th className={tableHeaderCellClassName}>{t('integration.api.paramName')}</th>
          <th className={tableHeaderCellClassName}>{t('integration.api.paramType')}</th>
          <th className={tableHeaderCellClassName}>{t('integration.api.paramRequired')}</th>
          <th className={tableHeaderCellClassName}>{t('integration.api.paramDescription')}</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr key={`${endpoint.id}-${field.name}`}>
            <td className={tableCellClassName}>
              <code className={inlineCodeClassName}>{field.name}</code>
            </td>
            <td className={tableCellClassName}>{field.type}</td>
            <td className={tableCellClassName}>
              {field.required ? t('common.yes') : t('common.no')}
            </td>
            <td className={tableCellClassName}>
              {field.descriptionKey ? t(field.descriptionKey) : field.description || '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const ApiDocsTab = memo(({ canvasId }: ApiDocsTabProps) => {
  const { t, i18n } = useTranslation();
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
  const pathParams = useMemo(() => ({ canvasId }), [canvasId]);
  const bestPracticeExamples = useMemo(
    () =>
      generateBestPracticesExamples(baseUrl, canvasId, 'REFLY_API_KEY', {
        upload: t('integration.api.bestPracticesCommentUpload'),
        run: t('integration.api.bestPracticesCommentRun'),
        poll: t('integration.api.bestPracticesCommentPoll'),
        output: t('integration.api.bestPracticesCommentOutput'),
      }),
    [baseUrl, canvasId, t],
  );
  const bestPracticeCopyExamples = useMemo(
    () =>
      generateBestPracticesExamples(baseUrl, canvasId, 'REFLY_API_KEY', {
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
        (endpoint) =>
          endpoint.path.startsWith('/openapi/') &&
          !endpoint.path.includes('/webhook/') &&
          !endpoint.path.startsWith('/openapi/config'),
      ),
    [],
  );
  const groupedEndpoints = useMemo(() => groupApiEndpoints(publicEndpoints), [publicEndpoints]);

  const resolveText = (fallback: string, i18nMap?: Record<string, string>) => {
    if (!i18nMap) return fallback;
    const locale = i18n.language;
    const normalized =
      locale.startsWith('zh') && i18nMap['zh-Hans'] ? 'zh-Hans' : locale.split('-')[0];
    return i18nMap[locale] ?? i18nMap[normalized] ?? fallback;
  };

  return (
    <div className="mx-auto w-full max-w-[814px] pt-6">
      <div className="mb-8">
        <h2 className="text-[22px] md:text-[28px] font-semibold text-refly-text-0 mb-2">
          {t('integration.api.title')}
        </h2>
        <p className="m-0 text-[15px] text-refly-text-1 leading-relaxed">
          {t('integration.api.description')}
        </p>
      </div>

      <section id="api-overview" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.api.overviewTitle')}
        </h3>
        <div className="-mt-1 mb-4 text-sm text-refly-text-1 leading-relaxed">
          <MarkdownText content={t('integration.api.overviewDescription')} />
        </div>
        <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-refly-text-0">
              {t('integration.api.baseUrl')}:
            </span>
            <code className="text-sm bg-[var(--integration-docs-inline-code-bg)] px-2 py-1 rounded text-[var(--integration-docs-inline-code-text)]">
              {baseUrl}
            </code>
          </div>
        </div>
      </section>

      <section id="api-authentication" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.api.authTitle')}
        </h3>
        <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
          <h4 className="text-sm font-semibold text-refly-text-0 mb-3">
            {t('integration.api.authUsageTitle')}
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-refly-text-1 min-w-[80px]">
                {t('integration.api.authHeaderField')}:
              </span>
              <code className="text-sm bg-[var(--integration-docs-inline-code-bg)] px-2 py-1 rounded text-[var(--integration-docs-inline-code-text)]">
                Authorization
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-refly-text-1">
                {t('integration.api.authHeaderValue')}:
              </span>
              <code className="text-sm bg-[var(--integration-docs-inline-code-bg)] px-2 py-1 rounded text-[var(--integration-docs-inline-code-text)]">
                Bearer REFLY_API_KEY
              </code>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--integration-docs-border)]">
            <div className="text-xs text-[var(--integration-docs-text-3)]">
              {t('integration.api.keyHelper')}
            </div>
          </div>
        </div>
      </section>

      <section id="api-best-practices" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.api.bestPracticesTitle')}
        </h3>
        <div className="-mt-1 mb-4 text-sm text-refly-text-1 leading-relaxed">
          <MarkdownText content={t('integration.api.bestPracticesDescription')} />
        </div>
        <div className="mt-3">
          <h4 className="text-sm font-semibold text-refly-text-0 mb-2">
            {t('integration.api.bestPracticesExamplesTitle')}
          </h4>
          <Tabs
            defaultActiveKey="javascript"
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

      <section id="api-endpoints" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.api.endpointsTitle')}
        </h3>
        <p className={sectionDescClassName}>{t('integration.api.endpointsDescription')}</p>

        {groupedEndpoints.map((group, groupIndex) => (
          <div
            key={group.key}
            id={`api-endpoints-${group.key}`}
            className={groupIndex === 0 ? 'mt-5' : 'mt-8'}
          >
            <h4 className="text-[15px] font-semibold text-refly-text-0 mb-3 ml-1">
              {t(`integration.api.endpointGroups.${group.key}`)}
            </h4>
            {group.endpoints.map((endpoint) => {
              const endpointAnchorId = `api-endpoint-${endpoint.operationId || endpoint.id}`;
              const isRunEndpoint =
                endpoint.operationId === 'runWorkflowViaApi' ||
                endpoint.path === '/openapi/workflow/{canvasId}/run';
              const displayExamples = generateCodeExamples(
                endpoint,
                baseUrl,
                'REFLY_API_KEY',
                pathParams,
              );
              const copyExamples = generateCodeExamples(
                endpoint,
                baseUrl,
                'REFLY_API_KEY',
                pathParams,
              );
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
                ? generateCodeExamples(
                    endpoint,
                    baseUrl,
                    'REFLY_API_KEY',
                    pathParams,
                    requestExample,
                  )
                : displayExamples;
              const resolvedCopyExamples = isRunEndpoint
                ? generateCodeExamples(
                    endpoint,
                    baseUrl,
                    'REFLY_API_KEY',
                    pathParams,
                    requestExample,
                  )
                : copyExamples;

              return (
                <article
                  key={endpoint.id}
                  id={endpointAnchorId}
                  className="rounded-xl mb-8 last:mb-0 overflow-hidden "
                >
                  <div className="flex items-center gap-3 px-5 py-4">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-semibold uppercase ${
                        endpoint.method.toLowerCase() === 'get'
                          ? 'bg-[var(--integration-docs-method-get-bg)] text-[var(--integration-docs-method-get-text)]'
                          : endpoint.method.toLowerCase() === 'post'
                            ? 'bg-[var(--integration-docs-method-post-bg)] text-[var(--integration-docs-method-post-text)]'
                            : endpoint.method.toLowerCase() === 'put'
                              ? 'bg-[var(--integration-docs-method-put-bg)] text-[var(--integration-docs-method-put-text)]'
                              : 'bg-[var(--integration-docs-method-delete-bg)] text-[var(--integration-docs-method-delete-text)]'
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    <span className="font-mono text-sm text-refly-text-0">{endpoint.path}</span>
                  </div>
                  <div className="p-5">
                    <div className="text-base font-semibold text-refly-text-0 mb-2">
                      {endpoint.summaryKey ? t(endpoint.summaryKey) : endpoint.summary}
                    </div>
                    {(() => {
                      const text = endpoint.descriptionKey
                        ? t(endpoint.descriptionKey)
                        : endpoint.description;
                      return text ? (
                        <div className="text-sm text-refly-text-1 leading-relaxed mb-4">
                          <MarkdownText content={text} />
                        </div>
                      ) : null;
                    })()}

                    <div className="mt-5 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
                      <h4 className="text-sm font-semibold text-refly-text-0 mb-2">
                        {t('integration.api.parametersTitle')}
                      </h4>
                      {renderParameters(endpoint, t)}
                    </div>

                    <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
                      <h4 className="text-sm font-semibold text-refly-text-0 mb-2">
                        {t('integration.api.requestBodyTitle')}
                      </h4>
                      {endpoint.requestBody ? (
                        <>
                          {(() => {
                            const text = endpoint.requestBody.schema?.descriptionKey
                              ? t(endpoint.requestBody.schema.descriptionKey)
                              : endpoint.requestBody.schema?.description;
                            return text ? (
                              <div className={sectionDescClassName}>
                                <MarkdownText content={text} />
                              </div>
                            ) : null;
                          })()}
                          <div className="mt-3 pl-3 border-l-2 border-[var(--integration-docs-border)]">
                            <h5 className="text-xs font-semibold text-refly-text-1 tracking-[0.2px] mb-1.5">
                              {t('integration.api.requestBodyFieldsTitle')}
                            </h5>
                            {renderRequestBodyFields(endpoint, t)}
                          </div>
                          <div className="mt-3 pl-3 border-l-2 border-[var(--integration-docs-border)]">
                            <h5 className="text-xs font-semibold text-refly-text-1 tracking-[0.2px] mb-1.5">
                              {t('integration.api.requestBodyExampleTitle')}
                            </h5>
                            {requestDisplay ? (
                              <CodeExample
                                language={isMultipart ? 'text' : 'json'}
                                code={requestDisplay}
                              />
                            ) : (
                              <div className={emptyStateClassName}>
                                {t('integration.api.noRequestBody')}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className={emptyStateClassName}>
                          {t('integration.api.noRequestBody')}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
                      <h4 className="text-sm font-semibold text-refly-text-0 mb-2">
                        {t('integration.api.responsesTitle')}
                      </h4>
                      {renderResponses(endpoint, t)}
                    </div>

                    <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
                      <h4 className="text-sm font-semibold text-refly-text-0 mb-2">
                        {t('integration.api.codeExamplesTitle')}
                      </h4>
                      <Tabs
                        defaultActiveKey="javascript"
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
          </div>
        ))}
      </section>

      <section id="api-errors" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.api.errorsTitle')}
        </h3>
        <p className={sectionDescClassName}>{t('integration.api.errorsDescription')}</p>
        <table className={tableClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>{t('integration.api.errorCode')}</th>
              <th className={tableHeaderCellClassName}>{t('integration.api.errorStatus')}</th>
              <th className={tableHeaderCellClassName}>{t('integration.api.errorMessage')}</th>
              <th className={tableHeaderCellClassName}>{t('integration.api.errorDescription')}</th>
            </tr>
          </thead>
          <tbody>
            {apiDocsData.errorCodes.map((error) => (
              <tr key={error.code}>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>{error.code}</code>
                </td>
                <td className={tableCellClassName}>{error.httpStatus ?? '-'}</td>
                <td className={tableCellClassName}>
                  {resolveText(error.message, error.messageI18n)}
                </td>
                <td className={tableCellClassName}>
                  {resolveText(error.description, error.descriptionI18n)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
});

ApiDocsTab.displayName = 'ApiDocsTab';
