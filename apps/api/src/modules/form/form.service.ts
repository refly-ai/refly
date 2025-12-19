import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { FormDefinition, FormSubmission } from '@refly/openapi-schema';
import { ConfigService } from '@nestjs/config';
import { updateUserProperties } from '@refly/telemetry-node';

@Injectable()
export class FormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private extractRoleFromAnswers(answers: string): string | null {
    if (!answers?.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(answers) as { role?: unknown } | null;
      const role = typeof parsed?.role === 'string' ? parsed.role.trim() : null;
      return role || null;
    } catch {
      return null;
    }
  }

  async getFormDefinition(_uid: string): Promise<FormDefinition | null> {
    const formDefinition = await this.prisma.formDefinition.findFirst();
    if (!formDefinition) {
      return null;
    }
    return {
      formId: formDefinition.formId,
      title: formDefinition.title,
      description: formDefinition.description,
      schema: formDefinition.schema,
      uiSchema: formDefinition.uiSchema,
      status: formDefinition.status as 'draft' | 'published' | 'archived',
      createdAt: formDefinition.createdAt.toJSON(),
      updatedAt: formDefinition.updatedAt.toJSON(),
      deletedAt: formDefinition.deletedAt?.toJSON(),
    };
  }

  async submitForm(uid: string, formSubmission: FormSubmission): Promise<void> {
    await this.prisma.formSubmission.create({
      data: {
        uid,
        formId: formSubmission.formId,
        answers: formSubmission.answers,
        status: formSubmission.status as 'draft' | 'submitted' | 'reviewed',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    // Update user preferences
    const user = await this.prisma.user.findUnique({
      where: { uid },
      select: { email: true, preferences: true, uid: true },
    });

    const currentPreferences = user?.preferences ? JSON.parse(user.preferences) : {};
    const updatedPreferences = {
      ...currentPreferences,
      hasFilledForm: true,
    };

    await this.prisma.user.update({
      where: { uid },
      data: {
        preferences: JSON.stringify(updatedPreferences),
      },
    });

    const role = this.extractRoleFromAnswers(formSubmission.answers);
    if (role) {
      updateUserProperties({ uid, email: user?.email }, { user_identity: role });
    }
  }

  async hasFilledForm(uid: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { uid },
      select: { preferences: true },
    });

    if (!user?.preferences) {
      return false;
    }

    const preferences = JSON.parse(user.preferences);
    return preferences.hasFilledForm ?? true;
  }
}
