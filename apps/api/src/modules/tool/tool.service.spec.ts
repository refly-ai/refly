import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { ToolService } from './tool.service';
import { PrismaService } from '../common/prisma.service';
import { SkillService } from '../skill/skill.service';
import { ToolExecutionService } from './tool-execution/tool-execution.service';
import { SandboxService } from './sandbox/sandbox.service';
import { ResourceService } from './resource.service';
import type { User } from '@refly/openapi-schema';

describe('ToolService', () => {
  let service: ToolService;

  const configService = createMock<ConfigService>();
  const prismaService = createMock<PrismaService>();
  const skillService = createMock<SkillService>();
  const toolExecutionService = createMock<ToolExecutionService>();
  const sandboxService = createMock<SandboxService>();
  const resourceService = createMock<ResourceService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolService,
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prismaService },
        { provide: SkillService, useValue: skillService },
        { provide: ToolExecutionService, useValue: toolExecutionService },
        { provide: SandboxService, useValue: sandboxService },
        { provide: ResourceService, useValue: resourceService },
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
