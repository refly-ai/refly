import React, { memo } from 'react';
import { Card, Skeleton, Space } from 'antd';

export const CommunityMcpCardSkeleton: React.FC = memo(() => {
  return (
    <Card
      className="community-mcp-card-skeleton bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      style={{
        height: '100px',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
      styles={{
        body: {
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        },
      }}
    >
      {/* Main content layout skeleton */}
      <div className="flex items-center justify-between h-full">
        {/* Left side skeleton */}
        <div className="flex items-center flex-1 min-w-0">
          {/* Logo skeleton */}
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 mr-3 flex-shrink-0">
            <Skeleton.Avatar
              active
              size={40}
              shape="square"
              style={{
                borderRadius: '8px',
              }}
            />
          </div>

          {/* Content skeleton */}
          <div className="flex-1 min-w-0">
            {/* Title and badge row skeleton */}
            <div className="flex items-center mb-1">
              <Skeleton.Input
                active
                size="small"
                style={{
                  width: '120px',
                  height: '16px',
                  borderRadius: '4px',
                  marginRight: '8px',
                }}
              />
              <Skeleton.Input
                active
                size="small"
                style={{
                  width: '35px',
                  height: '14px',
                  borderRadius: '8px',
                }}
              />
            </div>

            {/* Description skeleton */}
            <Skeleton
              active
              paragraph={{
                rows: 2,
                width: ['80%', '55%'],
              }}
              title={false}
              style={{
                margin: 0,
                marginBottom: '6px',
              }}
            />

            {/* Metadata skeleton */}
            <Space size={6}>
              <Skeleton.Input
                active
                size="small"
                style={{
                  width: '45px',
                  height: '10px',
                  borderRadius: '2px',
                }}
              />
              <Skeleton.Input
                active
                size="small"
                style={{
                  width: '25px',
                  height: '10px',
                  borderRadius: '2px',
                }}
              />
            </Space>
          </div>
        </div>

        {/* Right side skeleton */}
        <div className="flex items-center ml-3 flex-shrink-0">
          <Skeleton.Input
            active
            size="small"
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              marginRight: '8px',
            }}
          />
          <Skeleton.Button
            active
            style={{
              width: '70px',
              height: '28px',
              borderRadius: '6px',
            }}
          />
        </div>
      </div>
    </Card>
  );
});

CommunityMcpCardSkeleton.displayName = 'CommunityMcpCardSkeleton';
