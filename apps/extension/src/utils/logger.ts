/**
 * Development logger that only outputs logs in development mode
 * This prevents console spam in production builds
 *
 * Features:
 * - Auto-detects development mode via multiple methods
 * - 10-click debug mode toggle (click sphere logo 10 times)
 * - Safe fallbacks for extension environment limitations
 *
 * Usage:
 * - logger.debug('message') - Only shows in debug mode
 * - logger.handleDebugClick() - Call from UI to enable/disable debug mode
 */

class DevLogger {
  // ===================================
  // PRIVATE PROPERTIES
  // ===================================
  private isDevelopment: boolean;

  // Debug click activation state
  private debugClickCount = 0;
  private lastClickTime = 0;
  private clickTimeout: NodeJS.Timeout | null = null;

  // ===================================
  // CONSTRUCTOR & INITIALIZATION
  // ===================================
  constructor() {
    this.isDevelopment = this.checkDevelopmentMode();
    this.initializeLogger();
    this.setupStorageListener();
  }

  private initializeLogger() {
    // Only show initialization log when debug mode is enabled
    if (this.isDevelopment) {
      console.log('🔧 [Refly Logger] Debug mode: ON ✅');
    }
  }

  private setupStorageListener() {
    // Listen for storage changes to update debug mode dynamically
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'reflydebug') {
          const wasEnabled = this.isDevelopment;
          this.isDevelopment = this.checkDevelopmentMode();

          // Only log when debug mode is enabled (either before or after change)
          if (wasEnabled || this.isDevelopment) {
            console.log(`🔧 [Refly Logger] Debug mode: ${this.isDevelopment ? 'ON ✅' : 'OFF ❌'}`);
          }
        }
      });
    }
  }

  // ===================================
  // PUBLIC LOGGING METHODS
  // ===================================
  log(...args: any[]) {
    if (this.isDevelopment) {
      console.log(...args);
    }
  }

  debug(...args: any[]) {
    if (this.isDevelopment) {
      console.log(...args);
    }
  }

  info(...args: any[]) {
    if (this.isDevelopment) {
      console.info(...args);
    }
  }

  warn(...args: any[]) {
    if (this.isDevelopment) {
      console.warn(...args);
    }
  }

  error(...args: any[]) {
    if (this.isDevelopment) {
      console.error(...args);
    }
  }

  // ===================================
  // PUBLIC DEBUG STATE MANAGEMENT
  // ===================================
  refreshDebugState() {
    this.isDevelopment = this.checkDevelopmentMode();
    return this.isDevelopment;
  }

  test() {
    // Always show test output since it's explicitly called
    console.log(`🔧 [Refly Logger] Debug mode: ${this.isDevelopment ? 'ON ✅' : 'OFF ❌'}`);
    return this.isDevelopment;
  }

  // ===================================
  // DEBUG CLICK ACTIVATION (10 CLICKS)
  // ===================================
  handleDebugClick(showMessage?: (content: string, type?: 'info' | 'success') => void) {
    this.updateClickCount();
    this.resetClickCounterAfterDelay();

    if (this.shouldShowHints()) {
      this.showActivationHints(showMessage);
    } else if (this.shouldToggleDebugMode()) {
      this.toggleDebugMode(showMessage);
    }

    return this.debugClickCount;
  }

  private updateClickCount() {
    const now = Date.now();
    const timeSinceLastClick = now - this.lastClickTime;

    // Reset counter if more than 3 seconds between clicks
    if (timeSinceLastClick > 3000) {
      this.debugClickCount = 1;
    } else {
      this.debugClickCount += 1;
    }

    this.lastClickTime = now;
  }

  private resetClickCounterAfterDelay() {
    // Clear existing timeout
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout);
    }

    // Reset counter after 5 seconds of inactivity
    this.clickTimeout = setTimeout(() => {
      this.debugClickCount = 0;
    }, 5000);
  }

  private shouldShowHints(): boolean {
    return this.debugClickCount === 8 || this.debugClickCount === 9;
  }

  private shouldToggleDebugMode(): boolean {
    return this.debugClickCount >= 10;
  }

  private showActivationHints(showMessage?: (content: string, type?: 'info' | 'success') => void) {
    const remainingClicks = 10 - this.debugClickCount;
    showMessage?.(
      `🔧 Debug mode activation: ${remainingClicks} more click${remainingClicks > 1 ? 's' : ''} needed`,
      'info',
    );
  }

  private toggleDebugMode(showMessage?: (content: string, type?: 'info' | 'success') => void) {
    const isCurrentlyEnabled = this.refreshDebugState();

    if (isCurrentlyEnabled) {
      this.deactivateDebugMode(showMessage);
    } else {
      this.activateDebugMode(showMessage);
    }

    this.debugClickCount = 0;
  }

  private activateDebugMode(showMessage?: (content: string, type?: 'info' | 'success') => void) {
    try {
      localStorage.setItem('reflydebug', 'true');
      this.refreshDebugState();
      showMessage?.('🎉 Debug mode activated! Check console for logs.', 'success');
    } catch (_e) {
      // Fallback method for turning on
      document.documentElement.setAttribute('data-refly-debug', 'true');
      this.refreshDebugState();
      showMessage?.(
        '🎉 Debug mode activated (fallback method)! Check console for logs.',
        'success',
      );
    }
  }

  private deactivateDebugMode(showMessage?: (content: string, type?: 'info' | 'success') => void) {
    try {
      localStorage.removeItem('reflydebug');
      document.documentElement.removeAttribute('data-refly-debug');
      this.refreshDebugState();
      showMessage?.('🔴 Debug mode deactivated! Console logs disabled.', 'success');
    } catch (_e) {
      // Fallback method for turning off
      document.documentElement.removeAttribute('data-refly-debug');
      this.refreshDebugState();
      showMessage?.(
        '🔴 Debug mode deactivated (fallback method)! Console logs disabled.',
        'success',
      );
    }
  }

  // ===================================
  // PRIVATE DEBUG MODE DETECTION
  // ===================================
  private checkDevelopmentMode(): boolean {
    try {
      return (
        this.checkLocalStorageFlag() ||
        this.checkDocumentAttribute() ||
        this.checkBuildEnvironment() ||
        this.checkProcessEnvironment() ||
        this.checkUrlParameter()
      );
    } catch (_e) {
      // If any check fails, default to production mode
      return false;
    }
  }

  private checkLocalStorageFlag(): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem('reflydebug') === 'true';
      }
    } catch (_storageError) {
      // Silent fallback to alternatives
    }
    return false;
  }

  private checkDocumentAttribute(): boolean {
    if (typeof document !== 'undefined' && document.documentElement) {
      return document.documentElement.getAttribute('data-refly-debug') === 'true';
    }
    return false;
  }

  private checkBuildEnvironment(): boolean {
    // @ts-ignore - Vite replaces this at build time
    return typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;
  }

  private checkProcessEnvironment(): boolean {
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
  }

  private checkUrlParameter(): boolean {
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('refly_debug') === 'true';
    }
    return false;
  }
}

// ===================================
// EXPORT SINGLETON INSTANCE
// ===================================
export const logger = new DevLogger();
