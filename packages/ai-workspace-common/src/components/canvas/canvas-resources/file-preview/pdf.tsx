import { memo } from 'react';
import type { FileRendererProps } from './types';

export const PdfRenderer = memo(({ fileContent, file }: FileRendererProps) => {
  const { url } = fileContent;

  return (
    <div className="h-full flex flex-col">
      <iframe src={url} className="w-full h-full border-0" title={file.name} />
    </div>
  );
});
