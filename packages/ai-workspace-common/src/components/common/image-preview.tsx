import {
  LuDownload,
  LuRotateCcwSquare,
  LuRotateCwSquare,
  LuZoomIn,
  LuZoomOut,
  LuX,
} from 'react-icons/lu';
import { Image, Button } from 'antd';
import { useCallback } from 'react';

const ICON_CLASS = 'text-xl flex items-center justify-center text-gray-200 hover:text-white';

export const ImagePreview = ({
  isPreviewModalVisible,
  setIsPreviewModalVisible,
  imageUrl,
}: {
  isPreviewModalVisible: boolean;
  setIsPreviewModalVisible: (value: boolean) => void;
  imageUrl: string;
  imageTitle?: string;
}) => {
  const handleDownload = useCallback(async () => {
    if (!imageUrl) return;

    const triggerDownload = (href: string) => {
      const link = document.createElement('a');
      link.href = href;
      link.download = 'image';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    try {
      // Add download=1 query parameter to the URL
      const url = new URL(imageUrl);
      url.searchParams.set('download', '1');

      // Fetch the image with the download parameter
      const response = await fetch(url.toString(), {
        // Ensure cookies are sent for auth-protected endpoints
        credentials: 'include',
      });

      if (!response?.ok) {
        throw new Error(`Download failed: ${response?.status ?? 'unknown'}`);
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a temporary object URL for download
      const objectUrl = URL.createObjectURL(blob);

      // Trigger download
      triggerDownload(objectUrl);

      // Clean up the object URL
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to original method if fetch fails
      triggerDownload(imageUrl);
    }
  }, [imageUrl]);

  return (
    <Image
      className="w-0 h-0"
      preview={{
        visible: isPreviewModalVisible,
        src: imageUrl,
        destroyOnHidden: true,
        onVisibleChange: (value) => {
          setIsPreviewModalVisible(value);
        },
        toolbarRender: (
          _,
          {
            transform: { scale },
            actions: { onRotateLeft, onRotateRight, onZoomIn, onZoomOut, onClose },
          },
        ) => (
          <div className="ant-image-preview-operations gap-4 py-2">
            <Button
              type="text"
              icon={<LuDownload className={ICON_CLASS} />}
              onClick={handleDownload}
            />
            <Button
              type="text"
              icon={<LuRotateCcwSquare className={ICON_CLASS} />}
              onClick={onRotateLeft}
            />
            <Button
              type="text"
              icon={<LuRotateCwSquare className={ICON_CLASS} />}
              onClick={onRotateRight}
            />
            <Button type="text" icon={<LuZoomIn className={ICON_CLASS} />} onClick={onZoomIn} />
            <Button
              disabled={scale === 1}
              type="text"
              icon={
                <LuZoomOut
                  className={ICON_CLASS}
                  style={{ color: scale === 1 ? 'rgba(255,255,255,0.3)' : '' }}
                />
              }
              onClick={onZoomOut}
            />
            <Button type="text" icon={<LuX className={ICON_CLASS} />} onClick={onClose} />
          </div>
        ),
      }}
    />
  );
};
