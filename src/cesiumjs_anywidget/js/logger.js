/**
 * Logger Module
 * 
 * Provides centralized logging that can be enabled/disabled via the widget's debug_mode trait.
 */

let debugEnabled = false;

/**
 * Set the debug mode
 * @param {boolean} enabled - Whether debug logging is enabled
 */
export function setDebugMode(enabled) {
  debugEnabled = enabled;
  if (enabled) {
    console.log('[CesiumWidget] Debug mode enabled');
  }
}

/**
 * Check if debug mode is enabled
 * @returns {boolean} Whether debug logging is enabled
 */
export function isDebugEnabled() {
  return debugEnabled;
}

/**
 * Log a debug message (only if debug mode is enabled)
 * @param {string} prefix - The module prefix (e.g., 'ViewerInit', 'CameraSync')
 * @param  {...any} args - Arguments to log
 */
export function log(prefix, ...args) {
  if (debugEnabled) {
    console.log(`[CesiumWidget:${prefix}]`, ...args);
  }
}

/**
 * Log a warning message (always logged)
 * @param {string} prefix - The module prefix
 * @param  {...any} args - Arguments to log
 */
export function warn(prefix, ...args) {
  console.warn(`[CesiumWidget:${prefix}]`, ...args);
}

/**
 * Log an error message (always logged)
 * @param {string} prefix - The module prefix
 * @param  {...any} args - Arguments to log
 */
export function error(prefix, ...args) {
  console.error(`[CesiumWidget:${prefix}]`, ...args);
}
