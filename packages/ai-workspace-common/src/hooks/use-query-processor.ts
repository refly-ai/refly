import { processQueryWithMentions } from '@refly/utils/query-processor';
import { useToolsetDefinition } from './use-toolset-definition';
import { DriveFile, WorkflowVariable } from '@refly/openapi-schema';

export const useQueryProcessor = () => {
  const { lookupToolsetDefinitionById } = useToolsetDefinition();
  return {
    processQuery: (
      query: string,
      options?: {
        replaceVars?: boolean;
        variables?: WorkflowVariable[];
        files?: DriveFile[];
      },
    ) => {
      return processQueryWithMentions(query, {
        ...options,
        lookupToolsetDefinitionById,
      });
    },
  };
};
