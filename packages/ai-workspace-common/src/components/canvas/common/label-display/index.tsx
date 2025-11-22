import { memo, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { Button, Dropdown, Typography } from 'antd';
import { Close } from 'refly-icons';

const { Paragraph } = Typography;

export interface LabelConfig {
  icon?: ReactNode;
  labeltext: string;
  classnames?: string;
  key?: string;
  onClose?: () => void;
  onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

interface LabelDisplayProps {
  title?: ReactNode;
  labels: LabelConfig[];
  showMore?: boolean;
  labelClassnames?: string;
}

// Single label item component
export const LabelItem = memo(
  ({ icon, labeltext, classnames, onClose, onMouseEnter, onMouseLeave }: LabelConfig) => {
    return (
      <div
        className={`flex items-center gap-1 h-5 px-1 rounded-[4px] border-[0.5px] border-solid border-refly-Card-Border cursor-pointer select-none ${classnames ?? ''}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {icon && icon}
        <Paragraph
          className="text-xs text-refly-text-0 max-w-[100px] leading-4 !m-0"
          ellipsis={{
            rows: 1,
            tooltip: <div className="max-h-[200px] overflow-y-auto">{labeltext}</div>,
          }}
        >
          {labeltext}
        </Paragraph>
        {onClose && (
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

export const LabelDisplay = memo(
  ({ title, labels, showMore = false, labelClassnames }: LabelDisplayProps) => {
    if (labels?.length === 0) {
      return null;
    }
    const labelsContainerRef = useRef<HTMLDivElement>(null);
    const measureContainerRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(labels.length);
    const [isOverflowing, setIsOverflowing] = useState(false);

    // Calculate how many labels can fit in the container
    const calculateVisibleCount = useCallback(() => {
      if (!labelsContainerRef.current || labels.length === 0) {
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

      for (let i = 0; i < labels.length; i++) {
        const currentLabelElement = labelElements[i];
        if (!currentLabelElement) {
          break;
        }

        const labelWidth = currentLabelElement.offsetWidth + (i > 0 ? gapWidth : 0);

        // Check if adding this label plus ellipsis (if needed) would fit
        const wouldFit =
          totalWidth + labelWidth + (i < labels.length - 1 ? ellipsisWidth + gapWidth : 0) <=
          containerWidth;

        if (wouldFit) {
          totalWidth += labelWidth;
          fitCount = i + 1;
        } else {
          break;
        }
      }

      setVisibleCount(Math.max(0, fitCount));
      setIsOverflowing(fitCount < labels.length);
    }, [labels]);

    // Calculate on mount and when labelConfig changes
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

    if (labels.length === 0) {
      return null;
    }

    const visibleLabels = labels.slice(0, visibleCount);
    const hiddenLabels = labels.slice(visibleCount);

    // Create dropdown menu items for hidden labels
    const dropdownMenuItems = hiddenLabels.map((label, index) => ({
      key: label.key ?? `hidden-${index}`,
      label: (
        <div className="flex items-center">
          <LabelItem {...label} />
        </div>
      ),
    }));

    return (
      <div className="flex items-center gap-1 min-w-0 flex-1 h-5">
        {title && (
          <div className="flex-shrink-0 text-[10px] text-refly-text-2 leading-[14px]">{title}</div>
        )}
        <div
          ref={labelsContainerRef}
          className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden"
        >
          {visibleLabels.map((label, index) => (
            <LabelItem
              key={label.key ?? `label-${index}`}
              {...label}
              classnames={labelClassnames}
            />
          ))}
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
          {labels.map((label, index) => (
            <div key={`measure-${label.key ?? index}`} className="label-measure-item">
              <LabelItem {...label} classnames={labelClassnames} />
            </div>
          ))}
        </div>
      </div>
    );
  },
);

LabelDisplay.displayName = 'LabelDisplay';
