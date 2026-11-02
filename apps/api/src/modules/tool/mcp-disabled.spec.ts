import type { User } from '@refly/openapi-schema';
import { MultiServerMCPClient } from '@refly/skill-template';
import { ToolService } from './tool.service';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from '../common/encryption.service';

jest.mock('@refly/skill-template', () => ({ MultiServerMCPClient: jest.fn() }));
jest.mock('@refly/agent-tools', () => ({}));
jest.mock('@refly/canvas-common', () => ({}));
jest.mock('@refly/utils', () => ({}));
jest.mock('../common/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../common/encryption.service', () => ({ EncryptionService: jest.fn() }));
jest.mock('../credit/credit.service', () => ({ CreditService: jest.fn() }));
jest.mock('./composio/composio.service', () => ({ ComposioService: jest.fn() }));
jest.mock('./dynamic-tooling/factory.service', () => ({ ToolFactory: jest.fn() }));
jest.mock('./inventory/inventory.service', () => ({ ToolInventoryService: jest.fn() }));
jest.mock('./handlers/core/wrapper.service', () => ({ ToolWrapperFactoryService: jest.fn() }));

// Keep the real MCP service and runtime methods; isolate unrelated tool integrations.
describe('MCP disabled in existing workflows', () => {
  const user = { uid: 'workflow-user' } as User;
  let service: ToolService;
  let mcp: McpServerService;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = createMock<ConfigService>();
    config.get.mockReturnValue(false);
    mcp = new McpServerService(
      createMock<PrismaService>(),
      createMock<EncryptionService>(),
      config,
    );
    service = Object.assign(Object.create(ToolService.prototype), { mcpServerService: mcp });
  });

  it('does not read stored configurations or instantiate a client for existing MCP selections', async () => {
    const list = jest.spyOn(mcp, 'listMcpServers');
    const result = await (service as any).instantiateMcpServers(user, [
      { name: 'existing-server', type: 'mcp' },
    ]);
    expect(result.tools).toEqual([]);
    await expect(result.cleanup()).resolves.toBeUndefined();
    expect(list).not.toHaveBeenCalled();
    expect(MultiServerMCPClient).not.toHaveBeenCalled();
  });

  it('keeps non-MCP tools visible while removing MCP tools', async () => {
    const builtin = { id: 'builtin' };
    const regular = { id: 'regular' };
    const oauth = { id: 'oauth' };
    Object.assign(service, {
      listBuiltinTools: jest.fn().mockReturnValue([builtin]),
      listRegularTools: jest.fn().mockResolvedValue([regular]),
      listOAuthTools: jest.fn().mockResolvedValue([oauth]),
    });
    await expect(service.listTools(user)).resolves.toEqual([builtin, regular, oauth]);
    expect(MultiServerMCPClient).not.toHaveBeenCalled();
  });
});
