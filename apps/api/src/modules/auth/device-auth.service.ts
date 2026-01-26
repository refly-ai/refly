import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthService } from './auth.service';
import { genDeviceSessionId } from '@refly/utils';
import { User } from '@refly/openapi-schema';

export type DeviceSessionStatus = 'pending' | 'authorized' | 'cancelled' | 'expired';

export interface DeviceSessionInfo {
  deviceId: string;
  cliVersion: string;
  host: string;
  status: DeviceSessionStatus;
  createdAt: Date;
  expiresAt: Date;
  userCode?: string;
}

export interface DeviceSessionWithTokens extends DeviceSessionInfo {
  accessToken?: string;
  refreshToken?: string;
}

@Injectable()
export class DeviceAuthService {
  private readonly logger = new Logger(DeviceAuthService.name);

  // Device session TTL: 10 minutes
  private readonly SESSION_TTL_MS = 10 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  /**
   * Initialize a new device session for CLI login
   * Called by CLI to start the device authorization flow
   *
   * @param cliVersion CLI version string
   * @param host Hostname where CLI is running
   * @param clientIp Client IP address (optional)
   * @returns Device session info with deviceId for polling
   */
  async initDeviceSession(
    cliVersion: string,
    host: string,
    clientIp?: string,
  ): Promise<DeviceSessionInfo> {
    const deviceId = genDeviceSessionId();
    const userCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + this.SESSION_TTL_MS);

    const session = await this.prisma.cliDeviceSession.create({
      data: {
        deviceId,
        userCode,
        cliVersion,
        host,
        clientIp,
        status: 'pending',
        expiresAt,
      },
    });

    this.logger.log(
      `[DEVICE_SESSION_INIT] deviceId=${deviceId} userCode=${userCode} cliVersion=${cliVersion} host=${host}`,
    );

    return {
      deviceId: session.deviceId,
      userCode: session.userCode || undefined,
      cliVersion: session.cliVersion,
      host: session.host,
      status: session.status as DeviceSessionStatus,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Get device session info for web page display
   * Called by web frontend to show device info
   *
   * @param deviceId Device session ID
   * @param cliVersion Optional CLI version for verification
   * @param host Optional host for verification
   * @returns Device session info or null if not found/expired
   */
  async getDeviceSession(
    deviceId: string,
    cliVersion?: string,
    host?: string,
  ): Promise<DeviceSessionInfo | null> {
    const session = await this.prisma.cliDeviceSession.findUnique({
      where: { deviceId },
    });

    if (!session) {
      this.logger.log(`[DEVICE_SESSION_GET] deviceId=${deviceId} not found`);
      return null;
    }

    // Check if expired
    if (session.expiresAt < new Date() && session.status === 'pending') {
      // Mark as expired
      await this.prisma.cliDeviceSession.update({
        where: { deviceId },
        data: { status: 'expired' },
      });

      return {
        deviceId: session.deviceId,
        cliVersion: session.cliVersion,
        host: session.host,
        status: 'expired',
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      };
    }

    // Optional verification of cliVersion and host
    if (cliVersion && session.cliVersion !== cliVersion) {
      this.logger.warn(
        `[DEVICE_SESSION_GET] deviceId=${deviceId} cliVersion mismatch: ${session.cliVersion} != ${cliVersion}`,
      );
    }
    if (host && session.host !== host) {
      this.logger.warn(
        `[DEVICE_SESSION_GET] deviceId=${deviceId} host mismatch: ${session.host} != ${host}`,
      );
    }

    return {
      deviceId: session.deviceId,
      cliVersion: session.cliVersion,
      host: session.host,
      status: session.status as DeviceSessionStatus,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Authorize a device session for a user
   * Called by web frontend when user clicks "Authorize"
   *
   * @param deviceId Device session ID
   * @param userCode 6-digit verification code
   * @param user Authenticated user
   * @returns true if authorized, false if session not found, code mismatch, or already processed
   */
  async authorizeDevice(deviceId: string, userCode: string, user: User): Promise<boolean> {
    const session = await this.prisma.cliDeviceSession.findUnique({
      where: { deviceId },
    });

    if (!session) {
      this.logger.log(`[DEVICE_AUTHORIZE] deviceId=${deviceId} not found`);
      return false;
    }

    // Verify user code
    if (session.userCode !== userCode) {
      this.logger.warn(`[DEVICE_AUTHORIZE] deviceId=${deviceId} userCode mismatch`);
      return false;
    }

    // Check if already processed
    if (session.status !== 'pending') {
      this.logger.log(
        `[DEVICE_AUTHORIZE] deviceId=${deviceId} already processed: ${session.status}`,
      );
      return false;
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      this.logger.log(`[DEVICE_AUTHORIZE] deviceId=${deviceId} expired`);
      await this.prisma.cliDeviceSession.update({
        where: { deviceId },
        data: { status: 'expired' },
      });
      return false;
    }

    // Generate tokens for CLI
    const tokens = await this.authService.login(user);

    // Store tokens and mark as authorized
    await this.prisma.cliDeviceSession.update({
      where: { deviceId },
      data: {
        status: 'authorized',
        uid: user.uid,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });

    this.logger.log(`[DEVICE_AUTHORIZE] deviceId=${deviceId} uid=${user.uid} authorized`);

    return true;
  }

  /**
   * Cancel a device session
   * Called by web frontend when user clicks "Cancel"
   *
   * @param deviceId Device session ID
   * @returns true if cancelled, false if session not found or already processed
   */
  async cancelDevice(deviceId: string): Promise<boolean> {
    const session = await this.prisma.cliDeviceSession.findUnique({
      where: { deviceId },
    });

    if (!session) {
      this.logger.log(`[DEVICE_CANCEL] deviceId=${deviceId} not found`);
      return false;
    }

    // Check if already processed
    if (session.status !== 'pending') {
      this.logger.log(`[DEVICE_CANCEL] deviceId=${deviceId} already processed: ${session.status}`);
      return false;
    }

    await this.prisma.cliDeviceSession.update({
      where: { deviceId },
      data: { status: 'cancelled' },
    });

    this.logger.log(`[DEVICE_CANCEL] deviceId=${deviceId} cancelled`);

    return true;
  }

  /**
   * Poll device session status for CLI
   * Called by CLI to check if user has authorized
   *
   * @param deviceId Device session ID
   * @returns Device session info with tokens if authorized
   */
  async pollDeviceStatus(deviceId: string): Promise<DeviceSessionWithTokens | null> {
    const session = await this.prisma.cliDeviceSession.findUnique({
      where: { deviceId },
    });

    if (!session) {
      this.logger.log(`[DEVICE_POLL] deviceId=${deviceId} not found`);
      return null;
    }

    // Check if expired
    if (session.expiresAt < new Date() && session.status === 'pending') {
      await this.prisma.cliDeviceSession.update({
        where: { deviceId },
        data: { status: 'expired' },
      });

      return {
        deviceId: session.deviceId,
        cliVersion: session.cliVersion,
        host: session.host,
        status: 'expired',
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      };
    }

    const result: DeviceSessionWithTokens = {
      deviceId: session.deviceId,
      cliVersion: session.cliVersion,
      host: session.host,
      status: session.status as DeviceSessionStatus,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };

    // Only include tokens if authorized
    if (session.status === 'authorized' && session.accessToken && session.refreshToken) {
      result.accessToken = session.accessToken;
      result.refreshToken = session.refreshToken;

      // Clear tokens from database after successful retrieval (one-time use)
      await this.prisma.cliDeviceSession.update({
        where: { deviceId },
        data: {
          accessToken: null,
          refreshToken: null,
        },
      });

      this.logger.log(`[DEVICE_POLL] deviceId=${deviceId} tokens delivered`);
    }

    return result;
  }

  /**
   * Clean up expired device sessions
   * Should be called periodically (e.g., by a cron job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.cliDeviceSession.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired' },
    });

    if (result.count > 0) {
      this.logger.log(`[DEVICE_CLEANUP] marked ${result.count} sessions as expired`);
    }

    return result.count;
  }
}
