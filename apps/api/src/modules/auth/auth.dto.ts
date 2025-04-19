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
