import { describe, it, expect } from 'vitest';
import { validateConfig } from './validator';
import type { DynamicConfigItem } from '@refly/openapi-schema';

describe('validateConfig', () => {
  // Test data setup
  const baseConfigItem: Omit<DynamicConfigItem, 'key' | 'inputMode'> = {
    required: false,
    labelDict: { en: 'Test Field' },
    descriptionDict: { en: 'Test Description' },
  };

  describe('required field validation', () => {
    it('should pass when required fields are provided', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'name',
          inputMode: 'text',
          required: true,
        },
      ];

      const obj = { name: 'John Doe' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required fields are missing', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'name',
          inputMode: 'text',
          required: true,
        },
      ];

      const obj = {};
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Required field 'name' is missing or empty");
    });

    it('should fail when required fields are null', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'name',
          inputMode: 'text',
          required: true,
        },
      ];

      const obj = { name: null };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Required field 'name' is missing or empty");
    });

    it('should fail when required fields are empty strings', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'name',
          inputMode: 'text',
          required: true,
        },
      ];

      const obj = { name: '' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Required field 'name' is missing or empty");
    });

    it('should pass when optional fields are missing', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'name',
          inputMode: 'text',
          required: false,
        },
      ];

      const obj = {};
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('text input validation', () => {
    it('should validate text input correctly', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'name',
          inputMode: 'text',
        },
      ];

      const obj = { name: 'John Doe' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate textarea input correctly', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'description',
          inputMode: 'textarea',
        },
      ];

      const obj = { description: 'A long description text' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when text field has non-string value', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'name',
          inputMode: 'text',
        },
      ];

      const obj = { name: 123 };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'name' must be a string, got number");
    });
  });

  describe('number input validation', () => {
    it('should validate number input correctly', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'age',
          inputMode: 'number',
        },
      ];

      const obj = { age: 25 };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when number field has non-number value', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'age',
          inputMode: 'number',
        },
      ];

      const obj = { age: '25' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'age' must be a number, got string");
    });

    it('should validate min constraint', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'age',
          inputMode: 'number',
          inputProps: { min: 18 },
        },
      ];

      const obj = { age: 16 };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'age' must be at least 18, got 16");
    });

    it('should validate max constraint', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'age',
          inputMode: 'number',
          inputProps: { max: 65 },
        },
      ];

      const obj = { age: 70 };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'age' must be at most 65, got 70");
    });

    it('should validate step constraint', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'score',
          inputMode: 'number',
          inputProps: { min: 0, step: 0.5 },
        },
      ];

      const obj = { score: 1.3 };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'score' must be a multiple of 0.5");
    });

    it('should pass step validation for valid values', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'score',
          inputMode: 'number',
          inputProps: { min: 0, step: 0.5 },
        },
      ];

      const obj = { score: 1.5 };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('select and radio input validation', () => {
    it('should validate select input with valid option', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'category',
          inputMode: 'select',
          options: [
            { value: 'tech', labelDict: { en: 'Technology' } },
            { value: 'sports', labelDict: { en: 'Sports' } },
          ],
        },
      ];

      const obj = { category: 'tech' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate radio input with valid option', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'category',
          inputMode: 'radio',
          options: [
            { value: 'tech', labelDict: { en: 'Technology' } },
            { value: 'sports', labelDict: { en: 'Sports' } },
          ],
        },
      ];

      const obj = { category: 'sports' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when select field has invalid option', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'category',
          inputMode: 'select',
          options: [
            { value: 'tech', labelDict: { en: 'Technology' } },
            { value: 'sports', labelDict: { en: 'Sports' } },
          ],
        },
      ];

      const obj = { category: 'invalid' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'category' must be one of: tech, sports");
    });

    it('should fail when select field has non-string value', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'category',
          inputMode: 'select',
          options: [{ value: 'tech', labelDict: { en: 'Technology' } }],
        },
      ];

      const obj = { category: 123 };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'category' must be a string, got number");
    });

    it('should pass when no options are defined', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'category',
          inputMode: 'select',
        },
      ];

      const obj = { category: 'any-value' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('multiSelect input validation', () => {
    it('should validate multiSelect input with valid options', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'tags',
          inputMode: 'multiSelect',
          options: [
            { value: 'tech', labelDict: { en: 'Technology' } },
            { value: 'sports', labelDict: { en: 'Sports' } },
            { value: 'news', labelDict: { en: 'News' } },
          ],
        },
      ];

      const obj = { tags: ['tech', 'sports'] };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when multiSelect field has non-array value', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'tags',
          inputMode: 'multiSelect',
          options: [{ value: 'tech', labelDict: { en: 'Technology' } }],
        },
      ];

      const obj = { tags: 'tech' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'tags' must be an array, got string");
    });

    it('should fail when multiSelect field has invalid options', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'tags',
          inputMode: 'multiSelect',
          options: [
            { value: 'tech', labelDict: { en: 'Technology' } },
            { value: 'sports', labelDict: { en: 'Sports' } },
          ],
        },
      ];

      const obj = { tags: ['tech', 'invalid'] };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'tags' contains invalid values: invalid");
    });

    it('should pass when no options are defined', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'tags',
          inputMode: 'multiSelect',
        },
      ];

      const obj = { tags: ['any', 'values'] };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('switch input validation', () => {
    it('should validate switch input with boolean value', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'enabled',
          inputMode: 'switch',
        },
      ];

      const obj = { enabled: true };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when switch field has non-boolean value', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'enabled',
          inputMode: 'switch',
        },
      ];

      const obj = { enabled: 'true' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'enabled' must be a boolean, got string");
    });
  });

  describe('complex validation scenarios', () => {
    it('should validate multiple fields correctly', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'name',
          inputMode: 'text',
          required: true,
        },
        {
          ...baseConfigItem,
          key: 'age',
          inputMode: 'number',
          required: false,
          inputProps: { min: 0, max: 120 },
        },
        {
          ...baseConfigItem,
          key: 'category',
          inputMode: 'select',
          options: [
            { value: 'tech', labelDict: { en: 'Technology' } },
            { value: 'sports', labelDict: { en: 'Sports' } },
          ],
        },
      ];

      const obj = {
        name: 'John Doe',
        age: 25,
        category: 'tech',
      };

      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all validation errors', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'name',
          inputMode: 'text',
          required: true,
        },
        {
          ...baseConfigItem,
          key: 'age',
          inputMode: 'number',
          required: false,
          inputProps: { min: 0, max: 120 },
        },
        {
          ...baseConfigItem,
          key: 'category',
          inputMode: 'select',
          options: [{ value: 'tech', labelDict: { en: 'Technology' } }],
        },
      ];

      const obj = {
        age: 150,
        category: 'invalid',
      };

      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain("Required field 'name' is missing or empty");
      expect(result.errors).toContain("Field 'age' must be at most 120, got 150");
      expect(result.errors).toContain("Field 'category' must be one of: tech");
    });

    it('should handle unknown input mode gracefully', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'unknown',
          inputMode: 'unknown' as any,
        },
      ];

      const obj = { unknown: 'value' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Unknown input mode 'unknown' for field 'unknown'");
    });
  });

  describe('edge cases', () => {
    it('should handle empty items array', () => {
      const items: DynamicConfigItem[] = [];
      const obj = { any: 'value' };
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty object', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'name',
          inputMode: 'text',
          required: false,
        },
      ];

      const obj = {};
      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle object with extra properties', () => {
      const items: DynamicConfigItem[] = [
        {
          ...baseConfigItem,
          key: 'name',
          inputMode: 'text',
          required: true,
        },
      ];

      const obj = {
        name: 'John Doe',
        extra: 'should be ignored',
        another: 123,
      };

      const result = validateConfig(obj, items);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
