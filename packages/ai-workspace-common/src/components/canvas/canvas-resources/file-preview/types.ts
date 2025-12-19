import type { DriveFile } from '@refly/openapi-schema';

export interface FileContent {
  data: ArrayBuffer;
  contentType: string;
  url: string;
}

// Base props for all renderers
export interface FileRendererProps {
  fileContent: FileContent;
  file: DriveFile;
}

// Props for renderers that support card/preview modes
export interface SourceRendererProps extends FileRendererProps {
  source: 'card' | 'preview';
  className?: string;
  activeTab?: 'code' | 'preview';
  onTabChange?: (tab: 'code' | 'preview') => void;
  disableTruncation?: boolean;
  purePreview?: boolean;
}
