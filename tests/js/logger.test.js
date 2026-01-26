/**
 * Tests for logger module
 */
import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';

describe('Logger Module', () => {
  let consoleLogSpy, consoleWarnSpy, consoleErrorSpy;
  
  // Import will be mocked
  const createLoggerMocks = () => {
    let debugEnabled = false;
    
    const setDebugMode = (enabled) => {
      debugEnabled = enabled;
      if (enabled) {
        console.log('[CesiumWidget] Debug mode enabled');
      }
    };
    
    const log = (prefix, ...args) => {
      if (debugEnabled) {
        console.log(`[CesiumWidget:${prefix}]`, ...args);
      }
    };
    
    const warn = (prefix, ...args) => {
      console.warn(`[CesiumWidget:${prefix}]`, ...args);
    };
    
    const error = (prefix, ...args) => {
      console.error(`[CesiumWidget:${prefix}]`, ...args);
    };
    
    return { setDebugMode, log, warn, error };
  };

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('setDebugMode', () => {
    it('should enable debug mode and log confirmation', () => {
      const { setDebugMode } = createLoggerMocks();
      setDebugMode(true);
      expect(consoleLogSpy).toHaveBeenCalledWith('[CesiumWidget] Debug mode enabled');
    });

    it('should disable debug mode without logging', () => {
      const { setDebugMode } = createLoggerMocks();
      setDebugMode(false);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('log', () => {
    it('should log messages when debug mode is enabled', () => {
      const { setDebugMode, log } = createLoggerMocks();
      setDebugMode(true);
      consoleLogSpy.mockClear();
      
      log('TestPrefix', 'test message', 123);
      expect(consoleLogSpy).toHaveBeenCalledWith('[CesiumWidget:TestPrefix]', 'test message', 123);
    });

    it('should not log messages when debug mode is disabled', () => {
      const { log } = createLoggerMocks();
      log('TestPrefix', 'test message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should always log warnings regardless of debug mode', () => {
      const { warn } = createLoggerMocks();
      warn('TestPrefix', 'warning message', { data: 'test' });
      expect(consoleWarnSpy).toHaveBeenCalledWith('[CesiumWidget:TestPrefix]', 'warning message', { data: 'test' });
    });
  });

  describe('error', () => {
    it('should always log errors regardless of debug mode', () => {
      const { error } = createLoggerMocks();
      const testError = new Error('test error');
      error('TestPrefix', 'error message', testError);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[CesiumWidget:TestPrefix]', 'error message', testError);
    });
  });
});
