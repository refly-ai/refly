import { UpsertResourceRequest, type BaseResponse } from '@refly/openapi-schema';
import { getMarkdown, preprocessHtmlContent } from '@refly/utils/html2md';
import { convertHTMLToMarkdown } from '@refly/utils/markdown';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { getClientOrigin } from '@refly/utils/url';
import { getRuntime } from '@refly/utils/env';
import { ConnectionError } from '@refly/errors';

interface SaveResourceOptions {
  title?: string;
  url?: string;
}

export const useSaveCurrentWeblinkAsResource = () => {
  const saveResource = async (options?: SaveResourceOptions) => {
    try {
      const runtime = getRuntime();
      const isWeb = runtime === 'web';

      // First preprocess the HTML content with minimal cleaning
      const preprocessedHtml = preprocessHtmlContent(document?.body ?? document);

      let pageContent = '';
      try {
        // Create a Blob from the HTML content
        const htmlBlob = new Blob([preprocessedHtml], { type: 'text/html' });
        const htmlFile = new File([htmlBlob], 'content.html', { type: 'text/html' });

        // Use extract API to convert HTML to Markdown
        const result = await getClient().convert({
          body: {
            from: 'html',
            to: 'markdown',
            file: htmlFile,
          },
        });

        if (result?.data?.data?.content) {
          pageContent = result.data.data.content;
        } else {
          throw new Error('Extract API returned no content');
        }
      } catch (err) {
        console.error('Failed to convert HTML to Markdown using extract:', err);
        // Fallback to direct conversion if extract fails
        pageContent = isWeb
          ? getMarkdown(document?.body ?? document)
          : convertHTMLToMarkdown('render', preprocessedHtml);
      }

      const title = options?.title?.trim() || document?.title || 'Untitled';
      const websiteUrl = options?.url?.trim() || location.href;

      const resource = {
        title,
        data: {
          url: websiteUrl,
          title,
          source: 'extension',
        },
        resourceType: 'weblink',
        isPublic: false,
        readOnly: true,
        collabEnabled: false,
      };

      const textBlob = new Blob([pageContent], { type: 'text/plain' });
      const textFile = new File([textBlob], 'content.txt', { type: 'text/plain' });

      const createResourceData: UpsertResourceRequest = {
        title: resource?.title,
        resourceType: 'weblink',
        data: resource?.data,
      };

      const { error } = await getClient().createResourceWithFile({
        body: {
          ...createResourceData,
          file: textFile,
        },
      });
      // const resourceId = data?.data?.resourceId;
      // const url = `${getClientOrigin(false)}/resource/${resourceId}`;
      const url = `${getClientOrigin(false)}`;

      return { url, res: error as BaseResponse };
    } catch (err: any) {
      console.error(err);

      return {
        url: '',
        res: {
          success: false,
          errCode: new ConnectionError(err).code,
          errMsg: err?.message,
        } as BaseResponse,
      };
    }
  };

  return { saveResource };
};
