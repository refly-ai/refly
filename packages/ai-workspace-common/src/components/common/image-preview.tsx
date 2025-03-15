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
  imageTitle,
}: {
  isPreviewModalVisible: boolean;
  setIsPreviewModalVisible: (value: boolean) => void;
  imageUrl: string;
  imageTitle?: string;
}) => {
  const handleDownload = useCallback(() => {
    if (!imageUrl) return;

    // Create a temporary link element
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageTitle ?? 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [imageUrl, imageTitle]);

  return (
    <Image
      className="w-0 h-0"
      preview={{
        visible: isPreviewModalVisible,
        src: imageUrl,
        destroyOnClose: true,
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
