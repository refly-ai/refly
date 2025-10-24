import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OAuthError } from '@refly/errors';

@Injectable()
export class NotionOauthGuard extends AuthGuard('notion') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new OAuthError(); // This will be properly handled by global exception filter
    }
    return user;
  }
}
