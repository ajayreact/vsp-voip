import { useEffect } from 'react';
import { ErrorUtils } from 'react-native';
import { logger } from './logger';

/** Captures fatal JS errors for telemetry without exposing stacks to users. */
export function useProductionErrorHandlers() {
  useEffect(() => {
    const previous = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      logger.error('uncaught', error.message);
      logger.telemetry('uncaught_handler', { message: error.message, fatal: isFatal });
      previous?.(error, isFatal);
    });
    return () => {
      ErrorUtils.setGlobalHandler(previous);
    };
  }, []);
}
