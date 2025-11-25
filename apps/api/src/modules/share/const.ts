import { EntityType } from '@refly/openapi-schema';

export const SHARE_CODE_PREFIX: Record<EntityType, string> = {
  document: 'doc-',
  canvas: 'can-',
  resource: 'res-',
  skillResponse: 'skr-',
  codeArtifact: 'cod-',
  page: 'pag-',
  share: 'sha-',
  user: 'usr-',
  project: 'prj-',
  mediaResult: 'med-',
  workflowApp: 'wfa-',
  driveFile: 'drv-',
};
