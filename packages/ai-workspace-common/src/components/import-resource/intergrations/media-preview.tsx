import React from 'react';
import { Card } from 'antd';
import { useTranslation } from 'react-i18next';

interface MediaPreviewProps {
  url: string;
  type: 'video' | 'audio';
  title?: string;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
  url,
  type,
  title,
}) => {
  const { t } = useTranslation();

  return (
    <Card 
      title={title} 
      className="w-full"
      styles={{ body: { padding: '12px' } }}
    >
      {type === 'video' ? (
        <video
          controls
          className="w-full rounded"
          src={url}
          preload="metadata"
        />
      ) : (
        <audio
          controls
          className="w-full"
          src={url}
          preload="metadata"
        />
      )}
    </Card>
  );
}; 