import { Account, AuthType } from '@refly/openapi-schema';
import { Account as AccountPO } from '@prisma/client';
import { safeParseJSON } from '@refly/utils';

export interface TokenData {
  uid: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

export interface SendVerificationEmailJobData {
  sessionId: string;
}

export class JwtPayload {
  uid: string;
  email: string;
}

export const accountPO2DTO = (account: AccountPO): Account => {
  return {
    type: account.type as AuthType,
    provider: account.provider,
    scope: account.scope ? safeParseJSON(account.scope) : [],
    providerAccountId: account.providerAccountId,
  };
};
