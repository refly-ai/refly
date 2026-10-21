import { ConnectionError, ParamsError } from '@refly/errors';
import { safeFetch, scrapeWeblink } from '@refly/utils/server';
import { MiscService } from './misc.service';

jest.mock('@refly/utils/server', () => ({ safeFetch: jest.fn(), scrapeWeblink: jest.fn() }));
jest.mock('@refly/utils', () => ({}));
jest.mock('@paralleldrive/cuid2', () => ({ createId: jest.fn() }));
jest.mock('sharp', () => jest.fn());
jest.mock('../common/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../common/redis.service', () => ({ RedisService: class {} }));
jest.mock('../common/object-storage', () => ({
  ObjectStorageService: class {},
  OSS_EXTERNAL: 'external',
  OSS_INTERNAL: 'internal',
}));
jest.mock('../knowledge/parsers/pandoc.parser', () => ({ PandocParser: class {} }));
jest.mock('../../utils', () => ({
  QUEUE_IMAGE_PROCESSING: 'images',
  QUEUE_CLEAN_STATIC_FILES: 'cleanup',
}));

describe('MiscService untrusted downloads', () => {
  const guardedFetch = jest.mocked(safeFetch);
  const guardedScrape = jest.mocked(scrapeWeblink);
  const directFetch = jest.spyOn(globalThis, 'fetch');
  let service: MiscService;

  beforeEach(() => {
    jest.resetAllMocks();
    directFetch.mockRejectedValue(new Error('Direct network access is forbidden in this test'));
    service = Object.create(MiscService.prototype) as MiscService;
  });
  afterAll(() => directFetch.mockRestore());

  it('routes metadata scraping through the guarded scraper', async () => {
    const result = { title: 'Public title', description: 'Public description', image: 'image.png' };
    guardedScrape.mockResolvedValue(result);
    expect(await service.scrapeWeblink({ url: 'https://public.example' })).toEqual(result);
    expect(guardedScrape).toHaveBeenCalledWith('https://public.example');
  });

  it.each([
    {
      name: 'policy rejection',
      error: new ParamsError('URL must resolve to a public HTTP(S) destination'),
      url: 'http://127.0.0.1',
    },
    {
      name: 'connection failure',
      error: new ConnectionError('Cannot connect to the URL destination'),
      url: 'https://public.example',
    },
  ])('propagates $name in both paths without uploading', async ({ error: blocked, url }) => {
    guardedScrape.mockRejectedValue(blocked);
    guardedFetch.mockRejectedValue(blocked);
    const upload = jest.spyOn(service, 'uploadFile');
    await expect(service.scrapeWeblink({ url })).rejects.toBe(blocked);
    await expect(service.dumpFileFromURL({ uid: 'user' }, { url })).rejects.toBe(blocked);
    expect(upload).not.toHaveBeenCalled();
  });

  it.each([
    'https://public.example/image?token=removed',
    `https://public.example/image?signature=${'signed-token'.repeat(1000)}`,
  ])('keeps binary bytes, filename, MIME type and upload context for %s', async (url) => {
    const bytes = new Uint8Array([0, 255, 1, 128]);
    // Only the Response methods used by this consumer are needed here.
    guardedFetch.mockResolvedValue({
      arrayBuffer: async () => bytes.buffer,
      headers: new Headers({ 'content-type': 'image/png' }),
    } as Awaited<ReturnType<typeof safeFetch>>);
    const uploaded = { url: 'https://files.example/image.png', storageKey: 'image' };
    const upload = jest.spyOn(service, 'uploadFile').mockResolvedValue(uploaded);
    expect(
      await service.dumpFileFromURL(
        { uid: 'user' },
        {
          url,
          entityId: 'resource',
          entityType: 'resource',
        },
      ),
    ).toEqual(uploaded);
    expect(guardedFetch).toHaveBeenCalledWith(url);
    expect(upload).toHaveBeenCalledWith(
      { uid: 'user' },
      {
        file: { buffer: Buffer.from(bytes), mimetype: 'image/png', originalname: 'image.png' },
        entityId: 'resource',
        entityType: 'resource',
        visibility: 'private',
      },
    );
  });
});
