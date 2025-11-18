import { describe, it, expect } from 'vitest';
import type { WorkflowVariable } from '@refly/openapi-schema';
import {
  processQueryWithMentions,
  replaceResourceMentionsInQuery,
  parseMentionsFromQuery,
} from './query-processor';

describe('processQueryWithMentions', () => {
  // Test data
  const mockWorkflowVariable: WorkflowVariable = {
    variableId: 'var-1',
    name: 'testVar',
    variableType: 'string',
    value: [{ type: 'text', text: 'hello world' }],
  };

  const mockResourceVariable: WorkflowVariable = {
    variableId: 'resource-1',
    name: 'resourceVar',
    variableType: 'resource',
    value: [
      {
        type: 'resource',
        resource: {
          name: 'resourceVar',
          fileType: 'document',
          storageKey: 'key123',
          entityId: 'resource-1',
        },
      },
    ],
  };

  const mockResourceVariableWithEntityId: WorkflowVariable = {
    variableId: 'resource-2',
    name: 'resourceVar-2',
    variableType: 'resource',
    value: [
      {
        type: 'resource',
        resource: {
          name: 'newResourceName',
          fileType: 'document',
          storageKey: 'key123',
          entityId: 'entity-123',
        },
      },
    ],
  };

  describe('basic functionality', () => {
    it('should return original query when no options provided', () => {
      const result = processQueryWithMentions('hello world');
      expect(result).toEqual({
        processedQuery: 'hello world',
        updatedQuery: 'hello world',
        resourceVars: [],
      });
    });

    it('should replace structured mentions with @name when replaceVars is false', () => {
      const result = processQueryWithMentions('@{type=var,id=var-1,name=testVar} hello', {
        replaceVars: false,
        variables: [mockWorkflowVariable],
      });
      expect(result).toEqual({
        processedQuery: '@testVar hello',
        updatedQuery: '@{type=var,id=var-1,name=testVar} hello',
        resourceVars: [],
      });
    });

    it('should return empty query for empty input', () => {
      const result = processQueryWithMentions('');
      expect(result).toEqual({ processedQuery: '', updatedQuery: '', resourceVars: [] });
    });
  });

  describe('structured mention format @{type=...,id=...,name=...}', () => {
    it('should replace variable mention with actual value when replaceVars is true', () => {
      const query = '@{type=var,id=var-1,name=testVar}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockWorkflowVariable],
      });
      expect(result.processedQuery).toBe('hello world');
      expect(result.updatedQuery).toBe('@{type=var,id=var-1,name=testVar}');
      expect(result.resourceVars).toEqual([]);
    });

    it('should replace var mention with @name when replaceVars is false', () => {
      const query = '@{type=var,id=var-1,name=testVar}';
      const result = processQueryWithMentions(query, {
        replaceVars: false,
        variables: [mockWorkflowVariable],
      });
      expect(result.processedQuery).toBe('@testVar');
      expect(result.updatedQuery).toBe('@{type=var,id=var-1,name=testVar}');
      expect(result.resourceVars).toEqual([]);
    });

    it('should replace with @name when variable not found', () => {
      const query = '@{type=var,id=non-existent,name=missingVar}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockWorkflowVariable],
      });
      expect(result.processedQuery).toBe('@missingVar');
      expect(result.updatedQuery).toBe('@{type=var,id=non-existent,name=missingVar}');
      expect(result.resourceVars).toEqual([]);
    });

    it('should handle resource type mentions', () => {
      const query = '@{type=resource,id=resource-1,name=resourceVar}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariable],
      });
      expect(result.processedQuery).toBe('@resourceVar');
      expect(result.updatedQuery).toBe('@{type=resource,id=resource-1,name=resourceVar}');
      expect(result.resourceVars).toEqual([mockResourceVariable]);
    });

    it('should handle step type mentions', () => {
      const query = '@{type=step,id=step-1,name=dataAnalysisStep}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [],
      });
      expect(result.processedQuery).toBe('@dataAnalysisStep');
      expect(result.updatedQuery).toBe('@{type=step,id=step-1,name=dataAnalysisStep}');
      expect(result.resourceVars).toEqual([]);
    });

    it('should handle toolset type mentions', () => {
      const query = '@{type=toolset,id=toolset-1,name=calculatorToolset}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [],
      });
      expect(result.processedQuery).toBe('@calculatorToolset');
      expect(result.updatedQuery).toBe('@{type=toolset,id=toolset-1,name=calculatorToolset}');
      expect(result.resourceVars).toEqual([]);
    });

    it('should handle tool type mentions', () => {
      const query = '@{type=tool,id=tool-1,name=calculatorTool}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [],
      });
      expect(result.processedQuery).toBe('@calculatorTool');
      expect(result.updatedQuery).toBe('@{type=tool,id=tool-1,name=calculatorTool}');
      expect(result.resourceVars).toEqual([]);
    });

    it('should handle multiple mentions', () => {
      const query =
        '@{type=var,id=var-1,name=testVar} and @{type=resource,id=resource-1,name=resourceVar} and @{type=step,id=step-1,name=dataStep} @{type=tool,id=tool-1,name=calcTool}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockWorkflowVariable, mockResourceVariable],
      });
      expect(result.processedQuery).toBe('hello world and @resourceVar and @dataStep @calcTool');
      expect(result.updatedQuery).toBe(
        '@{type=var,id=var-1,name=testVar} and @{type=resource,id=resource-1,name=resourceVar} and @{type=step,id=step-1,name=dataStep} @{type=tool,id=tool-1,name=calcTool}',
      );
      expect(result.resourceVars).toEqual([mockResourceVariable]);
    });

    it('should replace resource mention with variable value name when entityId matches', () => {
      const query = '@{type=resource,id=entity-123,name=oldResourceName}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariableWithEntityId],
      });
      expect(result.processedQuery).toBe('@newResourceName');
      expect(result.updatedQuery).toBe('@{type=resource,id=entity-123,name=newResourceName}');
      expect(result.resourceVars).toEqual([mockResourceVariableWithEntityId]);
    });

    it('should use mention name when no matching resource variable found', () => {
      const query = '@{type=resource,id=non-matching-entity,name=mentionName}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariableWithEntityId],
      });
      expect(result.processedQuery).toBe('@mentionName');
      expect(result.updatedQuery).toBe('@{type=resource,id=non-matching-entity,name=mentionName}');
      expect(result.resourceVars).toEqual([]);
    });

    it('should use mention name when resource variable has no matching entityId', () => {
      const variableWithoutMatchingEntity: WorkflowVariable = {
        variableId: 'resource-3',
        name: 'differentEntityVar',
        variableType: 'resource',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'resourceName',
              fileType: 'document',
              storageKey: 'key456',
              entityId: 'different-entity-456',
            },
          },
        ],
      };

      const query = '@{type=resource,id=entity-123,name=mentionName}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [variableWithoutMatchingEntity],
      });
      expect(result.processedQuery).toBe('@mentionName');
      expect(result.updatedQuery).toBe('@{type=resource,id=entity-123,name=mentionName}');
      expect(result.resourceVars).toEqual([]);
    });

    it('should use resource title from resources array when provided', () => {
      const query = '@{type=resource,id=resource-123,name=oldName}';
      const resources = [
        {
          resourceId: 'resource-123',
          title: 'Updated Resource Title',
          resourceType: 'document' as const,
        },
      ];
      const result = processQueryWithMentions(query, {
        resources,
      });
      expect(result.processedQuery).toBe('@Updated Resource Title');
      expect(result.updatedQuery).toBe(
        '@{type=resource,id=resource-123,name=Updated Resource Title}',
      );
      expect(result.resourceVars).toEqual([]);
    });

    it('should fallback to mention name when resource not found in resources array', () => {
      const query = '@{type=resource,id=non-existent-resource,name=fallbackName}';
      const resources = [
        {
          resourceId: 'resource-123',
          title: 'Some Resource',
          resourceType: 'document' as const,
        },
      ];
      const result = processQueryWithMentions(query, {
        resources,
      });
      expect(result.processedQuery).toBe('@fallbackName');
      expect(result.updatedQuery).toBe(
        '@{type=resource,id=non-existent-resource,name=fallbackName}',
      );
      expect(result.resourceVars).toEqual([]);
    });

    it('should prioritize resources array over variables when both are provided', () => {
      const query = '@{type=resource,id=resource-123,name=mentionName}';
      const resources = [
        {
          resourceId: 'resource-123',
          title: 'Resource From Array',
          resourceType: 'document' as const,
        },
      ];
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariableWithEntityId],
        resources,
      });
      expect(result.processedQuery).toBe('@Resource From Array');
      expect(result.updatedQuery).toBe('@{type=resource,id=resource-123,name=Resource From Array}');
      expect(result.resourceVars).toEqual([]);
    });
  });

  describe('updatedQuery with resource name updates', () => {
    it('should update resource mention name in updatedQuery when matching variable found', () => {
      const query = '@{type=resource,id=entity-123,name=oldResourceName}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariableWithEntityId],
      });
      expect(result.updatedQuery).toBe('@{type=resource,id=entity-123,name=newResourceName}');
      expect(result.processedQuery).toBe('@newResourceName');
      expect(result.resourceVars).toEqual([mockResourceVariableWithEntityId]);
    });

    it('should keep original mention name in updatedQuery when no matching variable found', () => {
      const query = '@{type=resource,id=non-matching-entity,name=originalName}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariableWithEntityId],
      });
      expect(result.updatedQuery).toBe('@{type=resource,id=non-matching-entity,name=originalName}');
      expect(result.processedQuery).toBe('@originalName');
    });

    it('should handle multiple resource mentions with mixed matching', () => {
      const anotherResourceVariable: WorkflowVariable = {
        variableId: 'resource-4',
        name: 'anotherResourceVar',
        variableType: 'resource',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'anotherNewName',
              fileType: 'document',
              storageKey: 'key789',
              entityId: 'entity-456',
            },
          },
        ],
      };

      const query =
        '@{type=resource,id=entity-123,name=oldName1} and @{type=resource,id=entity-456,name=oldName2} and @{type=resource,id=entity-789,name=oldName3}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariableWithEntityId, anotherResourceVariable],
      });
      expect(result.updatedQuery).toBe(
        '@{type=resource,id=entity-123,name=newResourceName} and @{type=resource,id=entity-456,name=anotherNewName} and @{type=resource,id=entity-789,name=oldName3}',
      );
      expect(result.processedQuery).toBe('@newResourceName and @anotherNewName and @oldName3');
      expect(result.resourceVars).toEqual([
        mockResourceVariableWithEntityId,
        anotherResourceVariable,
      ]);
    });

    it('should handle resource mention with complex surrounding text', () => {
      const query = 'Please analyze @{type=resource,id=entity-123,name=oldDocument} for insights';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariableWithEntityId],
      });
      expect(result.updatedQuery).toBe(
        'Please analyze @{type=resource,id=entity-123,name=newResourceName} for insights',
      );
      expect(result.processedQuery).toBe('Please analyze @newResourceName for insights');
    });

    it('should not update updatedQuery for non-resource mentions', () => {
      const query =
        '@{type=var,id=var-1,name=testVar} and @{type=resource,id=entity-123,name=oldName}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockWorkflowVariable, mockResourceVariableWithEntityId],
      });
      expect(result.updatedQuery).toBe(
        '@{type=var,id=var-1,name=testVar} and @{type=resource,id=entity-123,name=newResourceName}',
      );
      expect(result.processedQuery).toBe('hello world and @newResourceName');
    });

    it('should handle resource variable with empty name', () => {
      const resourceVariableWithEmptyName: WorkflowVariable = {
        variableId: 'resource-5',
        name: 'emptyNameVar',
        variableType: 'resource',
        value: [
          {
            type: 'resource',
            resource: {
              name: '',
              fileType: 'document',
              storageKey: 'key999',
              entityId: 'entity-999',
            },
          },
        ],
      };

      const query = '@{type=resource,id=entity-999,name=someName}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [resourceVariableWithEmptyName],
      });
      expect(result.updatedQuery).toBe('@{type=resource,id=entity-999,name=}');
      expect(result.processedQuery).toBe('@');
    });

    it('should handle resource variable with special characters in name', () => {
      const resourceVariableWithSpecialChars: WorkflowVariable = {
        variableId: 'resource-6',
        name: 'specialCharsVar',
        variableType: 'resource',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'Document with spaces & symbols @#$%',
              fileType: 'document',
              storageKey: 'key-special',
              entityId: 'entity-special',
            },
          },
        ],
      };

      const query = '@{type=resource,id=entity-special,name=oldName}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [resourceVariableWithSpecialChars],
      });
      expect(result.updatedQuery).toBe(
        '@{type=resource,id=entity-special,name=Document with spaces & symbols @#$%}',
      );
      expect(result.processedQuery).toBe('@Document with spaces & symbols @#$%');
    });
  });
});

describe('parseMentionsFromQuery', () => {
  describe('basic functionality', () => {
    it('should return empty array for query with no mentions', () => {
      const result = parseMentionsFromQuery('This is a regular query with no mentions');
      expect(result).toEqual([]);
    });

    it('should return empty array for empty query', () => {
      const result = parseMentionsFromQuery('');
      expect(result).toEqual([]);
    });

    it('should parse a single var mention correctly', () => {
      const query = 'this is a test @{type=var,id=var-1,name=cv_folder_url}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'cv_folder_url',
        },
      ]);
    });

    it('should parse a single resource mention correctly', () => {
      const query = 'with resource @{type=resource,id=resource-1,name=resource_1}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'resource',
          id: 'resource-1',
          name: 'resource_1',
        },
      ]);
    });

    it('should parse multiple mentions correctly', () => {
      const query =
        'this is a test @{type=var,id=var-1,name=cv_folder_url}, with resource @{type=resource,id=resource-1,name=resource_1}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'cv_folder_url',
        },
        {
          type: 'resource',
          id: 'resource-1',
          name: 'resource_1',
        },
      ]);
    });
  });

  describe('validation and error handling', () => {
    it('should filter out mentions with missing type', () => {
      const query = '@{id=var-1,name=testVar} @{type=var,id=var-2,name=testVar2}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-2',
          name: 'testVar2',
        },
      ]);
    });

    it('should filter out mentions with missing id', () => {
      const query = '@{type=var,name=testVar} @{type=var,id=var-2,name=testVar2}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-2',
          name: 'testVar2',
        },
      ]);
    });

    it('should filter out mentions with missing name', () => {
      const query = '@{type=var,id=var-1} @{type=var,id=var-2,name=testVar2}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-2',
          name: 'testVar2',
        },
      ]);
    });

    it('should filter out mentions with invalid type', () => {
      const query =
        '@{type=invalid,id=test-1,name=testName} @{type=var,id=var-1,name=testVar} @{type=resource,id=resource-1,name=testResource}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'testVar',
        },
        {
          type: 'resource',
          id: 'resource-1',
          name: 'testResource',
        },
      ]);
    });

    it('should filter out mentions with step type', () => {
      const query = '@{type=step,id=step-1,name=testStep} @{type=var,id=var-1,name=testVar}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'testVar',
        },
      ]);
    });

    it('should filter out mentions with toolset type', () => {
      const query =
        '@{type=toolset,id=toolset-1,name=testToolset} @{type=var,id=var-1,name=testVar}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'testVar',
        },
      ]);
    });

    it('should filter out mentions with tool type', () => {
      const query = '@{type=tool,id=tool-1,name=testTool} @{type=var,id=var-1,name=testVar}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'testVar',
        },
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle mentions with extra spaces in parameters', () => {
      const query = '@{ type=var, id=var-1, name=testVar }';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'testVar',
        },
      ]);
    });

    it('should handle mentions with special characters in names', () => {
      const query = '@{type=var,id=var-1,name=Test with spaces & symbols @#$%}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'Test with spaces & symbols @#$%',
        },
      ]);
    });

    it('should handle malformed mention syntax gracefully', () => {
      const query =
        '@{type=var,id=var-1,name=testVar @{type=resource,id=res-1,name=res} @{incomplete} @{type=var,id=var-2,name=testVar2}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-2',
          name: 'testVar2',
        },
      ]);
    });

    it('should handle mentions with empty parameter values', () => {
      const query =
        '@{type=,id=var-1,name=testVar} @{type=var,id=,name=testVar} @{type=var,id=var-2,name=} @{type=var,id=var-3,name=testVar3}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-3',
          name: 'testVar3',
        },
      ]);
    });

    it('should handle mentions at the beginning and end of query', () => {
      const query =
        '@{type=var,id=var-1,name=startVar} some text @{type=resource,id=res-1,name=endResource}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'startVar',
        },
        {
          type: 'resource',
          id: 'res-1',
          name: 'endResource',
        },
      ]);
    });

    it('should handle multiple mentions of the same type', () => {
      const query =
        '@{type=var,id=var-1,name=var1} @{type=var,id=var-2,name=var2} @{type=resource,id=res-1,name=res1} @{type=resource,id=res-2,name=res2}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'var1',
        },
        {
          type: 'var',
          id: 'var-2',
          name: 'var2',
        },
        {
          type: 'resource',
          id: 'res-1',
          name: 'res1',
        },
        {
          type: 'resource',
          id: 'res-2',
          name: 'res2',
        },
      ]);
    });

    it('should handle mentions with parameters in different order', () => {
      const query = '@{name=testName,type=var,id=var-1} @{id=res-1,type=resource,name=resName}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'testName',
        },
        {
          type: 'resource',
          id: 'res-1',
          name: 'resName',
        },
      ]);
    });
  });
});

describe('replaceResourceMentionsInQuery', () => {
  // Test data
  const mockResourceVariable: WorkflowVariable = {
    variableId: 'resource-1',
    name: 'resourceVar',
    variableType: 'resource',
    value: [
      {
        type: 'resource',
        resource: {
          name: 'newResourceName',
          fileType: 'document',
          storageKey: 'key123',
          entityId: 'entity-123',
        },
      },
    ],
  };

  const mockAnotherResourceVariable: WorkflowVariable = {
    variableId: 'resource-2',
    name: 'anotherResourceVar',
    variableType: 'resource',
    value: [
      {
        type: 'resource',
        resource: {
          name: 'anotherNewName',
          fileType: 'document',
          storageKey: 'key456',
          entityId: 'entity-456',
        },
      },
    ],
  };

  describe('basic functionality', () => {
    it('should return empty query unchanged', () => {
      const result = replaceResourceMentionsInQuery('', [], {});
      expect(result).toBe('');
    });

    it('should return query with no mentions unchanged', () => {
      const query = 'This is a regular query with no mentions';
      const result = replaceResourceMentionsInQuery(query, [], {});
      expect(result).toBe(query);
    });

    it('should ignore non-resource mentions', () => {
      const query = '@{type=var,id=var-1,name=testVar} and some text';
      const result = replaceResourceMentionsInQuery(query, [], {});
      expect(result).toBe(query);
    });
  });

  describe('resource mention processing', () => {
    it('should update resource mention with matching variable and entityIdMap', () => {
      const query = '@{type=resource,id=entity-123,name=oldResourceName}';
      const entityIdMap = { 'entity-123': 'entity-789' };
      const result = replaceResourceMentionsInQuery(query, [mockResourceVariable], entityIdMap);
      expect(result).toBe('@{type=resource,id=entity-789,name=newResourceName}');
    });

    it('should update resource mention with matching variable but no entityIdMap', () => {
      const query = '@{type=resource,id=entity-123,name=oldResourceName}';
      const result = replaceResourceMentionsInQuery(query, [mockResourceVariable], {});
      expect(result).toBe('@{type=resource,id=entity-123,name=newResourceName}');
    });

    it('should update only entityId when no matching variable found but entityIdMap exists', () => {
      const query = '@{type=resource,id=entity-123,name=oldResourceName}';
      const entityIdMap = { 'entity-123': 'entity-789' };
      const result = replaceResourceMentionsInQuery(query, [], entityIdMap);
      expect(result).toBe('@{type=resource,id=entity-789,name=oldResourceName}');
    });

    it('should return original mention when no matching variable and no entityIdMap', () => {
      const query = '@{type=resource,id=entity-123,name=oldResourceName}';
      const result = replaceResourceMentionsInQuery(query, [], {});
      expect(result).toBe('@{type=resource,id=entity-123,name=oldResourceName}');
    });
  });

  describe('multiple mentions', () => {
    it('should handle multiple resource mentions in one query', () => {
      const query =
        '@{type=resource,id=entity-123,name=oldName1} and @{type=resource,id=entity-456,name=oldName2}';
      const entityIdMap = { 'entity-123': 'entity-789', 'entity-456': 'entity-999' };
      const result = replaceResourceMentionsInQuery(
        query,
        [mockResourceVariable, mockAnotherResourceVariable],
        entityIdMap,
      );
      expect(result).toBe(
        '@{type=resource,id=entity-789,name=newResourceName} and @{type=resource,id=entity-999,name=anotherNewName}',
      );
    });

    it('should handle mixed mentions with some matches and some not', () => {
      const query =
        '@{type=resource,id=entity-123,name=oldName1} @{type=var,id=var-1,name=testVar} @{type=resource,id=entity-999,name=oldName2}';
      const entityIdMap = { 'entity-123': 'entity-789' };
      const result = replaceResourceMentionsInQuery(query, [mockResourceVariable], entityIdMap);
      expect(result).toBe(
        '@{type=resource,id=entity-789,name=newResourceName} @{type=var,id=var-1,name=testVar} @{type=resource,id=entity-999,name=oldName2}',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle malformed mentions gracefully', () => {
      const query = '@{type=resource,id=entity-123} @{type=resource,name=oldName} @{malformed}';
      const result = replaceResourceMentionsInQuery(query, [], {});
      expect(result).toBe(query);
    });

    it('should handle resource variable with empty name', () => {
      const resourceVariableWithEmptyName: WorkflowVariable = {
        variableId: 'resource-3',
        name: 'emptyNameVar',
        variableType: 'resource',
        value: [
          {
            type: 'resource',
            resource: {
              name: '',
              fileType: 'document',
              storageKey: 'key999',
              entityId: 'entity-999',
            },
          },
        ],
      };

      const query = '@{type=resource,id=entity-999,name=oldName}';
      const result = replaceResourceMentionsInQuery(query, [resourceVariableWithEmptyName], {});
      expect(result).toBe('@{type=resource,id=entity-999,name=}');
    });

    it('should handle resource variable with special characters in name', () => {
      const resourceVariableWithSpecialChars: WorkflowVariable = {
        variableId: 'resource-4',
        name: 'specialCharsVar',
        variableType: 'resource',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'Document with spaces & symbols @#$%',
              fileType: 'document',
              storageKey: 'key-special',
              entityId: 'entity-special',
            },
          },
        ],
      };

      const query = '@{type=resource,id=entity-special,name=oldName}';
      const result = replaceResourceMentionsInQuery(query, [resourceVariableWithSpecialChars], {});
      expect(result).toBe(
        '@{type=resource,id=entity-special,name=Document with spaces & symbols @#$%}',
      );
    });

    it('should handle resource variable with undefined resource', () => {
      const resourceVariableWithUndefinedResource: WorkflowVariable = {
        variableId: 'resource-5',
        name: 'undefinedResourceVar',
        variableType: 'resource',
        value: [{ type: 'resource' }], // resource is undefined
      };

      const query = '@{type=resource,id=entity-123,name=oldName}';
      const result = replaceResourceMentionsInQuery(
        query,
        [resourceVariableWithUndefinedResource],
        {},
      );
      expect(result).toBe('@{type=resource,id=entity-123,name=oldName}');
    });

    it('should handle resource variable with empty value array', () => {
      const resourceVariableWithEmptyValue: WorkflowVariable = {
        variableId: 'resource-6',
        name: 'emptyValueVar',
        variableType: 'resource',
        value: [],
      };

      const query = '@{type=resource,id=entity-123,name=oldName}';
      const result = replaceResourceMentionsInQuery(query, [resourceVariableWithEmptyValue], {});
      expect(result).toBe('@{type=resource,id=entity-123,name=oldName}');
    });
  });

  describe('entityId matching', () => {
    it('should match resource variable by entityId from value array', () => {
      const query = '@{type=resource,id=entity-123,name=oldName}';
      const result = replaceResourceMentionsInQuery(query, [mockResourceVariable], {});
      expect(result).toBe('@{type=resource,id=entity-123,name=newResourceName}');
    });

    it('should not match when entityId does not match', () => {
      const query = '@{type=resource,id=entity-999,name=oldName}';
      const result = replaceResourceMentionsInQuery(query, [mockResourceVariable], {});
      expect(result).toBe('@{type=resource,id=entity-999,name=oldName}');
    });

    it('should prioritize entityIdMap over resource entityId', () => {
      const query = '@{type=resource,id=entity-123,name=oldName}';
      const entityIdMap = { 'entity-123': 'mapped-entity-id' };
      const result = replaceResourceMentionsInQuery(query, [mockResourceVariable], entityIdMap);
      expect(result).toBe('@{type=resource,id=mapped-entity-id,name=newResourceName}');
    });
  });
});

describe('parseMentionsFromQuery', () => {
  describe('basic functionality', () => {
    it('should return empty array for query with no mentions', () => {
      const result = parseMentionsFromQuery('This is a regular query with no mentions');
      expect(result).toEqual([]);
    });

    it('should return empty array for empty query', () => {
      const result = parseMentionsFromQuery('');
      expect(result).toEqual([]);
    });

    it('should parse a single var mention correctly', () => {
      const query = 'this is a test @{type=var,id=var-1,name=cv_folder_url}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'cv_folder_url',
        },
      ]);
    });

    it('should parse a single resource mention correctly', () => {
      const query = 'with resource @{type=resource,id=resource-1,name=resource_1}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'resource',
          id: 'resource-1',
          name: 'resource_1',
        },
      ]);
    });

    it('should parse multiple mentions correctly', () => {
      const query =
        'this is a test @{type=var,id=var-1,name=cv_folder_url}, with resource @{type=resource,id=resource-1,name=resource_1}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'cv_folder_url',
        },
        {
          type: 'resource',
          id: 'resource-1',
          name: 'resource_1',
        },
      ]);
    });
  });

  describe('validation and error handling', () => {
    it('should filter out mentions with missing type', () => {
      const query = '@{id=var-1,name=testVar} @{type=var,id=var-2,name=testVar2}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-2',
          name: 'testVar2',
        },
      ]);
    });

    it('should filter out mentions with missing id', () => {
      const query = '@{type=var,name=testVar} @{type=var,id=var-2,name=testVar2}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-2',
          name: 'testVar2',
        },
      ]);
    });

    it('should filter out mentions with missing name', () => {
      const query = '@{type=var,id=var-1} @{type=var,id=var-2,name=testVar2}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-2',
          name: 'testVar2',
        },
      ]);
    });

    it('should filter out mentions with invalid type', () => {
      const query =
        '@{type=invalid,id=test-1,name=testName} @{type=var,id=var-1,name=testVar} @{type=resource,id=resource-1,name=testResource}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'testVar',
        },
        {
          type: 'resource',
          id: 'resource-1',
          name: 'testResource',
        },
      ]);
    });

    it('should filter out mentions with step type', () => {
      const query = '@{type=step,id=step-1,name=testStep} @{type=var,id=var-1,name=testVar}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'testVar',
        },
      ]);
    });

    it('should filter out mentions with toolset type', () => {
      const query =
        '@{type=toolset,id=toolset-1,name=testToolset} @{type=var,id=var-1,name=testVar}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'testVar',
        },
      ]);
    });

    it('should filter out mentions with tool type', () => {
      const query = '@{type=tool,id=tool-1,name=testTool} @{type=var,id=var-1,name=testVar}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'testVar',
        },
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle mentions with extra spaces in parameters', () => {
      const query = '@{ type=var, id=var-1, name=testVar }';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'testVar',
        },
      ]);
    });

    it('should handle mentions with special characters in names', () => {
      const query = '@{type=var,id=var-1,name=Test with spaces & symbols @#$%}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'Test with spaces & symbols @#$%',
        },
      ]);
    });

    it('should handle malformed mention syntax gracefully', () => {
      const query =
        '@{type=var,id=var-1,name=testVar @{type=resource,id=res-1,name=res} @{incomplete} @{type=var,id=var-2,name=testVar2}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-2',
          name: 'testVar2',
        },
      ]);
    });

    it('should handle mentions with empty parameter values', () => {
      const query =
        '@{type=,id=var-1,name=testVar} @{type=var,id=,name=testVar} @{type=var,id=var-2,name=} @{type=var,id=var-3,name=testVar3}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-3',
          name: 'testVar3',
        },
      ]);
    });

    it('should handle mentions at the beginning and end of query', () => {
      const query =
        '@{type=var,id=var-1,name=startVar} some text @{type=resource,id=res-1,name=endResource}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'startVar',
        },
        {
          type: 'resource',
          id: 'res-1',
          name: 'endResource',
        },
      ]);
    });

    it('should handle multiple mentions of the same type', () => {
      const query =
        '@{type=var,id=var-1,name=var1} @{type=var,id=var-2,name=var2} @{type=resource,id=res-1,name=res1} @{type=resource,id=res-2,name=res2}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'var1',
        },
        {
          type: 'var',
          id: 'var-2',
          name: 'var2',
        },
        {
          type: 'resource',
          id: 'res-1',
          name: 'res1',
        },
        {
          type: 'resource',
          id: 'res-2',
          name: 'res2',
        },
      ]);
    });

    it('should handle mentions with parameters in different order', () => {
      const query = '@{name=testName,type=var,id=var-1} @{id=res-1,type=resource,name=resName}';
      const result = parseMentionsFromQuery(query);
      expect(result).toEqual([
        {
          type: 'var',
          id: 'var-1',
          name: 'testName',
        },
        {
          type: 'resource',
          id: 'res-1',
          name: 'resName',
        },
      ]);
    });
  });
});
