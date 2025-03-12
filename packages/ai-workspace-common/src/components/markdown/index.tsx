import { IconLoading } from '@arco-design/web-react/icon';
import { memo, useEffect, useRef, useState, Suspense, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

import RemarkBreaks from 'remark-breaks';
import RemarkGfm from 'remark-gfm';

import { cn, markdownCitationParse } from '@refly/utils';

// plugins
import LinkElement from './plugins/link';

// styles
import './styles/markdown.scss';
import './styles/highlight.scss';
import { Source } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';

import { markdownElements } from './plugins';
import { processWithArtifact } from '@refly-packages/ai-workspace-common/modules/artifacts/utils';

const rehypePlugins = markdownElements.map((element) => element.rehypePlugin);

export const Markdown = memo(
  (
    props: {
      content: string;
      loading?: boolean;
      sources?: Source[];
      className?: string;
      resultId?: string;
    } & React.DOMAttributes<HTMLDivElement>,
  ) => {
    const { content: rawContent } = props;
    const content = processWithArtifact(rawContent);

    const mdRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    const [isKatexLoaded, setIsKatexLoaded] = useState(false);

    // Add state for dynamically loaded plugins
    const [plugins, setPlugins] = useState({
      RemarkMath: null,
      RehypeKatex: null,
      RehypeHighlight: null,
    });

    // Memoize the className to prevent inline object creation
    const markdownClassName = useMemo(
      () => cn('markdown-body', props.className),
      [props.className],
    );

    // Memoize the parsed content
    const parsedContent = useMemo(() => markdownCitationParse(content), [content]);

    const artifactComponents = useMemo(() => {
      // Capture resultId from outer props scope
      const outerResultId = props.resultId;

      return Object.fromEntries(
        markdownElements.map((element) => {
          const Component = element.Component;

          return [
            element.tag,
            (innerProps: any) => <Component {...innerProps} id={outerResultId} />,
          ];
        }),
      );
    }, [props.resultId]);

    // Dynamically import KaTeX CSS
    useEffect(() => {
      import('katex/dist/katex.min.css').then(() => setIsKatexLoaded(true));
    }, []);

    // Dynamically import heavy plugins
    useEffect(() => {
      Promise.all([import('remark-math'), import('rehype-katex'), import('rehype-highlight')]).then(
        ([RemarkMath, RehypeKatex, RehypeHighlight]) => {
          setPlugins({
            RemarkMath: RemarkMath.default,
            RehypeKatex: RehypeKatex.default,
            RehypeHighlight: RehypeHighlight.default,
          });
        },
      );
    }, []);

    return (
      <div className={markdownClassName} ref={mdRef}>
        {props.loading ? (
          <IconLoading />
        ) : (
          <Suspense fallback={<div>{t('common.loading')}</div>}>
            {isKatexLoaded &&
              plugins.RemarkMath &&
              plugins.RehypeKatex &&
              plugins.RehypeHighlight && (
                <ReactMarkdown
                  remarkPlugins={[RemarkGfm, RemarkBreaks, plugins.RemarkMath]}
                  rehypePlugins={[
                    ...rehypePlugins,
                    plugins.RehypeKatex,
                    [
                      plugins.RehypeHighlight,
                      {
                        detect: false,
                        ignoreMissing: true,
                      },
                    ],
                  ]}
                  components={{
                    ...artifactComponents,
                    a: (args) => LinkElement.Component(args, props?.sources || []),
                  }}
                  linkTarget={'_blank'}
                >
                  {parsedContent}
                </ReactMarkdown>
              )}
          </Suspense>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.content === nextProps.content &&
      prevProps.loading === nextProps.loading &&
      prevProps.className === nextProps.className &&
      prevProps.resultId === nextProps.resultId &&
      JSON.stringify(prevProps.sources) === JSON.stringify(nextProps.sources)
    );
  },
);
