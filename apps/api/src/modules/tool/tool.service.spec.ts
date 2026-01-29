import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { ToolService } from './tool.service';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { ComposioService } from './composio/composio.service';
import { CreditService } from '../credit/credit.service';
import { ToolFactory } from './dynamic-tooling/factory.service';
import { ToolInventoryService } from './inventory/inventory.service';
import { ToolWrapperFactoryService } from './tool-execution/wrapper/wrapper.service';
import type { User } from '@refly/openapi-schema';

describe('ToolService', () => {
  let service: ToolService;

  const configService = createMock<ConfigService>();
  const prismaService = createMock<PrismaService>();
  const encryptionService = createMock<EncryptionService>();
  const mcpServerService = createMock<McpServerService>();
  const composioService = createMock<ComposioService>();
  const creditService = createMock<CreditService>();
  const toolFactory = createMock<ToolFactory>();
  const inventoryService = createMock<ToolInventoryService>();
  const toolWrapperFactory = createMock<ToolWrapperFactoryService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolService,
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prismaService },
        { provide: EncryptionService, useValue: encryptionService },
        { provide: McpServerService, useValue: mcpServerService },
        { provide: ComposioService, useValue: composioService },
        { provide: CreditService, useValue: creditService },
        { provide: ToolFactory, useValue: toolFactory },
        { provide: ToolInventoryService, useValue: inventoryService },
        { provide: ToolWrapperFactoryService, useValue: toolWrapperFactory },
      ],
    }).compile();

    service = module.get<ToolService>(ToolService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('instantiateCopilotToolsets', () => {
    it('should return 5 tools including read_file and list_files', () => {
      const mockUser = createMock<User>();
      const mockEngine = {
        service: {
          librarySearch: jest.fn(),
          getActionResult: jest.fn(),
          getFileContent: jest.fn(),
          listFiles: jest.fn(),
          generateDoc: jest.fn(),
          generateCodeArtifact: jest.fn(),
          sendEmail: jest.fn(),
          getTime: jest.fn(),
          executeCode: jest.fn(),
        },
      };

      // Access private method via type assertion
      const tools = (service as any).instantiateCopilotToolsets(mockUser, mockEngine);

      expect(tools).toHaveLength(5);
      expect(tools.map((t: any) => t.name)).toEqual([
        'copilot_generate_workflow',
        'copilot_patch_workflow',
        'copilot_get_workflow_summary',
        'copilot_read_file',
        'copilot_list_files',
      ]);
    });

    it('read_file tool should have correct metadata', () => {
      const mockUser = createMock<User>();
      const mockEngine = {
        service: {
          librarySearch: jest.fn(),
          getActionResult: jest.fn(),
          getFileContent: jest.fn(),
          listFiles: jest.fn(),
          generateDoc: jest.fn(),
          generateCodeArtifact: jest.fn(),
          sendEmail: jest.fn(),
          getTime: jest.fn(),
          executeCode: jest.fn(),
        },
      };

      const tools = (service as any).instantiateCopilotToolsets(mockUser, mockEngine);
      const readFileTool = tools.find((t: any) => t.name === 'copilot_read_file');

      expect(readFileTool).toBeDefined();
      expect(readFileTool.metadata).toMatchObject({
        type: 'copilot',
        toolsetKey: 'copilot',
        toolsetName: 'Copilot',
      });
    });

    it('list_files tool should have correct metadata', () => {
      const mockUser = createMock<User>();
      const mockEngine = {
        service: {
          librarySearch: jest.fn(),
          getActionResult: jest.fn(),
          getFileContent: jest.fn(),
          listFiles: jest.fn(),
          generateDoc: jest.fn(),
          generateCodeArtifact: jest.fn(),
          sendEmail: jest.fn(),
          getTime: jest.fn(),
          executeCode: jest.fn(),
        },
      };

      const tools = (service as any).instantiateCopilotToolsets(mockUser, mockEngine);
      const listFilesTool = tools.find((t: any) => t.name === 'copilot_list_files');

      expect(listFilesTool).toBeDefined();
      expect(listFilesTool.metadata).toMatchObject({
        type: 'copilot',
        toolsetKey: 'copilot',
        toolsetName: 'Copilot',
      });
    });

    it('should reuse builtin tool implementations', () => {
      const mockUser = createMock<User>();
      const mockEngine = {
        service: {
          librarySearch: jest.fn(),
          getActionResult: jest.fn(),
          getFileContent: jest.fn(),
          listFiles: jest.fn(),
          generateDoc: jest.fn(),
          generateCodeArtifact: jest.fn(),
          sendEmail: jest.fn(),
          getTime: jest.fn(),
          executeCode: jest.fn(),
        },
      };

      const tools = (service as any).instantiateCopilotToolsets(mockUser, mockEngine);
      const readFileTool = tools.find((t: any) => t.name === 'copilot_read_file');
      const listFilesTool = tools.find((t: any) => t.name === 'copilot_list_files');

      // Verify tools have correct schema and func
      expect(readFileTool.schema).toBeDefined();
      expect(readFileTool.func).toBeInstanceOf(Function);
      expect(listFilesTool.schema).toBeDefined();
      expect(listFilesTool.func).toBeInstanceOf(Function);
    });
  });
});
