import { SkillEvent } from '@refly/openapi-schema';
import { Response } from 'express';

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
