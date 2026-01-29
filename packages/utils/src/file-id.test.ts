import { describe, it, expect } from 'vitest';
import {
  isValidFileId,
  extractFileId,
  extractAllFileIds,
  hasFileIds,
  replaceAllMarkdownFileIds,
  replaceAllHtmlFileIds,
  replaceFileContentUris,
  replaceFileShareUris,
  replaceMarkdownFileIds,
  replaceHtmlAttrFileIds,
} from './file-id';

describe('file-id utilities', () => {
  describe('isValidFileId', () => {
    it('should validate direct file IDs', () => {
      expect(isValidFileId('df-abc123')).toBe(true);
      expect(isValidFileId('df-ABC123')).toBe(true);
      expect(isValidFileId('df-')).toBe(false);
      expect(isValidFileId('abc123')).toBe(false);
      expect(isValidFileId('')).toBe(false);
    });

    it('should validate URI format', () => {
      expect(isValidFileId('fileId://df-abc123')).toBe(true);
      expect(isValidFileId('fileId://invalid')).toBe(false);
    });

    it('should validate mention format', () => {
      expect(isValidFileId('@file:df-abc123')).toBe(true);
      expect(isValidFileId('@file:invalid')).toBe(false);
    });

    it('should validate path format', () => {
      expect(isValidFileId('files/df-abc123')).toBe(true);
      expect(isValidFileId('files/invalid')).toBe(false);
    });

    it('should validate URL format', () => {
      expect(isValidFileId('https://files.refly.ai/storage/df-abc123')).toBe(true);
    });

    it('should reject patterns that look like file IDs but are not', () => {
      expect(isValidFileId('pdf-abc123')).toBe(false);
      expect(isValidFileId('abcdf-abc123')).toBe(false);
    });
  });

  describe('extractFileId', () => {
    it('should extract from direct format', () => {
      expect(extractFileId('df-abc123')).toBe('df-abc123');
    });

    it('should extract from URI format', () => {
      expect(extractFileId('fileId://df-abc123')).toBe('df-abc123');
    });

    it('should extract from mention format', () => {
      expect(extractFileId('@file:df-abc123')).toBe('df-abc123');
    });

    it('should extract from path format', () => {
      expect(extractFileId('files/df-abc123')).toBe('df-abc123');
    });

    it('should extract from URL format', () => {
      expect(extractFileId('https://files.refly.ai/df-abc123')).toBe('df-abc123');
    });

    it('should extract from object with fileId property', () => {
      expect(extractFileId({ fileId: 'df-abc123' })).toBe('df-abc123');
    });

    it('should return null for invalid input', () => {
      expect(extractFileId('invalid')).toBe(null);
      expect(extractFileId(null)).toBe(null);
      expect(extractFileId(undefined)).toBe(null);
      expect(extractFileId(123)).toBe(null);
    });
  });

  describe('extractAllFileIds', () => {
    it('should extract all file IDs from content', () => {
      const content = 'File: df-abc123 and another df-xyz789';
      expect(extractAllFileIds(content)).toEqual(['df-abc123', 'df-xyz789']);
    });

    it('should return unique file IDs', () => {
      const content = 'File: df-abc123 and df-abc123 again';
      expect(extractAllFileIds(content)).toEqual(['df-abc123']);
    });

    it('should return empty array for empty content', () => {
      expect(extractAllFileIds('')).toEqual([]);
      expect(extractAllFileIds(null as unknown as string)).toEqual([]);
    });

    it('should not extract invalid patterns', () => {
      const content = 'PDF file: pdf-abc123';
      expect(extractAllFileIds(content)).toEqual([]);
    });
  });

  describe('hasFileIds', () => {
    it('should detect file IDs in content', () => {
      expect(hasFileIds('Contains df-abc123')).toBe(true);
      expect(hasFileIds('No file IDs here')).toBe(false);
      expect(hasFileIds('')).toBe(false);
    });

    it('should not match invalid patterns', () => {
      expect(hasFileIds('PDF: pdf-abc123')).toBe(false);
    });
  });

  describe('replaceFileContentUris', () => {
    it('should replace file-content:// URIs', () => {
      const content = 'Image: file-content://df-abc123';
      const urlMap = new Map([['df-abc123', 'https://cdn.example.com/image.png']]);
      expect(replaceFileContentUris(content, urlMap)).toBe(
        'Image: https://cdn.example.com/image.png',
      );
    });

    it('should keep unmatched URIs', () => {
      const content = 'Image: file-content://df-unknown';
      const urlMap = new Map<string, string>();
      expect(replaceFileContentUris(content, urlMap)).toBe('Image: file-content://df-unknown');
    });
  });

  describe('replaceFileShareUris', () => {
    it('should replace file:// URIs', () => {
      const content = 'Link: file://df-abc123';
      const urlMap = new Map([['df-abc123', 'https://share.example.com/file']]);
      expect(replaceFileShareUris(content, urlMap)).toBe('Link: https://share.example.com/file');
    });
  });

  describe('replaceMarkdownFileIds', () => {
    it('should replace file IDs in markdown link syntax', () => {
      const content = '![image](df-abc123)';
      const urlMap = new Map([['df-abc123', 'https://cdn.example.com/image.png']]);
      expect(replaceMarkdownFileIds(content, urlMap)).toBe(
        '![image](https://cdn.example.com/image.png)',
      );
    });
  });

  describe('replaceHtmlAttrFileIds', () => {
    it('should replace file IDs in src attributes', () => {
      const content = '<img src="df-abc123">';
      const urlMap = new Map([['df-abc123', 'https://cdn.example.com/image.png']]);
      expect(replaceHtmlAttrFileIds(content, urlMap)).toBe(
        '<img src="https://cdn.example.com/image.png">',
      );
    });

    it('should replace file IDs in href attributes', () => {
      const content = '<a href="df-abc123">Link</a>';
      const urlMap = new Map([['df-abc123', 'https://share.example.com/file']]);
      expect(replaceHtmlAttrFileIds(content, urlMap)).toBe(
        '<a href="https://share.example.com/file">Link</a>',
      );
    });
  });

  describe('replaceAllMarkdownFileIds', () => {
    it('should replace all file ID patterns in markdown', () => {
      const content = `
        Image: file-content://df-img1
        Link: file://df-link1
        Markdown: ![alt](df-md1)
      `;
      const contentUrlMap = new Map([
        ['df-img1', 'https://cdn.example.com/img1.png'],
        ['df-link1', 'https://cdn.example.com/link1'],
        ['df-md1', 'https://cdn.example.com/md1.png'],
      ]);
      const shareUrlMap = new Map<string, string>();

      const result = replaceAllMarkdownFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toContain('https://cdn.example.com/img1.png');
      expect(result).toContain('https://cdn.example.com/link1');
      expect(result).toContain('![alt](https://cdn.example.com/md1.png)');
    });

    it('should use shareUrl as fallback', () => {
      const content = '![image](df-abc123)';
      const contentUrlMap = new Map<string, string>();
      const shareUrlMap = new Map([['df-abc123', 'https://share.example.com/file']]);

      const result = replaceAllMarkdownFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toBe('![image](https://share.example.com/file)');
    });

    it('should return original content if no matches', () => {
      const content = 'No file IDs here';
      const result = replaceAllMarkdownFileIds(content, new Map(), new Map());
      expect(result).toBe(content);
    });

    it('should replace file IDs in JavaScript string contexts', () => {
      const content = `
        const materials = [
          { id: 1, fileId: "df-file1", name: "test1" },
          { id: 2, fileId: "df-file2", name: "test2" }
        ];
      `;
      const contentUrlMap = new Map([
        ['df-file1', 'https://cdn.example.com/file1.png'],
        ['df-file2', 'https://cdn.example.com/file2.png'],
      ]);
      const shareUrlMap = new Map<string, string>();

      const result = replaceAllMarkdownFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toContain('"https://cdn.example.com/file1.png"');
      expect(result).toContain('"https://cdn.example.com/file2.png"');
      expect(result).not.toContain('df-file1');
      expect(result).not.toContain('df-file2');
    });

    it('should handle single-quoted file IDs in JavaScript', () => {
      const content = "const fileId = 'df-abc123';";
      const contentUrlMap = new Map([['df-abc123', 'https://cdn.example.com/image.png']]);
      const shareUrlMap = new Map<string, string>();

      const result = replaceAllMarkdownFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toBe("const fileId = 'https://cdn.example.com/image.png';");
    });

    it('should handle mixed markdown and JS contexts', () => {
      const content = `
# Gallery

![image](df-img1)

\`\`\`javascript
const data = { fileId: "df-data1" };
\`\`\`
      `;
      const contentUrlMap = new Map([
        ['df-img1', 'https://cdn.example.com/img1.png'],
        ['df-data1', 'https://cdn.example.com/data1.png'],
      ]);
      const shareUrlMap = new Map<string, string>();

      const result = replaceAllMarkdownFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toContain('![image](https://cdn.example.com/img1.png)');
      expect(result).toContain('"https://cdn.example.com/data1.png"');
    });
  });

  describe('replaceAllHtmlFileIds', () => {
    it('should replace file-content:// in src attributes', () => {
      const content = '<img src="file-content://df-abc123">';
      const contentUrlMap = new Map([['df-abc123', 'https://cdn.example.com/image.png']]);
      const shareUrlMap = new Map<string, string>();

      const result = replaceAllHtmlFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toBe('<img src="https://cdn.example.com/image.png">');
    });

    it('should replace file:// in href attributes with shareUrl', () => {
      const content = '<a href="file://df-abc123">Link</a>';
      const contentUrlMap = new Map([['df-abc123', 'https://cdn.example.com/file']]);
      const shareUrlMap = new Map([['df-abc123', 'https://share.example.com/file']]);

      const result = replaceAllHtmlFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toBe('<a href="https://share.example.com/file">Link</a>');
    });

    it('should replace bare file IDs in src attributes', () => {
      const content = '<img src="df-abc123">';
      const contentUrlMap = new Map([['df-abc123', 'https://cdn.example.com/image.png']]);
      const shareUrlMap = new Map<string, string>();

      const result = replaceAllHtmlFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toBe('<img src="https://cdn.example.com/image.png">');
    });

    it('should replace standalone file-content:// URIs', () => {
      const content = 'URL: file-content://df-abc123';
      const contentUrlMap = new Map([['df-abc123', 'https://cdn.example.com/image.png']]);
      const shareUrlMap = new Map<string, string>();

      const result = replaceAllHtmlFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toBe('URL: https://cdn.example.com/image.png');
    });

    it('should replace file IDs in JavaScript string contexts', () => {
      const content = `
        const materials = [
          { id: 1, fileId: "df-file1", name: "test1" },
          { id: 2, fileId: "df-file2", name: "test2" }
        ];
      `;
      const contentUrlMap = new Map([
        ['df-file1', 'https://cdn.example.com/file1.png'],
        ['df-file2', 'https://cdn.example.com/file2.png'],
      ]);
      const shareUrlMap = new Map<string, string>();

      const result = replaceAllHtmlFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toContain('"https://cdn.example.com/file1.png"');
      expect(result).toContain('"https://cdn.example.com/file2.png"');
      expect(result).not.toContain('df-file1');
      expect(result).not.toContain('df-file2');
    });

    it('should handle file IDs in JavaScript template literal context', () => {
      // This simulates the actual bug case where file IDs are in JS data
      // and used with template literals like `file-content://${material.fileId}`
      const content = `
        const material = { fileId: "df-abc123" };
        const imageUrl = \`file-content://\${material.fileId}\`;
      `;
      const contentUrlMap = new Map([['df-abc123', 'https://cdn.example.com/image.png']]);
      const shareUrlMap = new Map<string, string>();

      const result = replaceAllHtmlFileIds(content, contentUrlMap, shareUrlMap);
      // The file ID in the data should be replaced
      expect(result).toContain('"https://cdn.example.com/image.png"');
      expect(result).not.toContain('"df-abc123"');
    });

    it('should handle single-quoted file IDs in JavaScript', () => {
      const content = "const fileId = 'df-abc123';";
      const contentUrlMap = new Map([['df-abc123', 'https://cdn.example.com/image.png']]);
      const shareUrlMap = new Map<string, string>();

      const result = replaceAllHtmlFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toBe("const fileId = 'https://cdn.example.com/image.png';");
    });

    it('should preserve quotes when replacing JS string file IDs', () => {
      const content = `fileId: "df-abc123"`;
      const contentUrlMap = new Map([['df-abc123', 'https://cdn.example.com/image.png']]);
      const shareUrlMap = new Map<string, string>();

      const result = replaceAllHtmlFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toBe('fileId: "https://cdn.example.com/image.png"');
    });

    it('should handle mixed contexts in HTML with embedded JavaScript', () => {
      const content = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
          <img src="file-content://df-img1">
          <a href="file://df-link1">Link</a>
          <script>
            const data = [
              { fileId: "df-data1", name: "item1" },
              { fileId: "df-data2", name: "item2" }
            ];
            function render(item) {
              return \`<img src="file-content://\${item.fileId}">\`;
            }
          </script>
        </body>
        </html>
      `;
      const contentUrlMap = new Map([
        ['df-img1', 'https://cdn.example.com/img1.png'],
        ['df-link1', 'https://cdn.example.com/link1'],
        ['df-data1', 'https://cdn.example.com/data1.png'],
        ['df-data2', 'https://cdn.example.com/data2.png'],
      ]);
      const shareUrlMap = new Map([['df-link1', 'https://share.example.com/link1']]);

      const result = replaceAllHtmlFileIds(content, contentUrlMap, shareUrlMap);

      // src attribute should use contentUrl
      expect(result).toContain('<img src="https://cdn.example.com/img1.png">');
      // href attribute should use shareUrl
      expect(result).toContain('<a href="https://share.example.com/link1">Link</a>');
      // JS string file IDs should be replaced
      expect(result).toContain('"https://cdn.example.com/data1.png"');
      expect(result).toContain('"https://cdn.example.com/data2.png"');
      // No original file IDs should remain
      expect(result).not.toContain('df-img1');
      expect(result).not.toContain('df-data1');
      expect(result).not.toContain('df-data2');
    });

    it('should not replace file IDs that are not in the URL map', () => {
      const content = 'fileId: "df-unknown"';
      const contentUrlMap = new Map<string, string>();
      const shareUrlMap = new Map<string, string>();

      const result = replaceAllHtmlFileIds(content, contentUrlMap, shareUrlMap);
      expect(result).toBe('fileId: "df-unknown"');
    });

    it('should return original content for empty maps', () => {
      const content = 'Some content with df-abc123';
      const result = replaceAllHtmlFileIds(content, new Map(), new Map());
      expect(result).toBe(content);
    });
  });
});
