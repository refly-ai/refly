import { useCurrentEditor } from '@tiptap/react';
import type { FC } from 'react';
import { Spin } from 'antd';
import { lazy, Suspense } from 'react';

// Dynamically import Moveable
const Moveable = lazy(() => import('react-moveable'));

export const ImageResizer: FC<{
  readOnly: boolean;
  selectedImage: HTMLImageElement | null;
  setSelectedImage: (image: HTMLImageElement | null) => void;
}> = ({ readOnly, selectedImage, setSelectedImage }) => {
  const { editor } = useCurrentEditor();

  const updateSelectedImage = () => {
    const imageNode = document.querySelector(
      '.ProseMirror-selectednode img',
    ) as HTMLImageElement | null;

    if (imageNode && imageNode.tagName === 'IMG') {
      setSelectedImage(imageNode);
    } else {
      setSelectedImage(null);
    }
  };

  if (!editor?.isActive('image') || !selectedImage) return null;

  const updateMediaSize = () => {
    if (!selectedImage) return;

    try {
      const selection = editor.state.selection;
      const width = Number(selectedImage.style.width.replace('px', '')) || selectedImage.width;
      const height = Number(selectedImage.style.height.replace('px', '')) || selectedImage.height;

      const setImage = editor.commands.setImage as (options: {
        src: string;
        width: number;
        height: number;
        alt?: string;
        title?: string;
      }) => boolean;

      const imagePos = editor?.state.selection.from;
      const imageNode = imagePos ? editor?.state.doc.nodeAt(imagePos) : null;
      const nodeAttrs = imageNode?.attrs ?? {};

      setImage({
        ...nodeAttrs,
        src: selectedImage.src,
        width: width,
        height: height,
        alt: selectedImage.alt ?? nodeAttrs.alt ?? '',
        title: selectedImage.title ?? nodeAttrs.title ?? '',
      });

      editor?.commands.setNodeSelection(selection.from);

      updateSelectedImage();
    } catch (error) {
      console.error('Error updating image size:', error);
    }
  };

  return (
    <Suspense fallback={<Spin />}>
      <Moveable
        key={`moveable-${selectedImage?.src}-${selectedImage?.width}-${selectedImage?.height}`}
        target={selectedImage}
        container={null}
        origin={false}
        /* Resize event edges */
        edge={false}
        throttleDrag={0}
        /* When resize or scale, keeps a ratio of the width, height. */
        keepRatio={true}
        /* resizable*/
        /* Only one of resizable, scalable, warpable can be used. */
        resizable={!readOnly}
        throttleResize={0}
        onResize={({ target, width, height, delta }) => {
          if (delta[0]) target.style.width = `${width}px`;
          if (delta[1]) target.style.height = `${height}px`;
        }}
        onResizeEnd={() => {
          updateMediaSize();
        }}
        /* scalable */
        /* Only one of resizable, scalable, warpable can be used. */
        scalable={!readOnly}
        throttleScale={0}
        /* Set the direction of resizable */
        renderDirections={['nw', 'ne', 'se', 'sw']}
        onScale={({ target, transform }) => {
          target.style.transform = transform;
        }}
        onScaleEnd={() => {
          updateMediaSize();
        }}
      />
    </Suspense>
  );
};
