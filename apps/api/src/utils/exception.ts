import api from '@opentelemetry/api';
import { BaseError, UnknownError } from '@refly/errors';

export const genBaseRespDataFromError = (exception: any) => {
  let err: BaseError;

  // Log the error for unknown exception
  if (exception instanceof BaseError) {
    err = exception;
  } else {
    err = new UnknownError(exception);
  }

  const activeSpan = api.trace.getSpan(api.context.active());

  return {
    success: false,
    errCode: err.code,
    errMsg: err.messageDict?.en,
    traceId: activeSpan?.spanContext().traceId,
    stack: process.env.NODE_ENV === 'production' ? undefined : exception.stack,
  };
};
