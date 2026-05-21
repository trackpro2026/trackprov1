import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import { AuthService } from './auth.service';
import { buildAppCookieOptions, jwtCookieName } from '../../common/http/cookie-options';
import { CSRF_COOKIE_NAME, isCsrfEnabled } from '../../common/csrf/csrf.config';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from '../user/dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RequestVerificationCodeDto } from './dto/request-verification-code.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setAuthCookie(res: Response, accessToken: string) {
    res.cookie(jwtCookieName(this.configService), accessToken, {
      ...buildAppCookieOptions(this.configService),
    });
  }

  private clearAuthCookie(res: Response) {
    const name = jwtCookieName(this.configService);
    const { maxAge: _maxAge, ...opts } = buildAppCookieOptions(this.configService);
    res.clearCookie(name, opts);
  }

  @Public()
  @Post('signup')
  async signUp(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signUp(createUserDto);
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('signup/doctor')
  async signUpDoctor(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signUpDoctor(createUserDto);
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('signup/admin')
  async signUpAdmin(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signUpAdmin(createUserDto);
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('signup/slaughterhouse')
  @ApiOperation({ summary: 'Slaughterhouse operator registration' })
  async signUpSlaughterhouse(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signUpSlaughterhouse(createUserDto);
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto, {
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent') || undefined,
    });
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('login/doctor')
  async loginDoctor(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginDoctor(loginDto, {
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent') || undefined,
    });
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('login/slaughterhouse')
  @ApiOperation({ summary: 'Slaughterhouse operator login' })
  async loginSlaughterhouse(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginSlaughterhouse(loginDto, {
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent') || undefined,
    });
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Get('csrf')
  @ApiOperation({
    summary: 'Get CSRF token (web cookie sessions)',
    description:
      '**Web (cookie auth):** Call before login/signup when `CSRF_ENABLED=true`. ' +
      'Returns `csrfToken` and sets the `csrf_token` cookie. Send the same value in header `X-CSRF-Token` on mutating requests.\n\n' +
      '**Mobile:** Use `Authorization: Bearer <accessToken>` from login — CSRF is not required.',
  })
  getCsrf(@Res({ passthrough: true }) res: Response) {
    const token = randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE_NAME, token, {
      ...buildAppCookieOptions(this.configService, {
        maxAge: 60 * 60 * 1000,
        httpOnly: true,
      }),
    });
    return {
      csrfToken: token,
      csrfEnabled: isCsrfEnabled(),
      headerName: 'X-CSRF-Token',
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear auth cookie',
    description:
      'Clears the httpOnly JWT cookie (same name as JWT_COOKIE_NAME, default access_token). Call from the browser with credentials.',
  })
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookie(res);
    return { message: 'Logged out' };
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('request-verification-code')
  async requestVerificationCode(@Body() dto: RequestVerificationCodeDto) {
    return this.authService.requestVerificationCode(dto);
  }

  @Public()
  @Get('cancel-signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an unverified account (email link)',
    description:
      'Called directly from the verification email button. ' +
      'Deletes the account if it has never been verified. ' +
      'Returns an HTML page so the user sees a readable result in their browser.',
  })
  async cancelSignup(
    @Query('uid') uid: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://trackpro-web.vercel.app';
    try {
      await this.authService.cancelSignup(uid, token);
      return res.redirect(`${frontendUrl.replace(/\/$/, '')}/auth/signup?accountDeleted=1`);
    } catch {
      return res.redirect(`${frontendUrl.replace(/\/$/, '')}/auth/signup?cancelFailed=1`);
    }
  }
}
