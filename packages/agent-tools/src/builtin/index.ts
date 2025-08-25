import { z } from 'zod/v3';
import { ToolParams } from '@langchain/core/tools';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor } from '../base';
import { ToolsetDefinition, User } from '@refly/openapi-schema';
import { ReflyService } from './interface';

export const BuiltinToolsetDefinition: ToolsetDefinition = {
  key: 'builtin',
  labelDict: {
    en: 'Builtin',
  },
  descriptionDict: {
    en: 'Builtin tools that provide access to Refly internal services.',
  },
  tools: [
    {
      name: 'search',
      descriptionDict: {
        en: 'Search within Refly knowledge base, documents, and resources.',
      },
    },
    {
      name: 'web_search',
      descriptionDict: {
        en: 'Search the web for current information and news.',
      },
    },
    {
      name: 'create_canvas',
      descriptionDict: {
        en: 'Create a new canvas for organizing ideas and content.',
      },
    },
    {
      name: 'list_canvases',
      descriptionDict: {
        en: 'List available canvases for the user.',
      },
    },
    {
      name: 'create_document',
      descriptionDict: {
        en: 'Create a new document in the knowledge base.',
      },
    },
    {
      name: 'list_documents',
      descriptionDict: {
        en: 'List available documents for the user.',
      },
    },
    {
      name: 'generate_media',
      descriptionDict: {
        en: 'Generate images, audio, or video content using AI.',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'credentials',
      credentialSchema: {
        type: 'object',
        properties: {
          reflyService: {
            type: 'object',
            description: 'ReflyService instance for calling internal services',
          },
          user: {
            type: 'object',
            description: 'User object for authentication and authorization',
          },
        },
        required: ['reflyService', 'user'],
      },
    },
  ],
};

interface BuiltinToolParams extends ToolParams {
  user: User;
  reflyService: ReflyService;
}

export class BuiltinSearch extends AgentBaseTool<BuiltinToolParams> {
  name = 'search';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    query: z.string().describe('The search query to execute'),
    domains: z
      .array(z.enum(['resource', 'document', 'canvas']))
      .describe('Search domains to include')
      .default(['resource', 'document']),
    mode: z.enum(['keyword', 'vector', 'hybrid']).describe('Search mode').default('vector'),
    limit: z.number().describe('Maximum number of results to return').default(10),
    projectId: z.string().optional().describe('Optional project ID to scope the search'),
  });

  description = 'Search within Refly knowledge base, documents, and resources.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.librarySearch(
        user,
        {
          query: input.query,
          domains: input.domains,
          mode: input.mode,
          limit: input.limit,
          projectId: input.projectId,
        },
        { enableReranker: true },
      );

      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error performing search: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export class BuiltinWebSearch extends AgentBaseTool<BuiltinToolParams> {
  name = 'web_search';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    query: z.string().describe('The web search query to execute'),
    limit: z.number().describe('Maximum number of results to return').default(5),
  });

  description = 'Search the web for current information and news.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.webSearch(user, {
        q: input.query,
        limit: input.limit,
      });

      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error performing web search: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export class BuiltinCreateCanvas extends AgentBaseTool<BuiltinToolParams> {
  name = 'create_canvas';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    title: z.string().describe('Title of the canvas to create'),
    description: z.string().optional().describe('Optional description of the canvas'),
    projectId: z.string().optional().describe('Optional project ID to associate with the canvas'),
  });

  description = 'Create a new canvas for organizing ideas and content.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.createCanvas(user, {
        title: input.title,
        projectId: input.projectId,
      });

      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error creating canvas: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export class BuiltinListCanvases extends AgentBaseTool<BuiltinToolParams> {
  name = 'list_canvases';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    pageSize: z.number().describe('Maximum number of canvases to return').default(20),
    page: z.number().describe('Page number (1-based)').default(1),
    projectId: z.string().optional().describe('Optional project ID to filter canvases'),
  });

  description = 'List available canvases for the user.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.listCanvases(user, {
        pageSize: input.pageSize,
        page: input.page,
        projectId: input.projectId,
      });

      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error listing canvases: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export class BuiltinCreateDocument extends AgentBaseTool<BuiltinToolParams> {
  name = 'create_document';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    title: z.string().describe('Title of the document to create'),
    initialContent: z.string().describe('Initial content of the document'),
    description: z.string().optional().describe('Optional description of the document'),
    projectId: z.string().optional().describe('Optional project ID to associate with the document'),
    canvasId: z.string().optional().describe('Optional canvas ID to associate with the document'),
  });

  description = 'Create a new document in the knowledge base.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.createDocument(user, {
        title: input.title,
        initialContent: input.initialContent,
        projectId: input.projectId,
        canvasId: input.canvasId,
      });

      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error creating document: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export class BuiltinListDocuments extends AgentBaseTool<BuiltinToolParams> {
  name = 'list_documents';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    pageSize: z.number().describe('Maximum number of documents to return').default(20),
    page: z.number().describe('Page number (1-based)').default(1),
    projectId: z.string().optional().describe('Optional project ID to filter documents'),
    canvasId: z.string().optional().describe('Optional canvas ID to filter documents'),
  });

  description = 'List available documents for the user.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.listDocuments(user, {
        pageSize: input.pageSize,
        page: input.page,
        projectId: input.projectId,
        canvasId: input.canvasId,
      });

      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error listing documents: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export class BuiltinGenerateMedia extends AgentBaseTool<BuiltinToolParams> {
  name = 'generate_media';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    mediaType: z.enum(['image', 'audio', 'video']).describe('Type of media to generate'),
    prompt: z.string().describe('Prompt describing the media to generate'),
    model: z.string().optional().describe('Optional model to use for generation'),
    provider: z.string().optional().describe('Optional provider to use for generation'),
    targetType: z
      .enum([
        'document',
        'resource',
        'canvas',
        'share',
        'user',
        'project',
        'skillResponse',
        'codeArtifact',
        'page',
        'mediaResult',
      ])
      .optional()
      .describe('Optional target entity type'),
    targetId: z.string().optional().describe('Optional target entity ID'),
  });

  description = 'Generate images, audio, or video content using AI.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.generateMedia(user, {
        mediaType: input.mediaType,
        prompt: input.prompt,
        model: input.model,
        provider: input.provider,
        targetType: input.targetType,
        targetId: input.targetId,
      });

      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error generating media: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export class BuiltinToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinToolsetDefinition.key;
  tools = [
    BuiltinSearch,
    BuiltinWebSearch,
    BuiltinCreateCanvas,
    BuiltinListCanvases,
    BuiltinCreateDocument,
    BuiltinListDocuments,
    BuiltinGenerateMedia,
  ] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}
