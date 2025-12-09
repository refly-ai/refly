import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import os from 'node:os';
import { PrismaService } from '../common/prisma.service';
import {
  CheckSettingsFieldData,
  FileVisibility,
  UpdateUserSettingsRequest,
  User,
} from '@refly/openapi-schema';
import { Subscription } from '@prisma/client';
import { pick, safeParseJSON, runModuleInitWithTimeoutAndRetry } from '@refly/utils';
import { SubscriptionService } from '../subscription/subscription.service';
import { RedisService } from '../common/redis.service';
import { OperationTooFrequent, ParamsError } from '@refly/errors';
import { MiscService } from '../misc/misc.service';
import { ConfigService } from '@nestjs/config';
import { isDesktop } from '../../utils/runtime';
import { ProviderService } from '../provider/provider.service';

@Injectable()
export class UserService implements OnModuleInit {
  private logger = new Logger(UserService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
    private miscService: MiscService,
    private subscriptionService: SubscriptionService,
    private providerService: ProviderService,
  ) {}

  async onModuleInit(): Promise<void> {
    await runModuleInitWithTimeoutAndRetry(
      async () => {
        if (!isDesktop()) {
          return;
        }

        const localUid = this.config.get('local.uid');
        const localUser = await this.prisma.user.findUnique({
          where: { uid: localUid },
        });
        if (!localUser) {
          const username = os.userInfo().username;
          await this.prisma.user.upsert({
            where: { name: username },
            create: {
              uid: localUid,
              name: username,
              nickname: username,
            },
            update: {
              uid: localUid,
            },
          });
        }
      },
      {
        logger: this.logger,
        label: 'UserService.onModuleInit',
      },
    );
  }

  async getUserSettings(user: User) {
    const userPo = await this.prisma.user.findUnique({
      where: { uid: user.uid },
    });

    let subscription: Subscription | null = null;
    if (userPo?.subscriptionId) {
      subscription = await this.subscriptionService.getSubscription(userPo.subscriptionId);
    }

    const userPreferences = await this.providerService.getUserPreferences(
      user,
      userPo?.preferences,
    );
    userPo.preferences = JSON.stringify(userPreferences);

    return {
      ...userPo,
      subscription,
    };
  }

  async updateSettings(user: User, data: UpdateUserSettingsRequest) {
    const releaseLock = await this.redis.acquireLock(`update-user-settings:${user.uid}`);
    if (!releaseLock) {
      throw new OperationTooFrequent('Update user settings too frequent');
    }

    try {
      // Get current user data
      const currentUser = await this.prisma.user.findUnique({
        where: { uid: user.uid },
        select: {
          preferences: true,
          onboarding: true,
        },
      });

      // Process avatar upload
      if (data.avatarStorageKey) {
        const avatarFile = await this.miscService.findFileAndBindEntity(data.avatarStorageKey, {
          entityId: user.uid,
          entityType: 'user',
        });
        if (!avatarFile) {
          throw new ParamsError('Avatar file not found');
        }
        data.avatar = this.miscService.generateFileURL({
          storageKey: avatarFile.storageKey,
          visibility: avatarFile.visibility as FileVisibility,
        });
      }

      // Parse existing data with fallbacks
      const existingPreferences = currentUser?.preferences
        ? safeParseJSON(currentUser.preferences)
        : {};
      const existingOnboarding = currentUser?.onboarding
        ? safeParseJSON(currentUser.onboarding)
        : {};

      // Merge data
      const mergedPreferences = {
        ...existingPreferences,
        ...data.preferences,
      };

      const mergedOnboarding = {
        ...existingOnboarding,
        ...data.onboarding,
      };

      const updatedUser = await this.prisma.user.update({
        where: { uid: user.uid },
        data: {
          ...pick(data, ['name', 'nickname', 'avatar', 'uiLocale', 'outputLocale']),
          preferences: JSON.stringify(mergedPreferences),
          onboarding: JSON.stringify(mergedOnboarding),
        },
      });

      return updatedUser;
    } finally {
      await releaseLock();
    }
  }

  async checkSettingsField(user: User, param: CheckSettingsFieldData['query']) {
    const { field, value } = param;
    const otherUser = await this.prisma.user.findFirst({
      where: { [field]: value, uid: { not: user.uid } },
    });
    return {
      field,
      value,
      available: !otherUser,
    };
  }
}
