import { useEffect, useMemo, useRef, memo, useState, useCallback } from 'react';
import classNames from 'classnames';
import { Markdown } from 'tiptap-markdown';
import {
  EditorRoot,
  EditorContent,
  EditorInstance,
} from '@refly-packages/ai-workspace-common/components/editor/core/components';

import { handleCommandNavigation } from '@refly-packages/ai-workspace-common/components/editor/core/extensions';
import { defaultExtensions } from '@refly-packages/ai-workspace-common/components/editor/components/extensions';
import { useDocumentStoreShallow } from '@refly-packages/ai-workspace-common/stores/document';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';
import UpdatedImage from '@refly-packages/ai-workspace-common/components/editor/core/extensions/updated-image';

export const ReadonlyEditor = memo(
  ({ docId }: { docId: string }) => {
    const editorRef = useRef<EditorInstance>();
    const document = useDocumentStoreShallow((state) => state.data[docId]?.document);
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    const handleNodeClick = useCallback(
      (event: MouseEvent) => {
        const target = event.target as HTMLElement;

        if (target?.nodeName === 'IMG') {
          const imgSrc = target.getAttribute('src');
          if (imgSrc) {
            setImageUrl(imgSrc);
            setIsPreviewModalVisible(true);
          }
        }
      },
      [setIsPreviewModalVisible, setImageUrl],
    );

    useEffect(() => {
      return () => {
        if (editorRef.current) {
          editorRef?.current?.destroy?.();
        }
      };
    }, [docId]);

    const extensions = useMemo(() => {
      const centeredImage = UpdatedImage.extend({
        selectable: false,
        draggable: false,
        renderHTML({ HTMLAttributes }) {
          const { width, height, style, ...rest } = HTMLAttributes;

          const combinedStyle = [
            width ? `width: ${width}px;` : 'max-width: 100%;',
            height ? `height: ${height}px;` : 'height: auto;',
            'object-fit: contain;',
            style || '',
          ]
            .join(' ')
            .trim();

          const imgAttributes = {
            ...rest,
            width: width ?? undefined,
            height: height ?? undefined,
            style: combinedStyle || null,
            class:
              'border border-muted cursor-pointer rounded-lg hover:opacity-90 transition-opacity',
          };

          return [
            'div',
            { class: 'w-full flex justify-center my-0 !bg-transparent' },
            ['img', imgAttributes],
          ];
        },
      }).configure({
        allowBase64: true,
        inline: false,
      });

      const filteredExtensions = defaultExtensions.filter((ext) => ext.name !== 'image');

      return [...filteredExtensions, centeredImage, Markdown];
    }, [docId]);

    useEffect(() => {
      if (document?.content && editorRef.current) {
        editorRef.current?.commands.setContent(document.content);
      }
    }, [document?.content]);

    return (
      <div className={classNames('w-full', 'ai-note-editor-content-container')}>
        <div className="w-full h-full">
          <EditorRoot>
            <EditorContent
              extensions={extensions}
              onCreate={({ editor }) => {
                editorRef.current = editor;
              }}
              editable={false}
              className="w-full h-full border-muted sm:rounded-lg"
              editorProps={{
                handleDOMEvents: {
                  keydown: (_view, event) => handleCommandNavigation(event),
                  click: (_view, event) => handleNodeClick(event),
                },
                attributes: {
                  class:
                    'prose prose-md prose-headings:font-title font-default focus:outline-none max-w-full dark:text-white',
                  'data-doc-id': docId,
                },
              }}
            />
          </EditorRoot>
        </div>

        <ImagePreview
          isPreviewModalVisible={isPreviewModalVisible}
          setIsPreviewModalVisible={setIsPreviewModalVisible}
          imageUrl={imageUrl}
          imageTitle="image"
        />
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.docId === nextProps.docId,
);
