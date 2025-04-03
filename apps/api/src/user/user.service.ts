import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import {
  CheckSettingsFieldData,
  FileVisibility,
  UpdateUserSettingsRequest,
  User,
} from '@refly-packages/openapi-schema';
import { Subscription } from '@prisma/client';
import { pick } from '@refly-packages/utils';
import { SubscriptionService } from '@/subscription/subscription.service';
import { RedisService } from '@/common/redis.service';
import { OperationTooFrequent, ParamsError } from '@refly-packages/errors';
import { MiscService } from '@/misc/misc.service';

@Injectable()
export class UserService {
  private logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private miscService: MiscService,
    private subscriptionService: SubscriptionService,
  ) {}

  async getUserSettings(user: User) {
    const userPo = await this.prisma.user.findUnique({
      where: { uid: user.uid },
    });

    let subscription: Subscription | null = null;
    if (userPo.subscriptionId) {
      subscription = await this.subscriptionService.getSubscription(userPo.subscriptionId);
    }

    return {
      ...userPo,
      subscription,
    };
  }

  async updateSettings(user: User, data: UpdateUserSettingsRequest) {
    const lock = await this.redis.acquireLock(`update-user-settings:${user.uid}`);
    if (!lock) {
      throw new OperationTooFrequent('Update user settings too frequent');
    }

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
    const existingPreferences = currentUser?.preferences ? JSON.parse(currentUser.preferences) : {};
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
