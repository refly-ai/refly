/**
 * Builder state machine - manages state transitions
 */

import { BuilderSession, BuilderState, BuilderStateType } from './schema.js';
import { saveSession } from './store.js';
import { BuilderError } from '../utils/errors.js';
import { ErrorCodes } from '../utils/output.js';

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<BuilderStateType, BuilderStateType[]> = {
  [BuilderState.IDLE]: [BuilderState.DRAFT],
  [BuilderState.DRAFT]: [BuilderState.VALIDATED, BuilderState.ABORTED],
  [BuilderState.VALIDATED]: [BuilderState.DRAFT, BuilderState.COMMITTED, BuilderState.ABORTED],
  [BuilderState.COMMITTED]: [], // Terminal state
  [BuilderState.ABORTED]: [], // Terminal state
};

/**
 * Check if a state transition is valid
 */
export function canTransition(from: BuilderStateType, to: BuilderStateType): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Transition session to a new state
 */
export function transitionTo(session: BuilderSession, newState: BuilderStateType): void {
  if (!canTransition(session.state, newState)) {
    throw new BuilderError(
      ErrorCodes.INVALID_STATE,
      `Cannot transition from ${session.state} to ${newState}`,
      { currentState: session.state, targetState: newState },
      `Current state is ${session.state}`,
    );
  }

  session.state = newState;
  saveSession(session);
}

/**
 * Check if session is editable
 */
export function isEditable(session: BuilderSession): boolean {
  return session.state === BuilderState.DRAFT || session.state === BuilderState.VALIDATED;
}

/**
 * Check if session can be validated
 */
export function canValidate(session: BuilderSession): boolean {
  return session.state === BuilderState.DRAFT;
}

/**
 * Check if session can be committed
 */
export function canCommit(session: BuilderSession): boolean {
  return session.state === BuilderState.VALIDATED && session.validation.ok;
}

/**
 * Invalidate session (after any edit operation)
 * Transitions VALIDATED -> DRAFT
 */
export function invalidate(session: BuilderSession): void {
  if (session.state === BuilderState.VALIDATED) {
    session.state = BuilderState.DRAFT;
    session.validation = { ok: false, errors: [] };
  }
  // If already DRAFT, just clear validation
  if (session.state === BuilderState.DRAFT) {
    session.validation = { ok: false, errors: [] };
  }
  saveSession(session);
}

/**
 * Guard: ensure session is started
 */
export function requireStarted(session: BuilderSession | null): asserts session is BuilderSession {
  if (!session) {
    throw new BuilderError(
      ErrorCodes.BUILDER_NOT_STARTED,
      'No active builder session',
      undefined,
      'refly builder start --name "your-workflow"',
    );
  }
}

/**
 * Guard: ensure session is editable
 */
export function requireEditable(session: BuilderSession): void {
  requireStarted(session);

  if (!isEditable(session)) {
    throw new BuilderError(
      ErrorCodes.INVALID_STATE,
      `Session is ${session.state} and cannot be edited`,
      { state: session.state },
      session.state === BuilderState.COMMITTED
        ? 'Start a new session with `refly builder start`'
        : 'Abort and start a new session',
    );
  }
}

/**
 * Guard: ensure session can be validated
 */
export function requireValidatable(session: BuilderSession): void {
  requireStarted(session);

  if (session.state === BuilderState.VALIDATED) {
    // Already validated, OK to re-validate
    return;
  }

  if (session.state !== BuilderState.DRAFT) {
    throw new BuilderError(
      ErrorCodes.INVALID_STATE,
      `Session is ${session.state} and cannot be validated`,
      { state: session.state },
    );
  }
}

/**
 * Guard: ensure session can be committed
 */
export function requireCommittable(session: BuilderSession): void {
  requireStarted(session);

  if (session.state !== BuilderState.VALIDATED) {
    throw new BuilderError(
      ErrorCodes.VALIDATION_REQUIRED,
      'Session must be validated before commit',
      { state: session.state },
      'refly builder validate',
    );
  }

  if (!session.validation.ok) {
    throw new BuilderError(
      ErrorCodes.VALIDATION_ERROR,
      'Validation has errors',
      { errors: session.validation.errors },
      'Fix validation errors and run `refly builder validate` again',
    );
  }
}
