import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppConfig } from './config/env.config';

async function bootstrap(): Promise<void> {
  // rawBody: the payment webhook signature is computed over the exact bytes
  // sent, so a re-serialised body would never verify.
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');

  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const port = config.get('PORT', { infer: true });
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });

  app.setGlobalPrefix('api/v1');

  /*
   * Behind a platform proxy (Railway, a load balancer), every request arrives
   * from the proxy's address. Without this the rate limiter sees one client
   * making all the traffic, so the 120-a-minute cap applies to everybody at
   * once and the second person to use the site is throttled by the first.
   *
   * One hop only. Trusting the whole chain would let a caller forge
   * X-Forwarded-For and hand themselves a fresh quota per request.
   */
  if (config.get('TRUST_PROXY', { infer: true })) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

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

  if (nodeEnv !== 'production' && !config.get('DEPLOY_GATE_TOKEN', { infer: true })) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('PG Platform API')
      .setDescription('PG and hostel marketplace and management platform')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
    logger.log(`API docs at http://localhost:${port}/api/docs`);
  }

  // 0.0.0.0, not localhost: a container that binds the loopback is unreachable
  // from outside itself, and the platform health check never passes.
  await app.listen(port, '0.0.0.0');
  logger.log(`Listening on port ${port}, prefix /api/v1 (${nodeEnv})`);
}

void bootstrap();
