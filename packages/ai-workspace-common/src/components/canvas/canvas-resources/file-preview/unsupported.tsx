import { memo } from 'react';
import { Button } from 'antd';
import { Download, File } from 'refly-icons';
import type { FileRendererProps } from './types';

interface UnsupportedRendererProps extends FileRendererProps {
  onDownload: () => void;
  isDownloading?: boolean;
}

export const UnsupportedRenderer = memo(
  ({ fileContent, file, onDownload, isDownloading }: UnsupportedRendererProps) => {
    const { contentType } = fileContent;

    return (
      <div className="h-full flex items-center justify-center flex-col gap-4">
        <div className="text-center">
          <File className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <div className="text-lg font-medium text-gray-700 mb-2">{file.name}</div>
          <div className="text-sm text-gray-500 mb-4">File type: {contentType}</div>
          <div className="text-sm text-gray-400">Preview not available for this file type</div>
        </div>
        <Button
          type="primary"
          icon={<Download className="w-4 h-4" />}
          onClick={onDownload}
          loading={isDownloading}
          disabled={isDownloading}
        >
          Download File
        </Button>
      </div>
    );
  },
);
