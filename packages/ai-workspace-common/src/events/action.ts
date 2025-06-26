import mitt from 'mitt';
import { ActionResult } from '@refly/openapi-schema';

export type Events = {
  updateResult: {
    resultId: string;
    payload: ActionResult;
  };
  invokeActionEnd: {
    resultId: string;
  };
};

export const actionEmitter = mitt<Events>();
