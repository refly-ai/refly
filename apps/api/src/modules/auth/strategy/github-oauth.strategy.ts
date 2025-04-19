import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';

import { AuthService } from '../auth.service';

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
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    return this.authService.oauthValidate(accessToken, refreshToken, profile);
  }
}
