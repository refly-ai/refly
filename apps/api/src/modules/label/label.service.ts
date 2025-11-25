import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateLabelClassRequest,
  CreateLabelInstanceRequest,
  DeleteLabelClassRequest,
  DeleteLabelInstanceRequest,
  ListLabelClassesData,
  ListLabelInstancesData,
  UpdateLabelClassRequest,
  UpdateLabelInstanceRequest,
  User,
} from '@refly/openapi-schema';
import { genLabelClassID, genLabelInstanceID } from '@refly/utils';
import { pick } from '../../utils';
import { LabelClassNotFoundError, LabelInstanceNotFoundError, ParamsError } from '@refly/errors';

@Injectable()
export class LabelService {
  private logger = new Logger(LabelService.name);

  constructor(private prisma: PrismaService) {}

  async listLabelClasses(user: User, param: ListLabelClassesData['query']) {
    const { uid } = user;
    const { page = 1, pageSize = 10 } = param;
    return this.prisma.labelClass.findMany({
      where: {
        uid,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async createLabelClass(user: User, param: CreateLabelClassRequest) {
    const { uid } = user;
    return this.prisma.labelClass.upsert({
      where: { uid_name: { uid, name: param.name } },
      create: {
        labelClassId: genLabelClassID(),
        uid: user.uid,
        icon: JSON.stringify(param.icon),
        ...pick(param, ['name', 'displayName', 'prompt']),
      },
      update: {
        icon: JSON.stringify(param.icon),
        ...pick(param, ['displayName', 'prompt']),
      },
    });
  }

  async updateLabelClass(user: User, param: UpdateLabelClassRequest) {
    const { uid } = user;
    const { labelClassId } = param;
    const lc = await this.prisma.labelClass.findFirst({
      where: { labelClassId, uid, deletedAt: null },
    });
    if (!lc) {
      throw new LabelClassNotFoundError(`label class not found: ${labelClassId}`);
    }
    return this.prisma.labelClass.update({
      where: { labelClassId: param.labelClassId, uid: user.uid },
      data: {
        icon: JSON.stringify(param.icon),
        ...pick(param, ['displayName', 'prompt']),
      },
    });
  }

  async deleteLabelClass(user: User, param: DeleteLabelClassRequest) {
    const { uid } = user;
    const { labelClassId } = param;
    const lc = await this.prisma.labelClass.findFirst({
      where: { labelClassId, uid, deletedAt: null },
    });
    if (!lc) {
      throw new LabelClassNotFoundError(`label class not found: ${labelClassId}`);
    }
    await this.prisma.labelClass.update({
      where: { labelClassId: param.labelClassId, uid: user.uid },
      data: { deletedAt: new Date() },
    });
  }

  async listLabelInstances(user: User, param: ListLabelInstancesData['query']) {
    const { uid } = user;
    const { classId, entityId, entityType, page, pageSize, value } = param;
    const where: Prisma.LabelInstanceWhereInput = {
      uid,
      deletedAt: null,
    };
    if (classId) {
      where.labelClassId = classId;
    }
    if (entityId) {
      where.entityId = entityId;
    }
    if (entityType) {
      where.entityType = entityType;
    }
    if (value) {
      where.value = value;
    }
    return this.prisma.labelInstance.findMany({
      where,
      include: { labelClass: true },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
  }

  async createLabelInstance(user: User, param: CreateLabelInstanceRequest) {
    if (param.valueList?.length === 0) {
      throw new ParamsError('valueList is required');
    }

    return this.prisma.labelInstance.createManyAndReturn({
      data: param.valueList.map((value) => ({
        labelId: genLabelInstanceID(),
        ...pick(param, ['labelClassId', 'entityId', 'entityType']),
        uid: user.uid,
        value,
      })),
      include: { labelClass: true },
    });
  }

  async updateLabelInstance(user: User, param: UpdateLabelInstanceRequest) {
    const { uid } = user;
    const { labelId, value } = param;
    const label = await this.prisma.labelInstance.findUnique({
      where: { labelId, uid, deletedAt: null },
    });
    if (!label) {
      throw new LabelInstanceNotFoundError('label not found');
    }
    return this.prisma.labelInstance.update({
      where: { labelId: label.labelId, uid: user.uid },
      data: { value },
      include: { labelClass: true },
    });
  }

  async deleteLabelInstance(user: User, param: DeleteLabelInstanceRequest) {
    const { uid } = user;
    const { labelId } = param;
    if (!labelId) {
      throw new ParamsError('label id are required');
    }
    const label = await this.prisma.labelInstance.findUnique({
      where: { labelId, uid, deletedAt: null },
    });
    if (!label) {
      throw new LabelInstanceNotFoundError('label not found');
    }
    await this.prisma.labelInstance.update({
      where: { labelId, uid },
      data: { deletedAt: new Date() },
    });
  }
}
