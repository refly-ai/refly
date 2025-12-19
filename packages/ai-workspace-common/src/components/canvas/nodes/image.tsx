import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Position } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';

import { CustomHandle } from './shared/custom-handle';
import { ImageNodeProps } from './shared/types';
import { NodeHeader } from './shared/node-header';
import {
  nodeActionEmitter,
  createNodeEventName,
  cleanupNodeEvents,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly/utils/id';
import { IContextItem } from '@refly/common-types';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import Moveable from 'react-moveable';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import cn from 'classnames';

import { NodeActionButtons } from './shared/node-action-buttons';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import {
  useNodeData,
  useNodeExecutionStatus,
} from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-preview-control';
import { NodeExecutionOverlay } from './shared/node-execution-overlay';
import { NodeExecutionStatus } from './shared/node-execution-status';

const NODE_SIDE_CONFIG = { width: 320, height: 'auto' };
export const ImageNode = memo(
  ({ id, data, isPreview, selected, hideHandles, onNodeClick }: ImageNodeProps) => {
    const { metadata } = data ?? {};
    const imageUrl = metadata?.imageUrl ?? '';
    const [isHovered, setIsHovered] = useState(false);

    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);
    const targetRef = useRef<HTMLDivElement>(null);
    const { addNode } = useAddNode();
    const { addToContext } = useAddToContext();
    const { deleteNode } = useDeleteNode();
    const setNodeDataByEntity = useSetNodeDataByEntity();
    const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();
    const { readonly, canvasId } = useCanvasContext();
    const { setNodeStyle } = useNodeData();
    const { previewNode } = useNodePreviewControl({ canvasId });

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      onHoverStart();
    }, [onHoverStart]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      onHoverEnd();
    }, [onHoverEnd]);

    // Get node execution status
    const { status: executionStatus } = useNodeExecutionStatus({
      canvasId: canvasId || '',
      nodeId: id,
    });

    const handleAddToContext = useCallback(() => {
      addToContext({
        type: 'image',
        title: data.title,
        entityId: data.entityId,
        metadata: data.metadata,
      });
    }, [data, addToContext]);

    const handleDelete = useCallback(() => {
      deleteNode({
        id,
        type: 'image',
        data,
        position: { x: 0, y: 0 },
      } as unknown as CanvasNode);
    }, [id, data, deleteNode]);

    const handleAskAI = useCallback(
      (dragCreateInfo?: NodeDragCreateInfo) => {
        const { position, connectTo } = getConnectionInfo(
          { entityId: data.entityId, type: 'image' },
          dragCreateInfo,
        );

        addNode(
          {
            type: 'skill',
            data: {
              title: 'Skill',
              entityId: genSkillID(),
              metadata: {
                contextItems: [
                  {
                    type: 'image',
                    title: data.title,
                    entityId: data.entityId,
                    metadata: data.metadata,
                  },
                ] as IContextItem[],
              },
            },
            position,
          },
          connectTo,
          false,
          true,
        );
      },
      [data, addNode, getConnectionInfo],
    );

    const handleDownload = useCallback(async () => {
      if (!imageUrl) return;

      nodeActionEmitter.emit(createNodeEventName(id, 'download.started'));

      // Build a safe filename preserving extension and avoiding illegal characters
      const sanitizeFileName = (name: string): string => {
        return (name || 'image')
          .replace(/[\\/:*?"<>|]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const getExtFromContentType = (contentType?: string | null): string => {
        const ct = (contentType ?? '').toLowerCase();
        if (!ct) return '';
        if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return 'jpg';
        if (ct.includes('image/png')) return 'png';
        if (ct.includes('image/webp')) return 'webp';
        if (ct.includes('image/gif')) return 'gif';
        if (ct.includes('image/svg')) return 'svg';
        if (ct.includes('image/bmp')) return 'bmp';
        if (ct.includes('image/tiff')) return 'tiff';
        return '';
      };

      const getExtFromUrl = (u: string): string => {
        try {
          const { pathname } = new URL(u);
          const file = pathname.split('/').pop() ?? '';
          const m = file.match(/\.([a-zA-Z0-9]{1,8})$/);
          return (m?.[1] ?? '').toLowerCase();
        } catch {
          return '';
        }
      };

      const buildSafeFileName = (base: string, extHint?: string): string => {
        const MAX_BASE_LEN = 250; // keep filename manageable
        const sanitizedBase = sanitizeFileName(base);
        const ext = (extHint ?? '').replace(/^\./, '').toLowerCase();
        const hasExt = !!ext && new RegExp(`\\.${ext}$`, 'i').test(sanitizedBase);
        const truncatedBase =
          sanitizedBase.length > MAX_BASE_LEN
            ? sanitizedBase.slice(0, MAX_BASE_LEN)
            : sanitizedBase;
        return hasExt ? truncatedBase : `${truncatedBase}${ext ? `.${ext}` : ''}`;
      };

      const triggerDownload = (href: string, fileName?: string) => {
        const link = document.createElement('a');
        link.href = href;
        link.download = fileName ?? sanitizeFileName(data?.title ?? 'image');
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      let completedEmitted = false;
      const baseTitle = data?.title ?? 'image';

      try {
        const url = new URL(imageUrl);
        url.searchParams.set('download', '1');

        const response = await fetch(url.toString(), {
          credentials: 'include',
        });

        if (!response?.ok) {
          throw new Error(`Download failed: ${response?.status ?? 'unknown'}`);
        }

        const contentType = response.headers?.get?.('content-type') ?? '';
        const inferredExt = getExtFromContentType(contentType) || getExtFromUrl(imageUrl) || '';
        const fileName = buildSafeFileName(baseTitle, inferredExt || 'png');

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        triggerDownload(objectUrl, fileName);
        URL.revokeObjectURL(objectUrl);
        nodeActionEmitter.emit(createNodeEventName(id, 'download.completed'), {
          success: true,
          fileName,
        });
        completedEmitted = true;
      } catch (error) {
        console.error('Download failed:', error);
        // Fallback to original method if fetch fails (may ignore filename on cross-origin)
        const fallbackExt = getExtFromUrl(imageUrl) || 'png';
        const fallbackName = buildSafeFileName(baseTitle, fallbackExt);
        triggerDownload(imageUrl, fallbackName);
        nodeActionEmitter.emit(createNodeEventName(id, 'download.completed'), {
          success: true,
          fileName: fallbackName,
        });
        completedEmitted = true;
      } finally {
        if (!completedEmitted) {
          nodeActionEmitter.emit(createNodeEventName(id, 'download.completed'), {
            success: false,
            fileName: baseTitle,
          });
        }
      }
    }, [imageUrl, data?.title, id]);

    const handleImageClick = useCallback(() => {
      // Create a node object for preview
      const nodeForPreview = {
        id,
        type: 'image' as const,
        data,
        position: { x: 0, y: 0 },
      };
      previewNode(nodeForPreview);
    }, [previewNode, id, data]);

    const onTitleChange = (newTitle: string) => {
      setNodeDataByEntity(
        {
          entityId: data.entityId,
          type: 'image',
        },
        {
          title: newTitle,
        },
      );
    };

    useEffect(() => {
      setNodeStyle(id, NODE_SIDE_CONFIG);
    }, [id, setNodeStyle]);

    // Add event handling
    useEffect(() => {
      // Create node-specific event handlers
      const handleNodeAddToContext = () => handleAddToContext();
      const handleNodeDelete = () => handleDelete();
      const handleNodeAskAI = (event?: { dragCreateInfo?: NodeDragCreateInfo }) => {
        handleAskAI(event?.dragCreateInfo);
      };
      const handleNodeDownload = () => handleDownload();

      // Register events with node ID
      nodeActionEmitter.on(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);
      nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);
      nodeActionEmitter.on(createNodeEventName(id, 'download'), handleNodeDownload);

      return () => {
        // Cleanup events when component unmounts
        nodeActionEmitter.off(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);
        nodeActionEmitter.off(createNodeEventName(id, 'download'), handleNodeDownload);

        // Clean up all node events
        cleanupNodeEvents(id);
      };
    }, [id, handleAddToContext, handleDelete, handleAskAI, handleDownload]);

    const moveableRef = useRef<Moveable>(null);

    const resizeMoveable = useCallback((width: number, height: number) => {
      moveableRef.current?.request('resizable', { width, height });
    }, []);

    useEffect(() => {
      setTimeout(() => {
        if (!targetRef.current || readonly) return;
        const { offsetWidth, offsetHeight } = targetRef.current;
        resizeMoveable(offsetWidth, offsetHeight);
      }, 1);
    }, [resizeMoveable, targetRef.current?.offsetHeight]);

    if (!data || !imageUrl) {
      return null;
    }

    return (
      <div
        onMouseEnter={!isPreview ? handleMouseEnter : undefined}
        onMouseLeave={!isPreview ? handleMouseLeave : undefined}
        style={NODE_SIDE_CONFIG}
        onClick={onNodeClick}
        className="relative"
      >
        <div className="absolute -top-8 left-3 z-10 flex items-center h-8 gap-2 w-[40%]">
          <div
            className={cn(
              'flex-1 min-w-0 rounded-t-lg px-1 py-1 transition-opacity duration-200 bg-transparent',
              {
                'opacity-100': isHovered,
                'opacity-0': !isHovered,
              },
            )}
          >
            <NodeHeader
              title={data.title}
              type="image"
              canEdit={!readonly}
              updateTitle={onTitleChange}
            />
          </div>
        </div>

        {!isPreview && !readonly && (
          <NodeActionButtons
            nodeId={id}
            nodeType="image"
            isNodeHovered={isHovered}
            isSelected={selected}
          />
        )}

        {!isPreview && !hideHandles && (
          <>
            <CustomHandle
              id={`${id}-target`}
              nodeId={id}
              type="target"
              position={Position.Left}
              isConnected={false}
              isNodeHovered={isHovered}
              nodeType="image"
            />
            <CustomHandle
              id={`${id}-source`}
              nodeId={id}
              type="source"
              position={Position.Right}
              isConnected={false}
              isNodeHovered={isHovered}
              nodeType="image"
            />
          </>
        )}

        <NodeExecutionOverlay status={executionStatus} />

        <div
          className={cn(
            'relative z-10 rounded-2xl overflow-hidden flex items-center justify-center',
            {
              'w-full': !isPreview,
              'max-w-64 max-h-64': isPreview,
            },
          )}
          style={{ cursor: isPreview || readonly ? 'default' : 'pointer' }}
          onClick={handleImageClick}
        >
          {/* Node execution status badge */}
          <NodeExecutionStatus status={executionStatus} />

          <img
            src={imageUrl}
            alt={data.title || 'Image'}
            className={cn('w-full h-full', {
              'object-cover': !isPreview,
              'object-contain max-w-64 max-h-64': isPreview,
            })}
          />
        </div>
      </div>
    );
  },
);

ImageNode.displayName = 'ImageNode';
