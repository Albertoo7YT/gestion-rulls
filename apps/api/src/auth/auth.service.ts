import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import * as bcrypt from "bcryptjs";

type AttemptState = {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
};

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private attempts = new Map<string, AttemptState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
      this.registerFailure(identifier, ip);
      throw new UnauthorizedException("Invalid credentials");
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      this.registerFailure(identifier, ip);
      throw new UnauthorizedException("Invalid credentials");
    }

    this.resetAttempts(identifier, ip);

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    };
  }

  private key(identifier: string, ip: string) {
    return `${identifier}|${ip}`;
  }

  private assertNotLocked(identifier: string, ip: string) {
    const key = this.key(identifier, ip);
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
    const key = this.key(identifier, ip);
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
    this.attempts.delete(this.key(identifier, ip));
  }
}
