import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "./public.decorator";

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
    return { user: req.user ?? null };
  }
}
