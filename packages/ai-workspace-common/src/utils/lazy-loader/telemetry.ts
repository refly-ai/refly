/**
 * Telemetry integration for lazy loader
 * Reports module loading success/failure events
 */

import { logEvent } from '@refly/telemetry-web';
import type { TelemetryEventData } from './types';

const EVENT_NAME_LOAD = 'lazy_module_load';
const EVENT_NAME_ERROR = 'lazy_module_error';

/**
 * Report successful module load
 */
export function reportLoadSuccess(data: TelemetryEventData): void {
  try {
    logEvent(EVENT_NAME_LOAD, data.loadTime, {
      module_name: data.moduleName,
      success: true,
      from_cache: data.fromCache,
      load_time_ms: data.loadTime,
    });
  } catch (e) {
    // Silent failure - don't affect main flow
    console.debug('[lazy-loader] telemetry error:', e);
  }
}

/**
 * Report module load failure
 */
export function reportLoadError(data: TelemetryEventData): void {
  try {
    logEvent(EVENT_NAME_ERROR, data.loadTime, {
      module_name: data.moduleName,
      success: false,
      from_cache: data.fromCache,
      load_time_ms: data.loadTime,
      error_message: data.errorMessage,
      error_stack: data.errorStack?.slice(0, 500), // Limit stack trace length
    });
  } catch (e) {
    console.debug('[lazy-loader] telemetry error:', e);
  }
}
