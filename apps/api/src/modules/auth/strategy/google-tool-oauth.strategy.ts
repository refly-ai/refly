import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { safeParseJSON } from '@refly/utils';

@Injectable()
export class GoogleToolOauthStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleToolOauthStrategy.name);

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID:
        configService.get('tools.google.clientId') ?? configService.get('auth.google.clientId'),
      clientSecret:
        configService.get('tools.google.clientSecret') ??
        configService.get('auth.google.clientSecret'),
      callbackURL:
        configService.get('tools.google.callbackUrl') ??
        configService.get('auth.google.callbackUrl'),
      scope: ['profile', 'email'],
      accessType: 'offline',
      passReqToCallback: true,
    });

    this.logger.log('GoogleToolOauthStrategy initialized');
  }

  async validate(req: Request, accessToken: string, refreshToken: string, profile: Profile) {
    // Extract scope from query parameters
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
