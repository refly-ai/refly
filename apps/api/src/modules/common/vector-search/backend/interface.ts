export type VectorPoint = {
  id: string;
  vector: number[];
  payload: Record<string, any>;
};

export type VectorSearchRequest = {
  query?: string;
  vector?: number[];
  limit?: number;
};

export type VectorSearchResult = {
  id: string;
  score: number;
  payload: Record<string, any>;
};

// Refined VectorFilter type for compatibility with both Qdrant and LanceDB
export type VectorFilter =
  | QdrantFilter
  | LanceDBFilter
  | SimpleFilter
  | string
  | Record<string, any>;

// Qdrant-style structured filter
export interface QdrantFilter {
  must?: FilterCondition[];
  should?: FilterCondition[];
  must_not?: FilterCondition[];
}

// LanceDB-style SQL string filter
export type LanceDBFilter = string;

// Simple key-value filter for basic use cases
export type SimpleFilter = Record<string, FilterValue>;

// Filter condition for Qdrant-style filters
export interface FilterCondition {
  key: string;
  match?: MatchCondition;
  range?: RangeCondition;
  geo_bounding_box?: GeoBoundingBoxCondition;
  geo_radius?: GeoRadiusCondition;
  values_count?: ValuesCountCondition;
  is_empty?: IsEmptyCondition;
  is_null?: IsNullCondition;
  has_id?: HasIdCondition;
}

// Match conditions
export interface MatchCondition {
  value?: FilterValue;
  any?: FilterValue[];
  except?: FilterValue[];
  text?: string;
}

// Range conditions
export interface RangeCondition {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
}

// Geo conditions
export interface GeoBoundingBoxCondition {
  top_left: GeoPoint;
  bottom_right: GeoPoint;
}

export interface GeoRadiusCondition {
  center: GeoPoint;
  radius: number;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

// Other conditions
export interface ValuesCountCondition {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
}

export interface IsEmptyCondition {
  key: string;
}

export interface IsNullCondition {
  key: string;
}

export interface HasIdCondition {
  has_id: string[];
}

// Supported filter values
export type FilterValue = string | number | boolean | null;

export type VectorScrollRequest = {
  filter?: VectorFilter;
  limit?: number;
  offset?: string | null;
  with_payload?: boolean;
  with_vector?: boolean;
};

/**
 * Vector search backend interface
 */
export interface VectorSearchBackend {
  /**
   * Initialize the vector search backend
   */
  initialize(): Promise<void>;

  /**
   * Check if the collection is empty
   * @returns true if the collection is empty or doesn't exist
   */
  isCollectionEmpty(): Promise<boolean>;

  /**
   * Batch save vector points
   * @param points Array of vector points to save
   * @returns Result of the batch save operation
   */
  batchSaveData(points: VectorPoint[]): Promise<any>;

  /**
   * Batch delete vector points based on filter
   * @param filter Filter to identify which points to delete
   * @returns Result of the batch delete operation
   */
  batchDelete(filter: VectorFilter): Promise<any>;

  /**
   * Search for similar vectors
   * @param request Search request parameters
   * @param filter Filter to apply to the search
   * @returns Array of search results
   */
  search(request: VectorSearchRequest, filter: VectorFilter): Promise<VectorSearchResult[]>;

  /**
   * Scroll through vector points
   * @param request Scroll request parameters
   * @returns Array of vector points
   */
  scroll(request: VectorScrollRequest): Promise<VectorPoint[]>;

  /**
   * Update payload for points matching the filter
   * @param filter Filter to identify which points to update
   * @param payload New payload or partial payload to apply
   * @returns Result of the update operation
   */
  updatePayload(filter: VectorFilter, payload: Record<string, any>): Promise<any>;

  /**
   * Estimate the size of points in bytes
   * @param points Array of vector points
   * @returns Estimated size in bytes
   */
  estimatePointsSize(points: VectorPoint[]): number;
}
