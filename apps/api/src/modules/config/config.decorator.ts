import { ConfigService } from '@nestjs/config';

/**
 * Configuration decorators for property-based config injection
 * Requires ConfigService to be injected as 'config' in the class constructor
 *
 * @example
 * ```typescript
 * class MyService {
 *   constructor(private readonly config: ConfigService) {}
 *
 *   @Config.integer('app.port', 3000)
 *   private port: number;
 *
 *   @Config.string('app.name', 'default')
 *   private appName: string;
 *
 *   @Config.boolean('app.debug', false)
 *   private debug: boolean;
 * }
 * ```
 */
export namespace Config {
  /**
   * Decorator for integer configuration values
   * Reads from ConfigService and parses to integer with default fallback
   */
  export function integer(path: string, defaultValue: number) {
    // biome-ignore lint/complexity/useArrowFunction: need dynamic this binding in decorators
    return function (target: any, propertyKey: string) {
      Object.defineProperty(target, propertyKey, {
        get() {
          const config: ConfigService = this.config;
          if (!config) {
            throw new Error(
              `Config.integer decorator requires 'config: ConfigService' to be injected in ${target.constructor.name}`,
            );
          }
          const raw = config.get<unknown>(path);
          if (raw === undefined || raw === null) return defaultValue;
          if (typeof raw === 'number') return Math.floor(raw);
          if (typeof raw === 'string') {
            const parsed = Number.parseInt(raw, 10);
            return Number.isNaN(parsed) ? defaultValue : parsed;
          }
          return defaultValue;
        },
        enumerable: true,
        configurable: true,
      });
    };
  }

  /**
   * Decorator for string configuration values
   * Reads from ConfigService with default fallback
   */
  export function string(path: string, defaultValue: string) {
    // biome-ignore lint/complexity/useArrowFunction: need dynamic this binding in decorators
    return function (target: any, propertyKey: string) {
      Object.defineProperty(target, propertyKey, {
        get() {
          const config: ConfigService = this.config;
          if (!config) {
            throw new Error(
              `Config.string decorator requires 'config: ConfigService' to be injected in ${target.constructor.name}`,
            );
          }
          const raw = config.get<unknown>(path);
          if (raw === undefined || raw === null) return defaultValue;
          if (typeof raw === 'string') return raw;
          if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
          return defaultValue;
        },
        enumerable: true,
        configurable: true,
      });
    };
  }

  /**
   * Decorator for boolean configuration values
   * Reads from ConfigService and parses to boolean with default fallback
   */
  export function boolean(path: string, defaultValue: boolean) {
    // biome-ignore lint/complexity/useArrowFunction: need dynamic this binding in decorators
    return function (target: any, propertyKey: string) {
      Object.defineProperty(target, propertyKey, {
        get() {
          const config: ConfigService = this.config;
          if (!config) {
            throw new Error(
              `Config.boolean decorator requires 'config: ConfigService' to be injected in ${target.constructor.name}`,
            );
          }
          const raw = config.get<unknown>(path);
          if (raw === undefined || raw === null) return defaultValue;
          if (typeof raw === 'boolean') return raw;
          if (typeof raw === 'string') return raw === 'true';
          if (typeof raw === 'number') return raw !== 0;
          return defaultValue;
        },
        enumerable: true,
        configurable: true,
      });
    };
  }

  /**
   * Decorator for object configuration values
   * Reads nested config object from ConfigService with default fallback
   * Merges runtime config with defaults to handle partial configs
   */
  export function object<T extends Record<string, any>>(path: string, defaultValue: T) {
    // biome-ignore lint/complexity/useArrowFunction: need dynamic this binding in decorators
    return function (target: any, propertyKey: string) {
      Object.defineProperty(target, propertyKey, {
        get() {
          const config: ConfigService = this.config;
          if (!config) {
            throw new Error(
              `Config.object decorator requires 'config: ConfigService' to be injected in ${target.constructor.name}`,
            );
          }
          const raw = config.get<T>(path);
          if (!raw || typeof raw !== 'object') return defaultValue;

          // Merge with defaults to handle partial configs
          return { ...defaultValue, ...raw };
        },
        enumerable: true,
        configurable: true,
      });
    };
  }
}
