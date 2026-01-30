import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { UpdateWooSettingsDto } from "./dto/update-woo-settings.dto";
import { UpdateFiscalSettingsDto } from "./dto/update-fiscal-settings.dto";
import { PurgeSettingsDto } from "./dto/purge-settings.dto";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";

@Controller("settings")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Get("woo")
  getWooSettings() {
    return this.settingsService.getWooSettings();
  }

  @Put("woo")
  updateWooSettings(@Body() body: UpdateWooSettingsDto) {
    return this.settingsService.updateWooSettings(body);
  }

  @Get("fiscal")
  getFiscalSettings() {
    return this.settingsService.getFiscalSettings();
  }

  @Put("fiscal")
  updateFiscalSettings(@Body() body: UpdateFiscalSettingsDto) {
    return this.settingsService.updateFiscalSettings(body);
  }

  @Post("purge")
  @Roles(UserRole.admin)
  purgeData(@Body() body: PurgeSettingsDto) {
    return this.settingsService.purgeData(body.targets);
  }
}
