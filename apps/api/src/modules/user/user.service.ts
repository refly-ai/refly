import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import os from 'node:os';
import { PrismaService } from '../common/prisma.service';
import {
  CheckSettingsFieldData,
  FileVisibility,
  UpdateUserSettingsRequest,
  User,
} from '@refly/openapi-schema';
import { Subscription } from '../../generated/client';
import { pick } from '@refly/utils';
import { SubscriptionService } from '../subscription/subscription.service';
import { RedisService } from '../common/redis.service';
import { OperationTooFrequent, ParamsError } from '@refly/errors';
import { MiscService } from '../misc/misc.service';
import { ConfigService } from '@nestjs/config';
import { isMultiTenantEnabled } from '../../utils/runtime';

@Injectable()
export class UserService implements OnModuleInit {
  private logger = new Logger(UserService.name);
  private localUid: string | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
    private miscService: MiscService,
    private subscriptionService: SubscriptionService,
  ) {}

  async onModuleInit() {
    if (!isMultiTenantEnabled()) {
      const lastUser = await this.prisma.user.findFirst({
        orderBy: { pk: 'desc' },
      });

      // If there is already a user, use the last user's uid
      if (lastUser) {
        this.localUid = lastUser.uid;
      } else {
        this.localUid = this.config.get('local.uid');
        const username = os.userInfo().username;
        await this.prisma.user.upsert({
          where: { name: username },
          create: {
            uid: this.localUid,
            name: username,
            nickname: username,
          },
          update: {
            uid: this.localUid,
          },
        });
      }
    }
  }

  async getUserSettings(user: User, needSubscriptionInfo = false) {
    if (this.localUid) {
      user.uid = this.localUid;
    }

    const userPo = await this.prisma.user.findUnique({
      where: { uid: user.uid },
    });

    let subscription: Subscription | null = null;
    if (needSubscriptionInfo && userPo.subscriptionId) {
      subscription = await this.subscriptionService.getSubscription(userPo.subscriptionId);
    }

    return {
      ...userPo,
      subscription,
    };
  }

  async updateSettings(user: User, data: UpdateUserSettingsRequest) {
    if (this.localUid) {
      user.uid = this.localUid;
    }

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
        ? JSON.parse(currentUser.preferences)
        : {};
      const existingOnboarding = currentUser?.onboarding ? JSON.parse(currentUser.onboarding) : {};

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
