import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LoginDto } from "./dto/login.dto";
import * as bcrypt from "bcryptjs";
import * as speakeasy from "speakeasy";

type AttemptState = {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
};

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const ENABLE_LOCKOUT = false;

@Injectable()
export class AuthService {
  private attempts = new Map<string, AttemptState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto, ip = "unknown") {
    const identifier = dto.identifier.trim().toLowerCase();
    if (!identifier) {
      throw new BadRequestException("identifier is required");
    }

    this.assertNotLocked(identifier, ip);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user || !user.active) {
      await this.auditService.log({
        userId: user?.id,
        method: "POST",
        path: "/auth/login",
        action: "login_failed",
        entity: "auth",
        entityId: identifier,
        requestBody: { identifier, ip },
        responseBody: { message: "Invalid credentials" },
        statusCode: 401,
      });
      this.registerFailure(identifier, ip);
      throw new UnauthorizedException("Invalid credentials");
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      await this.auditService.log({
        userId: user?.id,
        method: "POST",
        path: "/auth/login",
        action: "login_failed",
        entity: "auth",
        entityId: identifier,
        requestBody: { identifier, ip },
        responseBody: { message: "Invalid credentials" },
        statusCode: 401,
      });
      this.registerFailure(identifier, ip);
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.twoFactorEnabled) {
      if (!user.twoFactorSecret) {
        throw new UnauthorizedException("Two-factor not configured");
      }
      if (!dto.otp) {
        await this.auditService.log({
          userId: user.id,
          method: "POST",
          path: "/auth/login",
          action: "login_failed",
          entity: "auth",
          entityId: identifier,
          requestBody: { identifier, ip },
          responseBody: { message: "Two-factor code required" },
          statusCode: 401,
        });
        this.registerFailure(identifier, ip);
        throw new UnauthorizedException("Two-factor code required");
      }
      const otpOk = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: dto.otp,
        window: 1,
      });
      if (!otpOk) {
        await this.auditService.log({
          userId: user.id,
          method: "POST",
          path: "/auth/login",
          action: "login_failed",
          entity: "auth",
          entityId: identifier,
          requestBody: { identifier, ip },
          responseBody: { message: "Invalid two-factor code" },
          statusCode: 401,
        });
        this.registerFailure(identifier, ip);
        throw new UnauthorizedException("Invalid two-factor code");
      }
    }

    this.resetAttempts(identifier, ip);

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    const response = {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };

    await this.auditService.log({
      userId: user.id,
      method: "POST",
      path: "/auth/login",
      action: "login_success",
      entity: "auth",
      entityId: user.id.toString(),
      requestBody: { identifier, ip },
      responseBody: { twoFactorEnabled: user.twoFactorEnabled },
      statusCode: 200,
    });

    return response;
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { user: null };
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  async setupTwoFactor(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("User not found");
    }
    const secret = speakeasy.generateSecret({
      name: `RULLS ERP (${user.email})`,
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32, twoFactorEnabled: false },
    });
    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    };
  }

  async enableTwoFactor(userId: number, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException("Two-factor not setup");
    }
    const ok = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token,
      window: 1,
    });
    if (!ok) {
      throw new UnauthorizedException("Invalid two-factor code");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
    return { enabled: true };
  }

  async disableTwoFactor(userId: number, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException("Two-factor not setup");
    }
    const ok = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token,
      window: 1,
    });
    if (!ok) {
      throw new UnauthorizedException("Invalid two-factor code");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { enabled: false };
  }

  private key(ip: string) {
    return ip;
  }

  private assertNotLocked(identifier: string, ip: string) {
    if (!ENABLE_LOCKOUT) return;
    const key = this.key(ip);
    const state = this.attempts.get(key);
    if (!state) return;
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      const remaining = Math.ceil((state.lockedUntil - Date.now()) / 60000);
      throw new HttpException(
        `Too many attempts. Try again in ${remaining} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private registerFailure(identifier: string, ip: string) {
    if (!ENABLE_LOCKOUT) return;
    const key = this.key(ip);
    const now = Date.now();
    const state = this.attempts.get(key);
    if (!state || now - state.firstAttemptAt > WINDOW_MS) {
      this.attempts.set(key, { count: 1, firstAttemptAt: now });
      return;
    }
    state.count += 1;
    if (state.count >= MAX_ATTEMPTS) {
      state.lockedUntil = now + LOCK_MS;
    }
    this.attempts.set(key, state);
  }

  private resetAttempts(identifier: string, ip: string) {
    this.attempts.delete(this.key(ip));
  }
}
