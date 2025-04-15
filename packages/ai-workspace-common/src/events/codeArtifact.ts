import { CodeArtifactType } from '@refly/openapi-schema';
import mitt from 'mitt';

export type Events = {
  contentUpdate: {
    artifactId: string;
    content: string;
  };
  statusUpdate: {
    artifactId: string;
    status: 'finish' | 'generating';
    type: CodeArtifactType;
  };
};

export const codeArtifactEmitter = mitt<Events>();
