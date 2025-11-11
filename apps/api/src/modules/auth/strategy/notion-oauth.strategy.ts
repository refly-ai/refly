import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, InternalOAuthError } from 'passport-oauth2';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { safeParseJSON } from '@refly/utils';

@Injectable()
export class NotionOauthStrategy extends PassportStrategy(Strategy, 'notion') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      authorizationURL: 'https://api.notion.com/v1/oauth/authorize',
      tokenURL: 'https://api.notion.com/v1/oauth/token',
      clientID: configService.get('auth.notion.clientId'),
      clientSecret: configService.get('auth.notion.clientSecret'),
      callbackURL: configService.get('auth.notion.callbackUrl'),
      scope: 'read_content update_content insert_content',
      passReqToCallback: true,
    });

    // Override the default token exchange method for Notion OAuth
    (this._oauth2 as any).getOAuthAccessToken = this.getOAuthAccessToken.bind(this);
  }

  /**
   * Custom token exchange method for Notion OAuth
   * Based on reference: https://stackoverflow.com/questions/67534080/notion-api-invalid-client-oauth-integration
   */
  private async getOAuthAccessToken(
    code: string,
    _params: any,
    callback: (err: any, accessToken?: string, refreshToken?: string, params?: any) => void,
  ) {
    const clientId = this.configService.get('auth.notion.clientId');
    const clientSecret = this.configService.get('auth.notion.clientSecret');
    const redirectUri = this.configService.get('auth.notion.callbackUrl');

    // Create Basic Auth header manually for Notion
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const postData = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    };

    const postHeaders = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return callback(
          new InternalOAuthError(
            `Failed to get access token: ${response.status} ${errorText}`,
            null,
          ),
        );
      }

      const result = await response.json();

      // Notion returns token data in a specific format
      callback(null, result.access_token, result.refresh_token, result);
    } catch (error) {
      callback(new InternalOAuthError(`Token exchange failed: ${error.message}`, error));
    }
  }

  async validate(req: Request, accessToken: string, refreshToken: string, params: any) {
    const scopes = ['read_content', 'update_content', 'insert_content']; // Scopes for account storage

    // Extract uid and redirect from state parameter (passed during initial OAuth request)
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

    // For Notion OAuth, we need to create a profile object from the token response
    // Notion OAuth returns workspace info in the token response
    const profile = {
      id: params.workspace_id || 'notion-user',
      displayName: params.workspace_name || 'Notion User',
      emails: [{ value: params.owner?.user?.person?.email || 'user@notion.so' }],
      provider: 'notion',
      _json: params,
    };

    return this.authService.oauthValidate(accessToken, refreshToken, profile, scopes, uid);
  }
}
