import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { loadEnvFile } from './config/env';

loadEnvFile();

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: false,
  });

  const port = process.env.PORT || 5000;
  await app.listen(port);
  logger.log(`Quiz Bot Backend is running on: http://localhost:${port}`);
}

bootstrap();
