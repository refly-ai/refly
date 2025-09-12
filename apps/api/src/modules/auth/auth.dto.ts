import { Account, AuthType } from '@refly/openapi-schema';
import { Account as AccountPO } from '../../generated/client';

export interface TokenData {
  uid: string;
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
    scope: account.scope ? JSON.parse(account.scope) : [],
    providerAccountId: account.providerAccountId,
  };
};
