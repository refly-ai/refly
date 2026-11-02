import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import { McpEnabledGuard } from './mcp-enabled.guard';
import { McpServerController } from './mcp-server.controller';
import { McpServerService } from './mcp-server.service';

jest.mock('../auth/guard/jwt-auth.guard', () => ({
  JwtAuthGuard: class {
    canActivate() {
      return true;
    }
  },
}));
jest.mock('./mcp-server.service', () => ({ McpServerService: jest.fn() }));
jest.mock('./mcp-server.dto', () => ({ mcpServerPO2DTO: jest.fn() }));

describe('MCP disabled HTTP entrypoints', () => {
  let app: INestApplication;
  let url: string;
  const service = {
    listMcpServers: jest.fn(),
    createMcpServer: jest.fn(),
    updateMcpServer: jest.fn(),
    deleteMcpServer: jest.fn(),
    validateMcpServer: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ mcp: { enabled: false } })],
        }),
        McpModule.forRoot({
          name: 'disabled-test',
          version: '1.0.0',
          transport: McpTransportType.STREAMABLE_HTTP,
          guards: [McpEnabledGuard],
        }),
      ],
      controllers: [McpServerController],
      providers: [McpEnabledGuard, { provide: McpServerService, useValue: service }],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each([
    ['GET', '/v1/mcp-server/list'],
    ['POST', '/v1/mcp-server/create'],
    ['POST', '/v1/mcp-server/update'],
    ['POST', '/v1/mcp-server/delete'],
    ['POST', '/v1/mcp-server/validate'],
    ['GET', '/mcp'],
    ['POST', '/mcp'],
    ['DELETE', '/mcp'],
  ])('rejects %s %s before the handler runs', async (method, path) => {
    const response = await fetch(url + path, { method });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ message: 'MCP is disabled' });
    for (const handler of Object.values(service)) expect(handler).not.toHaveBeenCalled();
  });
});
