import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("BA Document Control API")
    .setDescription("Project document management, import, comments, media, and export APIs.")
    .setVersion("1.0")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(config.get<number>("PORT", 3000));
}

void bootstrap();
