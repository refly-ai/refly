import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { safeParseJSON } from '@refly/utils';

@Injectable()
export class GithubOauthStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('auth.github.clientId'),
      clientSecret: configService.get('auth.github.clientSecret'),
      callbackURL: configService.get('auth.github.callbackUrl'),
      scope: ['read:user', 'user:email'],
      passReqToCallback: true,
    });
  }

  async validate(req: Request, accessToken: string, refreshToken: string, profile: Profile) {
    const scope = req?.query?.scope as string;
    const scopes = scope ? scope.split(' ') : [];

    // Extract uid from state
    let uid: string | undefined;
    const state = req?.query?.state as string;
    if (state) {
      try {
        const stateObj = safeParseJSON(state);
        uid = stateObj.uid;
      } catch {
        // Ignore parsing errors
      }
    }

    return this.authService.oauthValidate(accessToken, refreshToken, profile, scopes, uid);
  }
}
