import { ConfigService } from '@nestjs/config';
import {
  PtcMode,
  PtcDebugMode,
  getPtcConfig,
  isPtcEnabledForUser,
  isPtcEnabledForToolsets,
  isToolsetAllowed,
  PtcConfig,
} from './ptc-config';
import type { User } from '@refly/openapi-schema';

describe('PtcConfig', () => {
  let mockConfigService: Partial<ConfigService>;
  const mockUser: User = { uid: 'u-123', email: 'test@example.com' } as User;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        const configs: Record<string, string> = {
          'ptc.mode': 'off',
          'ptc.debug': '',
          'ptc.userAllowlist': '',
          'ptc.toolsetAllowlist': '',
          'ptc.toolsetBlocklist': '',
        };
        return configs[key];
      }),
    };
  });

  describe('getPtcConfig', () => {
    it('should parse default config correctly', () => {
      const config = getPtcConfig(mockConfigService as ConfigService);
      expect(config.mode).toBe(PtcMode.OFF);
      expect(config.debugMode).toBeNull();
      expect(config.userAllowlist.size).toBe(0);
      expect(config.toolsetAllowlist).toBeNull();
      expect(config.toolsetBlocklist.size).toBe(0);
    });

    it('should parse partial mode and allowlists correctly', () => {
      mockConfigService.get = jest.fn((key: string) => {
        const configs: Record<string, string> = {
          'ptc.mode': 'partial',
          'ptc.debug': '',
          'ptc.userAllowlist': 'u-1, u-2 ',
          'ptc.toolsetAllowlist': 'google, notion',
          'ptc.toolsetBlocklist': 'bad-tool',
        };
        return configs[key];
      });

      const config = getPtcConfig(mockConfigService as ConfigService);
      expect(config.mode).toBe(PtcMode.PARTIAL);
      expect(config.userAllowlist.has('u-1')).toBe(true);
      expect(config.userAllowlist.has('u-2')).toBe(true);
      expect(config.toolsetAllowlist?.has('google')).toBe(true);
      expect(config.toolsetBlocklist.has('bad-tool')).toBe(true);
    });

    it('should handle invalid mode by defaulting to OFF', () => {
      mockConfigService.get = jest.fn(() => 'invalid');
      const config = getPtcConfig(mockConfigService as ConfigService);
      expect(config.mode).toBe(PtcMode.OFF);
    });

    it('should parse debugMode as OPT_IN when set to "true" (legacy)', () => {
      mockConfigService.get = jest.fn((key: string) => {
        const configs: Record<string, string> = {
          'ptc.mode': 'on',
          'ptc.debug': 'true',
          'ptc.userAllowlist': '',
          'ptc.toolsetAllowlist': '',
          'ptc.toolsetBlocklist': '',
        };
        return configs[key];
      });

      const config = getPtcConfig(mockConfigService as ConfigService);
      expect(config.debugMode).toBe(PtcDebugMode.OPT_IN);
    });

    it('should parse debugMode as OPT_IN when set to "opt-in"', () => {
      mockConfigService.get = jest.fn((key: string) => {
        const configs: Record<string, string> = {
          'ptc.mode': 'on',
          'ptc.debug': 'opt-in',
          'ptc.userAllowlist': '',
          'ptc.toolsetAllowlist': '',
          'ptc.toolsetBlocklist': '',
        };
        return configs[key];
      });

      const config = getPtcConfig(mockConfigService as ConfigService);
      expect(config.debugMode).toBe(PtcDebugMode.OPT_IN);
    });

    it('should parse debugMode as OPT_OUT when set to "opt-out"', () => {
      mockConfigService.get = jest.fn((key: string) => {
        const configs: Record<string, string> = {
          'ptc.mode': 'on',
          'ptc.debug': 'opt-out',
          'ptc.userAllowlist': '',
          'ptc.toolsetAllowlist': '',
          'ptc.toolsetBlocklist': '',
        };
        return configs[key];
      });

      const config = getPtcConfig(mockConfigService as ConfigService);
      expect(config.debugMode).toBe(PtcDebugMode.OPT_OUT);
    });

    it('should return null debugMode for invalid value', () => {
      mockConfigService.get = jest.fn((key: string) => {
        const configs: Record<string, string> = {
          'ptc.mode': 'on',
          'ptc.debug': 'invalid-value',
          'ptc.userAllowlist': '',
          'ptc.toolsetAllowlist': '',
          'ptc.toolsetBlocklist': '',
        };
        return configs[key];
      });

      const config = getPtcConfig(mockConfigService as ConfigService);
      expect(config.debugMode).toBeNull();
    });
  });

  describe('isPtcEnabledForUser', () => {
    it('should return false when mode is OFF', () => {
      const config: PtcConfig = {
        mode: PtcMode.OFF,
        debugMode: null,
        userAllowlist: new Set<string>(),
        toolsetAllowlist: null,
        toolsetBlocklist: new Set<string>(),
        sequential: false,
      };
      expect(isPtcEnabledForUser(mockUser, config)).toBe(false);
    });

    it('should return true when mode is ON', () => {
      const config: PtcConfig = {
        mode: PtcMode.ON,
        debugMode: null,
        userAllowlist: new Set<string>(),
        toolsetAllowlist: null,
        toolsetBlocklist: new Set<string>(),
        sequential: false,
      };
      expect(isPtcEnabledForUser(mockUser, config)).toBe(true);
    });

    it('should check allowlist when mode is PARTIAL', () => {
      const config: PtcConfig = {
        mode: PtcMode.PARTIAL,
        debugMode: null,
        userAllowlist: new Set<string>(['u-123']),
        toolsetAllowlist: null,
        toolsetBlocklist: new Set<string>(),
        sequential: false,
      };
      expect(isPtcEnabledForUser(mockUser, config)).toBe(true);
      expect(isPtcEnabledForUser({ uid: 'u-other' } as User, config)).toBe(false);
    });
  });

  describe('isToolsetAllowed', () => {
    const baseConfig: PtcConfig = {
      mode: PtcMode.ON,
      debugMode: null,
      userAllowlist: new Set<string>(),
      toolsetAllowlist: null,
      toolsetBlocklist: new Set<string>(),
      sequential: false,
    };

    it('should return false if toolset is in blocklist', () => {
      const config: PtcConfig = { ...baseConfig, toolsetBlocklist: new Set<string>(['blocked']) };
      expect(isToolsetAllowed('blocked', config)).toBe(false);
    });

    it('should return true if no allowlist is configured', () => {
      expect(isToolsetAllowed('any', baseConfig)).toBe(true);
    });

    it('should return true if toolset is in allowlist', () => {
      const config: PtcConfig = { ...baseConfig, toolsetAllowlist: new Set<string>(['allowed']) };
      expect(isToolsetAllowed('allowed', config)).toBe(true);
    });

    it('should return false if allowlist is configured but toolset is not in it', () => {
      const config: PtcConfig = { ...baseConfig, toolsetAllowlist: new Set<string>(['allowed']) };
      expect(isToolsetAllowed('other', config)).toBe(false);
    });

    it('should prioritize blocklist over allowlist', () => {
      const config: PtcConfig = {
        ...baseConfig,
        toolsetAllowlist: new Set<string>(['tool']),
        toolsetBlocklist: new Set<string>(['tool']),
      };
      expect(isToolsetAllowed('tool', config)).toBe(false);
    });
  });

  describe('isPtcEnabledForToolsets', () => {
    const config: PtcConfig = {
      mode: PtcMode.ON,
      debugMode: null,
      userAllowlist: new Set<string>(),
      toolsetAllowlist: new Set<string>(['t1', 't2']),
      toolsetBlocklist: new Set<string>(['blocked']),
      sequential: false,
    };

    it('should return true if user is enabled and all toolsets are allowed', () => {
      expect(isPtcEnabledForToolsets(mockUser, ['t1', 't2'], config)).toBe(true);
    });

    it('should return false if user is not enabled', () => {
      const disabledConfig: PtcConfig = { ...config, mode: PtcMode.OFF };
      expect(isPtcEnabledForToolsets(mockUser, ['t1'], disabledConfig)).toBe(false);
    });

    it('should return false if any toolset is not allowed', () => {
      expect(isPtcEnabledForToolsets(mockUser, ['t1', 'blocked'], config)).toBe(false);
      expect(isPtcEnabledForToolsets(mockUser, ['t1', 'unknown'], config)).toBe(false);
    });
  });
});
