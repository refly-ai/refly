import { useEffect, useRef, memo, ReactNode, useCallback, useMemo, useState } from 'react';
import mermaid from 'mermaid';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash-es';
import { cn } from '@refly/utils';

// Initialize mermaid config
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'inherit',
});

interface MermaidProps {
  children: ReactNode;
}

// Generate unique ID for each mermaid diagram
const generateUniqueId = (() => {
  let counter = 0;
  return () => `mermaid-diagram-${counter++}`;
})();

// Cache for rendered diagrams
const diagramCache = new Map<string, string>();

const MermaidComponent = memo(
  ({ children }: MermaidProps) => {
    const mermaidRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    const [showOriginalCode, setShowOriginalCode] = useState(false);

    // Generate a unique ID for this instance
    const diagramId = useMemo(() => generateUniqueId(), []);

    // Memoize the mermaid code to prevent unnecessary recalculations
    const mermaidCode = useMemo(() => children?.toString().trim() ?? '', [children]);

    // Memoize the render function to maintain referential equality
    const renderDiagram = useCallback(
      debounce(async () => {
        if (!mermaidRef.current) return;

        try {
          // Check cache first
          const cachedSvg = diagramCache.get(mermaidCode);
          if (cachedSvg) {
            mermaidRef.current.innerHTML = cachedSvg;
            setShowOriginalCode(false);
            return;
          }

          // Clear previous content
          mermaidRef.current.innerHTML = '';

          // Validate mermaid syntax first
          await mermaid.parse(mermaidCode);

          // Generate and render the diagram with unique ID
          const { svg } = await mermaid.render(diagramId, mermaidCode);

          // Cache the result
          diagramCache.set(mermaidCode, svg);

          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = svg;
            setShowOriginalCode(false);
          }
        } catch (error) {
          console.error('Mermaid rendering error:', error);
          setShowOriginalCode(true);
          if (mermaidRef.current) {
            // Show original code in a pre tag with error message
            mermaidRef.current.innerHTML = `
              <div class="text-red-500 text-xs mb-2">${t('components.markdown.mermaidError')}</div>
              <pre class="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                <code>${mermaidCode}</code>
              </pre>
            `;
          }
        }
      }, 300),
      [mermaidCode, t, diagramId],
    );

    useEffect(() => {
      renderDiagram();
      return () => {
        renderDiagram.cancel();
      };
    }, [renderDiagram]);

    // Memoize the className to prevent inline object creation
    const containerClassName = useMemo(
      () =>
        cn(
          'mermaid-diagram w-full flex justify-center items-center overflow-x-auto',
          showOriginalCode && 'bg-gray-50 rounded',
        ),
      [showOriginalCode],
    );

    return <div ref={mermaidRef} className={containerClassName} />;
  },
  (prevProps, nextProps) => {
    return prevProps.children?.toString() === nextProps.children?.toString();
  },
);

MermaidComponent.displayName = 'MermaidComponent';

export default MermaidComponent;
