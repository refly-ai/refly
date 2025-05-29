import { Runtime } from 'wxt/browser';
import { TASK_STATUS, SkillEvent } from '@refly/common-types';
import { getCookie } from '@/utils/cookie';
import { ssePost } from '@refly-packages/ai-workspace-common/utils/sse-post';
import { getAbortController, getLastUniqueId, setAbortController, setLastUniqueId } from '../index';
import { logger } from '../../../utils/logger';

export const handleStreamingChat = async (
  req: { body: any; uniqueId: string },
  res: { send: (response?: any) => void },
) => {
  const { type, payload } = req?.body || {};
  const { uniqueId } = req;
  logger.debug('receive request', req.body);
  setLastUniqueId(uniqueId);

  try {
    if (type === TASK_STATUS.START) {
      // 确保上一次是 aborted 了
      const previousController = getAbortController(uniqueId);
      if (previousController) {
        previousController.abort();
      }

      const abortController = setAbortController(new AbortController(), uniqueId);

      // TODO: 这里未来要优化
      const cookie = (await getCookie()) as string;
      ssePost({
        controller: abortController,
        payload,
        token: cookie,
        onStart: () => {
          res.send({
            type: 'start',
          });
        },
        onSkillStart: (skillEvent: SkillEvent) => {
          res.send({
            type: 'skill-start',
            message: skillEvent,
          });
        },
        onSkillStream: (skillEvent: SkillEvent) => {
          res.send({
            type: 'skill-stream',
            message: skillEvent,
          });
        },
        onSkillThoughout: (skillEvent: SkillEvent) => {
          res.send({
            type: 'skill-thought',
            message: skillEvent,
          });
        },
        onSkillStructedData: (skillEvent: SkillEvent) => {
          res.send({
            type: 'skill-structuredData',
            message: skillEvent,
          });
        },
        onSkillEnd: (skillEvent: SkillEvent) => {
          res.send({
            type: 'skill-end',
            message: skillEvent,
          });
        },
        onCompleted: () => {
          res.send({
            type: 'completed',
          });
        },
        onError: () => {
          res.send({
            type: 'error',
          });
        },
      });

      logger.debug('after abortController', abortController);
    } else if (type === TASK_STATUS.SHUTDOWN) {
      const abortController = getAbortController(uniqueId);

      if (abortController) {
        abortController?.abort?.();
      }
    }
  } catch (err) {
    logger.error('streaming chat error', err);
    try {
      const abortController = getAbortController(uniqueId);
      if (!abortController?.signal?.aborted) {
        abortController?.abort?.();
      }
    } catch (err) {
      logger.error('abort controller cleanup error', err);
    }
  }
};

export const onPort = async (port: Runtime.Port) => {
  port.onMessage.addListener(async (message: any, comingPort: Runtime.Port) => {
    logger.debug('onPort', message, comingPort);
    if (comingPort.name === 'streaming-chat') {
      return handleStreamingChat(message, {
        send: async (msg: any) => {
          port?.postMessage(msg);
        },
      });
    }
  });

  port.onDisconnect.addListener(() => {
    // clear abortController
    const abortController = getAbortController(getLastUniqueId());
    try {
      abortController?.abort?.();
    } catch (err) {
      logger.error('port disconnect cleanup error', err);
    }
  });
};
