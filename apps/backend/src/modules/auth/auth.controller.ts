import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { IamService } from '../iam/iam.service';
import { AuthService } from './auth.service';
import type { AuthenticatedActor } from './auth.types';
import {
  AuthSessionDto,
  AuthUserDto,
  RefreshTokenDto,
  RequestOtpDto,
  RequestOtpResponseDto,
  VerifyOtpDto,
} from './dto/auth.dto';

/** HTTP only. No domain logic lives here. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly iam: IamService,
  ) {}

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  // Per-IP ceiling on top of the per-phone limit in the service. Stops one
  // host from spraying codes at many different numbers.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a login code by SMS' })
  @ApiOkResponse({ type: RequestOtpResponseDto })
  async requestOtp(
    @Body() dto: RequestOtpDto,
    @Req() request: Request,
  ): Promise<RequestOtpResponseDto> {
    return this.authService.requestOtp(dto.phone, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
    });
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a login code for tokens' })
  @ApiOkResponse({ type: AuthSessionDto })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() request: Request): Promise<AuthSessionDto> {
    return this.authService.verifyOtp(dto.challengeId, dto.code, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token' })
  @ApiOkResponse({ type: AuthSessionDto })
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: Request): Promise<AuthSessionDto> {
    return this.authService.refresh(dto.refreshToken, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
    });
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End a session' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiOperation({ summary: 'Current user, memberships and roles' })
  @ApiOkResponse({ type: AuthUserDto })
  async me(@CurrentUser() actor: AuthenticatedActor): Promise<AuthUserDto> {
    const user = await this.iam.getUserForAuth(actor.userId);
    return this.authService.buildAuthUser(actor.userId, actor.phone, user?.fullName ?? null);
  }
}
