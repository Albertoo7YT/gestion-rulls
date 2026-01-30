import { Body, Controller, Get, Post, Req, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "./public.decorator";
import { TwoFactorDto } from "./dto/two-factor.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() body: LoginDto, @Req() req: Request) {
    return this.authService.login(body, req.ip ?? "unknown");
  }

  @Get("me")
  me(@Req() req: Request & { user?: any }) {
    if (!req.user?.id) return { user: null };
    return this.authService.me(req.user.id);
  }

  @Post("2fa/setup")
  setupTwoFactor(@Req() req: Request & { user?: any }) {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.authService.setupTwoFactor(req.user?.id);
  }

  @Post("2fa/enable")
  enableTwoFactor(@Body() body: TwoFactorDto, @Req() req: Request & { user?: any }) {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.authService.enableTwoFactor(req.user?.id, body.token);
  }

  @Post("2fa/disable")
  disableTwoFactor(@Body() body: TwoFactorDto, @Req() req: Request & { user?: any }) {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.authService.disableTwoFactor(req.user?.id, body.token);
  }
}
