import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from '../user/dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RequestVerificationCodeDto } from './dto/request-verification-code.dto';
import { EncryptionService } from '../../core/encryption/encryption.service';
import { Role } from '../../common/decorators/roles.decorator';
import { UserResponse } from '../user/types/user-response.types';
import { UserAccountState } from '../user/entities/user-account-state.enum';
import { EmailService } from '../../integrations/email/email.service';

/** Optional request metadata for login notification emails. */
export type LoginClientMeta = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private userService: UserService,
    private encryptionService: EncryptionService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  /**
   * Signup/agent signup persists OTP first; verification mail is best-effort so signup still returns 200 when
   * mail fails (logs `[email]`; user can hit resend). Forgot-password / resend-code still use `requireEmailSent`.
   */
  private async sendSignupVerificationMailBestEffort(
    email: string,
    name: string,
    otp: string,
    logContext: string,
    userId?: string,
  ): Promise<void> {
    try {
      await this.emailService.sendVerificationEmail(email, name, otp, 'signup', userId);
    } catch (err) {
      this.logger.error(
        `[email] ${logContext} failed for ${email}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  async signUp(createUserDto: CreateUserDto, role: Role = Role.Farmer): Promise<{ user: UserResponse } & { accessToken: string; expiresIn: string }> {
    const user = (await this.userService.create(createUserDto, role)) as UserResponse;
    const token = this.generateToken(user.id, user.role);
    if (role !== Role.Admin) {
      const otp = randomBytes(4).toString('hex').toUpperCase();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await this.userService.setEmailVerificationToken(user.id, otp, expiresAt);
      if (this.emailService.isConfigured()) {
        await this.sendSignupVerificationMailBestEffort(
          user.email,
          user.name,
          otp,
          'signup_verification',
          user.id,
        );
      }
    }
    return { user, ...token };
  }

  async signUpDoctor(createUserDto: CreateUserDto) {
    const user = (await this.userService.create(createUserDto, Role.Doctor)) as UserResponse;
    const token = this.generateToken(user.id, user.role);
    const otp = randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.userService.setEmailVerificationToken(user.id, otp, expiresAt);
    if (this.emailService.isConfigured()) {
      await this.sendSignupVerificationMailBestEffort(
        user.email,
        user.name,
        otp,
        'doctor_signup_verification',
        user.id,
      );
    }
    return { user, ...token };
  }

  async signUpAdmin(createUserDto: CreateUserDto) {
    return this.signUp(createUserDto, Role.Admin);
  }

  async signUpSlaughterhouse(createUserDto: CreateUserDto) {
    const user = (await this.userService.create(createUserDto, Role.Slaughterhouse)) as UserResponse;
    const token = this.generateToken(user.id, user.role);
    const otp = randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.userService.setEmailVerificationToken(user.id, otp, expiresAt);
    if (this.emailService.isConfigured()) {
      await this.sendSignupVerificationMailBestEffort(
        user.email,
        user.name,
        otp,
        'slaughterhouse_signup_verification',
        user.id,
      );
    }
    return { user, ...token };
  }

  async login(loginDto: LoginDto, clientMeta?: LoginClientMeta) {
    const user = await this.userService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await this.encryptionService.verify(
      user.passwordHash,
      loginDto.password,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accountState = user.userState ?? UserAccountState.Active;
    if (accountState === UserAccountState.Blocked) {
      throw new UnauthorizedException('This account has been blocked.');
    }
    if (accountState === UserAccountState.Suspended) {
      throw new UnauthorizedException('This account is suspended.');
    }
    if (!user.isEmailVerified && user.role !== Role.Admin) {
      throw new UnauthorizedException(
        'Please verify your email with the OTP sent to your inbox.',
      );
    }
    if (accountState === UserAccountState.Pending) {
      throw new UnauthorizedException(
        'Your account is pending approval. You will be notified when it is active.',
      );
    }
    const userResponse = this.userService.toUserResponse(user);
    const token = this.generateToken(userResponse.id, userResponse.role);
    if (this.emailService.isConfigured()) {
      const loggedInAtIso = new Date().toISOString();
      void this.emailService
        .sendLoginNotificationEmail(user.email, user.name, {
          loggedInAtIso,
          ip: clientMeta?.ip,
          userAgent: clientMeta?.userAgent,
        })
        .catch((err) => {
          this.logger.error(
            `[email] login_notification failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err.stack : undefined,
          );
        });
    }
    return { user: userResponse, ...token };
  }

  /** Veterinarian portal login — rejects non-doctor accounts (strict RBAC). */
  async loginDoctor(loginDto: LoginDto, clientMeta?: LoginClientMeta) {
    const result = await this.login(loginDto, clientMeta);
    if (result.user.role !== Role.Doctor) {
      throw new ForbiddenException('Only veterinarian accounts can sign in here');
    }
    return result;
  }

  async loginSlaughterhouse(loginDto: LoginDto, clientMeta?: LoginClientMeta) {
    const result = await this.login(loginDto, clientMeta);
    if (result.user.role !== Role.Slaughterhouse) {
      throw new ForbiddenException('Only slaughterhouse accounts can sign in here');
    }
    return result;
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; emailWarning?: string }> {
    const message = 'If the email exists, a reset link has been sent.';
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      return { message };
    }
    if (!this.emailService.isConfigured()) {
      this.logger.warn('[email] forgotPassword: email service is not configured');
      return { message, emailWarning: 'Email service is not configured on this server.' };
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.userService.setPasswordResetToken(String(user._id), token, expiresAt);
    try {
      await this.emailService.sendPasswordResetEmail(user.email, user.name, String(user._id), token);
    } catch (err) {
      this.logger.error(
        `[email] Password reset email failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      return { message, emailWarning: 'Reset token saved but the email could not be delivered. Please try again later.' };
    }
    return { message };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const legacy = dto.token?.trim();
    const uid = dto.uid?.trim();
    const reset = dto.reset?.trim();
    const hasPair = !!(uid && reset);
    const hasLegacy = !!legacy;

    if (!hasLegacy && !hasPair) {
      throw new BadRequestException(
        'Provide either token (legacy) or uid and reset from the reset link.',
      );
    }
    if (hasLegacy && hasPair) {
      throw new BadRequestException('Provide either token or uid and reset, not both.');
    }

    let user = hasLegacy
      ? await this.userService.findByResetToken(legacy!)
      : await this.userService.findByResetUrlParams(uid!, reset!);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    await this.userService.resetPassword(String(user._id), dto.newPassword);
    if (this.emailService.isConfigured()) {
      try {
        await this.emailService.sendPasswordChangedEmail(user.email, user.name);
      } catch (err) {
        this.logger.error(
          `[email] password_changed_notify failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }
    return { message: 'Password has been reset successfully' };
  }

  async cancelSignup(uid: string, token: string): Promise<{ message: string }> {
    await this.userService.deleteUnverifiedUser(uid, token);
    return { message: 'Account has been deleted successfully.' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const user = await this.userService.findByEmailAndVerificationOtp(
      dto.email,
      dto.otp,
    );
    if (!user) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    await this.userService.markEmailVerified(String(user._id));
    return { message: 'Email verified successfully' };
  }

  async requestVerificationCode(dto: RequestVerificationCodeDto): Promise<{ message: string; emailWarning?: string }> {
    const message = 'If the email exists, a verification code has been sent.';
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      return { message };
    }
    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }
    if (!this.emailService.isConfigured()) {
      this.logger.warn('[email] requestVerificationCode: email service is not configured');
      return { message, emailWarning: 'Email service is not configured on this server.' };
    }
    const otp = randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.userService.setEmailVerificationToken(String(user._id), otp, expiresAt);
    try {
      await this.emailService.sendVerificationEmail(user.email, user.name, otp, 'repeat');
    } catch (err) {
      this.logger.error(
        `[email] Verification code email failed for ${dto.email}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      return { message, emailWarning: 'Verification code saved but the email could not be delivered. Please try again later.' };
    }
    return { message };
  }

  private generateToken(userId: string, role: string) {
    const payload = { sub: userId, role };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    };
  }
}
