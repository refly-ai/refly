import { ResultItemPreview } from '@refly-packages/ai-workspace-common/components/workflow-app/ResultItemPreview';
import { CanvasNode } from '@refly/openapi-schema';
import { memo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'antd';
import { useActionResultStoreShallow } from '@refly/stores';
import { ProductCard } from '@refly-packages/ai-workspace-common/components/markdown/plugins/tool-call/product-card';

export interface SelectedResultsGridProps {
  selectedResults: string[];
  options: CanvasNode[];
  bordered?: boolean;
  fillRow?: boolean; // Whether items should stretch to fill available space in a row
}

// Grid component to display selected results in a card layout
export const SelectedResultsGrid = memo(
  ({ selectedResults, options, bordered = false, fillRow = false }: SelectedResultsGridProps) => {
    const { t } = useTranslation();
    const firstItemRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [itemHeight, setItemHeight] = useState<number | null>(null);
    const [itemsPerRow, setItemsPerRow] = useState<number>(3);
    const { currentFile, setCurrentFile } = useActionResultStoreShallow((state) => ({
      currentFile: state.currentFile,
      setCurrentFile: state.setCurrentFile,
    }));

    // Filter options to only show selected ones
    const selectedNodes = options.filter((node) => selectedResults.includes(node.id));

    // Calculate items per row based on container width
    useEffect(() => {
      if (containerRef.current) {
        const calculateItemsPerRow = () => {
          const containerWidth = containerRef.current?.offsetWidth ?? 0;
          const gap = bordered ? 10 : 12;
          const minItemWidth = 128;

          // Calculate how many items can fit
          // 3 items: 3 * minItemWidth + 2 * gap
          // 2 items: 2 * minItemWidth + 1 * gap
          if (containerWidth >= 3 * minItemWidth + 2 * gap) {
            setItemsPerRow(3);
          } else if (containerWidth >= 2 * minItemWidth + 1 * gap) {
            setItemsPerRow(2);
          } else {
            // Fallback to 2 if container is very narrow
            setItemsPerRow(2);
          }
        };

        // Initial calculation
        calculateItemsPerRow();

        // Use ResizeObserver to watch for container size changes
        const resizeObserver = new ResizeObserver(() => {
          calculateItemsPerRow();
        });

        resizeObserver.observe(containerRef.current);

        return () => {
          resizeObserver.disconnect();
        };
      }
    }, [bordered]);

    // Measure the actual height of the first item from full rows
    useEffect(() => {
      if (firstItemRef.current) {
        const updateHeight = () => {
          const height = firstItemRef.current?.offsetHeight;
          if (height !== undefined && height > 0) {
            setItemHeight(height);
          }
        };

        // Initial measurement
        updateHeight();

        // Use ResizeObserver to watch for size changes
        const resizeObserver = new ResizeObserver(() => {
          updateHeight();
        });

        resizeObserver.observe(firstItemRef.current);

        return () => {
          resizeObserver.disconnect();
        };
      }
    }, [selectedNodes.length, itemsPerRow]);

    // Clean up currentFile when component unmounts if modal was open
    // This prevents state leakage when navigating away while preview is open
    useEffect(() => {
      return () => {
        if (currentFile) {
          setCurrentFile(null);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (selectedNodes.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center text-refly-text-2 text-sm">
          {t('workflowApp.noResultsSelected')}
        </div>
      );
    }

    // Calculate if item is in last row and how many items in last row
    const totalItems = selectedNodes.length;
    const fullRows = Math.floor(totalItems / itemsPerRow);
    const itemsInLastRow = totalItems % itemsPerRow;
    const isLastRowIncomplete = itemsInLastRow > 0 && itemsInLastRow < itemsPerRow;

    // Separate items into full rows and last row
    const fullRowItems = selectedNodes.slice(0, fullRows * itemsPerRow);
    const lastRowItems = isLastRowIncomplete ? selectedNodes.slice(fullRows * itemsPerRow) : [];

    return (
      <div ref={containerRef} className="w-full h-full overflow-y-auto">
        <div className="space-y-3">
          {/* Full rows */}
          {fullRowItems.length > 0 && (
            <div
              className={`grid cursor-pointer ${itemsPerRow === 3 ? 'grid-cols-3' : 'grid-cols-2'} ${
                !fillRow ? 'justify-items-start' : ''
              }`}
              style={{
                gap: bordered ? '10px' : '12px',
              }}
            >
              {fullRowItems.map((node, index) => (
                <div
                  key={node.id}
                  ref={index === 0 ? firstItemRef : null}
                  className={`relative cursor-pointer overflow-hidden rounded-lg ${
                    bordered ? 'border' : ''
                  } ${fillRow ? 'w-full' : ''}`}
                  style={{
                    minWidth: '128px',
                    ...(fillRow ? {} : { width: '140px' }),
                    aspectRatio: '128 / 77',
                    maxHeight: '166px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--refly-bg-content-z2)',
                    ...(bordered
                      ? {
                          border:
                            '1px solid var(--border---refly-Card-Border, rgba(0, 0, 0, 0.10))',
                          padding: '12px',
                        }
                      : {}),
                  }}
                >
                  {bordered ? (
                    <div className="w-full h-full overflow-hidden rounded-lg">
                      <ResultItemPreview node={node} />
                    </div>
                  ) : (
                    <ResultItemPreview node={node} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Last incomplete row */}
          {isLastRowIncomplete && lastRowItems.length > 0 && (
            <div
              className="flex cursor-pointer"
              style={{
                gap: bordered ? '10px' : '12px',
              }}
            >
              {lastRowItems.map((node) => (
                <div
                  key={node.id}
                  className={`relative cursor-pointer overflow-hidden rounded-lg ${
                    fillRow ? 'flex-1' : ''
                  } ${bordered ? 'border' : ''}`}
                  style={{
                    minWidth: '128px',
                    ...(fillRow ? {} : { width: '128px' }),
                    // Use measured height if there are full rows above and height is measured,
                    // otherwise use aspectRatio (for initial render or when no full rows exist)
                    height:
                      fullRows > 0 && itemHeight !== null
                        ? `${itemHeight}px`
                        : fullRows === 0
                          ? undefined
                          : '77px', // Fallback during measurement
                    maxHeight: '166px',
                    aspectRatio: fullRows > 0 && itemHeight !== null ? undefined : '128 / 77',
                    borderRadius: '8px',
                    backgroundColor: 'var(--refly-bg-content-z2)',
                    ...(bordered
                      ? {
                          border:
                            '1px solid var(--border---refly-Card-Border, rgba(0, 0, 0, 0.10))',
                          padding: '12px',
                        }
                      : {}),
                  }}
                >
                  {bordered ? (
                    <div className="w-full h-full overflow-hidden rounded-lg">
                      <ResultItemPreview node={node} />
                    </div>
                  ) : (
                    <ResultItemPreview node={node} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {currentFile && (
          <Modal
            open={!!currentFile}
            footer={null}
            onCancel={() => setCurrentFile(null)}
            width="85%"
            style={{ top: 20 }}
            styles={{
              body: {
                maxHeight: 'calc(var(--screen-height, 100vh) - 100px)',
                height: 'calc(var(--screen-height, 100vh) - 100px)',
                padding: 0,
                overflow: 'hidden',
              },
              mask: {
                background: 'rgba(0, 0, 0, 0.65)',
              },
            }}
            className="wide-mode-modal"
          >
            <div className="bg-white h-full w-full flex flex-col rounded-lg overflow-hidden dark:bg-gray-900">
              <div
                className="flex-1 overflow-auto"
                style={{ height: 'calc(var(--screen-height, 100vh) - 160px)' }}
              >
                <ProductCard file={currentFile} classNames="w-full h-full" source="preview" />
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  },
);

SelectedResultsGrid.displayName = 'SelectedResultsGrid';
