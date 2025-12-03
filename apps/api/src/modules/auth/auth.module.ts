import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonModule } from '../common/common.module';
import { MiscModule } from '../misc/misc.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GithubOauthStrategy } from './strategy/github-oauth.strategy';
import { GoogleOauthStrategy } from './strategy/google-oauth.strategy';
import { TwitterOauthStrategy } from './strategy/twitter-oauth.strategy';
import { NotionOauthStrategy } from './strategy/notion-oauth.strategy';
import { NotificationModule } from '../notification/notification.module';
import { GoogleToolOauthStrategy } from './strategy/google-tool-oauth.strategy';
import { CreditModule } from '../credit/credit.module';
@Module({
  imports: [
    CommonModule,
    MiscModule,
    NotificationModule,
    CreditModule,
    PassportModule.register({
      session: true,
    }),
    JwtModule.registerAsync({
      global: true,
      useFactory: async (configService: ConfigService) => ({
        // available options: https://github.com/auth0/node-jsonwebtoken#usage
        secret: configService.get('auth.jwt.secret'),
        signOptions:
          process.env.NODE_ENV === 'development'
            ? undefined // never expire in development
            : { expiresIn: configService.get('auth.jwt.expiresIn') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    GithubOauthStrategy,
    GoogleOauthStrategy,
    GoogleToolOauthStrategy,
    TwitterOauthStrategy,
    NotionOauthStrategy,
  ],
  exports: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
