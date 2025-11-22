export interface CacheOptions {
  ttl?: number;
}

export class SingleFlightCache<T = any> {
  private data: T;
  private dataSyncedAt: Date | null = null;
  private dataFetchPromise: Promise<T> | null = null;

  private ttl: number;

  constructor(
    private readonly fetchData: () => Promise<T>,
    options: CacheOptions = {},
  ) {
    this.ttl = options.ttl || 1000 * 10; // 10 seconds by default
  }

  async get() {
    // If data is already fetched and not expired, return it
    if (this.dataSyncedAt && this.data && this.dataSyncedAt > new Date(Date.now() - this.ttl)) {
      return this.data;
    }

    // If data is being fetched, return the promise
    if (this.dataFetchPromise) {
      return this.dataFetchPromise;
    }

    // Do the actual fetching
    this.dataFetchPromise = this.fetchData();

    try {
      const data = await this.dataFetchPromise;
      this.data = data;
      this.dataSyncedAt = new Date();
      return data;
    } finally {
      this.dataFetchPromise = null;
    }
  }

  /**
   * Manually set cache data and refresh timestamp
   */
  set(data: T) {
    this.data = data;
    this.dataSyncedAt = new Date();
    this.dataFetchPromise = null;
  }
}
