import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: false,
    transform: true,
  }));

  // Serve Frontend SPA if built
  const possibleDistPaths = [
    path.resolve(process.cwd(), '..', 'frontend', 'dist'),
    path.resolve(process.cwd(), 'frontend', 'dist'),
    path.resolve(__dirname, '..', '..', 'frontend', 'dist'),
  ];

  let frontendDist = possibleDistPaths.find(p => fs.existsSync(p));
  if (frontendDist) {
    logger.log(`Serving static frontend from: ${frontendDist}`);
    app.use(express.static(frontendDist));
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
        return res.sendFile(path.join(frontendDist!, 'index.html'));
      }
      next();
    });
  }

  const port = process.env.PORT || 5000;
  await app.listen(port);
  logger.log(`🚀 Quiz Backend (NestJS) running on http://localhost:${port}`);
  if (frontendDist) {
    logger.log(`🌐 Web App available at http://localhost:${port}`);
  }
}

bootstrap();
