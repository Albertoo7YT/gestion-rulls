import {
  Body,
  Controller,
  Get,
  Put,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { UpdateWooSettingsDto } from "./dto/update-woo-settings.dto";

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
}
