import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppConfig } from './config/env.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');

  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const port = config.get('PORT', { infer: true });
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    maxAge: 86_400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('PG Platform API')
      .setDescription('PG and hostel marketplace and management platform')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
    logger.log(`API docs at http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  logger.log(`Listening on http://localhost:${port}/api/v1 (${nodeEnv})`);
}

void bootstrap();
