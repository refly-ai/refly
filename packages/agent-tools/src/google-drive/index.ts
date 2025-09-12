import { z } from 'zod/v3';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { google } from 'googleapis';
import { ToolParams } from '@langchain/core/tools';

export const GoogleDriveToolsetDefinition: ToolsetDefinition = {
  key: 'google_drive',
  domain: 'https://drive.google.com',
  labelDict: {
    en: 'Google Drive',
    'zh-CN': 'Google 云端硬盘',
  },
  descriptionDict: {
    en: 'Access and manage files in Google Drive. Upload, download, list files, manage permissions, and more.',
    'zh-CN': '访问和管理 Google 云端硬盘中的文件。上传、下载、列出文件、管理权限等。',
  },
  tools: [
    {
      name: 'list_files',
      descriptionDict: {
        en: 'List files and folders with optional filtering and pagination.',
        'zh-CN': '列出文件和文件夹，支持可选的过滤和分页。',
      },
    },
    {
      name: 'get_file',
      descriptionDict: {
        en: 'Get detailed information about a specific file or folder.',
        'zh-CN': '获取特定文件或文件夹的详细信息。',
      },
    },
    {
      name: 'upload_file',
      descriptionDict: {
        en: 'Upload a new file with specified metadata and content.',
        'zh-CN': '上传新文件，包含指定的元数据和内容。',
      },
    },
    {
      name: 'download_file',
      descriptionDict: {
        en: 'Download a file by its ID.',
        'zh-CN': '通过 ID 下载文件。',
      },
    },
    {
      name: 'create_folder',
      descriptionDict: {
        en: 'Create a new folder with specified name and parent folder.',
        'zh-CN': '创建一个新文件夹，包含指定的名称和父文件夹。',
      },
    },
    {
      name: 'delete_file',
      descriptionDict: {
        en: 'Delete a file or folder by its ID.',
        'zh-CN': '通过 ID 删除文件或文件夹。',
      },
    },
    {
      name: 'update_file',
      descriptionDict: {
        en: 'Update file metadata or content.',
        'zh-CN': '更新文件的元数据或内容。',
      },
    },
    {
      name: 'search_files',
      descriptionDict: {
        en: 'Search for files and folders using query parameters.',
        'zh-CN': '使用查询参数搜索文件和文件夹。',
      },
    },
    {
      name: 'list_permissions',
      descriptionDict: {
        en: 'List permissions for a specific file or folder.',
        'zh-CN': '列出特定文件或文件夹的权限。',
      },
    },
    {
      name: 'share_file',
      descriptionDict: {
        en: 'Share a file or folder with specific users or make it publicly accessible.',
        'zh-CN': '与特定用户共享文件或文件夹，或使其公开可访问。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'google',
      scope: ['https://www.googleapis.com/auth/drive'],
    },
  ],
  configItems: [
    {
      key: 'redirectUri',
      inputMode: 'text',
      labelDict: {
        en: 'Redirect URI',
        'zh-CN': '重定向 URI',
      },
      descriptionDict: {
        en: 'The OAuth 2.0 redirect URI configured in Google Cloud Console',
        'zh-CN': '在 Google Cloud Console 中配置的 OAuth 2.0 重定向 URI',
      },
      defaultValue: 'http://localhost:3000/oauth2callback',
    },
  ],
};

//automatic assemble clientId, clientSecret, refreshToken, accessToken if authType is oauth
export interface GoogleDriveParams extends ToolParams {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
  redirectUri?: string;
}

// Helper function to create authenticated Drive service
function createDriveService(params: GoogleDriveParams) {
  const oauth2Client = new google.auth.OAuth2(
    params.clientId,
    params.clientSecret,
    params.redirectUri ?? 'http://localhost:3000/oauth2callback',
  );

  oauth2Client.setCredentials({
    refresh_token: params.refreshToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export class GoogleDriveListFiles extends AgentBaseTool<GoogleDriveParams> {
  name = 'list_files';
  toolsetKey = GoogleDriveToolsetDefinition.key;

  schema = z.object({
    pageSize: z.number().optional().describe('Maximum number of files to return (default: 10)'),
    pageToken: z.string().optional().describe('Token for pagination to the next page of results'),
    q: z
      .string()
      .optional()
      .describe('Query string for filtering files (e.g., "name contains \'report\'")'),
    orderBy: z.string().optional().describe('Order by field (e.g., "createdTime desc", "name")'),
    fields: z
      .string()
      .optional()
      .describe('Fields to include in response (e.g., "files(id,name,mimeType,createdTime)")'),
  });
  description = 'List files and folders in Google Drive with optional filtering and pagination.';

  protected params: GoogleDriveParams;

  constructor(params: GoogleDriveParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      const response = await drive.files.list({
        pageSize: input.pageSize ?? 10,
        pageToken: input.pageToken,
        q: input.q,
        orderBy: input.orderBy,
        fields:
          input.fields ??
          'files(id,name,mimeType,createdTime,modifiedTime,size,parents),nextPageToken',
      });

      const files = response.data.files ?? [];
      const nextPageToken = response.data.nextPageToken;

      if (files.length === 0) {
        return {
          status: 'success',
          data: { message: 'No files found in Google Drive.' },
          summary: 'No files found in Google Drive',
        };
      }

      const fileList = files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        size: file.size,
        parents: file.parents,
      }));

      const result = {
        message: `Found ${files.length} files`,
        count: files.length,
        files: fileList,
        nextPageToken,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully listed ${files.length} files from Google Drive`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing files',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while listing files',
      };
    }
  }
}

export class GoogleDriveGetFile extends AgentBaseTool<GoogleDriveParams> {
  name = 'get_file';
  toolsetKey = GoogleDriveToolsetDefinition.key;

  schema = z.object({
    fileId: z.string().describe('The ID of the file to retrieve'),
    fields: z.string().optional().describe('Fields to include in response'),
  });
  description = 'Get detailed information about a specific file or folder in Google Drive.';

  protected params: GoogleDriveParams;

  constructor(params: GoogleDriveParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      const response = await drive.files.get({
        fileId: input.fileId,
        fields: input.fields ?? '*',
      });

      const file = response.data;

      const result = {
        message: 'File details retrieved successfully',
        file: {
          name: file.name,
          id: file.id,
          mimeType: file.mimeType,
          createdTime: file.createdTime,
          modifiedTime: file.modifiedTime,
          size: file.size,
          parents: file.parents,
          webViewLink: file.webViewLink,
          description: file.description,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved details for file: ${file.name}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting file',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while getting file',
      };
    }
  }
}

export class GoogleDriveUploadFile extends AgentBaseTool<GoogleDriveParams> {
  name = 'upload_file';
  toolsetKey = GoogleDriveToolsetDefinition.key;

  schema = z.object({
    name: z.string().describe('Name of the file to upload'),
    content: z.string().describe('Content of the file to upload'),
    mimeType: z.string().optional().describe('MIME type of the file (default: text/plain)'),
    parentFolderId: z.string().optional().describe('ID of the parent folder (optional)'),
    description: z.string().optional().describe('Description of the file (optional)'),
  });
  description = 'Upload a new file to Google Drive with specified metadata and content.';

  protected params: GoogleDriveParams;

  constructor(params: GoogleDriveParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      const fileMetadata = {
        name: input.name,
        mimeType: input.mimeType ?? 'text/plain',
        description: input.description,
        ...(input.parentFolderId && { parents: [input.parentFolderId] }),
      };

      const media = {
        mimeType: input.mimeType ?? 'text/plain',
        body: input.content,
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,name,mimeType,createdTime,webViewLink',
      });

      const file = response.data;

      const result = {
        message: 'File uploaded successfully',
        file: {
          name: file.name,
          id: file.id,
          mimeType: file.mimeType,
          createdTime: file.createdTime,
          webViewLink: file.webViewLink,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully uploaded file: ${file.name} to Google Drive`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error uploading file',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while uploading file',
      };
    }
  }
}

export class GoogleDriveDownloadFile extends AgentBaseTool<GoogleDriveParams> {
  name = 'download_file';
  toolsetKey = GoogleDriveToolsetDefinition.key;

  schema = z.object({
    fileId: z.string().describe('The ID of the file to download'),
    mimeType: z
      .string()
      .optional()
      .describe('MIME type for export (for Google Docs, Sheets, etc.)'),
  });
  description = 'Download a file from Google Drive by its ID.';

  protected params: GoogleDriveParams;

  constructor(params: GoogleDriveParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      // First get file metadata to check if it's a Google Doc
      const fileResponse = await drive.files.get({
        fileId: input.fileId,
        fields: 'name,mimeType',
      });

      const file = fileResponse.data;

      if (file.mimeType?.includes('google-apps')) {
        // For Google Docs, Sheets, etc., we need to export
        if (!input.mimeType) {
          return {
            status: 'error',
            error: 'Export type required',
            summary: `This is a Google ${file.mimeType.includes('document') ? 'Doc' : 'Sheet/Slide'}. Please specify a mimeType for export (e.g., 'application/pdf', 'text/plain').`,
            data: {
              file: {
                name: file.name,
                mimeType: file.mimeType,
              },
            },
          };
        }

        const exportResponse = await drive.files.export({
          fileId: input.fileId,
          mimeType: input.mimeType,
        });

        const result = {
          message: 'File exported successfully',
          file: {
            name: file.name,
            originalMimeType: file.mimeType,
            exportedMimeType: input.mimeType,
            content: exportResponse.data,
          },
        };

        return {
          status: 'success',
          data: result,
          summary: `Successfully exported Google Doc: ${file.name} to ${input.mimeType}`,
        };
      } else {
        // For regular files, download directly
        const downloadResponse = await drive.files.get({
          fileId: input.fileId,
          alt: 'media',
        });

        const result = {
          message: 'File downloaded successfully',
          file: {
            name: file.name,
            mimeType: file.mimeType,
            content: downloadResponse.data,
          },
        };

        return {
          status: 'success',
          data: result,
          summary: `Successfully downloaded file: ${file.name} from Google Drive`,
        };
      }
    } catch (error) {
      return {
        status: 'error',
        error: 'Error downloading file',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while downloading file',
      };
    }
  }
}

export class GoogleDriveCreateFolder extends AgentBaseTool<GoogleDriveParams> {
  name = 'create_folder';
  toolsetKey = GoogleDriveToolsetDefinition.key;

  schema = z.object({
    name: z.string().describe('Name of the folder to create'),
    parentFolderId: z.string().optional().describe('ID of the parent folder (optional)'),
    description: z.string().optional().describe('Description of the folder (optional)'),
  });
  description = 'Create a new folder in Google Drive with specified name and parent folder.';

  protected params: GoogleDriveParams;

  constructor(params: GoogleDriveParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      const folderMetadata = {
        name: input.name,
        mimeType: 'application/vnd.google-apps.folder',
        description: input.description,
        ...(input.parentFolderId && { parents: [input.parentFolderId] }),
      };

      const response = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id,name,mimeType,createdTime,webViewLink',
      });

      const folder = response.data;

      const result = {
        message: 'Folder created successfully',
        folder: {
          name: folder.name,
          id: folder.id,
          mimeType: folder.mimeType,
          createdTime: folder.createdTime,
          webViewLink: folder.webViewLink,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created folder: ${folder.name} in Google Drive`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating folder',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while creating folder',
      };
    }
  }
}

export class GoogleDriveDeleteFile extends AgentBaseTool<GoogleDriveParams> {
  name = 'delete_file';
  toolsetKey = GoogleDriveToolsetDefinition.key;

  schema = z.object({
    fileId: z.string().describe('The ID of the file or folder to delete'),
  });
  description = 'Delete a file or folder from Google Drive by its ID.';

  protected params: GoogleDriveParams;

  constructor(params: GoogleDriveParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      await drive.files.delete({
        fileId: input.fileId,
      });

      const result = {
        message: 'File/folder deleted successfully',
        deletedFileId: input.fileId,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully deleted file/folder with ID: ${input.fileId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error deleting file',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while deleting file',
      };
    }
  }
}

export class GoogleDriveUpdateFile extends AgentBaseTool<GoogleDriveParams> {
  name = 'update_file';
  toolsetKey = GoogleDriveToolsetDefinition.key;

  schema = z.object({
    fileId: z.string().describe('The ID of the file to update'),
    name: z.string().optional().describe('New name for the file'),
    description: z.string().optional().describe('New description for the file'),
    content: z.string().optional().describe('New content for the file (for text files)'),
  });
  description = 'Update file metadata or content in Google Drive.';

  protected params: GoogleDriveParams;

  constructor(params: GoogleDriveParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      const updateMetadata: Record<string, any> = {};
      if (input.name) updateMetadata.name = input.name;
      if (input.description) updateMetadata.description = input.description;

      let response: any;

      if (input.content) {
        // Update both metadata and content
        const media = {
          mimeType: 'text/plain',
          body: input.content,
        };

        response = await drive.files.update({
          fileId: input.fileId,
          requestBody: updateMetadata,
          media: media,
          fields: 'id,name,modifiedTime',
        });
      } else {
        // Update only metadata
        response = await drive.files.update({
          fileId: input.fileId,
          requestBody: updateMetadata,
          fields: 'id,name,modifiedTime',
        });
      }

      const file = response.data;

      const result = {
        message: 'File updated successfully',
        file: {
          id: file.id,
          name: file.name,
          modifiedTime: file.modifiedTime,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated file: ${file.name} in Google Drive`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating file',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while updating file',
      };
    }
  }
}

export class GoogleDriveSearchFiles extends AgentBaseTool<GoogleDriveParams> {
  name = 'search_files';
  toolsetKey = GoogleDriveToolsetDefinition.key;

  schema = z.object({
    query: z
      .string()
      .describe('Search query (e.g., "name contains \'report\'", "mimeType contains \'image\'")'),
    pageSize: z.number().optional().describe('Maximum number of results to return (default: 10)'),
    pageToken: z.string().optional().describe('Token for pagination'),
  });
  description = 'Search for files and folders in Google Drive using query parameters.';

  protected params: GoogleDriveParams;

  constructor(params: GoogleDriveParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      const response = await drive.files.list({
        q: input.query,
        pageSize: input.pageSize ?? 10,
        pageToken: input.pageToken,
        fields: 'files(id,name,mimeType,createdTime,modifiedTime,size),nextPageToken',
      });

      const files = response.data.files ?? [];
      const nextPageToken = response.data.nextPageToken;

      if (files.length === 0) {
        return {
          status: 'success',
          data: {
            message: `No files found matching query: "${input.query}"`,
            query: input.query,
            count: 0,
          },
          summary: `No files found matching query: "${input.query}"`,
        };
      }

      const fileList = files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        size: file.size,
      }));

      const result = {
        message: `Search results for "${input.query}"`,
        query: input.query,
        count: files.length,
        files: fileList,
        nextPageToken,
      };

      return {
        status: 'success',
        data: result,
        summary: `Search completed successfully. Found ${files.length} files matching query: "${input.query}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error searching files',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while searching files',
      };
    }
  }
}

export class GoogleDriveListPermissions extends AgentBaseTool<GoogleDriveParams> {
  name = 'list_permissions';
  toolsetKey = GoogleDriveToolsetDefinition.key;

  schema = z.object({
    fileId: z.string().describe('The ID of the file or folder to list permissions for'),
  });
  description = 'List permissions for a specific file or folder in Google Drive.';

  protected params: GoogleDriveParams;

  constructor(params: GoogleDriveParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      const response = await drive.permissions.list({
        fileId: input.fileId,
        fields: 'permissions(id,type,role,emailAddress,displayName,expirationTime)',
      });

      const permissions = response.data.permissions ?? [];

      if (permissions.length === 0) {
        return {
          status: 'success',
          data: {
            message: 'No permissions found for this file/folder',
            fileId: input.fileId,
            count: 0,
          },
          summary: 'No permissions found for this file/folder',
        };
      }

      const permissionList = permissions.map((permission) => ({
        id: permission.id,
        type: permission.type,
        role: permission.role,
        emailAddress: permission.emailAddress,
        displayName: permission.displayName,
        expirationTime: permission.expirationTime,
      }));

      const result = {
        message: 'Permissions retrieved successfully',
        fileId: input.fileId,
        count: permissions.length,
        permissions: permissionList,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${permissions.length} permissions for file/folder`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing permissions',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while listing permissions',
      };
    }
  }
}

export class GoogleDriveShareFile extends AgentBaseTool<GoogleDriveParams> {
  name = 'share_file';
  toolsetKey = GoogleDriveToolsetDefinition.key;

  schema = z.object({
    fileId: z.string().describe('The ID of the file or folder to share'),
    emailAddress: z.string().describe('Email address of the user to share with'),
    role: z.enum(['reader', 'writer', 'commenter', 'owner']).describe('Role to grant to the user'),
    type: z.enum(['user', 'group', 'domain', 'anyone']).describe('Type of permission'),
    sendNotificationEmail: z
      .boolean()
      .optional()
      .describe('Whether to send notification email (default: true)'),
    message: z.string().optional().describe('Message to include in notification email'),
  });
  description = 'Share a file or folder with specific users or make it publicly accessible.';

  protected params: GoogleDriveParams;

  constructor(params: GoogleDriveParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      const permission = {
        type: input.type,
        role: input.role,
        ...(input.type === 'user' && { emailAddress: input.emailAddress }),
        ...(input.type === 'domain' && { domain: input.emailAddress }),
      };

      const response = await drive.permissions.create({
        fileId: input.fileId,
        requestBody: permission,
        sendNotificationEmail: input.sendNotificationEmail ?? true,
        ...(input.message && { emailMessage: input.message }),
        fields: 'id,type,role,emailAddress',
      });

      const newPermission = response.data;

      const result = {
        message: 'File/folder shared successfully',
        permission: {
          id: newPermission.id,
          type: newPermission.type,
          role: newPermission.role,
          emailAddress: newPermission.emailAddress ?? 'N/A',
        },
        shareDetails: {
          fileId: input.fileId,
          emailAddress: input.emailAddress,
          role: input.role,
          type: input.type,
          sendNotificationEmail: input.sendNotificationEmail ?? true,
          message: input.message,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully shared file/folder with ${input.emailAddress} as ${input.role}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error sharing file',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while sharing file',
      };
    }
  }
}

export class GoogleDriveToolset extends AgentBaseToolset<GoogleDriveParams> {
  toolsetKey = GoogleDriveToolsetDefinition.key;
  tools = [
    GoogleDriveListFiles,
    GoogleDriveGetFile,
    GoogleDriveUploadFile,
    GoogleDriveDownloadFile,
    GoogleDriveCreateFolder,
    GoogleDriveDeleteFile,
    GoogleDriveUpdateFile,
    GoogleDriveSearchFiles,
    GoogleDriveListPermissions,
    GoogleDriveShareFile,
  ] satisfies readonly AgentToolConstructor<GoogleDriveParams>[];
}
