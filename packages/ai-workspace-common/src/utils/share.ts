export const getShareLink = (entityType: string, shareId: string) => {
  let entity = '';
  if (entityType === 'canvas') {
    entity = 'canvas';
  } else if (entityType === 'codeArtifact') {
    entity = 'code';
  } else if (entityType === 'skillResponse') {
    entity = 'answer';
  } else if (entityType === 'document') {
    entity = 'doc';
  } else if (entityType === 'driveFile') {
    entity = 'file';
  } else if (entityType === 'workflowApp') {
    entity = 'app';
    // WorkflowApp uses direct /app route, not /share/app
    return `${window.location.origin}/${entity}/${shareId}`;
  }
  return `${window.location.origin}/share/${entity}/${shareId}`;
};
