import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { HttpErrorFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: "25mb" }));
  app.use(urlencoded({ extended: true, limit: "25mb" }));
  const corsOrigins = [
    "http://localhost:3000",
    "http://192.168.1.25:3000",
    "https://panel.rulls.eu",
    "http://panel.rulls.eu",
  ];
  app.enableCors({ origin: corsOrigins });
  app.useGlobalFilters(new HttpErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(3001, "0.0.0.0");
}
bootstrap();
