import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OAuthError } from '@refly-packages/errors';

@Injectable()
export class GithubOauthGuard extends AuthGuard('github') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new OAuthError(); // This will be properly handled by global exception filter
    }
    return user;
  }
}
