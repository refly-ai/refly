import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { FormDefinition, FormSubmission } from '@refly/openapi-schema';

@Injectable()
export class FormService {
  constructor(private readonly prisma: PrismaService) {}

  async getFormDefinition(uid: string): Promise<FormDefinition> {
    const formDefinition = await this.prisma.formDefinition.findFirst({ where: { uid } });
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
  }
}
