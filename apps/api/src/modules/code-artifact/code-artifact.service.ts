import { Inject, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  DuplicateCodeArtifactRequest,
  ListCodeArtifactsData,
  UpsertCodeArtifactRequest,
  User,
} from '@refly/openapi-schema';
import { streamToString } from '../../utils';
import { CanvasNotFoundError, CodeArtifactNotFoundError, ParamsError } from '@refly/errors';
import { genCodeArtifactID } from '@refly/utils';
import { OSS_INTERNAL, ObjectStorageService } from '../common/object-storage';
import { CodeArtifact as CodeArtifactModel } from '../../generated/client';

@Injectable()
export class CodeArtifactService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OSS_INTERNAL) private oss: ObjectStorageService,
  ) {}

  async createCodeArtifact(user: User, body: UpsertCodeArtifactRequest) {
    const { uid } = user;
    const { title, type, language, content, canvasId } = body;
    const artifactId = genCodeArtifactID();
    const storageKey = `code-artifact/${artifactId}`;

    if (canvasId) {
      const canvas = await this.prisma.canvas.findUnique({
        select: { pk: true },
        where: { canvasId, uid, deletedAt: null },
      });
      if (!canvas) {
        throw new CanvasNotFoundError();
      }
    }

    const codeArtifact = await this.prisma.codeArtifact.create({
      data: {
        artifactId,
        title,
        type,
        language,
        storageKey,
        uid,
        canvasId,
      },
    });

    if (content) {
      await this.oss.putObject(storageKey, content);
    }

    return codeArtifact;
  }

  async updateCodeArtifact(user: User, body: UpsertCodeArtifactRequest) {
    const { uid } = user;
    const {
      artifactId,
      title,
      type,
      language,
      content,
      previewStorageKey,
      createIfNotExists,
      resultId,
      resultVersion,
      canvasId,
    } = body;

    if (!artifactId) {
      throw new ParamsError('ArtifactId is required for updating a code artifact');
    }

    let existingArtifact = await this.prisma.codeArtifact.findUnique({
      where: { artifactId, deletedAt: null },
    });
    if (existingArtifact && existingArtifact.uid !== uid) {
      throw new ForbiddenException();
    }

    if (!existingArtifact) {
      if (!createIfNotExists) {
        throw new CodeArtifactNotFoundError();
      }
      const storageKey = `code-artifact/${artifactId}`;
      existingArtifact = await this.prisma.codeArtifact.create({
        data: {
          artifactId,
          title,
          type,
          language,
          storageKey,
          previewStorageKey,
          resultId,
          resultVersion,
          uid,
          canvasId,
        },
      });
    } else {
      existingArtifact = await this.prisma.codeArtifact.update({
        where: { artifactId },
        data: {
          title,
          type,
          language,
          previewStorageKey,
          resultId,
          resultVersion,
          canvasId,
        },
      });
    }

    if (content) {
      await this.oss.putObject(existingArtifact.storageKey, content);
    }

    return existingArtifact;
  }

  async getCodeArtifactDetail(user: User, artifactId: string) {
    const { uid } = user;
    const artifact = await this.prisma.codeArtifact.findUnique({
      where: { artifactId, uid, deletedAt: null },
    });

    if (!artifact) {
      throw new CodeArtifactNotFoundError();
    }

    const contentStream = await this.oss.getObject(artifact.storageKey);
    const content = await streamToString(contentStream);

    return {
      ...artifact,
      content,
    };
  }

  async listCodeArtifacts(user: User, query: ListCodeArtifactsData['query']) {
    const { uid } = user;
    const { resultId, resultVersion, needContent, canvasId, page = 1, pageSize = 10 } = query;

    let artifacts: (CodeArtifactModel & { content?: string })[] = [];

    artifacts = await this.prisma.codeArtifact.findMany({
      where: { uid, resultId, resultVersion, deletedAt: null, canvasId },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    if (needContent) {
      for (const artifact of artifacts) {
        const contentStream = await this.oss.getObject(artifact.storageKey);
        const content = await streamToString(contentStream);
        artifact.content = content;
      }
    }

    return artifacts;
  }

  async duplicateCodeArtifact(user: User, param: DuplicateCodeArtifactRequest) {
    const { uid } = user;
    const { artifactId, canvasId: targetCanvasId } = param;
    const artifact = await this.prisma.codeArtifact.findUnique({
      where: { artifactId, uid, deletedAt: null },
    });

    const newArtifactId = genCodeArtifactID();
    const newStorageKey = `code-artifact/${newArtifactId}`;

    const newArtifact = await this.prisma.codeArtifact.create({
      data: {
        artifactId: newArtifactId,
        title: artifact.title,
        type: artifact.type,
        language: artifact.language,
        storageKey: newStorageKey,
        uid,
        canvasId: targetCanvasId || artifact.canvasId,
      },
    });

    const contentStream = await this.oss.getObject(artifact.storageKey);
    if (contentStream) {
      await this.oss.putObject(newStorageKey, contentStream);
    }

    return newArtifact;
  }
}
