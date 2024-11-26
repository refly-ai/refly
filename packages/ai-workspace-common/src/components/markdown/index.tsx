import { IconLoading } from '@arco-design/web-react/icon';
import { memo, useEffect, useRef, useState, lazy, Suspense, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message as message } from '@arco-design/web-react';
import { Popover, PopoverContent, PopoverTrigger } from './plugins/link/popover';

import copyToClipboard from 'copy-to-clipboard';
import RemarkBreaks from 'remark-breaks';
import RemarkGfm from 'remark-gfm';

import { markdownCitationParse } from '@refly/utils';

// plugins
import { markdownElements } from './plugins';
import LinkElement from './plugins/link';
import CodeElement from './plugins/code';

// styles
import './styles/markdown.scss';
import './styles/highlight.scss';
import { Source } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';

const rehypePlugins = markdownElements.map((element) => element.rehypePlugin);

export const Markdown = memo(
  (
    props: {
      content: string;
      loading?: boolean;
      fontSize?: number;
      sources?: Source[];
      msgId?: string;
    } & React.DOMAttributes<HTMLDivElement>,
  ) => {
    const { msgId } = props;
    const mdRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    const [isKatexLoaded, setIsKatexLoaded] = useState(false);

    // Add state for dynamically loaded plugins
    const [plugins, setPlugins] = useState({
      RemarkMath: null,
      RehypeKatex: null,
      RehypeHighlight: null,
    });

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

    const shouldLoading = props.loading;
    const parsedContent = markdownCitationParse(props?.content || '');

    const canvasComponents = useMemo(
      () =>
        Object.fromEntries(
          markdownElements.map((element) => {
            const Component = element.Component;

            return [element.tag, (props: any) => <Component {...props} id={msgId} />];
          }),
        ),
      [msgId],
    );

    return (
      <div className="markdown-body" style={{ fontSize: `${props.fontSize ?? 15}px` }} ref={mdRef}>
        {shouldLoading ? (
          <IconLoading />
        ) : (
          <Suspense fallback={<div>{t('common.loading')}</div>}>
            {isKatexLoaded && plugins.RemarkMath && plugins.RehypeKatex && plugins.RehypeHighlight && (
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
                  // ...canvasComponents,
                  pre: CodeElement.Component,
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
);
