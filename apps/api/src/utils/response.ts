import { BaseResponseV2, ErrorDetail, SkillEvent } from '@refly/openapi-schema';
import { Response } from 'express';
import { FAILED_STATUS, SUCCESS_STATUS } from './const';

export const ERROR_DETAILS: Record<string, ErrorDetail> = {
  UNKNOWN: { code: '1000', message: 'An unknown error occurred. Please try again later.' },
  BAD_REQUEST: {
    code: '400',
    message:
      'The request could not be processed because it was malformed or missing required fields.',
  },
  UNAUTHORIZED: { code: '401', message: 'Authentication is required to complete this request.' },
  FORBIDDEN: { code: '403', message: 'You do not have permission to perform this action.' },
  NOT_FOUND: { code: '404', message: 'The requested resource could not be found.' },
  CONFLICT: {
    code: '409',
    message: 'The request conflicts with the current state of the resource.',
  },
  RATE_LIMIT_ERROR: {
    code: '429',
    message: 'Too many requests were made in a short period. Please slow down and try again later.',
  },
  INTERNAL_SERVER_ERROR: {
    code: '500',
    message: 'An unexpected server error occurred. Please try again later.',
  },
  SERVICE_UNAVAILABLE: {
    code: '503',
    message: 'The service is temporarily unavailable. Please try again later.',
  },
  PARAMS_ERROR: {
    code: '1001',
    message:
      'There was an error with the provided parameters. Please provide valid values and try again.',
  },
};

/**
 * Create a custom ErrorDetail object
 */
export function createCustomError(code: number, message: string): ErrorDetail {
  return {
    code: code.toString(),
    message,
  };
}

export const buildSuccessResponse = <T>(data?: T) => {
  return {
    success: true,
    data,
  };
};

export const writeSSEResponse = (res: Response, msg: SkillEvent) => {
  if (res) {
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  }
};

/**
 * Create a standardized response using BaseResponseV2 structure
 * Handles both success and error cases
 */
export const buildResponse = <T extends BaseResponseV2>(
  success: boolean,
  data?: Omit<T, 'status'>,
  errorMap?: ErrorDetail,
): BaseResponseV2 => {
  if (success && (!errorMap || Object.keys(errorMap).length === 0)) {
    return {
      status: SUCCESS_STATUS,
      data: data.data ?? null,
    };
  }

  const errorsArray = Object.entries(errorMap ?? {}).map(([code, message]) => ({
    code,
    message,
  }));

  console.log('error response', errorsArray);
  return {
    status: FAILED_STATUS,
    data: data.data ?? null,
    errors: errorsArray,
  };
};
