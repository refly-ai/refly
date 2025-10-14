import { describe, it, expect } from 'vitest';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { processQueryWithMentions, replaceResourceMentionsInQuery } from './query-processor';

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
    value: [{ type: 'text', text: 'resource content' }],
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
    it('should replace variable mention with value when replaceVars is true', () => {
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

    it('should replace with name when variable not found', () => {
      const query = '@{type=var,id=non-existent,name=missingVar}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockWorkflowVariable],
      });
      expect(result.processedQuery).toBe('missingVar');
      expect(result.updatedQuery).toBe('@{type=var,id=non-existent,name=missingVar}');
      expect(result.resourceVars).toEqual([]);
    });

    it('should handle resource type mentions', () => {
      const query = '@{type=resource,id=resource-1,name=resourceVar}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariable],
      });
      expect(result.processedQuery).toBe('resourceVar');
      expect(result.updatedQuery).toBe('@{type=resource,id=resource-1,name=resourceVar}');
      expect(result.resourceVars).toEqual([mockResourceVariable]);
    });

    it('should handle multiple mentions', () => {
      const query =
        '@{type=var,id=var-1,name=testVar} and @{type=resource,id=resource-1,name=resourceVar}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockWorkflowVariable, mockResourceVariable],
      });
      expect(result.processedQuery).toBe('hello world and resourceVar');
      expect(result.updatedQuery).toBe(
        '@{type=var,id=var-1,name=testVar} and @{type=resource,id=resource-1,name=resourceVar}',
      );
      expect(result.resourceVars).toEqual([mockResourceVariable]);
    });

    it('should replace resource mention with variable value name when entityId matches', () => {
      const query = '@{type=resource,id=entity-123,name=oldResourceName}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariableWithEntityId],
      });
      expect(result.processedQuery).toBe('newResourceName');
      expect(result.updatedQuery).toBe('@{type=resource,id=entity-123,name=newResourceName}');
      expect(result.resourceVars).toEqual([mockResourceVariableWithEntityId]);
    });

    it('should use mention name when no matching resource variable found', () => {
      const query = '@{type=resource,id=non-matching-entity,name=mentionName}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariableWithEntityId],
      });
      expect(result.processedQuery).toBe('mentionName');
      expect(result.updatedQuery).toBe('@{type=resource,id=non-matching-entity,name=mentionName}');
      expect(result.resourceVars).toEqual([mockResourceVariableWithEntityId]);
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
      expect(result.processedQuery).toBe('mentionName');
      expect(result.updatedQuery).toBe('@{type=resource,id=entity-123,name=mentionName}');
      expect(result.resourceVars).toEqual([variableWithoutMatchingEntity]);
    });
  });

  describe('legacy @variableName format', () => {
    describe('WorkflowVariable handling', () => {
      it('should replace string variable with value', () => {
        const query = '@testVar hello';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockWorkflowVariable],
        });
        expect(result.processedQuery).toBe('hello world hello');
        expect(result.updatedQuery).toBe('@testVar hello');
        expect(result.resourceVars).toEqual([]);
      });

      it('should replace string variable at the beginning of string', () => {
        const query = '@testVar';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockWorkflowVariable],
        });
        expect(result.processedQuery).toBe('hello world');
        expect(result.updatedQuery).toBe('@testVar');
        expect(result.resourceVars).toEqual([]);
      });

      it('should replace string variable in the middle of string', () => {
        const query = 'start @testVar end';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockWorkflowVariable],
        });
        expect(result.processedQuery).toBe('start hello world end');
        expect(result.updatedQuery).toBe('start @testVar end');
        expect(result.resourceVars).toEqual([]);
      });

      it('should replace string variable at the end of string', () => {
        const query = 'hello @testVar';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockWorkflowVariable],
        });
        expect(result.processedQuery).toBe('hello hello world');
        expect(result.updatedQuery).toBe('hello @testVar');
        expect(result.resourceVars).toEqual([]);
      });

      it('should handle resource variable by removing from query and adding to resourceVars', () => {
        const query = '@resourceVar hello';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockResourceVariable],
        });
        expect(result.processedQuery).toBe('hello');
        expect(result.updatedQuery).toBe('@resourceVar hello');
        expect(result.resourceVars).toEqual([mockResourceVariable]);
      });

      it('should handle resource variable at the beginning of string', () => {
        const query = '@resourceVar';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockResourceVariable],
        });
        expect(result.processedQuery).toBe('');
        expect(result.updatedQuery).toBe('@resourceVar');
        expect(result.resourceVars).toEqual([mockResourceVariable]);
      });

      it('should handle multiple variables', () => {
        const query = '@testVar and @resourceVar';
        const result = processQueryWithMentions(query, {
          replaceVars: true,
          variables: [mockWorkflowVariable, mockResourceVariable],
        });
        expect(result.processedQuery).toBe('hello world and');
        expect(result.updatedQuery).toBe('@testVar and @resourceVar');
        expect(result.resourceVars).toEqual([mockResourceVariable]);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle variable with no value', () => {
      const variableWithNoValue: WorkflowVariable = {
        variableId: 'empty-var',
        name: 'emptyVar',
        variableType: 'string',
        value: [],
      };

      const query = '@emptyVar';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [variableWithNoValue],
      });
      expect(result.processedQuery).toBe('');
      expect(result.updatedQuery).toBe('@emptyVar');
      expect(result.resourceVars).toEqual([]);
    });

    it('should handle variable with empty text values', () => {
      const variableWithEmptyValue: WorkflowVariable = {
        variableId: 'empty-text-var',
        name: 'emptyTextVar',
        variableType: 'string',
        value: [
          { type: 'text', text: '' },
          { type: 'text', text: '   ' },
        ],
      };

      const query = '@emptyTextVar';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [variableWithEmptyValue],
      });
      expect(result.processedQuery).toBe('');
      expect(result.updatedQuery).toBe('@emptyTextVar');
      expect(result.resourceVars).toEqual([]);
    });

    it('should handle multiple text values', () => {
      const variableWithMultipleValues: WorkflowVariable = {
        variableId: 'multi-var',
        name: 'multiVar',
        variableType: 'string',
        value: [
          { type: 'text', text: 'first' },
          { type: 'text', text: 'second' },
          { type: 'text', text: 'third' },
        ],
      };

      const query = '@multiVar';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [variableWithMultipleValues],
      });
      expect(result.processedQuery).toBe('first, second, third');
      expect(result.updatedQuery).toBe('@multiVar');
      expect(result.resourceVars).toEqual([]);
    });

    it('should ignore non-text value types', () => {
      const variableWithNonTextValues: WorkflowVariable = {
        variableId: 'non-text-var',
        name: 'nonTextVar',
        variableType: 'string',
        value: [
          { type: 'file', text: 'ignored' },
          { type: 'text', text: 'valid' },
        ] as any,
      };

      const query = '@nonTextVar';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [variableWithNonTextValues],
      });
      expect(result.processedQuery).toBe('valid');
      expect(result.updatedQuery).toBe('@nonTextVar');
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
      expect(result.processedQuery).toBe('newResourceName');
      expect(result.resourceVars).toEqual([mockResourceVariableWithEntityId]);
    });

    it('should keep original mention name in updatedQuery when no matching variable found', () => {
      const query = '@{type=resource,id=non-matching-entity,name=originalName}';
      const result = processQueryWithMentions(query, {
        replaceVars: true,
        variables: [mockResourceVariableWithEntityId],
      });
      expect(result.updatedQuery).toBe('@{type=resource,id=non-matching-entity,name=originalName}');
      expect(result.processedQuery).toBe('originalName');
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
      expect(result.processedQuery).toBe('newResourceName and anotherNewName and oldName3');
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
      expect(result.processedQuery).toBe('Please analyze newResourceName for insights');
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
      expect(result.processedQuery).toBe('hello world and newResourceName');
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
      expect(result.processedQuery).toBe('');
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
      expect(result.processedQuery).toBe('Document with spaces & symbols @#$%');
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
