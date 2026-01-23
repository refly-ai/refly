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

  const includeStack = process.env.EXPOSE_ERROR_STACK === 'true';

  return {
    success: false,
    errCode: err.code,
    errMsg: err.messageDict?.en,
    traceId: activeSpan?.spanContext().traceId,
    stack: includeStack ? exception.stack : undefined,
  };
};
