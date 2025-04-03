import { useReactFlow } from '@xyflow/react';
import { useCallback, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import html2canvas, { Options } from 'html2canvas';
import { UploadResponse } from '@refly/openapi-schema';
import { useSiderStore } from '@refly-packages/ai-workspace-common/stores/sider';
import { staticPrivateEndpoint } from '@refly-packages/ai-workspace-common/utils/env';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

export const useExportCanvasAsImage = () => {
  const { t } = useTranslation();
  const reactFlowInstance = useReactFlow();
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimapLoading, setIsMinimapLoading] = useState(false);

  // Helper function to convert image to base64
  const imageToBase64 = useCallback(async (imgUrl: string): Promise<string> => {
    try {
      const response = await fetch(imgUrl, {
        mode: 'cors',
        cache: 'no-cache',
        ...(imgUrl.startsWith(staticPrivateEndpoint) ? { credentials: 'include' } : {}),
      });
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to convert image to base64:', error);
      return imgUrl; // Return original URL if conversion fails
    }
  }, []);

  const getCanvasElement = useCallback(
    async (options?: Partial<Options>) => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        if (!reactFlowInstance) {
          throw new Error('React Flow instance not found');
        }

        // get all nodes in the current view
        const nodes = reactFlowInstance.getNodes();
        if (!nodes?.length) {
          message.warning(t('canvas.export.noNodes'));
          return;
        }

        // ensure all nodes are in the view
        reactFlowInstance.fitView();

        // wait for the view to adjust
        await new Promise((resolve) => setTimeout(resolve, 300));

        // get the ReactFlow container
        const reactFlowContainer = document.querySelector('.react-flow');
        if (!reactFlowContainer) {
          throw new Error('React Flow container not found');
        }

        // use html2canvas to create an image
        const canvas = await html2canvas(reactFlowContainer as HTMLElement, {
          backgroundColor: '#EEF4F7',
          scale: 4, // improve the quality of the image
          useCORS: true, // allow cross-origin images
          allowTaint: true, // allow the canvas to be tainted
          logging: false, // disable logging
          imageTimeout: 0, // do not timeout
          foreignObjectRendering: true,
          ...options,
          onclone: async (clonedDoc) => {
            // handle the cloned document, ensure all styles are applied correctly
            const clonedContainer = clonedDoc.querySelector('.react-flow');
            if (clonedContainer) {
              if (!useSiderStore.getState().collapse) {
                if (clonedContainer instanceof HTMLElement) {
                  clonedContainer.style.left = '-220px';
                }
              }

              // hide miniMap, prevent it from being exported to the image
              const miniMap = clonedContainer.querySelector('.react-flow__minimap');
              if (miniMap instanceof HTMLElement) {
                miniMap.style.display = 'none';
              }

              // ensure the background elements are visible
              const backgrounds = clonedContainer.querySelectorAll('.react-flow__background');
              for (const bg of backgrounds) {
                if (bg instanceof HTMLElement) {
                  bg.style.opacity = '1';
                }
              }

              // handle images: download and convert to base64
              const images = clonedContainer.querySelectorAll('img');
              const imagePromises = Array.from(images).map(async (img) => {
                try {
                  if (img.src && !img.src.startsWith('data:')) {
                    const base64Data = await imageToBase64(img.src);
                    img.src = base64Data;
                  }
                  img.crossOrigin = 'anonymous';
                } catch (error) {
                  console.error('Error processing image:', error);
                }
              });

              // Wait for all image conversions to complete
              await Promise.all(imagePromises);
            }
          },
        });
        return canvas;
      } catch (error) {
        console.error('Error exporting canvas as image:', error);
        message.error(t('canvas.export.error'));
      } finally {
        setIsLoading(false);
      }
    },
    [reactFlowInstance],
  );

  const exportCanvasAsImage = useCallback(
    async (canvasName = 'canvas', options?: Partial<Options>) => {
      try {
        // use html2canvas to create an image
        const canvas = await getCanvasElement(options);

        // convert the canvas to an image
        const dataUrl = canvas.toDataURL('image/png');

        // create a download link
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${canvasName || 'canvas'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        message.success(t('canvas.export.success'));
      } catch (error) {
        console.error('Error exporting canvas as image:', error);
        message.error(t('canvas.export.error'));
      }
    },
    [reactFlowInstance, t, imageToBase64],
  );

  const getMinimap = useCallback(async (): Promise<Blob | null> => {
    if (isMinimapLoading) return null;

    setIsMinimapLoading(true);
    try {
      if (!reactFlowInstance) {
        throw new Error('React Flow instance not found');
      }

      const nodes = reactFlowInstance.getNodes();
      if (!nodes?.length) {
        return null;
      }

      // wait for the view to adjust
      await new Promise((resolve) => setTimeout(resolve, 50));

      // find the minimap container element
      const minimapContainer = document.querySelector('.react-flow__minimap');
      if (!minimapContainer) {
        throw new Error('MiniMap container not found');
      }

      // find the svg element in the minimap
      const svgElement = minimapContainer.querySelector('svg');
      if (!svgElement) {
        throw new Error('MiniMap SVG element not found');
      }

      // create a clone of the svg data
      const svgClone = svgElement.cloneNode(true) as SVGSVGElement;

      // set the svg style to ensure visibility
      svgClone.style.backgroundColor = 'white';

      // adjust the viewBox to ensure the content maximizes the svg and is centered
      const contentElements = svgClone.querySelectorAll('rect, image');
      if (contentElements?.length > 0) {
        // calculate the bounding box of the content
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (const element of contentElements) {
          // use the element's attribute values first
          if (element instanceof SVGGraphicsElement) {
            let x = 0;
            let y = 0;
            let width = 0;
            let height = 0;
            let hasValues = false;

            // for rect and image elements, read the attributes directly
            if ('x' in element && 'y' in element && 'width' in element && 'height' in element) {
              const xAttr = Number.parseFloat(element.getAttribute('x') || '0');
              const yAttr = Number.parseFloat(element.getAttribute('y') || '0');
              const widthAttr = Number.parseFloat(element.getAttribute('width') || '0');
              const heightAttr = Number.parseFloat(element.getAttribute('height') || '0');

              if (
                !Number.isNaN(xAttr) &&
                !Number.isNaN(yAttr) &&
                !Number.isNaN(widthAttr) &&
                !Number.isNaN(heightAttr)
              ) {
                x = xAttr;
                y = yAttr;
                width = widthAttr;
                height = heightAttr;
                hasValues = true;
              }
            }

            // if the attributes are not directly read, try using getBBox
            if (!hasValues) {
              try {
                const bbox = element.getBBox();
                if (bbox && bbox.width > 0 && bbox.height > 0) {
                  x = bbox.x;
                  y = bbox.y;
                  width = bbox.width;
                  height = bbox.height;
                  hasValues = true;
                }
              } catch (e) {
                console.debug('无法获取元素的边界框:', e);
              }
            }

            if (hasValues) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x + width);
              maxY = Math.max(maxY, y + height);
            }
          }
        }

        // ensure there is a valid bounding box
        if (
          Number.isFinite(minX) &&
          Number.isFinite(minY) &&
          Number.isFinite(maxX) &&
          Number.isFinite(maxY)
        ) {
          const padding = 100;
          minX -= padding;
          minY -= padding;
          maxX += padding;
          maxY += padding;

          // calculate the width and height
          const width = maxX - minX;
          const height = maxY - minY;

          // set the new viewBox
          svgClone.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);

          // keep the aspect ratio but set to a suitable size
          const aspectRatio = width / height;
          const maxDimension = 800;

          if (aspectRatio > 1) {
            // width is greater than height
            svgClone.setAttribute('width', `${maxDimension}`);
            svgClone.setAttribute('height', `${maxDimension / aspectRatio}`);
          } else {
            // height is greater than width
            svgClone.setAttribute('width', `${maxDimension * aspectRatio}`);
            svgClone.setAttribute('height', `${maxDimension}`);
          }

          // set the preserveAspectRatio property to ensure centering
          svgClone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        }
      }

      // remove unnecessary masks
      const masks = svgClone.querySelectorAll('.react-flow__minimap-mask');
      for (const mask of masks) {
        mask.parentNode?.removeChild(mask);
      }

      // handle all image elements in the svg
      const images = svgClone.querySelectorAll('image');
      const imagePromises = Array.from(images).map(async (img) => {
        const href = img?.getAttribute('href');
        if (href && !href.startsWith('data:')) {
          try {
            const base64Data = await imageToBase64(href);
            img.setAttribute('href', base64Data);
          } catch (error) {
            console.error('Error processing minimap image:', error);
          }
        }
      });

      await Promise.all(imagePromises);

      // convert the svg to a string
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);

      // create an svg blob
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });

      // Convert SVG Blob to PNG
      const pngBlob = await svgBlobToPngBlob(svgBlob, svgClone);
      return pngBlob ?? svgBlob;
    } catch (error) {
      console.error('Error exporting minimap as image:', error);
      return null;
    } finally {
      setIsMinimapLoading(false);
    }
  }, [reactFlowInstance, isMinimapLoading, imageToBase64]);

  const svgBlobToPngBlob = useCallback(
    async (svgBlob: Blob, svgElement: SVGSVGElement): Promise<Blob | null> => {
      try {
        const svgUrl = URL.createObjectURL(svgBlob);

        const width = svgElement?.width?.baseVal?.value ?? 800;
        const height = svgElement?.height?.baseVal?.value ?? 600;

        const img = new Image();
        img.width = width;
        img.height = height;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = svgUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('canvas context not found');
        }

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        URL.revokeObjectURL(svgUrl);

        return new Promise((resolve) => {
          canvas.toBlob(
            (blob) => {
              resolve(blob);
            },
            'image/png',
            1.0,
          );
        });
      } catch (error) {
        console.error('Error converting SVG to PNG:', error);
        return null;
      }
    },
    [],
  );

  const uploadCanvasCover = useCallback(async () => {
    const canvas = await getCanvasElement({ scale: 1 });
    return new Promise<UploadResponse['data']>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          getClient()
            .upload({
              body: { file: blob, visibility: 'public' },
            })
            .then(({ data }) => {
              if (!data?.success) {
                reject(new Error('Failed to upload canvas cover'));
              }
              resolve(data?.data);
            })
            .catch(reject);
        }
      });
    });
  }, [getCanvasElement]);

  return {
    getCanvasElement,
    exportCanvasAsImage,
    isLoading,
    getMinimap,
    isMinimapLoading,
    svgBlobToPngBlob,
    uploadCanvasCover,
  };
};
