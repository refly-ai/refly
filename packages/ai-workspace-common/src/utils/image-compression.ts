/* Image compression helper for cover uploads and other image uploads */
interface CompressOptions {
  maxBytes: number;
  maxDimension: number;
  qualityStart: number;
  qualityMin: number;
  maxAttempts: number;
  minDimension: number;
  enableLog?: boolean;
  logPrefix?: string;
}

interface CompressResult {
  file: File;
  previewUrl: string;
  wasCompressed: boolean;
}

const createObjectUrl = (file: File): string => {
  const url = URL.createObjectURL(file);
  return url;
};

const loadImageFromFile = (file: File, enableLog?: boolean, logPrefix?: string) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (!file || file.size === 0) {
      reject(new Error('Invalid file: file is empty or null'));
      return;
    }

    let url: string | null = null;
    try {
      url = createObjectUrl(file);
      if (!url) {
        reject(new Error('Failed to create object URL'));
        return;
      }
    } catch (error) {
      reject(
        new Error(
          `Failed to create object URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
      return;
    }

    const img = document.createElement('img');
    const cleanup = () => {
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch (err) {
          if (enableLog) {
            console.warn(logPrefix ?? '[ImageCompression]', 'Failed to revoke object URL:', err);
          }
        }
      }
    };

    img.onload = () => {
      if (img.width === 0 || img.height === 0) {
        cleanup();
        reject(new Error('Invalid image: width or height is 0'));
        return;
      }
      cleanup();
      resolve(img);
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
};

export const compressImageWithPreview = async (
  file: File,
  options: CompressOptions,
): Promise<CompressResult> => {
  const {
    maxBytes,
    maxDimension,
    qualityStart,
    qualityMin,
    maxAttempts,
    minDimension,
    enableLog,
    logPrefix,
  } = options;

  const prefix = logPrefix ?? '[ImageCompression]';

  try {
    const image = await loadImageFromFile(file, enableLog, prefix);

    let targetWidth = image.width;
    let targetHeight = image.height;
    let quality = qualityStart;
    let attempts = 0;
    let blob: Blob | null = null;

    if (targetWidth < 1) targetWidth = 1;
    if (targetHeight < 1) targetHeight = 1;

    const maxDim = Math.max(targetWidth, targetHeight);
    if (maxDim > maxDimension) {
      const scale = maxDimension / maxDim;
      targetWidth = Math.max(1, Math.floor(targetWidth * scale));
      targetHeight = Math.max(1, Math.floor(targetHeight * scale));
    }

    while (attempts < maxAttempts) {
      if (targetWidth < minDimension || targetHeight < minDimension) {
        break;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context not available');
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.clearRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

      // eslint-disable-next-line no-await-in-loop
      blob = await canvasToBlob(canvas, quality);

      if (enableLog) {
        console.info(
          prefix,
          'Attempt',
          attempts + 1,
          'quality',
          quality.toFixed(2),
          'sizeMB',
          (blob.size / 1024 / 1024).toFixed(2),
          'dimensions',
          `${targetWidth}x${targetHeight}`,
        );
      }

      if (blob.size <= maxBytes) {
        break;
      }

      if (quality > qualityMin) {
        quality = Math.max(qualityMin, quality * 0.9);
      } else {
        targetWidth = Math.max(minDimension, Math.floor(targetWidth * 0.9));
        targetHeight = Math.max(minDimension, Math.floor(targetHeight * 0.9));
      }
      attempts += 1;
    }

    if (!blob) {
      throw new Error('Compression failed: no blob output after attempts');
    }

    const originalExt = file.name.match(/\.[^.]+$/)?.[0] ?? '.jpg';
    const fileName = `${file.name.replace(/\.[^.]+$/, '')}${
      originalExt === '.png' ? '.jpg' : originalExt
    }`;
    const compressedFile = new File([blob], fileName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    const previewUrl = createObjectUrl(compressedFile);

    if (enableLog) {
      console.info(
        prefix,
        'Compressed result',
        'finalSizeMB',
        (compressedFile.size / 1024 / 1024).toFixed(2),
        'ratio',
        (compressedFile.size / file.size).toFixed(2),
        'name',
        compressedFile.name,
      );
    }

    return {
      file: compressedFile,
      previewUrl,
      wasCompressed: true,
    };
  } catch (error) {
    if (enableLog) {
      console.warn(prefix, 'Compression failed, fallback to original:', error);
    }
    const previewUrl = createObjectUrl(file);
    return {
      file,
      previewUrl,
      wasCompressed: false,
    };
  }
};
