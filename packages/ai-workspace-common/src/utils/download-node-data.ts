import { message } from 'antd';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { TFunction } from 'i18next';
import { getFileExtensionFromType } from '@refly/utils/artifact';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import { getDriveFileUrl } from '@refly-packages/ai-workspace-common/hooks/canvas/use-drive-file-url';
import type { DriveFile } from '@refly/openapi-schema';

// Interface for node data structure
interface NodeData {
  nodeId: string;
  nodeType: string;
  entityId: string;
  title?: string;
  metadata?: {
    [key: string]: any;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    content?: string;
    type?: string;
    storageKey?: string;
    status?: string;
    url?: string;
  };
}

// Create a download link and trigger download
const triggerDownload = (href: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Download file from URL with authentication
const downloadFromUrl = async (url: string, fileName: string): Promise<void> => {
  try {
    // Fetch the file with authentication (do not force server-side download header)
    const response = await fetch(url, {
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
    triggerDownload(objectUrl, fileName);

    // Clean up the object URL
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error('Download failed:', error);
    // Fallback to direct download if fetch fails
    triggerDownload(url, fileName);
  }
};

// Download text content as file
const downloadTextContent = (content: string, fileName: string, mimeType = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  URL.revokeObjectURL(url);
};

// Get appropriate file extension for node type
const getFileExtension = (nodeType: string, metadata?: any): string => {
  switch (nodeType) {
    case 'image':
      return 'jpg'; // Default for images
    case 'video':
      return 'mp4'; // Default for videos
    case 'audio':
      return 'mp3'; // Default for audio
    case 'document':
      return 'md'; // Markdown for documents
    case 'codeArtifact':
      return getFileExtensionFromType(metadata?.type || 'text/html');
    case 'skillResponse':
      return 'txt'; // Plain text for skill responses
    case 'memo':
      return 'txt'; // Plain text for memos
    case 'resource':
      return 'txt'; // Default to text, could be enhanced based on resource type
    case 'website':
      return 'html'; // HTML for websites
    default:
      return 'txt';
  }
};

// Get sanitized filename
const getSanitizedFileName = (
  title: string,
  nodeType: string,
  metadata?: any,
  maxTitleLength = 10,
): string => {
  const extension = getFileExtension(nodeType, metadata);
  const timestamp = Date.now();

  // Sanitize title and truncate to max length
  let sanitizedTitle = '';
  if (title) {
    // Replace spaces with underscores
    let cleanedTitle = title.replace(/\s+/g, '_');
    // Remove all special characters, keep only alphanumeric, Chinese characters, and underscores
    // \w matches [a-zA-Z0-9_], \u4e00-\u9fa5 matches Chinese characters
    cleanedTitle = cleanedTitle.replace(/[^\w\u4e00-\u9fa5]/g, '');
    // Remove consecutive underscores
    cleanedTitle = cleanedTitle.replace(/_+/g, '_');
    // Trim underscores from start and end
    cleanedTitle = cleanedTitle.replace(/^_+|_+$/g, '');
    // Truncate to max length
    sanitizedTitle = cleanedTitle.slice(0, maxTitleLength);
  }

  // Build filename: [title]_[timestamp].[extension]
  // If no title, use nodeType as fallback
  const namePrefix = sanitizedTitle || nodeType;
  return `${namePrefix}_${timestamp}.${extension}`;
};

// Check if node has downloadable data
export const hasDownloadableData = (nodeData: NodeData): boolean => {
  const { nodeType, entityId, metadata = {} } = nodeData;

  // Drive file support: if fileId exists, it is downloadable
  if (metadata?.fileId) {
    return true;
  }

  switch (nodeType) {
    case 'image':
      return Boolean(metadata.imageUrl);

    case 'video':
      return Boolean(metadata.videoUrl);

    case 'audio':
      return Boolean(metadata.audioUrl);

    case 'document':
      return Boolean(metadata.content || entityId);

    case 'codeArtifact':
      return Boolean(metadata.content || entityId);

    case 'skillResponse':
      return Boolean(entityId);

    case 'memo':
      return Boolean(metadata.content);

    case 'resource':
      return Boolean(metadata.content || entityId);

    case 'website':
      return Boolean(metadata.url);

    default:
      return false;
  }
};

// Main download function for different node types
export const downloadNodeData = async (nodeData: NodeData, t: TFunction): Promise<void> => {
  const { nodeType, entityId, title = '', metadata = {} } = nodeData;
  const fileName = getSanitizedFileName(title, nodeType, metadata);

  try {
    // Drive file support: prioritize drive file download when fileId exists
    if (metadata?.fileId) {
      const isSharePage = location?.pathname?.startsWith('/share/') ?? false;

      // Construct minimal DriveFile object for URL generation
      const driveFile: DriveFile = {
        fileId: metadata.fileId,
        canvasId: metadata?.canvasId ?? '',
        name: title || 'Untitled',
        type: metadata?.type ?? 'application/octet-stream',
        category: metadata?.category,
        source: metadata?.source,
        scope: metadata?.scope,
        size: metadata?.size,
        summary: metadata?.summary,
        variableId: metadata?.variableId,
        resultId: metadata?.resultId,
        resultVersion: metadata?.resultVersion,
        content: metadata?.content,
        createdAt: metadata?.createdAt,
        updatedAt: metadata?.updatedAt,
      };

      const { fileUrl } = getDriveFileUrl(driveFile, isSharePage, false);
      if (!fileUrl) {
        message.error(t('canvas.resourceLibrary.download.invalidUrl'));
        return;
      }

      const fetchOptions: RequestInit = { credentials: 'include' };
      const response = await fetch(fileUrl, fetchOptions);
      if (!response?.ok) {
        throw new Error(`Download failed: ${response?.status ?? 'unknown'}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl, fileName);
      message.success(t('canvas.resourceLibrary.download.success'));
      URL.revokeObjectURL(objectUrl);
      return;
    }

    switch (nodeType) {
      case 'image': {
        const imageUrl = metadata.imageUrl;
        if (!imageUrl) {
          message.error(t('canvas.download.error.noImageUrl', 'No image URL found'));
          return;
        }
        await downloadFromUrl(imageUrl, fileName);
        message.success(t('canvas.download.success.image', { fileName }));
        break;
      }

      case 'video': {
        const videoUrl = metadata.videoUrl;
        if (!videoUrl) {
          message.error(t('canvas.download.error.noVideoUrl', 'No video URL found'));
          return;
        }
        await downloadFromUrl(videoUrl, fileName);
        message.success(t('canvas.download.success.video', { fileName }));
        break;
      }

      case 'audio': {
        const audioUrl = metadata.audioUrl;
        if (!audioUrl) {
          message.error(t('canvas.download.error.noAudioUrl', 'No audio URL found'));
          return;
        }
        await downloadFromUrl(audioUrl, fileName);
        message.success(t('canvas.download.success.audio', { fileName }));
        break;
      }

      case 'document': {
        let content = metadata.content;
        if (!content && entityId) {
          const { data } = await getClient().getDocumentDetail({
            query: { docId: entityId },
          });
          content = data?.data?.content;
        }
        if (!content) {
          message.error(t('canvas.download.error.noDocumentContent', 'No document content found'));
          return;
        }
        downloadTextContent(content, fileName, 'text/markdown');
        message.success(t('canvas.download.success.document', { fileName }));
        break;
      }

      case 'codeArtifact': {
        let content = metadata.content;
        if (!content && entityId) {
          const { data } = await getClient().getCodeArtifactDetail({
            query: { artifactId: entityId },
          });
          content = data?.data?.content;
        }
        if (!content) {
          message.error(t('canvas.download.error.noCodeContent', 'No code content found'));
          return;
        }
        downloadTextContent(content, fileName, 'text/plain');
        message.success(t('canvas.download.success.code', { fileName }));
        break;
      }

      case 'skillResponse': {
        let content = '';
        if (entityId) {
          const { data } = await getClient().getActionResult({
            query: { resultId: entityId },
          });
          content =
            data?.data?.steps
              ?.map((step) => step?.content || '')
              .filter(Boolean)
              .join('\n\n') || '';
        }
        if (!content) {
          message.error(
            t('canvas.download.error.noSkillContent', 'No skill response content found'),
          );
          return;
        }
        downloadTextContent(content, fileName, 'text/plain');
        message.success(t('canvas.download.success.skillResponse', { fileName }));
        break;
      }

      case 'memo': {
        const content = metadata.content || '';
        if (!content) {
          message.error(t('canvas.download.error.noMemoContent', 'No memo content found'));
          return;
        }
        downloadTextContent(content, fileName, 'text/plain');
        message.success(t('canvas.download.success.memo', { fileName }));
        break;
      }

      case 'resource': {
        let content = metadata.content;
        if (!content && entityId) {
          const { data } = await getClient().getResourceDetail({
            query: { resourceId: entityId },
          });
          content = data?.data?.content;
        }
        if (!content) {
          message.error(t('canvas.download.error.noResourceContent', 'No resource content found'));
          return;
        }
        downloadTextContent(content, fileName, 'text/plain');
        message.success(t('canvas.download.success.resource', { fileName }));
        break;
      }

      case 'website': {
        const url = metadata.url;
        if (!url) {
          message.error(t('canvas.download.error.noWebsiteUrl', 'No website URL found'));
          return;
        }
        // For websites, we can download the URL as a text file or open it
        downloadTextContent(url, fileName.replace(/\.[^/.]+$/, '.txt'), 'text/plain');
        message.success(t('canvas.download.success.website', { fileName }));
        break;
      }

      default: {
        message.warning(
          t('canvas.download.error.unsupportedType', `Unsupported node type: ${nodeType}`),
        );
        break;
      }
    }
  } catch (error) {
    console.error('Download failed:', error);
    message.error(t('canvas.download.error.general', 'Download failed. Please try again.'));
  }
};

// Check if node has copyable data
export const hasCopyableData = (nodeData: NodeData): boolean => {
  const { nodeType, entityId, metadata = {} } = nodeData;

  switch (nodeType) {
    case 'image':
      return Boolean(metadata.imageUrl);

    case 'video':
      return Boolean(metadata.videoUrl);

    case 'audio':
      return Boolean(metadata.audioUrl);

    case 'document':
      return Boolean(metadata.content || entityId);

    case 'codeArtifact':
      return Boolean(metadata.content || entityId);

    case 'skillResponse':
      return Boolean(entityId);

    case 'memo':
      return Boolean(metadata.content);

    case 'resource':
      return Boolean(metadata.content || entityId);

    case 'website':
      return Boolean(metadata.url);

    default:
      return false;
  }
};

// Main copy function for different node types
export const copyNodeData = async (nodeData: NodeData, t: TFunction): Promise<void> => {
  const { nodeType, entityId, metadata = {} } = nodeData;

  try {
    switch (nodeType) {
      case 'image': {
        const imageUrl = metadata.imageUrl;
        if (!imageUrl) {
          message.error(t('canvas.copy.error.noImageUrl', 'No image URL found'));
          return;
        }
        copyToClipboard(imageUrl);
        message.success(t('canvas.copy.success.image', 'Image URL copied to clipboard'));
        break;
      }

      case 'video': {
        const videoUrl = metadata.videoUrl;
        if (!videoUrl) {
          message.error(t('canvas.copy.error.noVideoUrl', 'No video URL found'));
          return;
        }
        copyToClipboard(videoUrl);
        message.success(t('canvas.copy.success.video', 'Video URL copied to clipboard'));
        break;
      }

      case 'audio': {
        const audioUrl = metadata.audioUrl;
        if (!audioUrl) {
          message.error(t('canvas.copy.error.noAudioUrl', 'No audio URL found'));
          return;
        }
        copyToClipboard(audioUrl);
        message.success(t('canvas.copy.success.audio', 'Audio URL copied to clipboard'));
        break;
      }

      case 'document': {
        let content = metadata.content;
        if (!content && entityId) {
          const { data } = await getClient().getDocumentDetail({
            query: { docId: entityId },
          });
          content = data?.data?.content;
        }
        if (!content) {
          message.error(t('canvas.copy.error.noDocumentContent', 'No document content found'));
          return;
        }
        copyToClipboard(content);
        message.success(t('canvas.copy.success.document', 'Document content copied to clipboard'));
        break;
      }

      case 'codeArtifact': {
        let content = metadata.content;
        if (!content && entityId) {
          const { data } = await getClient().getCodeArtifactDetail({
            query: { artifactId: entityId },
          });
          content = data?.data?.content;
        }
        if (!content) {
          message.error(t('canvas.copy.error.noCodeContent', 'No code content found'));
          return;
        }
        copyToClipboard(content);
        message.success(t('canvas.copy.success.code', 'Code content copied to clipboard'));
        break;
      }

      case 'skillResponse': {
        let content = '';
        if (entityId) {
          const { data } = await getClient().getActionResult({
            query: { resultId: entityId },
          });
          content =
            data?.data?.steps
              ?.map((step) => step?.content || '')
              .filter(Boolean)
              .join('\n\n') || '';
        }
        if (!content) {
          message.error(t('canvas.copy.error.noSkillContent', 'No skill response content found'));
          return;
        }
        copyToClipboard(content);
        message.success(
          t('canvas.copy.success.skillResponse', 'Skill response copied to clipboard'),
        );
        break;
      }

      case 'memo': {
        const content = metadata.content || '';
        if (!content) {
          message.error(t('canvas.copy.error.noMemoContent', 'No memo content found'));
          return;
        }
        copyToClipboard(content);
        message.success(t('canvas.copy.success.memo', 'Memo content copied to clipboard'));
        break;
      }

      case 'resource': {
        let content = metadata.content;
        if (!content && entityId) {
          const { data } = await getClient().getResourceDetail({
            query: { resourceId: entityId },
          });
          content = data?.data?.content;
        }
        if (!content) {
          message.error(t('canvas.copy.error.noResourceContent', 'No resource content found'));
          return;
        }
        copyToClipboard(content);
        message.success(t('canvas.copy.success.resource', 'Resource content copied to clipboard'));
        break;
      }

      case 'website': {
        const url = metadata.url;
        if (!url) {
          message.error(t('canvas.copy.error.noWebsiteUrl', 'No website URL found'));
          return;
        }
        copyToClipboard(url);
        message.success(t('canvas.copy.success.website', 'Website URL copied to clipboard'));
        break;
      }

      default: {
        message.warning(
          t('canvas.copy.error.unsupportedType', `Unsupported node type: ${nodeType}`),
        );
        break;
      }
    }
  } catch (error) {
    console.error('Copy failed:', error);
    message.error(t('canvas.copy.error.general', 'Copy failed. Please try again.'));
  }
};

// Check if node has shareable data
export const hasShareableData = (nodeData: NodeData): boolean => {
  const { nodeType, entityId, metadata = {} } = nodeData;

  // Drive file support: if fileId exists, it is shareable
  if (metadata?.fileId) {
    return true;
  }

  switch (nodeType) {
    case 'image':
      return Boolean(metadata.imageUrl);

    case 'video':
      return Boolean(metadata.videoUrl);

    case 'audio':
      return Boolean(metadata.audioUrl);

    case 'document':
    case 'codeArtifact':
    case 'skillResponse':
    case 'resource':
      return Boolean(entityId);

    case 'memo':
      return Boolean(metadata.content);

    case 'website':
      return Boolean(metadata.url);

    default:
      return false;
  }
};

// Main share function for different node types
export const shareNodeData = async (nodeData: NodeData, t: TFunction): Promise<void> => {
  const { nodeType, entityId, metadata = {} } = nodeData;

  try {
    // Drive file support: prioritize drive file share when fileId exists
    if (metadata?.fileId) {
      const fileId = metadata.fileId as string;
      const loadingMessage = message.loading(t('canvas.share.loading', 'Creating share...'), 0);
      try {
        const { data, error } = await getClient().createShare({
          body: {
            entityId: fileId,
            entityType: 'driveFile',
          },
        });
        if (!data?.success || error) {
          throw new Error(error ? String(error) : 'Failed to create share');
        }
        const shareLink = getShareLink('driveFile', data.data?.shareId ?? '');
        copyToClipboard(shareLink);
        loadingMessage();
        message.success(
          t('driveFile.shareSuccess', 'File shared successfully! Link copied to clipboard.'),
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to share drive file:', err);
        loadingMessage();
        message.error(t('driveFile.shareError', 'Failed to share file'));
      }
      return;
    }

    switch (nodeType) {
      case 'image': {
        const imageUrl = metadata.imageUrl;
        if (!imageUrl) {
          message.error(t('canvas.share.error.noImageUrl', 'No image URL found'));
          return;
        }
        copyToClipboard(imageUrl);
        message.success(t('canvas.share.success.image', 'Image URL copied to clipboard'));
        break;
      }

      case 'video': {
        const videoUrl = metadata.videoUrl;
        if (!videoUrl) {
          message.error(t('canvas.share.error.noVideoUrl', 'No video URL found'));
          return;
        }
        copyToClipboard(videoUrl);
        message.success(t('canvas.share.success.video', 'Video URL copied to clipboard'));
        break;
      }

      case 'audio': {
        const audioUrl = metadata.audioUrl;
        if (!audioUrl) {
          message.error(t('canvas.share.error.noAudioUrl', 'No audio URL found'));
          return;
        }
        copyToClipboard(audioUrl);
        message.success(t('canvas.share.success.audio', 'Audio URL copied to clipboard'));
        break;
      }

      case 'document': {
        if (!entityId) {
          message.error(t('canvas.share.error.noEntityId', 'No document ID found'));
          return;
        }
        const loadingMessage = message.loading(t('canvas.share.loading', 'Creating share...'), 0);
        try {
          const { data, error } = await getClient().createShare({
            body: {
              entityId,
              entityType: 'document',
            },
          });
          if (!data?.success || error) {
            throw new Error(error ? String(error) : 'Failed to create share');
          }
          const shareLink = getShareLink('document', data.data?.shareId ?? '');
          copyToClipboard(shareLink);
          loadingMessage();
          message.success(
            t(
              'canvas.share.success.document',
              'Document shared successfully! Link copied to clipboard.',
            ),
          );
        } catch (err) {
          console.error('Failed to share document:', err);
          loadingMessage();
          message.error(t('canvas.share.error.document', 'Failed to share document'));
        }
        break;
      }

      case 'codeArtifact': {
        if (!entityId) {
          message.error(t('canvas.share.error.noEntityId', 'No code artifact ID found'));
          return;
        }
        const loadingMessage = message.loading(t('canvas.share.loading', 'Creating share...'), 0);
        try {
          const { data, error } = await getClient().createShare({
            body: {
              entityId,
              entityType: 'codeArtifact',
            },
          });
          if (!data?.success || error) {
            throw new Error(error ? String(error) : 'Failed to create share');
          }
          const shareLink = getShareLink('codeArtifact', data.data?.shareId ?? '');
          copyToClipboard(shareLink);
          loadingMessage();
          message.success(
            t(
              'canvas.share.success.code',
              'Code artifact shared successfully! Link copied to clipboard.',
            ),
          );
        } catch (err) {
          console.error('Failed to share code artifact:', err);
          loadingMessage();
          message.error(t('canvas.share.error.code', 'Failed to share code artifact'));
        }
        break;
      }

      case 'skillResponse': {
        if (!entityId) {
          message.error(t('canvas.share.error.noEntityId', 'No skill response ID found'));
          return;
        }
        const loadingMessage = message.loading(t('canvas.share.loading', 'Creating share...'), 0);
        try {
          // Get skill response data first
          const { data: resultData } = await getClient().getActionResult({
            query: { resultId: entityId },
          });

          const { data, error } = await getClient().createShare({
            body: {
              entityId,
              entityType: 'skillResponse',
              shareData: JSON.stringify(resultData?.data ?? {}),
            },
          });
          if (!data?.success || error) {
            throw new Error(error ? String(error) : 'Failed to create share');
          }
          const shareLink = getShareLink('skillResponse', data.data?.shareId ?? '');
          copyToClipboard(shareLink);
          loadingMessage();
          message.success(
            t(
              'canvas.share.success.skillResponse',
              'Skill response shared successfully! Link copied to clipboard.',
            ),
          );
        } catch (err) {
          console.error('Failed to share skill response:', err);
          loadingMessage();
          message.error(t('canvas.share.error.skillResponse', 'Failed to share skill response'));
        }
        break;
      }

      case 'memo': {
        const content = metadata.content || '';
        if (!content) {
          message.error(t('canvas.share.error.noMemoContent', 'No memo content found'));
          return;
        }
        copyToClipboard(content);
        message.success(t('canvas.share.success.memo', 'Memo content copied to clipboard'));
        break;
      }

      case 'resource': {
        if (!entityId) {
          message.error(t('canvas.share.error.noEntityId', 'No resource ID found'));
          return;
        }
        const loadingMessage = message.loading(t('canvas.share.loading', 'Creating share...'), 0);
        try {
          const { data, error } = await getClient().createShare({
            body: {
              entityId,
              entityType: 'resource',
            },
          });
          if (!data?.success || error) {
            throw new Error(error ? String(error) : 'Failed to create share');
          }
          const shareLink = getShareLink('resource', data.data?.shareId ?? '');
          copyToClipboard(shareLink);
          loadingMessage();
          message.success(
            t(
              'canvas.share.success.resource',
              'Resource shared successfully! Link copied to clipboard.',
            ),
          );
        } catch (err) {
          console.error('Failed to share resource:', err);
          loadingMessage();
          message.error(t('canvas.share.error.resource', 'Failed to share resource'));
        }
        break;
      }

      case 'website': {
        const url = metadata.url;
        if (!url) {
          message.error(t('canvas.share.error.noWebsiteUrl', 'No website URL found'));
          return;
        }
        copyToClipboard(url);
        message.success(t('canvas.share.success.website', 'Website URL copied to clipboard'));
        break;
      }

      default: {
        message.warning(
          t('canvas.share.error.unsupportedType', `Unsupported node type: ${nodeType}`),
        );
        break;
      }
    }
  } catch (error) {
    console.error('Share failed:', error);
    message.error(t('canvas.share.error.general', 'Share failed. Please try again.'));
  }
};

export type { NodeData };
