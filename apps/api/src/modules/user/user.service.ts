import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import os from 'node:os';
import { PrismaService } from '../common/prisma.service';
import {
  CheckSettingsFieldData,
  FileVisibility,
  UpdateUserSettingsRequest,
  User,
} from '@refly/openapi-schema';
import { User as UserPo } from '@prisma/client';
import { pick, safeParseJSON, runModuleInitWithTimeoutAndRetry } from '@refly/utils';
import { SubscriptionService } from '../subscription/subscription.service';
import { RedisService } from '../common/redis.service';
import { AccountNotFoundError, OperationTooFrequent, ParamsError } from '@refly/errors';
import { MiscService } from '../misc/misc.service';
import { ConfigService } from '@nestjs/config';
import { isDesktop } from '../../utils/runtime';
import { ProviderService } from '../provider/provider.service';
import { InvitationService } from '../invitation/invitation.service';
import { FormService } from '../form/form.service';
import { updateUserProperties, StatsigUserCustomValue } from '@refly/telemetry-node';

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
    private invitationService: InvitationService,
    private formService: FormService,
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

  private getUserAttributes(userPo: UserPo, workflowExecutionCnt: number): Record<string, unknown> {
    const isNewUserToday = userPo.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000);
    const isNewUserThisWeek = userPo.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const isNewUserThisMonth = userPo.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return {
      is_new_user_today: isNewUserToday,
      is_new_user_this_week: isNewUserThisWeek,
      is_new_user_this_month: isNewUserThisMonth,
      has_run_workflow: workflowExecutionCnt > 0,
    };
  }

  async getUserSettings(user: User) {
    const [userPo, workflowExecutionCnt, formSubmission] = await Promise.all([
      this.prisma.user.findUnique({
        where: { uid: user.uid },
      }),
      this.prisma.workflowExecution.count({
        where: {
          uid: user.uid,
        },
      }),
      this.prisma.formSubmission.findFirst({
        where: { uid: user.uid },
        select: { answers: true },
      }),
    ]);

    if (!userPo) {
      throw new AccountNotFoundError();
    }

    const [subscription, userPreferences, hasBeenInvited, formResult] = await Promise.all([
      userPo.subscriptionId
        ? this.subscriptionService.getSubscription(userPo.subscriptionId)
        : Promise.resolve(null),
      this.providerService.getUserPreferences(user, userPo.preferences),
      this.invitationService.hasBeenInvited(user.uid, userPo),
      this.formService.hasFilledForm(user.uid, userPo.preferences, formSubmission?.answers),
    ]);

    const userAttributes = this.getUserAttributes(userPo, workflowExecutionCnt);
    userPreferences.hasBeenInvited = hasBeenInvited;
    userPreferences.hasFilledForm = formResult.hasFilledForm;
    userAttributes.user_identity = formResult.identity;

    updateUserProperties(user, userAttributes as Record<string, StatsigUserCustomValue>);

    return {
      ...userPo,
      preferences: JSON.stringify(userPreferences),
      attributes: userAttributes,
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
