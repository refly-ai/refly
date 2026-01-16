/**
 * Builder session persistence with atomic writes
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { getBuilderDir, getCurrentSessionPath, getSessionPath } from '../config/paths.js';
import { BuilderSession, BuilderSessionSchema, BuilderState } from './schema.js';

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Create a new builder session
 */
export function createSession(name: string, description?: string): BuilderSession {
  const now = new Date().toISOString();
  const session: BuilderSession = {
    id: generateSessionId(),
    version: 1,
    state: BuilderState.DRAFT,
    createdAt: now,
    updatedAt: now,
    workflowDraft: {
      name,
      description,
      nodes: [],
    },
    validation: { ok: false, errors: [] },
  };

  return session;
}

/**
 * Save session to disk atomically
 */
export function saveSession(session: BuilderSession): void {
  const sessionPath = getSessionPath(session.id);
  const tempPath = path.join(getBuilderDir(), `.session-${session.id}-${Date.now()}.tmp`);

  // Update timestamp
  session.updatedAt = new Date().toISOString();

  // Validate before saving
  const validated = BuilderSessionSchema.parse(session);

  // Write to temp file first
  fs.writeFileSync(tempPath, JSON.stringify(validated, null, 2), {
    mode: 0o600,
  });

  // Atomic rename
  fs.renameSync(tempPath, sessionPath);
}

/**
 * Load session from disk
 */
export function loadSession(sessionId: string): BuilderSession | null {
  const sessionPath = getSessionPath(sessionId);

  try {
    if (!fs.existsSync(sessionPath)) {
      return null;
    }

    const content = fs.readFileSync(sessionPath, 'utf-8');
    const parsed = JSON.parse(content);
    return BuilderSessionSchema.parse(parsed);
  } catch {
    return null;
  }
}

/**
 * Delete session from disk
 */
export function deleteSession(sessionId: string): void {
  const sessionPath = getSessionPath(sessionId);

  try {
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
    }
  } catch {
    // Ignore deletion errors
  }
}

/**
 * Set current session pointer
 */
export function setCurrent(sessionId: string | null): void {
  const currentPath = getCurrentSessionPath();

  if (sessionId === null) {
    // Clear current pointer
    try {
      if (fs.existsSync(currentPath)) {
        fs.unlinkSync(currentPath);
      }
    } catch {
      // Ignore
    }
    return;
  }

  fs.writeFileSync(currentPath, sessionId, { mode: 0o600 });
}

/**
 * Get current session ID
 */
export function getCurrentSessionId(): string | null {
  const currentPath = getCurrentSessionPath();

  try {
    if (!fs.existsSync(currentPath)) {
      return null;
    }

    return fs.readFileSync(currentPath, 'utf-8').trim();
  } catch {
    return null;
  }
}

/**
 * Get current session (convenience function)
 */
export function getCurrentSession(): BuilderSession | null {
  const sessionId = getCurrentSessionId();
  if (!sessionId) return null;

  return loadSession(sessionId);
}

/**
 * List all sessions
 */
export function listSessions(): BuilderSession[] {
  const builderDir = getBuilderDir();

  try {
    const files = fs.readdirSync(builderDir);
    const sessions: BuilderSession[] = [];

    for (const file of files) {
      if (file.startsWith('session-') && file.endsWith('.json')) {
        const sessionId = file.replace('session-', '').replace('.json', '');
        const session = loadSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  } catch {
    return [];
  }
}
