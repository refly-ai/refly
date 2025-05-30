import { CodeArtifact, CodeArtifactType } from '@refly/openapi-schema';
import { CodeArtifact as CodeArtifactModel } from '../../generated/client';
import { pick } from '../../utils';

export const codeArtifactPO2DTO = (
  codeArtifact: CodeArtifactModel & { content?: string },
): CodeArtifact => {
  return {
    ...pick(codeArtifact, ['artifactId', 'title', 'type', 'language', 'content']),
    type: codeArtifact.type as CodeArtifactType,
    createdAt: codeArtifact.createdAt.toJSON(),
    updatedAt: codeArtifact.updatedAt.toJSON(),
  };
};
