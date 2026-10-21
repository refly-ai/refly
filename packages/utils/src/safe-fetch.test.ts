import { createServer } from 'node:http';
import net, { type LookupFunction, type TcpNetConnectOpts } from 'node:net';
import type { LookupAddress, LookupAllOptions } from 'node:dns';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionError, ParamsError } from '@refly/errors';
import ipaddr from 'ipaddr.js';
import { Agent, Response, fetch } from 'undici';
import { safeFetch } from './safe-fetch';
import { scrapeWeblink } from './scrape-weblink';

type Lookup = (
  hostname: string,
  options: LookupAllOptions,
  callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;
const network = vi.hoisted(() => ({ lookup: vi.fn<Lookup>(), fetch: vi.fn<typeof fetch>() }));
const connection = vi.hoisted(() => ({
  lookup: undefined as unknown as LookupFunction,
  agent: undefined as unknown as Agent,
}));
vi.mock('node:dns', () => ({ lookup: network.lookup }));
vi.mock('undici', async (importOriginal) => {
  const original = await importOriginal<typeof import('undici')>();
  return {
    ...original,
    fetch: network.fetch,
    Agent: class extends original.Agent {
      constructor(options: Agent.Options) {
        super(options);
        if (typeof options.connect === 'object' && 'lookup' in options.connect) {
          connection.lookup = options.connect.lookup!;
        }
        connection.agent = this;
      }
    },
  };
});

async function resolveAtSocket(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    connection.lookup(hostname, { all: false }, (error, address) => {
      if (error) reject(error);
      else resolve(address as string);
    });
  });
}

async function expectBlocked(input: string) {
  try {
    await safeFetch(input);
    expect.fail('Expected the destination to be rejected');
  } catch (error) {
    expect(error).toBeInstanceOf(ParamsError);
    const blocked = error as ParamsError & { cause?: unknown };
    expect(blocked.code).toBe('E0003');
    expect(blocked.message).toBe('URL must resolve to a public HTTP(S) destination');
    expect(blocked.cause).toBeUndefined();
    expect(`${blocked.message}\n${blocked.stack}`).not.toContain('PRIVATE_SENTINEL');
  }
}

async function expectConnectionFailure(input: string) {
  try {
    await safeFetch(input);
    expect.fail('Expected a connection failure');
  } catch (error) {
    expect(error).toBeInstanceOf(ConnectionError);
    const failed = error as ConnectionError & { cause?: unknown };
    expect(failed.code).toBe('E0001');
    expect(failed.message).toBe('Cannot connect to the URL destination');
    expect(failed.cause).toBeUndefined();
    const details = `${failed.message}\n${failed.stack}\n${JSON.stringify(failed)}`;
    for (const secret of ['PRIVATE_SENTINEL', input, '93.184.216.34']) {
      expect(details).not.toContain(secret);
    }
  }
}

beforeEach(() => {
  network.lookup.mockReset().mockImplementation((_hostname, options, callback) => {
    expect(options).toEqual({ all: true, verbatim: true });
    callback(null, [{ address: '93.184.216.34', family: 4 }]);
  });
  network.fetch.mockReset().mockImplementation(async (input, options) => {
    expect(options?.redirect).toBe('manual');
    expect(options?.dispatcher).toBe(connection.agent);
    const url = new URL(String(input));
    const host = url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;
    if (!net.isIP(host)) await resolveAtSocket(host);
    return new Response('public content');
  });
});
afterAll(() => connection.agent.close());

describe('safeFetch destination policy', () => {
  it.each([
    'http://93.184.216.34',
    'https://93.184.216.34',
    'http://[2606:4700:4700::1111]',
    'https://[2606:4700:4700::1111]',
    'https://[::ffff:93.184.216.34]',
    'http://public.example',
    'https://public.example',
    'https://127.0.0.1@public.example',
    'https://PRIVATE_SENTINEL:password@public.example',
    `https://public.example/image?signature=${'PRIVATE_SENTINEL'.repeat(1000)}`,
  ])('passes public HTTP(S) destinations to fetch: %s', async (url) => {
    expect(await (await safeFetch(url)).text()).toBe('public content');
  });

  it.each([
    '127.0.0.1',
    '127.9.8.7',
    '127.1',
    '2130706433',
    '0x7f000001',
    '0177.0.0.1',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '169.254.169.254',
    '169.254.1.1',
    '0.0.0.0',
    '0.1.2.3',
    '100.64.0.1',
    '224.0.0.1',
    '239.255.255.255',
    '240.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
    '[::1]',
    '[::]',
    '[fc00::1]',
    '[fdff::1]',
    '[fe80::1]',
    '[febf::1]',
    '[fec0::1]',
    '[ff02::1]',
    '[::ffff:127.0.0.1]',
    '[::ffff:10.0.0.1]',
    '[::ffff:169.254.169.254]',
    '[::ffff:0.0.0.0]',
    '[::10.0.0.1]',
    '[64:ff9b::a00:1]',
    '[2002:0a00:0001::1]',
  ])('rejects non-public addresses and alternative forms: %s', async (host) => {
    await expectBlocked(`http://${host}/PRIVATE_SENTINEL`);
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it.each(['file:', 'ftp:', 'gopher:', 'data:', 'javascript:'])('rejects %s', async (scheme) => {
    await expectBlocked(`${scheme}//public.example/PRIVATE_SENTINEL`);
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it.each([
    '',
    'PRIVATE_SENTINEL',
    'http://',
    'http://[::1',
    'http://%ff/PRIVATE_SENTINEL',
    'http://[fe80::1%25lo0]',
    'https://public.example@127.0.0.1/PRIVATE_SENTINEL',
    null,
    undefined,
    123,
    {},
    ['https://public.example'],
  ])('rejects invalid syntax, encodings and types: %s', async (input) => {
    await expectBlocked(input as string);
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it('does not invoke input conversion hooks', async () => {
    const convert = vi.fn(() => {
      throw new Error('PRIVATE_SENTINEL');
    });
    await expectBlocked({ toString: convert } as unknown as string);
    expect(convert).not.toHaveBeenCalled();
  });

  it.each(
    [
      [{ address: '127.0.0.1', family: 4 }],
      [{ address: '::1', family: 6 }],
      [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ],
      [
        { address: '2606:4700:4700::1111', family: 6 },
        { address: '::ffff:127.0.0.1', family: 6 },
      ],
      [{ address: 'PRIVATE_SENTINEL', family: 4 }],
      [{ address: '2606:4700:4700::1111%eth-0', family: 6 }],
      [{ address: '2606:4700:4700::1111%eth0', family: 6 }],
      [],
    ].map((answers) => ({ answers })),
  )('rejects private, mixed, invalid or empty DNS answers: %j', async ({ answers }) => {
    network.lookup.mockImplementation((_hostname, _options, callback) => callback(null, answers));
    await expectBlocked('https://PRIVATE_SENTINEL.example');
  });

  it('checks all public answers and selects one for the socket', async () => {
    network.lookup.mockImplementation((_host, _options, callback) =>
      callback(null, [
        { address: '93.184.216.34', family: 4 },
        { address: '2606:4700:4700::1111', family: 6 },
      ]),
    );
    expect(await resolveAtSocket('public.example')).toBe('93.184.216.34');
    expect(network.lookup).toHaveBeenCalledTimes(1);
  });

  it('returns only checked candidates for Node dual-stack connection fallback', async () => {
    const answers = [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ];
    network.lookup.mockImplementation((_host, _options, callback) => callback(null, answers));
    const candidates = await new Promise<LookupAddress[]>((resolve, reject) => {
      connection.lookup('public.example', { all: true }, (error, addresses) => {
        if (error) reject(error);
        else resolve(addresses as LookupAddress[]);
      });
    });
    expect(candidates).toEqual(answers);
    expect(network.lookup).toHaveBeenCalledTimes(1);
  });

  it('normalizes DNS failures as connection errors without unsafe causes', async () => {
    network.lookup.mockImplementation((_host, _options, callback) => {
      callback(Object.assign(new Error('PRIVATE_SENTINEL DNS failure'), { code: 'ENOTFOUND' }), []);
    });
    const original = await vi.importActual<typeof import('undici')>('undici');
    network.fetch.mockImplementation(original.fetch);
    await expectConnectionFailure('https://public.example/PRIVATE_SENTINEL');
  });

  it.each(['ECONNRESET', 'CERT_HAS_EXPIRED', 'UND_ERR_CONNECT_TIMEOUT'])(
    'normalizes %s after safe DNS validation without unsafe causes',
    async (code) => {
      // Exercise real undici error wrapping after checked lookup, without dialing.
      const dial = vi.spyOn(net, 'connect').mockImplementation(((options: TcpNetConnectOpts) => {
        const socket = new net.Socket();
        expect(options.lookup).toBe(connection.lookup);
        options.lookup!(options.host!, { all: true }, (error, addresses) => {
          expect(error).toBeNull();
          expect(addresses).toEqual([{ address: '93.184.216.34', family: 4 }]);
          socket.destroy(
            Object.assign(new Error(`PRIVATE_SENTINEL ${code}`), {
              code,
              cause: new Error('93.184.216.34 PRIVATE_SENTINEL'),
            }),
          );
        });
        return socket;
      }) as typeof net.connect);
      const original = await vi.importActual<typeof import('undici')>('undici');
      network.fetch.mockImplementation(original.fetch);
      try {
        await expectConnectionFailure('http://public.example/PRIVATE_SENTINEL');
        expect(network.lookup).toHaveBeenCalledOnce();
      } finally {
        dial.mockRestore();
      }
    },
  );

  it('preserves a policy rejection wrapped by undici', async () => {
    network.fetch.mockRejectedValue(
      Object.assign(new Error('PRIVATE_SENTINEL'), {
        cause: new ParamsError('PRIVATE_SENTINEL resolved address'),
      }),
    );
    await expectBlocked('https://public.example');
  });

  it('keeps the underlying fetch credential restriction without leaking userinfo', async () => {
    const original = await vi.importActual<typeof import('undici')>('undici');
    network.fetch.mockImplementation(original.fetch);
    await expectConnectionFailure('https://PRIVATE_SENTINEL:password@public.example');
    expect(network.lookup).not.toHaveBeenCalled();
  });

  it('normalizes IP parser failures inside the socket lookup callback', async () => {
    const parse = vi.spyOn(ipaddr, 'process').mockImplementation(() => {
      throw new Error('PRIVATE_SENTINEL');
    });
    try {
      await expect(resolveAtSocket('public.example')).rejects.toBeInstanceOf(ParamsError);
      await expectBlocked('https://public.example');
    } finally {
      parse.mockRestore();
    }
  });
});

describe('redirects', () => {
  it.each([301, 302, 303, 307, 308])(
    'revalidates status %i and relative Location',
    async (status) => {
      const redirect = new Response('redirect body', { status, headers: { location: '/next' } });
      const cancel = vi.spyOn(redirect.body!, 'cancel');
      network.fetch.mockResolvedValueOnce(redirect);
      expect(await (await safeFetch('https://public.example/start')).text()).toBe('public content');
      expect(String(network.fetch.mock.calls[1][0])).toBe('https://public.example/next');
      expect(cancel).toHaveBeenCalledOnce();
    },
  );

  it.each([
    'http://127.0.0.1/PRIVATE_SENTINEL',
    '//169.254.169.254/PRIVATE_SENTINEL',
    'http://[::ffff:127.0.0.1]/PRIVATE_SENTINEL',
    'file:///PRIVATE_SENTINEL',
    'http://[PRIVATE_SENTINEL',
  ])('blocks unsafe redirects before the next request: %s', async (location) => {
    network.fetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location } }));
    await expectBlocked('https://public.example');
    expect(network.fetch).toHaveBeenCalledTimes(1);
  });

  it('checks DNS for a redirected hostname', async () => {
    network.fetch.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'https://internal.example' },
      }),
    );
    network.lookup.mockImplementation((_host, _options, callback) => {
      callback(null, [{ address: '127.0.0.1', family: 4 }]);
    });
    await expectBlocked('https://public.example');
    expect(network.lookup.mock.calls[0][0]).toBe('internal.example');
  });

  it('rejects a later private hop', async () => {
    network.fetch
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/two' } }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 307,
          headers: { location: 'http://169.254.169.254/PRIVATE_SENTINEL' },
        }),
      );
    await expectBlocked('https://public.example/one');
    expect(network.fetch).toHaveBeenCalledTimes(2);
  });

  it('preserves long signed redirect URLs', async () => {
    const location = `https://public.example/image?signature=${'PRIVATE_SENTINEL'.repeat(1000)}`;
    network.fetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location } }));
    expect(await (await safeFetch('https://public.example')).text()).toBe('public content');
    expect(String(network.fetch.mock.calls[1][0])).toBe(location);
  });

  it('normalizes a redirect body cancellation failure as a connection error', async () => {
    const redirect = new Response('body', { status: 302, headers: { location: '/next' } });
    vi.spyOn(redirect.body!, 'cancel').mockRejectedValue(new Error('PRIVATE_SENTINEL'));
    network.fetch.mockResolvedValueOnce(redirect);
    await expectConnectionFailure('https://public.example/PRIVATE_SENTINEL');
    expect(network.fetch).toHaveBeenCalledOnce();
  });

  it('allows twenty public redirects and validates every hop', async () => {
    let requests = 0;
    network.fetch.mockImplementation(async (input) => {
      await resolveAtSocket(new URL(String(input)).hostname);
      return requests++ < 20
        ? new Response(null, { status: 302, headers: { location: '/next' } })
        : new Response('public content');
    });
    expect(await (await safeFetch('https://public.example')).text()).toBe('public content');
    expect(network.fetch).toHaveBeenCalledTimes(21);
    expect(network.lookup).toHaveBeenCalledTimes(21);
  });

  it('caps a redirect loop at twenty redirects', async () => {
    network.fetch.mockImplementation(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: '/loop' },
        }),
    );
    await expectBlocked('https://public.example/loop');
    expect(network.fetch).toHaveBeenCalledTimes(21);
  });

  it('preserves a non-redirect response and a redirect without Location', async () => {
    network.fetch
      .mockResolvedValueOnce(new Response('missing', { status: 404 }))
      .mockResolvedValueOnce(new Response('no location', { status: 302 }));
    expect((await safeFetch('https://public.example')).status).toBe(404);
    expect(await (await safeFetch('https://public.example')).text()).toBe('no location');
  });
});

describe('consumers and connection binding', () => {
  it('preserves HTML metadata and binary bytes', async () => {
    network.fetch
      .mockResolvedValueOnce(
        new Response(
          '<title>Public title</title><meta name="description" content="Public description">' +
            '<meta property="og:image" content="https://public.example/image.png">',
        ),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([0, 255, 1, 128])));
    expect(await scrapeWeblink('https://public.example')).toEqual({
      title: 'Public title',
      description: 'Public description',
      image: 'https://public.example/image.png',
    });
    expect(
      new Uint8Array(await (await safeFetch('https://public.example/image.png')).arrayBuffer()),
    ).toEqual(new Uint8Array([0, 255, 1, 128]));
  });

  it('blocks the original localhost reproduction without contacting the service', async () => {
    let hits = 0;
    const server = createServer((_request, response) => {
      hits++;
      response.end('<title>INTERNAL_SECRET_TITLE</title>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const port = (server.address() as net.AddressInfo).port;
      await expect(scrapeWeblink(`http://127.0.0.1:${port}`)).rejects.toBeInstanceOf(ParamsError);
      expect(hits).toBe(0);
      expect(network.fetch).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('uses the validated socket lookup without a second DNS resolution', async () => {
    const server = createServer((_request, response) => response.end('bound connection'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as net.AddressInfo).port;
    const approved: string[] = [];
    network.lookup
      .mockImplementationOnce((_host, _options, callback) => {
        callback(null, [{ address: '93.184.216.34', family: 4 }]);
      })
      .mockImplementation((_host, _options, callback) => {
        callback(null, [{ address: '127.0.0.1', family: 4 }]);
      });
    // Intercept only TCP dialing: require the real undici Agent's lookup and
    // reroute its approved IP to our local fixture. No public network is used.
    const dial = vi.spyOn(net, 'connect').mockImplementation(((options: TcpNetConnectOpts) => {
      const socket = new net.Socket();
      expect(options.lookup).toBe(connection.lookup);
      expect(options.autoSelectFamily).toBe(true);
      options.lookup!(options.host!, { all: true }, (error, addresses) => {
        if (error) {
          socket.destroy(error);
          return;
        }
        approved.push(...(addresses as LookupAddress[]).map(({ address }) => address));
        socket.connect({ host: '127.0.0.1', port });
      });
      return socket;
    }) as typeof net.connect);
    const original = await vi.importActual<typeof import('undici')>('undici');
    network.fetch.mockImplementation(original.fetch);
    try {
      expect(await (await safeFetch(`http://binding.example:${port}`)).text()).toBe(
        'bound connection',
      );
      expect(approved).toEqual(['93.184.216.34']);
      expect(network.lookup).toHaveBeenCalledTimes(1);
      // A new real connection seeing the rebound answer is rejected.
      await expectBlocked(`http://binding.example:${port}`);
      expect(network.lookup).toHaveBeenCalledTimes(2);
      expect(approved).toEqual(['93.184.216.34']);
    } finally {
      dial.mockRestore();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
