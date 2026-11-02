import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { MultiServerMCPClient } from '@refly/skill-template';
import type { User } from '@refly/openapi-schema';
import { McpServerService } from './mcp-server.service';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import appConfig from '../config/app.config';

jest.mock('../common/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../common/encryption.service', () => ({ EncryptionService: jest.fn() }));
jest.mock('@refly/skill-template', () => ({
  MultiServerMCPClient: jest.fn(),
  createMcpClientConfig: jest.fn(),
}));

const user = { uid: 'mcp-test-user' } as User;

describe('MCP service disablement', () => {
  const prisma = createMock<PrismaService>();
  const encryption = createMock<EncryptionService>();
  const config = createMock<ConfigService>();
  let service: McpServerService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(false);
    service = new McpServerService(prisma, encryption, config);
  });

  it.each(['createMcpServer', 'updateMcpServer', 'deleteMcpServer', 'validateMcpServer'] as const)(
    'rejects %s before storage, encryption or connections',
    async (method) => {
      await expect(
        service[method](user, { name: 'existing', type: 'stdio', command: 'blocked' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.mcpServer.findFirst).not.toHaveBeenCalled();
      expect(prisma.mcpServer.create).not.toHaveBeenCalled();
      expect(prisma.mcpServer.update).not.toHaveBeenCalled();
      expect(encryption.encrypt).not.toHaveBeenCalled();
      expect(MultiServerMCPClient).not.toHaveBeenCalled();
    },
  );

  it('hides user and global MCP tools without reading or decrypting existing configurations', async () => {
    await expect(service.listMcpServers(user, { enabled: true })).resolves.toEqual([]);
    await expect(service.fetchGlobalMcpServerConfig()).resolves.toEqual({ servers: [] });
    expect(prisma.mcpServer.findMany).not.toHaveBeenCalled();
    expect(encryption.decrypt).not.toHaveBeenCalled();
  });

  it('does not expose a cached global server after disablement', async () => {
    config.get.mockReturnValue(true);
    jest
      .spyOn(prisma.mcpServer, 'findMany')
      .mockResolvedValue([{ name: 'cached-global', isGlobal: true } as never]);
    await service.listMcpServers(user, { enabled: true });
    jest.clearAllMocks();
    config.get.mockReturnValue(false);
    await expect(service.listMcpServers(user, { enabled: true })).resolves.toEqual([]);
    expect(prisma.mcpServer.findMany).not.toHaveBeenCalled();
  });

  it('preserves explicit opt-in for deployments where MCP is enabled', async () => {
    config.get.mockReturnValue(true);
    jest.spyOn(prisma.mcpServer, 'findMany').mockResolvedValue([]);
    await expect(service.listMcpServers(user, { enabled: true })).resolves.toEqual([]);
    expect(prisma.mcpServer.findMany).toHaveBeenCalled();
  });
});

describe('MCP environment switch', () => {
  const original = process.env.MCP_ENABLED;
  afterEach(() => {
    if (original === undefined) Reflect.deleteProperty(process.env, 'MCP_ENABLED');
    else process.env.MCP_ENABLED = original;
  });
  it.each([undefined, 'false', '', 'TRUE', 'unexpected'])('fails closed for %s', (value) => {
    if (value === undefined) Reflect.deleteProperty(process.env, 'MCP_ENABLED');
    else process.env.MCP_ENABLED = value;
    expect(appConfig().mcp.enabled).toBe(false);
  });
  it('only enables MCP with an explicit true', () => {
    process.env.MCP_ENABLED = 'true';
    expect(appConfig().mcp.enabled).toBe(true);
  });
});
