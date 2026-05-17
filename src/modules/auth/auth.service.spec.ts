import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { EncryptionService } from '../../core/encryption/encryption.service';
import { EmailService } from '../../integrations/email/email.service';
import { Role } from '../../common/decorators/roles.decorator';
import { UserAccountState } from '../user/entities/user-account-state.enum';

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let encryptionService: EncryptionService;
  let emailService: EmailService;

  const mockUser = {
    id: 'userId123',
    name: 'Test User',
    email: 'test@example.com',
    role: Role.Farmer,
  };

  const mockUserDocument = {
    _id: { toString: () => 'userId123' },
    name: 'Test User',
    email: 'test@example.com',
    role: Role.Farmer,
    passwordHash: 'hashed',
    isEmailVerified: true,
    userState: 'active',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockUser),
            findByEmail: jest.fn(),
            findByResetToken: jest.fn(),
            findByResetUrlParams: jest.fn(),
            findByEmailAndVerificationOtp: jest.fn(),
            setPasswordResetToken: jest.fn(),
            setEmailVerificationToken: jest.fn(),
            resetPassword: jest.fn(),
            markEmailVerified: jest.fn(),
            deleteUnverifiedUser: jest.fn(),
            toUserResponse: jest.fn().mockReturnValue(mockUser),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            hash: jest.fn().mockResolvedValue('hashedPassword'),
            verify: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mockJwtToken') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'JWT_EXPIRES_IN' ? '7d' : undefined,
            ),
          },
        },
        {
          provide: EmailService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(true),
            sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
            sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined),
            sendLoginNotificationEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
    emailService = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    it('registers user and sets verification token', async () => {
      const dto = { name: 'Test', email: 'test@example.com', password: 'pass123' };
      const result = await service.signUp(dto);
      expect(result.accessToken).toBeDefined();
      expect(userService.create).toHaveBeenCalledWith(dto, Role.Farmer);
      expect(userService.setEmailVerificationToken).toHaveBeenCalled();
    });
  });

  describe('signUpDoctor', () => {
    it('registers doctor role', async () => {
      const dto = { name: 'Dr Vet', email: 'vet@example.com', password: 'pass123' };
      await service.signUpDoctor(dto);
      expect(userService.create).toHaveBeenCalledWith(dto, Role.Doctor);
    });
  });

  describe('login', () => {
    it('returns token for valid credentials', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUserDocument as never);
      const result = await service.login({
        email: 'test@example.com',
        password: 'correct',
      });
      expect(result.accessToken).toBeDefined();
    });

    it('throws for unverified email', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue({
        ...mockUserDocument,
        isEmailVerified: false,
      } as never);
      await expect(
        service.login({ email: 'test@example.com', password: 'correct' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('loginDoctor', () => {
    it('allows doctor role only', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue({
        ...mockUserDocument,
        role: Role.Doctor,
      } as never);
      jest.spyOn(userService, 'toUserResponse').mockReturnValue({
        ...mockUser,
        role: Role.Doctor,
        userState: UserAccountState.Active,
      });
      const result = await service.loginDoctor({
        email: 'vet@example.com',
        password: 'correct',
      });
      expect(result.user.role).toBe(Role.Doctor);
    });

    it('rejects non-doctor', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUserDocument as never);
      await expect(
        service.loginDoctor({ email: 'test@example.com', password: 'correct' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('forgotPassword', () => {
    it('returns message when user not found', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(null);
      const result = await service.forgotPassword({ email: 'x@example.com' });
      expect(result.message).toContain('If the email exists');
    });

    it('sets token when user exists', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUserDocument as never);
      await service.forgotPassword({ email: 'test@example.com' });
      expect(userService.setPasswordResetToken).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('marks email verified', async () => {
      jest
        .spyOn(userService, 'findByEmailAndVerificationOtp')
        .mockResolvedValue(mockUserDocument as never);
      const result = await service.verifyEmail({ email: 'test@example.com', otp: 'ABC' });
      expect(result.message).toContain('verified');
      expect(userService.markEmailVerified).toHaveBeenCalled();
    });

    it('throws for invalid OTP', async () => {
      jest.spyOn(userService, 'findByEmailAndVerificationOtp').mockResolvedValue(null);
      await expect(
        service.verifyEmail({ email: 'test@example.com', otp: 'bad' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
