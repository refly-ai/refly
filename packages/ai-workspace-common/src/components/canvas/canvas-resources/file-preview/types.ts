import type { DriveFile } from '@refly/openapi-schema';

export interface FileContent {
  data: ArrayBuffer;
  contentType: string;
  url: string;
}

export interface FileRendererProps {
  fileContent: FileContent;
  file: DriveFile;
}
