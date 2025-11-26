import { ConfigService } from '@nestjs/config';
import { merge } from 'lodash';

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
   * Reads nested config object from ConfigService and merges with defaults
   *
   * Supports two modes:
   * 1. Pass an object → Automatically deep merges using lodash merge
   * 2. Pass a function → Custom merge logic
   *
   * @example
   * ```typescript
   * // Mode 1: Object (auto deep merge)
   * @Config.object('app.settings', DEFAULT_SETTINGS)
   * private settings: Settings;
   *
   * // Mode 2: Function (custom merge)
   * @Config.object('app.settings', (raw) => customMerge(DEFAULT_SETTINGS, raw))
   * private settings: Settings;
   * ```
   */
  export function object<T extends Record<string, any>>(
    path: string,
    defaultValueOrFactory: T | ((raw: T | undefined) => T),
  ) {
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

          // Check if it's a function (custom factory) or object (auto merge)
          if (typeof defaultValueOrFactory === 'function') {
            // Mode 2: Custom factory
            return defaultValueOrFactory(raw);
          } else {
            // Mode 1: Auto deep merge with lodash
            return merge({}, defaultValueOrFactory, raw);
          }
        },
        enumerable: true,
        configurable: true,
      });
    };
  }
}
