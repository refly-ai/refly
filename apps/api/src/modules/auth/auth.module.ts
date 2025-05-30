import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { CommonModule } from '../common/common.module';
import { MiscModule } from '../misc/misc.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthProcessor } from './auth.processor';
import { AuthController } from './auth.controller';
import { GithubOauthStrategy } from './strategy/github-oauth.strategy';
import { GoogleOauthStrategy } from './strategy/google-oauth.strategy';

import { QUEUE_SEND_VERIFICATION_EMAIL } from '../../utils/const';
import { ProviderModule } from '../provider/provider.module';
import { isDesktop } from '../../utils/runtime';

@Module({
  imports: [
    CommonModule,
    MiscModule,
    ProviderModule,
    PassportModule.register({
      session: true,
    }),
    ...(isDesktop() ? [] : [BullModule.registerQueue({ name: QUEUE_SEND_VERIFICATION_EMAIL })]),
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
    ...(isDesktop() ? [] : [AuthProcessor]),
    GithubOauthStrategy,
    GoogleOauthStrategy,
  ],
  exports: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
