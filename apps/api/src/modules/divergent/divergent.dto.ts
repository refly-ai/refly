import { DivergentSessionData, DivergentSessionStatus } from './models/divergent-session.model';

/**
 * Request DTO for creating a new divergent session
 */
export interface CreateDivergentSessionRequest {
  /** User's original intent for the divergent session */
  userIntent: string;

  /** Root summary result ID from ActionResult */
  rootResultId: string;

  /** Target Canvas ID where results will be generated */
  targetId: string;
}

/**
 * Request DTO for updating an existing divergent session
 */
export interface UpdateDivergentSessionRequest {
  /** Session ID to update */
  sessionId: string;

  /** New current level */
  currentLevel?: number;

  /** New global completion score */
  globalCompletionScore?: number;

  /** New session status */
  status?: DivergentSessionStatus;

  /** Final output result ID (when session is completed) */
  finalOutputResultId?: string;
}

/**
 * Response DTO for divergent session operations
 */
export interface DivergentSessionResponse {
  /** The session data (null if operation failed) */
  session: DivergentSessionData | null;

  /** Whether the operation was successful */
  success: boolean;

  /** Human-readable message about the operation result */
  message: string;
}

/**
 * Convert Prisma DivergentSession object to DTO
 */
export function divergentSessionPO2DTO(session: any): DivergentSessionData {
  return {
    sessionId: session.sessionId,
    uid: session.uid,
    userIntent: session.userIntent,
    rootResultId: session.rootResultId,
    currentLevel: session.currentLevel,
    globalCompletionScore: session.globalCompletionScore,
    status: session.status as DivergentSessionStatus,
    finalOutputResultId: session.finalOutputResultId || undefined,
    targetId: session.targetId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
