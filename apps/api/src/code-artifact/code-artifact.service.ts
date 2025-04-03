import { Inject, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { UpsertCodeArtifactRequest, User } from '@refly-packages/openapi-schema';
import { MinioService } from '@/common/minio.service';
import { MINIO_INTERNAL } from '@/common/minio.service';
import { streamToString } from '@/utils';
import { CodeArtifactNotFoundError, ParamsError } from '@refly-packages/errors';
import { genCodeArtifactID } from '@refly-packages/utils';

@Injectable()
export class CodeArtifactService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MINIO_INTERNAL) private minio: MinioService,
  ) {}

  async createCodeArtifact(user: User, body: UpsertCodeArtifactRequest) {
    const { uid } = user;
    const { title, type, language, content } = body;
    const artifactId = genCodeArtifactID();
    const storageKey = `code-artifact/${artifactId}`;

    const codeArtifact = await this.prisma.codeArtifact.create({
      data: {
        artifactId,
        title,
        type,
        language,
        storageKey,
        uid,
      },
    });

    if (content) {
      await this.minio.client.putObject(storageKey, content);
    }

    return codeArtifact;
  }

  async updateCodeArtifact(user: User, body: UpsertCodeArtifactRequest) {
    const { uid } = user;
    const { artifactId, title, type, language, content, previewStorageKey, createIfNotExists } =
      body;

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
          uid,
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
        },
      });
    }

    if (content) {
      await this.minio.client.putObject(existingArtifact.storageKey, content);
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

    const contentStream = await this.minio.client.getObject(artifact.storageKey);
    const content = await streamToString(contentStream);

    return {
      ...artifact,
      content,
    };
  }

  async duplicateCodeArtifact(user: User, artifactId: string) {
    const { uid } = user;
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
      },
    });

    const contentStream = await this.minio.client.getObject(artifact.storageKey);
    await this.minio.client.putObject(newStorageKey, contentStream);

    return newArtifact;
  }
}
