import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { BackupService } from "./backup.service";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";

@Controller("backup")
@Roles(UserRole.admin)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post("run")
  run() {
    return this.backupService.runBackup();
  }

  @Get("list")
  list() {
    return this.backupService.listBackups();
  }

  @Get("download/:name")
  async download(@Param("name") name: string, @Res() res: Response) {
    try {
      const fullPath = await this.backupService.getBackupPath(name);
      return res.download(fullPath);
    } catch (err) {
      throw new NotFoundException("Backup not found");
    }
  }
}
