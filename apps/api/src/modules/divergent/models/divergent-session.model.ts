/**
 * Status types for divergent sessions
 */
export type DivergentSessionStatus = 'executing' | 'completed' | 'failed' | 'max_depth_reached';

/**
 * Data model for divergent session tracking
 * This represents a session of the total-divide-total loop execution
 */
export interface DivergentSessionData {
  /** Unique session identifier */
  sessionId: string;

  /** User ID who initiated the session */
  uid: string;

  /** Original user intent/query */
  userIntent: string;

  /** ID of the root summary result */
  rootResultId: string;

  /** Current level in the total-divide-total loop (0-5) */
  currentLevel: number;

  /** Global completion score for the entire session (0-1) */
  globalCompletionScore: number;

  /** Current status of the session */
  status: DivergentSessionStatus;

  /** Optional ID of the final output result */
  finalOutputResultId?: string;

  /** Target Canvas ID where results are generated */
  targetId: string;

  /** Session creation timestamp */
  createdAt: Date;

  /** Session last update timestamp */
  updatedAt: Date;
}

/**
 * Input data for creating a new divergent session
 */
export interface CreateDivergentSessionInput {
  /** User ID */
  uid: string;

  /** User's original intent */
  userIntent: string;

  /** Root summary result ID */
  rootResultId: string;

  /** Target Canvas ID */
  targetId: string;
}

/**
 * Input data for updating an existing divergent session
 */
export interface UpdateDivergentSessionInput {
  /** New current level */
  currentLevel?: number;

  /** New global completion score */
  globalCompletionScore?: number;

  /** New status */
  status?: DivergentSessionStatus;

  /** Final output result ID */
  finalOutputResultId?: string;
}

/**
 * Type guard to check if an object is a valid DivergentSessionData
 */
export function isDivergentSessionData(data: any): data is DivergentSessionData {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.sessionId === 'string' &&
    typeof data.uid === 'string' &&
    typeof data.userIntent === 'string' &&
    typeof data.rootResultId === 'string' &&
    typeof data.currentLevel === 'number' &&
    data.currentLevel >= 0 &&
    data.currentLevel <= 5 &&
    typeof data.globalCompletionScore === 'number' &&
    data.globalCompletionScore >= 0 &&
    data.globalCompletionScore <= 1 &&
    typeof data.status === 'string' &&
    ['executing', 'completed', 'failed'].includes(data.status) &&
    typeof data.targetId === 'string' &&
    data.createdAt instanceof Date &&
    data.updatedAt instanceof Date
  );
}
