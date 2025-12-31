/**
 * Cross-tab authentication state sync channel
 *
 * Uses BroadcastChannel API to sync auth events across browser tabs.
 * When one tab logs out or switches user, other tabs will be notified.
 *
 * Compatibility: Safari 15.4+, Chrome 54+, Firefox 38+
 * Fallback: localStorage storage event
 */

export type AuthEvent =
  | { type: 'logout' }
  | { type: 'user-changed'; uid: string }
  | { type: 'login'; uid: string };

type AuthEventHandler = (event: AuthEvent) => void;

const CHANNEL_NAME = 'refly-auth-channel';
const STORAGE_KEY = 'refly-auth-event';
const UID_COOKIE = 'uid';

class AuthChannel {
  private channel: BroadcastChannel | null = null;
  private handlers: Set<AuthEventHandler> = new Set();
  private currentUid: string | null = null;
  private isInitialized = false;

  constructor() {
    // Lazy initialization to avoid SSR errors
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Check BroadcastChannel support
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<AuthEvent>) => {
          this.notifyHandlers(event.data);
        };
      } catch {
        // BroadcastChannel creation failed, use fallback
        this.setupStorageFallback();
      }
    } else {
      // Fallback: use localStorage storage event
      this.setupStorageFallback();
    }

    // Record current user uid
    this.currentUid = this.getUidFromCookie();
  }

  private setupStorageFallback() {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const data = JSON.parse(event.newValue) as AuthEvent & { timestamp?: number };
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { timestamp, ...eventData } = data;
          this.notifyHandlers(eventData as AuthEvent);
        } catch {
          // JSON parse failed, ignore
        }
      }
    });
  }

  private notifyHandlers(event: AuthEvent) {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[AuthChannel] Handler error:', error);
      }
    }
  }

  /**
   * Broadcast auth event to other tabs
   */
  broadcast(event: AuthEvent) {
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.init();
    }

    if (this.channel) {
      this.channel.postMessage(event);
    } else if (typeof localStorage !== 'undefined') {
      // Fallback: localStorage (storage event only fires in other tabs)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...event, timestamp: Date.now() }));
      } catch {
        // localStorage unavailable, ignore
      }
    }
  }

  /**
   * Subscribe to auth events
   * @returns Unsubscribe function
   */
  subscribe(handler: AuthEventHandler): () => void {
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.init();
    }

    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Get current user uid from cookie
   */
  getUidFromCookie(): string | null {
    if (typeof document === 'undefined') return null;

    const match = document.cookie.match(new RegExp(`${UID_COOKIE}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  /**
   * Validate if cookie uid matches the recorded uid
   * Used to detect if user has switched in another tab before making requests
   *
   * @returns true if identity matches, false if user switched or logged out
   */
  validateUserIdentity(): boolean {
    const cookieUid = this.getUidFromCookie();

    // User switched (both have uid but different)
    if (this.currentUid && cookieUid && this.currentUid !== cookieUid) {
      this.broadcast({ type: 'user-changed', uid: cookieUid });
      return false;
    }

    // User logged out (had uid before, now gone)
    if (this.currentUid && !cookieUid) {
      this.broadcast({ type: 'logout' });
      return false;
    }

    return true;
  }

  /**
   * Update recorded uid (call after successful login)
   */
  updateCurrentUid(uid: string | null) {
    this.currentUid = uid;
  }

  /**
   * Get current recorded uid
   */
  getCurrentUid(): string | null {
    return this.currentUid;
  }

  /**
   * Destroy channel (call on page unload)
   */
  destroy() {
    this.channel?.close();
    this.handlers.clear();
    this.isInitialized = false;
  }
}

// Singleton export
export const authChannel = new AuthChannel();
