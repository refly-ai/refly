import { ToolsetDefinition } from '@refly/openapi-schema';

export const GoogleDriveToolsetDefinition: ToolsetDefinition = {
  key: 'googledrive',
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
    {
      name: 'add_comment',
      descriptionDict: {
        en: 'Add a comment to a Google Doc.',
        'zh-CN': '为 Google 文档添加评论。',
      },
    },
    {
      name: 'delete_comment',
      descriptionDict: {
        en: 'Delete a specific comment from a file.',
        'zh-CN': '删除文件中的特定评论。',
      },
    },
    {
      name: 'list_comments',
      descriptionDict: {
        en: 'List all comments on a file.',
        'zh-CN': '列出文件中的所有评论。',
      },
    },
    {
      name: 'reply_to_comment',
      descriptionDict: {
        en: 'Add a reply to an existing comment.',
        'zh-CN': '回复现有评论。',
      },
    },
    {
      name: 'resolve_comment',
      descriptionDict: {
        en: 'Mark a comment as resolved.',
        'zh-CN': '将评论标记为已解决。',
      },
    },
    {
      name: 'copy_file',
      descriptionDict: {
        en: 'Create a copy of the specified file.',
        'zh-CN': '创建指定文件的副本。',
      },
    },
    {
      name: 'move_file',
      descriptionDict: {
        en: 'Move a file from one folder to another.',
        'zh-CN': '将文件从一个文件夹移动到另一个文件夹。',
      },
    },
    {
      name: 'move_file_to_trash',
      descriptionDict: {
        en: 'Move a file to trash.',
        'zh-CN': '将文件移动到回收站。',
      },
    },
    {
      name: 'create_file_from_template',
      descriptionDict: {
        en: 'Create a new Google Docs file from a template.',
        'zh-CN': '从模板创建新的 Google 文档文件。',
      },
    },
    {
      name: 'create_file_from_text',
      descriptionDict: {
        en: 'Create a new file from text content.',
        'zh-CN': '从文本内容创建新文件。',
      },
    },
    {
      name: 'create_shared_drive',
      descriptionDict: {
        en: 'Create a new shared drive.',
        'zh-CN': '创建新的共享驱动器。',
      },
    },
    {
      name: 'delete_shared_drive',
      descriptionDict: {
        en: 'Delete a shared drive.',
        'zh-CN': '删除共享驱动器。',
      },
    },
    {
      name: 'get_shared_drive',
      descriptionDict: {
        en: 'Get information about a shared drive.',
        'zh-CN': '获取共享驱动器的信息。',
      },
    },
    {
      name: 'update_shared_drive',
      descriptionDict: {
        en: 'Update a shared drive.',
        'zh-CN': '更新共享驱动器。',
      },
    },
    {
      name: 'search_shared_drives',
      descriptionDict: {
        en: 'Search for shared drives.',
        'zh-CN': '搜索共享驱动器。',
      },
    },
    {
      name: 'find_file',
      descriptionDict: {
        en: 'Find a file by name or other criteria.',
        'zh-CN': '通过名称或其他条件查找文件。',
      },
    },
    {
      name: 'find_folder',
      descriptionDict: {
        en: 'Find a folder by name or other criteria.',
        'zh-CN': '通过名称或其他条件查找文件夹。',
      },
    },
    {
      name: 'find_forms',
      descriptionDict: {
        en: 'Find Google Forms in the drive.',
        'zh-CN': '在驱动器中查找 Google 表单。',
      },
    },
    {
      name: 'find_spreadsheets',
      descriptionDict: {
        en: 'Find Google Sheets in the drive.',
        'zh-CN': '在驱动器中查找 Google 表格。',
      },
    },
    {
      name: 'get_folder_id_for_path',
      descriptionDict: {
        en: 'Get folder ID for a given path.',
        'zh-CN': '获取给定路径的文件夹 ID。',
      },
    },
    {
      name: 'list_access_proposals',
      descriptionDict: {
        en: 'List access proposals for a file.',
        'zh-CN': '列出文件的访问提议。',
      },
    },
    {
      name: 'resolve_access_proposal',
      descriptionDict: {
        en: 'Resolve an access proposal.',
        'zh-CN': '解决访问提议。',
      },
    },
    {
      name: 'add_file_sharing_preference',
      descriptionDict: {
        en: 'Add file sharing preference.',
        'zh-CN': '添加文件共享偏好设置。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'google',
      scope: ['https://www.googleapis.com/auth/drive.file'],
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
