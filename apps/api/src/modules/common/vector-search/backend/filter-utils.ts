import {
  VectorFilter,
  QdrantFilter,
  LanceDBFilter,
  SimpleFilter,
  FilterCondition,
  MatchCondition,
  RangeCondition,
  FilterValue,
} from './interface';

/**
 * Utility functions for converting between different vector filter formats
 */

/**
 * Check if a filter is a Qdrant-style structured filter
 */
export function isQdrantFilter(filter: VectorFilter): filter is QdrantFilter {
  if (typeof filter !== 'object' || filter === null) {
    return false;
  }

  const qdrantFilter = filter as QdrantFilter;
  return (
    Array.isArray(qdrantFilter.must) ||
    Array.isArray(qdrantFilter.should) ||
    Array.isArray(qdrantFilter.must_not)
  );
}

/**
 * Check if a filter is a LanceDB-style SQL string filter
 */
export function isLanceDBFilter(filter: VectorFilter): filter is LanceDBFilter {
  return typeof filter === 'string';
}

/**
 * Check if a filter is a simple key-value filter
 */
export function isSimpleFilter(filter: VectorFilter): filter is SimpleFilter {
  if (typeof filter !== 'object' || filter === null) {
    return false;
  }

  // Check if it's not a Qdrant filter and all values are primitive
  if (isQdrantFilter(filter)) {
    return false;
  }

  return Object.values(filter).every(
    (value) =>
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null,
  );
}

/**
 * Convert any VectorFilter to Qdrant format
 */
export function toQdrantFilter(filter: VectorFilter): QdrantFilter {
  if (!filter) {
    return {};
  }

  if (isQdrantFilter(filter)) {
    return filter;
  }

  if (isLanceDBFilter(filter)) {
    return sqlToQdrantFilter(filter);
  }

  if (isSimpleFilter(filter)) {
    return simpleToQdrantFilter(filter);
  }

  // Fallback: treat as simple filter
  return simpleToQdrantFilter(filter as SimpleFilter);
}

/**
 * Convert any VectorFilter to LanceDB SQL format
 */
export function toLanceDBFilter(filter: VectorFilter): string {
  if (!filter) {
    return '';
  }

  if (isLanceDBFilter(filter)) {
    return filter;
  }

  if (isQdrantFilter(filter)) {
    return qdrantToSqlFilter(filter);
  }

  if (isSimpleFilter(filter)) {
    return simpleToSqlFilter(filter);
  }

  // Fallback: treat as simple filter
  return simpleToSqlFilter(filter as SimpleFilter);
}

/**
 * Convert simple key-value filter to Qdrant format
 */
function simpleToQdrantFilter(filter: SimpleFilter): QdrantFilter {
  const conditions: FilterCondition[] = [];

  for (const [key, value] of Object.entries(filter)) {
    if (Array.isArray(value)) {
      conditions.push({
        key,
        match: { any: value },
      });
    } else {
      conditions.push({
        key,
        match: { value },
      });
    }
  }

  return { must: conditions };
}

/**
 * Convert simple key-value filter to SQL format
 */
function simpleToSqlFilter(filter: SimpleFilter): string {
  const conditions: string[] = [];

  for (const [key, value] of Object.entries(filter)) {
    if (Array.isArray(value)) {
      const values = value.map((v) => formatSqlValue(v)).join(', ');
      conditions.push(`${key} IN (${values})`);
    } else if (value === null) {
      conditions.push(`${key} IS NULL`);
    } else {
      conditions.push(`${key} = ${formatSqlValue(value)}`);
    }
  }

  return conditions.join(' AND ');
}

/**
 * Convert Qdrant filter to SQL format
 */
function qdrantToSqlFilter(filter: QdrantFilter): string {
  const clauses: string[] = [];

  if (filter.must?.length) {
    const mustConditions = filter.must.map((condition) => conditionToSql(condition));
    clauses.push(`(${mustConditions.join(' AND ')})`);
  }

  if (filter.should?.length) {
    const shouldConditions = filter.should.map((condition) => conditionToSql(condition));
    clauses.push(`(${shouldConditions.join(' OR ')})`);
  }

  if (filter.must_not?.length) {
    const mustNotConditions = filter.must_not.map((condition) => conditionToSql(condition));
    clauses.push(`NOT (${mustNotConditions.join(' OR ')})`);
  }

  return clauses.join(' AND ');
}

/**
 * Convert a single Qdrant condition to SQL
 */
function conditionToSql(condition: FilterCondition): string {
  const { key } = condition;

  if (condition.match) {
    return matchConditionToSql(key, condition.match);
  }

  if (condition.range) {
    return rangeConditionToSql(key, condition.range);
  }

  if (condition.is_null) {
    return `${key} IS NULL`;
  }

  if (condition.is_empty) {
    return `${key} IS NULL OR ${key} = ''`;
  }

  if (condition.has_id) {
    const values = condition.has_id.has_id.map((id) => formatSqlValue(id)).join(', ');
    return `${key} IN (${values})`;
  }

  // Fallback
  return '1=1';
}

/**
 * Convert Qdrant match condition to SQL
 */
function matchConditionToSql(key: string, match: MatchCondition): string {
  if (match.value !== undefined) {
    if (match.value === null) {
      return `${key} IS NULL`;
    }
    return `${key} = ${formatSqlValue(match.value)}`;
  }

  if (match.any?.length) {
    const values = match.any.map((v) => formatSqlValue(v)).join(', ');
    return `${key} IN (${values})`;
  }

  if (match.except?.length) {
    const values = match.except.map((v) => formatSqlValue(v)).join(', ');
    return `${key} NOT IN (${values})`;
  }

  if (match.text) {
    return `${key} LIKE '%${match.text.replace(/'/g, "''")}%'`;
  }

  return '1=1';
}

/**
 * Convert Qdrant range condition to SQL
 */
function rangeConditionToSql(key: string, range: RangeCondition): string {
  const conditions: string[] = [];

  if (range.gt !== undefined) {
    conditions.push(`${key} > ${range.gt}`);
  }
  if (range.gte !== undefined) {
    conditions.push(`${key} >= ${range.gte}`);
  }
  if (range.lt !== undefined) {
    conditions.push(`${key} < ${range.lt}`);
  }
  if (range.lte !== undefined) {
    conditions.push(`${key} <= ${range.lte}`);
  }

  return conditions.join(' AND ');
}

/**
 * Convert SQL filter to Qdrant format (basic implementation)
 * Note: This is a simplified parser and may not handle all SQL constructs
 */
function sqlToQdrantFilter(sql: string): QdrantFilter {
  // This is a basic implementation - for production use, consider using a proper SQL parser
  const conditions: FilterCondition[] = [];

  // Extract conditions using regex patterns
  let match: RegExpExecArray | null;

  // Handle equality conditions
  const equalityPattern = /(\w+)\s*=\s*(?:'([^']+)'|(\d+))/g;
  match = equalityPattern.exec(sql);
  while (match) {
    const [, key, stringValue, numberValue] = match;
    const value = stringValue || (numberValue ? Number(numberValue) : null);
    conditions.push({
      key,
      match: { value },
    });
    match = equalityPattern.exec(sql);
  }

  // Handle IN conditions
  const inPattern = /(\w+)\s+IN\s*\(([^)]+)\)/gi;
  match = inPattern.exec(sql);
  while (match) {
    const [, key, valuesStr] = match;
    const values = valuesStr.split(',').map((v) => {
      const trimmed = v.trim();
      if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed.slice(1, -1);
      }
      return Number(trimmed);
    });
    conditions.push({
      key,
      match: { any: values },
    });
    match = inPattern.exec(sql);
  }

  // Handle range conditions
  const rangePattern = /(\w+)\s*(>=|<=|>|<)\s*(\d+)/g;
  match = rangePattern.exec(sql);
  while (match) {
    const [, key, operator, valueStr] = match;
    const value = Number(valueStr);
    const range: RangeCondition = {};

    switch (operator) {
      case '>':
        range.gt = value;
        break;
      case '>=':
        range.gte = value;
        break;
      case '<':
        range.lt = value;
        break;
      case '<=':
        range.lte = value;
        break;
    }

    conditions.push({ key, range });
    match = rangePattern.exec(sql);
  }

  return { must: conditions };
}

/**
 * Format a value for SQL
 */
function formatSqlValue(value: FilterValue): string {
  if (value === null) {
    return 'NULL';
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  return String(value);
}

/**
 * Validate filter structure
 */
export function validateFilter(filter: VectorFilter): boolean {
  try {
    if (!filter) {
      return true;
    }

    if (isLanceDBFilter(filter)) {
      return typeof filter === 'string';
    }

    if (isQdrantFilter(filter)) {
      return validateQdrantFilter(filter);
    }

    if (isSimpleFilter(filter)) {
      return validateSimpleFilter(filter);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Validate Qdrant filter structure
 */
function validateQdrantFilter(filter: QdrantFilter): boolean {
  const validateConditions = (conditions: FilterCondition[]): boolean => {
    return conditions.every((condition) => {
      if (!condition.key) return false;

      const hasValidCondition = !!(
        condition.match ||
        condition.range ||
        condition.geo_bounding_box ||
        condition.geo_radius ||
        condition.values_count ||
        condition.is_empty ||
        condition.is_null ||
        condition.has_id
      );

      return hasValidCondition;
    });
  };

  if (filter.must && !validateConditions(filter.must)) return false;
  if (filter.should && !validateConditions(filter.should)) return false;
  if (filter.must_not && !validateConditions(filter.must_not)) return false;

  return true;
}

/**
 * Validate simple filter structure
 */
function validateSimpleFilter(filter: SimpleFilter): boolean {
  return Object.values(filter).every(
    (value) =>
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      (Array.isArray(value) &&
        (value as FilterValue[]).every(
          (v) =>
            typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null,
        )),
  );
}
