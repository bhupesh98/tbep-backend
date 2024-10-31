import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as process from 'node:process';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (process.env.NODE_ENV === 'production') {
        const FRONTEND_URL = process.env.FRONTEND_URL;
        if (!FRONTEND_URL || requestOrigin === FRONTEND_URL) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        callback(null, true);
      }
    },
    credentials: false,
    methods: 'GET, POST',
  });
  app.use(compression());
  await app.listen(process.env.PORT ?? 4000);
}

bootstrap()
  .then(() => Logger.log(`Server started on ${process.env.PORT ?? 4000}`, 'Bootstrap'))
  .catch((error) => {
    Logger.error(`Failed to start server: ${error}`, 'Bootstrap');
    process.exit(1);
  });
