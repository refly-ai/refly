import { Skeleton } from 'antd';
import { memo } from 'react';

/**
 * Skeleton screen component that mimics the MixedTextEditor layout
 * Used during template generation (pending/generating states)
 */
export const TemplateEditorSkeleton = memo(() => {
  return (
    <div className="mixed-text-editor">
      <div
        className="text-base text-refly-text-1"
        style={{
          fontFamily:
            'PingFang SC, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '16px',
          lineHeight: '30px',
        }}
      >
        {/* Use Skeleton paragraph for more natural text-like appearance */}
        <Skeleton
          active
          title={false}
          paragraph={{
            rows: 5,
            width: ['100%', '95%', '98%', '92%', '96%'],
          }}
          className="!mb-0"
        />
      </div>
    </div>
  );
});

TemplateEditorSkeleton.displayName = 'TemplateEditorSkeleton';
