import type { LookupAddress, LookupAllOptions } from 'node:dns';
import { readFileSync } from 'node:fs';
import type { RequestListener } from 'node:http';
import { createServer } from 'node:https';
import type { AddressInfo, LookupFunction, TcpNetConnectOpts } from 'node:net';
import { join } from 'node:path';
import type { Duplex } from 'node:stream';
import tls from 'node:tls';
import type { ConnectionOptions } from 'node:tls';
import { ConnectionError, ParamsError } from '@refly/errors';
import type { Agent } from 'undici';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeFetch } from './safe-fetch';

type Lookup = (
  hostname: string,
  options: LookupAllOptions,
  callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;
const network = vi.hoisted(() => ({ lookup: vi.fn<Lookup>() }));
const connection = vi.hoisted(() => ({
  lookup: undefined as unknown as LookupFunction,
  agent: undefined as unknown as Agent,
}));
vi.mock('node:dns', () => ({ lookup: network.lookup }));
vi.mock('undici', async (importOriginal) => {
  const original = await importOriginal<typeof import('undici')>();
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  return {
    ...original,
    Agent: class extends original.Agent {
      constructor(options: Agent.Options) {
        expect(typeof options.connect).toBe('object');
        const connect = options.connect as ConnectionOptions;
        connection.lookup = connect.lookup!;
        // Trust only the fixture CA; retain Node's certificate and hostname checks.
        super({
          ...options,
          connect: {
            ...connect,
            ca: readFileSync(join(__dirname, '__fixtures__/safe-fetch-tls/ca.crt')),
          },
        });
        connection.agent = this;
      }
    },
  };
});

beforeEach(() => {
  network.lookup.mockReset().mockImplementation((_hostname, options, callback) => {
    expect(options).toEqual({ all: true, verbatim: true });
    callback(null, [{ address: '93.184.216.34', family: 4 }]);
  });
});
afterAll(() => connection.agent.close());

async function withHttpsFixture(
  certificate: 'server' | 'untrusted',
  check: (fixture: {
    port: number;
    approved: string[];
    sni: string[];
    requests: string[];
    tlsErrors: string[];
  }) => Promise<void>,
  handler: RequestListener = (_request, response) => response.end('secure content'),
) {
  const fixturePath = join(__dirname, '__fixtures__/safe-fetch-tls');
  const approved: string[] = [];
  const sni: string[] = [];
  const requests: string[] = [];
  const tlsErrors: string[] = [];
  const sockets = new Set<Duplex>();
  const server = createServer(
    {
      cert: readFileSync(join(fixturePath, `${certificate}.crt`)),
      key: readFileSync(join(fixturePath, `${certificate}.key`)),
    },
    (request, response) => {
      requests.push(`${request.headers.host}${request.url}`);
      handler(request, response);
    },
  );
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('secureConnection', (socket) =>
    sni.push((socket as tls.TLSSocket & { servername: string }).servername),
  );
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = (server.address() as AddressInfo).port;
  const connect = tls.connect;
  // Intercept only routing after the production socket lookup approves DNS.
  // The real TLS handshake still uses the URL hostname for SNI and verification.
  const dial = vi.spyOn(tls, 'connect').mockImplementation(((
    options: ConnectionOptions & Pick<TcpNetConnectOpts, 'autoSelectFamily'>,
  ) => {
    expect(options.lookup).toBe(connection.lookup);
    expect(options.autoSelectFamily).toBe(true);
    expect(options.servername).toBe(options.host);
    expect(options.rejectUnauthorized).not.toBe(false);
    expect(options.checkServerIdentity).toBeUndefined();
    const socket = connect({
      ...options,
      lookup(hostname, lookupOptions, callback) {
        connection.lookup(hostname, lookupOptions, (error, addresses) => {
          if (error) {
            callback(error, '', 0);
            return;
          }
          expect(lookupOptions.all).toBe(true);
          expect(addresses).toEqual([{ address: '93.184.216.34', family: 4 }]);
          approved.push(hostname);
          callback(null, [{ address: '127.0.0.1', family: 4 }]);
        });
      },
    });
    socket.on('error', (error: NodeJS.ErrnoException) => tlsErrors.push(error.code!));
    return socket;
  }) as typeof tls.connect);
  try {
    await check({ port, approved, sni, requests, tlsErrors });
  } finally {
    dial.mockRestore();
    for (const socket of sockets) socket.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function expectSanitizedFailure(input: string, blocked = false) {
  try {
    await safeFetch(input);
    expect.fail('Expected the HTTPS destination to be rejected');
  } catch (error) {
    expect(error).toBeInstanceOf(blocked ? ParamsError : ConnectionError);
    const failure = error as ConnectionError & { cause?: unknown };
    expect(failure.code).toBe(blocked ? 'E0003' : 'E0001');
    expect(failure.message).toBe(
      blocked
        ? 'URL must resolve to a public HTTP(S) destination'
        : 'Cannot connect to the URL destination',
    );
    expect(failure.cause).toBeUndefined();
    const details = `${failure.message}\n${failure.stack}\n${JSON.stringify(failure)}`;
    for (const secret of [
      'PRIVATE_SENTINEL',
      input,
      new URL(input).hostname,
      '93.184.216.34',
      '127.0.0.1',
      '10.0.0.1',
      'Refly HTTPS test CA',
    ]) {
      expect(details).not.toContain(secret);
    }
  }
}

describe('safeFetch real HTTPS connections', () => {
  it('preserves the hostname, SNI and checked DNS through a trusted TLS handshake', async () => {
    await withHttpsFixture('server', async ({ port, approved, sni, requests }) => {
      const url = `https://public.fixture.example:${port}/content`;
      expect(await (await safeFetch(url)).text()).toBe('secure content');
      expect(sni).toEqual(['public.fixture.example']);
      expect(requests).toEqual([`public.fixture.example:${port}/content`]);
      expect(approved).toEqual(['public.fixture.example']);
      expect(network.lookup.mock.calls.map(([hostname]) => hostname)).toEqual(approved);
    });
  });

  it.each([
    ['server', 'wrong.fixture.example'],
    ['untrusted', 'public.fixture.example'],
  ] as const)('rejects %s certificate for %s without exposing TLS details', async (cert, host) => {
    await withHttpsFixture(cert, async ({ port, approved, requests, tlsErrors }) => {
      await expectSanitizedFailure(`https://${host}:${port}/PRIVATE_SENTINEL`);
      expect(approved).toEqual([host]);
      expect(network.lookup.mock.calls.map(([hostname]) => hostname)).toEqual([host]);
      expect(requests).toEqual([]);
      expect(tlsErrors).toEqual([
        cert === 'server' ? 'ERR_TLS_CERT_ALTNAME_INVALID' : 'DEPTH_ZERO_SELF_SIGNED_CERT',
      ]);
    });
  });

  it('revalidates public HTTPS redirects with fresh DNS and TLS hostname checks', async () => {
    await withHttpsFixture(
      'server',
      async ({ port, approved, sni, requests }) => {
        const url = `https://public.fixture.example:${port}/start`;
        expect(await (await safeFetch(url)).text()).toBe('redirect content');
        expect(approved).toEqual(['public.fixture.example', 'redirect.fixture.example']);
        expect(network.lookup.mock.calls.map(([hostname]) => hostname)).toEqual(approved);
        expect(sni).toEqual(approved);
        expect(requests).toEqual([
          `public.fixture.example:${port}/start`,
          `redirect.fixture.example:${port}/final`,
        ]);
      },
      (request, response) => {
        if (request.url === '/start') {
          response.writeHead(302, {
            location: `https://redirect.fixture.example:${request.socket.localPort}/final`,
          });
        } else {
          response.write('redirect content');
        }
        response.end();
      },
    );
  });

  it.each(['private IP', 'private DNS', 'DNS rebinding'])(
    'blocks an HTTPS redirect to %s before another local connection',
    async (destination) => {
      network.lookup.mockImplementation((_hostname, options, callback) => {
        expect(options).toEqual({ all: true, verbatim: true });
        callback(null, [
          {
            address: network.lookup.mock.calls.length === 1 ? '93.184.216.34' : '10.0.0.1',
            family: 4,
          },
        ]);
      });
      await withHttpsFixture(
        'server',
        async ({ port, approved, sni, requests }) => {
          await expectSanitizedFailure(
            `https://public.fixture.example:${port}/PRIVATE_SENTINEL`,
            true,
          );
          expect(approved).toEqual(['public.fixture.example']);
          expect(sni).toEqual(approved);
          expect(requests).toEqual([`public.fixture.example:${port}/PRIVATE_SENTINEL`]);
          const expected = ['public.fixture.example'];
          if (destination !== 'private IP') {
            expected.push(destination === 'private DNS' ? 'internal.fixture.example' : expected[0]);
          }
          expect(network.lookup.mock.calls.map(([hostname]) => hostname)).toEqual(expected);
        },
        (request, response) => {
          const hostname =
            destination === 'private IP'
              ? '127.0.0.1'
              : destination === 'private DNS'
                ? 'internal.fixture.example'
                : 'public.fixture.example';
          response.writeHead(302, {
            location: `https://${hostname}:${request.socket.localPort}/PRIVATE_SENTINEL`,
          });
          response.end();
        },
      );
    },
  );
});
