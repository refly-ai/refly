import { memo, useCallback, useMemo } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { FileItem } from './file-item';
import { DriveFile } from '@refly/openapi-schema';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';

interface FileListProps {
  files: DriveFile[];
  searchKeyword: string;
}

export const FileList = memo((props: FileListProps) => {
  const { files, searchKeyword } = props;
  const { currentFile, setCurrentFile } = useCanvasResourcesPanelStoreShallow((state) => ({
    currentFile: state.currentFile,
    setCurrentFile: state.setCurrentFile,
  }));

  const { t } = useTranslation();

  // Filter files by search keyword
  const filteredFiles = useMemo(() => {
    if (!files?.length) {
      return [];
    }

    let filtered = files;
    if (searchKeyword?.trim()) {
      const keyword = searchKeyword.toLowerCase().trim();
      filtered = filtered.filter((file) => {
        const fileName = file.name?.toLowerCase() ?? '';
        return fileName.includes(keyword);
      });
    }

    return filtered;
  }, [files, searchKeyword]);

  const handleFileSelect = useCallback(
    (file: DriveFile, beforeParsed: boolean) => {
      if (beforeParsed) {
        message.error(
          t('resource.wait_parse_tip', {
            defaultValue: 'The file has not been parsed yet, can not be viewed',
          }),
        );
        return;
      }
      setCurrentFile(file);
    },
    [setCurrentFile, t],
  );

  if (!filteredFiles?.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-refly-text-2 text-sm leading-5">
        {searchKeyword?.trim()
          ? t('canvas.resourceLibrary.noSearchResults')
          : t('canvas.resourceLibrary.empty')}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="h-full flex flex-col gap-2">
        {filteredFiles?.map((file: DriveFile) => (
          <FileItem
            key={file.fileId}
            file={file}
            isActive={currentFile?.fileId === file.fileId}
            onSelect={handleFileSelect}
          />
        ))}
      </div>
    </div>
  );
});

FileList.displayName = 'MyUploadList';
