import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { genApiKeyId } from '@refly/utils';
import * as crypto from 'node:crypto';

export interface ApiKeyInfo {
  keyId: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}

export interface CreateApiKeyResult {
  keyId: string;
  apiKey: string; // Full key, only shown once
  name: string;
  keyPrefix: string;
  createdAt: Date;
  expiresAt: Date | null;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate a new API key for a user
   * @param uid User ID
   * @param name Key name/description
   * @param expiresInDays Optional expiration in days (null = never expires)
   */
  async createApiKey(
    uid: string,
    name: string,
    expiresInDays?: number,
  ): Promise<CreateApiKeyResult> {
    // Generate unique key ID and the actual API key
    const keyId = genApiKeyId();
    const apiKey = this.generateApiKey();
    const keyHash = this.hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 12); // "rf_" + first 9 chars

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const created = await this.prisma.userApiKey.create({
      data: {
        keyId,
        keyHash,
        keyPrefix,
        uid,
        name,
        expiresAt,
      },
    });

    this.logger.log(`[API_KEY_CREATED] uid=${uid} keyId=${keyId} name=${name}`);

    return {
      keyId,
      apiKey, // Return full key only on creation
      name,
      keyPrefix,
      createdAt: created.createdAt,
      expiresAt,
    };
  }

  /**
   * Validate an API key and return the user UID if valid
   * @param apiKey The full API key to validate
   * @returns User UID if valid, null otherwise
   */
  async validateApiKey(apiKey: string): Promise<string | null> {
    const keyRecord = await this.findValidApiKeyRecord(apiKey);
    if (!keyRecord) {
      return null;
    }

    this.updateLastUsedAt(keyRecord.pk);
    return keyRecord.uid;
  }

  /**
   * Validate an API key and return both uid and keyId if valid
   */
  async validateApiKeyWithKeyId(apiKey: string): Promise<{ uid: string; keyId: string } | null> {
    const keyRecord = await this.findValidApiKeyRecord(apiKey);
    if (!keyRecord) {
      return null;
    }

    this.updateLastUsedAt(keyRecord.pk);
    return { uid: keyRecord.uid, keyId: keyRecord.keyId };
  }

  /**
   * List all API keys for a user (without the actual key value)
   * @param uid User ID
   */
  async listApiKeys(uid: string): Promise<ApiKeyInfo[]> {
    const keys = await this.prisma.userApiKey.findMany({
      where: {
        uid,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((key) => ({
      keyId: key.keyId,
      name: key.name,
      keyPrefix: key.keyPrefix,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
    }));
  }

  /**
   * Revoke an API key
   * @param uid User ID (for ownership verification)
   * @param keyId Key ID to revoke
   * @returns true if revoked, false if not found or not owned
   */
  async revokeApiKey(uid: string, keyId: string): Promise<boolean> {
    const result = await this.prisma.userApiKey.updateMany({
      where: {
        keyId,
        uid,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (result.count > 0) {
      this.logger.log(`[API_KEY_REVOKED] uid=${uid} keyId=${keyId}`);
      return true;
    }

    return false;
  }

  /**
   * Revoke all API keys for a user
   * @param uid User ID
   */
  async revokeAllApiKeys(uid: string): Promise<number> {
    const result = await this.prisma.userApiKey.updateMany({
      where: {
        uid,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    this.logger.log(`[API_KEYS_REVOKED_ALL] uid=${uid} count=${result.count}`);
    return result.count;
  }

  /**
   * Update API key name
   * @param uid User ID (for ownership verification)
   * @param keyId Key ID to update
   * @param name New name
   * @returns true if updated, false if not found or not owned
   */
  async updateApiKey(uid: string, keyId: string, name: string): Promise<boolean> {
    const result = await this.prisma.userApiKey.updateMany({
      where: {
        keyId,
        uid,
        revokedAt: null,
      },
      data: {
        name,
      },
    });

    if (result.count > 0) {
      this.logger.log(`[API_KEY_UPDATED] uid=${uid} keyId=${keyId} name=${name}`);
      return true;
    }

    return false;
  }

  /**
   * Generate a secure API key
   * Format: rf_<32 random chars in base62>
   */
  private generateApiKey(): string {
    const randomBytes = crypto.randomBytes(24);
    const base62 = this.toBase62(randomBytes);
    return `rf_${base62}`;
  }

  /**
   * Hash an API key for storage
   * Uses SHA-256 for fast lookup while maintaining security
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  private async findValidApiKeyRecord(apiKey: string): Promise<{
    pk: bigint;
    uid: string;
    keyId: string;
  } | null> {
    if (!apiKey || !apiKey.startsWith('rf_')) {
      return null;
    }

    const keyHash = this.hashApiKey(apiKey);
    return this.prisma.userApiKey.findFirst({
      where: {
        keyHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        pk: true,
        uid: true,
        keyId: true,
      },
    });
  }

  private updateLastUsedAt(pk: bigint): void {
    this.prisma.userApiKey
      .update({
        where: { pk },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => {
        this.logger.warn(`Failed to update lastUsedAt: ${err.message}`);
      });
  }

  /**
   * Convert bytes to base62 string
   */
  private toBase62(buffer: Buffer): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    let value = BigInt(`0x${buffer.toString('hex')}`);

    while (value > 0n) {
      result = chars[Number(value % 62n)] + result;
      value = value / 62n;
    }

    return result.padStart(32, '0');
  }
}
