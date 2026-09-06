import "dotenv/config";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { readCorsOrigins, readPort } from "./shared/config/environment";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: readCorsOrigins(process.env.WEB_ORIGIN),
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );
  app.enableShutdownHooks();

  await app.listen(readPort(process.env.PORT, 3001), "0.0.0.0");
}

void bootstrap();
