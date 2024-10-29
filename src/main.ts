import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as process from 'node:process';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.use(compression());
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap()
  .then(() => Logger.log(`Server started on ${process.env.PORT}`, 'Bootstrap'))
  .catch((error) => {
    Logger.error(`Failed to start server: ${error}`, 'Bootstrap');
    process.exit(1);
  });
