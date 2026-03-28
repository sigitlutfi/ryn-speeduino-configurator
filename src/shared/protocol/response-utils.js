/**
 * Response Validation Utilities
 *
 * Helper functions for checking response status codes and
 * generating user-friendly error messages.
 */

import { ResponseStatus } from './response-parser.js';

/**
 * Check if response indicates success
 */
export function isOK(response) {
  return response && response.status === ResponseStatus.OK;
}

/**
 * Check if burn operation succeeded
 */
export function isBurnOK(response) {
  return response && response.status === ResponseStatus.BURN_OK;
}

/**
 * Check if response is an error
 */
export function isError(response) {
  return response && response.status >= 0x80;
}

/**
 * Check if ECU is busy (can retry)
 */
export function isBusy(response) {
  return response && response.status === ResponseStatus.BUSY_ERR;
}

/**
 * Check if error is retryable
 */
export function isRetryable(response) {
  return isBusy(response) || response.status === ResponseStatus.TIMEOUT;
}

/**
 * Get user-friendly error message for status code
 * @param {number} statusCode - Response status code
 * @param {string} context - Context (e.g., "write", "read", "burn")
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(statusCode, context = 'operation') {
  const errorMap = {
    [ResponseStatus.TIMEOUT]: {
      message: 'ECU did not respond in time',
      suggestion: 'Check cable connection and try again',
    },
    [ResponseStatus.CRC_ERR]: {
      message: 'Data corruption detected',
      suggestion: 'Cable noise or interference. Try again',
    },
    [ResponseStatus.UNKNOWN_ERR]: {
      message: 'ECU did not recognize command',
      suggestion: 'Firmware version may be incompatible',
    },
    [ResponseStatus.RANGE_ERR]: {
      message: 'Value out of valid range',
      suggestion: 'Check the data being written',
    },
    [ResponseStatus.BUSY_ERR]: {
      message: 'ECU is busy processing',
      suggestion: 'Wait a moment and retry',
    },
  };

  const error = errorMap[statusCode];
  if (error) {
    return `${error.message}. ${error.suggestion}`;
  }

  return `Unknown error (0x${statusCode.toString(16).toUpperCase()}) during ${context}`;
}

/**
 * Get detailed error information
 * @param {number} statusCode - Response status code
 * @returns {object} Detailed error info
 */
export function getErrorDetails(statusCode) {
  const details = {
    [ResponseStatus.TIMEOUT]: {
      title: 'Timeout',
      severity: 'warning',
      retryable: true,
      technicalDetails: 'ECU did not respond within the timeout period (3-5 seconds)',
    },
    [ResponseStatus.CRC_ERR]: {
      title: 'CRC Error',
      severity: 'error',
      retryable: true,
      technicalDetails: 'Cyclic Redundancy Check failed - data was corrupted in transit',
    },
    [ResponseStatus.UNKNOWN_ERR]: {
      title: 'Unknown Command',
      severity: 'error',
      retryable: false,
      technicalDetails: 'ECU firmware does not support this command or protocol version',
    },
    [ResponseStatus.RANGE_ERR]: {
      title: 'Range Error',
      severity: 'error',
      retryable: false,
      technicalDetails: 'Page offset/length exceeds available memory or value is out of bounds',
    },
    [ResponseStatus.BUSY_ERR]: {
      title: 'ECU Busy',
      severity: 'warning',
      retryable: true,
      technicalDetails: 'ECU is currently processing another operation',
    },
  };

  return details[statusCode] || {
    title: 'Unknown Error',
    severity: 'error',
    retryable: false,
    technicalDetails: `Unrecognized status code: 0x${statusCode.toString(16).toUpperCase()}`,
  };
}

/**
 * Format response for logging
 */
export function formatResponseLog(response, commandName = 'Command') {
  if (isOK(response) || isBurnOK(response)) {
    return `[${commandName}] Success (status: 0x${response.status.toString(16).toUpperCase()}, data: ${response.data.length} bytes)`;
  }

  const details = getErrorDetails(response.status);
  return `[${commandName}] ${details.title} - ${details.technicalDetails}`;
}

/**
 * Validate response and throw descriptive error if needed
 */
export function validateResponse(response, commandName = 'Command') {
  if (isOK(response) || isBurnOK(response)) {
    return response;
  }

  const message = getErrorMessage(response.status, commandName);
  const error = new Error(message);
  error.statusCode = response.status;
  error.details = getErrorDetails(response.status);
  throw error;
}
