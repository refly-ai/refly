import { memo, useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { Button, Dropdown, Typography } from 'antd';
import { Close } from 'refly-icons';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { UserInputItem } from '../user-input-item';

const { Paragraph } = Typography;

export interface LabelConfig {
  readonly?: boolean;
  icon?: ReactNode;
  labeltext: string;
  classnames?: string;
  key?: string;
  onClose?: () => void;
  onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

// Single label item component
export const LabelItem = memo(
  ({
    readonly = false,
    icon,
    labeltext,
    classnames,
    onClose,
    onMouseEnter,
    onMouseLeave,
  }: LabelConfig) => {
    return (
      <div
        className={`flex items-center gap-1 h-5 px-1 rounded-[4px] border-[0.5px] border-solid border-refly-Card-Border cursor-pointer select-none ${classnames ?? ''}`}
        onMouseEnter={readonly ? undefined : onMouseEnter}
        onMouseLeave={readonly ? undefined : onMouseLeave}
      >
        {icon}
        <Paragraph
          className="text-xs text-refly-text-0 max-w-[100px] leading-4 !m-0"
          ellipsis={{
            rows: 1,
            tooltip: <div className="max-h-[200px] overflow-y-auto">{labeltext}</div>,
          }}
        >
          {labeltext}
        </Paragraph>
        {onClose && !readonly && (
          <Button
            type="text"
            className="!w-[14px] !h-[14px] !p-0 !rounded-[2px]"
            icon={<Close size={14} />}
            onClick={onClose}
          />
        )}
      </div>
    );
  },
);

LabelItem.displayName = 'LabelItem';

interface LabelDisplayProps {
  title?: ReactNode;
  variables?: WorkflowVariable[];
  labels?: LabelConfig[];
  showMore?: boolean;
  labelClassnames?: string;
}

export const LabelDisplay = memo(
  ({
    title,
    labels = [],
    variables = [],
    showMore = false,
    labelClassnames,
  }: LabelDisplayProps) => {
    const totalItems = useMemo(() => {
      const items: (
        | { type: 'variable'; data: WorkflowVariable }
        | { type: 'label'; data: LabelConfig }
      )[] = [];
      for (const v of variables) {
        items.push({ type: 'variable', data: v });
      }
      for (const l of labels) {
        items.push({ type: 'label', data: l });
      }
      return items;
    }, [variables, labels]);

    const labelsContainerRef = useRef<HTMLDivElement>(null);
    const measureContainerRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(totalItems.length);
    const [isOverflowing, setIsOverflowing] = useState(false);

    // Calculate how many labels can fit in the container
    const calculateVisibleCount = useCallback(() => {
      if (!labelsContainerRef.current || totalItems.length === 0) {
        return;
      }

      const labelsContainer = labelsContainerRef.current;
      const containerWidth = labelsContainer.offsetWidth;
      if (containerWidth === 0) {
        return;
      }

      const gapWidth = 4; // gap-1 = 4px
      const ellipsisWidth = 16; // Approximate width of "..."

      // Measure labels in the hidden measurement container
      const measureContainer = measureContainerRef.current;
      const labelElements = measureContainer?.querySelectorAll(
        '.label-measure-item',
      ) as NodeListOf<HTMLElement> | null;

      if (!labelElements || labelElements.length === 0) {
        return;
      }

      let totalWidth = 0;
      let fitCount = 0;

      for (let i = 0; i < totalItems.length; i++) {
        const currentLabelElement = labelElements[i];
        if (!currentLabelElement) {
          break;
        }

        const labelWidth = currentLabelElement.offsetWidth + (i > 0 ? gapWidth : 0);

        // Check if adding this label plus ellipsis (if needed) would fit
        const wouldFit =
          totalWidth + labelWidth + (i < totalItems.length - 1 ? ellipsisWidth + gapWidth : 0) <=
          containerWidth;

        if (wouldFit) {
          totalWidth += labelWidth;
          fitCount = i + 1;
        } else {
          break;
        }
      }

      setVisibleCount(Math.max(0, fitCount));
      setIsOverflowing(fitCount < totalItems.length);
    }, [totalItems]);

    // Calculate on mount and when totalItems changes
    useEffect(() => {
      const timer = requestAnimationFrame(() => {
        calculateVisibleCount();
      });

      return () => {
        cancelAnimationFrame(timer);
      };
    }, [calculateVisibleCount]);

    // Listen to container resize
    useEffect(() => {
      if (!labelsContainerRef.current) {
        return;
      }

      const resizeObserver = new ResizeObserver(() => {
        calculateVisibleCount();
      });

      resizeObserver.observe(labelsContainerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }, [calculateVisibleCount]);

    if (totalItems.length === 0) {
      return null;
    }

    const visibleItems = totalItems.slice(0, visibleCount);
    const hiddenItems = totalItems.slice(visibleCount);

    // Create dropdown menu items for hidden labels
    const dropdownMenuItems = hiddenItems.map((item, index) => {
      const key =
        item.type === 'variable'
          ? (item.data.name ?? `hidden-var-${index}`)
          : (item.data.key ?? `hidden-label-${index}`);

      return {
        key,
        label: (
          <div className="flex items-center">
            {item.type === 'variable' ? (
              <UserInputItem variable={item.data} classnames={labelClassnames} />
            ) : (
              <LabelItem {...item.data} classnames={labelClassnames} />
            )}
          </div>
        ),
      };
    });

    return (
      <div className="flex items-center gap-1 min-w-0 flex-1 h-5">
        {title && (
          <div className="flex-shrink-0 text-[10px] text-refly-text-2 leading-[14px]">{title}</div>
        )}
        <div
          ref={labelsContainerRef}
          className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden"
        >
          {visibleItems.map((item, index) =>
            item.type === 'variable' ? (
              <UserInputItem
                key={item.data.name ?? `var-${index}`}
                variable={item.data}
                classnames={labelClassnames}
              />
            ) : (
              <LabelItem
                key={item.data.key ?? `label-${index}`}
                {...item.data}
                classnames={labelClassnames}
              />
            ),
          )}
          {isOverflowing ? (
            showMore ? (
              <Dropdown
                menu={{ items: dropdownMenuItems, className: 'max-h-[200px] overflow-y-auto' }}
                placement="top"
                trigger={['hover']}
              >
                <div className="text-refly-text-2 text-xs flex-shrink-0 leading-[18px] cursor-pointer hover:text-refly-text-0">
                  ...
                </div>
              </Dropdown>
            ) : (
              <div className="text-refly-text-2 text-xs flex-shrink-0 leading-[18px] cursor-pointer">
                ...
              </div>
            )
          ) : null}
        </div>
        {/* Hidden measurement container for accurate width calculation */}
        <div
          ref={measureContainerRef}
          aria-hidden="true"
          className="absolute left-[-9999px] top-[-9999px] whitespace-nowrap pointer-events-none flex items-center gap-1"
        >
          {totalItems.map((item, index) => (
            <div
              key={`measure-${
                item.type === 'variable' ? (item.data.name ?? index) : (item.data.key ?? index)
              }`}
              className="label-measure-item"
            >
              {item.type === 'variable' ? (
                <UserInputItem variable={item.data} classnames={labelClassnames} />
              ) : (
                <LabelItem {...item.data} classnames={labelClassnames} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  },
);

LabelDisplay.displayName = 'LabelDisplay';
